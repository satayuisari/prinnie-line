// generate รูปไอคอน rich menu ด้วย fal.ai Flux → richmenu/icons/*.png
//   node scripts/gen-icons.js            (gen ทั้งหมด)
//   node scripts/gen-icons.js tarot      (gen เฉพาะอันเดียว)
// อ่าน FAL_KEY จาก .env
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const KEY = process.env.FAL_KEY;
if (!KEY) { console.error('ไม่มี FAL_KEY ใน .env'); process.exit(1); }

const STYLE = 'polished gold gradient with soft inner glow, minimalist symmetrical emblem, flat deep royal-purple background, subtle sparkle dust, premium mystical astrology brand, clean 3D vector style, soft studio lighting, centered, lots of negative space';

const ICONS = {
  daily:   'a single elegant golden crescent moon with one bright star nestled in its cradle',
  natal:   'a radiant golden sun emblem with refined triangular rays and a thin outer ring, faint zodiac wheel detail',
  tarot:   'three elegant golden tarot cards fanned out, ornate borders, a glowing star symbol on the center card',
  couple:  'two interlocked golden hearts connected by a delicate thread of tiny stars, soft pink-gold glow',
  signup:  'a single faceted golden gemstone diamond with luminous facets and a soft star glint',
  profile: 'a simple elegant golden person silhouette inside a soft glowing circle, faint constellation dots',
};

const OUT = path.join(__dirname, '..', 'richmenu', 'icons');
fs.mkdirSync(OUT, { recursive: true });

async function gen(name) {
  const prompt = `luxury app icon, ${ICONS[name]}, ${STYLE}`;
  const r = await fetch('https://fal.run/fal-ai/flux/dev', {
    method: 'POST',
    headers: { 'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: { width: 1024, height: 1024 }, num_images: 1, num_inference_steps: 28, guidance_scale: 3.5 }),
  });
  const j = await r.json();
  if (!j.images || !j.images[0]) { console.log(`✗ ${name}: HTTP ${r.status} ${JSON.stringify(j).slice(0,200)}`); return; }
  const buf = Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer());
  fs.writeFileSync(path.join(OUT, `icon-${name}.png`), buf);
  console.log(`✓ icon-${name}.png  ${(buf.length/1024).toFixed(0)} KB`);
}

(async () => {
  const only = process.argv[2];
  const names = only ? [only] : Object.keys(ICONS);
  for (const n of names) { if (!ICONS[n]) { console.log('unknown icon:', n); continue; } await gen(n); }
  console.log('done.');
})().catch(e => { console.error(e.message); process.exit(1); });
