'use strict';
/**
 * prinnieServices.js — Adapter ไปยังโค้ดจริงใน prinnie-line (จุดต่อเดียว)
 * -----------------------------------------------------------------------------
 * โหมดการทำงาน (auto):
 *   - ถ้า require service จริงได้  → ใช้ของจริง (โหมด LIVE)
 *   - ถ้า require ไม่ได้           → ตกมาที่ stub (โหมด STUB) เพื่อทดสอบ flow
 * ตั้ง path ของ service จริงผ่าน env (ดู SERVICE_PATHS) หรือแก้ค่า default ด้านล่าง
 *
 * Stripe secret / DATABASE_URL ถูกใช้ "ที่นี่" เท่านั้น (ฝั่ง orchestrator) ไม่เข้า container ของ agent
 *
 * ── Signature ที่ adapter คาดหวังจาก service จริง (ปรับ map ให้ตรงโค้ดคุณได้) ──
 *   memberService.getMemberStatus(lineUserId)          -> {status, plan, birth_date, birth_time, place, expires_at}
 *   memberService.activateSubscription(lineUserId, days, {reason}) -> {activated, new_expiry}
 *   stripeService.findPayment({lineUserId, email})      -> {paid, amount, currency, type, charge_id, status, created}
 *   stripeService.refund(paymentRef, amount)            -> {refunded, refund_id, amount}
 *   astroService.getChart(lineUserId)                   -> {sun, moon, rising, birth_time_known, transits[]}
 *   astroService.computeNatalChart(lineUserId)          -> {sun, moon, rising}
 *   astroService.dailyReading(lineUserId)               -> ส่ง push (return ใด ๆ)
 *   lineService.pushLiff(lineUserId, view)              -> {url}  (หรือ build url เองแล้ว push)
 */

// แก้ path ให้ตรง repo จริงได้ที่นี่ หรือ override ด้วย env SERVICE_*_PATH
const SERVICE_PATHS = {
  member: process.env.MEMBER_SERVICE_PATH || '../../../src/services/memberService',
  stripe: process.env.STRIPE_SERVICE_PATH || '../../../src/services/stripeService',
  astro:  process.env.ASTRO_SERVICE_PATH  || '../../../src/services/astroService',
  line:   process.env.LINE_SERVICE_PATH   || '../../../src/services/lineService',
};

function tryRequire(p) {
  try { return require(p); }
  catch { return null; }
}

const member = tryRequire(SERVICE_PATHS.member);
const stripe = tryRequire(SERVICE_PATHS.stripe);
const astro  = tryRequire(SERVICE_PATHS.astro);
const line   = tryRequire(SERVICE_PATHS.line);

const LIVE = !!(member && stripe && astro);
console.log(`[prinnieServices] โหมด: ${LIVE ? 'LIVE (ต่อ service จริง)' : 'STUB (ยังไม่เจอ service — ใช้ข้อมูลตัวอย่าง)'}`);
if (!LIVE) {
  const missing = Object.entries({ member, stripe, astro, line })
    .filter(([, m]) => !m).map(([k]) => k);
  console.log(`[prinnieServices] ยังไม่เจอ: ${missing.join(', ')} → แก้ SERVICE_PATHS หรือ mount repo root`);
}

const PLAN_DAYS = { '399': 30, '149': 30 }; // ปรับตาม business rule จริง

// helper: เลือก method แรกที่ service จริงมี (รองรับชื่อ method ที่อาจต่างกัน)
const pick = (obj, ...names) => names.map((n) => obj && obj[n]).find((f) => typeof f === 'function');

module.exports = {
  LIVE,
  PLAN_DAYS,

  async getMemberStatus(lineUserId) {
    const fn = pick(member, 'getMemberStatus');
    if (fn) return fn(lineUserId);
    return { status: 'PENDING', plan: '399', birth_date: '1995-08-21', birth_time: '14:30', place: 'Bangkok, TH', expires_at: null }; // STUB
  },

  async getStripePayment({ lineUserId, email }) {
    const fn = pick(stripe, 'findPayment', 'getPaymentStatus', 'findCharge');
    if (fn) return fn({ lineUserId, email });
    return { paid: true, amount: 399, currency: 'thb', type: '399', charge_id: 'ch_demo_123', status: 'succeeded', created: new Date().toISOString() }; // STUB
  },

  async getUserChart(lineUserId) {
    const fn = pick(astro, 'getChart', 'getUserChart');
    if (fn) return fn(lineUserId);
    return { sun: 'Leo', moon: 'Pisces', rising: 'Scorpio', birth_time_known: true, transits: [{ planet: 'Jupiter', aspect: 'trine', natal: 'Sun', window: '2026-06 ถึง 2026-08' }] }; // STUB
  },

  async activateSubscription(lineUserId, days, reason) {
    const fn = pick(member, 'activateSubscription');
    if (fn) return fn(lineUserId, days, { reason });
    return { activated: true, new_expiry: new Date(Date.now() + days * 864e5).toISOString() }; // STUB
  },

  async refund(paymentRef, amount, reason) {
    const fn = pick(stripe, 'refund', 'issueRefund');
    if (fn) return fn(paymentRef, amount, reason);
    return { refunded: true, refund_id: 're_demo_123', amount }; // STUB
  },

  async recomputeChart(lineUserId) {
    const fn = pick(astro, 'computeNatalChart', 'recomputeChart');
    if (fn) return fn(lineUserId);
    return { sun: 'Leo', moon: 'Pisces', rising: 'Scorpio', recomputed_at: new Date().toISOString() }; // STUB
  },

  async resendDaily(lineUserId) {
    const fn = pick(astro, 'dailyReading', 'resendDaily');
    if (fn) { await fn(lineUserId); return { sent: true }; }
    return { sent: true }; // STUB
  },

  async sendLiff(lineUserId, view) {
    const fn = pick(line, 'pushLiff', 'sendLiff');
    if (fn) { const r = await fn(lineUserId, view); return { sent: true, url: r?.url }; }
    return { sent: true, url: `https://liff.line.me/DEMO?view=${encodeURIComponent(view || 'signup')}` }; // STUB
  },
};
