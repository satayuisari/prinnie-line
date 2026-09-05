// อาร์ตเวิร์กแคมเปญ "ดวงเลือกคุณ" — สร้างจาก SVG ล้วน ไม่ต้องพึ่งไฟล์ภาพต้นฉบับ
//   node scripts/build-campaign-art.js            สร้างทุกขนาด
//   node scripts/build-campaign-art.js feed       เฉพาะขนาดเดียว
//
// ⚠️ ข้อควรระวังภาษาไทยใน resvg (บทเรียนจาก build-poster.js):
//    - ใช้ Tahoma เท่านั้น (Leelawadee ตัวหนาเบียดนิคหิตของ ำ จนเพี้ยน)
//    - ห้ามใส่ letter-spacing กับข้อความไทย
//    - เลี่ยง "ำ" ตามด้วยสระหน้า (เ แ โ ใ ไ) → shape ผิด
//      จึงใช้คำว่า "ดวงเกิด" แทน "ดวงกำเนิด" ในอาร์ตเวิร์กทุกใบ
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, '..', 'marketing', 'campaign');
fs.mkdirSync(OUT, { recursive: true });

const FONT = "'Tahoma','Noto Sans Thai',sans-serif";

const FORMATS = {
  feed:   { w: 1080, h: 1350 },   // IG/FB feed
  story:  { w: 1080, h: 1920 },   // Stories / TikTok / VOOM
  square: { w: 1080, h: 1080 },   // LINE rich message
  wide:   { w: 1200, h: 628 },    // LINE broadcast / OG image
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ดาวกระจาย — ตำแหน่งคงที่ (seed ตายตัว) เพื่อให้ build ซ้ำได้ภาพเดิม
function stars(W, H, n) {
  let seed = 20260915;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = Math.round(rnd() * W), y = Math.round(rnd() * H);
    const r = (rnd() * 1.6 + 0.5).toFixed(1), o = (rnd() * 0.5 + 0.25).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#F8D98A" opacity="${o}"/>`;
  }
  return out;
}

