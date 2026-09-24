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

// การ์ดกติกา: หัวข้อ + กลุ่มข้อ ๆ ชิดซ้ายในกรอบกลางภาพ
function rulesCard({ kicker, title, groups, foot }) {
  return `<div class="stars">${stars(5)}</div><div class="wrap">
    <div class="brand" style="margin-top:44px">อาจารย์ปรินนี่</div>
    <div class="kicker" style="margin-top:14px;font-size:27px">${kicker}</div>
    <div class="title" style="font-size:56px;margin-top:2px">${title}</div>
    <div class="rule" style="margin:16px 0 0"></div>
    <div style="text-align:left;width:860px">
      ${groups.map(([h, items]) => `
        <div style="font-size:29px;font-weight:700;color:#D4AF6E;margin-top:16px">${h}</div>
        ${items.map(t => `<div style="font-size:26px;color:#F0EEF8;margin-top:4px;padding-left:22px">• ${t}</div>`).join('')}
      `).join('')}
    </div>
    <div style="font-size:24px;color:#C4BAE2;margin-top:22px">${foot}</div>
    <div class="lineid" style="bottom:36px">LINE @PRINNIE333</div>
  </div>`;
}

const POSTS = [
  // สัปดาห์ 23–29 ก.ย. 69: คว่ำไพ่ธีมความรัก (เฉลย ศุกร์ 25 = ถ้วยสอง · ดวงดาว · อัศวินถ้วย)
  ['พฤหัส24-คว่ำไพ่ความรัก/โพสต์ฟีด.png', pickCard({
    title: 'เลือกหนึ่งใบ',
    sub: 'ความรักของคุณช่วงนี้ กำลังจะเป็นยังไง',
    tips: ['นึกถึงคนที่อยู่ในใจ', 'แล้วเลือกใบแรกที่สะดุดตา'],
    tail: 'พิมพ์ ซ้าย กลาง ขวา มาในคอมเมนต์ · เฉลยพรุ่งนี้เช้า',
  })],
  // กติกาจับรางวัลแบบละเอียด (17 ก.ย. 69) — ทุกข้อต้องตรงกับโค้ด monthlyPick / loyaltyRewards
  ['ศุกร์18-กติกาจับรางวัล/โพสต์ฟีด.png', rulesCard({
    kicker: 'สำหรับสมาชิก PRINNIE333',
    title: 'กติกาจับรางวัลดูดวงกับอาจารย์',
    groups: [
      ['รางวัล', ['ดูดวงตัวต่อตัวกับอาจารย์ปรินนี่ ฟรี 1 ชั่วโมง · รอบละ 1 ท่าน']],
      ['ใครมีสิทธิ์ลุ้น (ต้องครบทุกข้อ)', [
        'เป็นสมาชิก Prinnie333 (399 บาท / 30 วัน)',
        'สมัครมาแล้วอย่างน้อย 14 วันก่อนวันจับรางวัล',
        'สมาชิกยังไม่หมดอายุในวันจับรางวัล',
        'กรอกวัน เวลา และสถานที่เกิดครบ',
      ]],
      ['จับเมื่อไร จับยังไง', [
        'ทุกวันที่ 2 และ 17 ของเดือน เวลา 20:00 น.',
        'สุ่มจากรายชื่อสมาชิกที่มีสิทธิ์ ทุกคนมีโอกาสเท่ากัน',
      ]],
      ['ถ้าคุณได้รางวัล', [
        'ได้ข้อความส่วนตัว และมีชื่อในประกาศทางไลน์',
        'ทีมงานทักไปนัดเวลา · ใช้สิทธิ์ภายใน 60 วัน',
      ]],
    ],
    foot: 'ไม่ต้องลงทะเบียนเพิ่ม · ได้แล้วลุ้นใหม่ได้หลัง 12 เดือน',
  })],
  // 17 ก.ย. 69: วันนี้ต้องเฉลยผู้ได้รับรางวัล → โพสต์นี้แทนเรื่องเวลาเกิด (เลื่อนไปวันอื่น)
  ['พฤหัส17-ประกาศผู้โชคดี/โพสต์ฟีด.png', notice({
    kicker: 'ผลจับรางวัลสมาชิก PRINNIE333 · รอบ 17 ก.ย.',
    title: 'ผู้โชคดีคือ คุณ SHGH',
    lines: [
      ['ได้ดูดวงตัวต่อตัวกับอาจารย์ปรินนี่ ฟรี 1 ชั่วโมง', true],
      ['จากสมาชิกที่มีสิทธิ์ทั้งหมด 39 ท่าน', false],
      ['จับรางวัลรอบถัดไป 2 ตุลาคม', false],
      ['สมัครสมาชิกภายใน 18 ก.ย. ก็มีสิทธิ์ลุ้นรอบนี้ค่ะ', false],
    ],
    foot: 'รอบนี้ยังไม่ใช่คุณ ไม่เป็นไรนะคะ รอบหน้าอาจเป็นคุณค่ะ',
  })],
  ['จันทร์21-คว่ำไพ่/โพสต์ฟีด.png', pickCard({
    title: 'เลือกหนึ่งใบ',
    sub: 'เงินของคุณช่วงที่กำลังจะมาถึง เป็นยังไง',
    tips: ['อย่าเพิ่งคิดนาน', 'ใบแรกที่สะดุดตาคือใบของคุณ'],
    tail: 'พิมพ์ ซ้าย กลาง ขวา มาในคอมเมนต์ · เฉลยพรุ่งนี้เช้า',
  })],
  ['พุธ16-ดวงเลือกคุณ/โพสต์ฟีด.png', notice({
    kicker: 'สิทธิพิเศษสมาชิก PRINNIE333',
    title: 'ดวงเลือกคุณ',
    lines: [
      ['ดูดวงตัวต่อตัวกับอาจารย์ ฟรี 1 ชั่วโมงเต็ม', true],
      ['ทุกวันที่ 2 และ 17 ระบบคำนวณจากดวงกำเนิดจริง', false],
      ['ดาวจรทำมุมกับดวงใครแรงที่สุด คนนั้นได้รับสิทธิ์', false],
      ['สมาชิกครบ 14 วัน เข้าเกณฑ์เอง ไม่ต้องลงทะเบียน', false],
    ],
    foot: 'รอบแรกพรุ่งนี้ 17 ก.ย. · แจ้งสิทธิ์ทางไลน์ส่วนตัว',
  })],
  ['พฤหัส17-เวลาเกิด/โพสต์ฟีด.png', notice({
    kicker: 'ความรู้เรื่องดวง',
    title: 'เวลาเกิด สำคัญกว่าที่คิด',
    lines: [
      ['เกิดวันเดียวกัน ทำไมชีวิตคนละทาง', true],
      ['คำตอบอยู่ที่ ลัคนา ซึ่งขยับทุก 2 ชั่วโมง', false],
      ['เช้ากับค่ำวันเดียวกัน ลัคนาคนละราศี', false],
      ['วิธีหาเวลาเกิดของตัวเอง อ่านในแคปชั่นค่ะ', false],
    ],
    // 17 ก.ย. 69: เลิกใช้ "ดวงเลือกคุณ" (ทำให้คนเข้าใจผิด) และการจับรางวัลไม่ขึ้นกับดวงแล้ว
    foot: 'รู้เวลาเกิดแม่น ดวงรายวันของคุณก็ยิ่งตรงตัวค่ะ',
  })],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
// ใส่คำที่สามเพื่อทำเฉพาะโพสต์ที่ชื่อไฟล์มีคำนั้น เช่น node build-week-art.mjs <out> พฤหัส17
const only = process.argv[3];
for (const [file, body] of POSTS.filter(([f]) => !only || f.includes(only))) {
  await page.setContent(`<style>${BASE_CSS}</style>${body}`);
  await page.waitForTimeout(400);
  const out = path.join(OUT, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('บันทึก', file);
}
await browser.close();
