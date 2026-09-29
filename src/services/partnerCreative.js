// ครีเอทีฟพาร์ทเนอร์แบบมี QR ลิงก์เฉพาะคน — ฝัง QR ลงภาพพื้นฐานตอนดาวน์โหลด
//
// ภาพพื้นฐานสร้างจาก scripts/build-partner-kit.mjs → liff/partner-kit/*.png + layout.json
// (ตำแหน่งช่อง QR อยู่ใน layout.json — แก้ดีไซน์แล้วรันสคริปต์ใหม่ ตำแหน่งตามไปเอง)
// ทำไมฝังตอนดาวน์โหลด: ลิงก์เป็นของแต่ละพาร์ทเนอร์ ถ้าอัดไฟล์ล่วงหน้าต้องสร้างใหม่ทุกครั้งที่เพิ่มคน
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const QRCode = require('qrcode');
const affiliates = require('./affiliates');

const DIR = path.join(__dirname, '..', '..', 'liff', 'partner-kit');

// ชื่อที่แอดมินเห็นในแดชบอร์ด — เรียงตามที่ควรส่งให้พาร์ทเนอร์
const LABELS = {
  'feed-daily': 'โพสต์ฟีด · ดวงของคุณคนเดียว',
  'feed-couple': 'โพสต์ฟีด · ผูกดวงคู่',
  'feed-tarot': 'โพสต์ฟีด · เปิดไพ่ประจำสัปดาห์',
  'story-daily': 'สตอรี่ · ดวงของคุณคนเดียว',
  'story-couple': 'สตอรี่ · ผูกดวงคู่',
};

let layoutCache = null;
function layout() {
  if (!layoutCache) layoutCache = JSON.parse(fs.readFileSync(path.join(DIR, 'layout.json'), 'utf8'));
  return layoutCache;
}

function list() {
  const l = layout();
  return Object.keys(LABELS).filter(name => l[name]).map(name => ({
    name, label: LABELS[name], width: l[name].width, height: l[name].height,
  }));
}

// คืน PNG ที่มี QR ของพาร์ทเนอร์คนนี้ · ชื่อไฟล์ไม่อยู่ในรายการ = error (กันอ่านไฟล์นอกโฟลเดอร์)
async function render(code, name) {
  const spec = layout()[name];
  if (!spec || !LABELS[name]) throw new Error('ไม่มีครีเอทีฟชื่อนี้');
  const a = await affiliates.get(code);
  if (!a) throw new Error('ไม่พบอินฟลู');
  const { x, y, size } = spec.qr;
  const qr = await QRCode.toBuffer(a.url, {
    type: 'png', width: size, margin: 0, errorCorrectionLevel: 'M',
    color: { dark: '#1B1433', light: '#FFFFFF' },
  });
  return sharp(path.join(DIR, name + '.png'))
    .composite([{ input: await sharp(qr).resize(size, size).toBuffer(), left: x, top: y }])
    .png()
    .toBuffer();
}

module.exports = { list, render, LABELS };
