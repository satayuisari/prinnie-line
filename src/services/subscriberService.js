const db = require('../db');
const { computeNatalChart } = require('../astro/natalChart');
const geocoding = require('./geocodingService');

// สมัคร/อัปเดต subscriber พร้อมคำนวณดวงกำเนิดเก็บไว้
async function upsertSubscriber(input) {
  const {
    line_user_id, display_name, picture_url,
    nickname, birth_date, birth_time, birth_place,
  } = input;

  if (!line_user_id || !birth_date) {
    throw new Error('line_user_id และ birth_date จำเป็น');
  }

  // หาพิกัด + timezone จากชื่อสถานที่ (ถ้าไม่ได้ส่ง lat/lng มาตรง ๆ)
  let lat = input.lat != null ? Number(input.lat) : null;
  let lng = input.lng != null ? Number(input.lng) : null;
  let placeDisplay = birth_place;

  if ((lat == null || lng == null) && birth_place) {
    const geo = await geocoding.geocode(birth_place);
    lat = geo.lat;
    lng = geo.lng;
    placeDisplay = geo.display_name || birth_place;
  }

  // คำนวณดวงกำเนิด (timezone/DST อัตโนมัติจากพิกัด) — เก็บใน chart_data
  const chart = computeNatalChart({
    date: birth_date,
    time: birth_time || null,
    lat,
    lng,
  });

  const result = await db.query(
    `INSERT INTO line_subscribers
       (line_user_id, display_name, picture_url, nickname,
        birth_date, birth_time, birth_time_known, birth_place, birth_lat, birth_lng,
        chart_data, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING',NOW(),NOW())
     ON CONFLICT (line_user_id) DO UPDATE SET
       display_name     = EXCLUDED.display_name,
       picture_url      = EXCLUDED.picture_url,
       nickname         = EXCLUDED.nickname,
       birth_date       = EXCLUDED.birth_date,
       birth_time       = EXCLUDED.birth_time,
       birth_time_known = EXCLUDED.birth_time_known,
       birth_place      = EXCLUDED.birth_place,
       birth_lat        = EXCLUDED.birth_lat,
       birth_lng        = EXCLUDED.birth_lng,
       chart_data       = EXCLUDED.chart_data,
       updated_at       = NOW()
     RETURNING id, status, subscribe_end`,
    [
      line_user_id, display_name, picture_url, nickname,
      birth_date, birth_time || null, !!birth_time, placeDisplay,
      lat, lng,
      JSON.stringify(chart),
    ]
  );

  const row = result.rows[0];
  let subStatus = row.status;

  // โหมดเทสฟรี: เปิดใช้งานทันทีไม่ต้องจ่าย (ตั้ง FREE_ACCESS=true)
  if (process.env.FREE_ACCESS === 'true') {
    await activateSubscription(line_user_id, 'free-trial', 30);
    subStatus = 'ACTIVE';
  }

  return {
    status:    'SAVED',
    id:        row.id,
    sub_status: subStatus,
    free_access: process.env.FREE_ACCESS === 'true',
    chart: { sun: chart.sun, moon: chart.moon, rising: chart.rising, life_path: chart.life_path },
  };
}

// บันทึก "lead" ตอนมีคนแอดเพื่อน (follow) — เก็บ userId ไว้วัด funnel + ตามกลับภายหลัง
// chart_data ยัง NULL = ยังไม่ลงทะเบียน. ON CONFLICT DO NOTHING = ไม่ทับข้อมูลคนที่ลงทะเบียน/จ่ายแล้ว
async function captureFollower({ line_user_id, display_name, picture_url }) {
  if (!line_user_id) return;
  await db.query(
    `INSERT INTO line_subscribers (line_user_id, display_name, picture_url, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'PENDING', NOW(), NOW())
     ON CONFLICT (line_user_id) DO NOTHING`,
    [line_user_id, display_name || null, picture_url || null]
  );
}

async function getByLineUserId(line_user_id) {
  const r = await db.query(
    'SELECT * FROM line_subscribers WHERE line_user_id = $1', [line_user_id]
  );
  return r.rows[0] || null;
}

