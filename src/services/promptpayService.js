// PromptPay QR + slip — ทางเลือกเก็บเงินที่ "ไม่ต้องผ่านการอนุมัติ gateway"
// (Stripe + Beam ปฏิเสธธุรกิจดูดวง/โหราศาสตร์ → ใช้ PromptPay โอนตรง + แนบสลิป)
//
// gated: ตั้ง PROMPTPAY_ID (เบอร์มือถือ / เลขบัตร ปชช. / เลข e-wallet) → isEnabled() = true
//   ไม่ตั้ง → endpoint คง 410 "กำลังปรับปรุง" เหมือน Beam
//
// QR payload = มาตรฐาน EMVCo ของ PromptPay (สร้างผ่าน promptpay-qr) แล้ว render PNG ด้วย qrcode

const generatePayload = require('promptpay-qr');
const QRCode = require('qrcode');

const PRICE_THB        = Number(process.env.SUB_PRICE_THB)    || 399;   // สมาชิกรายเดือน
const COUPLE_PRICE_THB = Number(process.env.COUPLE_PRICE_THB) || 149;   // ปลดล็อกดวงคู่ครั้งเดียว

function isEnabled() {
  return !!process.env.PROMPTPAY_ID;
}

// promptpay-qr รับเบอร์/เลขบัตร (มี - หรือเว้นวรรคได้) + จำนวนเงิน "หน่วยบาท" (ทศนิยมได้)
function payload(amountTHB) {
  if (!isEnabled()) throw new Error('ยังไม่ได้ตั้งค่า PromptPay (PROMPTPAY_ID)');
  const id = String(process.env.PROMPTPAY_ID).trim();
  return generatePayload(id, { amount: Number(amountTHB) });
}

// คืน PNG buffer ของ QR (สำหรับ stream ออก route หรือฝังหน้า pay)
async function qrPng(amountTHB, opts = {}) {
  return QRCode.toBuffer(payload(amountTHB), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: opts.width || 512,
    color: { dark: '#1B1036', light: '#FFFFFF' },
  });
}

module.exports = { isEnabled, payload, qrPng, PRICE_THB, COUPLE_PRICE_THB };
