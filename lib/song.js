// ============ أمر !اغنية: يدور على أغنية بالاسم أو رابط ويبعتها كبلاغ صوتي (ptt) ============
// يعتمد على حزمة yt-dlp-exec (لازم تنزلها: npm install yt-dlp-exec) + ffmpeg-static
// (موجودة أصلاً بالمشروع، مستخدمة بملف media.js).
//
// نسخة "مقوّاة": كل نقطة ممكن تسبب تسريب ملفات مؤقتة أو تعليق (hang) لا نهائي
// أو تحميل زيادة عن اللزوم متكفّل فيها بشكل صريح - عشان ما تصير سبب كراش
// للبوت كامل لو استخدمها ناس كثير بنفس الوقت أو دخلوا مدخلات غريبة.

'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const ytdlp = require('yt-dlp-exec');

// ---- إعدادات قابلة للتعديل ----
const MAX_DURATION_SECONDS = 15 * 60;      // 15 دقيقة كحد أقصى لأي فيديو/رابط
const MAX_FILESIZE = '50m';                // حد أقصى لحجم الملف الخام قبل التحويل
const MAX_QUERY_LENGTH = 200;              // حماية من نص طويل جداً بالغلط
const DOWNLOAD_TIMEOUT_MS = 90 * 1000;     // توقف قسري لو yt-dlp علّق (شبكة بطيئة/معلّقة)
const FFMPEG_TIMEOUT_MS = 30 * 1000;       // توقف قسري لو ffmpeg علّق
const MAX_CONCURRENT_DOWNLOADS = 2;        // أقصى عدد تحميلات شغّالة بنفس اللحظة (حماية من ضغط يطيح السيرفر)
const QUEUE_WAIT_TIMEOUT_MS = 60 * 1000;   // لو الدور طويل كثير، نرفض بدل ما نخلي الطلبات تتكوم للأبد

// ---- تحقق مبكر: ffmpeg موجود فعلاً؟ (لو npm install فشل بصمت هذا يمسك الخطأ فوراً بدل ما يطيح بمكان غامض لاحقاً) ----
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
  console.error('⚠️ [song.js] ffmpeg-static ما لقيته! تأكد إنك سويت npm install صح.');
}

// ---- طابور بسيط (semaphore) يمنع أكثر من MAX_CONCURRENT_DOWNLOADS تحميل بنفس الوقت ----
let activeDownloads = 0;
const waitQueue = [];

function acquireSlot() {
  return new Promise((resolve, reject) => {
    const timedOut = { flag: false };
    const timer = setTimeout(() => {
      timedOut.flag = true;
      const idx = waitQueue.indexOf(tryAcquire);
      if (idx !== -1) waitQueue.splice(idx, 1);
      reject(new Error('فيه ضغط طلبات أغاني كثير هلق، جرب بعد شوي 🙏'));
    }, QUEUE_WAIT_TIMEOUT_MS);

    function tryAcquire() {
      if (timedOut.flag) return;
      if (activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
        clearTimeout(timer);
        activeDownloads++;
        resolve();
      } else {
        waitQueue.push(tryAcquire);
      }
    }
    tryAcquire();
  });
}

function releaseSlot() {
  activeDownloads = Math.max(0, activeDownloads - 1);
  const next = waitQueue.shift();
  if (next) next();
}

// ---- أداة عامة: تلف أي Promise بحد أقصى للوقت، وترفض برسالة واضحة لو تجاوزه ----
function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ---- تنظيف آمن لمجلد مؤقت (ما يطيح البرنامج حتى لو فشل الحذف نفسه) ----
function safeCleanup(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    console.error('⚠️ [song.js] فشل تنظيف مجلد مؤقت:', tmpDir, err.message);
  }
}

function isUrl(text) {
  return /^https?:\/\//i.test(String(text || '').trim());
}

