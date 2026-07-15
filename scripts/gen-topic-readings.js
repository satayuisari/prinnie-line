// สร้างคำทำนาย transit แยกหมวด (งาน/รัก/เงิน) ด้วย Claude — ครั้งเดียว เก็บลง horoscope_transit_topics
//
// ใช้ Message Batches API (ถูกลง 50% + ไม่ชน rate limit) กับ structured outputs
// ครอบคลุมเฉพาะดาวจรที่ระบบใช้จริง (PERIOD_TRANSIT ทุกช่วง) = 9 ดาว × 8 มุม × 12 ดาวกำเนิด = 864 คู่
//
// วิธีใช้ (ต้องมี DATABASE_URL + ANTHROPIC_API_KEY):
//   node scripts/gen-topic-readings.js test            ยิง 1 request แบบ sync ดูคุณภาพก่อน
//   node scripts/gen-topic-readings.js create          สร้าง batch → เก็บ id ไว้ที่ data/topic-batch-id
//   node scripts/gen-topic-readings.js poll            เช็คสถานะ / พอเสร็จ → เขียน data/topic-readings.jsonl + import ลง DB
//   node scripts/gen-topic-readings.js sample [N]      สุ่มตัวอย่างจาก DB มาอ่าน (default 6)
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../src/db');

const MODEL = 'claude-opus-4-8';
const ID_FILE = path.join(__dirname, '..', 'data', 'topic-batch-id');
const OUT_FILE = path.join(__dirname, '..', 'data', 'topic-readings.jsonl');

// ดาวจรที่ระบบเรียกจริง (รวมทุกช่วงจาก PERIOD_TRANSIT ใน horoscopeService)
const TRANSIT_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Neptune', 'Pluto'];

const PLANET_TH = {
  Sun: 'อาทิตย์ — ตัวตน ความมั่นใจ พลังชีวิต เกียรติยศ',
  Moon: 'จันทร์ — อารมณ์ความรู้สึก สัญชาตญาณ ความอบอุ่นใจ',
  Mercury: 'พุธ — ความคิด การสื่อสาร การเจรจา ข้อมูลข่าวสาร',
  Venus: 'ศุกร์ — ความรัก เสน่ห์ ความงาม ความสุขสบาย',
  Mars: 'อังคาร — พลังงาน ความกล้า การลงมือทำ ความร้อนแรง',
  Jupiter: 'พฤหัส — โชคลาภ การขยับขยาย โอกาส ความเมตตา',
  Saturn: 'เสาร์ — วินัย ความรับผิดชอบ บทเรียน ความอดทน ข้อจำกัด',
  Uranus: 'ยูเรนัส — ความเปลี่ยนแปลงฉับพลัน อิสรภาพ ความแปลกใหม่',
  Neptune: 'เนปจูน — จินตนาการ ความฝัน ญาณสัมผัส ความเห็นอกเห็นใจ',
  Pluto: 'พลูโต — การเปลี่ยนแปลงถึงราก พลังลึกในใจ ความเข้มข้น',
  Chiron: 'ไครอน — แผลใจเก่าและการเยียวยา',
  Node: 'ราหูเหนือ — ทิศทางชีวิต จุดหมายของดวงชะตา',
};
const ASPECT_TH = {
  Conjunction: 'ร่วม (0°) — พลังสองดาวหลอมรวมกัน เข้มข้นชัดเจน',
  Sextile: 'โยน (60°) — มุมดี เป็นโอกาสที่ต้องลงมือคว้าเอง',
  Trine: 'ตรีโกณ (120°) — มุมดีมาก ราบรื่น ส่งเสริมกันเป็นธรรมชาติ',
  Square: 'ฉาก (90°) — มุมท้าทาย มีแรงเสียดทาน ต้องปรับตัว',
  Opposition: 'เล็ง (180°) — แรงดึงสองขั้ว ต้องหาจุดสมดุล',
  'Semi-sextile': 'กึ่งโยน (30°) — มุมดีอ่อน ๆ โอกาสเล็ก ๆ ที่แทรกเข้ามา',
  'Semi-Square': 'กึ่งฉาก (45°) — มุมท้าทายอ่อน ๆ ความหงุดหงิดขัดใจเล็กน้อย',
  Quincunx: 'ปรับมุม (150°) — ความไม่ลงตัวที่ต้องค่อย ๆ ปรับจูนเข้าหากัน',
};

