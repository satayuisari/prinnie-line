const express     = require('express');
const router      = express.Router();
const subscribers = require('../services/subscriberService');
const horoscope   = require('../services/horoscopeService');
const synastry    = require('../services/synastryService');
const geocoding   = require('../services/geocodingService');
const beamService = require('../services/beamService');
const promptpay   = require('../services/promptpayService');
const orders      = require('../services/paymentOrders');
const coupleCard  = require('../services/coupleCard');
const { computeNatalChart } = require('../astro/natalChart');
const { requireAuth } = require('../services/lineAuth');

// base URL สาธารณะ (สำหรับลิงก์การ์ดที่แชร์ออกนอก/ส่งเป็น image message)
function baseUrl(req) {
  return (process.env.PUBLIC_BASE_URL ||
    `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}
function coupleCardUrl(req, score, a, b) {
  const q = `score=${score}&a=${encodeURIComponent(a || 'คุณ')}&b=${encodeURIComponent(b || 'คู่ของคุณ')}`;
  return `${baseUrl(req)}/api/line/couple-card.jpg?${q}`;
}

// GET /api/line/couple-card.jpg — การ์ดผูกดวงคู่แชร์ได้ (public, render จาก query ไม่มี PII)
router.get('/couple-card.jpg', async (req, res) => {
  try {
    const score = Math.max(0, Math.min(100, parseInt(req.query.score, 10) || 0));
    const buf = await coupleCard.render({ score, a: req.query.a, b: req.query.b });
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) {
    console.error('[couple-card]', e.message);
    res.status(500).end();
  }
});

// POST /api/line/signup
// รับข้อมูลเกิดจาก LIFF → คำนวณดวง → เก็บ (userId มาจาก token ที่ verify แล้ว)
router.post('/signup', requireAuth, async (req, res) => {
  const { nickname, birth_date, birth_time, birth_place, lat, lng } = req.body;
  if (!birth_date) return res.status(400).json({ error: 'ต้องส่ง birth_date' });

  try {
    const result = await subscribers.upsertSubscriber({
      line_user_id: req.line.userId,
      display_name: req.line.displayName,
      picture_url:  req.line.pictureUrl,
      nickname, birth_date, birth_time, birth_place, lat, lng,
    });
    res.json(result);
  } catch (err) {
    console.error('[signup]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/line/member-status  (userId จาก token)
router.get('/member-status', requireAuth, async (req, res) => {
  try {
    res.json(await subscribers.getMemberStatus(req.line.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/line/natal — พื้นดวง
router.get('/natal', requireAuth, async (req, res) => {
  try {
    const sub = await subscribers.getByLineUserId(req.line.userId);
    if (!sub || !sub.chart_data) return res.status(404).json({ error: 'ยังไม่มีข้อมูลดวง' });
    res.json(await horoscope.natalReading(sub.chart_data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/line/daily-horoscope?date=2026-06-09
router.get('/daily-horoscope', requireAuth, async (req, res) => {
  try {
    const sub = await subscribers.getByLineUserId(req.line.userId);
    if (!sub || !sub.chart_data) return res.status(404).json({ error: 'ยังไม่มีข้อมูลดวง' });
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    res.json(await horoscope.dailyReading(sub.chart_data, targetDate));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/line/synastry — ผูกดวงคู่
// รับวันเกิดของอีกฝ่าย → คำนวณดวงคู่ → เทียบกับดวงของผู้ใช้
router.post('/synastry', requireAuth, async (req, res) => {
  const { partner_name, birth_date, birth_time, birth_place, lat, lng } = req.body;
  if (!birth_date) return res.status(400).json({ error: 'ต้องส่งวันเกิดของคู่' });

  try {
    const me = await subscribers.getByLineUserId(req.line.userId);
    if (!me || !me.chart_data) {
      return res.status(404).json({ error: 'คุณยังไม่มีข้อมูลดวง กรุณาลงทะเบียนดวงของคุณก่อน' });
    }

    // พิกัด/timezone ของคู่ (geocode ถ้าไม่ได้ส่ง lat/lng มา)
    let plat = lat != null ? Number(lat) : null;
    let plng = lng != null ? Number(lng) : null;
    if ((plat == null || plng == null) && birth_place) {
      const g = await geocoding.geocode(birth_place);
      plat = g.lat; plng = g.lng;
    }

    const partnerChart = computeNatalChart({ date: birth_date, time: birth_time || null, lat: plat, lng: plng });
    const reading = await synastry.synastryReading(me.chart_data, partnerChart);

    const active = !!(me.subscribe_end && new Date(me.subscribe_end) > new Date());
    const base = {
      partner_name: partner_name || 'คู่ของคุณ',
      me:      { sun: me.chart_data.sun, moon: me.chart_data.moon, rising: me.chart_data.rising },
      partner: { sun: partnerChart.sun, moon: partnerChart.moon, rising: partnerChart.rising },
      score:   reading.score,
      card_url: coupleCardUrl(req, reading.score, me.nickname, partner_name),  // การ์ดแชร์ได้ (ทุกคน รวม teaser)
    };

    if (active) {
      // สมาชิก → อ่านเต็ม ฟรี
      return res.json({ ...base, locked: false, reading });
    }
    // คนไม่ใช่สมาชิก → teaser (% + มุมดี 1 บรรทัด) + ราคา 149
    return res.json({
      ...base,
      locked: true,
      price: beamService.COUPLE_PRICE_THB,
      teaser: synastry.pickTeaser(reading.aspects),
    });
  } catch (err) {
    console.error('[synastry]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ปลดล็อกดวงคู่ (ครั้งเดียว) → PromptPay QR + สลิป. เก็บข้อมูลคู่ใน payment_orders.payload
// staff อนุมัติสลิปบน dashboard → couplePurchase.fulfill() push ผลเต็ม. ถ้ายังไม่ตั้ง PromptPay → 410
router.post('/couple-checkout', requireAuth, async (req, res) => {
  if (!promptpay.isEnabled()) {
    return res.status(410).json({
      disabled: true,
      error: 'ช่องทางชำระเงินกำลังปรับปรุง โปรดติดต่อทีมงานสักครู่นะคะ ✨',
    });
  }
  const { partner_name, birth_date, birth_time, birth_place, lat, lng } = req.body;
  if (!birth_date) return res.status(400).json({ error: 'ต้องส่งวันเกิดของคู่' });
  try {
    const ref = await orders.create({
      type: 'couple',
      line_user_id: req.line.userId,
      amount: promptpay.COUPLE_PRICE_THB * 100,
      method: 'promptpay',
      payload: { partner_name, birth_date, birth_time, birth_place, lat, lng },
    });
    res.json({ url: `${baseUrl(req)}/pay.html?ref=${ref}` });
  } catch (err) {
    console.error('[couple-checkout]', err.message);
    res.status(500).json({ error: 'สร้างคำสั่งซื้อไม่สำเร็จ ลองใหม่อีกครั้งนะคะ' });
  }
});

module.exports = router;
