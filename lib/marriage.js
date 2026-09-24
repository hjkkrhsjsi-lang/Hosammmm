// ============ نظام الزواج والطلاق ============
// نفس المنطق والبيانات بالضبط من index.js القديم (ما كانش يعتمد على whatsapp-web.js أصلاً)

const fs = require('fs');
const path = require('path');

const MAX_WIVES_PER_HUSBAND = 2;
const MARRIAGE_REQUEST_TIMEOUT_MS = 2 * 60 * 1000; // دقيقتين

// طلبات زواج معلقة بانتظار قبول/رفض (بالذاكرة - نفس الأصل)
// المفتاح: chatId + '_' + wifeId ، القيمة: { husbandId, wifeId, chatId, mahr, timer }
const pendingMarriageRequests = new Map();

const MAHR_LIST = [
  'كيلو تمر وكرتونة شاي أخضر',
  '3 كيلو قهوة وشوية بخور',
  'صحن كسكسي وقعدة عشرة',
  'موبايل قديم وشاحن مكسور',
  'كرتونة عصير ونص خبزة',
  'بطاقة شحن 10 دنانير وسلام'
];

function marriagesFilePath(persistDir) {
  return path.join(persistDir, 'data', 'marriages.json');
}

function loadMarriages(persistDir) {
  try {
    const file = marriagesFilePath(persistDir);
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('خطأ بقراءة ملف الزواج:', err.message);
    return [];
  }
}

function saveMarriages(persistDir, marriages) {
  try {
    const file = marriagesFilePath(persistDir);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(marriages, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ ملف الزواج:', err.message);
  }
}

// هل هاد الشخص عنده زوج/زوجة قائمة حالياً بهاد الجروب (كزوجة)؟
function findActiveMarriageAsWife(persistDir, wifeId, chatId) {
  const marriages = loadMarriages(persistDir);
  return marriages.find(
    (m) => m.wifeId === wifeId && m.chatId === chatId && m.status === 'قائم'
  );
}

// كل الزوجات القائمات لهاد الزوج بهاد الجروب، بترتيب الزواج
function findActiveWivesOfHusband(persistDir, husbandId, chatId) {
  const marriages = loadMarriages(persistDir);
  return marriages
    .filter((m) => m.husbandId === husbandId && m.chatId === chatId && m.status === 'قائم')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function randomMahr() {
  return MAHR_LIST[Math.floor(Math.random() * MAHR_LIST.length)];
}

module.exports = {
  MAX_WIVES_PER_HUSBAND,
  MARRIAGE_REQUEST_TIMEOUT_MS,
  pendingMarriageRequests,
  MAHR_LIST,
  loadMarriages,
  saveMarriages,
  findActiveMarriageAsWife,
  findActiveWivesOfHusband,
  randomMahr
};