// ---- الخطوة 1: تحميل الصوت الخام (بحث بالاسم أو رابط مباشر) ----
async function runYtDlp(target, outTemplate) {
  const task = ytdlp(target, {
    output: outTemplate,
    extractAudio: true,
    audioFormat: 'mp3',
    noPlaylist: true,
    noWarnings: true,
    maxFilesize: MAX_FILESIZE,
    matchFilter: `duration <= ${MAX_DURATION_SECONDS}`,
    ffmpegLocation: ffmpegPath
  });
  await withTimeout(task, DOWNLOAD_TIMEOUT_MS, 'التحميل أخذ وقت طويل كثير ووقفناه (يمكن الرابط/الشبكة بطيئة)');
}

// ---- الخطوة 2: تحويل الملف الخام لـ ogg/opus صالح لبلاغ صوتي (ptt) ----
function runFfmpegToOgg(rawPath, oggPath) {
  const task = new Promise((resolve, reject) => {
    const child = execFile(
      ffmpegPath,
      ['-y', '-i', rawPath, '-c:a', 'libopus', '-b:a', '64k', '-vn', '-ac', '1', oggPath],
      (err) => (err ? reject(err) : resolve())
    );
    // حماية إضافية: لو execFile نفسه علّق بدون ما يرجع كول-باك (نادر بس ممكن)
    child.on('error', reject);
  });
  return withTimeout(task, FFMPEG_TIMEOUT_MS, 'تحويل الصوت أخذ وقت طويل كثير ووقفناه');
}

// تحميل الصوت (بحث بالاسم أو رابط مباشر) وتحويله لـ ogg/opus جاهز للإرسال كـ ptt
async function downloadSongAsPtt(query) {
  const cleanQuery = String(query || '').trim().slice(0, MAX_QUERY_LENGTH);
  if (!cleanQuery) {
    throw new Error('لازم تكتب اسم الأغنية أو تحط رابط بعد الأمر');
  }
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    throw new Error('الأداة المسؤولة عن تحويل الصوت مو مثبتة صح بالسيرفر (ffmpeg-static)');
  }

  // ننتظر دورنا لو فيه تحميلات كثير شغّالة هلق (بدل ما نخلي كل الطلبات تشتغل مرة وحدة وتطيح السيرفر)
  await acquireSlot();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'song-' + crypto.randomBytes(4).toString('hex') + '-'));

  try {
    const outTemplate = path.join(tmpDir, 'audio.%(ext)s');
    const target = isUrl(cleanQuery) ? cleanQuery : `ytsearch1:${cleanQuery}`;

    try {
      await runYtDlp(target, outTemplate);
    } catch (err) {
      console.error('❌ [song.js] فشل تحميل yt-dlp:', err && err.message);
      throw new Error('ما قدرت ألقى/أحمّل الأغنية (تأكد من الاسم أو الرابط، أو جرب أغنية ثانية)');
    }

    const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith('audio.'));
    const downloaded = files.find((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));
    if (!downloaded) {
      throw new Error('ما قدرت ألقى ملف الصوت بعد التحميل (يمكن الفيديو أطول من الحد المسموح: 15 دقيقة)');
    }

    const rawPath = path.join(tmpDir, downloaded);
    const rawStat = fs.statSync(rawPath);
    if (!rawStat.size) {
      throw new Error('الملف اللي انحمّل فاضي/تالف، جرب مرة ثانية');
    }

    const oggPath = path.join(tmpDir, 'audio.ogg');
    try {
      await runFfmpegToOgg(rawPath, oggPath);
    } catch (err) {
      console.error('❌ [song.js] فشل تحويل ffmpeg:', err && err.message);
      throw new Error('ما قدرت أحوّل الأغنية لصيغة صوتية صالحة');
    }

    if (!fs.existsSync(oggPath) || !fs.statSync(oggPath).size) {
      throw new Error('فشل إنشاء ملف الصوت النهائي');
    }

    return fs.readFileSync(oggPath);
  } finally {
    // 🔒 تنظيف مضمون دائماً - سواء نجح كل شي أو فشل بأي خطوة، ما نسيب ملفات مؤقتة تتراكم بالسيرفر
    safeCleanup(tmpDir);
    releaseSlot();
  }
}

module.exports = { downloadSongAsPtt, isUrl };
