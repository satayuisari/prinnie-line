// จัดการ affiliate อินฟลู — สร้างรหัส/ลิงก์ + ดูผลงาน (คลิก/สมัคร/จ่าย/ค่าคอม)
// ใช้:
//   node scripts/affiliate.js add <code> "<ชื่ออินฟลู>"   สร้างอินฟลู + พิมพ์ลิงก์
//   node scripts/affiliate.js list                        ดูรายชื่อ + ลิงก์
//   node scripts/affiliate.js stats [ค่าคอมต่อคนจ่าย]      ผลงานทุกคน (default 100฿/คนจ่าย)
//   node scripts/affiliate.js off <code>                  ปิดใช้งาน
const db = require('../src/db');

const BASE = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'prinnie-app-production.up.railway.app'}`;
const link = code => `${BASE}/go?a=${code}`;
const clean = s => (s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);

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

async function stats(commission = 100) {
  // คลิก (channel_clicks source='a:CODE') + สมัคร/จ่าย (line_subscribers.affiliate_code)
  const rows = (await db.query(`
    SELECT a.code, a.name,
      COALESCE(c.clicks,0)::int clicks,
      COUNT(s.id)::int registered,
      COUNT(s.id) FILTER (WHERE s.subscribe_end > NOW())::int active_now,
      COUNT(po.ref)::int paid_orders,
      COALESCE(SUM(po.amount) FILTER (WHERE po.status='PAID'),0)/100 revenue
    FROM affiliates a
    LEFT JOIN (SELECT REPLACE(source,'a:','') code, SUM(clicks) clicks FROM channel_clicks WHERE source LIKE 'a:%' GROUP BY 1) c ON c.code=a.code
    LEFT JOIN line_subscribers s ON s.affiliate_code=a.code AND s.chart_data IS NOT NULL
    LEFT JOIN payment_orders po ON po.line_user_id=s.line_user_id AND po.status='PAID'
    GROUP BY a.code, a.name, c.clicks
    ORDER BY revenue DESC, registered DESC`)).rows;
  if (!rows.length) { console.log('ยังไม่มีอินฟลู'); return; }
  console.log(`\n=== ผลงานอินฟลู (ค่าคอม ${commission}฿/คนจ่าย) ===`);
  let totalPay = 0;
  for (const r of rows) {
    const payers = r.paid_orders;   // นับตามออเดอร์จ่าย (คนจ่ายซ้ำ = นับหลายครั้ง)
    const com = payers * commission;
    totalPay += com;
    console.log(`\n${r.name} (${r.code})`);
    console.log(`  คลิก ${r.clicks} → สมัคร ${r.registered} → จ่าย ${payers} ราย · รายได้ ${Number(r.revenue).toLocaleString()}฿`);
    console.log(`  ค่าคอมค้างจ่าย: ${com.toLocaleString()}฿`);
  }
  console.log(`\nรวมค่าคอมทั้งหมด: ${totalPay.toLocaleString()}฿`);
  await db.end();
}

const [cmd, ...args] = process.argv.slice(2);
const run = { add: () => add(args[0], args[1]), list, off: () => off(args[0]), stats: () => stats(Number(args[0]) || 100) }[cmd];
if (!run) { console.log('ใช้: add <code> "<ชื่อ>" | list | stats [ค่าคอม] | off <code>'); process.exit(1); }
Promise.resolve(run()).then(() => cmd !== 'stats' && db.end()).catch(e => { console.error('ERR', e.message); process.exit(1); });
