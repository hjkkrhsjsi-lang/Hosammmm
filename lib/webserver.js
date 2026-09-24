// ============ سيرفر ويب صغير (لازم لـ Render/Railway + لعرض QR وكود الربط) ============
// نفس فكرة السيرفر القديم بالضبط، بس بيقرا الحالة من whatsapp.js (state) بدل متغيرات
// عامة كانت متعرفة فوق بنفس index.js القديم.

const path = require('path');
const express = require('express');
const qrcode = require('qrcode');
const cmdSettings = require('./command-settings');
const greetings = require('./greetings');
const moderation = require('./moderation');

function startWebServer({ port, state, requestPairingCode, persistDir }) {
  const app = express();
  app.use(express.json());

  // ============ اللوحة الحقيقية (الواجهة المخصصة) ============
  // panel.html لازم يكون بجذر المشروع (نفس مستوى index.js)
  app.get('/panel', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'panel.html'));
  });

  // ============ API حقيقي تستخدمه لوحة panel.html ============

  // حالة الاتصال الحقيقية
  app.get('/api/status', (req, res) => {
    res.json({ connected: !!state.clientReady });
  });

  // طلب كود ربط حقيقي برقم الهاتف
  app.post('/api/pair', async (req, res) => {
    const number = req.body && req.body.number;
    if (!number) return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    if (state.clientReady) return res.status(400).json({ error: 'البوت متصل بالفعل' });
    try {
      const code = await requestPairingCode(number);
      res.json({ code });
    } catch (err) {
      res.status(500).json({ error: err.message || 'فشل توليد كود الربط' });
    }
  });

  // إحصائيات حقيقية: عدد الجروبات + عدد الأعضاء الفريدين فيها كلها
  app.get('/api/stats', async (req, res) => {
    if (!state.clientReady || !state.sock) {
      return res.json({ groups: 0, members: 0 });
    }
    try {
      const groupsMeta = await state.sock.groupFetchAllParticipating();
      const groupIds = Object.keys(groupsMeta);
      const memberSet = new Set();
      groupIds.forEach((gid) => {
        const g = groupsMeta[gid];
        (g.participants || []).forEach((p) => memberSet.add(p.id));
      });
      res.json({ groups: groupIds.length, members: memberSet.size });
    } catch (err) {
      console.error('خطأ بجلب الإحصائيات الحقيقية:', err.message);
      res.status(500).json({ error: 'تعذر جلب الإحصائيات' });
    }
  });

  // ============ الأوامر: قراءة الحالة الحقيقية + تفعيل/تعطيل حقيقي ============
  app.get('/api/commands', (req, res) => {
    res.json(cmdSettings.listCommandsWithStatus(persistDir));
  });

  app.post('/api/commands/:key', (req, res) => {
    const { key } = req.params;
    const { enabled } = req.body || {};
    const exists = cmdSettings.COMMAND_DEFS.some((c) => c.key === key);
    if (!exists) return res.status(404).json({ error: 'أمر غير معروف' });
    cmdSettings.setCommandEnabled(persistDir, key, !!enabled);
    res.json({ key, enabled: !!enabled });
  });

  // ============ الجروبات: قائمة حقيقية من واتساب + إجراءات حقيقية ============
  app.get('/api/groups', async (req, res) => {
    if (!state.clientReady || !state.sock) return res.json([]);
    try {
      const groupsMeta = await state.sock.groupFetchAllParticipating();
      const botNumber = (state.sock.user?.id || '').split(':')[0];
      const list = Object.values(groupsMeta).map((g) => {
        const admins = g.participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin');
        const botAdmin = admins.some((p) => p.id.split(':')[0].split('@')[0] === botNumber);
        return {
          id: g.id,
          name: g.subject,
          members: g.participants.length,
          admins: admins.length,
          status: g.announce ? 'closed' : 'open',
          botAdmin
        };
      });
      res.json(list);
    } catch (err) {
      console.error('خطأ بجلب الجروبات الحقيقية:', err.message);
      res.status(500).json({ error: 'تعذر جلب الجروبات' });
    }
  });

  // قفل/فتح جروب حقيقي
  app.post('/api/groups/:id/lock', async (req, res) => {
    const { id } = req.params;
    const { lock } = req.body || {};
    if (!state.clientReady || !state.sock) return res.status(400).json({ error: 'البوت مش متصل' });
    try {
      await state.sock.groupSettingUpdate(id, lock ? 'announcement' : 'not_announcement');
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message || 'تعذر تنفيذ الإجراء (تأكد إن البوت أدمن)' });
    }
  });

  // طرد آخر عضو انضم فعلياً (بناءً على سجل حقيقي من greetings.js)
  app.post('/api/groups/:id/kick-last', async (req, res) => {
    const { id } = req.params;
    if (!state.clientReady || !state.sock) return res.status(400).json({ error: 'البوت مش متصل' });
    try {
      const lastJoined = greetings.getLastJoined(persistDir, id);
      if (!lastJoined) return res.status(400).json({ error: 'ما فيه سجل لعضو دخل هذا الجروب مؤخراً' });
      await state.sock.groupParticipantsUpdate(id, [lastJoined.jid], 'remove');
      res.json({ ok: true, kicked: lastJoined.jid });
    } catch (err) {
      res.status(500).json({ error: err.message || 'تعذر الطرد (تأكد إن البوت أدمن)' });
    }
  });

  // خروج البوت من الجروب فعلياً
  app.post('/api/groups/:id/leave', async (req, res) => {
    const { id } = req.params;
    if (!state.clientReady || !state.sock) return res.status(400).json({ error: 'البوت مش متصل' });
    try {
      await state.sock.groupLeave(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message || 'تعذر الخروج من الجروب' });
    }
  });

  // ============ سجل الطرد/المخالفات (من كل الجروبات) ============
  app.get('/api/violations', async (req, res) => {
    try {
      const log = moderation.getKickLog(persistDir, { limit: 200 });

      // نحاول نضيف اسم كل جروب (لو البوت متصل) عشان يبان بدل الـID الخام بس
      let groupNames = {};
      if (state.clientReady && state.sock) {
        try {
          const groupsMeta = await state.sock.groupFetchAllParticipating();
          groupNames = Object.fromEntries(
            Object.values(groupsMeta).map((g) => [g.id, g.subject])
          );
        } catch (metaErr) {
          console.error('تعذر جلب أسماء الجروبات لسجل الطرد:', metaErr.message);
        }
      }

      const enriched = log.map((entry) => ({
        ...entry,
        chatName: groupNames[entry.chatId] || entry.chatId
      }));

      res.json(enriched);
    } catch (err) {
      console.error('خطأ بجلب سجل الطرد:', err.message);
      res.status(500).json({ error: 'تعذر جلب سجل الطرد' });
    }
  });

  app.get('/', async (req, res) => {
    if (state.clientReady) {
      return res.send(`
        <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding-top:50px;">
        <h1>✅ البوت شغال ومتصل بواتساب</h1>
        </body></html>
      `);
    }

    // لو عندنا كود ربط جاهز، نعرضه
    if (state.lastPairingCode) {
      return res.send(`
        <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding-top:40px;">
        <h2>افتح واتساب > الإعدادات > الأجهزة المرتبطة > ربط جهاز > ربط برقم الهاتف</h2>
        <h1 style="letter-spacing:6px;font-size:42px;background:#111;color:#0f0;display:inline-block;padding:15px 25px;border-radius:10px;">${state.lastPairingCode}</h1>
        <p>الكود بينتهي بسرعة، لو ما وصلك بالوقت اعمل ريفريش وجيب كود جديد</p>
        <p><a href="/">🔄 رجوع</a></p>
        </body></html>
      `);
    }

    // نموذج لإدخال الرقم وتوليد كود الربط
    const errorHtml = state.pairingError
      ? `<p style="color:red;">${state.pairingError}</p>`
      : '';

    return res.send(`
      <html dir="rtl"><body style="font-family:sans-serif;text-align:center;padding-top:30px;">
      <h2>اختر طريقة الربط</h2>

      <h3>1) كود ربط برقم الهاتف</h3>
      <form action="/pair" method="get">
        <input name="number" placeholder="مثال: 9665xxxxxxxx (بدون + وبدون صفر)" style="padding:8px;width:260px;" required />
        <button type="submit" style="padding:8px 16px;">توليد الكود</button>
      </form>
      ${errorHtml}

      <hr style="margin:30px auto;width:300px;" />

      <h3>2) أو امسح QR</h3>
      ${state.lastQr ? `<img src="${await qrcode.toDataURL(state.lastQr)}" style="width:260px;height:260px;" />` : '<p>QR لسا ما جهز...</p>'}

      <p>الصفحة بتتحدث تلقائياً كل 5 ثواني</p>
      <script>setTimeout(()=>location.reload(), 5000);</script>
      </body></html>
    `);
  });

  // نقطة توليد كود الربط برقم الهاتف
  app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number || state.clientReady) {
      return res.redirect('/');
    }
    try {
      await requestPairingCode(number);
    } catch (err) {
      // الخطأ محفوظ بـ state.pairingError وبينعرض بالصفحة الرئيسية
    }
    return res.redirect('/');
  });

  // نقطة فحص صحة السيرفر (يطلبها Render/Railway أحياناً)
  app.get('/health', (req, res) => res.send('OK'));

  app.listen(port, () => {
    console.log(`🌐 سيرفر الويب شغال على البورت ${port}`);
  });

  return app;
}

module.exports = { startWebServer };
