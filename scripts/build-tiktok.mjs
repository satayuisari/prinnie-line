// คลิป TikTok / Reels / Shorts 9:16 (1080×1920) ให้แม่ลงเอง — ทำจากคอนเทนต์รายสัปดาห์
//
//   node scripts/build-tiktok.mjs <spec.json> <out.mp4>
//
// spec: { "bg": "marketing/partner-kit/src/moon.jpg",
//         "cards": [ { "kicker": "...", "title": "...", "lines": ["..."], "rank": 3, "sec": 3 } ... ],
//         "music": "marketing/ambient.m4a" (ไม่ใส่ = ไม่มีเสียง) }
//
// ทำไมไม่มีเสียงพากย์: คนดู TikTok ส่วนใหญ่ดูแบบเลื่อนผ่าน ตัวหนังสือต้องเล่าเรื่องได้เอง
// แม่ใส่เพลงที่กำลังฮิตในแอป TikTok ตอนโพสต์จะได้ยอดดีกว่าเพลงที่ฝังมา
// โครงที่ใช้: ตะขอ 2–3 วิแรก → นับถอยหลัง 3-2-1 (คนดูต่อจนจบเพื่อดูอันดับ 1) → ชวนคอมเมนต์
//
// ⚠️ ห้ามใส่ letter-spacing กับข้อความไทย — วรรณยุกต์เคลื่อน (ดู build-mom-post.mjs)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/bon/astral-realm/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const [specFile, out] = process.argv.slice(2);
if (!specFile || !out) { console.error('ใช้: node scripts/build-tiktok.mjs <spec.json> <out.mp4>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const FF = path.resolve('node_modules/ffmpeg-static/ffmpeg');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const bg = 'data:image/jpeg;base64,' + fs.readFileSync(path.resolve(spec.bg)).toString('base64');
const W = 1080, H = 1920, FPS = 30;

const CSS = `* { margin:0; box-sizing:border-box; }
body { width:${W}px; height:${H}px; position:relative; overflow:hidden; text-align:center; color:#F4F1FB;
  font-family:'Sukhumvit Set','Thonburi',sans-serif; background:#120D22; }
.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:saturate(1.05); }
.shade { position:absolute; inset:0; background:linear-gradient(to bottom, rgba(15,11,28,.55) 0%, rgba(15,11,28,.25) 30%, rgba(15,11,28,.75) 60%, rgba(15,11,28,.95) 100%); }
.safe { position:absolute; left:80px; right:140px; top:330px; bottom:420px; display:flex; flex-direction:column; justify-content:center; align-items:center; }
.brand { position:absolute; top:150px; left:50%; transform:translateX(-50%); padding:10px 30px; border-radius:40px; font-size:34px; background:rgba(15,11,28,.6); color:#EDE6FF; }
.kicker { font-size:46px; color:#F0D49A; text-shadow:0 3px 10px #000; }
.rank { width:170px; height:170px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:110px; font-weight:800; color:#2A1F48;
  background:radial-gradient(circle at 35% 30%, #FFF1CF, #E2BD78 55%, #A87A33); box-shadow:0 0 0 6px rgba(212,175,110,.35), 0 10px 40px rgba(0,0,0,.6); margin-bottom:30px; }
.title { font-size:118px; font-weight:800; line-height:1.15; margin-top:10px;
  background:linear-gradient(180deg,#FFF3D6 0%,#E9C98A 55%,#B8893E 100%); -webkit-background-clip:text; color:transparent; filter:drop-shadow(0 4px 14px rgba(0,0,0,.9)); }
.sub { font-size:40px; color:#D9D1F0; margin-top:14px; text-shadow:0 2px 8px #000; }
.line { font-size:52px; font-weight:700; color:#FFFFFF; margin-top:26px; line-height:1.35; text-shadow:0 3px 10px #000; }
.foot { position:absolute; bottom:300px; width:100%; font-size:40px; color:#E9C98A; }`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-'));
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: W, height: H } });
const parts = [];
for (const [i, c] of spec.cards.entries()) {
  const html = `<style>${CSS}</style><img class="bg" src="${bg}"><div class="shade"></div>
    <div class="brand">อาจารย์ปรินนี่ · Prinnie333</div>
    <div class="safe">${c.rank ? `<div class="rank">${c.rank}</div>` : ''}
      ${c.kicker ? `<div class="kicker">${esc(c.kicker)}</div>` : ''}
      <div class="title">${esc(c.title)}</div>${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ''}
      ${(c.lines || []).map(l => `<div class="line">${esc(l)}</div>`).join('')}</div>
    <div class="foot">LINE @prinnie333</div>`;
  await pg.setContent(html); await pg.waitForTimeout(400);
  const png = path.join(tmp, `c${i}.png`);
  await pg.screenshot({ path: png });
  // ซูมช้า ๆ ให้ภาพนิ่งดูมีชีวิต (Ken Burns) · เฟดเข้า/ออกการ์ดละ 0.25 วิ
  const sec = c.sec || 3, frames = Math.round(sec * FPS);
  const mp4 = path.join(tmp, `c${i}.mp4`);
  execFileSync(FF, ['-y', '-loop', '1', '-i', png, '-filter_complex',
    `scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0006,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},` +
    `fade=t=in:st=0:d=0.25,fade=t=out:st=${(sec - 0.25).toFixed(2)}:d=0.25,format=yuv420p`,
    '-t', String(sec), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', mp4], { stdio: 'ignore' });
  parts.push(mp4);
}
await b.close();
const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
const silent = path.join(tmp, 'silent.mp4');
execFileSync(FF, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent], { stdio: 'ignore' });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
if (spec.music && fs.existsSync(spec.music)) {
  execFileSync(FF, ['-y', '-i', silent, '-i', spec.music, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-af', 'afade=t=out:st=' + (spec.cards.reduce((s, c) => s + (c.sec || 3), 0) - 1.5) + ':d=1.5', '-shortest', path.resolve(out)], { stdio: 'ignore' });
} else fs.copyFileSync(silent, path.resolve(out));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('บันทึก', out);
