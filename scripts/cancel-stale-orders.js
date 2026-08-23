// ยกเลิกออเดอร์ค้างที่ตายไปแล้ว — เฉพาะของลูกค้าที่ "เป็นสมาชิกอยู่แล้ว"
//
// ทำไมปลอดภัย: คนกลุ่มนี้จ่ายสำเร็จไปแล้วด้วยออเดอร์ใบอื่น ใบที่ค้างคือความพยายามที่ล้มเหลว
// (ส่วนใหญ่เกิดจากจ่ายผ่านแอปกสิกรไม่ผ่าน แล้วกดสร้างใบใหม่) — ไม่มีเงินเกี่ยวข้อง
//
// ใช้:  node scripts/cancel-stale-orders.js            ดูก่อนว่าจะยกเลิกใบไหน (ไม่แก้อะไร)
//       node scripts/cancel-stale-orders.js --apply    ยกเลิกจริง
//
// ⚠️ ไม่แตะออเดอร์ที่: PAID · ส่งสลิปมาแล้ว · อายุน้อยกว่า MIN_AGE_DAYS (อาจกำลังจ่ายอยู่)
const db = require('../src/db');

const MIN_AGE_DAYS = 3;
const apply = process.argv.includes('--apply');

const SELECT = `
  SELECT o.ref, o.type, o.amount/100 AS baht,
         to_char(o.created_at,'YYYY-MM-DD') AS created,
         COALESCE(s.nickname, s.display_name, '-') AS name
  FROM payment_orders o
  JOIN line_subscribers s ON s.line_user_id = o.line_user_id
  WHERE o.status = 'PENDING'
    AND o.slip_message_id IS NULL
    AND o.created_at < NOW() - ($1 || ' days')::interval
    AND s.status = 'ACTIVE' AND s.subscribe_end > NOW()
  ORDER BY o.created_at`;

async function main() {
  if (db.driver !== 'pg') { console.error('✗ ต้องต่อกับ Postgres จริง'); process.exit(1); }

  const rows = (await db.query(SELECT, [String(MIN_AGE_DAYS)])).rows;
  if (!rows.length) { console.log('ไม่มีออเดอร์ที่เข้าเงื่อนไข'); await db.end(); return; }

  console.log(`ออเดอร์ค้างของลูกค้าที่เป็นสมาชิกอยู่แล้ว (เก่ากว่า ${MIN_AGE_DAYS} วัน): ${rows.length} ใบ`);
  for (const r of rows) {
    console.log(`  ${r.ref}  ${String(r.type).padEnd(12)} ${r.baht}฿  ${r.created}  ${r.name}`);
  }

  if (!apply) {
    console.log(`\n(ยังไม่ได้แก้อะไร — ใส่ --apply เพื่อยกเลิกจริง)`);
    await db.end();
    return;
  }

  const r = await db.query(`
    UPDATE payment_orders o SET status='CANCELLED'
    WHERE o.ref IN (SELECT ref FROM (${SELECT}) x)
    RETURNING o.ref`, [String(MIN_AGE_DAYS)]);
  console.log(`\n✓ ยกเลิกแล้ว ${r.rows.length} ใบ (ไม่แตะออเดอร์ที่จ่ายแล้วหรือมีสลิป)`);
  await db.end();
}

main().catch(e => {
  console.error('ERR', e.message.replace(/postgres(ql)?:\/\/\S+/g, '[REDACTED]'));
  process.exit(1);
});
