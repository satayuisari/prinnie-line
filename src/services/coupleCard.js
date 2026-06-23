// การ์ดผูกดวงคู่แชร์ได้ — render รูป 1080x1080 โชว์คะแนน % ใหญ่ + ชื่อ + แบรนด์ + CTA
// render ตอน runtime ด้วยฟอนต์ไทย Sarabun ที่ bundle มา (assets/fonts) → ทำงานบน Linux/Railway
// ใช้พื้นหลังจาก marketing/art/concept-couple-1x1.png
const fs   = require('fs');
const path = require('path');
// lazy-require: ไม่โหลด sharp/resvg ตอน boot (กัน server ล่มถ้า native module มีปัญหา) — โหลดตอน render ครั้งแรก
let Resvg, sharp;
function lazyDeps() {
  if (!Resvg) Resvg = require('@resvg/resvg-js').Resvg;
  if (!sharp) sharp = require('sharp');
}

const ROOT   = path.join(__dirname, '..', '..');
const BG     = path.join(ROOT, 'marketing', 'art', 'concept-couple-1x1.png');
const FONTS  = ['Sarabun-Regular.ttf', 'Sarabun-Bold.ttf', 'Sarabun-ExtraBold.ttf']
  .map(f => path.join(ROOT, 'assets', 'fonts', f));
const W = 1080, H = 1080;
const OA = process.env.LINE_OA_ID || '@prinnie333';

// แถบคำตามคะแนน (เลี่ยงลำดับ "ำ + สระหน้า" ที่ resvg shape เพี้ยน + ไม่ใส่อิโมจิ — Sarabun ไม่มี glyph)
function band(score) {
  if (score >= 90) return 'ดวงคู่แท้';
  if (score >= 80) return 'เข้ากันสุด ๆ';
  if (score >= 70) return 'ไปด้วยกันได้ดี';
  if (score >= 60) return 'เคมีน่าสนใจ';
  return 'ต่างขั้วดึงดูดกัน';
}

// หัวใจทอง (วาดด้วย path — ไม่พึ่งฟอนต์อิโมจิ) วางกลางที่ (cx,cy) สเกล s
function heart(cx, cy, s) {
  return `<g transform="translate(${cx},${cy}) scale(${s})"><path fill="url(#gold)"
    d="M0,14 C-10,2 -30,-4 -30,-20 C-30,-32 -18,-38 -8,-32 C-3,-29 0,-24 0,-24 C0,-24 3,-29 8,-32 C18,-38 30,-32 30,-20 C30,-4 10,2 0,14 Z"/></g>`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSvg({ score, a, b }) {
  const me = esc((a || 'คุณ').slice(0, 18));
  const you = esc((b || 'คู่ของคุณ').slice(0, 18));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Sarabun">
    <defs>
      <radialGradient id="glow" cx="50%" cy="46%" r="42%">
        <stop offset="0%" stop-color="#0a0218" stop-opacity="0.86"/>
        <stop offset="60%" stop-color="#0a0218" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#0a0218" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff7e2"/><stop offset="45%" stop-color="#f3d98f"/><stop offset="100%" stop-color="#c79a4e"/>
      </linearGradient>
      <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0c0320" stop-opacity="0.8"/><stop offset="100%" stop-color="#0c0320" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="botScrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0a0218" stop-opacity="0"/>
        <stop offset="50%" stop-color="#0a0218" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#0a0218" stop-opacity="0.95"/>
      </linearGradient>
    </defs>

    <rect x="0" y="0" width="${W}" height="240" fill="url(#topScrim)"/>
    <rect x="0" y="${H-360}" width="${W}" height="360" fill="url(#botScrim)"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#glow)"/>

    <!-- kicker บน -->
    <text x="${W/2}" y="96" text-anchor="middle" font-size="34" font-weight="700" fill="url(#gold)" letter-spacing="2">PRINNIE333 · ผูกดวงคู่</text>

    <!-- คะแนนใหญ่ -->
    <text x="${W/2}" y="430" text-anchor="middle" font-size="58" font-weight="700" fill="#f6ecd2">เข้ากัน</text>
    <text x="${W/2}" y="660" text-anchor="middle" font-size="320" font-weight="800" fill="url(#gold)" stroke="#0a0218" stroke-width="4" paint-order="stroke">${Number(score) || 0}%</text>
    <text x="${W/2}" y="752" text-anchor="middle" font-size="62" font-weight="700" fill="#fdf6e3">${band(Number(score) || 0)}</text>

    <!-- ชื่อคู่ + หัวใจทองตรงกลาง (ชื่อโตออกด้านนอก = จัดกลางได้เสมอ) -->
    <text x="${W/2 - 52}" y="858" text-anchor="end" font-size="46" font-weight="700" fill="#f3e7c9">${me}</text>
    ${heart(W/2, 842, 0.62)}
    <text x="${W/2 + 52}" y="858" text-anchor="start" font-size="46" font-weight="700" fill="#f3e7c9">${you}</text>

    <!-- CTA -->
    <rect x="${(W-820)/2}" y="958" width="820" height="86" rx="43" fill="url(#gold)" stroke="#fff7e2" stroke-width="1.5"/>
    <text x="${W/2}" y="1012" text-anchor="middle" font-size="36" font-weight="700" fill="#2a1147">เช็กดวงคู่ของคุณ · แอด LINE ${esc(OA)}</text>
  </svg>`;
}

// คืน Buffer ของ JPEG การ์ด
async function render(opts) {
  lazyDeps();
  const overlay = new Resvg(Buffer.from(buildSvg(opts)),
    { fitTo: { mode: 'width', value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Sarabun' } }
  ).render().asPng();
  const base = await sharp(BG).resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
  return sharp(base).composite([{ input: overlay, left: 0, top: 0 }]).jpeg({ quality: 90 }).toBuffer();
}

module.exports = { render, band };
