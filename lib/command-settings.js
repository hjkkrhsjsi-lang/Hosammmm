// ============ تخزين حالة تفعيل/تعطيل كل أمر (ملف JSON حقيقي بدل بيانات وهمية) ============

const path = require('path');
const fs = require('fs');

// كل أوامر البوت الحقيقية الموجودة فعلاً بـ router.js، مقسّمة بنفس أقسام اللوحة
const COMMAND_DEFS = [
  { key: 'مراد',                   name: '!مراد',                      cat: 'general', desc: 'اسأل شخصية مراد أي سؤال' },
  { key: 'سعاد',                   name: '!سعاد',                      cat: 'general', desc: 'اسأل شخصية سعاد أي سؤال' },
  { key: 'صوت',                    name: '!صوت',                       cat: 'general', desc: 'يحوّل أي نص لرسالة صوتية' },
  { key: 'بروفايل',                name: '!بروفايل',                   cat: 'general', desc: 'يجيب صورة بروفايل أي عضو' },
  { key: 'رابط',                   name: '!رابط',                      cat: 'general', desc: 'يبعت رابط دعوة الجروب' },
  { key: 'اوامر',                  name: '!اوامر',                     cat: 'general', desc: 'يعرض قائمة كل الأوامر' },

  { key: 'قفل_فتح',                name: '!قفل / !فتح',                cat: 'admin', desc: 'يقفل أو يفتح الكتابة بالجروب' },
  { key: 'روابط_الجروب',           name: '!فتح رابط / !قفل رابط',      cat: 'admin', desc: 'يسمح أو يمنع إرسال الروابط' },
  { key: 'باند',                   name: '!باند',                      cat: 'admin', desc: 'يطرد عضو من الجروب' },
  { key: 'اصعد',                   name: '!اصعد',                      cat: 'admin', desc: 'يرقّي عضو لأدمن' },
  { key: 'انزل',                   name: '!انزل',                      cat: 'admin', desc: 'ينزّل أدمن لعضو عادي' },
  { key: 'توقف_تشغيل',             name: '!توقف / !تشغيل',             cat: 'admin', desc: 'يوقف أو يشغّل ردود مراد وسعاد' },
  { key: 'ازالة_تحذير',            name: '!ازالة_تحذير',               cat: 'admin', desc: 'يمسح تحذير عن عضو' },
  { key: 'مخالفة',                 name: '!مخالفة',                    cat: 'admin', desc: 'تحذير يدوي مع كتابة السبب' },
  { key: 'منشن',                   name: '!منشن',                      cat: 'admin', desc: 'منشن جماعي لكل الأعضاء' },
  { key: 'تغيير_صورة',             name: '!تغيير_صورة',                cat: 'admin', desc: 'يغيّر صورة الجروب' },

  { key: 'تحدي',                   name: '!تحدي',                      cat: 'games', desc: 'سؤال تريفيا للأعضاء' },
  { key: 'دين',                    name: '!دين',                       cat: 'games', desc: 'سؤال ديني للأعضاء' },
  { key: 'من_فينا',                name: '!من_فينا',                   cat: 'games', desc: 'يختار عضو عشوائي بسؤال مرح' },
  { key: 'زواج',                   name: '!زواج',                      cat: 'games', desc: 'طلب زواج بين عضوين' },
  { key: 'طلاق',                   name: '!طلاق',                      cat: 'games', desc: 'إنهاء زواج قائم' },

  { key: 'صلاة',                   name: '!صلاة',                      cat: 'prayer', desc: 'أوقات الصلاة اليوم (بالخاص)' },
  { key: 'تفعيل_تنبيه_الصلاة',     name: '!تفعيل_تنبيه_الصلاة',        cat: 'prayer', desc: 'تنبيه تلقائي وقت كل أذان' },
  { key: 'ايقاف_تنبيه_الصلاة',     name: '!ايقاف_تنبيه_الصلاة',        cat: 'prayer', desc: 'إيقاف تنبيه الصلاة' }
];

function settingsFilePath(persistDir) {
  return path.join(persistDir, 'command-settings.json');
}

function loadSettings(persistDir) {
  const file = settingsFilePath(persistDir);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error('خطأ بقراءة إعدادات الأوامر:', err.message);
    return {};
  }
}

function saveSettings(persistDir, settings) {
  try {
    fs.writeFileSync(settingsFilePath(persistDir), JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ إعدادات الأوامر:', err.message);
  }
}

// كل أمر مفعّل افتراضياً إلا لو اتحدد بالملف صراحة إنه false (معطل)
function isCommandEnabled(persistDir, key) {
  const settings = loadSettings(persistDir);
  return settings[key] !== false;
}

function setCommandEnabled(persistDir, key, enabled) {
  const settings = loadSettings(persistDir);
  settings[key] = !!enabled;
  saveSettings(persistDir, settings);
}

function listCommandsWithStatus(persistDir) {
  const settings = loadSettings(persistDir);
  return COMMAND_DEFS.map((c) => ({ ...c, enabled: settings[c.key] !== false }));
}

module.exports = {
  COMMAND_DEFS,
  isCommandEnabled,
  setCommandEnabled,
  listCommandsWithStatus
};
