const express     = require('express');
const router      = express.Router();
const promptpay   = require('../services/promptpayService');
const orders      = require('../services/paymentOrders');
const { requireAuth } = require('../services/lineAuth');

// ── ช่องทางชำระเงิน: PromptPay โอนตรง + แนบสลิป (ช่องทางเดียว) ──
// Stripe/Beam ปฏิเสธธุรกิจดูดวง → เลิกใช้และถอดโค้ดออกแล้ว (ออเดอร์จริงเป็น promptpay 100%)
// ถ้ายังไม่ตั้ง PROMPTPAY_QR_PAYLOAD → 410 "กำลังปรับปรุง" (กันสร้างลิงก์เสีย)
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
      amount: promptpay.PRICE_THB * 100,   // เก็บเป็นสตางค์ (payment_orders.amount เป็นสตางค์เสมอ)
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

// หมายเหตุ: PromptPay ไม่มี webhook — ยืนยันด้วยสลิป (SlipOK อ่านอัตโนมัติ) + staff อนุมัติบน dashboard
module.exports = router;
