// คำสั่งซื้อที่รอชำระ (Beam) — สร้าง ref, เก็บข้อมูล, mark paid แบบ idempotent
const crypto = require('crypto');
const db = require('../db');

// ref สั้น อ่านง่ายใน dashboard: <type>_<random>
function newRef(type) {
  return `${type === 'couple' ? 'cpl' : 'sub'}_${crypto.randomBytes(8).toString('hex')}`;
}

async function create({ type, line_user_id, amount, payload, method = 'beam' }) {
  const ref = newRef(type);
  await db.query(
    `INSERT INTO payment_orders (ref, type, line_user_id, amount, payload, method)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ref, type, line_user_id, amount, payload ? JSON.stringify(payload) : null, method]
  );
  return ref;
}

async function get(ref) {
  const r = await db.query('SELECT * FROM payment_orders WHERE ref = $1', [ref]);
  return r.rows[0] || null;
}

// แนบสลิป: หา PromptPay order ที่ยังค้าง (PENDING) ล่าสุดของ user แล้วผูก messageId ของรูปสลิป
// คืน order ที่อัปเดต (ไว้ ack ลูกค้า) หรือ null ถ้าไม่มีออเดอร์ค้าง (รูปทั่วไป ไม่ใช่สลิป)
async function attachSlip(line_user_id, messageId) {
  const r = await db.query(
    `UPDATE payment_orders
     SET slip_message_id = $2, slip_received_at = NOW()
     WHERE ref = (
       SELECT ref FROM payment_orders
       WHERE line_user_id = $1 AND method = 'promptpay' AND status = 'PENDING'
       ORDER BY created_at DESC LIMIT 1
     )
     RETURNING *`,
    [line_user_id, messageId]
  );
  return r.rows[0] || null;
}

// ออเดอร์ PromptPay ที่รอ staff อนุมัติ (มี/ยังไม่มีสลิปก็แสดง — เรียงสลิปเข้าใหม่ก่อน)
async function listPendingPromptpay(limit = 50) {
  const r = await db.query(
    `SELECT ref, type, line_user_id, amount, slip_message_id,
            to_char(slip_received_at AT TIME ZONE 'Asia/Bangkok','DD/MM HH24:MI') AS slip_at,
            to_char(created_at       AT TIME ZONE 'Asia/Bangkok','DD/MM HH24:MI') AS created
     FROM payment_orders
     WHERE method = 'promptpay' AND status = 'PENDING'
     ORDER BY (slip_message_id IS NOT NULL) DESC, created_at DESC
     LIMIT $1`, [limit]);
  return r.rows;
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

module.exports = { create, get, markPaid, attachSlip, listPendingPromptpay };
