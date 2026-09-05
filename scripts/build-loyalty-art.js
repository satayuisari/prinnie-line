// อาร์ตเวิร์ค "ดวงเลือกคุณ" — ชุดที่ใช้จริง (ก.ย. 69)
//
//   node scripts/build-loyalty-art.js
//
// ภาพคนต้นทางอยู่ที่ marketing/campaign/src/ — สร้างด้วย Flux ผ่าน scripts/fal-gen.js
// ตัวอักษรวางด้วยสคริปต์นี้ ปรับคำ/ขนาดแล้วเรนเดอร์ใหม่ได้ทันที ไม่ต้องสั่งวาดใหม่
//
// สองข้อที่แก้จาก v3:
//   1. โปสเตอร์ไม่เคยบอกว่า "จะเข้าร่วมยังไง" — คนอ่านจบแล้วไม่รู้ว่าต้องทำอะไร
//      เพิ่มแถบ 3 ขั้น: สมัคร → ครบ 14 วัน → ดวงเข้าคำนวณเอง
//      ขั้นตอนเป็นลำดับจริง (ต้องทำตามกัน) ลูกศรจึงสื่อความหมาย ไม่ใช่ของประดับ
//   2. ภาพเดิมหลับตาเงยหน้า รัศมีเป็นหนาม อ่านเป็นพิธีกรรม ไม่ใช่คำเชิญ
//      เปลี่ยนเป็นคนยิ้ม ลืมตา แสงเทียนอุ่น รัศมีเป็นวงเรียบ

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');

const SRC = process.argv[2] || path.join(__dirname, '..', 'marketing', 'campaign', 'src', 'duang-luek-khun-hero.png');
const OUTDIR = process.argv[3] || path.join(__dirname, '..', 'marketing', 'campaign');
const FONT = "'Tahoma','Noto Sans Thai',sans-serif";

const FORMATS = {
  feed:   { w: 1080, h: 1350, price: false },
  story:  { w: 1080, h: 1920, price: false },
  square: { w: 1080, h: 1080, price: true  },
};

const STEPS = ['สมัครสมาชิก', 'ครบ 14 วัน', 'ดวงเข้าคำนวณเอง'];

