// ชุดครีเอทีฟให้พาร์ทเนอร์ (affiliate) — ภาพพื้นฐานที่เว้นช่อง QR ไว้มุมล่าง
// ระบบฝัง QR ลิงก์เฉพาะของแต่ละคนตอนดาวน์โหลด (src/services/partnerCreative.js)
//
// ใช้:  node scripts/build-partner-kit.mjs      → liff/partner-kit/*.png + layout.json
//
// เขียน 29 ก.ย. 69 — bon: "ทำ affiliate ให้เสร็จ … candidate ที่ไม่ได้มาจากการดูดวง ทำ artwork ให้สวย"
// พาร์ทเนอร์รุ่นแรกเป็นสายไลฟ์สไตล์/ความรัก ไม่ใช่สายมู → ภาพต้องเล่าให้คนไม่เคยดูดวงเข้าใจในรอบเดียว
// ข้อความบนภาพพูดแค่สิ่งที่ระบบให้จริง (ดูตาราง "ธุรกิจนี้คืออะไร" ใน CLAUDE.md) ไม่อ้างความแม่น
//
// ทำไมเรนเดอร์ผ่านเบราว์เซอร์: ตัวไทยต้องจัดรูปสระ/วรรณยุกต์ (ดู scripts/build-week-art.mjs)
// ⚠️ ห้ามใส่ letter-spacing กับข้อความไทย — วรรณยุกต์จะเคลื่อนออกจากตัวอักษร
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/bon/astral-realm/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'marketing', 'partner-kit', 'src');
const OUT = path.join(ROOT, 'liff', 'partner-kit');
const TAROT = path.join(ROOT, 'assets', 'tarot-cards');
const img = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
const bg = k => img(path.join(SRC, k + '.jpg'));
const card = id => img(path.join(TAROT, id + '.jpg'));

// ช่อง QR — ตำแหน่งต้องตรงกับที่ partnerCreative.js วาง (อ่านจาก layout.json)
const QR = {
  feed:  { x: 764, y: 985, size: 250 },
  story: { x: 400, y: 1440, size: 280 },
};

const CSS = `* { margin:0; box-sizing:border-box; }
body { position:relative; overflow:hidden; text-align:center; color:#F4F1FB;
  font-family:'Sukhumvit Set','Thonburi',sans-serif;
  background: radial-gradient(ellipse at 50% 30%, #2A1F48 0%, #171226 60%, #0F0B1C 100%); }
.stars i { position:absolute; border-radius:50%; background:#EBE6FF; }
.frame { position:absolute; inset:22px; border:1.5px solid rgba(212,175,110,.55); border-radius:6px; z-index:5; pointer-events:none; }
.frame::after { content:''; position:absolute; inset:8px; border:1px solid rgba(212,175,110,.25); border-radius:3px; }
.band { position:absolute; left:0; top:0; width:100%; object-fit:cover; -webkit-mask-image:linear-gradient(to bottom,#000 50%,transparent 100%); }
.brand { position:absolute; top:50px; left:50%; transform:translateX(-50%); padding:8px 26px; border-radius:30px; font-size:28px; color:#EDE6FF; background:rgba(15,11,28,.6); z-index:4; }
.shade { position:absolute; left:0; top:0; width:100%; background:linear-gradient(to bottom, rgba(15,11,28,.25) 0%, rgba(15,11,28,0) 22%, rgba(15,11,28,.45) 48%, rgba(15,11,28,.88) 72%, #120D22 100%); }
.wrap { position:absolute; left:0; right:0; display:flex; flex-direction:column; align-items:center; z-index:3; }
.kicker { font-size:32px; color:#F0D49A; text-shadow:0 2px 6px #000, 0 0 18px rgba(0,0,0,.9); }
.title { font-size:78px; font-weight:800; line-height:1.15; margin-top:4px;
  background:linear-gradient(180deg,#FFF3D6 0%,#E9C98A 55%,#B8893E 100%); -webkit-background-clip:text; color:transparent;
  filter:drop-shadow(0 3px 10px rgba(0,0,0,.85)); }
.sub { font-size:34px; color:#FFFFFF; margin-top:10px; text-shadow:0 2px 6px #000, 0 0 16px rgba(0,0,0,.9); }
.list { margin-top:26px; display:flex; flex-direction:column; gap:14px; text-align:left; }
.list div { font-size:32px; color:#FFFFFF; display:flex; gap:16px; align-items:center; }
.list b { flex:none; width:40px; height:40px; border-radius:50%; font-size:22px; display:flex; align-items:center; justify-content:center;
  color:#2A1F48; background:radial-gradient(circle at 35% 30%, #FFF1CF, #E2BD78 55%, #A87A33); }
.qr { position:absolute; background:#FFFFFF; border-radius:22px; box-shadow:0 0 0 4px #D4AF6E, 0 10px 30px rgba(0,0,0,.5); z-index:4; }
.qrlabel { position:absolute; font-size:26px; color:#E9C98A; z-index:4; text-align:center; }
.cta { position:absolute; text-align:left; z-index:4; }
.cta .big { font-size:40px; font-weight:800; color:#FFFFFF; line-height:1.3; }
.cta .small { font-size:28px; color:#CFC5EA; margin-top:10px; line-height:1.45; }
.line-id { font-size:30px; color:#E9C98A; margin-top:16px; }
.cards { display:flex; gap:26px; justify-content:center; }
.cards img { width:210px; height:360px; object-fit:cover; border-radius:14px; box-shadow:0 0 0 2px #D4AF6E, 0 12px 30px rgba(0,0,0,.55); }
.cards img:nth-child(1) { transform:rotate(-6deg) translateY(18px); } .cards img:nth-child(3) { transform:rotate(6deg) translateY(18px); }`;

