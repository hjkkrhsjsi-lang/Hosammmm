// ============ إشعارات تحديثات الجروب (ترقية/تنزيل إداري، صورة، رابط دعوة) ============
// ملاحظة: ميزة الترحيب والوداع (رسالة لما عضو ينضم/يخرج) اتحذفت بالكامل بطلب المستخدم.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { jidToNumber } = require('./util');
const { formatLocalDateTime, formatTripoliTime } = require('./country-time');
const R = require('./responses');

// إحداثيات الدائرة الفاضية بصور الترحيب/الوداع (نفس المكان بالصورتين)
// (اتعايرت بالضبط على حدود الحلقة البيضاء المرسومة بالبانر عشان الصورة تعبي الدائرة بالكامل بدون فراغ)
const AVATAR_CIRCLE = { left: 340, top: 88, size: 420 };

// أسماء أغاني الترحيب - يتبدل بينهم بالتناوب (مرة هذي، مرة هذي) كل عضو جديد
const WELCOME_SONGS = ['welcome-song-1.ogg', 'welcome-song-2.ogg'];
// ملف صغير يحفظ آخر رقم أغنية اتبعتت، عشان التناوب يستمر حتى لو البوت أعاد التشغيل
const SONG_STATE_FILE = '.welcome-song-state.json';

// يرجع اسم ملف الأغنية اللي لازم تتبعت هالمرة، وبيحدّث الحالة للمرة الجاية
function nextWelcomeSongName(imagesDir) {
  const statePath = path.join(imagesDir, SONG_STATE_FILE);
  let lastIndex = -1;
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    lastIndex = typeof state.lastIndex === 'number' ? state.lastIndex : -1;
  } catch {
    lastIndex = -1; // أول مرة أو الملف مو موجود/تالف
  }
  const nextIndex = (lastIndex + 1) % WELCOME_SONGS.length;
  try {
    fs.writeFileSync(statePath, JSON.stringify({ lastIndex: nextIndex }));
  } catch (err) {
    console.error('خطأ بحفظ حالة تناوب أغنية الترحيب:', err.message);
  }
  return WELCOME_SONGS[nextIndex];
}

// يجيب صورة بروفايل العضو، يقصها دائرية، ويركبها فوق صورة البانر
// بمكان الدائرة الفاضية. يرجع null لو صار أي خطأ (نكمل بالصورة العادية)
async function composeAvatarOnBanner(sock, participantJid, bannerPath) {
  try {
    let avatarBuffer;
    try {
      const url = await sock.profilePictureUrl(participantJid, 'image');
      const res = await fetch(url);
      avatarBuffer = Buffer.from(await res.arrayBuffer());
    } catch {
      return null; // ماله صورة بروفايل (خاص أو مافيه) - نكمل بدون دمج
    }

    const { size, left, top } = AVATAR_CIRCLE;
    const circleMaskSvg = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );

    const roundedAvatar = await sharp(avatarBuffer)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: circleMaskSvg, blend: 'dest-in' }])
      .png()
      .toBuffer();

    const finalImage = await sharp(bannerPath)
      .composite([{ input: roundedAvatar, left, top }])
      .png()
      .toBuffer();

    return finalImage;
  } catch (err) {
    console.error('خطأ بدمج صورة البروفايل بالبانر:', err.message);
    return null;
  }
}

