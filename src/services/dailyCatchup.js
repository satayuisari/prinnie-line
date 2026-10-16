// ส่งดวงของ "วันนี้" ให้ทันทีเมื่อเปิดสมาชิก/ต่ออายุหลังรอบส่ง 08:00
//
// 16 ต.ค. 69 เกิดจริง: ลูกค้าถูกอนุมัติ 08:48 → ดวงรายวันส่งไปแล้วตอน 08:00 → เธอไม่ได้ของวันนั้น
// แล้วทักมาถาม 2 รอบ · bon: "อนุมัติปุ๊บต้องส่งให้ซักทีมั้ย เค้าจะได้รู้ว่าติดแล้ว"
// ก่อน 08:00 ไม่ต้องทำอะไร — รอบปกติจะส่งให้เอง · กันส่งซ้ำด้วย delivery_logs ของวันนี้
// lazy-require: ไม่เปิด pool ฐานข้อมูลตอน require (เทสต์ shouldCatchUp ล้วน ๆ จะได้ไม่ค้าง)
const deps = () => ({ db: require('../db'), lineMessaging: require('./lineMessaging'), dailyTeaser: require('./dailyTeaser') });

const BKK_OFFSET = 7 * 3600e3;
const SEND_HOUR = 8;

// ตัดสินใจจากเวลาไทยล้วน ๆ (เซิร์ฟเวอร์เป็น UTC) — หลัง 08:00 ไทย = รอบวันนี้ผ่านไปแล้ว
function shouldCatchUp(now = new Date()) {
  const bkk = new Date(now.getTime() + BKK_OFFSET);
  return bkk.getUTCHours() >= SEND_HOUR;
}

// คืน 'sent' | 'already' | 'before-round' | 'no-chart' | 'skipped'
async function sendTodayDaily(lineUserId, now = new Date()) {
  if (!shouldCatchUp(now)) return 'before-round';
  const { db, lineMessaging, dailyTeaser } = deps();
  const r = await db.query(
    `SELECT id, nickname, chart_data FROM line_subscribers
     WHERE line_user_id = $1 AND chart_data IS NOT NULL AND subscribe_end > NOW()`, [lineUserId]);
  const m = r.rows[0];
  if (!m) return 'no-chart';
  // รอบ 08:00 ไทย = 01:00 UTC ของวันเดียวกัน → ถ้ามี log หลังจากนั้นแล้ว = ได้รับแล้ว
  const bkk = new Date(now.getTime() + BKK_OFFSET);
  const roundAt = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate(), SEND_HOUR) - BKK_OFFSET);
  const dup = await db.query(
    `SELECT 1 FROM delivery_logs WHERE subscriber_id = $1 AND message_type = 'daily' AND sent_at >= $2`,
    [m.id, roundAt.toISOString()]);
  if (dup.rows.length) return 'already';

  const msgs = await dailyTeaser.buildCombinedDaily(m.chart_data, m.nickname, now, { userId: lineUserId });
  const res = await lineMessaging.pushMessage(lineUserId, msgs);
  if (res && res.skipped) return 'skipped';
  await db.query(
    `INSERT INTO delivery_logs (subscriber_id, message_type, status, error_message, sent_at)
     VALUES ($1, 'daily', 'success', NULL, NOW())`, [m.id]);
  return 'sent';
}

module.exports = { shouldCatchUp, sendTodayDaily };
