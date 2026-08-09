// สำรองข้อมูล production เป็นไฟล์ JSON (logical dump ผ่าน driver — ไม่ต้องมี pg_dump ในเครื่อง)
// ใช้คู่กับ scripts/restore-db.js : schema มาจาก database/migrations/ ส่วนไฟล์นี้เก็บ "ข้อมูล"
//
// ใช้:  railway run --service prinnie-app node scripts/backup-db.js
//   หรือ DATABASE_URL="…" node scripts/backup-db.js [ปลายทาง]
//
// ⚠️ ไฟล์ที่ได้มีข้อมูลส่วนบุคคลของลูกค้า (ชื่อ วันเกิด LINE user id)
//    เก็บนอก repo เสมอ (default: ~/prinnie-backups/) ห้าม commit ห้ามแชร์
const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('../src/db');

const OUT_DIR = process.argv[2] || path.join(os.homedir(), 'prinnie-backups');

async function main() {
  // กันพลาดร้ายแรง: ถ้า DATABASE_URL ว่าง/ผิด db.js จะถอยไปใช้ PGlite ในเครื่อง
  // แล้วเราจะได้ไฟล์สำรอง "ว่างเปล่า" ที่ดูเหมือนสำเร็จ — ต้องหยุดทันที
  if (db.driver !== 'pg') {
    console.error('✗ ไม่ได้ต่อกับ Postgres จริง (กำลังใช้ ' + db.driver + ')');
    console.error('  ตั้ง DATABASE_URL ให้ถูกก่อน เช่น: railway run --service prinnie-app node scripts/backup-db.js');
    process.exit(1);
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `prinnie-${stamp}.json`);

  const version = (await db.query('SHOW server_version')).rows[0].server_version;
  // เรียงตามชื่อ — restore ปิด FK ระหว่างโหลดอยู่แล้ว ลำดับจึงไม่สำคัญ
  const tables = (await db.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows.map(r => r.tablename);

  const dump = { generated_at: new Date().toISOString(), server_version: version, tables: {} };
  let total = 0;
  for (const t of tables) {
    const r = await db.query(`SELECT * FROM "${t}"`);
    dump.tables[t] = { columns: r.fields.map(f => f.name), rows: r.rows };
    total += r.rows.length;
    console.log(`  ${t.padEnd(28)} ${String(r.rows.length).padStart(7)} แถว`);
  }
  // ค่า sequence ปัจจุบัน — restore แล้ว id ใหม่จะได้ไม่ชนของเดิม
  const seqs = (await db.query(`SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public'`)).rows;
  dump.sequences = Object.fromEntries(seqs.map(s => [s.sequencename, s.last_value]));

  // DB จริงต้องมีสมาชิกและออเดอร์เสมอ — ว่างแปลว่าต่อผิดที่ ไม่ใช่ไฟล์สำรองที่ใช้ได้
  const subs = dump.tables.line_subscribers?.rows.length || 0;
  if (subs === 0) {
    console.error('\n✗ line_subscribers ว่างเปล่า — น่าจะต่อผิด database ไม่เขียนไฟล์สำรอง');
    process.exit(1);
  }

  fs.writeFileSync(outFile, JSON.stringify(dump));
  const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
  console.log(`\n✓ สำรองแล้ว: ${outFile}`);
  console.log(`  ${tables.length} ตาราง · ${total.toLocaleString()} แถว · ${mb} MB · server ${version}`);
  await db.end();
}

main().catch(e => {
  console.error('ERR', e.message.replace(/postgres(ql)?:\/\/\S+/g, '[REDACTED]'));
  process.exit(1);
});
