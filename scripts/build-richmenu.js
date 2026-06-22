// Render rich menu: ไอคอน/ข้อความ (SVG via resvg, โปร่งใส) → composite ทับพื้นหลัง AI (sharp)
//   node scripts/build-richmenu.js
const fs    = require('fs');
const path  = require('path');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

const DIR     = path.join(__dirname, '..', 'richmenu');
const svgPath = path.join(DIR, 'richmenu.svg');
const bgPath  = path.join(DIR, 'bg.png');
const outPath = path.join(DIR, 'richmenu.jpg');

(async () => {
  // richmenu.svg เป็นดีไซน์เต็มใบ (มีพื้นหลัง+การ์ด+ไอคอน+ข้อความในตัว) → render ตรงเป็น JPEG
  // (ดีไซน์ luxe เลิกใช้ bg.png นีบิวลาเดิมแล้ว — ตั้ง USE_BG=1 ถ้าอยากกลับไป composite ทับ bg.png)
  const svg   = fs.readFileSync(svgPath);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 2500 }, font: { loadSystemFonts: true } });
  const layer = resvg.render().asPng();

  let out;
  if (process.env.USE_BG === '1' && fs.existsSync(bgPath)) {
    out = await sharp(bgPath)
      .resize(2500, 1686, { fit: 'cover' })
      .composite([{ input: layer }])
      .jpeg({ quality: 90 })
      .toBuffer();
    console.log('composite: bg.png + overlay (USE_BG=1)');
  } else {
    out = await sharp(layer).flatten({ background: '#0a0218' }).jpeg({ quality: 92 }).toBuffer();
    console.log('render: self-contained SVG (luxe)');
  }

  fs.writeFileSync(outPath, out);
  fs.rmSync(path.join(DIR, 'richmenu.png'), { force: true });  // กันหยิบไฟล์เก่า
  const kb = (out.length / 1024).toFixed(1);
  console.log(`✅ richmenu.jpg  2500x1686  ${kb} KB ` + (out.length < 1024 * 1024 ? '(< 1MB ✅)' : '⚠️ เกิน 1MB'));
})().catch(e => { console.error(e.message); process.exit(1); });
