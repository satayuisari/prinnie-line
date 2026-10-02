// รูปโพสต์หน้าเพจ 1080×1080 ให้แม่ลง — ภาพวาดพื้นหลัง + ตัวหนังสือทอง (สไตล์เดียวกับชุดรายสัปดาห์)
//
//   node scripts/build-mom-post.mjs <spec.json> <out.png>
//
// spec: { "bg": "marketing/partner-kit/src/moon.jpg", "kicker": "...", "title": "...",
//         "lines": [["ข้อความ", true=ตัวใหญ่], ...], "foot": "..." }
//
// ย้ายจาก scratchpad มาไว้ในโปรเจกต์ 2 ต.ค. 69 (ไฟล์ชั่วคราวหาย) — ตัวไทยต้องเรนเดอร์ผ่านเบราว์เซอร์
// ⚠️ ห้ามใส่ letter-spacing กับข้อความไทย — วรรณยุกต์จะเคลื่อนออกจากตัวอักษร
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/bon/astral-realm/node_modules/playwright');
import fs from 'node:fs';
import path from 'node:path';

const [specFile, out] = process.argv.slice(2);
if (!specFile || !out) { console.error('ใช้: node scripts/build-mom-post.mjs <spec.json> <out.png>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const bg = 'data:image/jpeg;base64,' + fs.readFileSync(path.resolve(spec.bg)).toString('base64');

const CSS = `* { margin:0; box-sizing:border-box; }
body { width:1080px; height:1080px; position:relative; overflow:hidden; text-align:center; color:#F4F1FB;
  font-family:'Sukhumvit Set','Thonburi',sans-serif;
  background: radial-gradient(ellipse at 50% 30%, #2A1F48 0%, #171226 60%, #0F0B1C 100%); }
.stars i { position:absolute; border-radius:50%; background:#EBE6FF; }
.frame { position:absolute; inset:22px; border:1.5px solid rgba(212,175,110,.55); border-radius:6px; z-index:5; }
.frame::after { content:''; position:absolute; inset:8px; border:1px solid rgba(212,175,110,.25); border-radius:3px; }
.band { position:absolute; left:0; top:0; width:1080px; height:600px; object-fit:cover; -webkit-mask-image:linear-gradient(to bottom,#000 50%,transparent 100%); }
.shade { position:absolute; left:0; top:0; width:1080px; height:600px; background:linear-gradient(to bottom, rgba(15,11,28,.25) 0%, rgba(15,11,28,0) 22%, rgba(15,11,28,.45) 50%, rgba(15,11,28,.9) 80%, #120D22 100%); }
.brand { position:absolute; top:48px; left:50%; transform:translateX(-50%); padding:8px 26px; border-radius:30px; font-size:26px; color:#EDE6FF; background:rgba(15,11,28,.6); z-index:4; }
.wrap { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; z-index:3; padding:340px 70px 0; }
.kicker { font-size:30px; color:#F0D49A; text-shadow:0 2px 6px #000, 0 0 18px rgba(0,0,0,.9); }
.title { font-size:80px; font-weight:800; line-height:1.15; margin-top:4px;
  background:linear-gradient(180deg,#FFF3D6 0%,#E9C98A 55%,#B8893E 100%); -webkit-background-clip:text; color:transparent;
  filter:drop-shadow(0 3px 10px rgba(0,0,0,.85)); }
.orn { display:flex; align-items:center; gap:14px; margin:14px 0 4px; color:#D4AF6E; font-size:18px; }
.orn b { width:120px; height:1.5px; background:linear-gradient(90deg,transparent,#D4AF6E); } .orn b:last-child { background:linear-gradient(90deg,#D4AF6E,transparent); }
.line { font-size:31px; color:#D9D1F0; margin-top:16px; }
.line.big { font-size:42px; font-weight:700; color:#FFFFFF; }
.line em { font-style:normal; color:#E9C98A; font-weight:700; }
.foot { position:absolute; bottom:92px; width:100%; font-size:26px; color:#F4F1FB; padding:0 90px; z-index:4; }
.lineid { position:absolute; bottom:50px; width:100%; font-size:22px; letter-spacing:.55em; color:#D4AF6E; z-index:4; }`;

let s = 9; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
const stars = '<div class="stars">' + Array.from({ length: 140 }, () => { const z = [1,1,1,2,2,3][Math.floor(r()*6)];
  return `<i style="left:${r()*1080}px;top:${r()*1080}px;width:${z}px;height:${z}px;opacity:${0.2+r()*0.6}"></i>`; }).join('') + '</div>';
// [[ข้อความ, ใหญ่]] · ใส่ {{คำ}} เพื่อเน้นสีทอง
const line = ([t, big]) => `<div class="line${big ? ' big' : ''}">${esc(t).replace(/\{\{(.+?)\}\}/g, '<em>$1</em>')}</div>`;

const html = `<style>${CSS}</style>${stars}<img class="band" src="${bg}"><div class="shade"></div>
  <div class="brand">อาจารย์ปรินนี่</div>
  <div class="wrap"><div class="kicker">${esc(spec.kicker)}</div><div class="title">${esc(spec.title)}</div>
  <div class="orn"><b></b>✦<b></b></div>${spec.lines.map(line).join('')}</div>
  <div class="foot">${esc(spec.foot)}</div><div class="lineid">LINE @PRINNIE333</div><div class="frame"></div>`;

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1080, height: 1080 } });
await pg.setContent(html); await pg.waitForTimeout(500);
fs.mkdirSync(path.dirname(out), { recursive: true });
await pg.screenshot({ path: out }); await b.close();
console.log('บันทึก', out);
