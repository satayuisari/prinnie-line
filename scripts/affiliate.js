// จัดการ affiliate จาก terminal — ปกติใช้แดชบอร์ดแทนได้ทั้งหมด (เก็บไว้เผื่อฉุกเฉิน/ทำเป็นชุด)
// ทุกคำสั่งเรียก service ตัวเดียวกับแดชบอร์ด → สถานะและ audit log ตรงกันเสมอ
// ใช้:
//   node scripts/affiliate.js add <code> "<ชื่ออินฟลู>"   สร้างอินฟลู + พิมพ์ลิงก์
//   node scripts/affiliate.js list                        ดูรายชื่อ + ลิงก์ + สถานะ
//   node scripts/affiliate.js pause <code>                หยุดผูก attribution ใหม่ชั่วคราว
//   node scripts/affiliate.js off <code>                  ปิดใช้งาน (ของเดิมไม่หาย)
//   node scripts/affiliate.js on <code>                   เปิดใช้งานอีกครั้ง
//   node scripts/affiliate.js stats                       KPI ทุกคน (คลิก→สมัคร→จ่าย/CAC/refund)
//   node scripts/affiliate.js ledger [code]               รายการค่าคอมทีละใบ
//   node scripts/affiliate.js approve <id|due>            PENDING→APPROVED (due = ทุกใบที่พ้น hold)
//   node scripts/affiliate.js reverse <id> "<เหตุผล>"     ตัดค่าคอม (ต้องมีเหตุผล) — PAID แล้วตั้งธงรอตรวจ
//   node scripts/affiliate.js payout <code>               APPROVED→PAID (บันทึกว่าจ่ายอินฟลูแล้ว)
//   node scripts/affiliate.js kit <code>                  พิมพ์ promoter kit ไว้ก๊อปส่ง
//   node scripts/affiliate.js report <code>               รายงานผลงานส่งอินฟลู
const db = require('../src/db');
const affiliates = require('../src/services/affiliates');
const com = require('../src/services/affiliateCommission');
const kit = require('../src/services/promoterKit');

const { BASE_CPA, BONUS_TIERS } = com;
const baht = n => Number(n || 0).toLocaleString();
const ICON = { ACTIVE: '🟢', PAUSED: '⏸', OFF: '⚪' };

async function add(code, name) {
  if (!name) { console.log('ใช้: add <code> "<ชื่อ>"'); return; }
  const a = await affiliates.create({ name, code, actor: 'cli' });
  console.log(`✓ สร้างอินฟลู: ${a.name} (${a.code})`);
  console.log(`  ลิงก์: ${a.url}`);
}

async function list() {
  const rows = await affiliates.list();
  if (!rows.length) { console.log('ยังไม่มีอินฟลู — สร้างด้วย: node scripts/affiliate.js add <code> "<ชื่อ>"'); return; }
  for (const a of rows) console.log(`${ICON[a.status] || '?'} ${a.name} (${a.code}) · ${a.status}\n   ${a.url}`);
}

async function setStatus(code, status) {
  if (!code) { console.log(`ใช้: ${status.toLowerCase()} <code>`); return; }
  const r = await affiliates.setStatus(code, status, { actor: 'cli' });
  console.log(`✓ ${code}: ${r.from} → ${r.status}`);
}

// KPI ต่ออินฟลู — ตัวเลขชุดเดียวกับแท็บ Affiliates บนแดชบอร์ด
async function stats() {
  const rows = await affiliates.performance();
  if (!rows.length) { console.log('ยังไม่มีอินฟลู'); return; }
  const t = await com.totals();
  console.log(`\n=== KPI อินฟลู (${kit.COMMISSION_RULE}) ===`);
  for (const a of rows) {
    console.log(`\n${ICON[a.status] || ''} ${a.name} (${a.code}) · ${a.status}`);
    console.log(`  คลิก ${a.clicks} → สมัคร ${a.registered} → จ่ายจริง ${a.paid} ราย` +
                `  (Click→Reg ${a.clickToReg}% · Reg→Paid ${a.regToPaid}%)`);
    console.log(`  รายได้ ${baht(a.revenue)}฿ · refund ${a.refundRate}%${a.reversed ? ` (${a.reversed} ใบถูกตัด)` : ''}`);
    console.log(`  ค่าคอม ${baht(a.commission)}฿ · CAC ${a.paid ? a.cac + '฿' : '—'}`);
    console.log(`  ledger: PENDING ${baht(a.pending_amt)}฿ · APPROVED ${baht(a.approved_amt)}฿ · PAID ${baht(a.paid_amt)}฿`);
  }
  console.log(`\n— รวมทั้งระบบ —`);
  console.log(`  PENDING ${baht(t.pending)}฿ (${t.pending_n} ใบ) · APPROVED ${baht(t.approved)}฿ (${t.approved_n} ใบ)` +
              ` · PAID ${baht(t.paid)}฿ (${t.paid_n} ใบ) · REVERSED ${baht(t.reversed)}฿`);
  if (t.review_n) console.log(`  ⚠️ ${t.review_n} ใบรอแอดมินตรวจ (refund หลังจ่ายอินฟลูไปแล้ว)`);
  console.log(`  ⚠️ จ่ายอินฟลูเฉพาะใบ APPROVED เท่านั้น (PENDING ยังอยู่ในช่วง hold กัน refund)`);
  console.log(`  💡 โบนัส milestone (${BONUS_TIERS.map(b => `${b.at} คน→+${b.bonus}฿`).join(', ')}) จ่ายมือแยก ไม่อยู่ใน ledger`);
}

