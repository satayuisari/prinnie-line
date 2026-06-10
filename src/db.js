require('dotenv').config();

// DB adapter — รองรับ 2 โหมด:
//   1. Postgres จริง (production)  → ตั้ง DATABASE_URL เป็น connection string จริง
//   2. PGlite (local dev/test)     → ไม่ต้องตั้งค่าอะไร รันในตัว Node เก็บไฟล์ใน .pglite-data/
//
// โค้ด SQL เหมือนกันทั้งสองโหมด (PGlite = Postgres จริงคอมไพล์เป็น WASM)
// exposes: query(text, params) -> {rows} | exec(sql) | end()

const url = process.env.DATABASE_URL || '';
const isRealPg = /^postgres(ql)?:\/\//.test(url) && !/user:password@localhost/.test(url);

let impl;

if (isRealPg) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url });
  pool.on('error', (e) => console.error('DB error:', e.message));
  impl = {
    driver: 'pg',
    query: (text, params) => pool.query(text, params),
    exec:  (sql) => pool.query(sql),
    end:   () => pool.end(),
  };
} else {
  const path = require('path');
  const { PGlite } = require('@electric-sql/pglite');
  const dataDir = path.join(__dirname, '..', '.pglite-data');
  const pg = new PGlite(dataDir);
  impl = {
    driver: 'pglite',
    query: (text, params) => pg.query(text, params || []),
    exec:  (sql) => pg.exec(sql),
    end:   () => pg.close(),
  };
}

module.exports = impl;
