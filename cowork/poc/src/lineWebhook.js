'use strict';
/**
 * lineWebhook.js — สะพานจาก LINE OA เข้า orchestrator + endpoint สำหรับ staff console
 * -----------------------------------------------------------------------------
 * ของจริง: ต่อกับ src/routes/webhook.js เดิม — แทนที่จะตอบเอง ให้ forward เข้า orchestrator
 *   (ตรวจ signature ด้วย LINE_CHANNEL_SECRET ก่อนเสมอ — ละไว้ใน PoC)
 */
const express = require('express');
const approvals = require('./approvals');
const copilot = require('./copilot');
const escalations = require('./escalations');
const lineClient = require('./lineClient');
const subStats = require('./subscriptionStats');

function buildRouter(orchestrator) {
  const r = express.Router();

  // 1) LINE webhook → orchestrator
  //    ต้องใช้ raw body เพื่อตรวจ x-line-signature (ก่อน express.json จะ parse)
  r.post('/line/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    const sig = req.get('x-line-signature');
    if (!lineClient.verifySignature(req.body, sig)) {
      console.warn('[webhook] signature ไม่ผ่าน — ปฏิเสธ');
      return res.sendStatus(401);
    }
    res.sendStatus(200); // ตอบ 200 เร็ว แล้วประมวลผล async
    let body = {};
    try { body = JSON.parse(req.body.toString('utf8') || '{}'); } catch { /* ignore */ }
    for (const ev of body.events || []) {
      if (ev.type === 'message' && ev.message?.type === 'text') {
        await orchestrator.handleIncoming({ lineUserId: ev.source.userId, text: ev.message.text });
      }
    }
  });

  // staff routes ใช้ JSON body ปกติ
  r.use(express.json());

  // 2) Staff console — gated approvals (activate / refund)
  r.get('/staff/approvals', (_req, res) => res.json(approvals.listPending()));
  r.post('/staff/approvals/:id/approve', (req, res) =>
    res.json({ ok: approvals.approve(req.params.id, req.body?.staffId) }));
  r.post('/staff/approvals/:id/reject', (req, res) =>
    res.json({ ok: approvals.reject(req.params.id, req.body?.staffId, req.body?.note) }));

  // 3) Staff console — copilot drafts (กดส่งคำตอบ)
  r.get('/staff/drafts', (_req, res) => res.json(copilot.listDrafts()));
  r.post('/staff/drafts/:id/send', (req, res) =>
    res.json({ ok: copilot.approveSend(req.params.id, req.body?.text) }));
  r.post('/staff/drafts/:id/discard', (req, res) =>
    res.json({ ok: copilot.discard(req.params.id) }));

  // 4) Staff console — escalations / alerts (อารมณ์ / ร้องเรียน / unknown-intent)
  r.get('/staff/escalations', (_req, res) => res.json(escalations.listOpen()));
  r.post('/staff/escalations/:id/resolve', (req, res) =>
    res.json({ ok: escalations.resolve(req.params.id, req.body?.staffId, req.body?.note) }));

  // subscription stats (read-only จาก DB จริง)
  r.get('/staff/subscription', async (_req, res) => {
    try { res.json(await subStats.get()); }
    catch (e) { res.json({ enabled: false, error: e.message }); }
  });

  // รวมตัวนับสำหรับ badge บนหน้าเว็บ
  r.get('/staff/summary', (_req, res) => res.json({
    phase: Number(process.env.RELEASE_PHASE || 1),
    approvals: approvals.listPending().length,
    drafts: copilot.listDrafts().length,
    escalations: escalations.listOpen().length,
  }));

  return r;
}

module.exports = { buildRouter };
