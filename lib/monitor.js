// ============ مراقبة الأوامر (Monitor) ============
// يسجّل لكل أمر: عدد مرات التنفيذ، الأعطال (استثناءات انكسر فيها التنفيذ)، ومتوسط زمن التنفيذ.
// الإحصائيات بالذاكرة فقط: تتصفّر مع كل إعادة تشغيل للبوت (أو بأمر !مطورحسام+ مراقبة تصفير).
// ملاحظة: يحسب بس الأعطال اللي ترمي خطأ (crash). لو الأمر نفسه يمسك خطأه ويرد برسالة اعتذار، ما ينحسب عطل.

'use strict';

const MAX_KEYS = 300;
const MAX_RECENT = 20;

let startedAt = Date.now();
const stats = new Map(); // key -> { calls, errors, totalMs, lastErrorAt, lastError, lastOkAt }
const totals = { calls: 0, errors: 0, totalMs: 0 };
const recentErrors = []; // آخر الأعطال: { key, message, at }

function record(key, ms, error) {
  if (!key) return;
  let s = stats.get(key);
  if (!s) {
    if (stats.size >= MAX_KEYS) return;
    s = { calls: 0, errors: 0, totalMs: 0, lastErrorAt: 0, lastError: '', lastOkAt: 0 };
    stats.set(key, s);
  }
  const safeMs = Number.isFinite(ms) && ms >= 0 ? ms : 0;
  s.calls += 1;
  s.totalMs += safeMs;
  totals.calls += 1;
  totals.totalMs += safeMs;

  if (error) {
    const message = String((error && error.message) || error).slice(0, 200);
    s.errors += 1;
    s.lastErrorAt = Date.now();
    s.lastError = message;
    totals.errors += 1;
    recentErrors.unshift({ key, message, at: Date.now() });
    if (recentErrors.length > MAX_RECENT) recentErrors.pop();
  } else {
    s.lastOkAt = Date.now();
  }
}

function getTotals() {
  const calls = totals.calls;
  return {
    calls,
    errors: totals.errors,
    successPct: calls ? Math.round(((calls - totals.errors) / calls) * 100) : 100,
    avgMs: calls ? Math.round(totals.totalMs / calls) : 0,
    sinceMs: Date.now() - startedAt
  };
}

function getRows() {
  return Array.from(stats.entries()).map(([key, s]) => ({
    key,
    calls: s.calls,
    errors: s.errors,
    avgMs: s.calls ? Math.round(s.totalMs / s.calls) : 0,
    lastError: s.lastError,
    lastErrorAt: s.lastErrorAt,
    lastOkAt: s.lastOkAt
  }));
}

// الأوامر اللي فيها أعطال، الأكثر أعطالاً أول
function getFailing(limit = 5) {
  return getRows()
    .filter((r) => r.errors > 0)
    .sort((a, b) => b.errors - a.errors || b.lastErrorAt - a.lastErrorAt)
    .slice(0, limit);
}

function getRecentErrors(limit = 5) {
  return recentErrors.slice(0, limit);
}

function reset() {
  stats.clear();
  recentErrors.length = 0;
  totals.calls = 0;
  totals.errors = 0;
  totals.totalMs = 0;
  startedAt = Date.now();
}

module.exports = { record, getTotals, getRows, getFailing, getRecentErrors, reset };
