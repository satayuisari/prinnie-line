// Stripe payment — สร้าง Checkout session + ตรวจ webhook
// lazy init: ไม่ require key ตอนโหลดไฟล์ (กัน crash ถ้ายังไม่ตั้ง STRIPE_SECRET_KEY)

const BASE = process.env.PUBLIC_URL || 'https://prinnie-app-production.up.railway.app';
const PRICE_THB = 399;

function client() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('ยังไม่ได้ตั้ง STRIPE_SECRET_KEY');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// สร้าง Checkout session (จ่ายครั้งเดียว 399 บาท) → คืน URL
async function createCheckout(line_user_id) {
  const stripe = client();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'thb',
        product_data: { name: 'Prinnie333 สมาชิกดูดวงรายเดือน' },
        unit_amount: PRICE_THB * 100,   // satang (399.00 = 39900)
      },
      quantity: 1,
    }],
    metadata: { line_user_id },
    success_url: `${BASE}/payment-success.html`,
    cancel_url:  `${BASE}/signup.html`,
  });
  return session.url;
}

// ตรวจลายเซ็น webhook + คืน event
function constructEvent(rawBody, signature) {
  const stripe = client();
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { createCheckout, constructEvent };
