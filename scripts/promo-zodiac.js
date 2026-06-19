// คลิป Shorts ราศี 9:16 (Hook → คำทำนายภาพรวม → Twist เข้าจุดขายส่วนตัว + CTA LINE)
// ดึงคนจากคอนเทนต์ราศีทั่วไป → แอด LINE รับพื้นดวงส่วนตัวฟรี (ดู MARKETING.md)
// รัน: node scripts/promo-zodiac.js [ราศี|index|all] [downloadsDir]
//   เช่น  node scripts/promo-zodiac.js มังกร      → คลิปเดียว
//         node scripts/promo-zodiac.js all         → ครบ 12 ราศี
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const W = 1080, H = 1920, FPS = 30, T = 0.6;
const FONT = 'C:/Windows/Fonts/LeelaUIb.ttf';
const OUT = path.join(__dirname, '..', 'video', 'zodiac');
const DL = process.argv[3] || 'C:/Users/b/Downloads';
const GOLD = '#E7C66B', GOLD2 = '#F6E2A0', WHITE = '#F6F1FF', INK = '#2A1438';

// ---------- พื้นหลังความละเอียดสูง (ภาพนิ่ง เลี่ยงวิดีโอ MJ 464p ที่เบลอ) ----------
function find(pat) {
  const matches = fs.readdirSync(DL).filter(n => pat.test(n));
  if (!matches.length) throw new Error('ไม่พบไฟล์: ' + pat);
  matches.sort((a, b) => fs.statSync(path.join(DL, b)).mtimeMs - fs.statSync(path.join(DL, a)).mtimeMs);
  return path.join(DL, matches[0]);
}
const BG_ZODIAC = find(/deep_purple_mystical_background_fa.*\.png$/i); // สัญลักษณ์ราศี (hook)
const BG_NEBULA = find(/^u6372841254_1_.*\.png$/i);                    // เนบิวลา (คำทำนาย)
const BG_SUNMOON = find(/golden_sun_and_crescent_moon.*\.png$/i);      // อาทิตย์+จันทร์ (CTA = ดวงส่วนตัว)

