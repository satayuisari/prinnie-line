// เรนเดอร์การ์ด 9:16 (1080×1920) สำหรับวิดีโอ — ใช้ทั้ง "tutorial" และ "promo"
// ออกไฟล์ PNG แล้วให้ build-videos ต่อเป็น mp4 (fade + zoom)
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const W = 1080, H = 1920;
const FONTS = ['Sarabun-Regular.ttf', 'Sarabun-Bold.ttf', 'Sarabun-ExtraBold.ttf']
  .map(f => path.join(__dirname, '..', 'assets', 'fonts', f));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(text, max) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

// ไอคอนวาดด้วย SVG (ฟอนต์ Sarabun ไม่มีสัญลักษณ์ ☉☾✦) — วางกลางวงกลม cx,cy
function badgeIcon(kind, cx, cy) {
  const D = '#1B1036';
  if (kind === 'sun') {
    let rays = '';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, x1 = cx + Math.cos(a)*52, y1 = cy + Math.sin(a)*52, x2 = cx + Math.cos(a)*72, y2 = cy + Math.sin(a)*72;
      rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${D}" stroke-width="9" stroke-linecap="round"/>`; }
    return `<circle cx="${cx}" cy="${cy}" r="40" fill="${D}"/>${rays}`;
  }
  if (kind === 'moon') return `<circle cx="${cx}" cy="${cy}" r="52" fill="${D}"/><circle cx="${cx+22}" cy="${cy-6}" r="46" fill="url(#gold)"/>`;
  // star / sparkle (4-point)
  return `<path d="M ${cx} ${cy-62} C ${cx+8} ${cy-8}, ${cx+8} ${cy-8}, ${cx+62} ${cy} C ${cx+8} ${cy+8}, ${cx+8} ${cy+8}, ${cx} ${cy+62} C ${cx-8} ${cy+8}, ${cx-8} ${cy+8}, ${cx-62} ${cy} C ${cx-8} ${cy-8}, ${cx-8} ${cy-8}, ${cx} ${cy-62} Z" fill="${D}"/>`;
}
const ICONS = { sun: 1, moon: 1, star: 1 };

