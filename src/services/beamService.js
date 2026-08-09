// Beam Checkout — สร้าง Payment Link (PromptPay + บัตร + LINE Pay หน้าเดียว) แทน Stripe
// docs: https://docs.beamcheckout.com  (auth = HTTP Basic merchantId:apiKey)
// gated: ถ้ายังไม่ตั้ง BEAM_MERCHANT_ID + BEAM_API_KEY → isEnabled() = false (endpoint คง 410)
//
// ⚠️ หน่วยเงิน: Beam ใช้ "หน่วยย่อย" (สตางค์) เหมือน charges API (amount 300099 = 3000.99 THB)
//    → 399 บาท = 39900.  ก่อน go-live ควรยิงเทสจริง 1 บาทใน sandbox ยืนยันหน่วยก่อน

const crypto = require('crypto');

const PROD_BASE = 'https://api.beamcheckout.com';
const SANDBOX_BASE = 'https://playground.api.beamcheckout.com';

const PRICE_THB        = Number(process.env.SUB_PRICE_THB)    || 399;   // สมาชิกรายเดือน
const COUPLE_PRICE_THB = Number(process.env.COUPLE_PRICE_THB) || 199;   // ปลดล็อกดวงคู่ครั้งเดียว

function base() {
  return process.env.BEAM_ENV === 'production' ? PROD_BASE : SANDBOX_BASE;
}
function isEnabled() {
  return !!(process.env.BEAM_MERCHANT_ID && process.env.BEAM_API_KEY);
}
function authHeader() {
  const token = Buffer
    .from(`${process.env.BEAM_MERCHANT_ID}:${process.env.BEAM_API_KEY}`)
    .toString('base64');
  return `Basic ${token}`;
}
function publicBase() {
  return (process.env.PUBLIC_BASE_URL || process.env.PUBLIC_URL ||
    'https://prinnie-app-production.up.railway.app').replace(/\/$/, '');
}

// เปิด PromptPay + บัตร + ผ่อนบัตร + e-wallet + mobile banking (ปิด BNPL)
const LINK_SETTINGS = {
  card:            { isEnabled: true },
  cardInstallments:{ isEnabled: true },
  qrPromptPay:     { isEnabled: true },
  eWallets:        { isEnabled: true },   // รวม LINE Pay/TrueMoney
  mobileBanking:   { isEnabled: true },
  buyNowPayLater:  { isEnabled: false },
};

// เรียก POST /api/v1/payment-links → คืน { url, paymentLinkId }
async function createPaymentLink({ refId, amountSatang, description, redirectPath }) {
  if (!isEnabled()) throw new Error('ยังไม่ได้ตั้งค่า Beam (BEAM_MERCHANT_ID/BEAM_API_KEY)');
  const res = await fetch(`${base()}/api/v1/payment-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      order: {
        netAmount:   amountSatang,
        currency:    'THB',
        description,
        referenceId: refId,
      },
      redirectUrl: `${publicBase()}${redirectPath}`,
      linkSettings: LINK_SETTINGS,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Beam payment-link ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.url) throw new Error('Beam ไม่ได้คืน url');
  return { url: data.url, paymentLinkId: data.paymentLinkId };
}

function createSubscriptionLink(refId) {
  return createPaymentLink({
    refId,
    amountSatang: PRICE_THB * 100,
    description: 'Prinnie333 สมาชิกดูดวงรายเดือน',
    redirectPath: '/payment-success.html',
  });
}

function createCoupleLink(refId, partnerName) {
  return createPaymentLink({
    refId,
    amountSatang: COUPLE_PRICE_THB * 100,
    description: `Prinnie333 ผูกดวงคู่: คุณ × ${partnerName || 'คู่ของคุณ'}`,
    redirectPath: '/payment-success.html',
  });
}

// ตรวจ webhook signature — HMAC-SHA256 ของ raw body ด้วย BEAM_WEBHOOK_SECRET (เทียบแบบ timing-safe)
// header: X-Beam-Signature.  ⚠️ ยืนยัน scheme เป๊ะจากตัวอย่างใน Beam dashboard ก่อนเปิดใช้จริง
function verifySignature(rawBody, signature) {
  const secret = process.env.BEAM_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature).trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ยืนยันสถานะกับ Beam โดยตรง (กัน webhook ปลอม) — GET /api/v1/charges/{id}
// best-effort: คืน null ถ้าเรียกไม่ได้ (path/permission) → ให้ caller ตัดสินใจจาก signature แทน
async function getCharge(chargeId) {
  if (!isEnabled() || !chargeId) return null;
  try {
    const res = await fetch(`${base()}/api/v1/charges/${encodeURIComponent(chargeId)}`, {
      headers: { Authorization: authHeader() },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

module.exports = {
  isEnabled, createSubscriptionLink, createCoupleLink,
  verifySignature, getCharge, PRICE_THB, COUPLE_PRICE_THB,
};
