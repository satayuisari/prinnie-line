// สร้างภาพไพ่ทาโรต์ทั้งสำรับด้วย Flux แล้วประกอบเข้ากรอบทองของแบรนด์
//
//   node scripts/build-tarot-art.js                สร้างที่ยังไม่มี (รันซ้ำได้ ข้ามของเดิม)
//   node scripts/build-tarot-art.js --only 5       ทำแค่ 5 ใบแรกที่ยังไม่มี (ไว้ลอง)
//   node scripts/build-tarot-art.js --deck love    เฉพาะสำรับเดียว
//
// 🔴 ที่มา (28 ส.ค. 69): รูปไพ่ต้นฉบับ 123 ใบอยู่บน data.prinnie333.com เครื่องเดียว
// เครื่องดับ ไม่มีสำเนาที่ไหนเลย → วาดใหม่ไว้ใช้ก่อน ได้ของเดิมคืนค่อยทับด้วย
// scripts/fetch-tarot-images.js
//
// ชื่อไพ่/คำอธิบายอ่านจากไฟล์แบ็คอัพในเครื่อง ไม่ต้องพึ่ง DB ที่ล่ม
//
// ⚠️ Flux ชอบเขียนตัวหนังสือลงภาพเองและสะกดผิด ("THE FOIOL") กับใส่กรอบมาเอง
// จึงต้องครอปทิ้งแล้วใส่ชื่อของเราเองเสมอ — ห้ามเชื่อตัวหนังสือที่ AI เขียน

const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, '..', 'assets', 'tarot-cards');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.homedir(), 'prinnie-backups');
const KEY = process.env.FAL_KEY || (fs.existsSync(path.join(__dirname, '..', '.env'))
  ? (fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/^FAL_KEY=(.*)$/m) || [])[1] : '');

const W = 760, H = 1300, M = 34;
const IX = M + 22, IY = M + 22, IW = W - (M + 22) * 2, IH = 820;
const FONT = "'Tahoma','Noto Sans Thai',sans-serif";
const DECK_TH = { paid: 'สำรับหลัก', love: 'สำรับความรัก', free: 'สำรับเปิดฟรี' };

const STYLE = 'Art nouveau tarot illustration, ornate linework, deep violet and midnight purple '
  + 'palette with antique gold accents, starry night sky, mystical painterly atmosphere, '
  + 'single centered subject, full bleed scene, no border, no frame, no text, no lettering, no words';

