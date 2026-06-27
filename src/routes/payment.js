const express     = require('express');
const router      = express.Router();
const beamService = require('../services/beamService');
const orders      = require('../services/paymentOrders');
const { requireAuth } = require('../services/lineAuth');

// สมัครสมาชิกรายเดือน 399 → สร้าง Beam payment link (PromptPay/บัตร/LINE Pay)
// ย้ายจาก Stripe (2026-06-27): Stripe TH ไม่รับธุรกิจดูดวง/โหราศาสตร์
// ถ้ายังไม่ตั้งค่า Beam → คง 410 "กำลังปรับปรุง" (กันสร้างลิงก์เสีย)
const PAYMENT_DISABLED = {
  disabled: true,
  error: 'ช่องทางชำระเงินกำลังปรับปรุง โปรดติดต่อทีมงานสักครู่นะคะ ✨',
};
router.post('/create-checkout', requireAuth, async (req, res) => {
  if (!beamService.isEnabled()) return res.status(410).json(PAYMENT_DISABLED);
  try {
    const ref = await orders.create({
      type: 'subscription',
      line_user_id: req.line.userId,
      amount: beamService.PRICE_THB * 100,
    });
    const { url } = await beamService.createSubscriptionLink(ref);
    res.json({ url });
  } catch (err) {
    console.error('[payment] create-checkout:', err.message);
    res.status(500).json({ error: 'สร้างหน้าจ่ายเงินไม่สำเร็จ ลองใหม่อีกครั้งนะคะ' });
  }
});

// หมายเหตุ: webhook การชำระเงินอยู่ที่ src/routes/beamWebhook.js (ตรวจลายเซ็น + ยืนยันกับ Beam)
// เดิมมี POST /api/payment/webhook ที่ activate จาก body ตรง ๆ ไม่ตรวจอะไร — ลบทิ้ง (ช่องโหว่)
module.exports = router;
