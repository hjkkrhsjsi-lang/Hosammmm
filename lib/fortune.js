// ============ !توقع - فأل يومي مرح (خفيف مو جدي) ============
const R = require('./responses');

function getDailyFortune() {
  return R.fortune.list[Math.floor(Math.random() * R.fortune.list.length)];
}

function fortuneBanner(nameTag) {
  return R.fortune.banner(nameTag, getDailyFortune());
}

module.exports = {
  getDailyFortune,
  fortuneBanner
};
