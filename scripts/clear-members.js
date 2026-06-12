// ล้าง member ทั้งหมด (สำหรับเทส) — DELETE line_subscribers (cascade → delivery_logs)
//   node scripts/clear-members.js <path-to-url-file>
const fs = require('fs');
const { Pool } = require('pg');

const url = fs.readFileSync(process.argv[2], 'utf8').trim();
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

(async () => {
  const before = await pool.query('SELECT COUNT(*) FROM line_subscribers');
  await pool.query('DELETE FROM line_subscribers');
  const after = await pool.query('SELECT COUNT(*) FROM line_subscribers');
  console.log(`ลบ member: ${before.rows[0].count} -> ${after.rows[0].count} คน`);
  await pool.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