// ============ معالج حدث ترقية/تنزيل عضو (group-participants.update بـ Baileys) ============
// update: { id: groupJid, participants: [jid,...], action: 'add'|'remove'|'promote'|'demote', author?: jid }
async function handleGroupParticipantsUpdate(sock, imagesDir, update) {
  try {
    const { id: groupJid, participants, action, author } = update;

    // -------- عضو جديد انضم (ترحيب) --------
    if (action === 'add') {
      for (const p of participants || []) {
        const number = jidToNumber(p);
        const { dateStr, timeStr } = formatLocalDateTime(number);
        const banner = R.greet.memberJoined(number, dateStr, timeStr);

        // صورة الترحيب (مع صورة بروفايل العضو مركّبة بالدائرة لو أمكن)
        try {
          const imgPath = path.join(imagesDir, 'welcome.png');
          if (fs.existsSync(imgPath)) {
            const composed = await composeAvatarOnBanner(sock, p, imgPath);
            await sock.sendMessage(groupJid, {
              image: composed || fs.readFileSync(imgPath),
              caption: banner,
              mentions: [p]
            });
          } else {
            await sock.sendMessage(groupJid, { text: banner, mentions: [p] });
          }
        } catch (err) {
          console.error('خطأ بإرسال بانر الترحيب:', err.message);
        }

        // أغنية ترحيبية - تتبدل بالتناوب بين welcome-song-1.ogg و welcome-song-2.ogg
        try {
          const songName = nextWelcomeSongName(imagesDir);
          const songPath = path.join(imagesDir, songName);
          if (fs.existsSync(songPath)) {
            await sock.sendMessage(groupJid, {
              audio: fs.readFileSync(songPath),
              mimetype: 'audio/ogg; codecs=opus',
              ptt: true
            });
          } else {
            console.error(`ملف أغنية الترحيب غير موجود: ${songPath}`);
          }
        } catch (err) {
          console.error('خطأ بإرسال أغنية الترحيب:', err.message);
        }
      }
      return;
    }

    // -------- عضو خرج بنفسه (وداع) - لو اتطرد بواسطة أدمن/البوت، ما منبعتش وداع
    // (لأن بانر الطرد "تم طرد العضو بنجاح" من !باند أو النظام التلقائي بيغطي الحالة دي أصلاً) --------
    if (action === 'remove') {
      for (const p of participants || []) {
        // لو فيه "author" (حد نفّذ الإزالة) وهو مش نفس الشخص اللي طلع، معناها طرد مش مغادرة طوعية
        const wasKicked = !!author && jidToNumber(author) !== jidToNumber(p);
        if (wasKicked) continue; // البانر الخاص بالطرد هو اللي هيتبعت، مش هاد

        const number = jidToNumber(p);
        const { dateStr, timeStr } = formatLocalDateTime(number);
        const banner = R.greet.memberLeft(number, dateStr, timeStr);
        try {
          const imgPath = path.join(imagesDir, 'goodbye.png');
          if (fs.existsSync(imgPath)) {
            const composed = await composeAvatarOnBanner(sock, p, imgPath);
            await sock.sendMessage(groupJid, {
              image: composed || fs.readFileSync(imgPath),
              caption: banner,
              mentions: [p]
            });
          } else {
            await sock.sendMessage(groupJid, { text: banner, mentions: [p] });
          }
        } catch (err) {
          console.error('خطأ بإرسال بانر الوداع:', err.message);
        }
      }
      return;
    }

  } catch (err) {
    console.error('خطأ بمعالجة تحديث أعضاء الجروب:', err.message);
  }
}

// ============ معالج حدث تغيير بيانات الجروب (groups.update بـ Baileys: صورة/رابط دعوة) ============
// ملاحظة: Baileys غالباً ما بيجيبش "مين اللي غيّر" (author) بشكل موثوق لكل الحالات،
// فمنعرض "؟" لو مو متوفر (نفس فكرة الأصل `actor?.number || '؟'`).
async function handleGroupsUpdate(sock, updates) {
  for (const update of updates) {
    try {
      const groupJid = update.id;
      if (!groupJid) continue;
      const authorTag = jidToNumber(update.author) || '؟';

      if (Object.prototype.hasOwnProperty.call(update, 'imgUrl') || update.picture !== undefined) {
        const banner = R.greet.groupPhotoChanged(authorTag);
        await sock.sendMessage(groupJid, { text: banner, mentions: update.author ? [update.author] : [] });
        continue;
      }

      if (update.inviteCode !== undefined) {
        const banner = R.greet.groupInviteChanged(authorTag);
        await sock.sendMessage(groupJid, { text: banner, mentions: update.author ? [update.author] : [] });
      }
    } catch (err) {
      console.error('خطأ بمعالجة تحديث بيانات الجروب:', err.message);
    }
  }
}

module.exports = {
  handleGroupParticipantsUpdate,
  handleGroupsUpdate,
  formatTripoliTime
};
