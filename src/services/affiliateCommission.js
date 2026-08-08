// Commission Ledger — ค่าคอมอินฟลูแบบ First Paid Customer (CAC ไม่ใช่ revenue share)
// สถานะ: PENDING (refund/fraud hold) → APPROVED (จ่ายได้) → PAID (จ่ายอินฟลูแล้ว) ; REVERSED = refund/ทุจริต
const db = require('../db');

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

  const hold = new Date(Date.now() + HOLD_DAYS * 86400e3).toISOString();
  const r = await db.query(
    `INSERT INTO affiliate_commissions (affiliate_code, line_user_id, order_ref, amount, hold_until)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (line_user_id) DO NOTHING
     RETURNING id, affiliate_code`,
    [code, line_user_id, orderRef || null, BASE_CPA, hold]);
  if (r.rows[0]) console.log(`[commission] +${BASE_CPA}฿ PENDING → ${code} (first paid ${line_user_id.slice(0, 10)}…)`);
  return r.rows[0] || null;                                 // null = เคยได้ค่าคอมแล้ว (dedup)
}

module.exports = {
  recordFirstPaid, bonusFor, effectiveCac, cacVerdict,
  BASE_CPA, HOLD_DAYS, BONUS_TIERS,
};
