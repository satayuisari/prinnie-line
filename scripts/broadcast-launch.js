// ยิงข้อความเปิดตัวแคมเปญ "ปลุกฐาน 10k" แบบ broadcast (Flex การ์ดรับดวงฟรี)
// ⚠️ ส่งหา follower "ทุกคน" — ใช้ตอน launch จริงเท่านั้น
//
// รัน:  node scripts/broadcast-launch.js --confirm
//   - ต้องมี --confirm เพื่อยืนยัน (กันยิงพลาด)
//   - ถูกบล็อกอัตโนมัติถ้า TEST_MODE=true (lineMessaging.broadcast จะ throw)
require('dotenv').config();
const lineMsg = require('../src/services/lineMessaging');
const flex    = require('../src/marketing/flexTemplates');

const LIFF_URL = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}`
  : null;

(async () => {
  if (!process.argv.includes('--confirm')) {
    console.log('❌ ต้องใส่ --confirm เพื่อยืนยันการ broadcast หา follower ทุกคน');
    console.log('   ตัวอย่าง: node scripts/broadcast-launch.js --confirm');
    process.exit(1);
  }
  if (!LIFF_URL) { console.error('❌ ไม่พบ LINE_LIFF_ID ใน env'); process.exit(1); }

  const message = flex.launchOffer(LIFF_URL);
  console.log('กำลัง broadcast ข้อความเปิดตัว →', message.altText);
  await lineMsg.broadcast(message);   // throw ถ้า TEST_MODE=true
  console.log('✅ broadcast สำเร็จ — ส่งหา follower ทุกคนแล้ว');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
