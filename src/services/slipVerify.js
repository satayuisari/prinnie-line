// ตรวจสลิปโอนเงินอัตโนมัติผ่าน SlipOK — อ่านสลิปจริง + ยืนยันว่าเงินเข้าบัญชี + ยอดถูก
// docs: https://slipok.com  · POST /api/line/apikey/{branchId}  header x-authorization: {key}
// gated: ตั้ง SLIPOK_API_KEY + SLIPOK_BRANCH_ID → isEnabled()
const sharp = require('sharp');
const jsQR = require('jsqr');

function isEnabled() {
  return !!(process.env.SLIPOK_API_KEY && process.env.SLIPOK_BRANCH_ID);
}

// ถอดรหัส QR ในรูปสลิป → คืน string ข้อมูล (ให้ SlipOK ยืนยันจาก data)
async function readSlipQR(imageBuffer) {
  const { data, info } = await sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return code ? code.data : null;
}

// ตรวจสลิปผ่าน SlipOK ด้วย "data" (ข้อมูล QR) — คืน { ok, amount, ref, dup, reason }
async function verify(imageBuffer, expectedTHB) {
  if (!isEnabled()) return { ok: false, reason: 'ยังไม่ตั้งค่า SlipOK' };
  try {
    const qr = await readSlipQR(imageBuffer);
    if (!qr) return { ok: false, reason: 'อ่าน QR ในสลิปไม่ได้ (รูปไม่ชัด/ไม่ใช่สลิป)' };
    const body = { data: qr, log: true };
    if (expectedTHB) body.amount = Number(expectedTHB);   // ให้ SlipOK เช็กยอดให้ด้วย
    const r = await fetch(`https://api.slipok.com/api/line/apikey/${process.env.SLIPOK_BRANCH_ID}`, {
      method: 'POST',
      headers: { 'x-authorization': process.env.SLIPOK_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (j.success && j.data) {
      return { ok: true, amount: Number(j.data.amount), ref: j.data.transRef || null, data: j.data };
    }
    // 1010/1012 = สลิปซ้ำ, 1013 = ยอดไม่ตรง
    return { ok: false, code: j.code, dup: j.code === 1012 || j.code === 1010, reason: j.message || `code ${j.code}` };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

module.exports = { isEnabled, verify };
