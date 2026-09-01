// บรอดแคสต์แคมเปญ "ดวงเลือกคุณ" — ดูข้อความก่อนเสมอ ไม่ส่งจนกว่าจะสั่งชัด ๆ
//
//   node scripts/broadcast-loyalty.js                  พิมพ์ข้อความออกมาดู (ไม่ส่งอะไรเลย)
//   node scripts/broadcast-loyalty.js --to-me          ส่งเข้าไลน์ตัวเองดูของจริงก่อน
//   node scripts/broadcast-loyalty.js --send oa1       บรอดแคสต์เข้า @prinnie333 (บัญชีบริการ)
//   node scripts/broadcast-loyalty.js --send oa2       บรอดแคสต์เข้าบัญชีใหญ่ @efb2738a
//   node scripts/broadcast-loyalty.js --send both      ทั้งสองบัญชี
//
// ⚠️ --send ยิงหาผู้ติดตามจริงทั้งหมด ย้อนกลับไม่ได้ ต้องพิมพ์ยืนยันอีกครั้ง
// TEST_MODE=true จะบล็อกให้เองอีกชั้น (ตาม lineMessaging.js)
//
// คำที่ใช้ยึดตาม marketing/LOYALTY-CAMPAIGN.md เท่านั้น
//   ✅ ดวงเลือกคุณ · คัดจากดวงกำเนิด   ❌ ผู้โชคดี · จับรางวัล · สุ่ม · ลุ้น · ประกาศผล

require('dotenv').config();
const readline = require('readline');
const lm = require('../src/services/lineMessaging');

const BASE = (process.env.PUBLIC_BASE_URL || 'https://prinnie-app-production.up.railway.app').replace(/\/$/, '');
const IMG = `${BASE}/duang-luek-khun.jpg`;      // ต้องมีไฟล์นี้ใน liff/ (เสิร์ฟเป็น static)

// ── บัญชีบริการ @prinnie333 — คนที่นี่รู้จักเราแล้ว พูดเรื่องสิทธิ์ได้เลย ──
const TEXT_OA1 =
`🔮 เป็นสมาชิกอยู่ตอนนี้
คุณอาจมีสิทธิ์คุยกับอาจารย์ปรินนี่
ตัวต่อตัว 1 ชั่วโมง ไม่มีค่าใช้จ่ายเพิ่ม

ระบบคำนวณใหม่ทุก 15 วัน
วันที่ 2 และวันที่ 17 ของทุกเดือน
รอบละ 1 คน ที่ดวงกำเนิดรับดาวจรแรงสุด

ไม่ใช่การจับรางวัล — คัดจากดวงคุณเอง
เป็นสมาชิกครบ 14 วัน ดวงเข้าคำนวณเอง

399 บาท/เดือน · ทักมาเลยค่ะ ✨`;

// ── บัญชีใหญ่ @efb2738a — คนที่นี่อาจยังไม่รู้จักบริการ ต้องอธิบายก่อนแล้วชี้ทาง ──
const TEXT_OA2 =
`🔮 เป็นสมาชิก Prinnie333 อยู่ตอนนี้
คุณอาจมีสิทธิ์คุยกับอาจารย์ปรินนี่
ตัวต่อตัว 1 ชั่วโมง ไม่มีค่าใช้จ่ายเพิ่ม

ระบบคำนวณใหม่ทุก 15 วัน
วันที่ 2 และวันที่ 17 ของทุกเดือน
รอบละ 1 คน ที่ดวงกำเนิดรับดาวจรแรงสุด

ไม่ใช่การจับรางวัล — คัดจากวัน เวลา สถานที่เกิดจริง
สมาชิกครบ 14 วัน ดวงเข้าคำนวณเอง

แอด LINE @prinnie333 · รับพื้นดวงฟรี ✨`;

const msgs = (text) => ([
  { type: 'image', originalContentUrl: IMG, previewImageUrl: IMG },
  { type: 'text', text },
]);

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const SEND = arg('--send');
const TO_ME = process.argv.includes('--to-me');

