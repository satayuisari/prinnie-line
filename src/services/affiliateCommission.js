// Commission Ledger — ค่าคอมอินฟลูแบบ First Paid Customer (CAC ไม่ใช่ revenue share)
// สถานะ: PENDING (refund/fraud hold) → APPROVED (จ่ายได้) → PAID (จ่ายอินฟลูแล้ว) ; REVERSED = refund/ทุจริต
const db = require('../db');
const audit = require('./affiliateAudit');

const BASE_CPA  = Number(process.env.AFFILIATE_CPA)       || 50;  // ค่าคอมฐานต่อลูกค้าใหม่ที่จ่ายจริงครั้งแรก
const HOLD_DAYS = Number(process.env.AFFILIATE_HOLD_DAYS) || 7;   // กันช่วง refund/fraud ก่อนอนุมัติจ่าย

// โบนัสสะสมตามจำนวนลูกค้าจ่ายจริง (คุมต้นทุนไม่ให้ CAC พุ่งเกิน 100) — เรียงมาก→น้อย
const BONUS_TIERS = [ { at: 50, bonus: 1500 }, { at: 20, bonus: 500 } ];
function bonusFor(paidCount) {
  return BONUS_TIERS.reduce((sum, t) => sum + (paidCount >= t.at ? t.bonus : 0), 0);
}
// Effective CAC = (ฐาน + โบนัส) / จำนวนลูกค้าจ่าย
function effectiveCac(paidCount) {
  if (!paidCount) return 0;
  return Math.round((paidCount * BASE_CPA + bonusFor(paidCount)) / paidCount);
}
// เกณฑ์ตัดสิน: ≤75 ดี · 76–100 ดู retention · >100 ไม่ scale
function cacVerdict(cac) {
  if (!cac)        return { label: '—',            color: '#8a8a8a' };
  if (cac <= 75)   return { label: 'ดี',           color: '#5CE6A1' };
  if (cac <= 100)  return { label: 'ดู retention', color: '#F0C868' };
  return             { label: 'ไม่ scale',        color: '#e0457b' };
}

// บันทึกค่าคอมตอน "จ่ายจริงครั้งแรก" ของลูกค้า (subscription เท่านั้น) — idempotent
// คืน row ที่สร้าง หรือ null ถ้า: ไม่มี affiliate / ไม่ใช่ first paid (renew) / เคยได้ค่าคอมแล้ว
async function recordFirstPaid(line_user_id, orderRef) {
  const sub = (await db.query(
    'SELECT affiliate_code FROM line_subscribers WHERE line_user_id=$1', [line_user_id])).rows[0];
  const code = sub && sub.affiliate_code;
  if (!code) return null;                                   // ไม่มี attribution → ไม่มีค่าคอม
  const aff = (await db.query('SELECT 1 FROM affiliates WHERE code=$1', [code])).rows[0];
  if (!aff) return null;                                    // รหัสไม่มีในตาราง (กันขยะ)

  // ต้องเป็น subscription order ที่ PAID "ครั้งแรก" ของลูกค้า — renew (จ่ายมาก่อน) ไม่นับ
  const paid = Number((await db.query(
    "SELECT COUNT(*)::int n FROM payment_orders WHERE line_user_id=$1 AND type='subscription' AND status='PAID'",
    [line_user_id])).rows[0].n);
  if (paid > 1) return null;                                // จ่าย subscription มาก่อนแล้ว = renew

  // รายได้จริงของออเดอร์ที่ทำให้เกิดค่าคอม — payment_orders.amount เป็น "สตางค์" → เก็บเป็นบาท
  // (ให้หน่วยตรงกับ amount ค่าคอม จะได้ไม่มีทางเผลอบวกสตางค์กับบาทในรายงาน)
  const rev = orderRef
    ? Number((await db.query('SELECT amount FROM payment_orders WHERE ref=$1', [orderRef])).rows[0]?.amount || 0)
    : 0;

  const hold = new Date(Date.now() + HOLD_DAYS * 86400e3).toISOString();
  // ON CONFLICT (line_user_id) = ด่านสุดท้ายระดับ DB: webhook ซ้ำ/สลิปซ้ำ/retry กี่รอบ
  // ก็ได้ค่าคอมใบเดียวตลอดกาล — ไม่พึ่งโค้ดแอปอย่างเดียว
  const r = await db.query(
    `INSERT INTO affiliate_commissions (affiliate_code, line_user_id, order_ref, amount, revenue_amount, hold_until)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (line_user_id) DO NOTHING
     RETURNING id, affiliate_code`,
    [code, line_user_id, orderRef || null, BASE_CPA, Math.round(rev / 100), hold]);
  if (r.rows[0]) {
    console.log(`[commission] +${BASE_CPA}฿ PENDING → ${code} (first paid ${line_user_id.slice(0, 10)}…)`);
    await audit.log('FIRST_PAYMENT_ATTRIBUTED', { actor: 'system', entityType: 'affiliate', entityId: code,
      newValue: `order ${orderRef || '-'} · รายได้ ${Math.round(rev / 100)}฿` });
    await audit.log('COMMISSION_CREATED', { actor: 'system', entityType: 'commission', entityId: r.rows[0].id,
      newValue: `PENDING ${BASE_CPA}฿ → ${code}` });
  }
  return r.rows[0] || null;                                 // null = เคยได้ค่าคอมแล้ว (dedup)
}

