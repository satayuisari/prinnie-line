// Performance snapshot ของ Prinnie333 — funnel + รายได้ + SlipOK + pending
// รัน: railway run bash -c 'DATABASE_URL="$PUB" node scripts/perf-snapshot.js'
const db = require('../src/db');
(async () => {
  const s = (await db.query(`SELECT
    COUNT(*)::int total, COUNT(*) FILTER(WHERE chart_data IS NOT NULL)::int reg,
    COUNT(*) FILTER(WHERE status='ACTIVE')::int active,
    COUNT(*) FILTER(WHERE free_daily_at IS NOT NULL)::int used_free,
    COUNT(*) FILTER(WHERE created_at >= NOW()-INTERVAL '3 hours')::int new3h
    FROM line_subscribers`)).rows[0];
  const p = (await db.query(`SELECT COALESCE(SUM(amount),0)::bigint b, COUNT(*)::int n,
    COUNT(*) FILTER(WHERE charge_id LIKE 'slipok%')::int auto,
    COUNT(*) FILTER(WHERE paid_at >= NOW()-INTERVAL '3 hours')::int paid3h
    FROM payment_orders WHERE status='PAID'`)).rows[0];
  const pend = (await db.query(`SELECT COUNT(*)::int n, COUNT(*) FILTER(WHERE slip_message_id IS NOT NULL)::int wslip
    FROM payment_orders WHERE status='PENDING'`)).rows[0];
  const t = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' });
  console.log(`===== SNAPSHOT ${t} =====`);
  console.log(`ผู้ติดตาม ${s.total} | ลงทะเบียน ${s.reg} | ใช้ฟรี ${s.used_free} | สมาชิก active ${s.active}`);
  console.log(`รายได้ ${(p.b / 100).toLocaleString()}฿ (${p.n} รายการ) | SlipOK auto ${p.auto}`);
  console.log(`ค้าง ${pend.n} (ส่งสลิปรอเช็ก ${pend.wslip})`);
  console.log(`3 ชม.ล่าสุด: แอดใหม่ +${s.new3h} | จ่ายใหม่ +${p.paid3h} ราย`);
  if (pend.wslip > 0) console.log(`⚠️ มีสลิปค้างรอเช็ก ${pend.wslip} — เข้า dashboard อนุมัติ`);
  await db.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
