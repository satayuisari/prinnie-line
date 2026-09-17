// ตามออเดอร์ค้างจ่าย — เตือน "ครั้งเดียว" ต่อออเดอร์ ทาง LINE พร้อมลิงก์หน้าจ่ายเดิม
// เงื่อนไข: PENDING เกิน 20 ชม. แต่ไม่เกิน 7 วัน, ยังไม่ส่งสลิป, ยังไม่เคยถูกเตือน
//   + ต้องไม่ใช่คนที่เป็นสมาชิกอยู่แล้ว
//
// ⚠️ บั๊กที่เคยเกิดจริง (แก้ 23 ส.ค.): เดิมไม่เช็คสถานะสมาชิก
//    ลูกค้าที่กดสร้างออเดอร์หลายใบแล้วจ่ายสำเร็จใบเดียว จะเหลือใบอื่นค้างเป็น PENDING
//    ระบบเลยไปทวง "รายการของคุณยังเปิดค้างอยู่" กับคนที่จ่ายเงินไปแล้ว — เกิดขึ้น 30 ครั้ง
const cron = require('node-cron');
const db = require('../db');
const { pushMessage } = require('../services/lineMessaging');
const slipHelp = require('../services/slipHelp');
const { nextRound } = require('../services/pickAnnounce');

const BASE = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'prinnie-app-production.up.railway.app'}`;

// minHours: ออเดอร์ต้องค้างมาอย่างน้อยกี่ชั่วโมง (รอบปกติ 20 · สั่งมือได้)
// คนเดียวมีหลายออเดอร์ค้าง → เตือนครั้งเดียว (ใบล่าสุด) แล้วปิดเตือนทุกใบของคนนั้น
async function remindPending({ minHours = 20 } = {}) {
  const rows = (await db.query(
    `SELECT DISTINCT ON (o.line_user_id) o.ref, o.line_user_id, o.type, o.amount,
            COALESCE(s.nickname, s.display_name) AS name
     FROM payment_orders o
     LEFT JOIN line_subscribers s ON s.line_user_id = o.line_user_id
     WHERE o.status='PENDING' AND o.slip_message_id IS NULL AND o.reminded_at IS NULL
       AND o.created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - ($1::int * INTERVAL '1 hour')
       AND NOT EXISTS (
         SELECT 1 FROM line_subscribers s
         WHERE s.line_user_id = o.line_user_id
           AND s.status = 'ACTIVE' AND s.subscribe_end > NOW()
       )
     ORDER BY o.line_user_id, o.created_at DESC LIMIT 100`, [minHours])).rows;
  const round = nextRound(new Date());
  let sent = 0;
  for (const o of rows) {
    const text = slipHelp.reminderText({ name: o.name, order: o, payUrl: `${BASE}/pay.html?ref=${o.ref}`, round });
    const r = await pushMessage(o.line_user_id, [{ type: 'text', text }]).catch(e => { console.error('[pending-orders]', o.ref, e.message); return null; });
    await db.query(
      `UPDATE payment_orders SET reminded_at=NOW() WHERE line_user_id=$1 AND status='PENDING' AND reminded_at IS NULL`,
      [o.line_user_id]);
    if (r && !r.skipped) sent++;
  }
  console.log(`[pending-orders] เตือนออเดอร์ค้าง ${sent}/${rows.length} ราย`);
  return { sent, total: rows.length };
}

function start() {
  cron.schedule('30 10 * * *', remindPending, { timezone: 'Asia/Bangkok' });
  console.log('[pending-orders] reminder — 10:30 Bangkok ทุกวัน (เตือนครั้งเดียวต่อออเดอร์)');
}

module.exports = { start, remindPending };
