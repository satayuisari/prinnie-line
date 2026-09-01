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
const { getMessageContent, pushText, notifyAdmins } = require('../services/lineMessaging');

// เลยหน้าต่างตรวจซ้ำแล้วยังไม่ผ่าน = ต้องมีคนดู
const RECHECK_WINDOW_MIN = 90;

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

// ── ตาข่ายกันสลิปหาย ──
// สลิปที่ตรวจอัตโนมัติไม่ผ่านจนเลย 90 นาที จะหลุดจากทั้ง recheck (หมดหน้าต่าง) และ
// pendingOrders (ข้ามใบที่มีสลิป) → เดิมไม่มีใครรู้เลยว่าค้าง ทั้งที่ลูกค้าโอนเงินมาแล้ว
// และเพิ่งได้ยินจากบอทว่า "ไม่ต้องส่งซ้ำนะคะ เดี๋ยวระบบตรวจให้"
// → ส่งให้แอดมินดูด้วยมือ ครั้งเดียวต่อออเดอร์ (escalated_at) + บอกลูกค้าตามตรง
async function escalateStuck() {
  const rows = (await db.query(`
    UPDATE payment_orders SET escalated_at = NOW()
     WHERE ref IN (
       SELECT ref FROM payment_orders
        WHERE status='PENDING' AND method='promptpay'
          AND slip_message_id IS NOT NULL AND escalated_at IS NULL
          AND slip_received_at < NOW() - ($1 || ' minutes')::interval
        ORDER BY slip_received_at LIMIT 20)
    RETURNING ref, type, amount, line_user_id`, [String(RECHECK_WINDOW_MIN)])).rows;
  if (!rows.length) return { escalated: 0 };

  for (const o of rows) {
    const what = o.type === 'couple' ? 'ปลดล็อกดวงคู่' : 'เปิดใช้งานสมาชิก';
    await notifyAdmins(
      `⚠️ สลิปค้างเกิน ${RECHECK_WINDOW_MIN} นาที — ระบบตรวจอัตโนมัติไม่ผ่าน ต้องเช็กมือ\n` +
      `รายการ: ${what} ${o.amount / 100}฿ (${o.ref})\nid: ${o.line_user_id}\n` +
      `👉 เข้า dashboard กดดูสลิป → อนุมัติ`).catch(() => {});
    await pushText(o.line_user_id,
      `ขออภัยที่ให้รอนะคะ 🙏 สลิปของคุณระบบตรวจอัตโนมัติยังไม่ผ่าน\n` +
      `ทีมงานรับเรื่องไปตรวจด้วยตัวเองแล้ว จะ${what}ให้เร็วที่สุดค่ะ ✨`).catch(() => {});
    console.log(`[slip-recheck] ⚠️ ส่งต่อให้แอดมิน ${o.ref}`);
  }
  return { escalated: rows.length };
}

function start() {
  cron.schedule('*/5 * * * *', () => {
    recheck().catch(e => console.error('[slip-recheck]', e.message));
    escalateStuck().catch(e => console.error('[slip-recheck] escalate:', e.message));
  }, { timezone: 'Asia/Bangkok' });
  console.log('[slip-recheck] ตรวจสลิปซ้ำทุก 5 นาที (สำหรับธนาคารที่ข้อมูลมาช้า)');
}

module.exports = { start, recheck, escalateStuck };