// วงจักรราศี + เส้นมุมดาว — คือภาพแทนของกลไก "ดาวทำมุมกับดวงเกิด"
function chartWheel(cx, cy, R) {
  let g = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#E8C77A" stroke-opacity=".38" stroke-width="2"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R * 0.78}" fill="none" stroke="#E8C77A" stroke-opacity=".18" stroke-width="1.5"/>`;
  const pt = (i) => {
    const a = (i * 30 - 90) * Math.PI / 180;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  };
  for (let i = 0; i < 12; i++) {
    const [x, y] = pt(i);
    const [xi, yi] = [cx + R * 0.78 * Math.cos((i * 30 - 90) * Math.PI / 180),
                      cy + R * 0.78 * Math.sin((i * 30 - 90) * Math.PI / 180)];
    g += `<line x1="${xi.toFixed(1)}" y1="${yi.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
           stroke="#E8C77A" stroke-opacity=".3" stroke-width="1.5"/>`;
  }
  // เส้นมุมสำคัญ: ตรีโกณ (120°) + เล็ง (180°) — มุมที่แคมเปญใช้ตัดสินจริง
  // เอาแค่ 3 เส้นพอ เยอะกว่านี้กลายเป็นลายมั่วแทนที่จะสื่อว่า "ดาวทำมุมกับดวง"
  const aspects = [[0, 4], [4, 8], [2, 8]];
  for (const [a, b] of aspects) {
    const [x1, y1] = pt(a), [x2, y2] = pt(b);
    g += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
           stroke="#C77DFF" stroke-opacity=".3" stroke-width="1.2"/>`;
  }
  // จุดเด่น = ดวงที่ถูกเลือกเดือนนี้
  const [hx, hy] = pt(4);
  g += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="11" fill="#E8C77A"/>`;
  g += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="22" fill="none" stroke="#E8C77A" stroke-opacity=".45" stroke-width="2"/>`;
  return g;
}

function buildSvg(W, H) {
  const wide = H < 800;
  const S = W / 1080;                        // สเกลจากฐาน 1080
  const headSize = Math.round((wide ? 84 : 118) * (wide ? W / 1200 : S));
  const kickSize = Math.round((wide ? 24 : 30) * (wide ? W / 1200 : S));
  const subSize  = Math.round((wide ? 26 : 36) * (wide ? W / 1200 : S));
  const liSize   = Math.round((wide ? 22 : 32) * (wide ? W / 1200 : S));
  const ctaSize  = Math.round((wide ? 24 : 32) * (wide ? W / 1200 : S));

  // วงจักรราศีย่อลง ให้เหลือที่ให้ข้อความหายใจ (เดิมกินพื้นที่ 60% ข้อความอัดครึ่งล่าง)
  const wheelR = wide ? H * 0.36 : W * 0.235;
  const wheelCX = wide ? W - wheelR * 0.95 : W / 2;
  const wheelCY = wide ? H / 2 : wheelR + (wide ? 40 : 130 * S);

  const textX = wide ? 64 : W / 2;
  const anchor = wide ? 'start' : 'middle';

  const bullets = ['ครบ 14 วัน ดวงคุณเข้าการคำนวณอัตโนมัติ',
                   'ไม่มีการจับรางวัล ไม่ต้องรอคิว',
                   'ไม่มีค่าใช้จ่ายเพิ่ม'];

  // ไล่ระยะจากบนลงล่างแบบชัดเจน — เดิมคำนวณย้อนจากจุดกลางแล้ว kicker ไปทับหัวเรื่อง
  const kickY = wide ? 132 : wheelCY + wheelR + 116 * S;
  const headY = kickY + headSize * (wide ? 1.15 : 1.12);   // เว้นให้พ้นหางอักษรบนของพาดหัว
  // เว้นจากพาดหัวเยอะหน่อย — พาดหัวตัวใหญ่ หางสระล่าง (ุ) ยื่นลงมาเกือบชนบรรทัดรอง
  const subY  = headY + subSize * (wide ? 2.2 : 2.5);
  const liY   = subY + subSize * 1.35 + (wide ? 46 : 66 * S);
  const liGap = wide ? 34 : 52 * S;
  const ctaY  = H - (wide ? 48 : 84 * S);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#1B0B3A"/><stop offset="55%" stop-color="#2D0A5A"/><stop offset="100%" stop-color="#12071F"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%">
      <stop offset="0%" stop-color="#C77DFF" stop-opacity=".34"/><stop offset="100%" stop-color="#C77DFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF7E2"/><stop offset="45%" stop-color="#F3D98F"/><stop offset="100%" stop-color="#C79A4E"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${stars(W, H, wide ? 90 : 150)}
  <circle cx="${wheelCX}" cy="${wheelCY}" r="${wheelR * 1.7}" fill="url(#glow)"/>
  ${chartWheel(wheelCX, wheelCY, wheelR)}

  <text x="${textX}" y="${kickY}" text-anchor="${anchor}" font-size="${kickSize}" font-weight="700"
        fill="#E8C4F7" opacity=".85">สิทธิพิเศษสมาชิก Prinnie333</text>

  <text x="${textX}" y="${headY}" text-anchor="${anchor}" font-size="${headSize}" font-weight="700"
        fill="url(#gold)">ดวงเลือกคุณ</text>

  <text x="${textX}" y="${subY}" text-anchor="${anchor}" font-size="${subSize}" font-weight="400" fill="#F6F1FF">
    ทุก 15 วัน ดาวทำมุมกับดวงเกิดของใครแรงที่สุด
  </text>
  <text x="${textX}" y="${subY + subSize * 1.35}" text-anchor="${anchor}" font-size="${subSize}" font-weight="400" fill="#F6F1FF">
    คนนั้นได้คุยกับอาจารย์ปรินนี่ 1 ชั่วโมง
  </text>

  ${bullets.map((b, i) => `<text x="${textX}" y="${liY + i * liGap}" text-anchor="${anchor}"
        font-size="${liSize}" font-weight="400" fill="#CFC2EC">✦  ${esc(b)}</text>`).join('')}

  <text x="${textX}" y="${ctaY}" text-anchor="${anchor}" font-size="${ctaSize}" font-weight="700" fill="#E8C77A">
    สมาชิก 399 บาท/เดือน  ·  LINE @prinnie333
  </text>
</svg>`;
}

const only = process.argv[2];
const targets = only ? { [only]: FORMATS[only] } : FORMATS;
if (only && !FORMATS[only]) {
  console.error('ขนาดที่มี:', Object.keys(FORMATS).join(', '));
  process.exit(1);
}

for (const [name, f] of Object.entries(targets)) {
  const png = new Resvg(buildSvg(f.w, f.h), {
    fitTo: { mode: 'width', value: f.w },
    font: { loadSystemFonts: true },
  }).render().asPng();
  const file = path.join(OUT, `duang-luek-khun-${name}.png`);
  fs.writeFileSync(file, png);
  console.log(`✓ ${path.relative(process.cwd(), file)}  ${f.w}×${f.h}  ${(png.length / 1024).toFixed(0)}KB`);
}