// ── การเปลี่ยนสถานะเงิน (ใช้ร่วมกันทั้งแดชบอร์ดและ CLI — ทุกทางต้องลง audit) ──

// PENDING → APPROVED (อนุมัติจ่ายได้) · id เดียว หรือ 'due' = ทุกใบที่พ้น hold แล้ว
async function approve(idOrDue, { actor = 'admin' } = {}) {
  const due = idOrDue === 'due';
  const r = await db.query(
    `UPDATE affiliate_commissions SET status='APPROVED', approved_at=NOW()
     WHERE status='PENDING' AND ${due ? 'hold_until <= NOW()' : 'id=$1'} RETURNING id, affiliate_code, amount`,
    due ? [] : [Number(idOrDue)]);
  for (const row of r.rows) {
    await audit.log('COMMISSION_APPROVED', { actor, entityType: 'commission', entityId: row.id,
      oldValue: 'PENDING', newValue: 'APPROVED', reason: due ? 'พ้น hold แล้ว' : null });
  }
  return r.rows;
}

// APPROVED → PAID (Bon โอนให้อินฟลูเองแล้วมากดบันทึก) — V1 ไม่มีโอนอัตโนมัติ
// รับได้ทั้ง id ใบเดียว หรือ {code} = จ่ายรวดเดียวทั้งอินฟลูคนนั้น
async function markPaid({ id, code, actor = 'admin' } = {}) {
  const r = await db.query(
    `UPDATE affiliate_commissions SET status='PAID', paid_at=NOW()
     WHERE status='APPROVED' AND ${id ? 'id=$1' : 'affiliate_code=$1'} RETURNING id, affiliate_code, amount`,
    [id ? Number(id) : code]);
  for (const row of r.rows) {
    await audit.log('COMMISSION_PAID', { actor, entityType: 'commission', entityId: row.id,
      oldValue: 'APPROVED', newValue: 'PAID', reason: `จ่าย ${row.amount}฿ ให้ ${row.affiliate_code}` });
  }
  return r.rows;
}