// ฉากของไพ่ชุดใหญ่ตามตำรา — ใช้กับสำรับหลักและสำรับเปิดฟรี ให้ตรงความหมายจริง
const ARCANA = {
  'the fool': 'a young traveler in flowing robes stepping toward a cliff edge at dawn, small white dog at heel, white rose in hand',
  'the magician': 'a robed magician at an altar bearing cup, sword, coin and wand, one hand raised to the sky, infinity symbol overhead, roses and lilies at his feet',
  'the high priestess': 'a veiled priestess seated between two pillars, crescent moon at her feet, scroll in her lap, pomegranate curtain behind',
  'the empress': 'a crowned woman on a cushioned throne in a wheat field, twelve stars above her, flowing river and forest behind',
  'the emperor': 'a bearded ruler on a stone throne carved with rams heads, orb and sceptre in hand, barren mountains behind',
  'the hierophant': 'a high priest between two pillars raising a hand in blessing, two acolytes kneeling, crossed keys at his feet',
  'the lovers': 'a man and a woman beneath a radiant angel, tree of life and tree of knowledge behind them, mountain between',
  'the chariot': 'an armoured charioteer with a starry canopy drawn by two sphinxes, walled city behind',
  'strength': 'a serene woman gently closing the jaws of a lion, infinity symbol above her head, garland of flowers',
  'the hermit': 'a cloaked hermit alone on a snowy peak holding a lantern with a six pointed star, staff in hand',
  'wheel of fortune': 'a great turning wheel in the sky inscribed with symbols, winged creatures at the four corners, serpent descending',
  'justice': 'a crowned figure seated between pillars holding upright sword and balanced scales',
  'the hanged man': 'a serene man suspended upside down by one ankle from a living tree, halo of light around his head',
  'death': 'a skeletal rider in black armour on a pale horse carrying a white rose banner, sun rising between two towers',
  'temperance': 'a winged angel pouring liquid between two cups, one foot in a stream one on land, irises blooming',
  'the devil': 'a horned figure on a black plinth above two chained figures, inverted torch, heavy shadow',
  'the tower': 'a tall tower struck by lightning, crown blown from its top, two figures falling, storm sky',
  'the star': 'a kneeling woman pouring water from two jugs into a pool and onto the earth beneath a great eight pointed star',
  'the moon': 'a full moon between two towers, a dog and a wolf howling, a crayfish emerging from a pool, winding path',
  'the sun': 'a radiant sun over a walled garden of sunflowers, a child on a white horse holding a banner',
  'the judgment': 'an angel blowing a great trumpet above figures rising from stone tombs with arms raised',
  'the world': 'a dancing figure wreathed in a laurel garland, four winged creatures at the corners of the sky',
};

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripHtml = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function newestBackup() {
  return fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'))
    .map(f => path.join(BACKUP_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

// ชื่อไพ่มาสามแบบ — "The Fool (เดอะฟูล)" · "El Sole ( The Sun ) 19" · "Cupid"
function parseName(raw) {
  let s = String(raw || '').trim(), num = '';
  const mNum = s.match(/\s(\d{1,2})\s*$/);
  if (mNum) { num = mNum[1]; s = s.slice(0, mNum.index).trim(); }
  const mPar = s.match(/^(.*?)\s*\(\s*(.+?)\s*\)\s*$/);
  if (mPar) return { main: mPar[1].trim(), sub: mPar[2].trim(), num };
  return { main: s, sub: '', num };
}

// หา "ชื่ออังกฤษ" ที่ใช้เทียบกับตำรา — สำรับเปิดฟรีเขียนชื่ออิตาลีไว้หน้า ชื่ออังกฤษอยู่ในวงเล็บ
function englishOf({ main, sub }) {
  const isThai = t => /[฀-๿]/.test(t);
  if (sub && !isThai(sub)) return sub;
  return main;
}

function promptFor(card) {
  const p = parseName(card.name);
  const en = englishOf(p).toLowerCase().replace(/^(el|la|le|il)\s+/, '').trim();
  const scene = ARCANA[en] || ARCANA[englishOf(p).toLowerCase()];
  if (scene) return `${scene}. ${STYLE}`;
  // ไม่ใช่ไพ่ชุดใหญ่ — ใช้ชื่อ (และคีย์เวิร์ดของอาจารย์ถ้ามี) เป็นฉาก
  const kw = stripHtml(card.description);
  const useKw = kw && !/^\d+$/.test(kw) ? `, evoking ${kw.replace(/\s*\([^)]*\)/g, '').trim()}` : '';
  return `A symbolic allegorical scene representing "${englishOf(p)}"${useKw}, `
       + `a single figure or emblem telling that idea. ${STYLE}`;
}

const png = svg => new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: W } }).render().asPng();

const BG = png(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0%" stop-color="#1B0B3A"/><stop offset="55%" stop-color="#2D0A5A"/><stop offset="100%" stop-color="#12071F"/>
  </linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`);

function frameFor(card) {
  const { main, sub, num } = parseName(card.name);
  const size = main.length > 22 ? 42 : main.length > 15 ? 50 : 58;
  const corners = [[M + 11, M + 11, 1, 1], [W - M - 11, M + 11, -1, 1], [M + 11, H - M - 11, 1, -1], [W - M - 11, H - M - 11, -1, -1]];
  return png(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="${FONT}">
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFF7E2"/><stop offset="46%" stop-color="#F3D98F"/><stop offset="100%" stop-color="#C79A4E"/></linearGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#160829" stop-opacity="0"/><stop offset="100%" stop-color="#160829" stop-opacity=".95"/></linearGradient>
    </defs>
    <rect x="${IX}" y="${IY + IH - 150}" width="${IW}" height="150" fill="url(#fade)"/>
    <rect x="${IX}" y="${IY}" width="${IW}" height="${IH}" rx="6" fill="none" stroke="#E8C77A" stroke-opacity=".5" stroke-width="1.6"/>
    <rect x="${M}" y="${M}" width="${W - M * 2}" height="${H - M * 2}" rx="14" fill="none" stroke="#E8C77A" stroke-opacity=".55" stroke-width="2.2"/>
    <rect x="${M + 11}" y="${M + 11}" width="${W - (M + 11) * 2}" height="${H - (M + 11) * 2}" rx="9" fill="none" stroke="#E8C77A" stroke-opacity=".22" stroke-width="1.1"/>
    ${corners.map(([x, y, sx, sy]) => `<path d="M${x + 26 * sx},${y} L${x},${y} L${x},${y + 26 * sy}" fill="none" stroke="#E8C77A" stroke-opacity=".75" stroke-width="2.4"/>`).join('')}
    ${num ? `<text x="${W / 2}" y="${IY + IH + 62}" text-anchor="middle" font-size="28" font-weight="700" fill="#E8C77A" opacity=".8" letter-spacing="3">${esc(num)}</text>` : ''}
    <text x="${W / 2}" y="${H - 238}" text-anchor="middle" font-size="${size}" font-weight="700" fill="url(#gold)">${esc(main)}</text>
    ${sub ? `<text x="${W / 2}" y="${H - 182}" text-anchor="middle" font-size="31" font-weight="400" fill="#CFC2EC">${esc(sub)}</text>` : ''}
    <line x1="${W / 2 - 60}" y1="${H - 152}" x2="${W / 2 + 60}" y2="${H - 152}" stroke="#E8C77A" stroke-opacity=".4" stroke-width="1.4"/>
    <text x="${W / 2}" y="${H - 108}" text-anchor="middle" font-size="24" font-weight="400" fill="#9C8CC4">${esc(DECK_TH[card.deck] || card.deck)}</text>
    <text x="${W / 2}" y="${H - 64}" text-anchor="middle" font-size="25" font-weight="700" fill="#E8C77A" opacity=".9">อาจารย์ปรินนี่ · Prinnie333</text>
  </svg>`);
}

