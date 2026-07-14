// ทดสอบ SlipOK กับสลิปจริงที่ค้างอยู่ (PENDING) — รายงานผล ไม่ auto-approve
const db = require('../src/db');
const orders = require('../src/services/paymentOrders');
const slipVerify = require('../src/services/slipVerify');
const { getMessageContent } = require('../src/services/lineMessaging');

(async () => {
  console.log('SlipOK enabled:', slipVerify.isEnabled());
  const r = await db.query(
    `SELECT ref, type, amount, status, slip_message_id FROM payment_orders
     WHERE method='promptpay' AND slip_message_id IS NOT NULL
     ORDER BY slip_received_at DESC LIMIT 4`);
  console.log('สลิปที่มีในระบบ:', r.rows.length, '(เทส API path — success/ซ้ำ/ยอด = ผ่าน 1001 แล้ว)\n');
  for (const o of r.rows) {
    const expected = o.amount / 100;
    const buf = await getMessageContent(o.slip_message_id);
    if (!buf) { console.log(`  ${o.ref} (${o.type} ${expected}฿): ❌ ดึงรูปสลิปไม่ได้ (LINE content หมดอายุ)`); continue; }
    const v = await slipVerify.verify(buf, expected);
    console.log(`  ${o.ref} (${o.type} ${expected}฿):`, v.ok ? `✅ ผ่าน! ยอด ${v.amount}฿ ref ${v.ref}` : `❌ ${v.reason} (code ${v.code||'-'})`);
  }
  await db.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
