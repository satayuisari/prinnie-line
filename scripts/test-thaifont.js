// เทสคำซับใบ daily แบบใหม่ — เลี่ยงลำดับ "ำ + สระหน้า(เ/แ)" ที่ resvg shape เพี้ยน
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const W = 1400, lineH = 100;
const cands = [
  'เดิม: คำแนะนำเฉพาะคุณ ส่งถึงทุกเช้า บน LINE',
  'A: คำแนะนำของคุณ ส่งถึงทุกเช้า บน LINE',
  'B: คำแนะนำส่วนตัว ส่งถึงคุณทุกเช้า บน LINE',
  'C: ดวงเฉพาะคุณ ส่งถึงคุณทุกเช้า บน LINE',
  'D: ดวงส่วนตัวของคุณ ส่งถึงทุกเช้า บน LINE',
];
const H = lineH * cands.length + 30;
const rows = cands.map((c, i) =>
  `<text x="30" y="${i*lineH + 75}" font-family="'Tahoma','Leelawadee UI',sans-serif" font-weight="400" font-size="40" fill="#fff">${c}</text>`
).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1a0d33"/>${rows}</svg>`;
fs.writeFileSync(path.join(__dirname, '..', 'marketing', 'art', '_fonttest.png'),
  new Resvg(Buffer.from(svg), { font: { loadSystemFonts: true } }).render().asPng());
console.log('saved');
