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
  // 1) render ไอคอน+ข้อความ เป็นเลเยอร์โปร่งใส
  const svg   = fs.readFileSync(svgPath);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 2500 }, font: { loadSystemFonts: true } });
  const overlay = resvg.render().asPng();

  // 2) พื้นหลัง AI (resize cover 2500x1686) + วางเลเยอร์ทับ → JPEG
  let out;
  if (fs.existsSync(bgPath)) {
    out = await sharp(bgPath)
      .resize(2500, 1686, { fit: 'cover' })
      .composite([{ input: overlay }])
      .jpeg({ quality: 90 })
      .toBuffer();
    console.log('composite: bg.png + ไอคอน/ข้อความ');
  } else {
    out = await sharp(overlay).flatten({ background: '#1a0533' }).jpeg({ quality: 90 }).toBuffer();
    console.log('⚠️ ไม่มี bg.png — ใช้พื้นทึบ');
  }

  fs.writeFileSync(outPath, out);
  fs.rmSync(path.join(DIR, 'richmenu.png'), { force: true });  // กันหยิบไฟล์เก่า
  const kb = (out.length / 1024).toFixed(1);
  console.log(`✅ richmenu.jpg  2500x1686  ${kb} KB ` + (out.length < 1024 * 1024 ? '(< 1MB ✅)' : '⚠️ เกิน 1MB'));
})().catch(e => { console.error(e.message); process.exit(1); });
