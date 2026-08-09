const express     = require('express');
const router      = express.Router();
const beamService = require('../services/beamService');
const promptpay   = require('../services/promptpayService');
const orders      = require('../services/paymentOrders');
const { requireAuth } = require('../services/lineAuth');

// ── ช่องทางชำระเงิน ──
// PromptPay โอนตรง + แนบสลิป (ปัจจุบัน): Stripe + Beam ปฏิเสธธุรกิจดูดวง → ไม่ต้องผ่านอนุมัติ gateway
// Beam (สำรอง/ปิดอยู่): โค้ดยังอยู่ครบ ถ้าวันหน้าได้รับอนุมัติค่อยเปิด
// ถ้ายังไม่ตั้งช่องทางไหนเลย → 410 "กำลังปรับปรุง" (กันสร้างลิงก์เสีย)
const PAYMENT_DISABLED = {
  disabled: true,
  error: 'ช่องทางชำระเงินกำลังปรับปรุง โปรดติดต่อทีมงานสักครู่นะคะ ✨',
};

function publicBase() {
  return (process.env.PUBLIC_BASE_URL || process.env.PUBLIC_URL ||
    'https://prinnie-app-production.up.railway.app').replace(/\/$/, '');
}

// สมัครสมาชิกรายเดือน 399 → สร้างออเดอร์ PromptPay แล้วส่ง url ไปหน้า QR (pay.html)
// ลูกค้าโอนแล้วส่งสลิปเข้าแชท → staff อนุมัติบน dashboard → activate
router.post('/create-promptpay', requireAuth, async (req, res) => {
  if (!promptpay.isEnabled()) return res.status(410).json(PAYMENT_DISABLED);
  try {
    const ref = await orders.create({
      type: 'subscription',
      line_user_id: req.line.userId,
      amount: promptpay.PRICE_THB * 100,   // เก็บเป็นสตางค์ ให้สอดคล้องกับ Beam
      method: 'promptpay',
    });
    res.json({ url: `${publicBase()}/pay.html?ref=${ref}` });
  } catch (err) {
    console.error('[payment] create-promptpay:', err.message);
    res.status(500).json({ error: 'สร้างคำสั่งซื้อไม่สำเร็จ ลองใหม่อีกครั้งนะคะ' });
  }
});

// ข้อมูลออเดอร์สำหรับหน้า pay.html (ref = โทเคนสุ่ม ทำหน้าที่เป็น capability — ไม่คืนข้อมูลส่วนตัว)
router.get('/order/:ref', async (req, res) => {
  const o = await orders.get(req.params.ref);
  if (!o) return res.status(404).json({ error: 'not_found' });
  res.json({ ref: o.ref, amount: o.amount, price_thb: o.amount / 100, status: o.status, type: o.type });
});

// QR PromptPay ของออเดอร์ (จำนวนเงินฝังในคิวอาร์ → ลูกค้าสแกนแล้วยอดขึ้นเอง)
router.get('/promptpay-qr/:ref', async (req, res) => {
  if (!promptpay.isEnabled()) return res.status(410).json(PAYMENT_DISABLED);
  try {
    const o = await orders.get(req.params.ref);
    if (!o) return res.status(404).json({ error: 'not_found' });
    const png = await promptpay.qrPng(o.amount / 100);
    res.set('Content-Type', 'image/png').set('Cache-Control', 'no-store').send(png);
  } catch (err) {
    console.error('[payment] promptpay-qr:', err.message);
    res.status(500).json({ error: 'สร้าง QR ไม่สำเร็จ' });
  }
});

// ── Beam (สำรอง) — เปิดเมื่อ beamService.isEnabled() เท่านั้น ──
router.post('/create-checkout', requireAuth, async (req, res) => {
  if (!beamService.isEnabled()) return res.status(410).json(PAYMENT_DISABLED);
  try {
    const ref = await orders.create({
      type: 'subscription',
      line_user_id: req.line.userId,
      amount: beamService.PRICE_THB * 100,
      method: 'beam',
    });
    const { url } = await beamService.createSubscriptionLink(ref);
    res.json({ url });
  } catch (err) {
    console.error('[payment] create-checkout:', err.message);
    res.status(500).json({ error: 'สร้างหน้าจ่ายเงินไม่สำเร็จ ลองใหม่อีกครั้งนะคะ' });
  }
});

// หมายเหตุ: webhook การชำระเงิน (Beam) อยู่ที่ src/routes/beamWebhook.js (ตรวจลายเซ็น)
//   PromptPay ไม่มี webhook — ยืนยันด้วยสลิป + staff อนุมัติบน dashboard
module.exports = router;
