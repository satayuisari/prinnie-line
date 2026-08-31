// YouTube Short / Reel / TikTok 9:16 สำหรับแคมเปญ "ดวงเลือกคุณ"
//
//   node scripts/build-loyalty-short.js
//   → marketing/campaign/duang-luek-khun-short.mp4  (1080×1920 · ~18 วินาที)
//
// โครง 5 การ์ด — เขียนให้คนดูรู้เรื่องภายใน 3 วินาทีแรก เพราะ Short ตัดสินกันตรงนั้น
//   1. ตะขอ      "ดวงของทุกคนไม่เหมือนกัน"       ← ต้องอ่านจบก่อนคนปัด
//   2. กติกา     ทุกวันที่ 15 ดาวเลือกดวงที่แรงสุด
//   3. รางวัล    ได้คุยกับอาจารย์ตัวต่อตัว 1 ชม.   ← ภาพคนจริง จุดที่หยุดสายตา
//   4. ทางเข้า   สมัคร → ครบ 14 วัน → เข้าคำนวณเอง
//   5. ปิด       แอด LINE @prinnie333
//
// ไม่มีเสียง — Short ส่วนใหญ่ดูแบบปิดเสียง ตัวหนังสือต้องเล่าเรื่องได้เอง
// ใส่เพลงทีหลังในแอปได้ (marketing/ambient.m4a มีไว้ให้แล้ว)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

const W = 1080, H = 1920;
const OUT = path.join(__dirname, '..', 'marketing', 'campaign');
const TMP = path.join(OUT, '_short');
const HERO = path.join(OUT, 'src', 'duang-luek-khun-hero.png');
const FF = path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg');
const FONT = "'Sarabun','Tahoma','Noto Sans Thai',sans-serif";
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// การ์ด: kicker เล็กด้านบน · พาดหัวใหญ่กลางจอ · บรรทัดเสริมด้านล่าง
// hero:true = มีภาพคนเป็นพื้น (การ์ดรางวัล) ที่เหลือพื้นม่วงล้วนให้ตัวอักษรเด่น
const CARDS = [
  { kicker: '', head: 'ดวงของทุกคน\nไม่เหมือนกัน', sub: 'เดือนนี้ดาวจึงเลือกไม่เหมือนกัน', dur: 3.4 },
  { kicker: 'ทุกวันที่ 15', head: 'ดาวเลือก\nดวงที่แรงที่สุด', sub: 'คำนวณจากวัน เวลา และสถานที่เกิดจริง', dur: 3.6 },
  { kicker: 'สิทธิ์ที่ได้', head: 'คุยกับอาจารย์\nปรินนี่ 1 ชั่วโมง', sub: 'ตัวต่อตัว ไม่มีค่าใช้จ่ายเพิ่ม', dur: 4.0, hero: true },
  { kicker: 'ไม่ใช่การจับรางวัล', head: 'เป็นสมาชิก\nครบ 14 วัน', sub: 'ดวงคุณเข้าการคำนวณเอง ไม่ต้องสมัครอะไรอีก', dur: 3.6 },
  { kicker: 'เดือนนี้อาจเป็นคุณ', head: 'ดวงเลือกคุณ', sub: 'แอด LINE @prinnie333', dur: 3.4, gold: true },
];

