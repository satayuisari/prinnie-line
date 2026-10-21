// คลิป TikTok แบบตัดต่อจากฟุตเทจจริง — ทดสอบว่าทำแบบ CapCut ได้แค่ไหน (bon 5 ต.ค. 69)
//
//   node scripts/build-tiktok-edit.mjs <spec.json> <out.mp4>
//
// spec: { "music": "...m4a",
//   "scenes": [ { "clip": "...mp4", "from": 0, "speed": 1, "ramp": true, "sec": 3,
//                 "badge": "...", "title": "...", "sub": "...", "words": ["..."], "emoji": "♈" } ] }
//
// ขั้นตอน
//   1. ฟุตเทจ: ตัดช่วง · ปรับความเร็ว (ramp = สโลว์แล้วเร่ง) · ขยายเป็น 1080×1920 · เกรดสีโทนม่วงทอง · ซูมกระแทกต้นฉาก
//   2. ตัวหนังสือ: HTML พื้นใส เด้งทีละคำ (Web Animations) ถ่ายทีละเฟรมแบบมีช่องโปร่งใส แล้ววางทับฟุตเทจ
//   3. เสียง: วูชตอนตัดฉาก + ป๊อปตอนสัญลักษณ์เด้ง + เพลงคลอ (สังเคราะห์/ไฟล์ของเราเอง ไม่ติดลิขสิทธิ์)
// ⚠️ ห้ามใส่ letter-spacing กับข้อความไทย
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/bon/astral-realm/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const [specFile, out] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const FF = path.resolve('node_modules/ffmpeg-static/ffmpeg');
const W = 1080, H = 1920, FPS = 30;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ttedit-'));
const run = (args) => execFileSync(FF, ['-y', '-loglevel', 'error', ...args]);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

let t = 0;
const scenes = spec.scenes.map(s => { const r = { ...s, start: t, dur: (s.sec || 3) * 1000 }; t += r.dur; return r; });
const TOTAL = t;

