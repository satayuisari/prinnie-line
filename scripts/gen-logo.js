// สร้างโลโก้ Prinnie333 (wordmark + crescent emblem) เป็น PNG พื้นโปร่ง
// ทอง #D4AF37 บนพื้นโปร่ง — ใช้ Sarabun-ExtraBold (bundle ใน assets/fonts)
// รัน: node scripts/gen-logo.js   → ออกที่ scripts/../  (ระบุปลายทางในตัวแปร OUT)

const { Resvg } = require('@resvg/resvg-js');
const fs   = require('fs');
const path = require('path');

const GOLD   = '#D4AF37';
const PURPLE = '#5B2A86';
const FONT   = path.join(__dirname, '..', 'assets', 'fonts', 'Sarabun-ExtraBold.ttf');
const FONT_R = path.join(__dirname, '..', 'assets', 'fonts', 'Sarabun-Regular.ttf');

// อาร์กิวเมนต์: โฟลเดอร์ปลายทาง (ดีฟอลต์ = Desktop ad kit)
const OUT = process.argv[2] || 'C:/Users/b/Desktop/prinnie333-ad-kit/logo';
fs.mkdirSync(OUT, { recursive: true });

// crescent moon — วงกลมใหญ่ลบวงกลมเยื้อง (evenodd) + ดาวประกาย
function emblem(cx, cy, r, color) {
  const off = r * 0.42;
  return `
    <path fill-rule="evenodd" fill="${color}"
      d="M ${cx-r},${cy} a ${r},${r} 0 1,0 ${2*r},0 a ${r},${r} 0 1,0 ${-2*r},0 Z
         M ${cx-r+off},${cy} a ${r*0.92},${r*0.92} 0 1,0 ${2*r*0.92},0 a ${r*0.92},${r*0.92} 0 1,0 ${-2*r*0.92},0 Z"/>
    <g fill="${color}">
      <path d="M ${cx+r*0.55},${cy-r*0.75} l ${r*0.07},${r*0.2} l ${r*0.2},${r*0.07} l ${-r*0.2},${r*0.07} l ${-r*0.07},${r*0.2} l ${-r*0.07},${-r*0.2} l ${-r*0.2},${-r*0.07} l ${r*0.2},${-r*0.07} Z"/>
    </g>`;
}

// ── 1) แนวนอน: emblem ซ้าย + wordmark (พื้นโปร่ง) ──
function horizontal() {
  const W = 2000, H = 560;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${emblem(260, 280, 165, GOLD)}
    <text x="540" y="300" font-family="Sarabun" font-weight="800" font-size="210"
          fill="${GOLD}" letter-spacing="6" dominant-baseline="middle">PRINNIE333</text>
    <text x="546" y="430" font-family="Sarabun" font-weight="400" font-size="74"
          fill="${GOLD}" letter-spacing="14" opacity="0.92">ดวงส่วนตัวรายวัน</text>
  </svg>`;
}

// ── 2) แนวตั้ง: emblem บน + wordmark ล่าง (พื้นโปร่ง) ──
function stacked() {
  const W = 1200, H = 1200;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${emblem(600, 420, 230, GOLD)}
    <text x="600" y="800" text-anchor="middle" font-family="Sarabun" font-weight="800"
          font-size="190" fill="${GOLD}" letter-spacing="4">PRINNIE333</text>
    <text x="600" y="930" text-anchor="middle" font-family="Sarabun" font-weight="400"
          font-size="70" fill="${GOLD}" letter-spacing="12" opacity="0.92">ดวงส่วนตัวรายวัน</text>
  </svg>`;
}

// ── 3) badge กลม: ทองบนวงม่วง (สำหรับพื้นสว่าง / โปรไฟล์) ──
function badge() {
  const S = 1080, c = S/2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <circle cx="${c}" cy="${c}" r="${c-12}" fill="${PURPLE}"/>
    <circle cx="${c}" cy="${c}" r="${c-40}" fill="none" stroke="${GOLD}" stroke-width="6" opacity="0.7"/>
    ${emblem(c, 420, 175, GOLD)}
    <text x="${c}" y="720" text-anchor="middle" font-family="Sarabun" font-weight="800"
          font-size="150" fill="${GOLD}" letter-spacing="2">PRINNIE333</text>
    <text x="${c}" y="830" text-anchor="middle" font-family="Sarabun" font-weight="400"
          font-size="56" fill="#FFFFFF" letter-spacing="10" opacity="0.9">ดวงส่วนตัวรายวัน</text>
  </svg>`;
}

function render(svg, file) {
  const r = new Resvg(svg, {
    font: { fontFiles: [FONT, FONT_R], defaultFontFamily: 'Sarabun', loadSystemFonts: false },
    background: 'rgba(0,0,0,0)',
  });
  const png = r.render().asPng();
  const out = path.join(OUT, file);
  fs.writeFileSync(out, png);
  console.log(`  ✓ ${file}  (${(png.length/1024).toFixed(0)} KB)`);
}

console.log(`Logo → ${OUT}`);
render(horizontal(), 'logo-horizontal-gold.png');
render(stacked(),    'logo-stacked-gold.png');
render(badge(),      'logo-badge-purple.png');
console.log('Done.');
