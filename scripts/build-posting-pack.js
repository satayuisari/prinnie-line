// ประกอบ "แพ็กพร้อมโพสต์" — ก็อปโพสเตอร์เข้าโฟลเดอร์ตามคอนเซ็ปต์ + เขียนไฟล์แคปชั่น (UTF-8)
//   node scripts/build-posting-pack.js
// ผลลัพธ์: marketing/posting-pack/<ลำดับ-คอนเซ็ปต์>/ (รูป 4 ขนาด + caption.txt) + README.txt
const fs   = require('fs');
const path = require('path');

const POSTERS = path.join(__dirname, '..', 'marketing', 'posters');
const PACK    = path.join(__dirname, '..', 'marketing', 'posting-pack');

// ขนาด → แพลตฟอร์ม
const FORMATS = [
  { suffix: '',       name: 'IGfeed-FBfeed_4x5' },   // IG/FB feed (4:5 แนะนำ)
  { suffix: '-9x16',  name: 'Story-Reels-TikTok-Shorts-VOOM_9x16' },
  { suffix: '-1x1',   name: 'IGsquare-LINErich_1x1' },
  { suffix: '-wide',  name: 'LINEbroadcast-FBlink_wide' },
];

// ลำดับตามกรวย: couple นำ (ไวรัล) → daily (แกน) → personal (พิสูจน์)
const POSTS = [
  {
    order: 1, key: 'couple', title: 'ผูกดวงคู่ (ตัวไวรัล — ดึงคนใหม่)',
    igfb:
`เราเข้ากันกี่ %? 💞
ลองผูกดวงกับคนที่คุณคิดถึง — ใส่แค่วันเกิดของสองคน
แล้วดูว่าดาวของเราส่งถึงกันแค่ไหน ✨
ไม่ใช่แค่ "ราศีไหนเข้ากับราศีไหน" แต่ผูกดวงจริงของสองคน

แท็กคนนั้นมาลองเลย 👇 เช็กฟรีที่ LINE @prinnie333`,
    short: `ใส่วันเกิด 2 คน รู้เลยเข้ากันกี่ % 💞 แท็กเขามาลอง! เช็กฟรี LINE @prinnie333`,
    tags: `#ผูกดวงคู่ #ดวงความรัก #ดวงคู่ #เนื้อคู่ #ความรัก #ดูดวง #prinnie333`,
  },
  {
    order: 2, key: 'daily', title: 'ดวงรายวัน (แกนหลัก — รักษาฐาน/สมัคร)',
    igfb:
`เริ่มเช้านี้ด้วยดวงที่รู้จักคุณจริง ๆ ☀️
ไม่ใช่ดวงราศีรวม ๆ แต่เป็นคำแนะนำส่วนตัว
จากดาวจรที่สัมพันธ์กับวันเกิดของคุณคนเดียว ส่งถึงทุกเช้า บน LINE 💜

แอด @prinnie333 ฟรี แล้วตื่นมาเจอดวงของคุณทุกวัน 👇`,
    short: `ดวงรายวันที่เป็น "ของคุณคนเดียว" ☀️ ต่างกับดวงราศีรวมยังไง? เริ่มฟรี LINE @prinnie333`,
    tags: `#ดวงรายวัน #ดวงวันนี้ #ดวงส่วนตัว #ดูดวง #ราศี #prinnie333`,
  },
  {
    order: 3, key: 'personal', title: 'พื้นดวงส่วนตัว (พิสูจน์ของจริง/authority)',
    igfb:
`ราศีเดียวกัน… แต่ดวงไม่เหมือนกันสักคน ✨
เพราะดวงจริงของคุณคำนวณจาก วันเกิด เวลา และสถานที่เกิด ของคุณคนเดียว
ไม่ใช่ดวง 12 ราศีที่ใคร ๆ ก็อ่านได้

อยากรู้ว่าอาทิตย์ จันทร์ ลัคนา ของคุณอยู่ตรงไหน? 👇
แอด LINE @prinnie333 รับ "พื้นดวงส่วนตัว" ฟรี`,
    short: `ราศีเดียวกัน ทำไมดวงไม่เหมือนกัน? 🌙 รับพื้นดวงส่วนตัวฟรี LINE @prinnie333`,
    tags: `#ดูดวง #ดวงส่วนตัว #ลัคนา #โหราศาสตร์ #ราศี #prinnie333`,
  },
];

