// เทสฟอนต์ไทยกับคำที่มีสระ ำ / วรรณยุกต์ ที่ชอบซ้อน → marketing/art/_fonttest.png
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const W = 1100, lineH = 90;
const fonts = ['Leelawadee UI', 'Tahoma', 'Angsana New', 'Cordia New', 'Microsoft Sans Serif', 'Noto Sans Thai'];
const sample = 'คำแนะนำเฉพาะคุณ ส่งถึงทุกเช้า · รู้จักคุณ ราศีไม่เหมือนกัน';
const H = lineH * fonts.length + 40;

const rows = fonts.map((f, i) =>
  `<text x="30" y="${i*lineH + 70}" font-family="'${f}'" font-size="40" fill="#fff">${f}: ${sample}</text>`
).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#1a0d33"/>${rows}</svg>`;

const png = new Resvg(Buffer.from(svg), { font: { loadSystemFonts: true } }).render().asPng();
const out = path.join(__dirname, '..', 'marketing', 'art', '_fonttest.png');
fs.writeFileSync(out, png);
console.log('saved', out);