function svg(c, i) {
  const lines = c.head.split('\n');
  const headSize = lines.some(l => l.length > 13) ? 108 : 124;
  const startY = H * 0.46 - (lines.length - 1) * headSize * 0.62;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="${FONT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#1B0B3A"/><stop offset="55%" stop-color="#2D0A5A"/><stop offset="100%" stop-color="#0A0418"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF7E2"/><stop offset="44%" stop-color="#F3D98F"/><stop offset="100%" stop-color="#C79A4E"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A0418" stop-opacity=".22"/>
      <stop offset="34%" stop-color="#0A0418" stop-opacity=".38"/>
      <stop offset="62%" stop-color="#0A0418" stop-opacity=".88"/>
      <stop offset="100%" stop-color="#0A0418" stop-opacity=".96"/>
    </linearGradient>
  </defs>
  ${c.hero ? `<rect width="${W}" height="${H}" fill="url(#scrim)"/>`
           : `<rect width="${W}" height="${H}" fill="url(#bg)"/>${
               (() => { let s = 1234 + i * 77, r = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648, o = '';
                 for (let k = 0; k < 120; k++) o += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(r() * 1.5 + .4).toFixed(1)}" fill="#F8D98A" opacity="${(r() * .45 + .18).toFixed(2)}"/>`;
                 return o; })()}`}
  ${c.kicker ? `<text x="${W / 2}" y="${H * 0.30}" text-anchor="middle" font-size="42" font-weight="700"
      fill="#E8C77A" letter-spacing="3">${esc(c.kicker)}</text>` : ''}
  ${lines.map((l, k) => `<text x="${W / 2}" y="${startY + k * headSize * 1.24}" text-anchor="middle"
      font-size="${headSize}" font-weight="800" fill="${c.gold ? 'url(#gold)' : '#FFFFFF'}">${esc(l)}</text>`).join('')}
  <text x="${W / 2}" y="${H * 0.68}" text-anchor="middle" font-size="44" font-weight="400" fill="#CFC2EC">${esc(c.sub)}</text>
  <text x="${W / 2}" y="${H - 120}" text-anchor="middle" font-size="38" font-weight="700" fill="#E8C77A" opacity=".9">อาจารย์ปรินนี่ · Prinnie333</text>
</svg>`;
}

(async () => {
  if (!fs.existsSync(FF)) { console.error('ไม่เจอ ffmpeg-static — รัน npm install ก่อน'); process.exit(1); }
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  console.log('เรนเดอร์การ์ด…');
  for (const [i, c] of CARDS.entries()) {
    const png = new Resvg(svg(c, i), { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: W } }).render().asPng();
    const file = path.join(TMP, `c${i}.png`);
    if (c.hero && fs.existsSync(HERO)) {
      const bg = await sharp(HERO).resize(W, H, { fit: 'cover', position: 'top' }).toBuffer();
      await sharp(bg).composite([{ input: png, left: 0, top: 0 }]).png().toFile(file);
    } else fs.writeFileSync(file, png);
    console.log(`  ${i + 1}/${CARDS.length} ${c.head.replace('\n', ' ')} (${c.dur}s)`);
  }

  console.log('\nต่อเป็นวิดีโอ…');
  const clips = [];
  for (const [i, c] of CARDS.entries()) {
    const out = path.join(TMP, `c${i}.mp4`);
    // ซูมเข้าช้า ๆ ให้ภาพนิ่งไม่ดูตาย + เฟดเข้า/ออกกันสะดุดตอนต่อ
    const frames = Math.round(c.dur * 30);
    execFileSync(FF, ['-y', '-loglevel', 'error', '-loop', '1', '-i', path.join(TMP, `c${i}.png`),
      '-vf', `zoompan=z='min(zoom+0.0009,1.10)':d=${frames}:s=${W}x${H}:fps=30,` +
             `fade=t=in:st=0:d=0.35,fade=t=out:st=${(c.dur - 0.35).toFixed(2)}:d=0.35,format=yuv420p`,
      '-t', String(c.dur), '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', out]);
    clips.push(out);
  }
  const list = path.join(TMP, 'list.txt');
  fs.writeFileSync(list, clips.map(c => `file '${c}'`).join('\n'));
  const final = path.join(OUT, 'duang-luek-khun-short.mp4');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final]);

  fs.rmSync(TMP, { recursive: true, force: true });
  const total = CARDS.reduce((a, c) => a + c.dur, 0);
  console.log(`\n✓ ${path.relative(process.cwd(), final)}  ${W}×${H} · ${total.toFixed(1)} วินาที · ${(fs.statSync(final).size / 1048576).toFixed(1)} MB`);
  console.log('  ไม่มีเสียง — ใส่เพลงในแอปตอนอัปโหลดได้ (marketing/ambient.m4a มีให้)');
})();
