// ============ شخصيات الذكاء الاصطناعي: ليون واشلي ============
// نفس البرومبتات والمنطق بالضبط من index.js القديم (ما كانتش تعتمد على whatsapp-web.js أصلاً).

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GROQ_CHAT_ENDPOINT, GROQ_CHAT_MODEL, GROQ_API_KEY } = require('./config');
const { MURAD_VOICE, NOVA_VOICE } = require('./voice');
const R = require('./responses');

const MURAD_SYSTEM_PROMPT = R.ai.muradSystemPrompt;

// شخصية اشلي - بنت ليبية عمرها 18، خفيفة الظل وكيوت وحنينة بأسلوبها، بدون أي محتوى غير لائق
// ملاحظة: اشلي "متزوجة" كجزء من شخصيتها - هذا التفصيل مدموج بالبرومبت نفسه (مش رد ثابت) عشان
// الذكاء الاصطناعي يرد بأسلوب مختلف وطبيعي كل مرة بدل ما يكرر نفس الجملة الجاهزة.
const SOUAD_BASE_PROMPT = R.ai.souadBasePrompt;

// الحالة العادية: اشلي متزوجة وقلبها لزوجها بس - لو حد غازلها ترفض بلطف ومرح، بصياغة مختلفة كل مرة
const SOUAD_MARRIED_NOTE = R.ai.souadMarriedNote;

// الحالة الخاصة: الشخص اللي يحكيها هو زوجها الحقيقي - ترد عليه بحب ودفا لأنه الوحيد اللي يملك قلبها
const SOUAD_LOVED_NOTE = R.ai.souadLovedNote;

function getSouadSystemPrompt(isLoved) {
  return `${SOUAD_BASE_PROMPT}\n\n${isLoved ? SOUAD_LOVED_NOTE : SOUAD_MARRIED_NOTE}`;
}

// الأرقام اللي اشلي تعتبرهم "زوجها الحقيقي" وترد عليهم بحب بدل رفض الغزل
const SOUAD_LOVED_NUMBERS = ['218912832335', '218942301686', '218930471213'];

// الافتراضي (لو ما فيه فحص رقم متاح بمكان الاستدعاء) - الحالة العادية: متزوجة وترفض الغزل بلطف
const SOUAD_SYSTEM_PROMPT = getSouadSystemPrompt(false);

// ============ سجل الشخصيات - عندها برومبت وصوت وذاكرة محادثة ============
const PERSONAS = {
  murad: {
    key: 'murad',
    name: 'ليون',
    gender: 'm',
    systemPrompt: MURAD_SYSTEM_PROMPT,
    voice: MURAD_VOICE,
    history: new Map() // chatId -> [{role, content}, ...]
  },
  souad: {
    key: 'souad',
    name: 'اشلي',
    gender: 'f',
    systemPrompt: SOUAD_SYSTEM_PROMPT,
    voice: NOVA_VOICE,
    history: new Map()
  }
};
const DEFAULT_PERSONA_KEY = 'murad';

// ============ ذاكرة سياق المحادثة (لكل شخصية ذاكرتها لحالها) ============
const MAX_HISTORY_MESSAGES = 24; // 12 تبادل تقريباً (كانت 6 = 3 تبادلات بس)
const MAX_TRACKED_CONVERSATIONS = 300;

function pushToHistory(historyMap, convoKey, role, content) {
  if (!historyMap.has(convoKey)) {
    historyMap.set(convoKey, []);
    if (historyMap.size > MAX_TRACKED_CONVERSATIONS) {
      const oldestKey = historyMap.keys().next().value;
      historyMap.delete(oldestKey);
    }
  }
  const history = historyMap.get(convoKey);
  history.push({ role, content });
  while (history.length > MAX_HISTORY_MESSAGES) {
    history.shift();
  }
}

function personaOfflineMessage(personaKey) {
  const p = PERSONAS[personaKey] || PERSONAS[DEFAULT_PERSONA_KEY];
  return p.gender === 'f' ? R.ai.offlineF(p.name) : R.ai.offlineM(p.name);
}

function personaBusyMessage(personaKey) {
  const p = PERSONAS[personaKey] || PERSONAS[DEFAULT_PERSONA_KEY];
  return p.gender === 'f' ? R.ai.busyF(p.name) : R.ai.busyM(p.name);
}

// ============ تتبع صاحب كل رسالة بعتها البوت (مراد أو سعاد) عشان نرد بنفس الشخصية على الـ Reply ============
// المفتاح: message key id (msg.key.id) بـ Baileys، القيمة: { persona: 'murad'|'souad' (المفاتيح الداخلية ثابتة بالكود، بس العرض للمستخدم صار ليون/اشلي), isVoice: true|false }
// isVoice: هل الرسالة الأصلية اللي بعتها البوت كانت صوتية (PTT) - عشان لما حد يرد عليها
// (حتى بكتابة عادية) نرجع نرد عليه بصوت هو كمان، مش نكسر توقعه ونرد بكتابة.
const sentMessagePersona = new Map();
const MAX_TRACKED_SENT_MESSAGES = 500;

function rememberSentMessage(sentMsgId, personaKey, isVoice = false) {
  if (!sentMsgId) return;
  sentMessagePersona.set(sentMsgId, { persona: personaKey, isVoice: !!isVoice });
  if (sentMessagePersona.size > MAX_TRACKED_SENT_MESSAGES) {
    const oldestKey = sentMessagePersona.keys().next().value;
    sentMessagePersona.delete(oldestKey);
  }
}

