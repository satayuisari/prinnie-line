const express     = require('express');
const router      = express.Router();
const subscribers = require('../services/subscriberService');
const horoscope   = require('../services/horoscopeService');

// POST /api/line/signup
// รับข้อมูลเกิดจาก LIFF → คำนวณดวง → เก็บ
router.post('/signup', async (req, res) => {
  const {
    line_user_id, display_name, picture_url,
    nickname, birth_date, birth_time, birth_place, lat, lng,
  } = req.body;

  if (!line_user_id || !birth_date) {
    return res.status(400).json({ error: 'ต้องส่ง line_user_id และ birth_date' });
  }

  try {
    const result = await subscribers.upsertSubscriber({
      line_user_id, display_name, picture_url,
      nickname, birth_date, birth_time, birth_place, lat, lng,
    });
    res.json(result);
  } catch (err) {
    console.error('[signup]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/line/member-status?line_user_id=Uxxxx
router.get('/member-status', async (req, res) => {
  const { line_user_id } = req.query;
  if (!line_user_id) return res.status(400).json({ error: 'line_user_id required' });
  try {
    res.json(await subscribers.getMemberStatus(line_user_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/line/natal?line_user_id=Uxxxx  — พื้นดวง
router.get('/natal', async (req, res) => {
  const { line_user_id } = req.query;
  if (!line_user_id) return res.status(400).json({ error: 'line_user_id required' });

  try {
    const sub = await subscribers.getByLineUserId(line_user_id);
    if (!sub || !sub.chart_data) return res.status(404).json({ error: 'ยังไม่มีข้อมูลดวง' });
    res.json(await horoscope.natalReading(sub.chart_data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/line/daily-horoscope?line_user_id=Uxxxx&date=2026-06-09
router.get('/daily-horoscope', async (req, res) => {
  const { line_user_id, date } = req.query;
  if (!line_user_id) return res.status(400).json({ error: 'line_user_id required' });

  try {
    const sub = await subscribers.getByLineUserId(line_user_id);
    if (!sub || !sub.chart_data) return res.status(404).json({ error: 'ยังไม่มีข้อมูลดวง' });
    const targetDate = date ? new Date(date) : new Date();
    res.json(await horoscope.dailyReading(sub.chart_data, targetDate));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
