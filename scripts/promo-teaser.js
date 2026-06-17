// Teaser โปรโม Prinnie333 หลายฉาก — แต่ละฟีเจอร์ใช้พื้นหลัง MJ ต่างกัน + crossfade
// bg: #1 เนบิวลา(img, Ken Burns), #2 อาทิตย์-จันทร์(img), #4 minimal(video). ไม่ใช้ #3 ลูกแก้ว
// รัน: node scripts/promo-teaser.js [downloadsDir]
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const W = 1080, H = 1920, FPS = 30, D = 5, T = 0.6;       // 6 ฉาก × 5วิ, crossfade 0.6
const FONT = 'C:/Windows/Fonts/LeelaUIb.ttf';
const OUT = path.join(__dirname, '..', 'video');
const TMP = path.join(OUT, '_teaser');
const DL = process.argv[2] || 'C:/Users/b/Downloads';
const GOLD = '#E7C66B', GOLD2 = '#F6E2A0', WHITE = '#F6F1FF', INK = '#2A1438';

function find(pat) {
  const matches = fs.readdirSync(DL).filter(n => pat.test(n));
  if (!matches.length) throw new Error('ไม่พบไฟล์: ' + pat);
  // เลือกไฟล์ใหม่สุด — รองรับการ reload asset ทับ (เช่น re-export ความละเอียดสูงขึ้น)
  matches.sort((a, b) => fs.statSync(path.join(DL, b)).mtimeMs - fs.statSync(path.join(DL, a)).mtimeMs);
  return path.join(DL, matches[0]);
}
const BG_NEBULA = find(/^u6372841254_1_.*\.png$/i);
const BG_MINIMAL = find(/^u6372841254_4_.*\.mp4$/i);
const BG_SUNMOON = find(/golden_sun_and_crescent_moon.*\.png$/i); // ภาพนิ่งความละเอียดสูง อาทิตย์+จันทร์ (พื้นดวง)
const BG_COUPLE = find(/two_glowing_c.*\.mp4$/i);            // ดวงคู่ 2 จันทร์เสี้ยว (วิดีโอ)
const BG_DEEP = find(/deep_royal_pu.*\.mp4$/i);             // deep purple (วิดีโอ)
const BG_ZODIAC = find(/deep_purple_mystical_background_fa.*\.png$/i); // สัญลักษณ์ zodiac/ไพ่

// ---------- overlay helpers ----------
// บั๊ก resvg 2.6.2: สระ ำ (U+0E33) วาง advance ผิด ตัว า เลยทับตัวถัดไป → แตกเป็น นิคหิต(◌ํ)+สระอา(า)
const fixAm = s => String(s).replace(/ำ/g, 'ํา');
const esc = s => fixAm(String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, s, size, fill, op = 1, ls = 0) =>
  `<text x="${x}" y="${y}" font-family="Leelawadee UI" font-size="${size}" fill="${fill}" fill-opacity="${op}" text-anchor="middle"${ls ? ` letter-spacing="${ls}"` : ''}>${esc(s)}</text>`;
function sun(cx, cy, r) { let s = ''; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; s += `<line x1="${cx + Math.cos(a) * r * 1.35}" y1="${cy + Math.sin(a) * r * 1.35}" x2="${cx + Math.cos(a) * r * 1.7}" y2="${cy + Math.sin(a) * r * 1.7}" stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round"/>`; } return s + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD2}" stroke-width="4"/>`; }
function moon(cx, cy, r) { return `<path d="M ${cx + r * 0.35} ${cy - r} A ${r} ${r} 0 1 0 ${cx + r * 0.35} ${cy + r} A ${r * 0.8} ${r * 0.8} 0 1 1 ${cx + r * 0.35} ${cy - r} Z" fill="none" stroke="${GOLD2}" stroke-width="4"/>`; }
function star4(cx, cy, r) { return `<path d="M ${cx} ${cy - r} Q ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z" fill="${GOLD2}"/>`; }
function card(cx, cy, r) { const w = r * 1.4, h = r * 2; return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="9" fill="none" stroke="${GOLD2}" stroke-width="4"/>` + star4(cx, cy, r * 0.4); }
function couple(cx, cy, r) { return `<circle cx="${cx - r * 0.5}" cy="${cy}" r="${r * 0.72}" fill="none" stroke="${GOLD2}" stroke-width="4"/><circle cx="${cx + r * 0.5}" cy="${cy}" r="${r * 0.72}" fill="none" stroke="${GOLD2}" stroke-width="4"/>`; }

function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="sc" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#0A0614" stop-opacity="0.5"/><stop offset="38%" stop-color="#0A0614" stop-opacity="0.28"/>
<stop offset="65%" stop-color="#0A0614" stop-opacity="0.42"/><stop offset="100%" stop-color="#0A0614" stop-opacity="0.66"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sc)"/>
${text(W / 2, 320, 'PRINNIE333', 40, GOLD, 0.9, 14)}${star4(W / 2, 366, 8)}
${inner}</svg>`;
}

