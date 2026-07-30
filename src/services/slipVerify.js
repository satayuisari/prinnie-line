// ตรวจสลิปโอนเงินอัตโนมัติผ่าน SlipOK — อ่านสลิปจริง + ยืนยันว่าเงินเข้าบัญชี + ยอดถูก
// docs: https://slipok.com  · POST /api/line/apikey/{branchId}  header x-authorization: {key}
// gated: ตั้ง SLIPOK_API_KEY + SLIPOK_BRANCH_ID → isEnabled()
const sharp = require('sharp');
const jsQR = require('jsqr');

function isEnabled() {
  return !!(process.env.SLIPOK_API_KEY && process.env.SLIPOK_BRANCH_ID);
}

// ถอดรหัส QR ในรูปสลิป → คืน string ข้อมูล (ให้ SlipOK ยืนยันจาก data)
// jsQR อ่านพลาดบ่อยกับสลิปจริง (QR เล็ก/เบลอ/สกรีนช็อตย่อ) → ต้นตอ auto-check ไม่ผ่าน ~29%
// ลองหลายวิธี: ขนาดเดิม → ขยาย 2 เท่า → เพิ่มคอนทราสต์ขาวดำ ก่อนยอมแพ้ (เพิ่มอัตราอ่านสำเร็จ)
async function decodeAt(pipeline) {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return code ? code.data : null;
}
async function readSlipQR(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata().catch(() => ({}));
  const w = meta.width || 0;
  const attempts = [
    sharp(imageBuffer),                                              // ต้นฉบับ
    sharp(imageBuffer).resize({ width: Math.max(w * 2, 1200) }),     // ขยายให้ QR ใหญ่ขึ้น
    sharp(imageBuffer).resize({ width: Math.max(w * 2, 1200) }).grayscale().normalise(),  // ขาวดำ+ยืดคอนทราสต์
  ];
  for (const p of attempts) {
    try { const s = await decodeAt(p); if (s) return s; } catch (_) { /* ลองอันถัดไป */ }
  }
  return null;
}

// ตรวจสลิปผ่าน SlipOK ด้วย "data" (ข้อมูล QR) — คืน { ok, amount, ref, dup, reason }
async function verify(imageBuffer, expectedTHB) {
  if (!isEnabled()) return { ok: false, reason: 'ยังไม่ตั้งค่า SlipOK' };
  try {
    const qr = await readSlipQR(imageBuffer);
    // qrReadable=false → รูปนี้ไม่มี QR สลิปที่อ่านออก (รูปมั่ว/ไม่ใช่สลิป/เบลอมาก)
    // ใช้แยก "รูปมั่ว" (ไม่ต้องกวนแอดมิน บอกลูกค้าส่งใหม่) ออกจาก "สลิปจริงมีปัญหา"
    if (!qr) return { ok: false, qrReadable: false, reason: 'อ่าน QR ในสลิปไม่ได้ (รูปไม่ชัด/ไม่ใช่สลิป)' };
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
