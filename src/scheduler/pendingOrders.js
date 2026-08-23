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

const BASE = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'prinnie-app-production.up.railway.app'}`;

async function remindPending() {
  const rows = (await db.query(
    `SELECT o.ref, o.line_user_id, o.type, o.amount FROM payment_orders o
     WHERE o.status='PENDING' AND o.slip_message_id IS NULL AND o.reminded_at IS NULL
       AND o.created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '20 hours'
       AND NOT EXISTS (
         SELECT 1 FROM line_subscribers s
         WHERE s.line_user_id = o.line_user_id
           AND s.status = 'ACTIVE' AND s.subscribe_end > NOW()
       )
     ORDER BY o.created_at DESC LIMIT 100`)).rows;
  let sent = 0;
  for (const o of rows) {
    const what = o.type === 'couple'
      ? `ปลดล็อกผลดวงคู่ (${o.amount / 100} บาท)`
      : `สมาชิกรายเดือน (${o.amount / 100} บาท)`;
    const text = `แอดมินขออนุญาตเตือนนิดนึงนะคะ 🙏\nรายการ${what}ของคุณยังเปิดค้างอยู่ค่ะ\n\nถ้ายังสนใจ สแกนจ่ายผ่าน PromptPay ได้ที่นี่เลย\n👉 ${BASE}/pay.html?ref=${o.ref}\n\nโอนเสร็จส่งรูปสลิปมาในแชทนี้ ระบบเปิดใช้งานให้อัตโนมัติทันทีค่ะ ✨`;
    const r = await pushMessage(o.line_user_id, [{ type: 'text', text }]).catch(e => { console.error('[pending-orders]', o.ref, e.message); return null; });
    await db.query('UPDATE payment_orders SET reminded_at=NOW() WHERE ref=$1', [o.ref]);
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
