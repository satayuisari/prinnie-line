// สร้างภาพแผนการตลาด 3 ทางเลือก (ก.ย. 2026) — ใช้ระบบภาพเดียวกับ build-campaign-art.js
//   node scripts/build-plan-art.js          ทุกแผน ทุกขนาด
//   node scripts/build-plan-art.js a feed   เฉพาะแผน a ขนาด feed
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, '..', 'marketing', 'plan-2026-09');
const FONT = "'Tahoma','Noto Sans Thai',sans-serif";
const FORMATS = { feed: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PLANS = {
  a: {
    kicker: 'แผน A · เปิดท่อที่ยังไม่ได้ใช้',
    head: '301,000',
    headSub: 'คนติดตามบนยูทูบ',
    sub: ['ฐานแฟนที่ใหญ่กว่าทุกช่องทางรวมกัน', 'แต่ยังไม่มีสะพานมาที่ LINE สักเส้น'],
    bullets: ['คลิปหลัก 1 ตัว + ปักลิงก์คอมเมนต์แรก',
              'แก้ description คลิปเก่ายอดสูง 10 ตัว',
              'Shorts 3 ตัว/สัปดาห์ ปล่อยพร้อม TikTok/Reels'],
    cta: 'เพดานสูงสุด · เริ่มช้าสุด · อาจารย์ต้องออกกล้อง',
    wheel: 'single',
  },
  b: {
    kicker: 'แผน B · เก็บของที่ปลูกไว้แล้ว',
    head: '901',
    headSub: 'คนผูกดวงกำเนิดไว้แล้ว',
    sub: ['คนเหล่านี้กรอกวันเกิดจบไปแล้ว 85%', 'รอแค่คำชวนที่มาถูกจังหวะ'],
    bullets: ['เปิด teaser เช้า (DAILY_TEASER)',
              'เปิดเตือนต่ออายุ (RENEWAL_REMINDERS)',
              'ปล่อยระบบแนะนำเพื่อน (affiliate) ที่ร่างไว้แล้ว'],
    cta: 'เริ่มได้สัปดาห์นี้ · ไม่ต้องถ่ายคลิป · เพดานจำกัด',
    wheel: 'single',
  },
  c: {
    kicker: 'แผน C · ท่อที่ขยายตัวเอง',
    head: 'ดวงคู่',
    headSub: 'ฟีเจอร์ที่ชวนคนใหม่ในตัวมันเอง',
    sub: ['จะดูดวงคู่ได้ ต้องมีวันเกิดของอีกคน', 'ลูกค้าจึงเป็นคนพาคนใหม่มาเอง'],
    bullets: ['ธีมดวงคู่ทุกวันศุกร์',
              'ปุ่ม “ส่งให้เขากรอกเอง” ในแชท',
              'ShareCard ดวงเช้า แชร์ต่อได้'],
    cta: 'โตแบบทบต้น · ต้องเขียนฟีเจอร์เพิ่มเล็กน้อย',
    wheel: 'double',
  },
};

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

function wheelBase(cx, cy, R, hi) {
  let g = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#E8C77A" stroke-opacity=".38" stroke-width="2"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R * 0.78}" fill="none" stroke="#E8C77A" stroke-opacity=".18" stroke-width="1.5"/>`;
  const pt = i => { const a = (i * 30 - 90) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180;
    const [x, y] = pt(i);
    g += `<line x1="${(cx + R * .78 * Math.cos(a)).toFixed(1)}" y1="${(cy + R * .78 * Math.sin(a)).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E8C77A" stroke-opacity=".3" stroke-width="1.5"/>`;
  }
  for (const [a, b] of [[0, 4], [4, 8], [2, 8]]) {
    const [x1, y1] = pt(a), [x2, y2] = pt(b);
    g += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#C77DFF" stroke-opacity=".3" stroke-width="1.2"/>`;
  }
  if (hi) {
    const [hx, hy] = pt(4);
    g += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="11" fill="#E8C77A"/>`;
    g += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="22" fill="none" stroke="#E8C77A" stroke-opacity=".45" stroke-width="2"/>`;
  }
  return g;
}

// แผน C: สองวง ซ้อนเหลื่อม + เส้นเชื่อม = ดวงสองคนที่ต้องมีทั้งคู่ถึงจะอ่านได้
function wheelDouble(cx, cy, R) {
  const r = R * 0.72, dx = r * 0.62;
  let g = wheelBase(cx - dx, cy, r, false) + wheelBase(cx + dx, cy, r, false);
  g += `<line x1="${(cx - dx).toFixed(1)}" y1="${cy}" x2="${(cx + dx).toFixed(1)}" y2="${cy}" stroke="#C77DFF" stroke-opacity=".5" stroke-width="2"/>`;
  g += `<circle cx="${(cx - dx).toFixed(1)}" cy="${cy}" r="10" fill="#E8C77A"/>`;
  g += `<circle cx="${(cx + dx).toFixed(1)}" cy="${cy}" r="10" fill="#E8C77A"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="#E8C77A" stroke-opacity=".55" stroke-width="2"/>`;
  return g;
}

function buildSvg(P, W, H) {
  const S = W / 1080;
  const tall = H > 1500;
  const headSize = Math.round((P.head.length > 5 ? 130 : 168) * S);
  const kickSize = Math.round(30 * S);
  const hsubSize = Math.round(34 * S);
  const subSize  = Math.round(36 * S);
  const liSize   = Math.round(32 * S);
  const ctaSize  = Math.round(29 * S);

  const wheelR  = W * 0.215;
  const wheelCX = W / 2;
  const wheelCY = wheelR + (tall ? 210 : 140) * S;

  const X = W / 2;
  const kickY = wheelCY + wheelR + 104 * S;
  const headY = kickY + headSize * 0.98;
  const hsubY = headY + hsubSize * 1.5;
  const subY  = hsubY + subSize * 2.0;
  const liY   = subY + subSize * 1.35 + (tall ? 92 : 70) * S;
  const liGap = 54 * S;
  const ctaY  = H - (tall ? 120 : 86) * S;

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
  ${stars(W, H, tall ? 190 : 150)}
  <circle cx="${wheelCX}" cy="${wheelCY}" r="${wheelR * 1.7}" fill="url(#glow)"/>
  ${P.wheel === 'double' ? wheelDouble(wheelCX, wheelCY, wheelR) : wheelBase(wheelCX, wheelCY, wheelR, true)}

  <text x="${X}" y="${kickY}" text-anchor="middle" font-size="${kickSize}" font-weight="700" fill="#E8C4F7" opacity=".85">${esc(P.kicker)}</text>
  <text x="${X}" y="${headY}" text-anchor="middle" font-size="${headSize}" font-weight="700" fill="url(#gold)">${esc(P.head)}</text>
  <text x="${X}" y="${hsubY}" text-anchor="middle" font-size="${hsubSize}" font-weight="400" fill="#CFC2EC">${esc(P.headSub)}</text>
  ${P.sub.map((s, i) => `<text x="${X}" y="${subY + i * subSize * 1.35}" text-anchor="middle" font-size="${subSize}" font-weight="400" fill="#F6F1FF">${esc(s)}</text>`).join('')}
  ${P.bullets.map((b, i) => `<text x="${X}" y="${liY + i * liGap}" text-anchor="middle" font-size="${liSize}" font-weight="400" fill="#CFC2EC">✦  ${esc(b)}</text>`).join('')}
  <text x="${X}" y="${ctaY}" text-anchor="middle" font-size="${ctaSize}" font-weight="700" fill="#E8C77A">${esc(P.cta)}</text>
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });
const onlyPlan = process.argv[2], onlyFmt = process.argv[3];
for (const [key, P] of Object.entries(PLANS)) {
  if (onlyPlan && onlyPlan !== key) continue;
  for (const [fname, f] of Object.entries(FORMATS)) {
    if (onlyFmt && onlyFmt !== fname) continue;
    const svg = buildSvg(P, f.w, f.h);
    const png = new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: f.w } }).render().asPng();
    const file = path.join(OUT, `plan-${key}-${fname}.png`);
    fs.writeFileSync(file, png);
    console.log('✓', path.relative(process.cwd(), file), `${f.w}x${f.h}`, (png.length / 1024).toFixed(0) + 'KB');
  }
}
