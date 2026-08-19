// ให้สิทธิ์ founder — ใช้ได้ตลอดไป ไม่หมดอายุ (บัญชีทดลอง/ทีมงาน/แขกพิเศษ)
//
// ใช้:  node scripts/grant-founder.js <line_user_id | ชื่อ/ชื่อเล่น>
//       node scripts/grant-founder.js --list            ดูรายชื่อ founder ทั้งหมด
//       node scripts/grant-founder.js --revoke <id>     ยกเลิกสิทธิ์ founder
//
// วิธีทำงาน: subscribe_end = 2099-12-31 + status ACTIVE + payment_ref='founder'
//   - 'founder' ถูกตัดออกจากยอดลูกค้าจ่ายจริง/MRR (กลุ่มเดียวกับ tester/free)
//     → ใช้งานได้ครบทุกฟีเจอร์ แต่ไม่ไปปนตัวเลขรายได้
//   - ไม่แตะ payment_orders → ประวัติการเงินเดิมไม่ถูกแก้แม้แต่แถวเดียว
//   - subscribe_end ไกลมาก → ตัวเตือนต่ออายุไม่ยิงหาคนกลุ่มนี้ (กรอบเตือนคือใกล้หมดอายุ)
const db = require('../src/db');

const FOREVER = '2099-12-31';
const REF = 'founder';

async function find(term) {
  const r = await db.query(
    `SELECT line_user_id, display_name, nickname, status, payment_ref,
            to_char(subscribe_end,'YYYY-MM-DD') ends
     FROM line_subscribers
     WHERE line_user_id = $1
        OR LOWER(COALESCE(nickname,''))     = LOWER($1)
        OR LOWER(COALESCE(display_name,'')) = LOWER($1)
        OR LOWER(COALESCE(display_name,'')) LIKE '%' || LOWER($1) || '%'
        OR LOWER(COALESCE(nickname,''))     LIKE '%' || LOWER($1) || '%'
     ORDER BY (line_user_id = $1) DESC, created_at`, [term]);
  return r.rows;
}

async function list() {
  const r = await db.query(
    `SELECT line_user_id, display_name, nickname, to_char(subscribe_end,'YYYY-MM-DD') ends
     FROM line_subscribers WHERE payment_ref = $1 ORDER BY updated_at DESC`, [REF]);
  if (!r.rows.length) { console.log('ยังไม่มีบัญชี founder'); return; }
  console.log(`บัญชี founder ${r.rows.length} รายการ:`);
  for (const s of r.rows) {
    console.log(`  ${s.line_user_id.slice(0, 14)}… · ${(s.display_name || '-').padEnd(18)} (${s.nickname || '-'}) · ถึง ${s.ends}`);
  }
}

async function grant(term) {
  const found = await find(term);
  if (!found.length) { console.error(`✗ ไม่พบบัญชีที่ตรงกับ "${term}"`); process.exit(1); }
  if (found.length > 1) {
    console.error(`✗ เจอหลายบัญชี (${found.length}) — ระบุ line_user_id ให้ชัดเจน:`);
    for (const s of found) console.error(`   ${s.line_user_id} · ${s.display_name} (${s.nickname || '-'})`);
    process.exit(1);
  }
  const s = found[0];
  console.log('ก่อนแก้:', s.display_name, `(${s.nickname || '-'})`,
    '· สถานะ', s.status, '· หมดอายุ', s.ends || '-', '· ref', s.payment_ref || '-');

  const r = await db.query(
    `UPDATE line_subscribers
        SET status='ACTIVE', subscribe_end=$2::date, payment_ref=$3,
            renewal_stage=0, renewal_anchor=NULL, updated_at=NOW()
      WHERE line_user_id=$1
      RETURNING to_char(subscribe_end,'YYYY-MM-DD') ends, status, payment_ref`,
    [s.line_user_id, FOREVER, REF]);

  const a = r.rows[0];
  console.log('หลังแก้:', '· สถานะ', a.status, '· หมดอายุ', a.ends, '· ref', a.payment_ref);
  console.log(`✓ ${s.display_name} เป็น founder แล้ว — ใช้งานได้ตลอด ไม่นับเป็นลูกค้าจ่ายจริง`);
}

async function revoke(term) {
  const found = await find(term);
  if (found.length !== 1) { console.error('✗ ต้องระบุให้ตรงบัญชีเดียว'); process.exit(1); }
  await db.query(
    `UPDATE line_subscribers SET status='EXPIRED', subscribe_end=NOW(), payment_ref=NULL, updated_at=NOW()
     WHERE line_user_id=$1`, [found[0].line_user_id]);
  console.log(`✓ ยกเลิกสิทธิ์ founder ของ ${found[0].display_name} แล้ว`);
}

const [cmd, arg] = process.argv.slice(2);
const run = cmd === '--list'   ? list
          : cmd === '--revoke' ? () => revoke(arg)
          : cmd                ? () => grant(cmd)
          : null;
if (!run) {
  console.log('ใช้: node scripts/grant-founder.js <line_user_id|ชื่อ> | --list | --revoke <id>');
  process.exit(1);
}
Promise.resolve(run()).then(() => db.end())
  .catch(e => { console.error('ERR', e.message.replace(/postgres(ql)?:\/\/\S+/g, '[REDACTED]')); process.exit(1); });
