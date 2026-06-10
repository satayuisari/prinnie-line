require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('../src/db');

async function migrate() {
  console.log(`DB driver: ${db.driver}`);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      run_at   TIMESTAMP DEFAULT NOW()
    )
  `);

  const dir   = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rows } = await db.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (rows.length) { console.log(`  skip  ${file}`); continue; }

    await db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
    await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`  ✓     ${file}`);
  }

  console.log('Migration complete.');
  await db.end();
}

migrate().catch(err => { console.error(err.message); process.exit(1); });
