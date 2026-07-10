// สร้างการ์ดคู่มือ (step-by-step) เป็นรูป PNG — วิธีใช้งาน + วิธีชำระเงิน
// ใช้ resvg (ฟอนต์ Sarabun) → PNG 1080×1350 (4:5) สำหรับ LINE broadcast / IG / flex carousel
// รัน: node scripts/build-guide.js   → ออกไฟล์ที่ marketing/guide/
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const W = 1080, H = 1350;
const OUT = path.join(__dirname, '..', 'marketing', 'guide');
const FONTS = [
  path.join(__dirname, '..', 'assets', 'fonts', 'Sarabun-Regular.ttf'),
  path.join(__dirname, '..', 'assets', 'fonts', 'Sarabun-Bold.ttf'),
  path.join(__dirname, '..', 'assets', 'fonts', 'Sarabun-ExtraBold.ttf'),
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ตัดบรรทัดตามจำนวนตัวอักษรโดยประมาณ (ไทยไม่มีเว้นวรรคคำ → ตัดที่ช่องว่างที่ใส่ไว้)
function wrap(text, max) {
  const words = text.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

function card({ badge, kicker, title, body, footer }) {
  const bodyLines = wrap(body, 26);
  const bodyStartY = 1012;
  const bodyTspans = bodyLines.map((ln, i) =>
    `<tspan x="${W/2}" y="${bodyStartY + i*58}">${esc(ln)}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Sarabun">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#1B1036"/><stop offset="0.6" stop-color="#2A1B3D"/><stop offset="1" stop-color="#0B1026"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F3D98B"/><stop offset="1" stop-color="#E8C77A"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="40" y="40" width="${W-80}" height="${H-80}" rx="36" fill="none" stroke="#E8C77A" stroke-opacity="0.28" stroke-width="2"/>

  <text x="${W/2}" y="150" text-anchor="middle" font-size="30" letter-spacing="6" fill="#E8C77A" font-weight="700">PRINNIE333</text>
  <text x="${W/2}" y="196" text-anchor="middle" font-size="26" fill="#b9a9d6">ดูดวงส่วนตัวรายวัน ทางไลน์</text>

  <!-- badge -->
  <circle cx="${W/2}" cy="420" r="132" fill="url(#gold)"/>
  <text x="${W/2}" y="${badge.length > 3 ? 452 : 470}" text-anchor="middle" font-size="${badge.length > 3 ? 88 : 150}" font-weight="800" fill="#1B1036">${esc(badge)}</text>

  <text x="${W/2}" y="660" text-anchor="middle" font-size="34" letter-spacing="2" fill="#E8C77A" font-weight="700">${esc(kicker)}</text>
  <text x="${W/2}" y="742" text-anchor="middle" font-size="62" font-weight="800" fill="#F6F1FF">${esc(title)}</text>
  <rect x="${W/2-46}" y="792" width="92" height="5" rx="2.5" fill="url(#gold)"/>

  <text text-anchor="middle" font-size="42" fill="#e9e2ff" font-weight="400">${bodyTspans}</text>

  <text x="${W/2}" y="${H-70}" text-anchor="middle" font-size="28" fill="#8f83b3">${esc(footer)}</text>
</svg>`;
}

const USE = [
  { badge: 'วิธีใช้', kicker: 'HOW TO USE', title: 'เริ่มใช้งานง่าย ๆ', body: 'ดูดวงส่วนตัวรายวัน ผ่านไลน์ 4 ขั้นตอน', footer: 'บันทึกไว้ · แชร์ให้เพื่อนได้เลย' },
  { badge: '1', kicker: 'ขั้นตอนที่ 1', title: 'แอดเพื่อน', body: 'กดเพิ่มเพื่อน @prinnie333 ในไลน์ แล้วเริ่มได้ทันที', footer: '@prinnie333' },
  { badge: '2', kicker: 'ขั้นตอนที่ 2', title: 'กรอกวันเกิด', body: 'แตะเมนูสมัคร ใส่วันเกิด เวลา และสถานที่เกิดของคุณ', footer: '@prinnie333' },
  { badge: '3', kicker: 'ขั้นตอนที่ 3', title: 'รับพื้นดวงฟรี', body: 'ดูอาทิตย์ จันทร์ ลัคนา และเลขชีวิตของคุณ ได้ฟรี', footer: '@prinnie333' },
  { badge: '4', kicker: 'ขั้นตอนที่ 4', title: 'เลือกเมนูดูดวง', body: 'แตะเมนูด้านล่าง ดูดวงวันนี้ ไพ่ทาโรต์ หรือผูกดวงคู่', footer: '@prinnie333' },
];

const PAY = [
  { badge: 'จ่าย', kicker: 'HOW TO PAY', title: 'สมัครสมาชิก', body: 'ดวงรายวันส่วนตัวทุกเช้า เพียง 399 บาทต่อเดือน', footer: 'ปลอดภัย · ผ่านพร้อมเพย์' },
  { badge: '1', kicker: 'ขั้นตอนที่ 1', title: 'กดสมัครสมาชิก', body: 'แตะปุ่มสมัครสมาชิก 399 บาทต่อเดือน ในไลน์', footer: '@prinnie333' },
  { badge: '2', kicker: 'ขั้นตอนที่ 2', title: 'สแกน QR พร้อมเพย์', body: 'ยอด 399 บาท จะขึ้นให้อัตโนมัติ ไม่ต้องพิมพ์เอง', footer: '@prinnie333' },
  { badge: '3', kicker: 'ขั้นตอนที่ 3', title: 'โอนแล้วแคปสลิป', body: 'โอนเงินผ่านแอปธนาคาร แล้วบันทึกภาพสลิปไว้', footer: '@prinnie333' },
  { badge: '4', kicker: 'ขั้นตอนที่ 4', title: 'ส่งสลิปในแชท', body: 'ส่งรูปสลิปกลับมาในแชทไลน์ Prinnie333 ได้เลย', footer: '@prinnie333' },
  { badge: '5', kicker: 'ขั้นตอนที่ 5', title: 'รอทีมงานยืนยัน', body: 'เปิดใช้งานให้ภายใน 24 ชม. แล้วรับดวงทุกเช้า', footer: '@prinnie333' },
];

function render(name, data) {
  const png = new Resvg(Buffer.from(card(data)), {
    fitTo: { mode: 'width', value: W },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Sarabun' },
  }).render().asPng();
  fs.writeFileSync(path.join(OUT, name), png);
  console.log('  ✓', name);
}

fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2]; // optional: render one sample
if (only === 'sample') {
  render('sample.png', PAY[2]);
} else {
  USE.forEach((c, i) => render(`use-${i}.png`, c));
  PAY.forEach((c, i) => render(`pay-${i}.png`, c));
  console.log(`\n${USE.length + PAY.length} guide cards → marketing/guide/`);
}
