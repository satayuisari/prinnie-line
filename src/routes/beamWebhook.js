// Beam webhook — รับ charge.succeeded แล้ว activate/ปลดล็อก
// ต้องใช้ raw body (ตรวจลายเซ็น) → register ก่อน bodyParser.json() ใน index.js
//
// ยืนยัน 2 ชั้นกัน webhook ปลอม:
//   1) ลายเซ็น HMAC (X-Beam-Signature) ถ้าตั้ง BEAM_WEBHOOK_SECRET
//   2) ดึง charge จาก Beam โดยตรง (getCharge) ยืนยันว่าสำเร็จจริง
//   ผ่านอย่างน้อย 1 ชั้น (signature หรือ getCharge) ถึง activate — ไม่ผ่านเลย = ปฏิเสธ

const express       = require('express');
const beamService   = require('../services/beamService');
const orders        = require('../services/paymentOrders');
const subscribers   = require('../services/subscriberService');
const synastry      = require('../services/synastryService');
const geocoding     = require('../services/geocodingService');
const lineMessaging = require('../services/lineMessaging');
const { computeNatalChart } = require('../astro/natalChart');

const LIFF_URL = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}`
  : 'https://liff.line.me/YOUR_LIFF_ID';

// ดึง referenceId + chargeId จาก payload (schema = GET charge) แบบทนรูปแบบหลายชั้น
function extract(body) {
  const c = body.charge || body.data || body;
  return {
    referenceId: c.referenceId || c.reference_id || (c.order && c.order.referenceId) || null,
    chargeId:    c.chargeId || c.charge_id || c.id || null,
  };
}

async function handleSubscription(order) {
  const r = await subscribers.activateSubscription(order.line_user_id, order.charge_id || order.ref, 30);
  const expTH = new Date(r.expire_date).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  await lineMessaging.pushText(order.line_user_id,
    `ชำระเงินสำเร็จ! ✨\n\nสมาชิก Prinnie333 ของคุณใช้ได้ถึง ${expTH}\nรับดวงประจำวันทุกเช้า 08:00 น. 🌟`);
  console.log(`[beam] activated ${order.line_user_id} until ${r.expire_date}`);
}

async function handleCouple(order) {
  const m  = order.payload || {};
  const me = await subscribers.getByLineUserId(order.line_user_id);
  if (!me || !me.chart_data) return;

  let lat = m.lat != null ? Number(m.lat) : null;
  let lng = m.lng != null ? Number(m.lng) : null;
  if ((lat == null || lng == null) && m.birth_place) {
    const g = await geocoding.geocode(m.birth_place);
    lat = g.lat; lng = g.lng;
  }
  const partnerChart = computeNatalChart({ date: m.birth_date, time: m.birth_time || null, lat, lng });
  const reading = await synastry.synastryReading(me.chart_data, partnerChart);

  await lineMessaging.pushText(order.line_user_id, synastry.formatFull(reading, m.partner_name));
  await lineMessaging.pushText(order.line_user_id,
    `อยากดูดวงคู่ไม่จำกัด + รับดวงรายวันส่วนตัวทุกเช้าไหม? ✨\nสมาชิก Prinnie333 เพียง 399 บาท/เดือน\n\n👉 ${LIFF_URL}`);
  console.log(`[beam] couple unlocked for ${order.line_user_id} (${m.partner_name})`);
}

async function processWebhook(rawBody, signature) {
  let body;
  try { body = JSON.parse(rawBody.toString('utf8')); }
  catch { console.error('[beam] webhook: bad JSON'); return; }

  const { referenceId, chargeId } = extract(body);
  if (!referenceId) { console.error('[beam] webhook: ไม่มี referenceId'); return; }

  const order = await orders.get(referenceId);
  if (!order) { console.error(`[beam] webhook: ไม่พบ order ${referenceId}`); return; }
  if (order.status === 'PAID') return;   // ยิงซ้ำ — เคยจ่ายแล้ว

  // ── ยืนยันความถูกต้อง ──
  const sigOK = beamService.verifySignature(rawBody, signature);
  let confirmed = sigOK;
  if (!confirmed) {
    const charge = await beamService.getCharge(chargeId);
    const status = charge && (charge.status || charge.chargeStatus);
    confirmed = !!status && /SUCCEED|SUCCESS|PAID|CAPTURED|COMPLETE/i.test(status);
  }
  if (!confirmed) {
    console.error(`[beam] webhook: ยืนยันไม่ผ่าน (sig=${sigOK}) ref=${referenceId}`);
    return;
  }

  // mark paid (idempotent) — ถ้า false แปลว่ามีคน activate ไปแล้ว
  if (!(await orders.markPaid(referenceId, chargeId))) return;

  if (order.type === 'couple') await handleCouple({ ...order, charge_id: chargeId });
  else                         await handleSubscription({ ...order, charge_id: chargeId });
}

function register(app) {
  app.post('/api/payment/beam-webhook', express.raw({ type: '*/*' }), (req, res) => {
    const event = req.headers['x-beam-event'];
    res.json({ received: true });   // ตอบ Beam ทันที กัน retry
    if (event && event !== 'charge.succeeded') return;
    processWebhook(req.body, req.headers['x-beam-signature'])
      .catch(err => console.error('[beam] webhook error:', err.message));
  });
}

module.exports = { register };
