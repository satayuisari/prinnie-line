// ตรวจสลิปซ้ำอัตโนมัติ — สำหรับสลิปที่ธนาคารยังไม่ปล่อยข้อมูลตอนลูกค้าส่งมา
//
// ที่มา: SlipOK ตอบ code 1010 "กรุณารอการตรวจสอบสลิปหลังการโอนประมาณ 7 นาที"
//        (เจอกับธนาคารกรุงเทพ) ถ้าไม่ตรวจซ้ำ ลูกค้าที่โอนจริงจะค้างรอแอดมินเปล่า ๆ
//
// ทำงาน: ทุก 5 นาที หยิบออเดอร์ที่ยัง PENDING + มีสลิป + ส่งมาแล้ว 6–90 นาที
//        ส่งเข้า SlipOK อีกรอบ ผ่านเมื่อไหร่ก็เปิดใช้งานให้ทันที + แจ้งลูกค้า
//        (ไม่แตะออเดอร์ที่ PAID แล้ว และ approve เป็น idempotent อยู่แล้ว)
const cron = require('node-cron');
const db = require('../db');
const orders = require('../services/paymentOrders');
const slipVerify = require('../services/slipVerify');
const paymentApprove = require('../services/paymentApprove');
const { getMessageContent, pushText } = require('../services/lineMessaging');

async function recheck() {
  if (!slipVerify.isEnabled()) return { checked: 0 };

  const rows = (await db.query(`
    SELECT ref, type, amount, line_user_id, slip_message_id
    FROM payment_orders
    WHERE status='PENDING' AND slip_message_id IS NOT NULL
      AND slip_received_at BETWEEN NOW() - INTERVAL '90 minutes' AND NOW() - INTERVAL '6 minutes'
    ORDER BY slip_received_at LIMIT 20`)).rows;
  if (!rows.length) return { checked: 0 };

  let approved = 0;
  for (const o of rows) {
    const amount = o.amount / 100;
    const buf = await getMessageContent(o.slip_message_id).catch(() => null);
    if (!buf) continue;                       // รูปหมดอายุบน LINE → ปล่อยให้แอดมินดูเอง
    const v = await slipVerify.verify(buf, amount);
    if (!(v.ok && Math.abs(v.amount - amount) < 1)) continue;

    const order = await orders.get(o.ref);
    if (!order || order.status !== 'PENDING') continue;
    await paymentApprove.approve(order, 'slipok-recheck-' + (v.ref || Date.now()));
    approved++;
    const what = o.type === 'couple' ? 'ปลดล็อกดวงคู่' : 'เปิดใช้งานสมาชิก';
    await pushText(o.line_user_id,
      `✅ ตรวจสลิปเรียบร้อยแล้วค่ะ ${what}ให้แล้วนะคะ ขอบคุณที่รอค่ะ 🎉`).catch(() => {});
    console.log(`[slip-recheck] ✅ ${o.ref} ผ่านรอบตรวจซ้ำ`);
  }

  if (approved) console.log(`[slip-recheck] ตรวจซ้ำ ${rows.length} ใบ · ผ่าน ${approved} ใบ`);
  return { checked: rows.length, approved };
}

function start() {
  cron.schedule('*/5 * * * *', () => recheck().catch(e => console.error('[slip-recheck]', e.message)),
    { timezone: 'Asia/Bangkok' });
  console.log('[slip-recheck] ตรวจสลิปซ้ำทุก 5 นาที (สำหรับธนาคารที่ข้อมูลมาช้า)');
}

module.exports = { start, recheck };