function show() {
  const line = '─'.repeat(58);
  console.log(`\nรูปที่จะแนบ: ${IMG}\n`);
  for (const [name, t] of [['@prinnie333 (บัญชีบริการ)', TEXT_OA1], ['@efb2738a (บัญชีใหญ่)', TEXT_OA2]]) {
    console.log(line);
    console.log(`  ${name}   ·   ${t.length} ตัวอักษร`);
    console.log(line);
    console.log(t.split('\n').map(l => '  ' + l).join('\n'));
    console.log();
  }
  console.log(line);
  console.log('  ยังไม่ได้ส่งอะไรทั้งสิ้น');
  console.log('  --to-me       ส่งเข้าไลน์ตัวเองดูของจริง');
  console.log('  --send oa1 | oa2 | both     บรอดแคสต์จริง (ต้องยืนยันอีกครั้ง)');
  console.log(line + '\n');
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(q, a => { rl.close(); r(a.trim()); }));
}

(async () => {
  if (!SEND && !TO_ME) { show(); return; }

  if (TO_ME) {
    // ตอน TEST_MODE ต้องเลือกปลายทางที่อยู่ใน allowlist ไม่งั้นถูกบล็อกเงียบ ๆ
    const allow = (process.env.TEST_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const prod = process.env.PROD_OA_USER_ID;
    const me = lm.TEST_MODE ? (allow.find(id => id === prod) || allow[0] || prod)
                            : (prod || allow[0]);
    if (!me) { console.error('ไม่รู้ว่าจะส่งหาใคร — ตั้ง PROD_OA_USER_ID หรือ TEST_USER_IDS ก่อน'); process.exit(1); }
    if (lm.TEST_MODE && prod && me !== prod)
      console.log(`· TEST_MODE เปิดอยู่ → ส่งหา ${me.slice(0, 8)}… (อยู่ใน allowlist) แทน ${prod.slice(0, 8)}…`);

    // ต้องเช็คค่าที่คืนมา — pushMessage คืน {skipped:true} ตอนถูกบล็อก ไม่ได้ throw
    // เดิมไม่ได้เช็ค เลยขึ้นว่า "ส่งแล้ว" ทั้งที่ไม่ได้ส่งอะไรเลย
    const r = await lm.pushMessage(me, msgs(TEXT_OA1));
    if (r && r.skipped) {
      console.log(`✗ ไม่ได้ส่ง — ${me.slice(0, 8)}… ไม่อยู่ใน TEST_USER_IDS (TEST_MODE=true)`);
      console.log('  แก้: เพิ่ม id นี้ใน TEST_USER_IDS หรือตั้ง TEST_MODE=false');
    } else {
      console.log(`✓ ส่งตัวอย่าง (แบบบัญชีบริการ) เข้าไลน์แล้ว — ${me.slice(0, 8)}…`);
    }
    try {
      const r2 = await lm.pushOA2(me, msgs(TEXT_OA2));
      console.log(r2 && r2.skipped ? '✗ OA2 ถูกบล็อกโดย TEST_MODE' : '✓ ส่งตัวอย่าง (แบบบัญชีใหญ่) ผ่าน OA2 แล้ว');
    } catch (e) { console.log('· ข้ามตัวอย่าง OA2:', e.message); }
    return;
  }

  if (!['oa1', 'oa2', 'both'].includes(SEND)) { console.error('--send ต้องเป็น oa1 · oa2 · both'); process.exit(1); }
  show();
  const targets = SEND === 'both' ? ['oa1', 'oa2'] : [SEND];
  const names = { oa1: '@prinnie333 (บัญชีบริการ ~10,000 คน)', oa2: '@efb2738a (บัญชีใหญ่)' };
  console.log('⚠️  กำลังจะบรอดแคสต์จริงไปที่: ' + targets.map(t => names[t]).join(' และ '));
  console.log('   ส่งแล้วเรียกคืนไม่ได้ และ LINE นับเป็น 1 ข้อความต่อคน (กินโควต้า)\n');
  const ok = await ask('   พิมพ์ "ส่งเลย" เพื่อยืนยัน · อย่างอื่นคือยกเลิก: ');
  if (ok !== 'ส่งเลย') { console.log('\n   ยกเลิกแล้ว ไม่ได้ส่งอะไร'); return; }

  for (const t of targets) {
    try {
      if (t === 'oa1') { await lm.broadcast(msgs(TEXT_OA1)); console.log('   ✓ ส่งเข้า @prinnie333 แล้ว'); }
      else { await lm.broadcastOA2(msgs(TEXT_OA2)); console.log('   ✓ ส่งเข้าบัญชีใหญ่แล้ว'); }
    } catch (e) { console.error(`   ✗ ${t} ล้มเหลว:`, e.message); }
  }
})();