async function flux(prompt) {
  const r = await fetch('https://fal.run/fal-ai/flux/dev', {
    method: 'POST',
    headers: { Authorization: 'Key ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: { width: 768, height: 1152 }, num_images: 1, num_inference_steps: 30, guidance_scale: 3.5 }),
  });
  const j = await r.json();
  if (!j.images || !j.images[0]) throw new Error(JSON.stringify(j).slice(0, 200));
  return Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer());
}

async function compose(art, card, out) {
  const meta = await sharp(art).metadata();
  // Flux ใส่กรอบลายวิจิตรด้านบนและแถบชื่อด้านล่างมาเอง — ครอปทิ้งให้เหลือแต่เนื้อภาพ
  const inner = await sharp(art).extract({
    left: Math.round(meta.width * 0.12), top: Math.round(meta.height * 0.13),
    width: Math.round(meta.width * 0.76), height: Math.round(meta.height * 0.68),
  }).resize(IW, IH, { fit: 'cover', position: 'top' }).png().toBuffer();

  await sharp(BG).composite([{ input: inner, left: IX, top: IY }, { input: frameFor(card), left: 0, top: 0 }])
    .jpeg({ quality: 88 }).toFile(out);
}

(async () => {
  if (!KEY) { console.error('ไม่เจอ FAL_KEY (ตั้งใน .env หรือ env)'); process.exit(1); }
  const backup = newestBackup();
  const t = JSON.parse(fs.readFileSync(backup, 'utf8')).tables.tarot;
  let cards = (Array.isArray(t) ? t : t.rows || []).filter(r => r.image_id)
    .map(r => ({ id: r.image_id, name: r.name || '', deck: r.deck || '', description: r.description || '' }));

  const deckArg = process.argv[process.argv.indexOf('--deck') + 1];
  if (process.argv.includes('--deck')) cards = cards.filter(c => c.deck === deckArg);

  fs.mkdirSync(OUT, { recursive: true });
  const have = new Set(fs.readdirSync(OUT).map(f => f.replace(/\.[^.]+$/, '')));
  let todo = cards.filter(c => !have.has(c.id));
  if (process.argv.includes('--only')) todo = todo.slice(0, Number(process.argv[process.argv.indexOf('--only') + 1]) || 5);

  console.log(`แบ็คอัพ: ${path.basename(backup)}`);
  console.log(`ไพ่ทั้งหมด ${cards.length} · มีแล้ว ${cards.length - cards.filter(c => !have.has(c.id)).length} · จะสร้าง ${todo.length}\n`);

  let ok = 0, fail = 0;
  const failed = [];
  for (const [i, c] of todo.entries()) {
    const tag = `[${String(i + 1).padStart(3)}/${todo.length}]`;
    const out = path.join(OUT, c.id + '.jpg');
    try {
      const art = await flux(promptFor(c));
      await compose(art, c, out);
      ok++;
      console.log(`${tag} ✓ ${c.name.slice(0, 44).padEnd(46)} ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
    } catch (e) {
      fail++; failed.push({ id: c.id, name: c.name, why: String(e.message).slice(0, 160) });
      console.log(`${tag} ✗ ${c.name.slice(0, 44).padEnd(46)} ${String(e.message).slice(0, 70)}`);
    }
  }
  console.log(`\nสำเร็จ ${ok} · ล้มเหลว ${fail} · เก็บที่ ${path.relative(process.cwd(), OUT)}`);
  if (failed.length) {
    fs.writeFileSync(path.join(OUT, '_failed.json'), JSON.stringify(failed, null, 2));
    console.log('ใบที่ล้มเหลวบันทึกไว้ที่ _failed.json — รันสคริปต์ซ้ำจะไล่ทำเฉพาะที่ยังขาด');
  }
})();
