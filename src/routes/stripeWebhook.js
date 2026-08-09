// Stripe webhook — รับ event ตอนจ่ายเงินสำเร็จ
// ต้องใช้ raw body (ตรวจลายเซ็น) → register ก่อน bodyParser.json() ใน index.js

const express       = require('express');
const stripeService = require('../services/stripeService');
const subscribers   = require('../services/subscriberService');
const synastry      = require('../services/synastryService');
const geocoding     = require('../services/geocodingService');
const lineMessaging = require('../services/lineMessaging');
const { computeNatalChart } = require('../astro/natalChart');

const LIFF_URL = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}`
  : 'https://liff.line.me/YOUR_LIFF_ID';

// จ่ายสมาชิกรายเดือนสำเร็จ → activate +30 วัน
async function handleSubscription(session) {
  const lineUserId = session.metadata && session.metadata.line_user_id;
  if (!lineUserId) return;
  const r = await subscribers.activateSubscription(lineUserId, session.id, 30);
  const expTH = new Date(r.expire_date).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  await lineMessaging.pushText(lineUserId,
    `ชำระเงินสำเร็จ! ✨\n\nสมาชิก Prinnie333 ของคุณใช้ได้ถึง ${expTH}\nรับดวงประจำวันทุกเช้า 08:00 น. 🌟`);
  console.log(`[stripe] activated ${lineUserId} until ${r.expire_date}`);
}

// จ่ายปลดล็อกดวงคู่ 149 สำเร็จ → คำนวณใหม่จาก metadata → push ผลเต็ม + upsell
async function handleCouple(session) {
  const m = session.metadata || {};
  const lineUserId = m.line_user_id;
  if (!lineUserId) return;

  const me = await subscribers.getByLineUserId(lineUserId);
  if (!me || !me.chart_data) return;

  let lat = m.lat ? Number(m.lat) : null;
  let lng = m.lng ? Number(m.lng) : null;
  if ((lat == null || lng == null) && m.birth_place) {
    const g = await geocoding.geocode(m.birth_place);
    lat = g.lat; lng = g.lng;
  }

  const partnerChart = computeNatalChart({ date: m.birth_date, time: m.birth_time || null, lat, lng });
  const reading = await synastry.synastryReading(me.chart_data, partnerChart);

  await lineMessaging.pushText(lineUserId, synastry.formatFull(reading, m.partner_name));
  await lineMessaging.pushText(lineUserId,
    `อยากดูดวงคู่ไม่จำกัด + รับดวงรายวันส่วนตัวทุกเช้าไหม? ✨\nสมาชิก Prinnie333 เพียง 399 บาท/เดือน\n\n👉 ${LIFF_URL}`);
  console.log(`[stripe] couple unlocked for ${lineUserId} (${m.partner_name})`);
}

function register(app) {
  app.post('/api/payment/stripe-webhook', express.raw({ type: '*/*' }), async (req, res) => {
    let event;
    try {
      event = stripeService.constructEvent(req.body, req.headers['stripe-signature']);
    } catch (e) {
      console.error('[stripe] bad signature:', e.message);
      return res.status(400).send('bad signature');
    }
    res.json({ received: true });

    if (event.type !== 'checkout.session.completed') return;
    const session = event.data.object;
    const type = (session.metadata && session.metadata.type) || 'subscription';
    try {
      if (type === 'couple') await handleCouple(session);
      else                   await handleSubscription(session);
    } catch (err) {
      console.error('[stripe] handler error:', err.message);
    }
  });
}

module.exports = { register };
