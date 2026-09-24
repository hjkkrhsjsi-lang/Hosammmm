// ============ التاريخ والوقت المحلي حسب دولة رقم الهاتف (مفتاح الاتصال الدولي) ============
// نفس قائمة مفاتيح الدول الموجودة بـ util.js (getCountryFlag)، بس بدل العلم برجع منطقة زمنية حقيقية.

const DIAL_CODE_TIMEZONES = [
  ['218', 'Africa/Tripoli'], ['213', 'Africa/Algiers'], ['216', 'Africa/Tunis'], ['212', 'Africa/Casablanca'], ['227', 'Africa/Niamey'],
  ['966', 'Asia/Riyadh'], ['971', 'Asia/Dubai'], ['974', 'Asia/Qatar'], ['973', 'Asia/Bahrain'], ['965', 'Asia/Kuwait'],
  ['968', 'Asia/Muscat'], ['964', 'Asia/Baghdad'], ['963', 'Asia/Damascus'], ['962', 'Asia/Amman'], ['961', 'Asia/Beirut'],
  ['970', 'Asia/Gaza'], ['967', 'Asia/Aden'], ['249', 'Africa/Khartoum'], ['222', 'Africa/Nouakchott'], ['252', 'Africa/Mogadishu'],
  ['253', 'Africa/Djibouti'], ['269', 'Indian/Comoro'], ['20', 'Africa/Cairo'], ['90', 'Europe/Istanbul'], ['44', 'Europe/London'],
  ['49', 'Europe/Berlin'], ['33', 'Europe/Paris'], ['1', 'America/New_York']
].sort((a, b) => b[0].length - a[0].length);

function getTimezoneForNumber(numberDigits) {
  const clean = (numberDigits || '').replace(/\D/g, '');
  for (const [code, tz] of DIAL_CODE_TIMEZONES) {
    if (clean.startsWith(code)) return tz;
  }
  return 'UTC'; // دولة مو معروفة بالقائمة
}

// ============ التوقيت الآن ثابت على ليبيا للجميع (بطلب المستخدم)، مش حسب دولة رقم كل عضو ============
// اسم اليوم بالعربي، بس الشهر رقم (مش اسم) والأرقام كلها إنجليزية (Western numerals)
const TRIPOLI_TZ = 'Africa/Tripoli';

function buildTripoliParts() {
  const now = new Date();
  // 'ar-EG-u-nu-latn' يرجع اسم اليوم بالعربي بس بأرقام لاتينية (إنجليزية) لو احتجناها بنفس الاستدعاء
  const weekday = now.toLocaleDateString('ar-EG-u-nu-latn', { timeZone: TRIPOLI_TZ, weekday: 'long' });
  const day = now.toLocaleDateString('en-GB', { timeZone: TRIPOLI_TZ, day: '2-digit' });
  const month = now.toLocaleDateString('en-GB', { timeZone: TRIPOLI_TZ, month: '2-digit' });
  const year = now.toLocaleDateString('en-GB', { timeZone: TRIPOLI_TZ, year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { timeZone: TRIPOLI_TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = `${weekday}، ${day}/${month}/${year}`;
  return { dateStr, timeStr };
}

// بيرجع تاريخ ووقت ثابتين على توقيت ليبيا (نفس التوقيع القديم عشان ما نكسرش أماكن الاستخدام الحالية)
function formatLocalDateTime(_numberDigitsIgnored) {
  const { dateStr, timeStr } = buildTripoliParts();
  return { dateStr, timeStr, tz: TRIPOLI_TZ };
}

// نص وقت جاهز بصيغة سطر واحد (يستخدم ببانرات !اصعد و!انزل بـ router.js)
function formatTripoliTime() {
  const { dateStr, timeStr } = buildTripoliParts();
  return `${dateStr} - ${timeStr}`;
}

module.exports = {
  getTimezoneForNumber,
  formatLocalDateTime,
  formatTripoliTime
};
