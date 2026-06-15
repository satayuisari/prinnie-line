const express     = require('express');
const router      = express.Router();
const subscribers = require('../services/subscriberService');
const horoscope   = require('../services/horoscopeService');
const synastry    = require('../services/synastryService');
const geocoding   = require('../services/geocodingService');
const stripeService = require('../services/stripeService');
const { computeNatalChart } = require('../astro/natalChart');
const { requireAuth } = require('../services/lineAuth');

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
    };

    if (active) {
      // สมาชิก → อ่านเต็ม ฟรี
      return res.json({ ...base, locked: false, reading });
    }
    // คนไม่ใช่สมาชิก → teaser (% + มุมดี 1 บรรทัด) + ราคา 149
    return res.json({
      ...base,
      locked: true,
      price: 149,
      teaser: synastry.pickTeaser(reading.aspects),
    });
  } catch (err) {
    console.error('[synastry]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/line/couple-checkout — สร้างหน้าจ่าย 149 ปลดล็อกดวงคู่ (คนไม่ใช่สมาชิก)
router.post('/couple-checkout', requireAuth, async (req, res) => {
  const { partner_name, birth_date, birth_time, birth_place, lat, lng } = req.body;
  if (!birth_date) return res.status(400).json({ error: 'ต้องส่งวันเกิดของคู่' });
  try {
    const me = await subscribers.getByLineUserId(req.line.userId);
    if (!me || !me.chart_data) return res.status(404).json({ error: 'คุณยังไม่มีข้อมูลดวง' });

    // geocode ให้ได้ lat/lng เก็บใน metadata → webhook ไม่ต้อง geocode ซ้ำ (ผลคงที่)
    let plat = lat != null ? Number(lat) : null;
    let plng = lng != null ? Number(lng) : null;
    if ((plat == null || plng == null) && birth_place) {
      const g = await geocoding.geocode(birth_place);
      plat = g.lat; plng = g.lng;
    }

    const url = await stripeService.createCoupleCheckout(req.line.userId, {
      partner_name, birth_date, birth_time, birth_place, lat: plat, lng: plng,
    });
    res.json({ url });
  } catch (err) {
    console.error('[couple-checkout]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
