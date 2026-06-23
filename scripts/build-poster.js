// ประกอบโปสเตอร์พร้อมโพสต์: เอา key visual (marketing/art/concept-*.png)
// + composite พาดหัวไทย + ซับ + ปุ่ม CTA ทอง → marketing/posters/poster-*.jpg
//   node scripts/build-poster.js                 (ทุกใบ ฟอร์แมต feed 4:5)
//   node scripts/build-poster.js couple           (เฉพาะ couple, feed)
//   node scripts/build-poster.js story            (ทุกใบ, 9:16)
//   node scripts/build-poster.js couple story     (couple, 9:16)
// ใช้ resvg (loadSystemFonts → ฟอนต์ไทย) + sharp composite (pipeline เดียวกับ rich menu)
const fs   = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

const ART = path.join(__dirname, '..', 'marketing', 'art');
const OUT = path.join(__dirname, '..', 'marketing', 'posters');
fs.mkdirSync(OUT, { recursive: true });
// ฟอนต์ไทย: Tahoma จัดสระ ำ + วรรณยุกต์ (รวมเคสยาก น้ำ/ค่ำ) ถูกต้องสุดใน resvg
// (Leelawadee ตัวหนาเบียดนิคหิตของ ำ จนเพี้ยน) + ห้าม letter-spacing กับไทย
const FONT = "'Tahoma','Leelawadee UI','Noto Sans Thai',sans-serif";

const FORMATS = {
  feed:   { w: 896,  h: 1216, art: '',      out: '' },        // 4:5 — IG/FB feed + LINE
  story:  { w: 832,  h: 1472, art: '-9x16', out: '-9x16' },   // 9:16 — Shorts/Stories/VOOM
  square: { w: 1080, h: 1080, art: '-1x1',  out: '-1x1' },    // 1:1 — IG square + LINE rich message
  wide:   { w: 1200, h: 628,  art: '-wide', out: '-wide' },   // ~1.91:1 — LINE broadcast / FB link / web OG
};

