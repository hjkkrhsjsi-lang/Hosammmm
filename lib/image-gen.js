const axios = require('axios');
const { GEMINI_API_KEY } = require('./config');

// Gemini 2.5 Flash Image (نانو بنانا) - توليد وتعديل صور - مجاني (~500 صورة/يوم) عبر Google AI Studio
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const GEMINI_IMAGE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

/**
 * يستخرج أول صورة (base64) من رد Gemini
 */
function extractImageFromResponse(data) {
  const candidates = data && data.candidates;
  if (!candidates || !candidates[0]) throw new Error('ما رجع الـ API أي نتيجة');
  const parts = candidates[0].content && candidates[0].content.parts;
  if (!parts) throw new Error('رد غير متوقع من الـ API (بدون parts)');

  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw new Error('ما رجعت الاستجابة أي صورة (ربما رفض الموديل الطلب)');
}

/**
 * يولّد صورة من وصف نصي عبر Gemini 2.5 Flash Image
 * @param {string} prompt - وصف الصورة المطلوبة (عربي أو انجليزي)
 * @returns {Promise<Buffer>} بيانات الصورة كـ Buffer جاهزة للإرسال بواتساب
 */
async function generateImage(prompt) {
  try {
    const response = await axios.post(
      `${GEMINI_IMAGE_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt.trim() }]
          }
        ]
      },
      {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    return extractImageFromResponse(response.data);
  } catch (err) {
    const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    console.error('تفاصيل خطأ Gemini (توليد):', detail);
    throw new Error(detail);
  }
}

/**
 * يعدّل صورة موجودة عبر Gemini 2.5 Flash Image (نفس endpoint التوليد، بس مع إرفاق صورة)
 * @param {Buffer} imageBuffer - بيانات الصورة الأصلية
 * @param {string} mimetype - نوع الصورة (مثلاً image/jpeg)
 * @param {string} instruction - وصف التعديل المطلوب (عربي أو انجليزي)
 * @returns {Promise<Buffer>} بيانات الصورة المعدّلة كـ Buffer جاهزة للإرسال بواتساب
 */
async function editImage(imageBuffer, mimetype, instruction) {
  try {
    const base64Image = imageBuffer.toString('base64');
    const response = await axios.post(
      `${GEMINI_IMAGE_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { inlineData: { mimeType: mimetype || 'image/jpeg', data: base64Image } },
              { text: instruction.trim() }
            ]
          }
        ]
      },
      {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    return extractImageFromResponse(response.data);
  } catch (err) {
    const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    console.error('تفاصيل خطأ Gemini (تعديل):', detail);
    throw new Error(detail);
  }
}

module.exports = { generateImage, editImage };