// ── 1. ฟุตเทจ ────────────────────────────────────────────────────────────
const GRADE = "eq=contrast=1.12:saturation=1.15:brightness=-0.02,colorbalance=rs=.06:bs=.10:rh=.08:gh=.03:bh=-.04,vignette=PI/5";
const segs = scenes.map((s, i) => {
  const sec = s.dur / 1000, o = path.join(tmp, `v${i}.mp4`);
  const speed = s.speed || 1;
  // ramp: ครึ่งแรกสโลว์ 0.5x แล้วเร่ง 2x — ใช้ฟุตเทจเท่ากับเล่นปกติ
  const pts = s.ramp ? `setpts='if(lt(T,${(sec * 0.45).toFixed(2)}),2*PTS,0.5*PTS+${(sec * 0.45 * 1.5).toFixed(2)}/TB)'` : `setpts=PTS/${speed}`;
  const frames = Math.round(sec * FPS);
  run(['-ss', String(s.from || 0), '-i', path.resolve(s.clip), '-an', '-vf',
    `${pts},fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},unsharp=5:5:0.6,${GRADE},` +
    // ซูมกระแทก: 8 เฟรมแรกขยาย 1.12 → 1.0 แล้วค่อย ๆ ซูมเข้าช้า ๆ
    `scale=w='${W}*(1+0.12*max(0,1-n/8)+0.0012*n)':h=-2:eval=frame,crop=${W}:${H},trim=end_frame=${frames},setpts=PTS-STARTPTS`,
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', o]);
  return o;
});
const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, segs.map(p => `file '${p}'`).join('\n'));
const base = path.join(tmp, 'base.mp4');
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', base]);

// ── 2. ตัวหนังสือพื้นใส ───────────────────────────────────────────────────
const CSS = `* { margin:0; box-sizing:border-box; }
html,body { width:${W}px; height:${H}px; overflow:hidden; background:transparent; font-family:'Sukhumvit Set','Thonburi','Apple Color Emoji',sans-serif; color:#fff; text-align:center; }
.grad { position:absolute; left:0; right:0; bottom:0; height:1100px; background:linear-gradient(to bottom, rgba(10,6,22,0), rgba(10,6,22,.78) 45%, rgba(10,6,22,.92)); }
.bar { position:absolute; top:110px; left:80px; right:80px; height:10px; border-radius:6px; background:rgba(255,255,255,.22); overflow:hidden; }
.bar i { position:absolute; inset:0; background:linear-gradient(90deg,#E9C98A,#FFF3D6); transform-origin:left; }
.brand { position:absolute; top:150px; left:50%; transform:translateX(-50%); padding:10px 30px; border-radius:40px; font-size:34px; background:rgba(15,11,28,.55); color:#EDE6FF; }
.scene { position:absolute; left:70px; right:130px; top:820px; bottom:380px; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0; }
.badge { font-size:46px; font-weight:800; color:#2A1F48; background:#F0D49A; padding:12px 34px; border-radius:16px; transform:rotate(-4deg); margin-bottom:30px; box-shadow:0 8px 24px rgba(0,0,0,.5); }
.emoji { font-size:150px; line-height:1; font-family:'Apple Color Emoji'; margin-bottom:10px; filter:drop-shadow(0 6px 18px rgba(0,0,0,.6)); }
.title { font-size:122px; font-weight:800; line-height:1.12; background:linear-gradient(180deg,#FFF3D6,#E9C98A 55%,#B8893E); -webkit-background-clip:text; color:transparent; filter:drop-shadow(0 4px 14px #000); }
.sub { font-size:40px; color:#E6DEFA; margin:8px 0 14px; text-shadow:0 2px 8px #000; }
.w { display:inline-block; font-size:62px; font-weight:800; color:#fff; margin:6px 10px; text-shadow:0 3px 12px #000; }
.flash { position:absolute; inset:0; background:#FFF6DC; opacity:0; }
.foot { position:absolute; bottom:300px; width:100%; font-size:42px; color:#E9C98A; text-shadow:0 2px 8px #000; }`;
const html = `<style>${CSS}</style><div class="grad"></div><div class="bar"><i id="bar"></i></div><div class="brand">อาจารย์ปรินนี่ · Prinnie333</div>
${scenes.map((s, i) => `<div class="scene" id="s${i}">${s.badge ? `<div class="badge">${esc(s.badge)}</div>` : ''}${s.emoji ? `<div class="emoji">${s.emoji}</div>` : ''}
  ${s.title ? `<div class="title">${esc(s.title)}</div>` : ''}${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}<div>${(s.words || []).map(w => `<span class="w">${esc(w)}</span>`).join('')}</div></div>`).join('')}
<div class="foot">LINE @prinnie333</div><div class="flash" id="flash"></div>
<script>
const TOTAL=${TOTAL}; const scenes=${JSON.stringify(scenes.map(s => ({ start: s.start, dur: s.dur })))};
const A=(el,kf,o)=>el.animate(kf,{fill:'both',easing:'ease-out',...o});
A(document.getElementById('bar'),[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:TOTAL,easing:'linear'});
scenes.forEach((s,i)=>{
  const el=document.getElementById('s'+i);
  A(el,[{opacity:0},{opacity:1,offset:.06},{opacity:1,offset:.92},{opacity:0}],{duration:s.dur,delay:s.start,easing:'linear'});
  if(i>0) A(document.getElementById('flash'),[{opacity:0},{opacity:.7,offset:.2},{opacity:0}],{duration:260,delay:s.start});
  const em=el.querySelector('.emoji'); if(em) A(em,[{transform:'scale(0) rotate(-90deg)'},{transform:'scale(1.25) rotate(10deg)',offset:.6},{transform:'none'}],{duration:480,delay:s.start+60,easing:'cubic-bezier(.2,1.4,.4,1)'});
  const t=el.querySelector('.title'); if(t) A(t,[{transform:'translateY(80px)',opacity:0},{transform:'none',opacity:1}],{duration:360,delay:s.start+220});
  const sb=el.querySelector('.sub'); if(sb) A(sb,[{opacity:0},{opacity:1}],{duration:300,delay:s.start+420});
  el.querySelectorAll('.w').forEach((w,j)=>A(w,[{transform:'scale(0)',opacity:0},{transform:'scale(1.2)',opacity:1,offset:.6},{transform:'scale(1)',opacity:1}],{duration:320,delay:s.start+(t?700:250)+j*300,easing:'cubic-bezier(.2,1.4,.4,1)'}));
  const b=el.querySelector('.badge'); if(b) A(b,[{transform:'rotate(-4deg)'},{transform:'rotate(4deg) scale(1.08)'},{transform:'rotate(-4deg)'}],{duration:600,delay:s.start,iterations:Math.floor(s.dur/600),easing:'ease-in-out'});
});
document.getAnimations().forEach(a=>a.pause());
window.seek=(ms)=>document.getAnimations().forEach(a=>{a.currentTime=ms;});
</script>`;
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: W, height: H } });
await pg.setContent(html); await pg.waitForTimeout(600);
const n = Math.round(TOTAL / 1000 * FPS);
for (let f = 0; f < n; f++) {
  await pg.evaluate(ms => window.seek(ms), f * 1000 / FPS);
  await pg.screenshot({ path: path.join(tmp, `o${String(f).padStart(5, '0')}.png`), omitBackground: true });
}
await b.close();

// ── 3. เสียง + รวม ────────────────────────────────────────────────────────
const sfx = [];
scenes.forEach((s, i) => {
  if (i > 0) sfx.push(['0.6*sin(2*PI*(220+1000*t)*t)*exp(-7*t)', 0.32, s.start, 0.5]);
  if (s.emoji) sfx.push(['0.6*sin(2*PI*700*t)*exp(-9*t)', 0.3, s.start + 300, 0.45]);
});
const ain = [], fl = [];
sfx.forEach(([e, d, at, v], i) => { ain.push('-f', 'lavfi', '-t', String(d), '-i', `aevalsrc='${e}':s=44100`);
  fl.push(`[${i + 2}:a]adelay=${at}|${at},volume=${v}[a${i}]`); });
const music = spec.music && fs.existsSync(spec.music);
if (music) fl.push(`[${sfx.length + 2}:a]volume=0.35,afade=t=out:st=${(TOTAL / 1000 - 1.5).toFixed(2)}:d=1.5[m]`);
fl.push(`${sfx.map((_, i) => `[a${i}]`).join('')}${music ? '[m]' : ''}amix=inputs=${sfx.length + (music ? 1 : 0)}:normalize=0,atrim=0:${(TOTAL / 1000).toFixed(2)}[aout]`);
fl.push(`[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[vout]`);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
run(['-i', base, '-framerate', String(FPS), '-i', path.join(tmp, 'o%05d.png'), ...ain, ...(music ? ['-i', spec.music] : []),
  '-filter_complex', fl.join(';'), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  '-c:a', 'aac', '-b:a', '160k', '-shortest', path.resolve(out)]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('บันทึก', out, `(${(TOTAL / 1000).toFixed(1)} วิ)`);