// ---------- helpers ----------
const fixAm = s => String(s).replace(/ำ/g, 'ํา'); // บั๊ก resvg 2.6.2: สระ ำ วาง advance ผิด
// ตัด emoji/สัญลักษณ์ที่ฟอนต์ไม่มี glyph (resvg render เป็นกล่อง □) — เก็บไว้ใช้ในแคปชั่นแยก
const stripEmoji = s => String(s).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu, '').replace(/\s+$/, '');
const esc = s => fixAm(stripEmoji(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, s, size, fill, op = 1, ls = 0) =>
  `<text x="${x}" y="${y}" font-family="Leelawadee UI" font-size="${size}" fill="${fill}" fill-opacity="${op}" text-anchor="middle"${ls ? ` letter-spacing="${ls}"` : ''}>${esc(s)}</text>`;
function star4(cx, cy, r) { return `<path d="M ${cx} ${cy - r} Q ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z" fill="${GOLD2}"/>`; }
function sun(cx, cy, r) { let s = ''; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; s += `<line x1="${cx + Math.cos(a) * r * 1.35}" y1="${cy + Math.sin(a) * r * 1.35}" x2="${cx + Math.cos(a) * r * 1.7}" y2="${cy + Math.sin(a) * r * 1.7}" stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round"/>`; } return s + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD2}" stroke-width="4"/>`; }
function panel(y, h, op = 0.55) { return `<rect x="60" y="${y}" width="${W - 120}" height="${h}" rx="40" fill="#0A0614" fill-opacity="${op}"/>`; }
function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="sc" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#0A0614" stop-opacity="0.5"/><stop offset="38%" stop-color="#0A0614" stop-opacity="0.26"/>
<stop offset="65%" stop-color="#0A0614" stop-opacity="0.42"/><stop offset="100%" stop-color="#0A0614" stop-opacity="0.66"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sc)"/>
${text(W / 2, 300, 'PRINNIE333', 38, GOLD, 0.9, 13)}${star4(W / 2, 344, 7)}
${inner}</svg>`;
}

// ---------- คำทำนายภาพรวม 12 ราศี (โทนบวก, period-neutral แก้ได้รายเดือน) ----------
const SIGNS = [
  { n: 'ราศีเมษ', hook: 'พลังงานมาเต็ม มีจังหวะพุ่ง 🔥', body: ['สิ่งที่กล้าเริ่มก่อนใครจะกลายเป็นโอกาส', 'งานมีคนสนับสนุนแบบไม่คาดคิด', 'ความรักสดใสถ้ากล้าเปิดใจก่อน'] },
  { n: 'ราศีพฤษภ', hook: 'เรื่องเงินเริ่มมั่นคงขึ้น 💰', body: ['ความอดทนที่สะสมไว้กำลังออกผล', 'มีลาภลอยหรือรายได้ทางใหม่เข้ามา', 'ความสัมพันธ์อบอุ่นขึ้นเมื่อให้เวลากัน'] },
  { n: 'ราศีเมถุน', hook: 'ไอเดียพุ่ง คนรอบตัวรับฟัง 💡', body: ['เสน่ห์การพูดพาโอกาสใหม่เข้ามา', 'งานที่ใช้ความคิดสร้างสรรค์รุ่ง', 'เรื่องรักให้ฟังใจตัวเองให้ชัด'] },
  { n: 'ราศีกรกฎ', hook: 'หัวใจได้พักและเติมพลัง 🌙', body: ['คนใกล้ตัวคือที่พึ่งที่ดีในช่วงนี้', 'งานค่อยเป็นค่อยไปแต่มั่นคง', 'ความรักลึกซึ้งขึ้นเมื่อซื่อสัตย์กับใจ'] },
  { n: 'ราศีสิงห์', hook: 'ถึงเวลาเปล่งประกาย ✨', body: ['ความมั่นใจดึงดูดความสำเร็จเข้าหา', 'มีโอกาสได้รับการยอมรับในงาน', 'ความรักสดใสถ้าฟังกันมากขึ้น'] },
  { n: 'ราศีกันย์', hook: 'ความตั้งใจเริ่มเห็นผลชัด 🌿', body: ['ความใส่ใจรายละเอียดทำให้คนเชื่อมั่น', 'การเงินเป็นระเบียบขึ้น', 'เรื่องรักปล่อยให้เป็นธรรมชาติจะดีที่สุด'] },
  { n: 'ราศีตุลย์', hook: 'สมดุลกลับมา ชีวิตลงตัว ⚖️', body: ['งานและความสัมพันธ์เริ่มไปด้วยกันได้', 'มีคนคอยช่วยในจังหวะสำคัญ', 'ความรักมีโอกาสตัดสินใจครั้งสำคัญ'] },
  { n: 'ราศีพิจิก', hook: 'พลังลึกหนุนนำ เปลี่ยนแปลงครั้งใหญ่ 🦂', body: ['สิ่งที่จบไปเปิดทางให้สิ่งที่ดีกว่า', 'สัญชาตญาณแม่นยำ เชื่อใจตัวเอง', 'ความรักเข้มข้นถ้ากล้าจริงใจ'] },
  { n: 'ราศีธนู', hook: 'โอกาสใหม่และการเดินทางเปิดกว้าง 🏹', body: ['ความกล้าออกจากกรอบพาไปเจอสิ่งดี', 'มีลาภจากคนไกลหรือต่างถิ่น', 'ความรักสนุกขึ้นเมื่อให้อิสระต่อกัน'] },
  { n: 'ราศีมังกร', hook: 'เรื่องเงินมีข่าวดีที่ไม่ทันตั้งตัว 💰', body: ['สิ่งที่ลงแรงไว้เริ่มออกดอกออกผล', 'มีโอกาสได้รับการยอมรับและรายได้ใหม่', 'ใจเย็นกับคนใกล้ตัว ความสัมพันธ์จะแน่นขึ้น'] },
  { n: 'ราศีกุมภ์', hook: 'ไอเดียแหวกแนวกลายเป็นโอกาส 🌌', body: ['ความต่างของคุณคือจุดแข็ง', 'มีเพื่อนหรือกลุ่มคนใหม่ที่หนุนนำ', 'ความรักต้องการพื้นที่และความเข้าใจ'] },
  { n: 'ราศีมีน', hook: 'ฝันและสัญชาตญาณนำทางถูก 🐟', body: ['ความอ่อนโยนดึงดูดสิ่งดีเข้ามา', 'งานสายสร้างสรรค์หรือช่วยเหลือคนรุ่ง', 'ความรักโรแมนติกถ้าเปิดใจรับ'] },
];

// ---------- สร้าง 3 ฉากต่อ 1 ราศี ----------
function scenes(z) {
  return [
    { bg: BG_ZODIAC, kb: 'pan', D: 4.5, svg: frame(
        star4(W / 2, 700, 22) +
        text(W / 2, 880, z.n, 104, GOLD2) +
        panel(960, 150, 0.42) +
        text(W / 2, 1055, z.hook, 46, WHITE, 0.96)) },
    { bg: BG_NEBULA, kb: 'in', D: 14, svg: frame(
        sun(W / 2, 640, 46) +
        text(W / 2, 800, z.n + ' ช่วงนี้', 56, GOLD2) +
        panel(870, 430) +
        text(W / 2, 985, z.body[0], 44, WHITE, 0.96) +
        text(W / 2, 1095, z.body[1], 44, WHITE, 0.96) +
        text(W / 2, 1205, z.body[2], 44, WHITE, 0.96)) },
    { bg: BG_SUNMOON, kb: 'in', D: 7.5, svg: frame(
        `<defs><linearGradient id="b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A0614" stop-opacity="0"/><stop offset="1" stop-color="#0A0614" stop-opacity="0.85"/></linearGradient></defs>` +
        `<rect x="0" y="1150" width="${W}" height="770" fill="url(#b2)"/>` +
        text(W / 2, 1330, 'นี่คือภาพรวมของทั้งราศี', 44, WHITE, 0.9) +
        text(W / 2, 1400, 'แต่ดวงจริงของคุณ ไม่เหมือนใคร', 50, GOLD2) +
        `<rect x="${W / 2 - 340}" y="1480" width="680" height="170" rx="85" fill="${GOLD2}"/>` +
        text(W / 2, 1548, 'แอด LINE รับพื้นดวงฟรี', 48, INK) +
        text(W / 2, 1612, '@prinnie333', 44, INK, 0.95, 1) +
        text(W / 2, 1730, 'คำนวณจากวันเกิด เวลา สถานที่ของคุณ', 34, WHITE, 0.82)) },
  ];
}

// ---------- render 1 ราศี ----------
function render(z) {
  const tmp = path.join(OUT, '_tmp');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const fontOpt = { font: { loadSystemFonts: false, fontFiles: [FONT], defaultFontFamily: 'Leelawadee UI' } };
  const scs = scenes(z);

  const clips = scs.map((sc, i) => {
    const ov = path.join(tmp, `ov${i}.png`);
    fs.writeFileSync(ov, new Resvg(sc.svg, fontOpt).render().asPng());
    const out = path.join(tmp, `s${i}.mp4`);
    const frames = Math.round(sc.D * FPS);
    const x = sc.kb === 'pan' ? `'(iw-iw/zoom)*on/${frames}'` : `'iw/2-(iw/zoom/2)'`;
    const y = sc.kb === 'pan' ? `'(ih-ih/zoom)*0.12'` : `'ih/2-(ih/zoom/2)'`;
    const zexpr = `'min(zoom+0.0006,1.12)'`;
    const ovFade = `[1:v]fade=t=in:st=0.6:d=0.5:alpha=1,fade=t=out:st=${(sc.D - 0.9).toFixed(2)}:d=0.5:alpha=1[ov]`;
    const args = ['-y', '-loop', '1', '-framerate', String(FPS), '-t', String(sc.D), '-i', sc.bg,
      '-loop', '1', '-framerate', String(FPS), '-t', String(sc.D), '-i', ov,
      '-filter_complex',
      `[0:v]scale=1620:2880:force_original_aspect_ratio=increase,crop=1620:2880,zoompan=z=${zexpr}:d=${frames}:x=${x}:y=${y}:s=1080x1920,setsar=1,eq=saturation=1.08[bg];${ovFade};[bg][ov]overlay=0:0:format=auto[v]`,
      '-map', '[v]', '-t', String(sc.D), '-r', String(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out];
    execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'ignore'] });
    return { out, D: sc.D };
  });

  const inputs = clips.flatMap(c => ['-i', c.out]);
  let fc = '', prev = '0:v', acc = 0;
  for (let j = 1; j < clips.length; j++) {
    const lbl = j === clips.length - 1 ? 'v' : `x${j}`;
    acc += clips[j - 1].D - T;
    fc += `[${prev}][${j}:v]xfade=transition=fade:duration=${T}:offset=${acc.toFixed(2)}[${lbl}];`;
    prev = lbl;
  }
  fc = fc.replace(/;$/, '');
  const safe = z.n.replace(/^ราศี/, '');
  const final = path.join(OUT, `prinnie-zodiac-${safe}-9x16.mp4`);
  execFileSync(ffmpeg, ['-y', ...inputs, '-filter_complex', fc, '-map', '[v]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', final],
    { stdio: ['ignore', 'ignore', 'ignore'] });
  const dur = (scs.reduce((s, c) => s + c.D, 0) - (scs.length - 1) * T).toFixed(1);
  console.log(`✅ ${z.n} (${dur}s): ${final}`);
}

// ---------- main ----------
fs.mkdirSync(OUT, { recursive: true });
const arg = (process.argv[2] || 'มังกร').trim();
let list;
if (arg === 'all') list = SIGNS;
else if (/^\d+$/.test(arg)) list = [SIGNS[Number(arg)]];
else list = SIGNS.filter(z => z.n.includes(arg));
if (!list.length || !list[0]) { console.error('ไม่พบราศี:', arg, '\nใช้: เมษ พฤษภ เมถุน กรกฎ สิงห์ กันย์ ตุลย์ พิจิก ธนู มังกร กุมภ์ มีน | all'); process.exit(1); }
list.forEach(render);
