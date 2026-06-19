'use strict';
/**
 * subscriptionStats.js — ดึงตัวเลข subscriber จาก DB จริง (read-only) มาโชว์บน staff console
 * ใช้ DASHBOARD_DB_URL (= DATABASE_PUBLIC_URL ของ Railway Postgres). ไม่ตั้ง → คืน null (panel ซ่อน)
 */
const PRICE = 399;
let pool = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.DASHBOARD_DB_URL;
  if (!url) return null;
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
  pool.on('error', (e) => console.error('[subStats] db error:', e.message));
  return pool;
}

async function get() {
  const p = getPool();
  if (!p) return { enabled: false };
  const q = await p.query(`
    SELECT
      COUNT(*)::int                                                              AS total,
      COUNT(*) FILTER (WHERE status='ACTIVE')::int                               AS active,
      COUNT(*) FILTER (WHERE status='PENDING')::int                              AS pending,
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int               AS today,
      COUNT(*) FILTER (WHERE status='ACTIVE' AND subscribe_end IS NOT NULL
                        AND subscribe_end <= CURRENT_DATE + INTERVAL '7 days')::int AS expiring
    FROM line_subscribers`);
  const s = q.rows[0];
  const recent = (await p.query(`
    SELECT COALESCE(display_name, nickname, '(ไม่มีชื่อ)') AS name,
           status,
           to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') AS created
    FROM line_subscribers ORDER BY created_at DESC LIMIT 12`)).rows;
  return { enabled: true, ...s, mrr: s.active * PRICE, recent };
}

module.exports = { get };