// ---------- 6 ฉาก ----------
const scenes = [
  { bg: BG_MINIMAL, type: 'video', svg: frame(
      sun(W / 2, 720, 60) +
      text(W / 2, 960, 'ดวงของคุณ', 90, WHITE) +
      text(W / 2, 1080, 'ไม่เหมือนใคร', 112, GOLD2) +
      text(W / 2, 1180, 'ดวงส่วนตัวจากวันเกิดจริง', 40, WHITE, 0.9) +
      text(W / 2, 1235, 'ไม่ใช่ดวง 12 ราศีทั่วไป', 40, WHITE, 0.8)) },
  { bg: BG_SUNMOON, type: 'image', kb: 'in', svg: frame(
      // พื้นหลังเป็นภาพอาทิตย์+จันทร์ทองอยู่แล้ว → ไม่วาดไอคอนซ้ำ, ดันข้อความลงล่าง + แถบมืดนุ่มให้อ่านง่าย
      `<defs><linearGradient id="b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A0614" stop-opacity="0"/><stop offset="1" stop-color="#0A0614" stop-opacity="0.82"/></linearGradient></defs>` +
      `<rect x="0" y="1200" width="${W}" height="720" fill="url(#b2)"/>` +
      text(W / 2, 1410, 'พื้นดวงส่วนตัว', 84, GOLD2) +
      text(W / 2, 1510, 'รู้จักอาทิตย์ จันทร์ ลัคนา', 42, WHITE, 0.92) +
      text(W / 2, 1570, 'และตัวตนที่แท้จริงของคุณ', 42, WHITE, 0.88)) },
  { bg: BG_NEBULA, type: 'image', kb: 'in', svg: frame(
      sun(W / 2, 770, 50) +
      text(W / 2, 990, 'ดวงรายวันส่วนตัว', 80, GOLD2) +
      text(W / 2, 1095, 'ดาวจรทำมุมกับดวงคุณไม่ซ้ำกัน', 40, WHITE, 0.92) +
      text(W / 2, 1155, 'ส่งถึงคุณทุกเช้า', 42, WHITE, 0.88)) },
  { bg: BG_ZODIAC, type: 'image', kb: 'pan', svg: frame(
      card(W / 2, 770, 50) +
      text(W / 2, 990, 'ไพ่ทาโรต์', 88, GOLD2) +
      text(W / 2, 1095, 'ไขคำตอบเรื่องที่ค้างใจ', 42, WHITE, 0.92) +
      text(W / 2, 1155, 'รายวัน • สัปดาห์ • เดือน • ปี', 38, WHITE, 0.85)) },
  { bg: BG_NEBULA, type: 'image', kb: 'pan', svg: frame(
      couple(W / 2, 765, 52) +
      text(W / 2, 990, 'ผูกดวงคู่', 90, GOLD2) +
      text(W / 2, 1095, 'ดูความเข้ากันจากดวงจริง', 42, WHITE, 0.92) +
      text(W / 2, 1155, 'ของสองคน', 42, WHITE, 0.88)) },
  { bg: BG_MINIMAL, type: 'video', svg: frame(
      text(W / 2, 800, 'เริ่มรู้จักดวงของคุณ', 64, WHITE) +
      text(W / 2, 900, 'วันนี้ ฟรี!', 96, GOLD2) +
      `<rect x="${W / 2 - 330}" y="1080" width="660" height="175" rx="88" fill="${GOLD2}"/>` +
      text(W / 2, 1152, 'รับพื้นดวงฟรี', 54, INK) +
      text(W / 2, 1218, 'LINE  @prinnie333', 42, INK, 0.95, 1) +
      text(W / 2, 1360, 'ดวงส่วนตัว • รายวัน • ไพ่ • ดวงคู่', 38, WHITE, 0.85)) },
];

