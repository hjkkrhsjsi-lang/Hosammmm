// ============ بناء الصور: بروفايل، جيفات مخزّنة ============
// كل دوال sharp/svg نفسها زي الأصل بدون تغيير (ما كانتش تعتمد على whatsapp-web.js أصلاً).
// الشي الوحيد اللي اتغيّر فعلياً هو getProfilePicBuffer: بـ Baileys بنجيب رابط صورة
// البروفايل بـ sock.profilePictureUrl(jid, 'image') بدل client.getProfilePicUrl(id).

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const sharp = require('sharp');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static'); // مسار ffmpeg الثابت، ما يعتمد على PATH النظام إطلاقًا

// ============ جلب صورة بروفايل العضو من واتساب (نسخة Baileys) ============
// jid: معرف Baileys كامل (مثلاً "218912345678@s.whatsapp.net")
async function getProfilePicBuffer(sock, jid) {
  if (!sock || !jid) return null;
  try {
    const url = await sock.profilePictureUrl(jid, 'image');
    if (!url) return null;
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    return Buffer.from(res.data);
  } catch (err) {
    // طبيعي جداً إن هذا يفشل لو العضو ما عندوش صورة بروفوايل أصلاً - مش لازم نعتبره خطأ خطير
    console.log(`ℹ️ ما قدرت أجيب صورة بروفايل لـ ${jid}:`, err.message);
    return null;
  }
}

