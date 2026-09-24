const fs = require('fs');
const path = require('path');

function energyFilePath(persistDir) {
  return path.join(persistDir, 'energy.json');
}

function loadEnergy(persistDir) {
  const file = energyFilePath(persistDir);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8') || '{}');
}

function saveEnergy(persistDir, data) {
  const file = energyFilePath(persistDir);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * يعدّل طاقة عضو معيّن (زيادة أو نقصان) ويرجع الرصيد الجديد
 * @param {string} persistDir - مجلد التخزين
 * @param {string} targetNumber - رقم العضو (بدون @s.whatsapp.net)
 * @param {number} amount - القيمة (موجبة للزيادة، سالبة للنقصان)
 * @returns {number} الرصيد الجديد بعد التعديل
 */
function adjustEnergy(persistDir, targetNumber, amount) {
  const data = loadEnergy(persistDir);
  const current = data[targetNumber] || 0;
  const updated = current + amount;
  data[targetNumber] = updated;
  saveEnergy(persistDir, data);
  return updated;
}

function getEnergy(persistDir, targetNumber) {
  const data = loadEnergy(persistDir);
  return data[targetNumber] || 0;
}

module.exports = { adjustEnergy, getEnergy };
