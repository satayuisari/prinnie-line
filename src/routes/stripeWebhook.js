// Stripe webhook — รับ event ตอนจ่ายเงินสำเร็จ → activate สมาชิก
// ต้องใช้ raw body (ตรวจลายเซ็น) → register ก่อน bodyParser.json() ใน index.js

const express       = require('express');
const stripeService = require('../services/stripeService');
const subscribers   = require('../services/subscriberService');
const lineMessaging = require('../services/lineMessaging');

function register(app) {
  app.post('/api/payment/stripe-webhook', express.raw({ type: '*/*' }), async (req, res) => {
    let event;
    try {
      event = stripeService.constructEvent(req.body, req.headers['stripe-signature']);
    } catch (e) {
      console.error('[stripe] bad signature:', e.message);
      return res.status(400).send('bad signature');
    }
    res.json({ received: true });

    if (event.type === 'checkout.session.completed') {
      const session    = event.data.object;
      const lineUserId = session.metadata && session.metadata.line_user_id;
      if (!lineUserId) return;
      try {
        const r = await subscribers.activateSubscription(lineUserId, session.id, 30);
        const expTH = new Date(r.expire_date).toLocaleDateString('th-TH', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
        await lineMessaging.pushText(lineUserId,
          `ชำระเงินสำเร็จ! ✨\n\nสมาชิก Prinnie333 ของคุณใช้ได้ถึง ${expTH}\nรับดวงประจำวันทุกเช้า 08:00 น. 🌟`);
        console.log(`[stripe] activated ${lineUserId} until ${r.expire_date}`);
      } catch (err) {
        console.error('[stripe] activate error:', err.message);
      }
    }
  });
}

module.exports = { register };
