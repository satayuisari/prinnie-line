// generate hero key-visuals สำหรับ 3 คอนเซ็ปต์การตลาด ด้วย fal.ai Flux → marketing/art/*.png
//   node scripts/gen-marketing-art.js                  (ทุกคอนเซ็ปต์ ฟอร์แมต feed 4:5)
//   node scripts/gen-marketing-art.js personal          (เฉพาะ personal, feed)
//   node scripts/gen-marketing-art.js story             (ทุกคอนเซ็ปต์, 9:16)
//   node scripts/gen-marketing-art.js couple story      (couple, 9:16)
// อ่าน FAL_KEY จาก .env (ไม่ต้องแปะ key)
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const KEY = process.env.FAL_KEY;
if (!KEY) { console.error('❌ ไม่มี FAL_KEY ใน .env'); process.exit(1); }

const OUT = path.join(__dirname, '..', 'marketing', 'art');
fs.mkdirSync(OUT, { recursive: true });

const FORMATS = {
  feed:   { w: 896,  h: 1216, suffix: '' },        // 4:5 — IG/FB feed + LINE
  story:  { w: 832,  h: 1472, suffix: '-9x16' },   // 9:16 — Shorts/Stories/VOOM
  square: { w: 1080, h: 1080, suffix: '-1x1' },    // 1:1 — IG square + LINE rich message
  wide:   { w: 1200, h: 628,  suffix: '-wide' },   // ~1.91:1 — LINE broadcast / FB link / web OG
};

// ภาพคีย์วิช่วล: ไม่มีตัวหนังสือ (Flux เขียนไทยไม่ได้) — ข้อความไทยค่อย composite ทับทีหลัง
const NEG = 'absolutely no text, no letters, no numbers, no inscriptions, no writing, no gibberish glyphs, no watermark, no logo, no words';
const CONCEPTS = {
  // A — "ดวงที่เป็นของคุณคนเดียว" : personalization-as-magic (วงจักรราศีสะอาด ไม่มีตัวหนังสือ)
  personal: {
    num: 1,
    prompt: `A breathtaking premium mystical poster, vertical composition. Silhouette of a serene young Thai woman seen from behind, gazing up at a vast cosmic night sky. Above and around her glows a clean ornamental astrological wheel made of smooth concentric golden rings, delicate radiating constellation lines, small glowing celestial star and planet symbols and elegant sacred geometry — purely decorative ornament with smooth blank polished gold bands, no writing of any kind. Deep royal-purple and indigo nebula background with sparkling stardust, soft volumetric god rays. Ethereal, elegant, high-end astrology brand aesthetic, cinematic lighting, ultra detailed, dreamy, luxurious gold-and-purple palette. ${NEG}`,
  },
  // B — "ทักทุกเช้า" : daily morning ritual / warmth
  daily: {
    num: 1,
    prompt: `A warm dreamy vertical poster of a peaceful mystical morning. A delicate golden crescent moon and a soft rising sun glow together over a calm misty horizon, sacred and serene. In the foreground a softly glowing smartphone rests on a cozy bedside emitting gentle golden light like a blessing. Floating golden stars, sparkling stardust, soft clouds tinted lavender and rose-gold. Tranquil comforting premium spiritual astrology brand, deep purple to rose-gold gradient sky, soft morning light, elegant, ultra detailed, magical reassuring atmosphere. ${NEG}`,
  },
  // C — "ผูกดวงคู่" : couple / synastry / viral & romantic (ชาย-หญิงชัดเจน)
  couple: {
    num: 1,
    prompt: `A romantic celestial vertical poster of a young couple in profile facing each other, foreheads almost touching. On the LEFT a handsome young man, clearly masculine — strong defined jawline, short cropped dark hair, broad shoulders, masculine face. On the RIGHT a beautiful young woman, clearly feminine — soft delicate features, long flowing wavy hair, graceful neck. Their skin and hair shimmer with glowing golden constellation stars and delicate star-map lines. Between them a luminous vertical golden thread of stardust connects their hearts, with a soft glowing light cupped in their hands below. Deep royal-purple cosmos, sparkling stardust, ethereal romantic glow, magical love-and-destiny theme, premium mystical astrology brand, royal purple and gold with a touch of rose-pink, cinematic soft rim lighting, ultra detailed, dreamy. ${NEG}`,
  },
};

async function gen(name, c, fmt) {
  const num = c.num || 1;
  console.log(`▶ ${name} [${fmt.w}x${fmt.h}] generating ${num} image(s)...`);
  const resp = await fetch('https://fal.run/fal-ai/flux/dev', {
    method: 'POST',
    headers: { 'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: c.prompt,
      image_size: { width: fmt.w, height: fmt.h },
      num_images: num,
      num_inference_steps: 40,
      guidance_scale: 3.5,
    }),
  });
  const j = await resp.json();
  if (!j.images || !j.images[0]) { console.log(`  ✗ ${name} ERROR:`, JSON.stringify(j).slice(0, 300)); return; }
  for (let i = 0; i < j.images.length; i++) {
    const img = await fetch(j.images[i].url);
    const buf = Buffer.from(await img.arrayBuffer());
    const v = j.images.length > 1 ? `-v${i + 1}` : '';
    const file = path.join(OUT, `concept-${name}${fmt.suffix}${v}.png`);
    fs.writeFileSync(file, buf);
    console.log(`  ✅ ${file}  ${(buf.length / 1024).toFixed(1)} KB`);
  }
}

(async () => {
  // parse args: format keyword (feed|story) แยกจากชื่อคอนเซ็ปต์
  const argv = process.argv.slice(2);
  const fmtKey = argv.find(a => FORMATS[a]) || 'feed';
  const name = argv.find(a => CONCEPTS[a]);
  const fmt = FORMATS[fmtKey];
  const names = name ? [name] : Object.keys(CONCEPTS);
  console.log(`format = ${fmtKey} (${fmt.w}x${fmt.h})`);
  for (const n of names) await gen(n, CONCEPTS[n], fmt);
})().catch(e => { console.error(e.message); process.exit(1); });
