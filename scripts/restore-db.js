// กู้ข้อมูลจากไฟล์สำรองของ scripts/backup-db.js กลับเข้า DB เปล่า
//
// ใช้:  DATABASE_URL="…ปลายทาง…" node scripts/restore-db.js ~/prinnie-backups/prinnie-XXXX.json
//   (ต้องรัน node database/migrate.js บนปลายทางก่อน เพื่อสร้าง schema)
//
// ⚠️ ปลายทางต้องเป็น DB เปล่า/ตัวใหม่ — สคริปต์นี้ปฏิเสธถ้ามีข้อมูลอยู่แล้ว เว้นแต่ใส่ --force
//    (--force = ลบข้อมูลเดิมทุกตารางที่อยู่ในไฟล์สำรอง ก่อนโหลดทับ)
const fs = require('fs');
const db = require('../src/db');

const file = process.argv[2];
const force = process.argv.includes('--force');

// เรียงตารางให้ "แม่มาก่อนลูก" ตาม foreign key — ไม่งั้น insert ลูกก่อนจะชน FK
// (เช่น delivery_logs อ้าง line_subscribers · affiliate_commissions อ้าง affiliates)
async function loadOrder(names) {
  const fks = (await db.query(`
    SELECT tc.table_name child, ccu.table_name parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`)).rows;
  const deps = new Map(names.map(n => [n, new Set()]));
  for (const { child, parent } of fks) {
    if (child !== parent && deps.has(child) && deps.has(parent)) deps.get(child).add(parent);
  }
  const done = [];
  const seen = new Set();
  while (done.length < names.length) {
    const ready = names.filter(n => !seen.has(n) && [...deps.get(n)].every(p => seen.has(p)));
    // วนเป็นวง (ไม่ควรเกิดกับ schema นี้) → ใส่ที่เหลือตามเดิม ให้ ON CONFLICT รับไป
    if (!ready.length) { names.filter(n => !seen.has(n)).forEach(n => { done.push(n); seen.add(n); }); break; }
    for (const n of ready) { done.push(n); seen.add(n); }
  }
  return done;
}

async function main() {
  if (!file) { console.error('ใช้: node scripts/restore-db.js <ไฟล์สำรอง.json> [--force]'); process.exit(1); }
  const dump = JSON.parse(fs.readFileSync(file, 'utf8'));
  const names = Object.keys(dump.tables);
  console.log(`ไฟล์สำรอง: ${dump.generated_at} · server ${dump.server_version} · ${names.length} ตาราง`);

  // กันเผลอเขียนทับ DB ที่มีข้อมูลจริง
  if (!force) {
    for (const t of names) {
      const exist = await db.query(`SELECT COUNT(*)::int n FROM "${t}"`).catch(() => null);
      if (exist && exist.rows[0].n > 0) {
        console.error(`✗ ตาราง ${t} มีข้อมูลอยู่แล้ว (${exist.rows[0].n} แถว) — ใส่ --force ถ้าตั้งใจจะทับ`);
        process.exit(1);
      }
    }
  }

  const order = await loadOrder(names);
  // ลบย้อนลำดับก่อน (ลูกก่อนแม่) แล้วค่อย insert ตามลำดับ (แม่ก่อนลูก)
  if (force) {
    for (const t of [...order].reverse()) await db.query(`DELETE FROM "${t}"`).catch(() => {});
  }

  let total = 0;
  for (const t of order) {
    const { columns, rows } = dump.tables[t];
    if (!rows.length) continue;
    const cols = columns.map(c => `"${c}"`).join(',');
    for (const row of rows) {
      const ph = columns.map((_, i) => `$${i + 1}`).join(',');
      // ส่งค่าผ่าน parameter ให้ driver จัดการชนิดเอง (jsonb/timestamp/array ถูกต้องตามชนิดคอลัมน์)
      await db.query(`INSERT INTO "${t}" (${cols}) VALUES (${ph}) ON CONFLICT DO NOTHING`,
        columns.map(c => row[c]));
    }
    total += rows.length;
    console.log(`  ${t.padEnd(28)} ${String(rows.length).padStart(7)} แถว`);
  }

  // ดัน sequence ให้เลยค่าเดิม — insert ใหม่จะได้ไม่ชน primary key
  for (const [seq, last] of Object.entries(dump.sequences || {})) {
    if (last != null) await db.query(`SELECT setval('${seq}', $1, true)`, [last]).catch(() => {});
  }

  console.log(`\n✓ กู้ข้อมูลแล้ว ${total.toLocaleString()} แถว`);
  await db.end();
}

main().catch(e => {
  console.error('ERR', e.message.replace(/postgres(ql)?:\/\/\S+/g, '[REDACTED]'));
  process.exit(1);
});
