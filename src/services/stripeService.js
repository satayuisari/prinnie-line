// Stripe payment — สร้าง Checkout session + ตรวจ webhook
// lazy init: ไม่ require key ตอนโหลดไฟล์ (กัน crash ถ้ายังไม่ตั้ง STRIPE_SECRET_KEY)

const BASE = process.env.PUBLIC_URL || 'https://prinnie-app-production.up.railway.app';
const PRICE_THB        = 399;   // สมาชิกรายเดือน
const COUPLE_PRICE_THB = 149;   // ผูกดวงคู่จ่ายครั้งเดียว (คนไม่ใช่สมาชิก)

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
    metadata: { type: 'subscription', line_user_id },
    success_url: `${BASE}/payment-success.html`,
    cancel_url:  `${BASE}/signup.html`,
  });
  return session.url;
}

// สร้าง Checkout จ่ายครั้งเดียว 149 สำหรับ "ปลดล็อกดวงคู่ 1 คู่" (คนไม่ใช่สมาชิก)
// ฝากข้อมูลคู่ไว้ใน metadata → webhook คำนวณดวงคู่ใหม่แล้ว push ผลเต็มเข้าแชท
async function createCoupleCheckout(line_user_id, partner) {
  const stripe = client();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'thb',
        product_data: { name: `Prinnie333 ผูกดวงคู่: คุณ × ${partner.partner_name || 'คู่ของคุณ'}` },
        unit_amount: COUPLE_PRICE_THB * 100,
      },
      quantity: 1,
    }],
    metadata: {
      type: 'couple',
      line_user_id,
      partner_name: (partner.partner_name || '').slice(0, 120),
      birth_date:   partner.birth_date || '',
      birth_time:   partner.birth_time || '',
      birth_place:  (partner.birth_place || '').slice(0, 200),
      lat: partner.lat != null ? String(partner.lat) : '',
      lng: partner.lng != null ? String(partner.lng) : '',
    },
    success_url: `${BASE}/payment-success.html`,
    cancel_url:  `${BASE}/signup.html?view=couple`,
  });
  return session.url;
}

// ตรวจลายเซ็น webhook + คืน event
function constructEvent(rawBody, signature) {
  const stripe = client();
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { createCheckout, createCoupleCheckout, constructEvent };
