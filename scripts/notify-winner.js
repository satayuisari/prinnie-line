// แจ้งผู้โชคดีรางวัลดูดวงฟรีทางไลน์
//
// ใช้:  node scripts/notify-winner.js --test                    (ส่งตัวอย่างเข้า TEST_USER_IDS)
//       railway run ... node scripts/notify-winner.js \
//         --to=U... --name=ชื่อ                                  (ส่งจริงถึงผู้โชคดี)
//
// ข้อความออกแบบให้จบในฉบับเดียว: บอกว่าได้อะไร เพราะอะไร ต้องตอบอะไรกลับ
// และเส้นตายยืนยันสิทธิ์ — ผู้โชคดีไม่ควรต้องถามกลับว่า "แล้วยังไงต่อ"
require('dotenv').config();
const { pushMessage } = require('../src/services/lineMessaging');

const arg = (n, f = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : f;
};

const name = arg('name', 'ผู้โชคดี');
const TEST = process.argv.includes('--test');
const to = TEST ? (process.env.TEST_USER_IDS || '').split(',')[0].trim() : arg('to');

if (!to) {
  console.error('ระบุ --to=U... หรือใช้ --test');
  process.exit(1);
}

const text = [
  `🎉 ยินดีด้วยค่ะ คุณ${name}`,
  '',
  'คุณคือผู้โชคดีของ Prinnie333',
  'ได้รับสิทธิ์ดูดวงส่วนตัวกับอาจารย์ปรินนี่',
  'ฟรี 1 ชั่วโมงเต็ม ✨',
  '',
  'อาจารย์จับรางวัลจากสมาชิกกลุ่มแรก',
  'ที่อยู่ด้วยกันมาเกิน 14 วัน',
  'ขอบคุณที่เชื่อใจกันตั้งแต่วันแรกนะคะ',
  '',
  'ขั้นตอนถัดไป ตอบแชทนี้ได้เลยค่ะ',
  '1) วันเกิด และเวลาเกิดของคุณ',
  '   (เวลาเกิดดูได้จากสูติบัตรนะคะ ถ้าไม่ทราบบอกได้ค่ะ)',
  '2) ช่วงวัน-เวลาที่สะดวกรับสาย',
  '',
  'รบกวนยืนยันสิทธิ์ภายใน 3 วันนะคะ',
  'เลยกำหนดสิทธิ์จะส่งต่อให้ผู้โชคดีสำรองค่ะ',
].join('\n');

(async () => {
  const r = await pushMessage(to, [{ type: 'text', text }]);
  if (r && r.skipped) {
    console.log('ถูกบล็อกโดย TEST_MODE (ปลายทางไม่อยู่ใน allowlist) — ถูกต้องแล้วถ้าไม่ใช่การส่งจริง');
  } else {
    console.log((TEST ? '✓ ส่งตัวอย่างเข้าไลน์ทดสอบแล้ว' : '✓ ส่งถึงผู้โชคดีแล้ว') + ` (${to.slice(0, 10)}…)`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
