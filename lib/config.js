// ============ إعدادات/مفاتيح مشتركة يستخدمها أكتر من ملف ============

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// مفتاح Pollinations.ai - لتوليد وتعديل الصور بالذكاء الاصطناعي (أوامر !صمم و!عدل)
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;

// ============ شات مراد/سعاد صار يستخدم Groq (Llama 3.3 70B) بدل جيميناي - أقوى وبنفس المفتاح المجاني ============
const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_CHAT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// الرابط اللي بيبعته أمر !رابط
const SHARED_LINK = 'https://lambent-cat-50bd8a.netlify.app/';

module.exports = {
  GROQ_API_KEY,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_ENDPOINT,
  GROQ_CHAT_MODEL,
  GROQ_CHAT_ENDPOINT,
  SHARED_LINK,
  POLLINATIONS_API_KEY
};