async function ledger(code) {
  const rows = await com.list({ code: code || null });
  if (!rows.length) { console.log('ยังไม่มีค่าคอมในตาราง'); return; }
  const icon = { PENDING: '⏳', APPROVED: '✅', PAID: '💸', REVERSED: '❌' };
  for (const r of rows) {
    console.log(`#${r.id} ${icon[r.status] || ''} ${r.status.padEnd(8)} ${String(r.affiliate_code).padEnd(12)}` +
      ` ${baht(r.amount)}฿ (รายได้ ${baht(r.revenue_amount)}฿)  ${String(r.line_user_id).slice(0, 12)}…` +
      `  สร้าง ${r.created} · hold→ ${r.hold}${r.needs_review ? '  ⚠️ รอตรวจ' : ''}${r.reason ? `  [${r.reason}]` : ''}`);
  }
}

async function approve(arg) {
  if (!arg) { console.log('ใช้: approve <id> | approve due'); return; }
  const rows = await com.approve(arg === 'due' ? 'due' : Number(arg), { actor: 'cli' });
  console.log(rows.length ? `✓ approved ${rows.length} ใบ (พร้อมจ่าย)` : 'ไม่มีใบไหนเข้าเงื่อนไข (ต้องเป็น PENDING)');
}

async function reverse(id, reason) {
  if (!id || !reason) { console.log('ใช้: reverse <id> "<เหตุผล>"'); return; }
  const r = await com.reverse(Number(id), reason, { actor: 'cli' });
  console.log(r.ok ? `✓ ตัดค่าคอม #${id} แล้ว (${r.from} → REVERSED)` : `✗ ${r.reason}`);
}

async function payout(code) {
  if (!code) { console.log('ใช้: payout <code>'); return; }
  const rows = await com.markPaid({ code: affiliates.clean(code), actor: 'cli' });
  if (!rows.length) { console.log(`ไม่มีค่าคอม APPROVED ของ ${code} (ต้อง approve ก่อน: approve due)`); return; }
  const sum = rows.reduce((s, x) => s + x.amount, 0);
  console.log(`✓ จ่ายค่าคอม ${code}: ${rows.length} ใบ รวม ${baht(sum)}฿ → บันทึกเป็น PAID`);
}

const [cmd, ...args] = process.argv.slice(2);
const run = {
  add: () => add(args[0], args[1]),
  list,
  pause: () => setStatus(args[0], 'PAUSED'),
  off:   () => setStatus(args[0], 'OFF'),
  on:    () => setStatus(args[0], 'ACTIVE'),
  stats,
  ledger:  () => ledger(args[0] ? affiliates.clean(args[0]) : null),
  approve: () => approve(args[0]),
  reverse: () => reverse(args[0], args[1]),
  payout:  () => payout(args[0]),
  kit:     async () => console.log('\n' + (await kit.kit(args[0])).text),
  report:  async () => console.log('\n' + await kit.report(args[0])),
}[cmd];
if (!run) {
  console.log('ใช้: add | list | pause | off | on | stats | ledger | approve | reverse | payout | kit | report');
  console.log('(ปกติใช้แดชบอร์ดแทนได้ทั้งหมด: /dashboard?key=… → แท็บ Affiliates / Commissions / Recruitment)');
  process.exit(1);
}
Promise.resolve(run()).then(() => db.end()).catch(e => { console.error('ERR', e.message); process.exit(1); });
