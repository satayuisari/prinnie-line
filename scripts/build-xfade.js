// ต่อการ์ด PNG เป็นวิดีโอด้วย crossfade (xfade) — นุ่มนวลกว่า fade-to-black
// ใช้: node scripts/build-xfade.js <dir> <prefix> <secPerCard> <out.mp4>
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [dir, prefix, durS, out] = process.argv.slice(2);
const D = parseFloat(durS), T = 0.6, FPS = 30;
const FF = path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg');

const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix + '-') && f.endsWith('.png')).sort();
const args = [];
files.forEach(f => args.push('-loop', '1', '-t', String(D), '-i', path.join(dir, f)));

let fc = '';
files.forEach((f, i) => { fc += `[${i}:v]fps=${FPS},scale=1080:1920,setsar=1,format=yuv420p[v${i}];`; });
let prev = 'v0';
for (let i = 1; i < files.length; i++) {
  const off = (i * (D - T)).toFixed(3);
  const outl = (i === files.length - 1) ? 'vout' : `x${i}`;
  fc += `[${prev}][v${i}]xfade=transition=fade:duration=${T}:offset=${off}[${outl}];`;
  prev = outl;
}
fc = fc.replace(/;$/, '');

args.push('-filter_complex', fc, '-map', '[vout]', '-r', String(FPS),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-y', out);
execFileSync(FF, args, { stdio: 'ignore' });
const total = (files.length * D - (files.length - 1) * T).toFixed(1);
console.log(`  ✓ ${out}  (${files.length} cards · ${D}s each · ~${total}s)`);
