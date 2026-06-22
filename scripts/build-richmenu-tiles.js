// ประกอบ rich menu จากไอคอน AI 6 รูป (richmenu/icons/*.png) เป็น "ไทล์เรืองแสง" 6 ช่อง
// + วางป้ายข้อความไทย + เส้นแบ่งทอง + กรอบทอง → richmenu/richmenu.jpg
//   node scripts/build-richmenu-tiles.js
const fs   = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

const DIR  = path.join(__dirname, '..', 'richmenu');
const ICON = path.join(DIR, 'icons');
const out  = path.join(DIR, 'richmenu.jpg');
const W = 2500, H = 1686;

// 6 ช่อง: cols 833/834/833, rows 843/843
const cells = [
  { name: 'daily',   x: 0,    y: 0,   w: 833, h: 843, label: 'ดูดวงวันนี้' },
  { name: 'natal',   x: 833,  y: 0,   w: 834, h: 843, label: 'พื้นดวงของฉัน' },
  { name: 'tarot',   x: 1667, y: 0,   w: 833, h: 843, label: 'ไพ่ทาโรต์' },
  { name: 'couple',  x: 0,    y: 843, w: 833, h: 843, label: 'ผูกดวงคู่' },
  { name: 'signup',  x: 833,  y: 843, w: 834, h: 843, label: 'สมัคร / ต่ออายุ' },
  { name: 'profile', x: 1667, y: 843, w: 833, h: 843, label: 'โปรไฟล์ของฉัน' },
];

(async () => {
  // 0) พื้นหลังเดียวทั้งใบ (สม่ำเสมอ) — กัน "รอยต่อ" ระหว่างไทล์
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#2a1147"/><stop offset="55%" stop-color="#180a30"/>
      <stop offset="100%" stop-color="#0c0320"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/></svg>`;
  const bgPng = new Resvg(Buffer.from(bgSvg), { fitTo: { mode: 'width', value: W } }).render().asPng();
  const base = sharp(bgPng);

  // 1) ไทล์ไอคอน: crush เงาให้พื้นไอคอนเป็นดำ แล้ว blend 'screen' → เหลือเฉพาะทอง/แสงเรือง
  //    พื้นหลังของแต่ละไอคอนจึงหายไป เห็นพื้นเดียวร่วมกัน = ไม่มีรอยต่อ
  const tiles = [];
  for (const c of cells) {
    const p = path.join(ICON, `icon-${c.name}.png`);
    if (!fs.existsSync(p)) { console.error('ขาดไฟล์:', p); process.exit(1); }
    const buf = await sharp(p)
      .resize(c.w, c.h, { fit: 'cover', position: 'centre' })
      .linear(1.25, -28)            // ดันเงาเข้ม → พื้นไอคอนเกือบดำ (screen จะดรอปทิ้ง)
      .toBuffer();
    tiles.push({ input: buf, left: c.x, top: c.y, blend: 'screen' });
  }

  // 2) overlay: scrim ล่างแต่ละช่อง + ป้ายข้อความ + เส้นแบ่ง + กรอบทอง
  const scrimH = 200;
  const scrims = cells.map(c =>
    `<rect x="${c.x}" y="${c.y + c.h - scrimH}" width="${c.w}" height="${scrimH}" fill="url(#scrim)"/>`).join('');
  const labels = cells.map(c => {
    const cx = c.x + c.w / 2;
    const by = c.y + c.h - 56;
    return `<text x="${cx}" y="${by}">${c.label}</text>`;
  }).join('');
  const accents = cells.map(c => {
    const cx = c.x + c.w / 2;
    const ay = c.y + c.h - 150;
    return `<g transform="translate(${cx},${ay}) rotate(45)"><rect x="-6" y="-6" width="12" height="12"/></g>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
       font-family="'Leelawadee UI','Tahoma','Noto Sans Thai',sans-serif">
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0%" stop-color="#fff7e2"/><stop offset="40%" stop-color="#f3d98f"/>
        <stop offset="100%" stop-color="#c79a4e"/>
      </linearGradient>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0c0320" stop-opacity="0"/>
        <stop offset="100%" stop-color="#0a0218" stop-opacity="0.86"/>
      </linearGradient>
    </defs>
    ${scrims}
    <!-- เส้นแบ่งทอง -->
    <g stroke="url(#gold)" stroke-opacity="0.42" stroke-width="3">
      <line x1="833" y1="40" x2="833" y2="1646"/>
      <line x1="1667" y1="40" x2="1667" y2="1646"/>
      <line x1="40" y1="843" x2="2460" y2="843"/>
    </g>
    <!-- ป้ายข้อความ -->
    <g text-anchor="middle" font-size="62" font-weight="600" letter-spacing="2"
       fill="#f7edcf" stroke="#0a0218" stroke-width="6" paint-order="stroke" stroke-linejoin="round">
      ${labels}
    </g>
    <g fill="url(#gold)" opacity="0.85">${accents}</g>
    <!-- กรอบทอง + เพชรมุม -->
    <rect x="46" y="46" width="2408" height="1594" rx="26" fill="none" stroke="url(#gold)" stroke-width="3" stroke-opacity="0.6"/>
    <rect x="62" y="62" width="2376" height="1562" rx="18" fill="none" stroke="#f3d488" stroke-width="1" stroke-opacity="0.3"/>
    <g fill="url(#gold)">
      <g transform="translate(46,46) rotate(45)"><rect x="-9" y="-9" width="18" height="18"/></g>
      <g transform="translate(2454,46) rotate(45)"><rect x="-9" y="-9" width="18" height="18"/></g>
      <g transform="translate(46,1640) rotate(45)"><rect x="-9" y="-9" width="18" height="18"/></g>
      <g transform="translate(2454,1640) rotate(45)"><rect x="-9" y="-9" width="18" height="18"/></g>
    </g>
  </svg>`;

  const overlay = new Resvg(Buffer.from(svg), { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } }).render().asPng();

  const buf = await base.composite([...tiles, { input: overlay, left: 0, top: 0 }]).jpeg({ quality: 90 }).toBuffer();
  fs.writeFileSync(out, buf);
  console.log(`✅ richmenu.jpg  ${W}x${H}  ${(buf.length/1024).toFixed(1)} KB ` + (buf.length < 1024*1024 ? '(< 1MB ✅)' : '⚠️ เกิน 1MB'));
})().catch(e => { console.error(e.message); process.exit(1); });
