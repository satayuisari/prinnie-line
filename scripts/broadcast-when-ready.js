// ยิงบรอดแคสต์ "ดวงเลือกคุณ" แบบตรวจก่อนยิง
//
//   node scripts/broadcast-when-ready.js           ตรวจอย่างเดียว ไม่ส่ง
//   node scripts/broadcast-when-ready.js --send    ตรวจแล้วยิงทั้งสองไลน์ถ้าผ่านครบ
//
// มีตัวนี้เพราะข้อความบอกลูกค้าว่า "คัดทุกวันที่ 2 และ 17"
// ถ้ายิงออกไปตอนที่ระบบจริงยังคัดวันที่ 15 (หรือไม่คัดเลย) = สัญญาที่ทำไม่ได้
// กับคนที่จ่ายเงินเป็นสมาชิก ย้อนกลับไม่ได้ด้วย
require('dotenv').config();
const readline = require('readline');
const { execFileSync } = require('child_process');
const fs = require('fs');

const HOST = (process.env.PUBLIC_BASE_URL || 'https://data.prinnie333.com').replace(/\/$/, '');
const ask = q => new Promise(r => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, a => { rl.close(); r(a.trim()); });
});

const head = async url => {
  try { const r = await fetch(url, { method: 'GET' }); return { code: r.status, len: +(r.headers.get('content-length') || 0) }; }
  catch { return { code: 0, len: 0 }; }
};

(async () => {
  console.log(`\nตรวจก่อนยิง · โฮสต์ ${HOST}\n${'─'.repeat(58)}`);
  const fail = [];
  const check = (ok, label, hint) => {
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
    if (!ok) { fail.push(label); if (hint) console.log(`      → ${hint}`); }
  };

  // 1. OA2 — ไม่มีอันนี้ ไลน์หมื่นคนยิงไม่ออกเลย
  check(!!(process.env.LINE_CHANNEL_ID_2 && process.env.LINE_CHANNEL_SECRET_2),
    'OA2 credential ครบ (ไลน์ผู้ติดตาม 10,000)',
    'ก๊อป LINE_CHANNEL_ID_2 / LINE_CHANNEL_SECRET_2 / LINE_CHANNEL_ACCESS_TOKEN_2 จาก Railway มาใส่ .env');

  // 2. รูปแคมเปญต้องเป็นตัวใหม่ที่เขียน "ทุก 15 วัน" ไม่ใช่ตัวเก่า
  const local = fs.existsSync('liff/duang-luek-khun.jpg') ? fs.statSync('liff/duang-luek-khun.jpg').size : 0;
  const img = await head(`${HOST}/duang-luek-khun.jpg`);
  check(img.code === 200, `รูปแคมเปญเสิร์ฟได้ (HTTP ${img.code})`, 'ยังไม่ deploy — รัน railway up --service prinnie-app --detach');
  if (img.code === 200)
    check(Math.abs(img.len - local) < 2048,
      `รูปบนเซิร์ฟเวอร์เป็นตัวใหม่ (${(img.len/1024).toFixed(0)}KB เทียบในเครื่อง ${(local/1024).toFixed(0)}KB)`,
      'รูปบนเซิร์ฟเวอร์ยังเป็นตัวเก่าที่เขียน "ทุกวันที่ 15" — deploy ใหม่');

  // 3. รูปไพ่ — ค้างมาตั้งแต่โฮสต์เดิมล่ม deploy รอบนี้ควรแก้ไปด้วย
  const tarot = await head(`${HOST}/tarot/the-fool.jpg`);
  check(tarot.code === 200, `รูปไพ่ทาโรต์เสิร์ฟได้ (HTTP ${tarot.code})`, 'route /tarot ยังไม่ขึ้น production');

  if (fail.length) {
    console.log(`\n${'─'.repeat(58)}\n  ยังไม่พร้อม ${fail.length} ข้อ — ไม่ได้ส่งอะไรทั้งสิ้น\n`);
    process.exit(1);
  }

  // 4. สองข้อนี้อยู่บน Railway ตรวจจากข้างนอกไม่ได้ ต้องให้คนยืนยัน
  console.log(`\n${'─'.repeat(58)}\n  ตรวจอัตโนมัติผ่านหมด เหลือสองข้อที่ผมดูแทนไม่ได้:\n`);
  console.log('   1. Railway Variables มี  LOYALTY_ENABLED=true');
  console.log('   2. โค้ดที่รันอยู่คือ commit ที่ cron เป็น  0 9 2,17 * *\n');
  if (!process.argv.includes('--send')) { console.log('  (โหมดตรวจอย่างเดียว — ใส่ --send เพื่อยิงจริง)\n'); return; }

  if (await ask('   ยืนยันทั้งสองข้อแล้วใช่มั้ย พิมพ์ "ยืนยัน": ') !== 'ยืนยัน')
    return console.log('\n   ยกเลิก ไม่ได้ส่งอะไร\n');
  console.log('\n   ⚠️  กำลังจะยิงหาผู้ติดตามจริงทั้งสองบัญชี ย้อนกลับไม่ได้');
  if (await ask('   พิมพ์ "ส่งเลย" เพื่อยิง: ') !== 'ส่งเลย')
    return console.log('\n   ยกเลิก ไม่ได้ส่งอะไร\n');

  execFileSync('node', ['scripts/broadcast-loyalty.js', '--send', 'both'],
    { stdio: 'inherit', env: { ...process.env, PUBLIC_BASE_URL: HOST } });
})();
