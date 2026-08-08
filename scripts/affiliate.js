// จัดการ affiliate อินฟลู + Commission Ledger (First Paid Customer, Base CPA 50฿)
// ใช้:
//   node scripts/affiliate.js add <code> "<ชื่ออินฟลู>"   สร้างอินฟลู + พิมพ์ลิงก์
//   node scripts/affiliate.js list                        ดูรายชื่อ + ลิงก์
//   node scripts/affiliate.js off <code>                  ปิดใช้งาน
//   node scripts/affiliate.js stats                       KPI ทุกคน (CAC/conversion/refund + โบนัส)
//   node scripts/affiliate.js ledger [code]               รายการค่าคอมทีละแถว (สถานะ)
//   node scripts/affiliate.js approve <id|due>            PENDING→APPROVED (due = ทุกตัวที่พ้น hold)
//   node scripts/affiliate.js reverse <id|userId>         ตัดค่าคอม (refund/ทุจริต) — ห้ามตัวที่ PAID
//   node scripts/affiliate.js payout <code>               APPROVED→PAID (บันทึกว่าจ่ายอินฟลูแล้ว)
const db = require('../src/db');
const com = require('../src/services/affiliateCommission');
const { BASE_CPA, bonusFor, effectiveCac, cacVerdict, BONUS_TIERS } = com;

const BASE = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'prinnie-app-production.up.railway.app'}`;
const link = code => `${BASE}/go?a=${code}`;
const clean = s => (s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
const baht = n => Number(n || 0).toLocaleString();

async function add(code, name) {
  code = clean(code);
  if (!code || !name) { console.log('ใช้: add <code> "<ชื่อ>"'); return; }
  await db.query(
    `INSERT INTO affiliates (code, name) VALUES ($1,$2)
     ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=TRUE`, [code, name]);
  console.log(`✓ สร้าง/อัปเดตอินฟลู: ${name} (${code})`);
  console.log(`  ลิงก์: ${link(code)}`);
}

async function list() {
  const r = (await db.query('SELECT code, name, active FROM affiliates ORDER BY created_at')).rows;
  if (!r.length) { console.log('ยังไม่มีอินฟลู — สร้างด้วย: node scripts/affiliate.js add <code> "<ชื่อ>"'); return; }
  for (const a of r) console.log(`${a.active ? '🟢' : '⚪'} ${a.name} (${a.code})\n   ${link(a.code)}`);
}

async function off(code) {
  const r = await db.query('UPDATE affiliates SET active=FALSE WHERE code=$1 RETURNING name', [clean(code)]);
  console.log(r.rows.length ? `✓ ปิด ${r.rows[0].name}` : 'ไม่พบรหัสนี้');
}

// KPI ต่ออินฟลู จาก Commission Ledger — paid = ลูกค้าจ่ายจริงครั้งแรก (ไม่นับ reversed)
async function stats() {
  const rows = (await db.query(`
    SELECT a.code, a.name,
      COALESCE(c.clicks,0)::int clicks,
      COUNT(DISTINCT s.id)::int registered,
      COUNT(DISTINCT com.line_user_id) FILTER (WHERE com.status<>'REVERSED')::int paid,
      COUNT(DISTINCT com.line_user_id) FILTER (WHERE com.status='REVERSED')::int reversed,
      COALESCE(SUM(com.amount) FILTER (WHERE com.status='PENDING'),0)::int  pending_amt,
      COALESCE(SUM(com.amount) FILTER (WHERE com.status='APPROVED'),0)::int approved_amt,
      COALESCE(SUM(com.amount) FILTER (WHERE com.status='PAID'),0)::int     paid_amt
    FROM affiliates a
    LEFT JOIN (SELECT REPLACE(source,'a:','') code, SUM(clicks) clicks FROM channel_clicks WHERE source LIKE 'a:%' GROUP BY 1) c ON c.code=a.code
    LEFT JOIN line_subscribers s ON s.affiliate_code=a.code AND s.chart_data IS NOT NULL
    LEFT JOIN affiliate_commissions com ON com.affiliate_code=a.code
    GROUP BY a.code, a.name, c.clicks
    ORDER BY paid DESC, registered DESC`)).rows;
  if (!rows.length) { console.log('ยังไม่มีอินฟลู'); return; }

  const bonusText = BONUS_TIERS.slice().reverse().map(t => `${t.at}→+${t.bonus}฿`).join(', ');
  console.log(`\n=== KPI อินฟลู (Base CPA ${BASE_CPA}฿/ลูกค้าใหม่ · โบนัส ${bonusText}) ===`);
  let totalBase = 0, totalBonus = 0, totalPending = 0, totalApproved = 0, totalPaid = 0;
  for (const r of rows) {
    const bonus = bonusFor(r.paid);
    const base  = r.paid * BASE_CPA;
    const cac   = effectiveCac(r.paid);
    const v     = cacVerdict(cac);
    const conv  = r.registered ? Math.round(r.paid / r.registered * 100) : 0;
    const refund = (r.paid + r.reversed) ? Math.round(r.reversed / (r.paid + r.reversed) * 100) : 0;
    totalBase += base; totalBonus += bonus;
    totalPending += r.pending_amt; totalApproved += r.approved_amt; totalPaid += r.paid_amt;
    console.log(`\n${r.name} (${r.code})`);
    console.log(`  คลิก ${r.clicks} → สมัคร ${r.registered} → จ่าย ${r.paid} ราย  (Reg→Paid ${conv}%)`);
    console.log(`  รายได้ ${baht(r.paid * 399)}฿ · refund ${refund}%${r.reversed ? ` (${r.reversed} reversed)` : ''}`);
    console.log(`  ค่าคอม: ฐาน ${baht(base)}฿ + โบนัส ${baht(bonus)}฿ = ${baht(base + bonus)}฿  ·  CAC ${cac}฿ → ${v.label}`);
    console.log(`  ledger: PENDING ${baht(r.pending_amt)}฿ · APPROVED ${baht(r.approved_amt)}฿ · PAID ${baht(r.paid_amt)}฿`);
  }
  console.log(`\n— รวม —`);
  console.log(`  ค่าคอมฐาน ${baht(totalBase)}฿ + โบนัส ${baht(totalBonus)}฿ = ${baht(totalBase + totalBonus)}฿ (งบ 10,000฿)`);
  console.log(`  ledger รวม: PENDING ${baht(totalPending)}฿ · APPROVED ${baht(totalApproved)}฿ · PAID ${baht(totalPaid)}฿`);
  console.log(`  ⚠️ จ่ายอินฟลูเฉพาะ APPROVED เท่านั้น (PENDING ยังอยู่ในช่วง refund/fraud hold) · โบนัสจ่ายมือแยกจากตาราง`);
}

async function ledger(code) {
  const rows = (await db.query(
    `SELECT id, affiliate_code, line_user_id, amount, status,
       to_char(created_at,'MM-DD') created, to_char(hold_until,'MM-DD') hold
     FROM affiliate_commissions ${code ? 'WHERE affiliate_code=$1' : ''} ORDER BY id`,
    code ? [clean(code)] : [])).rows;
  if (!rows.length) { console.log('ยังไม่มีค่าคอมในตาราง'); return; }
  const icon = { PENDING: '⏳', APPROVED: '✅', PAID: '💸', REVERSED: '❌' };
  for (const r of rows) {
    console.log(`#${r.id} ${icon[r.status] || ''} ${r.status.padEnd(8)} ${r.affiliate_code.padEnd(12)} ${baht(r.amount)}฿  ${r.line_user_id.slice(0, 12)}…  (สร้าง ${r.created} · hold→ ${r.hold})`);
  }
}