function getPersonaForQuotedMessage(quotedMsgId) {
  if (!quotedMsgId) return DEFAULT_PERSONA_KEY;
  const stored = sentMessagePersona.get(quotedMsgId);
  const storedKey = stored && stored.persona;
  return (storedKey && PERSONAS[storedKey]) ? storedKey : DEFAULT_PERSONA_KEY;
}

// هل الرسالة اللي بعتها البوت وترد عليها المستخدم توا كانت صوتية أصلاً؟
function wasQuotedMessageVoice(quotedMsgId) {
  if (!quotedMsgId) return false;
  const stored = sentMessagePersona.get(quotedMsgId);
  return !!(stored && stored.isVoice);
}

// ============ دالة الاتصال بـ Groq (الشات الرئيسي - موديل Llama 3.3 70B، أقوى من جيميناي) ============
// systemPromptOverride: لو انمرر، يستخدم بدل persona.systemPrompt الافتراضي
// (نستخدمها مع سعاد عشان نفرّق بين ردها العادي وردها لو الشخص من "أرقامها المدللة")
async function askAI(userMessage, history = [], personaKey = DEFAULT_PERSONA_KEY, systemPromptOverride = null) {
  const persona = PERSONAS[personaKey] || PERSONAS[DEFAULT_PERSONA_KEY];
  const systemPrompt = systemPromptOverride || persona.systemPrompt;
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content
      })),
      { role: 'user', content: userMessage },
      // تذكير أخير قبل الرد مباشرة - يقلل احتمال إن الموديل يطيح من اللهجة الليبية
      // أو يتجاهل سياق المحادثة السابقة، خصوصاً مع طلبات متتالية أو نصوص طويلة
      { role: 'system', content: R.ai.aiReminderSuffix }
    ];
    const response = await axios.post(
      GROQ_CHAT_ENDPOINT,
      {
        model: GROQ_CHAT_MODEL,
        messages,
        max_tokens: 500,
        temperature: 0.6
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const replyContent = (response.data.choices?.[0]?.message?.content || '').trim();
    // حماية: لو الرد رجع فاضي (نادر، مثلاً فلترة محتوى من Groq)، نعتبره فشل
    // بدل ما نرجع نص فاضي، عشان ما ينترسلش صوت فارغ/تالف لاحقاً بمرحلة TTS
    if (!replyContent) {
      console.error(R.ai.aiEmptyReplyFallback);
      return personaBusyMessage(personaKey);
    }
    return replyContent;
  } catch (err) {
    console.error('خطأ بالاتصال مع Groq:', err.response?.data || err.message);
    return personaBusyMessage(personaKey);
  }
}

function isTrackedBotMessage(msgId) {
  return !!msgId && sentMessagePersona.has(msgId);
}

// ============ حفظ/تحميل ذاكرة المحادثات على القرص (تنجو من الريستارت) ============
// المشكلة: الذاكرة كانت بس بالـ RAM (Map عادي)، فأي ريستارت للسيرفر (شائع
// بالاستضافة المجانية زي Railway/Render) كان يمسحها بالكامل ومراد/سعاد ينسوا كل شي.
// الحل: نحفظ نسخة من كل المحادثات بملف JSON جوا persistDir، ونحمّلها عند بداية التشغيل.
function getHistoryFilePath(persistDir) {
  return path.join(persistDir, 'ai-conversations.json');
}

function loadHistoryFromDisk(persistDir) {
  try {
    const filePath = getHistoryFilePath(persistDir);
    if (!fs.existsSync(filePath)) return;
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const personaKey of Object.keys(saved)) {
      if (personaKey === '__sentMessagePersona__') continue;
      if (!PERSONAS[personaKey]) continue;
      PERSONAS[personaKey].history = new Map(Object.entries(saved[personaKey]));
    }
    // نرجّع ذاكرة "مين بعت كل رسالة" (ليون/اشلي) عشان الرد العادي (بدون أمر) يشتغل
    // حتى بعد ريستارت السيرفر، وما تنمسحش هالمعلومة وتخلي الردود العادية تنسكت بصمت
    if (saved.__sentMessagePersona__) {
      const restored = new Map(Object.entries(saved.__sentMessagePersona__));
      restored.forEach((v, k) => sentMessagePersona.set(k, v));
    }
    console.log('✅ اترجعت ذاكرة محادثات ليون واشلي من الملف المحفوظ.');
  } catch (err) {
    console.error('خطأ بتحميل ذاكرة المحادثات من الملف:', err.message);
  }
}

function saveHistoryToDisk(persistDir) {
  try {
    if (!persistDir) return;
    if (!fs.existsSync(persistDir)) fs.mkdirSync(persistDir, { recursive: true });
    const filePath = getHistoryFilePath(persistDir);
    const toSave = {};
    for (const personaKey of Object.keys(PERSONAS)) {
      toSave[personaKey] = Object.fromEntries(PERSONAS[personaKey].history);
    }
    toSave.__sentMessagePersona__ = Object.fromEntries(sentMessagePersona);
    fs.writeFileSync(filePath, JSON.stringify(toSave), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ ذاكرة المحادثات للملف:', err.message);
  }
}

module.exports = {
  PERSONAS,
  DEFAULT_PERSONA_KEY,
  personaOfflineMessage,
  personaBusyMessage,
  rememberSentMessage,
  getPersonaForQuotedMessage,
  wasQuotedMessageVoice,
  isTrackedBotMessage,
  askAI,
  pushToHistory,
  getSouadSystemPrompt,
  SOUAD_LOVED_NUMBERS,
  loadHistoryFromDisk,
  saveHistoryToDisk
};