const stars = (seed, w, h) => { let s = seed; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return '<div class="stars">' + Array.from({ length: 160 }, () => { const z = [1,1,1,2,2,3][Math.floor(r()*6)];
    return `<i style="left:${r()*w}px;top:${r()*h}px;width:${z}px;height:${z}px;opacity:${0.2+r()*0.6}"></i>`; }).join('') + '</div>'; };
const qrBox = (q, label) => `<div class="qr" style="left:${q.x - 14}px;top:${q.y - 14}px;width:${q.size + 28}px;height:${q.size + 28}px"></div>
  <div class="qrlabel" style="left:${q.x + q.size / 2 - 300}px;width:600px;top:${q.y + q.size + 22}px;font-size:${q.size > 260 ? 30 : 26}px">${label}</div>`;
const list = (items, big) => `<div class="list"${big ? ' style="gap:24px;margin-top:44px"' : ''}>${items.map(t => `<div${big ? ' style="font-size:42px"' : ''}><b>✦</b>${t}</div>`).join('')}</div>`;

const FEED = { w: 1080, h: 1350 };
const STORY = { w: 1080, h: 1920 };
const feedCta = (big, small) => `<div class="cta" style="left:80px;top:1010px;width:620px">
  <div class="big">${big}</div><div class="small">${small}</div><div class="line-id">LINE @prinnie333</div></div>`;

