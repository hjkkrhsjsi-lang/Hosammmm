// ============ أدوات مشتركة صغيرة ============

// ============ تحديد علم الدولة من رقم الهاتف (يستخدم بأمر !منشن) ============
// نفس القائمة والمنطق بالضبط من index.js القديم، منقولة زي ما هي بدون أي تغيير
const DIAL_CODE_FLAGS = [
  ['218', '🇱🇾'], ['213', '🇩🇿'], ['216', '🇹🇳'], ['212', '🇲🇦'], ['227', '🇳🇪'],
  ['966', '🇸🇦'], ['971', '🇦🇪'], ['974', '🇶🇦'], ['973', '🇧🇭'], ['965', '🇰🇼'],
  ['968', '🇴🇲'], ['964', '🇮🇶'], ['963', '🇸🇾'], ['962', '🇯🇴'], ['961', '🇱🇧'],
  ['970', '🇵🇸'], ['967', '🇾🇪'], ['249', '🇸🇩'], ['222', '🇲🇷'], ['252', '🇸🇴'],
  ['253', '🇩🇯'], ['269', '🇰🇲'], ['20', '🇪🇬'], ['90', '🇹🇷'], ['44', '🇬🇧'],
  ['49', '🇩🇪'], ['33', '🇫🇷'], ['1', '🇺🇸']
].sort((a, b) => b[0].length - a[0].length);

function getCountryFlag(numberDigits) {
  const clean = (numberDigits || '').replace(/\D/g, '');
  for (const [code, flag] of DIAL_CODE_FLAGS) {
    if (clean.startsWith(code)) return flag;
  }
  return '🏳️'; // رمز الدولة مو معروف بالقائمة
}

// ============ توحيد معرّف العضو (نسخة Baileys من getCanonicalContactId القديمة) ============
// المشكلة القديمة كانت تضارب lid/c.us بمكتبة whatsapp-web.js. بـ Baileys نفس الفكرة موجودة:
// واتساب أحياناً بيرجع معرف خصوصية "@lid" بدل الرقم الحقيقي "@s.whatsapp.net".
// الدالة دي دايماً بترجع صيغة ثابتة (@s.whatsapp.net) لو قدرنا نطلع رقم حقيقي، وإلا الأصلي كما هو.
function canonicalJid(jid) {
  if (!jid) return null;
  if (jid.endsWith('@g.us')) return jid; // جروب - يفضل زي ما هو
  if (jid.endsWith('@lid')) {
    // ما فيش رقم حقيقي مضمون جوه معرف lid لحاله بدون بيانات إضافية من واتساب،
    // فبنرجعه كما هو - الفحوصات اللي تحتاج تطابق لازم تاخد بالها من الاحتمالين
    return jid;
  }
  return jid; // @s.whatsapp.net أصلاً هو الصيغة الموحدة اللي بنعتمد عليها
}

// الرقم فقط بدون أي لاحقة (مثلاً "218912345678" من "218912345678@s.whatsapp.net")
function jidToNumber(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
}

// بيبني JID شخصي كامل من رقم دولي نظيف (بدون + وبدون صفر بالبداية)
function numberToJid(number) {
  const clean = (number || '').replace(/[^0-9]/g, '');
  return `${clean}@s.whatsapp.net`;
}

function isGroupJid(jid) {
  return !!jid && jid.endsWith('@g.us');
}

module.exports = {
  getCountryFlag,
  canonicalJid,
  jidToNumber,
  numberToJid,
  isGroupJid
};
