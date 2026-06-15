const express       = require('express');
const router        = express.Router();
const subscribers   = require('../services/subscriberService');
const lineMessaging = require('../services/lineMessaging');
const stripeService = require('../services/stripeService');
const { requireAuth } = require('../services/lineAuth');

// POST /api/payment/create-checkout — สร้างหน้าจ่ายเงิน Stripe (userId จาก token)
router.post('/create-checkout', requireAuth, async (req, res) => {
  try {
    const url = await stripeService.createCheckout(req.line.userId);
    res.json({ url });
  } catch (err) {
    console.error('[create-checkout]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payment/webhook
// Payment gateway เรียกเมื่อจ่ายสำเร็จ → activate +30 วัน
router.post('/webhook', async (req, res) => {
  res.json({ received: true }); // ตอบทันที กัน gateway retry

  const { line_user_id, payment_ref, status } = req.body;
  if (status !== 'SUCCESS') return;

  try {
    const result = await subscribers.activateSubscription(line_user_id, payment_ref, 30);

    const expireTH = new Date(result.expire_date).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    await lineMessaging.pushText(
      line_user_id,
      `ยินดีต้อนรับสู่ Prinnie333! ✨\n\nสมาชิกภาพของคุณเริ่มแล้ว\nสิ้นสุด: ${expireTH}\n\nคุณจะได้รับดวงประจำวันทุกเช้า 08:00 น. 🌟`
    );
    console.log(`[payment] activated ${line_user_id} until ${result.expire_date}`);
  } catch (err) {
    console.error('[payment] webhook error:', err.message);
  }
});

module.exports = router;
