// ============ !اقتباس - بطاقة اقتباس لرسالة قديمة قالها عضو بالجروب ============
const R = require('./responses');

function formatArabicDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

function quoteBanner(nameTag, text, ts) {
  return R.quoteCard.banner(nameTag, text, formatArabicDate(ts));
}

function noQuoteFoundMessage() {
  return R.quoteCard.noQuoteFound;
}

module.exports = {
  quoteBanner,
  noQuoteFoundMessage
};
