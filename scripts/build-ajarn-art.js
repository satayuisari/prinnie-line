// อาร์ตเวิร์กโปรโมทอาจารย์ปรินนี่ — สร้างจาก SVG ล้วน แก้คำแล้ว build ใหม่ได้ทันที
//   node scripts/build-ajarn-art.js              ทุกแบบ ทุกขนาด
//   node scripts/build-ajarn-art.js written      เฉพาะแบบเดียว
//
// ⚠️ ภาษาไทยใน resvg: ใช้ Tahoma · ห้าม letter-spacing · เลี่ยง "ำ" ตามด้วยสระหน้า (เ แ โ ใ ไ)
//    ตรวจคำก่อนแก้ทุกครั้ง เช่น "ดวงกำเนิด" ใช้ไม่ได้ → ใช้ "ดวงเกิด"
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, '..', 'marketing', 'campaign');
fs.mkdirSync(OUT, { recursive: true });
const FONT = "'Tahoma','Noto Sans Thai',sans-serif";

const SIZES = { feed: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } };

// ตัวเลขทั้งหมดมาจาก production จริง (24 ส.ค. 2026) — ห้ามใส่เลขที่ตรวจไม่ได้
const POSTERS = {
  written: {
    kicker: 'อาจารย์ปรินนี่ · Prinnie333',
    big: '5,280',
    bigSub: 'บทคำทำนาย',
    head: ['อาจารย์เขียนเองทุกบท'],
    body: ['ไม่ได้ให้ AI แต่ง ไม่ได้ก๊อปจากที่ไหน', 'เพราะดวงคนเราไม่ควรถูกเดาส่ง ๆ'],
    cta: 'รับดวงของตัวเองจริง ๆ · LINE @prinnie333',
  },
  yours: {
    kicker: 'อาจารย์ปรินนี่ · Prinnie333',
    big: null,
    head: ['ดวงของคุณ', 'ไม่ใช่ดวงของราศี'],
    body: ['ดวงราศีเดียวกันอ่านเหมือนกันหมด เพราะดูแค่ราศี',
           'อาจารย์อ่านจาก วัน เวลา และสถานที่เกิดของคุณ',
           'ดาวจรวันนี้ทำมุมกับดวงเกิดคุณ ไม่เหมือนใคร'],
    cta: 'ลองรับดวงของตัวเองสักครั้ง · LINE @prinnie333',
  },
  daily: {
    kicker: 'อาจารย์ปรินนี่ · Prinnie333',
    big: '13,503',
    bigSub: 'ครั้งที่ส่งดวงถึงมือลูกค้า',
    head: ['ทุกเช้า มีคนรอดวงของตัวเอง'],
    body: ['ไม่ใช่ดวงรวม ๆ ที่ใครอ่านก็ได้', 'แต่เป็นดวงที่คำนวณจากวันเกิดของคุณคนเดียว'],
    cta: 'สมาชิก 399 บาท/เดือน · LINE @prinnie333',
  },
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function stars(W, H, n) {
  let seed = 24082026;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<circle cx="${Math.round(rnd() * W)}" cy="${Math.round(rnd() * H)}" r="${(rnd() * 1.5 + 0.4).toFixed(1)}"
             fill="#F8D98A" opacity="${(rnd() * 0.45 + 0.2).toFixed(2)}"/>`;
  }
  return out;
}

function buildSvg(p, W, H) {
  const S = W / 1080;
  const kickSize = Math.round(30 * S);
  const bigSize = Math.round(190 * S);
  const headSize = Math.round((p.head.length > 1 ? 76 : 66) * S);
  const bodySize = Math.round(34 * S);
  const ctaSize = Math.round(30 * S);

  // วัดความสูงของบล็อกข้อความก่อน แล้วค่อยจัดให้อยู่กลางภาพ
  // (เดิมตรึงจากขอบบน พอเป็นภาพ 9:16 เนื้อหาเลยกองครึ่งบน เหลือที่ว่างข้างล่างเป็นแถบใหญ่)
  const gapKick = Math.round(120 * S);
  const hBig = p.big ? bigSize * 0.72 + Math.round(56 * S) + Math.round(120 * S) : 0;
  const hHead = headSize * (p.head.length > 1 ? 1.15 * p.head.length : 0.6);
  const hBody = Math.round(78 * S) + p.body.length * bodySize * 1.6;
  const blockH = gapKick + hBig + hHead + hBody;

  const top = (H - blockH) / 2 - Math.round(40 * S);   // เยื้องขึ้นนิดหน่อย ให้ดูสมดุลตา
  const kickY = top;
  const bigY = p.big ? kickY + gapKick + bigSize * 0.62 : null;
  const bigSubY = p.big ? bigY + Math.round(56 * S) : null;
  const headY = p.big ? bigSubY + Math.round(120 * S) : kickY + gapKick + headSize * 0.8;
  const bodyY = headY + hHead + Math.round(78 * S);
  const ctaY = H - Math.round(96 * S);

  const headEls = p.head.map((l, i) =>
    `<text x="${W / 2}" y="${headY + i * headSize * 1.22}" text-anchor="middle"
       font-size="${headSize}" font-weight="700" fill="#F6F1FF">${esc(l)}</text>`).join('');
  const bodyEls = p.body.map((l, i) =>
    `<text x="${W / 2}" y="${bodyY + i * bodySize * 1.6}" text-anchor="middle"
       font-size="${bodySize}" font-weight="400" fill="#CFC2EC">${esc(l)}</text>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#1B0B3A"/><stop offset="55%" stop-color="#2D0A5A"/><stop offset="100%" stop-color="#12071F"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%">
      <stop offset="0%" stop-color="#C77DFF" stop-opacity=".26"/><stop offset="100%" stop-color="#C77DFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF7E2"/><stop offset="45%" stop-color="#F3D98F"/><stop offset="100%" stop-color="#C79A4E"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${stars(W, H, 130)}
  <ellipse cx="${W / 2}" cy="${H * 0.42}" rx="${W * 0.62}" ry="${H * 0.34}" fill="url(#glow)"/>

  <text x="${W / 2}" y="${kickY}" text-anchor="middle" font-size="${kickSize}" font-weight="700"
        fill="#E8C4F7" opacity=".85">${esc(p.kicker)}</text>

  ${p.big ? `<text x="${W / 2}" y="${bigY}" text-anchor="middle" font-size="${bigSize}" font-weight="700"
        fill="url(#gold)">${esc(p.big)}</text>
  <text x="${W / 2}" y="${bigSubY}" text-anchor="middle" font-size="${Math.round(36 * S)}" font-weight="400"
        fill="#E8C4F7">${esc(p.bigSub)}</text>` : ''}

  ${headEls}
  ${bodyEls}

  <text x="${W / 2}" y="${ctaY}" text-anchor="middle" font-size="${ctaSize}" font-weight="700"
        fill="#E8C77A">${esc(p.cta)}</text>
</svg>`;
}

const only = process.argv[2];
const targets = only ? { [only]: POSTERS[only] } : POSTERS;
if (only && !POSTERS[only]) {
  console.error('แบบที่มี:', Object.keys(POSTERS).join(', '));
  process.exit(1);
}

for (const [name, p] of Object.entries(targets)) {
  for (const [size, f] of Object.entries(SIZES)) {
    const png = new Resvg(buildSvg(p, f.w, f.h),
      { fitTo: { mode: 'width', value: f.w }, font: { loadSystemFonts: true } }).render().asPng();
    const file = path.join(OUT, `ajarn-${name}-${size}.png`);
    fs.writeFileSync(file, png);
    console.log(`✓ ${path.relative(process.cwd(), file)}  ${f.w}×${f.h}  ${(png.length / 1024).toFixed(0)}KB`);
  }
}