function captionText(p) {
  return `═══════════════════════════════════════
${p.order}. ${p.title}
═══════════════════════════════════════

รูปในโฟลเดอร์นี้ใช้กับ:
• ..._4x5.jpg     → Instagram / Facebook ฟีด
• ..._9x16.jpg    → IG Story · Reels · TikTok · YouTube Shorts · LINE VOOM
• ..._1x1.jpg     → IG สี่เหลี่ยม · LINE rich message
• ..._wide.jpg    → LINE broadcast · ลิงก์ FB/เว็บ

───────────────────────────────────────
แคปชั่น IG / Facebook (ก็อปวางได้เลย)
───────────────────────────────────────
${p.igfb}

${p.tags}

───────────────────────────────────────
แคปชั่นสั้น TikTok / Shorts / Reels
───────────────────────────────────────
${p.short}

${p.tags} #fyp #ดูดวงtiktok

───────────────────────────────────────
กฎเหล็ก: ไม่พูดราคา · ขายที่ "ของฟรีที่เป็นส่วนตัว" · ปิดท้ายชวนแอด LINE เสมอ
`;
}

const README =
`PRINNIE333 — แพ็กพร้อมโพสต์โซเชียล
════════════════════════════════════════
เปิดโฟลเดอร์ตามลำดับ → หยิบรูปขนาดที่ตรงแพลตฟอร์ม → เปิด caption.txt ก็อปแคปชั่นไปวาง

ลำดับแนะนำ (กรวยการตลาด):
  1-couple    ผูกดวงคู่   — ตัวไวรัล ดึงคนใหม่ (โพสต์ถี่สุด)
  2-daily     ดวงรายวัน  — แกนหลัก รักษาฐาน
  3-personal  พื้นดวง     — พิสูจน์ของจริง

แพลตฟอร์ม × ขนาดรูป:
  IG/FB ฟีด                → _4x5.jpg
  Story/Reels/TikTok/Shorts/VOOM → _9x16.jpg
  IG สี่เหลี่ยม / LINE rich  → _1x1.jpg
  LINE broadcast / ลิงก์     → _wide.jpg

จังหวะโพสต์ + สคริปต์คลิป: ดู marketing/SHORTS-SCRIPTS.md
แคปชั่นเวอร์ชันเต็มทุกแพลตฟอร์ม: ดู marketing/CAPTIONS.md

* ภาพทั้งหมด gen ใหม่/แก้ได้ที่ scripts/gen-marketing-art.js + scripts/build-poster.js
`;

// ── ประกอบแพ็ก ──
fs.rmSync(PACK, { recursive: true, force: true });
fs.mkdirSync(PACK, { recursive: true });
fs.writeFileSync(path.join(PACK, 'README.txt'), README);

let copied = 0;
for (const p of POSTS) {
  const dir = path.join(PACK, `${p.order}-${p.key}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of FORMATS) {
    const src = path.join(POSTERS, `poster-${p.key}${f.suffix}.jpg`);
    if (!fs.existsSync(src)) { console.warn('ขาดรูป:', src); continue; }
    fs.copyFileSync(src, path.join(dir, `${p.key}_${f.name}.jpg`));
    copied++;
  }
  fs.writeFileSync(path.join(dir, 'caption.txt'), captionText(p));
  console.log(`✅ ${p.order}-${p.key} (รูป 4 + caption.txt)`);
}
console.log(`\nเสร็จ — ${POSTS.length} คอนเซ็ปต์, ${copied} รูป → ${PACK}`);
