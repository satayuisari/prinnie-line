// generate รูปด้วย fal.ai (Flux) → เซฟไฟล์
//   node scripts/fal-gen.js "<prompt>" <FAL_KEY> <out.png> [width] [height]
const fs = require('fs');

const prompt = process.argv[2];
const KEY    = process.argv[3];
const out    = process.argv[4] || 'richmenu/bg.png';
const width  = Number(process.argv[5] || 1344);
const height = Number(process.argv[6] || 896);

(async () => {
  console.log('generating...');
  const resp = await fetch('https://fal.run/fal-ai/flux/dev', {
    method: 'POST',
    headers: { 'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: { width, height },
      num_images: 1,
      num_inference_steps: 30,
      guidance_scale: 3.5,
    }),
  });
  const j = await resp.json();
  if (!j.images || !j.images[0]) {
    console.log('ERROR:', JSON.stringify(j).slice(0, 500));
    process.exit(1);
  }
  const img = await fetch(j.images[0].url);
  const buf = Buffer.from(await img.arrayBuffer());
  fs.writeFileSync(out, buf);
  console.log(`saved ${out}  ${(buf.length / 1024).toFixed(1)} KB  ${width}x${height}`);
})().catch(e => { console.error(e.message); process.exit(1); });