// REVERSED — ลูกค้า refund/ทุจริต · ต้องมีเหตุผลเสมอ
// ใบที่ PAID ไปแล้ว: ห้ามแก้ประวัติการเงินเงียบ ๆ → ตั้งธง needs_review ให้แอดมินตัดสินแทน
async function reverse(id, reason, { actor = 'admin' } = {}) {
  reason = (reason || '').trim();
  if (!reason) throw new Error('ต้องระบุเหตุผลในการตัดค่าคอม');
  const cur = (await db.query('SELECT id, status, affiliate_code FROM affiliate_commissions WHERE id=$1',
    [Number(id)])).rows[0];
  if (!cur) return { ok: false, reason: 'not_found' };

  if (cur.status === 'PAID') {
    await db.query('UPDATE affiliate_commissions SET needs_review=TRUE, reason=$2 WHERE id=$1', [cur.id, reason]);
    await audit.log('COMMISSION_REVIEW_FLAGGED', { actor, entityType: 'commission', entityId: cur.id,
      oldValue: 'PAID', newValue: 'PAID (รอแอดมินตรวจ)', reason });
    return { ok: false, flagged: true, reason: 'จ่ายอินฟลูไปแล้ว — ตั้งธงรอตรวจสอบแทน ไม่ลบประวัติ' };
  }
  if (cur.status === 'REVERSED') return { ok: false, reason: 'ตัดไปแล้ว' };

  await db.query(
    `UPDATE affiliate_commissions SET status='REVERSED', reversed_at=NOW(), reason=$2 WHERE id=$1`,
    [cur.id, reason]);
  await audit.log('COMMISSION_REVERSED', { actor, entityType: 'commission', entityId: cur.id,
    oldValue: cur.status, newValue: 'REVERSED', reason });
  return { ok: true, id: cur.id, from: cur.status };
}

// refund ของออเดอร์ → หาค่าคอมที่ผูกกับออเดอร์นั้นแล้วตัด (ใช้ตอนคืนเงินลูกค้า)
async function reverseForOrder(orderRef, reason, opts = {}) {
  const row = (await db.query('SELECT id FROM affiliate_commissions WHERE order_ref=$1', [orderRef])).rows[0];
  if (!row) return { ok: false, reason: 'ไม่มีค่าคอมผูกกับออเดอร์นี้' };
  return reverse(row.id, reason, opts);
}

// ยอดรวมทั้งระบบ — อ่านจากตารางค่าคอมล้วน ๆ ไม่ join อะไรเลย (กัน SUM พอง)
async function totals() {
  const t = (await db.query(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE status='PENDING'),0)::int  pending,
      COALESCE(SUM(amount) FILTER (WHERE status='APPROVED'),0)::int approved,
      COALESCE(SUM(amount) FILTER (WHERE status='PAID'),0)::int     paid,
      COALESCE(SUM(amount) FILTER (WHERE status='REVERSED'),0)::int reversed,
      COUNT(*) FILTER (WHERE status='PENDING')::int  pending_n,
      COUNT(*) FILTER (WHERE status='APPROVED')::int approved_n,
      COUNT(*) FILTER (WHERE status='PAID')::int     paid_n,
      COUNT(*) FILTER (WHERE status='REVERSED')::int reversed_n,
      COUNT(*) FILTER (WHERE needs_review)::int      review_n
    FROM affiliate_commissions`)).rows[0];
  return t;
}

// รายการค่าคอมทีละใบ (ตารางในแดชบอร์ด / CLI ledger)
async function list({ code = null, status = null, limit = 200 } = {}) {
  const where = [];
  const params = [];
  if (code)   { params.push(code);   where.push(`c.affiliate_code=$${params.length}`); }
  if (status) { params.push(status); where.push(`c.status=$${params.length}`); }
  params.push(limit);
  return (await db.query(
    `SELECT c.id, c.affiliate_code, a.name affiliate_name, c.line_user_id, c.order_ref,
            c.revenue_amount, c.amount, c.status, c.reason, c.needs_review,
            to_char(c.created_at,'MM-DD HH24:MI')  created,
            to_char(c.hold_until,'MM-DD')          hold,
            to_char(c.approved_at,'MM-DD HH24:MI') approved,
            to_char(c.paid_at,'MM-DD HH24:MI')     paid_on,
            to_char(c.reversed_at,'MM-DD HH24:MI') reversed_on
     FROM affiliate_commissions c
     LEFT JOIN affiliates a ON a.code=c.affiliate_code
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY c.id DESC LIMIT $${params.length}`, params)).rows;
}

module.exports = {
  recordFirstPaid, approve, markPaid, reverse, reverseForOrder, totals, list,
  bonusFor, effectiveCac, cacVerdict,
  BASE_CPA, HOLD_DAYS, BONUS_TIERS,
};
