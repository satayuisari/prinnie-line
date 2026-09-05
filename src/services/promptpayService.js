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
const COUPLE_PRICE_THB = Number(process.env.COUPLE_PRICE_THB) || 199;   // ปลดล็อกดวงคู่ครั้งเดียว

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

// ผู้รับเงินในรูปแบบ "พิมพ์เองได้" — สำหรับลูกค้าที่สแกน QR ไม่ผ่าน
//
// ⚠️ ทำไมต้องมี: ลูกค้าทักเข้ามาซ้ำ ๆ ว่า "จ่ายเงินไม่ได้" / "แสกนจ่ายไม่ได้เลยค่ะ" /
//    "ดำเนินการจ่ายไม่ได้" และมีคนบอกสาเหตุตรง ๆ ว่า "เวลาจะจ่ายด้วย QR code
//    มันจะขึ้นว่าให้จ่ายด้วย K point" (K PLUS อ่าน QR ร้านค้าแล้วเด้งไปเมนูแต้ม)
//    เดิมหน้าจ่ายเงินมีทางเดียวคือสแกน QR → คนกลุ่มนี้จ่ายไม่ได้เลย
//
// ตัวเลขที่คืนไปเป็นข้อมูลเดียวกับที่ฝังใน QR อยู่แล้ว (ไม่ได้เปิดเผยอะไรเพิ่ม)
// QR ร้านค้า static: ถอดเบอร์/เลขบัตรจาก tag 29 (00=AID, 01=เบอร์, 02=เลขบัตร, 03=e-wallet)
function recipient() {
  const name = (process.env.PROMPTPAY_NAME || '').trim() || null;
  const id = (process.env.PROMPTPAY_ID || '').trim();
  if (id) return { target: formatTarget(id), name };

  const merchant = (process.env.PROMPTPAY_QR_PAYLOAD || '').trim();
  if (!merchant) return { target: null, name };
  const acc = parseTLV(merchant).find(x => x.tag === '29');
  if (!acc) return { target: null, name };
  const sub = parseTLV(acc.val).find(x => x.tag === '01' || x.tag === '02' || x.tag === '03');
  return { target: sub ? formatTarget(sub.val) : null, name };
}

// เบอร์ในมาตรฐาน PromptPay เก็บเป็น 0066xxxxxxxxx → คืนรูปแบบที่คนไทยพิมพ์ตาม 08x-xxx-xxxx
function formatTarget(raw) {
  const d = String(raw).replace(/\D/g, '');
  const local = d.startsWith('0066') ? '0' + d.slice(4) : d.startsWith('66') && d.length === 11 ? '0' + d.slice(2) : d;
  if (local.length === 10 && local.startsWith('0')) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  if (local.length === 13) return `${local.slice(0, 1)}-${local.slice(1, 5)}-${local.slice(5, 10)}-${local.slice(10, 12)}-${local.slice(12)}`;
  return local;
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

module.exports = {
  isEnabled, payload, qrPng, injectAmount, crc16, recipient, PRICE_THB, COUPLE_PRICE_THB,
};