function card({ badge, kicker, title, body, footer }) {
  const isIcon = ICONS[badge];
  const big = !isIcon && badge.length <= 2;
  const bodyLines = wrap(body, 27);
  const bodyStartY = 1430 - (bodyLines.length - 1) * 32;
  const bodyTspans = bodyLines.map((ln, i) => `<tspan x="${W/2}" y="${bodyStartY + i*64}">${esc(ln)}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Sarabun">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#1B1036"/><stop offset="0.55" stop-color="#2A1B3D"/><stop offset="1" stop-color="#0B1026"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D98B"/><stop offset="1" stop-color="#E8C77A"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.34" r="0.5"><stop offset="0" stop-color="#3a2560" stop-opacity="0.7"/><stop offset="1" stop-color="#3a2560" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="48" y="48" width="${W-96}" height="${H-96}" rx="44" fill="none" stroke="#E8C77A" stroke-opacity="0.26" stroke-width="2"/>

  <text x="${W/2}" y="210" text-anchor="middle" font-size="38" letter-spacing="8" fill="#E8C77A" font-weight="700">PRINNIE333</text>
  <text x="${W/2}" y="264" text-anchor="middle" font-size="30" fill="#b9a9d6">ดูดวงส่วนตัวรายวัน ทางไลน์</text>

  <circle cx="${W/2}" cy="580" r="150" fill="url(#gold)"/>
  ${isIcon ? badgeIcon(badge, W/2, 580) : `<text x="${W/2}" y="${big ? 638 : 600}" text-anchor="middle" font-size="${big ? 170 : 74}" font-weight="800" fill="#1B1036">${esc(badge)}</text>`}

  <text x="${W/2}" y="880" text-anchor="middle" font-size="38" letter-spacing="3" fill="#E8C77A" font-weight="700">${esc(kicker)}</text>
  <text x="${W/2}" y="972" text-anchor="middle" font-size="72" font-weight="800" fill="#F6F1FF">${esc(title)}</text>
  <rect x="${W/2-52}" y="1030" width="104" height="6" rx="3" fill="url(#gold)"/>

  <text text-anchor="middle" font-size="44" fill="#e9e2ff" font-weight="400">${bodyTspans}</text>
  <text x="${W/2}" y="1800" text-anchor="middle" font-size="32" fill="#8f83b3">${esc(footer)}</text>
</svg>`;
}

const TUTORIAL = [
  { badge: 'วิธีใช้', kicker: 'HOW TO USE', title: 'เริ่มใช้งานง่าย ๆ', body: 'ดูดวงส่วนตัวรายวันทางไลน์ ทำตามแค่ 4 ขั้นตอนนี้', footer: 'ดูดวง by Prinnie · @prinnie333' },
  { badge: '1', kicker: 'ขั้นตอนที่ 1', title: 'แอดเพื่อนในไลน์', body: 'เปิดแอปไลน์ กดแท็บค้นหา พิมพ์ไอดี @prinnie333 (มีเครื่องหมาย @ ด้วย) แล้วกดปุ่มเพิ่มเพื่อน', footer: 'ไอดี : @prinnie333' },
  { badge: '2', kicker: 'ขั้นตอนที่ 2', title: 'กรอกวันเกิด', body: 'แตะเมนูสมัครด้านล่างจอ ใส่วัน เดือน ปีเกิด เวลาเกิด และจังหวัดที่เกิด แล้วกดบันทึก', footer: '@prinnie333' },
  { badge: '3', kicker: 'ขั้นตอนที่ 3', title: 'รับพื้นดวงฟรี', body: 'ระบบจะคำนวณให้ทันที เห็นราศีอาทิตย์ จันทร์ ลัคนา และเลขชีวิตของคุณ ดูได้ฟรี', footer: '@prinnie333' },
  { badge: '4', kicker: 'ขั้นตอนที่ 4', title: 'เลือกเมนูดูดวง', body: 'แตะเมนูด้านล่างเพื่อเปิด ดวงวันนี้ ไพ่ทาโรต์ พื้นดวง หรือผูกดวงคู่กับคนพิเศษ', footer: '@prinnie333' },
  { badge: 'จ่าย', kicker: 'HOW TO PAY', title: 'สมัครสมาชิก', body: 'รับดวงรายวันส่วนตัวทุกเช้า เพียง 399 บาทต่อเดือน', footer: 'ปลอดภัย · ผ่านพร้อมเพย์' },
  { badge: '1', kicker: 'ขั้นตอนที่ 1', title: 'กดสมัครสมาชิก', body: 'แตะเมนูสมัครสมาชิก แล้วกดปุ่ม 399 บาทต่อเดือน ระบบจะสร้าง QR พร้อมเพย์ให้', footer: '@prinnie333' },
  { badge: '2', kicker: 'ขั้นตอนที่ 2', title: 'สแกน QR จ่ายเงิน', body: 'เปิดแอปธนาคารของคุณ กดสแกน QR ที่หน้าจอ ยอด 399 บาทจะขึ้นให้เอง ไม่ต้องพิมพ์', footer: '@prinnie333' },
  { badge: '3', kicker: 'ขั้นตอนที่ 3', title: 'โอนแล้วแคปสลิป', body: 'ตรวจสอบยอดให้ถูก แล้วกดโอนเงิน จากนั้นแคปหน้าจอเก็บภาพสลิปไว้', footer: '@prinnie333' },
  { badge: '4', kicker: 'ขั้นตอนที่ 4', title: 'ส่งสลิปในแชท', body: 'กลับมาที่แชทไลน์ Prinnie333 แล้วส่งรูปสลิปที่แคปไว้ เข้ามาในแชทได้เลย', footer: '@prinnie333' },
  { badge: '5', kicker: 'ขั้นตอนที่ 5', title: 'รอทีมงานยืนยัน', body: 'ทีมงานจะเปิดใช้งานสมาชิกให้ภายใน 24 ชม. แล้วคุณจะได้รับดวงส่วนตัวทุกเช้า 8 โมง', footer: '@prinnie333' },
];

const PROMO = [
  { badge: 'star', kicker: 'PRINNIE333', title: 'ดวง 12 ราศี... กว้างไป', body: 'คนราศีเดียวกันเป็นล้าน ดวงจะเหมือนกันได้ยังไง', footer: 'ดูดวง by Prinnie' },
  { badge: 'sun',  kicker: 'ต่างกันตรงนี้', title: 'ดวงเฉพาะคุณ', body: 'คำนวณจากวัน เวลา และสถานที่เกิดจริงของคุณ', footer: 'อาทิตย์ · จันทร์ · ลัคนา' },
  { badge: 'moon', kicker: 'ทุกเช้า 8 โมง', title: 'เหมือนมีหมอดูส่วนตัว', body: 'ดวงรายวันของคุณคนเดียว ส่งถึงแชทให้ทุกเช้า', footer: 'อิงดาวจรที่วิ่งสัมพันธ์กับดวงคุณ' },
  { badge: 'star', kicker: 'ไม่ใช่แค่ดวงรายวัน', title: 'ไพ่ทาโรต์ · ดวงคู่', body: 'เปิดไพ่ประจำวัน และดูดวงความรักกับคนพิเศษ', footer: 'ดูดวง by Prinnie' },
  { badge: 'ฟรี', kicker: 'เริ่มวันนี้', title: 'รับพื้นดวงฟรี', body: 'รู้จักดวงกำเนิดของคุณ ฟรี ไม่มีค่าใช้จ่าย', footer: 'สมาชิกรายเดือน 399 บาท' },
  { badge: 'LINE', kicker: 'แอดเลย', title: '@prinnie333', body: 'ทักมาแล้วเริ่มดูดวงส่วนตัวได้ทันที', footer: 'ดูดวง by Prinnie' },
];

function renderSet(name, data, dir) {
  fs.mkdirSync(dir, { recursive: true });
  data.forEach((c, i) => {
    const png = new Resvg(Buffer.from(card(c)),
      { fitTo: { mode: 'width', value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Sarabun' } }
    ).render().asPng();
    fs.writeFileSync(path.join(dir, `${name}-${String(i).padStart(2,'0')}.png`), png);
  });
  console.log(`  ✓ ${data.length} ${name} cards → ${dir}`);
}

const LAUNCH = { badge: 'ฟรี', kicker: 'เปิดตัวแล้ว', title: 'ดูดวงส่วนตัวรายวัน', body: 'รับพื้นดวงส่วนตัวฟรี รู้จักราศีอาทิตย์ จันทร์ ลัคนา และเลขชีวิตของคุณ', footer: 'แอด @prinnie333 เริ่มเลย' };

const which = process.argv[2];
const G = path.join(__dirname, '..', 'marketing');
if (which === 'launch') {
  const dir = path.join(G, 'broadcast'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'launch.png'), new Resvg(Buffer.from(card(LAUNCH)),
    { fitTo: { mode: 'width', value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Sarabun' } }).render().asPng());
  console.log('  ✓ launch image → marketing/broadcast/launch.png');
} else if (which === 'sample') {
  fs.mkdirSync('/tmp/vcard', { recursive: true });
  fs.writeFileSync('/tmp/vcard/s.png', new Resvg(Buffer.from(card(PROMO[2])),
    { fitTo: { mode: 'width', value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Sarabun' } }).render().asPng());
  console.log('sample → /tmp/vcard/s.png');
} else {
  renderSet('tut', TUTORIAL, path.join(G, 'guide', '9x16'));
  renderSet('promo', PROMO, path.join(G, 'promo-new'));
}