// ---------- render ----------
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const fontOpt = { font: { loadSystemFonts: false, fontFiles: [FONT], defaultFontFamily: 'Leelawadee UI' } };

const clips = scenes.map((sc, i) => {
  const ov = path.join(TMP, `ov${i}.png`);
  fs.writeFileSync(ov, new Resvg(sc.svg, fontOpt).render().asPng());
  const out = path.join(TMP, `scene${i}.mp4`);
  // ข้อความ fade เข้า/ออกภายในฉาก ให้หายก่อนถึงรอยต่อ crossfade (กันตัวอักษร 2 ฉากซ้อนกัน)
  // overlay ต้องเป็น stream (loop ภาพ) ไม่งั้น fade บนภาพเฟรมเดียวจะค้าง
  const ovIn = ['-loop', '1', '-framerate', String(FPS), '-t', String(D), '-i', ov];
  // ข้อความต้องหายสนิท "นอก" โซน crossfade (รอยต่ออยู่ที่ภายในฉาก 0–0.6 และ 4.4–5.0)
  // → fade in เริ่ม 0.9 (หายจากโซนต้น) / fade out จบ ~4.1 (ก่อนโซนท้าย) = ไม่มีเงาตัวอักษรตอนเปลี่ยนฉาก
  const ovFade = `[1:v]fade=t=in:st=0.9:d=0.5:alpha=1,fade=t=out:st=${(D - 1.4).toFixed(2)}:d=0.5:alpha=1[ov]`;

  let args;
  if (sc.type === 'video') {
    args = ['-y', '-stream_loop', '-1', '-t', String(D), '-i', sc.bg, ...ovIn,
      '-filter_complex',
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=${FPS},setsar=1,eq=saturation=1.12[bg];${ovFade};[bg][ov]overlay=0:0:format=auto[v]`,
      '-map', '[v]', '-t', String(D), '-r', String(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out];
  } else {
    // Ken Burns: ค่อย ๆ ซูม (pan เลื่อนเล็กน้อยสำหรับฉากที่ตั้ง kb='pan')
    const frames = D * FPS;
    const x = sc.kb === 'pan' ? `'(iw-iw/zoom)*on/${frames}'` : `'iw/2-(iw/zoom/2)'`;
    const y = sc.kb === 'pan' ? `'(ih-ih/zoom)*0.15'` : `'ih/2-(ih/zoom/2)'`;
    const zexpr = `'min(zoom+0.0007,1.13)'`;
    args = ['-y', '-loop', '1', '-framerate', String(FPS), '-t', String(D), '-i', sc.bg, ...ovIn,
      '-filter_complex',
      `[0:v]scale=1620:2880:force_original_aspect_ratio=increase,crop=1620:2880,zoompan=z=${zexpr}:d=${frames}:x=${x}:y=${y}:s=1080x1920,setsar=1[bg];${ovFade};[bg][ov]overlay=0:0:format=auto[v]`,
      '-map', '[v]', '-t', String(D), '-r', String(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out];
  }
  console.log(`ฉาก ${i + 1}/6 (${sc.type})...`);
  execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'ignore'] });
  return out;
});

// ---------- crossfade chain ----------
console.log('ต่อฉากด้วย crossfade...');
const inputs = clips.flatMap(c => ['-i', c]);
let fc = '', prev = '0:v';
for (let j = 1; j < clips.length; j++) {
  const lbl = j === clips.length - 1 ? 'v' : `x${j}`;
  const off = (j * (D - T)).toFixed(2);
  fc += `[${prev}][${j}:v]xfade=transition=fade:duration=${T}:offset=${off}[${lbl}];`;
  prev = lbl;
}
fc = fc.replace(/;$/, '');
const final = path.join(OUT, 'prinnie-teaser-9x16.mp4');
execFileSync(ffmpeg, ['-y', ...inputs, '-filter_complex', fc, '-map', '[v]',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', final],
  { stdio: ['ignore', 'ignore', 'inherit'] });
const dur = (6 * D - 5 * T).toFixed(1);
console.log(`✅ เสร็จ (${dur}s): ${final}`);