// โทนแบรนด์ Prinnie333: อบอุ่น ให้กำลังใจ ไม่ดราม่า — เขียนแบบคำทำนายในคลังเดิม
const SYSTEM = `คุณคือนักโหราศาสตร์ของแบรนด์ Prinnie333 เขียนคำทำนายดวงจากมุมดาวจร (transit) ที่กระตุ้นดาวในดวงกำเนิดของเจ้าชะตา

งานของคุณ: จากมุมดาวที่ให้มา เขียนคำทำนาย 3 เวอร์ชันจาก "พลังงานเดียวกัน" — ความรัก การงาน การเงิน แต่ละเวอร์ชันต้องเป็นเรื่องนั้นล้วน ๆ ห้ามไหลไปเรื่องอื่น

กติกาการเขียน (สำคัญทุกข้อ):
- เรียกผู้อ่านว่า "คุณ" ไม่ใส่ ครับ/ค่ะ/นะคะ (คลังคำทำนายเดิมไม่ใส่)
- ห้ามเอ่ยชื่อดาวหรือชื่อมุม (หัวข้อด้านบนบอกผู้อ่านอยู่แล้ว) ห้ามใช้คำอังกฤษ
- ห้ามระบุช่วงเวลา เช่น วันนี้ สัปดาห์นี้ เดือนนี้ (ข้อความถูกใช้ทั้งดวงรายวันถึงรายปี) — ใช้ "ช่วงนี้" ได้
- ยาว 2-3 ประโยค ประมาณ 150-280 ตัวอักษรต่อหมวด ไม่ใส่จุด (.) กลางย่อหน้า ใช้เว้นวรรคแบ่งประโยคแบบไทย
- โทนอบอุ่น จริงใจ ให้กำลังใจ มุมท้าทายให้เตือนแบบนุ่มนวลพร้อมทางออก ไม่ขู่ ไม่ดราม่า
- เขียนให้เป็นภาษาไทยธรรมชาติ ขึ้นต้นแต่ละหมวดไม่ซ้ำแพทเทิร์นกัน เลี่ยงสำนวลแปล เลี่ยงคำเชื่อมทางการ (อย่างไรก็ตาม ทั้งนี้ นอกจากนี้)
- ความหมายทางโหราศาสตร์ต้องตรงกับธรรมชาติของมุม: มุมดีให้เรื่องดี มุมท้าทายให้ข้อควรระวังพร้อมคำแนะนำ
- love = ความรัก ความสัมพันธ์ คนโสด/คนมีคู่ · work = งาน หน้าที่ เพื่อนร่วมงาน เจ้านาย · money = รายรับรายจ่าย การออม การลงทุน โชคลาภ

ถ้ามี "คำทำนายต้นฉบับ" ให้ยึดความหมายและน้ำเสียงของต้นฉบับเป็นหลัก แล้วตีความแยกลงแต่ละหมวด ถ้าไม่มีให้เขียนจากความหมายดาวและมุมที่ให้`;

const OUTPUT_FORMAT = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      love: { type: 'string', description: 'คำทำนายหมวดความรัก' },
      work: { type: 'string', description: 'คำทำนายหมวดการงาน' },
      money: { type: 'string', description: 'คำทำนายหมวดการเงิน' },
    },
    required: ['love', 'work', 'money'],
    additionalProperties: false,
  },
};

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/ํา/g, 'ำ').replace(/\s+/g, ' ').trim();
}

function userPrompt(row) {
  const lines = [
    `มุมดาว: ดาวจร${(PLANET_TH[row.aspecting_planet] || row.aspecting_planet)}`,
    `ทำมุม ${(ASPECT_TH[row.aspect] || row.aspect)}`,
    `ถึงดาวกำเนิด${(PLANET_TH[row.aspected_planet] || row.aspected_planet)}`,
    '(ดาวจร = ตัวกระตุ้นจากท้องฟ้าตอนนี้ · ดาวกำเนิด = ด้านชีวิตของเจ้าชะตาที่ถูกกระตุ้น)',
  ];
  const orig = stripHtml(row.prediction);
  if (orig) lines.push('', 'คำทำนายต้นฉบับ (ยึดความหมายนี้):', orig.slice(0, 1500));
  return lines.join('\n');
}

const key = r => `${r.aspecting_planet}__${r.aspect}__${r.aspected_planet}`.replace(/[^a-zA-Z0-9_-]/g, '-');

async function loadRows() {
  const r = await db.query(
    `SELECT aspecting_planet, aspect, aspected_planet, prediction FROM horoscope_transit
     WHERE aspecting_planet = ANY($1) ORDER BY aspecting_planet, aspect, aspected_planet`,
    [TRANSIT_PLANETS]);
  return r.rows;
}

function buildRequest(row) {
  return {
    custom_id: key(row),
    params: {
      model: MODEL,
      max_tokens: 2000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: { format: OUTPUT_FORMAT },
      messages: [{ role: 'user', content: userPrompt(row) }],
    },
  };
}

// ── test: ยิง 1 request sync ดูคุณภาพ + ยืนยันว่า SDK 0.65 ส่ง output_config ผ่านได้ ──
async function test() {
  const client = new Anthropic();
  const rows = await loadRows();
  const withText = rows.find(r => stripHtml(r.prediction).length > 100 && r.aspecting_planet === 'Moon');
  const empty = rows.find(r => !stripHtml(r.prediction) && r.aspecting_planet === 'Sun');
  for (const row of [withText, empty]) {
    const req = buildRequest(row).params;
    const resp = await client.messages.create(req);
    const text = resp.content.find(b => b.type === 'text')?.text || '';
    console.log(`\n===== ${row.aspecting_planet} ${row.aspect} ${row.aspected_planet} (${stripHtml(row.prediction) ? 'มีต้นฉบับ' : 'ไม่มีต้นฉบับ'}) =====`);
    const j = JSON.parse(text);
    for (const t of ['love', 'work', 'money']) console.log(`\n[${t}] (${j[t].length} ตัวอักษร)\n${j[t]}`);
    console.log(`\n(tokens: in ${resp.usage.input_tokens} out ${resp.usage.output_tokens})`);
  }
  await db.end();
}