async function approve(arg) {
  if (arg === 'due') {
    const r = await db.query(
      `UPDATE affiliate_commissions SET status='APPROVED', approved_at=NOW()
       WHERE status='PENDING' AND hold_until <= NOW() RETURNING id`);
    console.log(`✓ approved ${r.rows.length} รายการที่พ้น hold แล้ว (พร้อมจ่าย)`);
  } else if (/^\d+$/.test(arg || '')) {
    const r = await db.query(
      `UPDATE affiliate_commissions SET status='APPROVED', approved_at=NOW()
       WHERE id=$1 AND status='PENDING' RETURNING id`, [Number(arg)]);
    console.log(r.rows.length ? `✓ approved #${arg}` : 'ไม่พบ #' + arg + ' หรือสถานะไม่ใช่ PENDING');
  } else { console.log('ใช้: approve <id> | approve due'); }
}

async function reverse(idOrUser) {
  if (!idOrUser) { console.log('ใช้: reverse <id|userId>'); return; }
  const byId = /^\d+$/.test(idOrUser);
  const r = await db.query(
    `UPDATE affiliate_commissions SET status='REVERSED', reversed_at=NOW()
     WHERE ${byId ? 'id=$1' : 'line_user_id=$1'} AND status<>'PAID' RETURNING id`,
    [byId ? Number(idOrUser) : idOrUser]);
  console.log(r.rows.length
    ? `✓ reversed #${r.rows[0].id} (refund/ทุจริต — ตัดค่าคอม)`
    : 'ไม่พบ หรือจ่ายไปแล้ว (PAID) — reverse ไม่ได้');
}

async function payout(code) {
  code = clean(code);
  if (!code) { console.log('ใช้: payout <code>'); return; }
  const r = await db.query(
    `UPDATE affiliate_commissions SET status='PAID', paid_at=NOW()
     WHERE affiliate_code=$1 AND status='APPROVED' RETURNING amount`, [code]);
  const sum = r.rows.reduce((s, x) => s + x.amount, 0);
  if (!r.rows.length) { console.log(`ไม่มีค่าคอม APPROVED ของ ${code} (ต้อง approve ก่อน: approve due)`); return; }
  console.log(`✓ จ่ายค่าคอม ${code}: ${r.rows.length} รายการ รวม ${baht(sum)}฿ (ฐาน) → บันทึกเป็น PAID`);
  const bonus = bonusFor(r.rows.length);   // เตือนโบนัสถ้าถึงเกณฑ์ (จ่ายมือแยก)
  if (bonus) console.log(`  💡 อย่าลืมโบนัส milestone ~${baht(bonus)}฿ (นับจากลูกค้าจ่ายสะสม — ดู stats)`);
}

const [cmd, ...args] = process.argv.slice(2);
const run = {
  add: () => add(args[0], args[1]),
  list, off: () => off(args[0]),
  stats,
  ledger: () => ledger(args[0] ? clean(args[0]) : null),
  approve: () => approve(args[0]),
  reverse: () => reverse(args[0]),
  payout: () => payout(args[0]),
}[cmd];
if (!run) {
  console.log('ใช้: add <code> "<ชื่อ>" | list | off <code> | stats | ledger [code] | approve <id|due> | reverse <id|userId> | payout <code>');
  process.exit(1);
}
Promise.resolve(run()).then(() => db.end()).catch(e => { console.error('ERR', e.message); process.exit(1); });