async function getMemberStatus(line_user_id) {
  // ดึง birth_date/birth_time แบบ format string เพื่อให้ฟอร์ม LIFF prefill ได้ตรง
  // (เลี่ยงปัญหา timezone ของ DATE/TIME type ตอนแปลงเป็น YYYY-MM-DD / HH:MM)
  const r = await db.query(
    `SELECT nickname, subscribe_end, chart_data, birth_place,
            birth_time_known,
            to_char(birth_date, 'YYYY-MM-DD') AS birth_date,
            to_char(birth_time, 'HH24:MI')    AS birth_time
     FROM line_subscribers WHERE line_user_id = $1`,
    [line_user_id]
  );
  const sub = r.rows[0];
  if (!sub) return { status: 'NOT_FOUND' };

  const active = sub.subscribe_end && new Date(sub.subscribe_end) > new Date();
  return {
    status:      active ? 'ACTIVE' : (sub.chart_data ? 'EXPIRED' : 'PENDING'),
    nickname:    sub.nickname,
    expire_date: sub.subscribe_end,
    has_chart:   !!sub.chart_data,
    // ข้อมูลเกิดเดิม สำหรับ prefill ฟอร์มแก้ไข
    birth_date:       sub.birth_date,
    birth_time:       sub.birth_time,
    birth_time_known: sub.birth_time_known,
    birth_place:      sub.birth_place,
  };
}

// activate / ต่ออายุ +30 วัน
async function activateSubscription(line_user_id, paymentRef, days = 30) {
  const sub = await getByLineUserId(line_user_id);
  if (!sub) throw new Error('ไม่พบ subscriber');

  const base = sub.subscribe_end && new Date(sub.subscribe_end) > new Date()
    ? new Date(sub.subscribe_end)
    : new Date();
  const end = new Date(base);
  end.setDate(end.getDate() + days);

  await db.query(
    `UPDATE line_subscribers
     SET status = 'ACTIVE',
         subscribe_start = COALESCE(subscribe_start, NOW()),
         subscribe_end   = $1,
         payment_ref     = $2,
         updated_at      = NOW()
     WHERE line_user_id = $3`,
    [end.toISOString(), paymentRef || null, line_user_id]
  );

  return { status: 'ACTIVE', expire_date: end, nickname: sub.nickname };
}

// subscriber ที่ ACTIVE สำหรับ scheduler
async function getActiveSubscribers() {
  const r = await db.query(
    `SELECT id, line_user_id, nickname, chart_data
     FROM line_subscribers
     WHERE subscribe_end > NOW()
       AND chart_data IS NOT NULL
     ORDER BY id`
  );
  return r.rows;
}

// เคลมสิทธิ์ "ฟรี 1 วัน" แบบ atomic — คืน true ถ้าเพิ่งได้สิทธิ์ (ยังไม่เคยใช้), false ถ้าใช้ไปแล้ว
async function claimFreeDaily(line_user_id) {
  const r = await db.query(
    `UPDATE line_subscribers SET free_daily_at = NOW()
     WHERE line_user_id = $1 AND free_daily_at IS NULL RETURNING id`,
    [line_user_id]
  );
  return r.rows.length > 0;
}

// คนที่ "ลงทะเบียนแล้วแต่ยังไม่จ่าย" (มีดวง แต่ไม่ active) — เป้าหมาย teaser 8 โมงเช้า
async function getRegisteredInactive() {
  const r = await db.query(
    `SELECT id, line_user_id, nickname, chart_data
     FROM line_subscribers
     WHERE chart_data IS NOT NULL
       AND (subscribe_end IS NULL OR subscribe_end <= NOW())
       AND status <> 'CANCELLED'
     ORDER BY id`
  );
  return r.rows;
}

module.exports = {
  upsertSubscriber, getByLineUserId, getMemberStatus,
  activateSubscription, getActiveSubscribers, getRegisteredInactive, claimFreeDaily, captureFollower,
};
