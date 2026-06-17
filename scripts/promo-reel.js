// Reel โปรโม Prinnie333: พื้นหลังวิดีโอ MJ (เคลื่อนไหว) + ซ้อนข้อความ/ไอคอน/CTA คมชัด
// 1) เรนเดอร์ overlay PNG โปร่งใส (resvg)  2) ffmpeg: อัปสเกล bg + overlay + วน 15 วิ
// รัน: node scripts/promo-reel.js "<path-to-bg.mp4>"
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const W = 1080, H = 1920, DUR = 15;
const FONT = 'C:/Windows/Fonts/LeelaUIb.ttf';
const OUT_DIR = path.join(__dirname, '..', 'video');
const GOLD = '#E7C66B', GOLD2 = '#F6E2A0', WHITE = '#F6F1FF', INK = '#2A1438';

const BG = process.argv[2];
if (!BG || !fs.existsSync(BG)) { console.error('ใส่ path ของ bg.mp4 เป็น argument'); process.exit(1); }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, s, size, fill, op = 1, ls = 0, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-family="Leelawadee UI" font-size="${size}" fill="${fill}" fill-opacity="${op}" text-anchor="${anchor}"${ls ? ` letter-spacing="${ls}"` : ''}>${esc(s)}</text>`;

function sun(cx, cy, r) {
  let rays = '';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; rays += `<line x1="${cx + Math.cos(a) * r * 1.35}" y1="${cy + Math.sin(a) * r * 1.35}" x2="${cx + Math.cos(a) * r * 1.7}" y2="${cy + Math.sin(a) * r * 1.7}" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>`; }
  return `${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD2}" stroke-width="3.5"/>`;
}
function moon(cx, cy, r) {
  return `<path d="M ${cx + r * 0.35} ${cy - r} A ${r} ${r} 0 1 0 ${cx + r * 0.35} ${cy + r} A ${r * 0.8} ${r * 0.8} 0 1 1 ${cx + r * 0.35} ${cy - r} Z" fill="none" stroke="${GOLD2}" stroke-width="3.5"/>`;
}
function card(cx, cy, r) {
  const w = r * 1.4, h = r * 2;
  return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="8" fill="none" stroke="${GOLD2}" stroke-width="3.5"/>` + star4(cx, cy, r * 0.4);
}
function star4(cx, cy, r) {
  return `<path d="M ${cx} ${cy - r} Q ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z" fill="${GOLD2}"/>`;
}
function couple(cx, cy, r) {
  return `<circle cx="${cx - r * 0.55}" cy="${cy}" r="${r * 0.75}" fill="none" stroke="${GOLD2}" stroke-width="3.5"/><circle cx="${cx + r * 0.55}" cy="${cy}" r="${r * 0.75}" fill="none" stroke="${GOLD2}" stroke-width="3.5"/>`;
}

// ตัวคั่นจุดประ
function divider(cx, y, w) {
  return `<line x1="${cx - w / 2}" y1="${y}" x2="${cx + w / 2}" y2="${y}" stroke="${GOLD}" stroke-width="2" stroke-opacity="0.7" stroke-dasharray="3 10"/>` + star4(cx, y, 8);
}

const feats = [
  { x: 195, icon: sun,    label: 'พื้นดวงส่วนตัว' },
  { x: 430, icon: moon,   label: 'ดวงรายวัน' },
  { x: 655, icon: card,   label: 'ไพ่ทาโรต์' },
  { x: 885, icon: couple, label: 'ผูกดวงคู่' },
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#0A0614" stop-opacity="0.55"/>
    <stop offset="35%" stop-color="#0A0614" stop-opacity="0.30"/>
    <stop offset="60%" stop-color="#0A0614" stop-opacity="0.42"/>
    <stop offset="100%" stop-color="#0A0614" stop-opacity="0.70"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#scrim)"/>
${text(W / 2, 330, 'PRINNIE333', 44, GOLD, 0.95, 16)}
${star4(W / 2, 380, 9)}
${text(W / 2, 690, 'ดวงของคุณ', 92, WHITE, 1)}
${text(W / 2, 810, 'ไม่เหมือนใคร', 116, GOLD2, 1)}
${text(W / 2, 900, 'ดวงส่วนตัวจากวันเกิดจริง', 40, WHITE, 0.92)}
${text(W / 2, 955, 'ไม่ใช่ดวง 12 ราศีทั่วไป', 40, WHITE, 0.85)}
${divider(W / 2, 1040, 360)}
${feats.map(f => f.icon(f.x, 1150, 38)).join('')}
${feats.map(f => text(f.x, 1245, f.label, 33, WHITE, 0.95)).join('')}
<rect x="${W / 2 - 320}" y="1360" width="640" height="170" rx="85" fill="${GOLD2}"/>
${text(W / 2, 1430, 'รับพื้นดวงฟรี', 52, INK, 1)}
${text(W / 2, 1495, 'LINE  @prinnie333', 40, INK, 0.92, 1)}
</svg>`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const overlayPath = path.join(OUT_DIR, '_overlay.png');
fs.writeFileSync(overlayPath, new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: [FONT], defaultFontFamily: 'Leelawadee UI' } }).render().asPng());
console.log('overlay เรนเดอร์แล้ว — ประกอบวิดีโอ...');

const out = path.join(OUT_DIR, 'prinnie-reel-9x16.mp4');
execFileSync(ffmpeg, [
  '-y', '-stream_loop', '-1', '-t', String(DUR), '-i', BG,
  '-i', overlayPath,
  '-filter_complex',
  '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,eq=saturation=1.15[bg];' +
  '[bg][1:v]overlay=0:0:format=auto,fade=t=in:st=0:d=0.8[v]',
  '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
  '-t', String(DUR), '-movflags', '+faststart', out,
], { stdio: ['ignore', 'ignore', 'inherit'] });
console.log('✅ เสร็จ:', out);
