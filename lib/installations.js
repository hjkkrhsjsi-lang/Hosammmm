// ============ نظام "تنصيب" البوت بالجروبات (whitelist + موافقة المطور) ============
// كل جروب لازم يكون "منصّب" (installed) عشان البوت يرد على أي أمر فيه، ما عدا
// أمر !تنصيب نفسه اللي هو الباب الوحيد للدخول. الجروبات اللي كانت شغالة قبل
// ما نفعّل النظام هذا (grandfathered) بتنحفظ تلقائياً أول مرة البوت يشتغل بعد
// الرفعة، عشان ما يوقف شغلها بالغلط.

'use strict';

const fs = require('fs');
const path = require('path');

function filePath(persistDir) {
  return path.join(persistDir, 'installations.json');
}

function load(persistDir) {
  const file = filePath(persistDir);
  if (!fs.existsSync(file)) {
    return { migrated: false, installed: {}, pending: {}, nextRequestId: 1 };
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      migrated: !!data.migrated,
      installed: data.installed || {},
      pending: data.pending || {},
      nextRequestId: data.nextRequestId || 1
    };
  } catch (err) {
    console.error('خطأ بقراءة installations.json:', err.message);
    return { migrated: false, installed: {}, pending: {}, nextRequestId: 1 };
  }
}

function save(persistDir, data) {
  try {
    fs.writeFileSync(filePath(persistDir), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ installations.json:', err.message);
  }
}

// تُستدعى مرة وحدة بس (أول رسالة توصل بعد الرفعة): لو ما فيه ملف أصلاً، نعتبر
// كل الجروبات الموجودة حالياً بالبوت "منصّبة" مسبقاً (grandfathered) عشان ما
// يتوقف شغلها. هذا يشتغل بصمت ومرة وحدة بس (migrated: true بعدها للأبد).
async function ensureLegacyGroupsInstalled(sock, persistDir) {
  const data = load(persistDir);
  if (data.migrated) return;

  try {
    const allGroups = await sock.groupFetchAllParticipating();
    for (const chatId of Object.keys(allGroups || {})) {
      if (!data.installed[chatId]) {
        data.installed[chatId] = {
          groupName: allGroups[chatId]?.subject || '',
          ownerJid: null,
          ownerNumber: 'legacy',
          installedAt: Date.now(),
          legacy: true
        };
      }
    }
  } catch (err) {
    console.error('خطأ بترحيل الجروبات القديمة (legacy install):', err.message);
  }

  data.migrated = true;
  save(persistDir, data);
}

function isInstalled(persistDir, chatId) {
  // 🆕 الأرقام المربوطة (tenants): كل جروباتها منصّبة تلقائياً لأن صاحب الرقم هو صاحب البوت
  if (fs.existsSync(path.join(persistDir, '.tenant'))) return true;
  const data = load(persistDir);
  return !!data.installed[chatId];
}

function getInstalled(persistDir, chatId) {
  const data = load(persistDir);
  return data.installed[chatId] || null;
}

function listInstalled(persistDir) {
  const data = load(persistDir);
  return Object.entries(data.installed).map(([chatId, meta]) => ({ chatId, ...meta }));
}

function getPendingByChat(persistDir, chatId) {
  const data = load(persistDir);
  return Object.entries(data.pending).find(([, p]) => p.chatId === chatId) || null;
}

// يسجل طلب تنصيب جديد ويرجع رقم الطلب (requestId) كنص
function addPending(persistDir, { chatId, groupName, requesterJid, requesterNumber }) {
  const data = load(persistDir);

  // ما نكرر طلب لنفس الجروب لو أصلاً فيه طلب معلّق
  const existing = Object.entries(data.pending).find(([, p]) => p.chatId === chatId);
  if (existing) return existing[0];

  const requestId = String(data.nextRequestId);
  data.pending[requestId] = {
    chatId,
    groupName,
    requesterJid,
    requesterNumber,
    requestedAt: Date.now()
  };
  data.nextRequestId += 1;
  save(persistDir, data);
  return requestId;
}

function getPending(persistDir, requestId) {
  const data = load(persistDir);
  return data.pending[requestId] || null;
}

function listPending(persistDir) {
  const data = load(persistDir);
  return Object.entries(data.pending).map(([requestId, meta]) => ({ requestId, ...meta }));
}

function approve(persistDir, requestId) {
  const data = load(persistDir);
  const req = data.pending[requestId];
  if (!req) return null;

  data.installed[req.chatId] = {
    groupName: req.groupName,
    ownerJid: req.requesterJid,
    ownerNumber: req.requesterNumber,
    installedAt: Date.now(),
    legacy: false
  };
  delete data.pending[requestId];
  save(persistDir, data);
  return req;
}

function reject(persistDir, requestId) {
  const data = load(persistDir);
  const req = data.pending[requestId];
  if (!req) return null;
  delete data.pending[requestId];
  save(persistDir, data);
  return req;
}

// يشيل تنصيب جروب (uninstall) - يقبل chatId مباشرة أو رقمه بقائمة listInstalled
function uninstall(persistDir, chatId) {
  const data = load(persistDir);
  if (!data.installed[chatId]) return null;
  const removed = data.installed[chatId];
  delete data.installed[chatId];
  save(persistDir, data);
  return removed;
}

module.exports = {
  ensureLegacyGroupsInstalled,
  isInstalled,
  getInstalled,
  listInstalled,
  addPending,
  getPendingByChat,
  getPending,
  listPending,
  approve,
  reject,
  uninstall
};