// ============ صورة افتراضية (لو العضو ماله صورة بروفايل) ============
async function defaultAvatarBuffer(diameter, letter) {
  const safeLetter = (letter || '?').toString().slice(0, 1).toUpperCase();
  const svg = `
    <svg width="${diameter}" height="${diameter}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#2b2b2b"/>
      <text x="50%" y="58%" font-size="${Math.round(diameter * 0.45)}" fill="#f4c430"
            text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">${safeLetter}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ============ جيفات/فيديوهات مخزّنة (كاش بالذاكرة) - نفس الأسماء والمنطق الأصلي ============
const MENU_GIF_FILENAME = '20caacc2489399565f83466b455f7fe1.gif';
const HUSAAM_GIF_FILENAME = '1ff0af8a1504f50df4d55185569031ac.gif';
const HUSAAM_MENTION_NUMBER = '218912832335';
const HUSAAM_MENTION_NUMBERS = [HUSAAM_MENTION_NUMBER, '218942301686'];
const HUQOQ_VIDEO_FILENAME = 'VID_20260721_170815.mp4';
// فيديوهات mp4 حقيقية (أصلها تيك توك) - فيها صوت، بتحل محل الجيفات القديمة الساكتة
const HUSAAM_VIDEO_FILENAME = 'VID_20260724_121837.mp4';
const MENU_VIDEO_FILENAME = 'VID_20260803_223533.mp4';

let cachedMenuGifMp4 = null;
let cachedHusaamGifMp4 = null;
let cachedHuqoqVideoBuffer = null;
let cachedHuqoqPtvBuffer = null;
let cachedHusaamVideoBuffer = null;
let cachedMenuVideoBuffer = null;

// ============ تحويل فيديو لمربّع (1:1) مع الحفاظ على الصوت - شرط أساسي لفيديو دائري (ptv) بواتساب ============
async function videoToSquarePtvBuffer(sourceBuffer) {
  const tmpId = crypto.randomBytes(6).toString('hex');
  const inPath = path.join(os.tmpdir(), `ptv_in_${tmpId}.mp4`);
  const outPath = path.join(os.tmpdir(), `ptv_out_${tmpId}.mp4`);
  fs.writeFileSync(inPath, sourceBuffer);
  try {
    await new Promise((resolve, reject) => {
      execFile(
        ffmpegPath,
        [
          '-y', '-i', inPath,
          // نقص أطول ضلع بالنص عشان الفيديو يصير مربّع تمام (شرط واتساب لفيديو الدائري)
          '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=480:480",
          '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '128k',
          '-movflags', '+faststart',
          outPath
        ],
        (err, stdout, stderr) => {
          if (err) {
            console.error('❌ ffmpeg فشل بتحويل الفيديو لمربّع/دائري:', err.message, '\nstderr:', stderr || '(فاضي)');
            reject(new Error(`فشل تحويل الفيديو: ${err.message}`));
          } else {
            resolve();
          }
        }
      );
    });
    return fs.readFileSync(outPath);
  } finally {
    try { fs.unlinkSync(inPath); } catch (_) {}
    try { fs.unlinkSync(outPath); } catch (_) {}
  }
}

async function gifToMp4Buffer(gifPath) {
  // نتأكد إن الملف الأصلي موجود أصلاً قبل حتى ما نحاول نشغل ffmpeg
  // (لو المسار غلط أو الملف ناقص بالسيرفر، بنعرف هذا بالضبط من رسالة الخطأ بدل خطأ ffmpeg غامض)
  if (!fs.existsSync(gifPath)) {
    throw new Error(`الملف مش موجود بالسيرفر أصلاً: ${gifPath}`);
  }
  const tmpId = crypto.randomBytes(6).toString('hex');
  const outPath = path.join(os.tmpdir(), `gif_${tmpId}.mp4`);
  try {
    await new Promise((resolve, reject) => {
      execFile(
        ffmpegPath,
        [
          '-y', '-i', gifPath,
          '-movflags', 'faststart',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          outPath
        ],
        (err, stdout, stderr) => {
          if (err) {
            // نطبع stderr الحقيقي من ffmpeg (بيوضح السبب بالضبط: صلاحيات، مكتبة ناقصة، صيغة غير مدعومة...)
            console.error('❌ ffmpeg فشل بتحويل الجيف:', err.message, '\nstderr:', stderr || '(فاضي)');
            reject(new Error(`فشل تحويل الجيف بـ ffmpeg: ${err.message}`));
          } else {
            resolve();
          }
        }
      );
    });
    return fs.readFileSync(outPath);
  } finally {
    try { fs.unlinkSync(outPath); } catch (_) {}
  }
}

async function getMenuGifMp4Buffer(imagesDir) {
  if (cachedMenuGifMp4) return cachedMenuGifMp4;
  cachedMenuGifMp4 = await gifToMp4Buffer(path.join(imagesDir, MENU_GIF_FILENAME));
  return cachedMenuGifMp4;
}

async function getHusaamGifMp4Buffer(imagesDir) {
  if (cachedHusaamGifMp4) return cachedHusaamGifMp4;
  cachedHusaamGifMp4 = await gifToMp4Buffer(path.join(imagesDir, HUSAAM_GIF_FILENAME));
  return cachedHusaamGifMp4;
}

async function getHuqoqVideoBuffer(imagesDir) {
  if (cachedHuqoqVideoBuffer) return cachedHuqoqVideoBuffer;
  const videoPath = path.join(imagesDir, HUQOQ_VIDEO_FILENAME);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`الملف مش موجود بالسيرفر أصلاً: ${videoPath}`);
  }
  cachedHuqoqVideoBuffer = fs.readFileSync(videoPath);
  return cachedHuqoqVideoBuffer;
}

// نسخة مربّعة من فيديو "حقوق بوت" جاهزة للإرسال كفيديو دائري (ptv) بصوته الأصلي
async function getHuqoqPtvBuffer(imagesDir) {
  if (cachedHuqoqPtvBuffer) return cachedHuqoqPtvBuffer;
  const original = await getHuqoqVideoBuffer(imagesDir);
  cachedHuqoqPtvBuffer = await videoToSquarePtvBuffer(original);
  return cachedHuqoqPtvBuffer;
}

// فيديو mp4 حقيقي لأمر "حسام" (بصوته - بدل الجيف الساكت القديم)
async function getHusaamVideoBuffer(imagesDir) {
  if (cachedHusaamVideoBuffer) return cachedHusaamVideoBuffer;
  const videoPath = path.join(imagesDir, HUSAAM_VIDEO_FILENAME);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`الملف مش موجود بالسيرفر أصلاً: ${videoPath}`);
  }
  cachedHusaamVideoBuffer = fs.readFileSync(videoPath);
  return cachedHusaamVideoBuffer;
}

// فيديو mp4 حقيقي لأمر "اوامر" (بصوته - بدل الجيف الساكت القديم)
async function getMenuVideoBuffer(imagesDir) {
  if (cachedMenuVideoBuffer) return cachedMenuVideoBuffer;
  const videoPath = path.join(imagesDir, MENU_VIDEO_FILENAME);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`الملف مش موجود بالسيرفر أصلاً: ${videoPath}`);
  }
  cachedMenuVideoBuffer = fs.readFileSync(videoPath);
  return cachedMenuVideoBuffer;
}

module.exports = {
  getProfilePicBuffer,
  defaultAvatarBuffer,
  getMenuGifMp4Buffer,
  getHusaamGifMp4Buffer,
  getHuqoqVideoBuffer,
  getHuqoqPtvBuffer,
  getHusaamVideoBuffer,
  getMenuVideoBuffer,
  HUSAAM_MENTION_NUMBER,
  HUSAAM_MENTION_NUMBERS
};
