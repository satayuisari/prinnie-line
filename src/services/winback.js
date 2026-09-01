// ชวนสมาชิกเก่าที่หมดอายุกลับมา — กลุ่มเป้าหมาย + ข้อความ อยู่ที่นี่ที่เดียว
// ใช้ร่วมกันทั้ง scripts/winback.js (ยิงมือ) และ scheduler/winbackBlast.js (ยิงตามเวลา)
const db = require('../db');

const liffPayUrl = () => (process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}?view=pay`
  : 'https://liff.line.me/YOUR_LIFF_ID?view=pay');

// เป้าหมาย: เคยจ่ายจริง + มีดวงแล้ว + หมดอายุแล้ว (ไม่รวมบัญชีทดลอง/แจกฟรี)
const AUDIENCE_SQL = `
  SELECT line_user_id,
         COALESCE(NULLIF(nickname,''), display_name) AS name,
         to_char(subscribe_end, 'DD/MM') AS ended
  FROM line_subscribers
  WHERE payment_ref IS NOT NULL
    AND payment_ref NOT IN ('tester','free-trial','free','founder','LIFETIME_COMP')
    AND chart_data IS NOT NULL
    AND (subscribe_end IS NULL OR subscribe_end <= NOW())
  ORDER BY subscribe_end DESC NULLS LAST`;

async function audience() {
  return (await db.query(AUDIENCE_SQL)).rows;
}

// ชื่อ LINE มีอักขระตกแต่งเยอะ (• ✦ อิโมจิ) ถ้าต่อท้าย "คุณ" ตรง ๆ จะได้ "คุณ• Nanear •"
// ตัดหัวท้ายที่ไม่ใช่ตัวอักษร/ตัวเลขออก เหลือสั้นเกินไปก็ไม่เรียกชื่อ (เช่น "🍀")
function cleanName(raw) {
  const s = String(raw || '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .trim();
  return s.length >= 2 ? s : null;
}

function buildMessage(rawName, ended) {
  const name = cleanName(rawName);
  return [
    `${name ? 'คุณ' + name + ' คะ 🌙' : 'สวัสดีค่ะ 🌙'}`,
    ``,
    `ดวงรายวันส่วนตัวของคุณหยุดส่งไปตั้งแต่ ${ended || 'เดือนที่แล้ว'} แล้วนะคะ`,
    `ช่วงนี้ดาวขยับหลายดวง จังหวะของหลายคนเปลี่ยนไปพอสมควรเลยค่ะ`,
    ``,
    `และเรากำลังจะเริ่มสิ่งใหม่สำหรับสมาชิก —`,
    `ทุกวันที่ 2 และ 17 ระบบจะคำนวณว่าดาวรอบนั้น`,
    `ทำมุมกับดวงเกิดของสมาชิกคนไหนแรงที่สุด`,
    `คนนั้นจะได้คุยกับอาจารย์ปรินนี่เป็นการส่วนตัว 1 ชั่วโมง`,
    `โดยไม่มีค่าใช้จ่ายเพิ่ม`,
    ``,
    `ไม่ใช่การจับรางวัล ไม่ต้องลุ้น — ขึ้นกับดวงของคุณล้วน ๆ`,
    `ขอแค่เป็นสมาชิกอยู่ในวันนั้นค่ะ`,
    ``,
    `กลับมาได้เลยนะคะ 399 บาท/เดือน กดแล้วจ่ายได้ทันที`,
    `👉 ${liffPayUrl()}`,
  ].join('\n');
}

module.exports = { audience, buildMessage, cleanName, liffPayUrl, AUDIENCE_SQL };
