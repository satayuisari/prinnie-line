// คลิป TikTok แบบมีจังหวะ (v2) — ตัวหนังสือเด้งทีละคำ · แฟลช+สั่นตอนอันดับ 1 · สติกเกอร์ · แถบความคืบหน้า · เสียงเอฟเฟกต์
//
//   node scripts/build-tiktok-v2.mjs <spec.json> <out.mp4>
//
// spec: { "bg": "...jpg", "music": "marketing/ambient.m4a",
//   "scenes": [ { "type":"hook", "badge":"ดูให้จบ", "words":["ราศีไหน","ขี้หึง","ที่สุด"], "sec":2.8 },
//               { "type":"rank", "rank":3, "title":"ราศีพฤษภ", "sub":"เกิด ...", "words":["หึงช้า","แต่หึงนาน"], "emoji":"😤", "sec":3.5 },
//               { "type":"cta", "words":["แฟนคุณ","ราศีอะไร"], "line":"คอมเมนต์เลย 👇", "sec":3.2 } ] }
//
// วิธีทำ: หน้า HTML เดียว ทุกการเคลื่อนไหวเป็น Web Animations ตามเส้นเวลา แล้วหยุดเวลาทีละเฟรม
// (document.getAnimations → currentTime) ถ่ายภาพ 30 เฟรม/วิ ต่อเป็นวิดีโอด้วย ffmpeg — ได้ภาพนิ่งเป๊ะทุกเฟรม
// เสียงเอฟเฟกต์สังเคราะห์ด้วย ffmpeg ไม่ต้องใช้ไฟล์เสียงที่มีลิขสิทธิ์ · เพลงฮิตให้แม่ใส่ในแอป TikTok เอง
// ⚠️ ห้ามใส่ letter-spacing กับข้อความไทย
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/bon/astral-realm/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const [specFile, out] = process.argv.slice(2);
if (!specFile || !out) { console.error('ใช้: node scripts/build-tiktok-v2.mjs <spec.json> <out.mp4>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const FF = path.resolve('node_modules/ffmpeg-static/ffmpeg');
const W = 1080, H = 1920, FPS = 30;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const bg = 'data:image/jpeg;base64,' + fs.readFileSync(path.resolve(spec.bg)).toString('base64');

// เส้นเวลา: เริ่มของแต่ละฉาก (มิลลิวินาที)
let t = 0;
const scenes = spec.scenes.map(s => { const r = { ...s, start: t, dur: (s.sec || 3) * 1000 }; t += r.dur; return r; });
const TOTAL = t;

const CSS = `* { margin:0; box-sizing:border-box; }
body { width:${W}px; height:${H}px; overflow:hidden; background:#120D22; font-family:'Sukhumvit Set','Thonburi','Apple Color Emoji',sans-serif; color:#fff; text-align:center; }
#stage { position:absolute; inset:0; }
.bg { position:absolute; inset:-40px; width:calc(100% + 80px); height:calc(100% + 80px); object-fit:cover; }
.shade { position:absolute; inset:0; background:linear-gradient(to bottom, rgba(15,11,28,.5), rgba(15,11,28,.2) 28%, rgba(15,11,28,.78) 55%, rgba(15,11,28,.96)); }
.spark { position:absolute; width:8px; height:8px; border-radius:50%; background:#FFE9B0; box-shadow:0 0 12px 4px rgba(255,220,150,.7); }
.brand { position:absolute; top:150px; left:50%; transform:translateX(-50%); padding:10px 30px; border-radius:40px; font-size:34px; background:rgba(15,11,28,.6); color:#EDE6FF; z-index:5; }
.bar { position:absolute; top:110px; left:80px; right:80px; height:10px; border-radius:6px; background:rgba(255,255,255,.18); z-index:5; overflow:hidden; }
.bar i { position:absolute; inset:0; background:linear-gradient(90deg,#E9C98A,#FFF3D6); transform-origin:left; }
.scene { position:absolute; left:70px; right:130px; top:420px; bottom:430px; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0; }
.w { display:inline-block; font-size:128px; font-weight:800; line-height:1.15; margin:0 10px;
  background:linear-gradient(180deg,#FFF3D6 0%,#E9C98A 55%,#B8893E 100%); -webkit-background-clip:text; color:transparent; filter:drop-shadow(0 5px 14px rgba(0,0,0,.9)); }
.w.white { background:none; color:#fff; font-size:64px; font-weight:800; -webkit-background-clip:initial; }
.badge { font-size:46px; font-weight:800; color:#2A1F48; background:#F0D49A; padding:12px 34px; border-radius:16px; transform:rotate(-4deg); margin-bottom:34px; box-shadow:0 8px 24px rgba(0,0,0,.5); }
.rank { width:190px; height:190px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:124px; font-weight:800; color:#2A1F48;
  background:radial-gradient(circle at 35% 30%, #FFF1CF, #E2BD78 55%, #A87A33); box-shadow:0 0 0 8px rgba(212,175,110,.35), 0 12px 40px rgba(0,0,0,.6); margin-bottom:24px; }
.title { font-size:120px; font-weight:800; background:linear-gradient(180deg,#FFF3D6,#E9C98A 55%,#B8893E); -webkit-background-clip:text; color:transparent; filter:drop-shadow(0 4px 14px #000); }
.sub { font-size:40px; color:#D9D1F0; margin:8px 0 18px; text-shadow:0 2px 8px #000; }
.emoji { position:absolute; left:210px; top:10px; font-size:120px; font-family:'Apple Color Emoji'; line-height:1; }
.flash { position:absolute; inset:0; background:#FFF6DC; opacity:0; z-index:8; }
.foot { position:absolute; bottom:300px; width:100%; font-size:42px; color:#E9C98A; z-index:5; }`;

const sparks = Array.from({ length: 26 }, (_, i) => `<div class="spark" id="sp${i}" style="left:${(i * 397) % W}px;top:${(i * 733) % H}px"></div>`).join('');
const words = (arr, cls = '') => arr.map(w => `<span class="w ${cls}">${esc(w)}</span>`).join('');
const sceneHtml = scenes.map((s, i) => {
  if (s.type === 'hook') return `<div class="scene" id="s${i}">${s.badge ? `<div class="badge">${esc(s.badge)}</div>` : ''}<div>${words(s.words)}</div></div>`;
  if (s.type === 'rank') return `<div class="scene" id="s${i}"><div style="position:relative"><div class="rank">${s.rank}</div>${s.emoji ? `<div class="emoji">${s.emoji}</div>` : ''}</div>
    <div class="title">${esc(s.title)}</div><div class="sub">${esc(s.sub || '')}</div><div>${words(s.words, 'white')}</div></div>`;
  return `<div class="scene" id="s${i}"><div>${words(s.words)}</div><div class="w white" style="margin-top:30px">${esc(s.line || '')}</div></div>`;
}).join('');

const html = `<style>${CSS}</style><div id="stage"><img class="bg" id="bg" src="${bg}"><div class="shade"></div>${sparks}
  <div class="bar"><i id="bar"></i></div><div class="brand">อาจารย์ปรินนี่ · Prinnie333</div>${sceneHtml}
  <div class="foot">LINE @prinnie333</div><div class="flash" id="flash"></div></div>
<script>
const TOTAL=${TOTAL}; const scenes=${JSON.stringify(scenes.map(s => ({ type: s.type, start: s.start, dur: s.dur, rank: s.rank })))};
const A=(el,kf,o)=>el.animate(kf,{fill:'both',easing:'ease-out',...o});
A(document.getElementById('bg'),[{transform:'scale(1)'},{transform:'scale(1.12)'}],{duration:TOTAL,easing:'linear'});
A(document.getElementById('bar'),[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:TOTAL,easing:'linear'});
document.querySelectorAll('.spark').forEach((e,i)=>A(e,[{transform:'translateY(0)',opacity:0},{opacity:.9,offset:.3},{transform:'translateY(-420px)',opacity:0}],{duration:3000+i*137,iterations:Infinity,delay:-i*400,easing:'linear'}));
scenes.forEach((s,i)=>{
  const el=document.getElementById('s'+i);
  A(el,[{opacity:0,transform:'translateY(60px)'},{opacity:1,transform:'none',offset:.08},{opacity:1,offset:.9},{opacity:0,transform:'translateY(-40px)'}],{duration:s.dur,delay:s.start,easing:'linear'});
  // คำเด้งทีละคำ
  el.querySelectorAll('.w').forEach((w,j)=>A(w,[{transform:'scale(0)',opacity:0},{transform:'scale(1.18)',opacity:1,offset:.6},{transform:'scale(1)',opacity:1}],{duration:320,delay:s.start+(s.type==='rank'?900:250)+j*260,easing:'cubic-bezier(.2,1.4,.4,1)'}));
  const r=el.querySelector('.rank'); if(r) A(r,[{transform:'translateY(-500px) rotate(-30deg)'},{transform:'translateY(20px) rotate(4deg)',offset:.7},{transform:'none'}],{duration:520,delay:s.start+80,easing:'ease-in'});
  const t=el.querySelector('.title'); if(t) A(t,[{transform:'translateX(-120%)',opacity:0},{transform:'none',opacity:1}],{duration:380,delay:s.start+450});
  const em=el.querySelector('.emoji'); if(em) A(em,[{transform:'scale(0) rotate(-40deg)'},{transform:'scale(1.3) rotate(10deg)',offset:.6},{transform:'scale(1) rotate(0)'}],{duration:420,delay:s.start+700,easing:'cubic-bezier(.2,1.4,.4,1)'});
  const b=el.querySelector('.badge'); if(b) A(b,[{transform:'rotate(-4deg) scale(1)'},{transform:'rotate(4deg) scale(1.08)'},{transform:'rotate(-4deg) scale(1)'}],{duration:600,delay:s.start,iterations:Math.floor(s.dur/600),easing:'ease-in-out'});
  if(s.rank===1){
    A(document.getElementById('flash'),[{opacity:0},{opacity:.85,offset:.15},{opacity:0}],{duration:450,delay:s.start+60});
    A(document.getElementById('stage'),[{transform:'none'},{transform:'translate(14px,-10px)'},{transform:'translate(-12px,8px)'},{transform:'translate(8px,6px)'},{transform:'none'}],{duration:380,delay:s.start+120,easing:'linear'});
    if(r) A(r,[{boxShadow:'0 0 0 8px rgba(212,175,110,.35)'},{boxShadow:'0 0 60px 30px rgba(255,220,150,.75)'},{boxShadow:'0 0 0 8px rgba(212,175,110,.35)'}],{duration:900,delay:s.start+600,iterations:3});
  }
});
document.getAnimations().forEach(a=>a.pause());
window.seek=(ms)=>document.getAnimations().forEach(a=>{a.currentTime=ms;});
</script>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tt2-'));
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: W, height: H } });
await pg.setContent(html); await pg.waitForTimeout(600);
const n = Math.round(TOTAL / 1000 * FPS);
for (let f = 0; f < n; f++) {
  await pg.evaluate(ms => window.seek(ms), f * 1000 / FPS);
  await pg.screenshot({ path: path.join(tmp, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
}
await b.close();

// เสียงเอฟเฟกต์สังเคราะห์: วูชตอนเปลี่ยนฉาก · ป๊อปตอนคำเด้ง · ติ๊งตอนอันดับ 1
const sfx = [];
const add = (expr, dur, at, vol) => sfx.push({ expr, dur, at, vol });
for (const s of scenes) {
  add('0.6*sin(2*PI*(200+900*t)*t)*exp(-6*t)', 0.35, s.start, 0.5);                     // วูช
  if (s.rank === 1) add('0.7*sin(2*PI*1320*t)*exp(-3*t)+0.4*sin(2*PI*1980*t)*exp(-4*t)', 1.2, s.start + 100, 0.6); // ติ๊ง
  else if (s.type === 'rank') add('0.6*sin(2*PI*660*t)*exp(-9*t)', 0.3, s.start + 520, 0.45); // ป๊อปตอนเลขลง
}
const audioIn = [], filters = [];
sfx.forEach((x, i) => {
  audioIn.push('-f', 'lavfi', '-t', String(x.dur), '-i', `aevalsrc='${x.expr}':s=44100`);
  filters.push(`[${i + 1}:a]adelay=${Math.round(x.at)}|${Math.round(x.at)},volume=${x.vol}[a${i}]`);
});
const music = spec.music && fs.existsSync(spec.music);
const mixIn = sfx.map((_, i) => `[a${i}]`).join('') + (music ? `[m]` : '');
if (music) filters.push(`[${sfx.length + 1}:a]volume=0.35,afade=t=out:st=${(TOTAL / 1000 - 1.5).toFixed(2)}:d=1.5[m]`);
filters.push(`${mixIn}amix=inputs=${sfx.length + (music ? 1 : 0)}:normalize=0,atrim=0:${(TOTAL / 1000).toFixed(2)}[aout]`);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', path.join(tmp, 'f%05d.jpg'), ...audioIn, ...(music ? ['-i', spec.music] : []),
  '-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', path.resolve(out)], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log('บันทึก', out, `(${(TOTAL / 1000).toFixed(1)} วิ)`);
