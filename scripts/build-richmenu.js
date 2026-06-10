// Render rich menu SVG → PNG ขนาด 2500x1686 เป๊ะ (ตรง tap zone)
// ใช้ @resvg/resvg-js (โหลด Thai font จากระบบ) — ไม่ยืด ไม่พึ่ง Canva
//
//   node scripts/build-richmenu.js

const fs   = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const DIR     = path.join(__dirname, '..', 'richmenu');
const svgPath = path.join(DIR, 'richmenu.svg');
const pngPath = path.join(DIR, 'richmenu.png');

const svg   = fs.readFileSync(svgPath);
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 2500 },   // SVG เป็น 2500x1686 อยู่แล้ว → ได้ขนาดเป๊ะ
  font:  { loadSystemFonts: true },          // ใช้ฟอนต์ไทยจาก Windows (Leelawadee)
});

const img = resvg.render();
const png = img.asPng();
fs.writeFileSync(pngPath, png);

const kb = (png.length / 1024).toFixed(1);
console.log(`✅ render เสร็จ: richmenu.png  ${img.width}x${img.height}  ${kb} KB`);
if (png.length > 1024 * 1024) {
  console.log('⚠️  เกิน 1MB — รัน compress (PowerShell System.Drawing → JPEG) ต่อ');
} else {
  console.log('   ขนาดไฟล์ผ่านลิมิต LINE (<1MB) ใช้ได้เลย');
}