function overlay(W, H, showPrice) {
  const S = W / 1080;
  const tall = H >= 1900, sq = H <= 1100;

  const head    = Math.round((sq ? 132 : 148) * S);
  const promise = Math.round((sq ? 42 : 47) * S);
  const step    = Math.round(27 * S);
  const stamp   = Math.round(26 * S);
  const cta     = Math.round(29 * S);

  const cx = W / 2;
  // วางจากล่างขึ้นบน — บล็อกข้อความสูงไม่เท่ากันในแต่ละสัดส่วน
  const ctaY   = H - (sq ? 52 : tall ? 118 : 70) * S;
  const stepY  = ctaY - (sq ? 62 : 76) * S;          // เส้นกึ่งกลางแถบขั้นตอน
  const barH   = 62 * S;
  const proY2  = stepY - barH / 2 - (sq ? 44 : 56) * S;
  const proY   = proY2 - promise * 1.34;
  const headY  = proY - (sq ? 46 : 58) * S;
  const scrimT = headY - head * 1.55;

  // แถบ 3 ขั้น — คำนวณความกว้างแต่ละช่วงจากจำนวนตัวอักษร ให้ลูกศรอยู่ตรงกลางช่องว่างจริง
  const widths = STEPS.map(t => t.length * step * 0.62);
  const arrowW = 46 * S;
  const total = widths.reduce((a, b) => a + b, 0) + arrowW * 2;
  let x = cx - total / 2;
  const parts = [];
  STEPS.forEach((t, i) => {
    parts.push(`<text x="${(x + widths[i] / 2).toFixed(1)}" y="${stepY + step * 0.36}" text-anchor="middle"
      font-size="${step}" font-weight="700" fill="#FFF7E2">${t}</text>`);
    x += widths[i];
    if (i < STEPS.length - 1) {
      const ax = x + arrowW / 2;
      parts.push(`<path d="M${(ax - 13 * S).toFixed(1)},${stepY} L${(ax + 9 * S).toFixed(1)},${stepY}
        M${(ax + 2 * S).toFixed(1)},${(stepY - 6 * S).toFixed(1)} L${(ax + 9 * S).toFixed(1)},${stepY}
        L${(ax + 2 * S).toFixed(1)},${(stepY + 6 * S).toFixed(1)}"
        fill="none" stroke="#E8C77A" stroke-width="${2.2 * S}" stroke-linecap="round" stroke-linejoin="round"/>`);
      x += arrowW;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="${FONT}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A0418" stop-opacity="0"/>
      <stop offset="40%" stop-color="#0A0418" stop-opacity=".84"/>
      <stop offset="100%" stop-color="#0A0418" stop-opacity=".97"/>
    </linearGradient>
    <linearGradient id="topfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A0418" stop-opacity=".8"/>
      <stop offset="100%" stop-color="#0A0418" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF7E2"/><stop offset="42%" stop-color="#F3D98F"/><stop offset="100%" stop-color="#C79A4E"/>
    </linearGradient>
  </defs>

  <rect x="0" y="${scrimT}" width="${W}" height="${H - scrimT}" fill="url(#scrim)"/>
  <rect x="0" y="0" width="${W}" height="${170 * S}" fill="url(#topfade)"/>

  <g>
    <line x1="${cx - 162 * S}" y1="${70 * S}" x2="${cx - 88 * S}" y2="${70 * S}" stroke="#E8C77A" stroke-opacity=".5" stroke-width="1.2"/>
    <line x1="${cx + 88 * S}" y1="${70 * S}" x2="${cx + 162 * S}" y2="${70 * S}" stroke="#E8C77A" stroke-opacity=".5" stroke-width="1.2"/>
    <text x="${cx}" y="${78 * S}" text-anchor="middle" font-size="${stamp}" font-weight="700" fill="#E8C77A" letter-spacing="4">ทุก 15 วัน</text>
  </g>

  <text x="${cx}" y="${headY}" text-anchor="middle" font-size="${head}" font-weight="700" fill="url(#gold)">ดวงเลือกคุณ</text>

  <text x="${cx}" y="${proY}" text-anchor="middle" font-size="${promise}" font-weight="500" fill="#FFFFFF">ดาวเลือกดวงที่แรงที่สุดในรอบนั้น</text>
  <text x="${cx}" y="${proY2}" text-anchor="middle" font-size="${promise}" font-weight="500" fill="#FFFFFF">คนนั้นได้คุยกับอาจารย์ปรินนี่ 1 ชั่วโมง</text>

  <!-- ทางเข้าร่วม — เป็นลำดับจริง ต้องทำตามกัน ลูกศรจึงบอกความหมาย -->
  <rect x="${cx - total / 2 - 34 * S}" y="${stepY - barH / 2}" width="${total + 68 * S}" height="${barH}" rx="${barH / 2}"
        fill="#E8C77A" fill-opacity=".10" stroke="#E8C77A" stroke-opacity=".45" stroke-width="1.3"/>
  ${parts.join('')}

  <text x="${cx}" y="${ctaY}" text-anchor="middle" font-size="${cta}" font-weight="700" fill="#E8C77A" opacity=".95">${
    showPrice ? 'สมาชิก 399 บาท/เดือน  ·  LINE @prinnie333' : 'สมัครได้ที่ LINE @prinnie333'}</text>
</svg>`;
}

(async () => {
  for (const [name, f] of Object.entries(FORMATS)) {
    const base = await sharp(SRC)
      .resize(f.w, f.h, { fit: 'cover', position: 'top' })
      // ดึงเหลืองนีออนของรัศมีให้เข้าใกล้ทองโบราณของแบรนด์ (#E8C77A)
      .modulate({ saturation: 0.86 })
      .toBuffer();
    const ov = new Resvg(overlay(f.w, f.h, f.price), { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: f.w } }).render().asPng();
    const out = path.join(OUTDIR, `duang-luek-khun-v2-${name}.png`);
    await sharp(base).composite([{ input: ov, left: 0, top: 0 }]).png().toFile(out);
    console.log('✓', out, `${f.w}x${f.h}`, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
  }
})();
