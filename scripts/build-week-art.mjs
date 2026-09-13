// ภาพโพสต์รายสัปดาห์ Prinnie333 — เรนเดอร์จาก HTML ผ่านเบราว์เซอร์ headless
//
// ทำไมไม่วาดด้วยไลบรารีภาพตรง ๆ: ตัวไทยมีสระบนล่างและวรรณยุกต์ที่ต้องอาศัย
// การจัดรูปอักษร (text shaping) เครื่องมือวาดภาพส่วนใหญ่ในเครื่องนี้ไม่มี
// ตัวจัดรูป ผลคือสระลอยเป็นวงจุดทั้งภาพ เบราว์เซอร์จัดรูปให้ถูกเสมอ
// จึงเขียนโพสต์เป็น HTML แล้วถ่ายหน้าจอที่ 1080×1080 แทน
//
// ใช้:  node scripts/build-week-art.mjs <โฟลเดอร์สัปดาห์>
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/bon/astral-realm/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || '.';

const BASE_CSS = `
  * { margin:0; box-sizing:border-box; }
  body { width:1080px; height:1080px; position:relative; overflow:hidden;
         background:#171226; color:#F0EEF8;
         font-family:'Sukhumvit Set','Thonburi',sans-serif; }
  .stars i { position:absolute; border-radius:50%; background:#EBE6FF; }
  .wrap { position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; text-align:center; }
  .brand { margin-top:74px; font-size:27px; color:#C4BAE2; }
  .kicker { font-size:32px; color:#D4AF6E; margin-top:44px; }
  .title { font-size:72px; font-weight:700; margin-top:10px; }
  .rule { width:280px; height:2px; background:#D4AF6E; margin:36px 0 10px; }
  .line { font-size:31px; color:#C4BAE2; margin-top:26px; }
  .line.big { font-size:40px; font-weight:700; color:#F0EEF8; }
  .foot { position:absolute; bottom:104px; width:100%; font-size:26px; color:#C4BAE2; }
  .lineid { position:absolute; bottom:52px; width:100%; font-size:24px;
            letter-spacing:.55em; color:#D4AF6E; }
  .cards { display:flex; gap:64px; margin-top:44px; }
  .card { width:220px; height:336px; border:3px solid #C4BAE2; border-radius:18px;
          background:#2C2642; padding:14px; position:relative; }
  .card .inner { position:absolute; inset:14px; border:2px solid #D4AF6E; border-radius:10px; }
  .card svg { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); }
  .card .lbl { position:absolute; bottom:-52px; width:100%; left:0; font-size:30px; }
  .tips { position:absolute; bottom:170px; width:100%; font-size:36px; font-weight:700; line-height:1.55; }
  .tail { margin-top:22px; font-size:26px; color:#C4BAE2; }
`;

const stars = (seed) => {
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 120 }, () => {
    const r = [1, 1, 1, 2, 2, 3][Math.floor(rnd() * 6)];
    const o = 0.25 + rnd() * 0.6;
    return `<i style="left:${rnd() * 1080}px;top:${rnd() * 1080}px;width:${r}px;height:${r}px;opacity:${o}"></i>`;
  }).join('');
};

const wheel = `
  <svg width="150" height="150" viewBox="-75 -75 150 150">
    <circle r="70" fill="none" stroke="#C4BAE2" stroke-width="2"/>
    <circle r="50" fill="none" stroke="#D4AF6E" stroke-width="1"/>
    ${Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return `<line x1="0" y1="0" x2="${50 * Math.cos(a)}" y2="${50 * Math.sin(a)}"
        stroke="${i % 2 ? '#D4AF6E' : '#C4BAE2'}" stroke-width="1"/>`;
    }).join('')}
  </svg>`;

function pickCard({ title, sub, tips, tail }) {
  return `<div class="stars">${stars(7)}</div><div class="wrap">
    <div class="brand">อาจารย์ปรินนี่</div>
    <div class="title" style="margin-top:34px">${title}</div>
    <div class="line" style="font-size:34px">${sub}</div>
    <div class="cards">
      ${['ซ้าย', 'กลาง', 'ขวา'].map((l) =>
        `<div class="card"><div class="inner"></div>${wheel}<div class="lbl">${l}</div></div>`).join('')}
    </div>
    <div class="tips">${tips.join('<br>')}</div>
    <div class="foot">${tail}</div>
    <div class="lineid">LINE @PRINNIE333</div>
  </div>`;
}

function notice({ kicker, title, lines, foot }) {
  return `<div class="stars">${stars(11)}</div><div class="wrap">
    <div class="brand" style="margin-top:120px">อาจารย์ปรินนี่</div>
    <div class="kicker">${kicker}</div>
    <div class="title">${title}</div>
    <div class="rule"></div>
    ${lines.map(([t, big]) => `<div class="line${big ? ' big' : ''}">${t}</div>`).join('')}
    <div class="foot">${foot}</div>
    <div class="lineid">LINE @PRINNIE333</div>
  </div>`;
}

const POSTS = [
  ['จันทร์21-คว่ำไพ่/โพสต์ฟีด.png', pickCard({
    title: 'เลือกหนึ่งใบ',
    sub: 'เงินของคุณช่วงที่กำลังจะมาถึง เป็นยังไง',
    tips: ['อย่าเพิ่งคิดนาน', 'ใบแรกที่สะดุดตาคือใบของคุณ'],
    tail: 'พิมพ์ ซ้าย กลาง ขวา มาในคอมเมนต์ · เฉลยพรุ่งนี้เช้า',
  })],
  ['พุธ16-ประกาศรางวัล/โพสต์ฟีด.png', notice({
    kicker: 'ขอบคุณที่อยู่ด้วยกันตั้งแต่วันแรก',
    title: 'ดูดวงฟรี 1 ชั่วโมง',
    lines: [
      ['ประกาศผู้โชคดีรอบแรก คืนนี้', true],
      ['จับจากสมาชิกกลุ่มแรก ที่อยู่ด้วยกันเกิน 14 วัน', false],
      ['พลาดรอบนี้ไม่เป็นไร — จับใหม่ทุก 2 สัปดาห์', false],
      ['สมัครสมาชิกวันนี้ อายุสมาชิกเริ่มนับทันที', false],
    ],
    foot: 'รอบหน้า: สมาชิกครบ 1 เดือนมีสิทธิ์ลุ้นทุกคน',
  })],
  ['พฤหัส17-เวลาเกิด/โพสต์ฟีด.png', notice({
    kicker: 'ความรู้จากอาจารย์ · ไม่มีคำขาย',
    title: 'เวลาเกิด สำคัญกว่าที่คิด',
    lines: [
      ['เกิดวันเดียวกัน ทำไมชีวิตคนละทาง', true],
      ['คำตอบอยู่ที่ ลัคนา ซึ่งขยับทุก 2 ชั่วโมง', false],
      ['เช้ากับค่ำวันเดียวกัน ลัคนาคนละราศี', false],
      ['วิธีหาเวลาเกิดของตัวเอง อ่านในแคปชั่นค่ะ', false],
    ],
    foot: 'รางวัลดูดวงฟรีจับใหม่ทุก 2 สัปดาห์ — เวลาเกิดพร้อมไว้ได้เปรียบ',
  })],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
for (const [file, body] of POSTS) {
  await page.setContent(`<style>${BASE_CSS}</style>${body}`);
  await page.waitForTimeout(400);
  const out = path.join(OUT, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('บันทึก', file);
}
await browser.close();