// พาดหัว/ซับ/CTA ต่อคอนเซ็ปต์ — หลักการ: ขายความเป็นส่วนตัว ไม่พูดราคา
// ⚠️ เลี่ยงลำดับ "ำ ตามด้วยสระหน้า (เ แ โ ใ ไ)" — resvg shape ผิด (เช่น "คำแนะนำเฉพาะ" เพี้ยน)
const POSTERS = {
  personal: {
    head: ['ราศีเดียวกัน', 'ดวงไม่เหมือนกัน'],
    sub:  'ดวงส่วนตัวจากวันเกิด เวลา และสถานที่ของคุณคนเดียว',
    cta:  'รับพื้นดวงส่วนตัว ฟรี  ·  แอด LINE @prinnie333',
  },
  daily: {
    head: ['ทุกเช้า', 'เริ่มด้วยดวงที่รู้จักคุณ'],
    sub:  'คำแนะนำส่วนตัว ส่งถึงคุณทุกเช้า บน LINE',
    cta:  'แอด LINE ฟรี  ·  @prinnie333',
  },
  couple: {
    head: ['เราเข้ากันกี่ %?'],
    sub:  'ผูกดวงคู่จากวันเกิดจริงของสองคน',
    cta:  'ลองเช็กฟรี  ·  แอด LINE @prinnie333',
  },
};

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildSvg(p, W, H) {
  const compact = H < 800;   // wide/landscape banner → ย่อข้อความให้พอดี
  const multi = p.head.length > 1;
  const headSize = compact ? (multi ? 54 : 66) : (multi ? 78 : 92);
  const headLineH = headSize + (compact ? 12 : 22);
  const headStartY = compact ? 96 : 150;
  const subSize = compact ? 32 : 40;
  const ctaSize = compact ? 30 : 34;
  const pillH = compact ? 72 : 92;
  const headEls = p.head.map((line, i) =>
    `<text x="${W/2}" y="${headStartY + i*headLineH}">${esc(line)}</text>`).join('');

  const pillW = Math.min(W - 70, 790), pillX = (W - pillW)/2, pillY = H - (compact ? 110 : 150);
  const subY = pillY - (compact ? 30 : 46);
  const scrimH = compact ? Math.round(H * 0.55) : 460;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
       font-family="${FONT}">
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff7e2"/><stop offset="45%" stop-color="#f3d98f"/>
        <stop offset="100%" stop-color="#c79a4e"/>
      </linearGradient>
      <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0c0320" stop-opacity="0.74"/>
        <stop offset="100%" stop-color="#0c0320" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="botScrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0a0218" stop-opacity="0"/>
        <stop offset="45%" stop-color="#0a0218" stop-opacity="0.62"/>
        <stop offset="100%" stop-color="#0a0218" stop-opacity="0.97"/>
      </linearGradient>
    </defs>

    <rect x="0" y="0" width="${W}" height="${scrimH}" fill="url(#topScrim)"/>
    <rect x="0" y="${H-scrimH}" width="${W}" height="${scrimH}" fill="url(#botScrim)"/>

    <!-- พาดหัว (stroke บาง + ไม่มี letter-spacing → สระ/วรรณยุกต์ไทยไม่ซ้อน) -->
    <g text-anchor="middle" font-size="${headSize}" font-weight="700"
       fill="#fdf6e3" stroke="#0a0218" stroke-width="2.5" paint-order="stroke" stroke-linejoin="round">
      ${headEls}
    </g>
    <rect x="${W/2-70}" y="${headStartY + p.head.length*headLineH - 30}" width="140" height="4" rx="2" fill="url(#gold)"/>

    <!-- ซับ: ไม่มี stroke (stroke ทำให้ เ+ฉ เบียดที่ขนาดเล็ก) → พึ่ง scrim เข้มแทน -->
    <text x="${W/2}" y="${subY}" text-anchor="middle" font-size="${subSize}" font-weight="400"
          fill="#f6ecd2">${esc(p.sub)}</text>

    <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH/2}"
          fill="url(#gold)" stroke="#fff7e2" stroke-width="1.5"/>
    <text x="${W/2}" y="${pillY + pillH/2 + ctaSize*0.36}" text-anchor="middle" font-size="${ctaSize}" font-weight="700"
          fill="#2a1147">${esc(p.cta)}</text>
  </svg>`;
}

async function build(name, fmt) {
  const p = POSTERS[name];
  if (!p) { console.error('ไม่รู้จักโปสเตอร์:', name); return; }
  const basePath = path.join(ART, `concept-${name}${fmt.art}.png`);
  if (!fs.existsSync(basePath)) { console.error('ขาด key visual:', basePath); return; }

  const overlay = new Resvg(Buffer.from(buildSvg(p, fmt.w, fmt.h)),
    { fitTo: { mode: 'width', value: fmt.w }, font: { loadSystemFonts: true } }).render().asPng();

  const base = await sharp(basePath).resize(fmt.w, fmt.h, { fit: 'cover', position: 'centre' }).toBuffer();
  const buf  = await sharp(base).composite([{ input: overlay, left: 0, top: 0 }]).jpeg({ quality: 92 }).toBuffer();
  const file = path.join(OUT, `poster-${name}${fmt.out}.jpg`);
  fs.writeFileSync(file, buf);
  console.log(`✅ ${file}  ${fmt.w}x${fmt.h}  ${(buf.length/1024).toFixed(1)} KB`);
}

(async () => {
  const argv = process.argv.slice(2);
  const fmtKey = argv.find(a => FORMATS[a]) || 'feed';
  const name = argv.find(a => POSTERS[a]);
  const fmt = FORMATS[fmtKey];
  const names = name ? [name] : Object.keys(POSTERS);
  for (const n of names) await build(n, fmt);
})().catch(e => { console.error(e.message); process.exit(1); });
