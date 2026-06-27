// คำสั่งซื้อที่รอชำระ (Beam) — สร้าง ref, เก็บข้อมูล, mark paid แบบ idempotent
const crypto = require('crypto');
const db = require('../db');

// ref สั้น อ่านง่ายใน dashboard: <type>_<random>
function newRef(type) {
  return `${type === 'couple' ? 'cpl' : 'sub'}_${crypto.randomBytes(8).toString('hex')}`;
}

async function create({ type, line_user_id, amount, payload }) {
  const ref = newRef(type);
  await db.query(
    `INSERT INTO payment_orders (ref, type, line_user_id, amount, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [ref, type, line_user_id, amount, payload ? JSON.stringify(payload) : null]
  );
  return ref;
}

async function get(ref) {
  const r = await db.query('SELECT * FROM payment_orders WHERE ref = $1', [ref]);
  return r.rows[0] || null;
}

// คืน true ถ้าเพิ่งเปลี่ยนจาก PENDING→PAID (กัน webhook ยิงซ้ำ activate ซ้ำ)
async function markPaid(ref, chargeId) {
  const r = await db.query(
    `UPDATE payment_orders
     SET status = 'PAID', charge_id = $2, paid_at = NOW()
     WHERE ref = $1 AND status = 'PENDING'
     RETURNING ref`,
    [ref, chargeId || null]
  );
  return r.rows.length > 0;
}

module.exports = { create, get, markPaid };