// ── create: สร้าง batch ──────────────────────────────────────────────────────
async function create() {
  const client = new Anthropic();
  const rows = await loadRows();
  console.log(`สร้าง batch: ${rows.length} คู่ดาว × 3 หมวด (มีต้นฉบับ ${rows.filter(r => stripHtml(r.prediction)).length} / ว่าง ${rows.filter(r => !stripHtml(r.prediction)).length})`);
  const batch = await client.messages.batches.create({ requests: rows.map(buildRequest) });
  fs.mkdirSync(path.dirname(ID_FILE), { recursive: true });
  fs.writeFileSync(ID_FILE, batch.id);
  console.log(`✓ batch ${batch.id} (${batch.processing_status}) — เก็บ id แล้ว, รอเสร็จด้วย: node scripts/gen-topic-readings.js poll`);
  await db.end();
}

// ── poll: เช็คสถานะ → เสร็จแล้ว import ────────────────────────────────────────
async function poll() {
  const client = new Anthropic();
  const id = fs.readFileSync(ID_FILE, 'utf8').trim();
  const batch = await client.messages.batches.retrieve(id);
  console.log(`batch ${id}: ${batch.processing_status}`, JSON.stringify(batch.request_counts));
  if (batch.processing_status !== 'ended') { await db.end(); return; }

  const rows = await loadRows();
  const byKey = Object.fromEntries(rows.map(r => [key(r), r]));
  const out = fs.createWriteStream(OUT_FILE);
  let ok = 0, failed = [];
  const ins = `INSERT INTO horoscope_transit_topics (aspecting_planet, aspect, aspected_planet, topic, prediction, source, model)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (aspecting_planet, aspect, aspected_planet, topic)
    DO UPDATE SET prediction=EXCLUDED.prediction, source=EXCLUDED.source, model=EXCLUDED.model`;
  for await (const result of await client.messages.batches.results(id)) {
    const row = byKey[result.custom_id];
    if (!row || result.result.type !== 'succeeded') { failed.push(result.custom_id); continue; }
    const text = result.result.message.content.find(b => b.type === 'text')?.text || '';
    let j;
    try { j = JSON.parse(text); } catch (_) { failed.push(result.custom_id); continue; }
    const source = stripHtml(row.prediction) ? 'rewritten' : 'generated';
    let bad = false;
    for (const t of ['love', 'work', 'money']) {
      const p = (j[t] || '').trim();
      if (p.length < 60 || p.length > 600 || !/[ก-๙]/.test(p)) { bad = true; break; }
    }
    if (bad) { failed.push(result.custom_id); continue; }
    for (const t of ['love', 'work', 'money']) {
      await db.query(ins, [row.aspecting_planet, row.aspect, row.aspected_planet, t, j[t].trim(), source, MODEL]);
    }
    out.write(JSON.stringify({ key: result.custom_id, source, ...j }) + '\n');
    ok++;
  }
  out.end();
  console.log(`✓ import แล้ว ${ok} คู่ดาว (${ok * 3} คำทำนาย) → horoscope_transit_topics + ${OUT_FILE}`);
  if (failed.length) console.log(`⚠️ ล้มเหลว ${failed.length}: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? ' …' : ''}`);
  await db.end();
}

// ── sample: สุ่มอ่านจาก DB ────────────────────────────────────────────────────
async function sample(n = 6) {
  const r = await db.query(
    `SELECT * FROM horoscope_transit_topics WHERE (aspecting_planet, aspect, aspected_planet) IN
     (SELECT aspecting_planet, aspect, aspected_planet FROM horoscope_transit_topics GROUP BY 1,2,3 ORDER BY random() LIMIT $1)
     ORDER BY aspecting_planet, aspect, aspected_planet, topic`, [n]);
  let last = '';
  for (const row of r.rows) {
    const k = `${row.aspecting_planet} ${row.aspect} ${row.aspected_planet}`;
    if (k !== last) { console.log(`\n===== ${k} (${row.source}) =====`); last = k; }
    console.log(`[${row.topic}] ${row.prediction}\n`);
  }
  await db.end();
}

const cmd = process.argv[2];
({ test, create, poll, sample: () => sample(parseInt(process.argv[3]) || 6) }[cmd] || (() => {
  console.log('ใช้: test | create | poll | sample [N]'); process.exit(1);
}))().catch(e => { console.error('ERR', e.message); process.exit(1); });
