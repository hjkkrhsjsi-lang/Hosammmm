// ============ تحويل صورة/جيف/فيديو قصير لاستيكر واتساب (.webp) ============
// أمر !استريك: يرد على صورة أو جيف (أو يبعتها مع الأمر مباشرة) فيحوّلها لاستيكر.
// - صورة عادية (jpg/png/webp..) -> استيكر ثابت عبر sharp.
// - جيف أو فيديو قصير -> استيكر متحرك عبر ffmpeg (نفس أسلوب media.js بالضبط).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const sharp = require('sharp');

// حد أقصى لمدة الاستيكر المتحرك (ثواني) - واتساب ما يقبل استيكرات متحركة طويلة أكتر من هيك بشكل موثوق
const MAX_ANIMATED_STICKER_SECONDS = 6;

// ============ استيكر ثابت من صورة عادية ============
async function imageBufferToStickerBuffer(sourceBuffer) {
  return sharp(sourceBuffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 } // خلفية شفافة بدل ما تتقص الصورة أو تتشوه
    })
    .webp({ quality: 80 })
    .toBuffer();
}

// ============ استيكر متحرك من جيف أو فيديو قصير ============
async function animatedBufferToStickerBuffer(sourceBuffer, mimetype) {
  const tmpId = crypto.randomBytes(6).toString('hex');
  const inExt = (mimetype || '').includes('gif') ? 'gif' : 'mp4';
  const inPath = path.join(os.tmpdir(), `stk_in_${tmpId}.${inExt}`);
  const outPath = path.join(os.tmpdir(), `stk_out_${tmpId}.webp`);

  fs.writeFileSync(inPath, sourceBuffer);

  try {
    await new Promise((resolve, reject) => {
      execFile(
        ffmpegPath,
        [
          '-y', '-i', inPath,
          '-vf',
          'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
          '-c:v', 'libwebp',
          '-lossless', '0',
          '-q:v', '60',
          '-loop', '0',
          '-preset', 'default',
          '-an', // الاستيكرات ما تدعم صوت أصلاً
          '-vsync', '0',
          '-t', String(MAX_ANIMATED_STICKER_SECONDS),
          outPath
        ],
        (err, stdout, stderr) => {
          if (err) {
            console.error('❌ ffmpeg فشل بتحويل الاستيكر المتحرك:', err.message, '\nstderr:', stderr || '(فاضي)');
            reject(new Error(`فشل تحويل الجيف/الفيديو لاستيكر: ${err.message}`));
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

// ============ نقطة الدخول الموحّدة: تحدد نوع الميديا وتختار الطريقة المناسبة ============
async function mediaBufferToStickerBuffer(sourceBuffer, mimetype) {
  const isAnimated = !!mimetype && (mimetype.includes('gif') || mimetype.startsWith('video/'));
  if (isAnimated) return animatedBufferToStickerBuffer(sourceBuffer, mimetype);
  return imageBufferToStickerBuffer(sourceBuffer);
}

module.exports = {
  mediaBufferToStickerBuffer,
  imageBufferToStickerBuffer,
  animatedBufferToStickerBuffer
};
