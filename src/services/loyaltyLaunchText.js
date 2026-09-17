// ข้อความบรอดแคสต์เปิดตัว "ดวงเลือกคุณ" — ใช้ทั้งสคริปต์ยิงมือ (scripts/broadcast-loyalty.js)
// และตัวยิงอัตโนมัติตามเวลา (scheduler/launchBroadcast.js · LOYALTY_LAUNCH_AT)
//
// ย้ายมาจาก scripts/broadcast-loyalty.js 15 ก.ย. 69 — ข้อความเดิมทุกตัวอักษร
// เส้นตาย/รอบคิดสดจากวันที่ยิงจริง (nextRound) ห้ามฮาร์ดโค้ด — เคยเป็นคำโกหกมาแล้ว
const { nextRound, assertClean } = require('./pickAnnounce');

const BASE = (process.env.PUBLIC_BASE_URL || 'https://prinnie-app-production.up.railway.app').replace(/\/$/, '');
const IMG = `${BASE}/duang-luek-khun.jpg`;      // ต้องมีไฟล์นี้ใน liff/ (เสิร์ฟเป็น static)
const SIGNUP = 'https://liff.line.me/2010382680-c6gh82Rm';

// bon 17 ก.ย. 69: ข้อความเดิม ("บางดวงกำลังมีจังหวะสำคัญ … เจ้าของดวงที่ได้รับเลือก")
// ทำให้คนอ่านเข้าใจว่าตัวเองได้สิทธิ์ ฉบับนี้บอกตั้งแต่ต้นว่า เป็นสิทธิ์ของสมาชิก
// รอบละ 1 ท่าน และคนที่ได้จะได้รับข้อความส่วนตัว — ไม่มีศัพท์ที่อ่านแล้วงง
function body(R, intro) {
  return [
    '🎁 สมาชิก Prinnie333 มีสิทธิ์ลุ้นดูดวงกับอาจารย์ปรินนี่ฟรี',
    '',
    ...intro,
    'ทุกวันที่ 2 และ 17 ของเดือน',
    'เราจับรางวัลดูดวงตัวต่อตัวกับอาจารย์ฟรี 1 ชั่วโมง',
    'ให้สมาชิกรอบละ 1 ท่าน',
    '',
    'ใครมีสิทธิ์ลุ้น',
    '• ต้องเป็นสมาชิก Prinnie333 (399 บาท / 30 วัน)',
    '• เป็นสมาชิกต่อเนื่องครบ 14 วัน',
    '• ไม่ต้องลงทะเบียนเพิ่ม ระบบใส่ชื่อให้เอง',
    '',
    'เราจะประกาศชื่อผู้ได้รับรางวัลในไลน์นี้ทุกรอบ',
    'แล้วทีมงานจะติดต่อผู้ได้รับเพื่อนัดเวลาดูดวงค่ะ',
    '',
    'สมาชิกยังได้ดวงรายวันเฉพาะคุณทุกเช้า 08:00',
    'คำนวณจากวัน เวลา และสถานที่เกิดของคุณจริง',
    '',
    `📅 รอบถัดไป ${R.round} — ต้องเป็นสมาชิกภายใน ${R.cutoff} จึงจะทันรอบนี้`,
    `👉 สมัครสมาชิก ${SIGNUP}`,
  ].join('\n');
}

// บัญชีบริการ @prinnie333 — คนที่นี่รู้จักบริการแล้ว
function textOA1(now = new Date()) {
  return assertClean(body(nextRound(now), []));
}

// บัญชีใหญ่ — คนที่นี่อาจยังไม่รู้จักบริการ บอกก่อนหนึ่งบรรทัดว่าคืออะไร
function textOA2(now = new Date()) {
  return assertClean(body(nextRound(now), ['Prinnie333 คือบริการดวงส่วนตัวของอาจารย์ปรินนี่ทางไลน์', '']));
}

// รูป + ข้อความ (LINE ส่งได้สูงสุด 5 ข้อความต่อครั้ง — ใช้ 2)
function messages(text, { image = true } = {}) {
  return image
    ? [{ type: 'image', originalContentUrl: IMG, previewImageUrl: IMG }, { type: 'text', text }]
    : [{ type: 'text', text }];
}

module.exports = { textOA1, textOA2, messages, IMG, SIGNUP };
