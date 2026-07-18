// ตามออเดอร์ค้างจ่าย — เตือน "ครั้งเดียว" ต่อออเดอร์ ทาง LINE พร้อมลิงก์หน้าจ่ายเดิม
// เงื่อนไข: PENDING เกิน 20 ชม. แต่ไม่เกิน 7 วัน, ยังไม่ส่งสลิป, ยังไม่เคยถูกเตือน
const cron = require('node-cron');
const db = require('../db');
const { pushMessage } = require('../services/lineMessaging');

const BASE = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'prinnie-app-production.up.railway.app'}`;

async function remindPending() {
  const rows = (await db.query(
    `SELECT ref, line_user_id, type, amount FROM payment_orders
     WHERE status='PENDING' AND slip_message_id IS NULL AND reminded_at IS NULL
       AND created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '20 hours'
     ORDER BY created_at DESC LIMIT 100`)).rows;
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