const POSTS = [
  ['feed-daily', FEED, 'feed', stars(3, 1080, 1350) + `<img class="band" style="height:760px" src="${bg('moonsign')}"><div class="shade" style="height:760px"></div>
    <div class="brand">อาจารย์ปรินนี่ · Prinnie333</div>
    <div class="wrap" style="top:430px"><div class="kicker">ดวงที่คำนวณจากวันเวลาเกิดของคุณเอง</div>
      <div class="title">ดวงของคุณคนเดียว</div><div class="sub">ไม่ใช่ดวง 12 ราศีที่ทุกคนอ่านเหมือนกัน</div>
      ${list(['สมาชิก 399 บาท ได้ดวงรายวันทุกเช้า 8 โมง', 'เรื่องงาน เงิน ความรัก ในข้อความเดียว', 'เริ่มจากดูพื้นดวงของตัวเองได้ฟรี'])}</div>
    ${feedCta('สแกนเพื่อเริ่ม<br>ดูพื้นดวงฟรี', 'กรอกวัน เวลา ที่เกิด<br>รู้ราศีจันทร์และลัคนาของคุณ')}` + qrBox({ ...QR.feed }, 'สแกนเลย')],
  ['feed-couple', FEED, 'feed', stars(5, 1080, 1350) + `<img class="band" style="height:780px" src="${bg('couple')}"><div class="shade" style="height:780px"></div>
    <div class="brand">อาจารย์ปรินนี่ · Prinnie333</div>
    <div class="wrap" style="top:470px"><div class="kicker">คุณกับเขา เข้ากันแค่ไหน</div>
      <div class="title">ผูกดวงคู่</div><div class="sub">ดูจากวันเกิดของทั้งสองคน</div>
      ${list(['ดูคะแนนความเข้ากันเป็นเปอร์เซ็นต์ได้ฟรี', 'แฟน คนที่คุยอยู่ หรือคนที่แอบชอบ', 'ดูในไลน์ ไม่ต้องโหลดแอป'])}</div>
    ${feedCta('สแกนแล้วลอง<br>ผูกดวงกับเขา', 'ใส่วันเกิดของคุณและของเขา<br>แล้วดูผลได้ทันที')}` + qrBox({ ...QR.feed }, 'สแกนเลย')],
  ['feed-tarot', FEED, 'feed', stars(7, 1080, 1350) + `<div class="brand">อาจารย์ปรินนี่ · Prinnie333</div>
    <div class="wrap" style="top:120px"><div class="kicker">ไม่เคยดูดวงมาก่อนก็เริ่มได้</div>
      <div class="title">เปิดไพ่ประจำสัปดาห์</div><div class="sub" style="margin-bottom:34px">ฟรีในไลน์ @prinnie333</div>
      <div class="cards"><img src="${card('7b958fe5-d2da-4237-95cd-32c1ed52429b')}"><img src="${card('35aa60f2-3678-46c6-a970-bbe6212bb99f')}"><img src="${card('80e146c1-7d1d-4bda-ba94-3447385347e7')}"></div></div>
    ${feedCta('สแกนแล้วเปิดไพ่<br>ของคุณสัปดาห์นี้', 'ไพ่ใบใหม่ทุกสัปดาห์<br>พร้อมคำแนะนำสั้น ๆ')}` + qrBox({ ...QR.feed }, 'สแกนเลย')],
  ['story-daily', STORY, 'story', stars(9, 1080, 1920) + `<img class="band" style="height:1000px" src="${bg('moon')}"><div class="shade" style="height:1000px"></div>
    <div class="brand" style="top:90px">อาจารย์ปรินนี่ · Prinnie333</div>
    <div class="wrap" style="top:640px"><div class="kicker">ดวงที่คำนวณจากวันเวลาเกิดของคุณเอง</div>
      <div class="title" style="font-size:84px">ดวงของคุณคนเดียว</div><div class="sub" style="font-size:40px">สมาชิก 399 บาท ได้ดวงถึงไลน์ทุกเช้า 8 โมง</div>
      ${list(['เรื่องงาน เงิน ความรัก ในข้อความเดียว', 'ดูพื้นดวงของตัวเองได้ฟรี', 'ผูกดวงคู่ ดูคะแนนเข้ากันได้ฟรี'], true)}</div>` +
    qrBox({ ...QR.story }, 'สแกนเพื่อเริ่มฟรี · LINE @prinnie333')],
  ['story-couple', STORY, 'story', stars(11, 1080, 1920) + `<img class="band" style="height:1050px" src="${bg('couple')}"><div class="shade" style="height:1050px"></div>
    <div class="brand" style="top:90px">อาจารย์ปรินนี่ · Prinnie333</div>
    <div class="wrap" style="top:700px"><div class="kicker">คุณกับเขา เข้ากันแค่ไหน</div>
      <div class="title" style="font-size:96px">ผูกดวงคู่</div><div class="sub" style="font-size:42px">ดูคะแนนความเข้ากันได้ฟรี</div>
      ${list(['ใส่วันเกิดของคุณและของเขา', 'ดูผลในไลน์ได้ทันที', 'แฟน คนที่คุยอยู่ หรือคนที่แอบชอบ'], true)}</div>` +
    qrBox({ ...QR.story }, 'สแกนแล้วลองเลย · LINE @prinnie333')],
];

const b = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const layout = {};
for (const [name, size, kind, body] of POSTS) {
  const pg = await b.newPage({ viewport: { width: size.w, height: size.h } });
  await pg.setContent(`<style>${CSS} body{width:${size.w}px;height:${size.h}px}</style>${body}<div class="frame"></div>`);
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: path.join(OUT, name + '.png') });
  await pg.close();
  layout[name] = { width: size.w, height: size.h, qr: QR[kind] };
  console.log('บันทึก', name);
}
fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(layout, null, 2) + '\n');
await b.close();
