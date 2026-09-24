// ============ بانرات نصية عامة يستخدمها أكتر من مكان بالبوت ============
const R = require('./responses');

function muradBanner(line, headerText) {
  return R.banners.muradBanner(line, headerText);
}

// نفس شكل muradBanner بالضبط، بس بعنوان "لا يوجد تغيير" - نستخدمها لما حد يكرر
// أمر إدارة (قفل/فتح/فتح رابط/قفل رابط) والحالة أصلاً زي ما هو طالبها
function noChangeBanner(line) {
  return muradBanner(line, R.banners.noChangeHeader);
}

function wrongCommandBanner() {
  return R.banners.wrongCommandBanner;
}

module.exports = {
  muradBanner,
  noChangeBanner,
  wrongCommandBanner
};
