// ชวนสมาชิกเก่าที่หมดอายุกลับมา — กลุ่มเป้าหมาย + ข้อความ อยู่ที่นี่ที่เดียว
// ใช้ร่วมกันทั้ง scripts/winback.js (ยิงมือ) และ scheduler/winbackBlast.js (ยิงตามเวลา)
const db = require('../db');
const { nextRound, thDate, assertClean, MIN_DAYS } = require('./pickAnnounce');

const liffPayUrl = () => (process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}?view=pay`
  : 'https://liff.line.me/YOUR_LIFF_ID?view=pay');

// เป้าหมาย: เคยจ่ายจริง + มีดวงแล้ว + หมดอายุแล้ว (ไม่รวมบัญชีทดลอง/แจกฟรี)
const AUDIENCE_SQL = `
  SELECT line_user_id,
         COALESCE(NULLIF(nickname,''), display_name) AS name,
         subscribe_end AS ended   -- เป็น Date แล้วแปลงเป็นวันที่ไทยตอนเขียนข้อความ (เซิร์ฟเวอร์เป็น UTC)
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

// bon 4 ต.ค. 69 อนุมัติข้อความใหม่ — ของเดิมเล่ากติกาเก่า ("ดาวทำมุม" · "ไม่ใช่การจับรางวัล" ·
// "ขอแค่เป็นสมาชิกวันนั้น") ซึ่งไม่จริงแล้วและผิดกติกาใน CLAUDE.md
// รอบที่คนกลับมาวันนี้ทันจริง คิดสด (nextRound · ต้องเป็นสมาชิกครบ MIN_DAYS วัน)
// ⚠️ ข้อความส่วนตัว (push) ไม่ผ่าน copyGuard ใน lineMessaging → ตรวจคำต้องห้ามเองที่นี่
function buildMessage(rawName, ended, { now = new Date() } = {}) {
  const name = cleanName(rawName);
  const endedText = ended instanceof Date ? thDate(ended) : (ended || 'เดือนที่แล้ว');
  const next = nextRound(now);
  return assertClean([
    `${name ? 'คุณ' + name + ' คะ 🌙' : 'สวัสดีค่ะ 🌙'}`,
    ``,
    `ดวงรายวันส่วนตัวของคุณหยุดส่งไปตั้งแต่ ${endedText} ค่ะ`,
    `อาจารย์ยังเขียนดวงให้สมาชิกทุกเช้า 8 โมง คำนวณจากวัน เวลา และที่เกิดของคุณเอง`,
    ``,
    `ตอนนี้สมาชิกมีสิทธิ์ลุ้นดูดวงตัวต่อตัวกับอาจารย์ปรินนี่ฟรี 1 ชั่วโมงด้วยนะคะ`,
    `จับรางวัลทุกวันที่ 2 และ 17 ของเดือน รอบละ 1 ท่าน`,
    `ต้องเป็นสมาชิกต่อเนื่องครบ ${MIN_DAYS} วันก่อนวันจับ`,
    `ถ้ากลับมาวันนี้ ได้ลุ้นรอบ ${next.round} ค่ะ`,
    ``,
    `กลับมาได้เลย 399 บาท / 30 วัน กดแล้วจ่ายได้ทันที`,
    `👉 ${liffPayUrl()}`,
  ].join('\n'));
}

module.exports = { audience, buildMessage, cleanName, liffPayUrl, AUDIENCE_SQL };
