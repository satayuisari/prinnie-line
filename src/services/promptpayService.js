// PromptPay QR + slip — เก็บเงินโดยไม่ต้องผ่านการอนุมัติ gateway
// (Stripe + Beam ปฏิเสธธุรกิจดูดวง → ใช้ PromptPay โอนตรง + แนบสลิป)
//
// รองรับ 2 แบบ (ตั้งอย่างใดอย่างหนึ่ง):
//   1) PROMPTPAY_QR_PAYLOAD = สตริง QR ร้านค้าแบบ static (สแกนจาก QR ร้าน เช่น KShop/พร้อมเพย์ร้านค้า)
//      → เราแทรก "ยอดเงิน" (tag 54) ให้อัตโนมัติต่อออเดอร์ แล้วคำนวณ CRC ใหม่
//   2) PROMPTPAY_ID = เบอร์มือถือ/เลขบัตร ปชช. → สร้าง QR ส่วนบุคคลด้วย promptpay-qr
// ไม่ตั้งทั้งคู่ → isEnabled() = false (endpoint คง 410 "กำลังปรับปรุง")

const generatePayload = require('promptpay-qr');
const QRCode = require('qrcode');

const PRICE_THB        = Number(process.env.SUB_PRICE_THB)    || 399;   // สมาชิกรายเดือน
const COUPLE_PRICE_THB = Number(process.env.COUPLE_PRICE_THB) || 149;   // ปลดล็อกดวงคู่ครั้งเดียว

function isEnabled() {
  return !!(process.env.PROMPTPAY_QR_PAYLOAD || process.env.PROMPTPAY_ID);
}

// ===== EMVCo helpers (สำหรับ QR ร้านค้า static → ใส่ยอดเงิน) =====
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function parseTLV(s) {
  const out = []; let i = 0;
  while (i < s.length - 4) {
    const tag = s.substr(i, 2), len = parseInt(s.substr(i + 2, 2), 10);
    out.push({ tag, val: s.substr(i + 4, len) }); i += 4 + len;
  }
  return out;
}
const tlv = (tag, val) => tag + String(val.length).padStart(2, '0') + val;

// แทรกยอดเงินลง QR ร้านค้า static: ตั้ง tag01=12 (dynamic), ใส่ tag54=ยอด, คำนวณ CRC ใหม่
function injectAmount(staticPayload, amountTHB) {
  const items = parseTLV(staticPayload).filter(x => x.tag !== '63' && x.tag !== '54');
  for (const x of items) if (x.tag === '01') x.val = '12';
  let out = '';
  for (const x of items) {
    out += tlv(x.tag, x.val);
    if (x.tag === '53') out += tlv('54', Number(amountTHB).toFixed(2)); // ยอดเงินตามหลังสกุลเงิน
  }
  return out + '6304' + crc16(out + '6304');
}

// สร้าง payload ตามยอดเงิน (บาท)
function payload(amountTHB) {
  const merchant = process.env.PROMPTPAY_QR_PAYLOAD;
  if (merchant) return injectAmount(merchant.trim(), amountTHB);
  if (process.env.PROMPTPAY_ID) {
    return generatePayload(String(process.env.PROMPTPAY_ID).trim(), { amount: Number(amountTHB) });
  }
  throw new Error('ยังไม่ได้ตั้งค่า PromptPay (PROMPTPAY_QR_PAYLOAD หรือ PROMPTPAY_ID)');
}

async function qrPng(amountTHB, opts = {}) {
  return QRCode.toBuffer(payload(amountTHB), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: opts.width || 512,
    color: { dark: '#1B1036', light: '#FFFFFF' },
  });
}

module.exports = { isEnabled, payload, qrPng, injectAmount, crc16, PRICE_THB, COUPLE_PRICE_THB };
