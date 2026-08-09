// ตัวช่วยเทส — ใช้ DB แยก (PGLITE_DIR) จะได้ไม่แตะข้อมูล dev/production
// ต้องตั้ง PGLITE_DIR ก่อน require ตัว db (ไฟล์เทสเรียก setupDb() เป็นอย่างแรก)
const fs = require('fs');
const path = require('path');

const TEST_DIR = path.join(__dirname, '..', '.pglite-test');

// แต่ละไฟล์เทสใช้โฟลเดอร์ของตัวเอง — node --test รันหลายไฟล์พร้อมกันได้โดยไม่ชนกัน
function prepareEnv(name = 'default') {
  const dir = `${TEST_DIR}-${name}`;
  process.env.PGLITE_DIR = dir;
  process.env.DATABASE_URL = '';          // บังคับใช้ PGlite ไม่ใช่ Postgres จริง
  process.env.TEST_MODE = 'true';         // กันยิง LINE จริงจากทุกทาง
  process.env.LINE_CHANNEL_ACCESS_TOKEN = '';
  delete process.env.FREE_ACCESS;
  fs.rmSync(dir, { recursive: true, force: true });
}

async function migrate(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(255) PRIMARY KEY, run_at TIMESTAMP DEFAULT NOW())`);
  const dir = path.join(__dirname, '..', 'database', 'migrations');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.sql')).sort()) {
    const done = await db.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [f]);
    if (done.rows.length) continue;
    await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  }
}

// ล้างทุกตารางที่เกี่ยวกับ affiliate ระหว่างเคส (ไม่ drop schema จะได้เร็ว)
async function reset(db) {
  await db.query('DELETE FROM affiliate_commissions');
  await db.query('DELETE FROM affiliate_audit_log');
  await db.query('DELETE FROM affiliate_candidates');
  await db.query('DELETE FROM payment_orders');
  await db.query('DELETE FROM line_subscribers');
  await db.query('DELETE FROM channel_clicks');
  await db.query('DELETE FROM affiliates');
}

// ลงทะเบียนสมาชิกผ่าน service จริง (ส่ง lat/lng ตรงเพื่อไม่ให้ไปเรียก geocoding ผ่านเน็ต)
async function registerUser(subscribers, userId, { code = null, first = null } = {}) {
  return subscribers.upsertSubscriber({
    line_user_id: userId,
    display_name: 'Test ' + userId.slice(-3),
    nickname: 'test',
    birth_date: '1995-05-05',
    birth_time: '08:30',
    birth_place: 'Bangkok',
    lat: 13.7563, lng: 100.5018,
    affiliate_code: code,
    affiliate_code_first: first,
  });
}

// สร้างออเดอร์ subscription + อนุมัติ (เส้นทางเดียวกับ staff กดอนุมัติ/สลิปผ่าน)
async function payOrder(db, orders, paymentApprove, userId, ref, amountSatang = 39900) {
  await db.query(
    `INSERT INTO payment_orders (ref, type, line_user_id, amount, status) VALUES ($1,'subscription',$2,$3,'PENDING')`,
    [ref, userId, amountSatang]);
  const order = await orders.get(ref);
  return paymentApprove.approve(order, 'test');
}

module.exports = { prepareEnv, migrate, reset, registerUser, payOrder, TEST_DIR };
