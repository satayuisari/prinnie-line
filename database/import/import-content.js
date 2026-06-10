require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('../../src/db');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');

function load(name) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) {
    console.warn(`  [skip] missing ${name}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function importWestern() {
  const rows = load('horoscope_western.json');
  if (!rows) return;
  await db.query('TRUNCATE horoscope_western RESTART IDENTITY');
  let n = 0;
  for (const r of rows) {
    if (!r.planetary || !r.constellation) continue;
    await db.query(
      `INSERT INTO horoscope_western (planetary, constellation, prediction)
       VALUES ($1,$2,$3)
       ON CONFLICT (planetary, constellation) DO UPDATE SET prediction = EXCLUDED.prediction`,
      [r.planetary, r.constellation, r.prediction || '']
    );
    n++;
  }
  console.log(`  [ok] horoscope_western      ${n}`);
}

async function importLakkana() {
  const rows = load('horoscope_lakkana.json');
  if (!rows) return;
  await db.query('TRUNCATE horoscope_lakkana RESTART IDENTITY');
  let n = 0;
  for (const r of rows) {
    if (!r.constellation) continue;
    await db.query(
      `INSERT INTO horoscope_lakkana (constellation, prediction)
       VALUES ($1,$2)
       ON CONFLICT (constellation) DO UPDATE SET prediction = EXCLUDED.prediction`,
      [r.constellation, r.prediction || '']
    );
    n++;
  }
  console.log(`  [ok] horoscope_lakkana      ${n}`);
}

async function importAspectTable(jsonName, table) {
  const rows = load(jsonName);
  if (!rows) return;
  await db.query(`TRUNCATE ${table} RESTART IDENTITY`);
  let n = 0;
  for (const r of rows) {
    if (!r.aspecting_planet || !r.aspect || !r.aspected_planet) continue;
    await db.query(
      `INSERT INTO ${table} (aspecting_planet, aspect, aspected_planet, prediction)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (aspecting_planet, aspect, aspected_planet)
       DO UPDATE SET prediction = EXCLUDED.prediction`,
      [r.aspecting_planet, r.aspect, r.aspected_planet, r.prediction || '']
    );
    n++;
  }
  console.log(`  [ok] ${table.padEnd(22)} ${n}`);
}

async function importNumerology() {
  const rows = load('horoscope_numerology.json');
  if (!rows) return;
  await db.query('TRUNCATE horoscope_numerology RESTART IDENTITY');
  let n = 0;
  for (const r of rows) {
    if (!r.aggregate) continue;
    await db.query(
      `INSERT INTO horoscope_numerology (aggregate, prediction)
       VALUES ($1,$2)
       ON CONFLICT (aggregate) DO UPDATE SET prediction = EXCLUDED.prediction`,
      [String(r.aggregate), r.prediction || '']
    );
    n++;
  }
  console.log(`  [ok] horoscope_numerology   ${n}`);
}

async function importTarot() {
  const rows = load('tarot.json');
  if (!rows) return;
  await db.query('TRUNCATE tarot RESTART IDENTITY');
  let n = 0;
  for (const r of rows) {
    await db.query(
      `INSERT INTO tarot (ext_id, name, image_id, deck, description)
       VALUES ($1,$2,$3,$4,$5)`,
      [r.id || null, r.name || '', r.image_id || '', r.deck || '', r.description || '']
    );
    n++;
  }
  console.log(`  [ok] tarot                  ${n}`);
}

async function importHoroscopeTarot() {
  const rows = load('horoscope_tarot.json');
  if (!rows) return;
  await db.query('TRUNCATE horoscope_tarot RESTART IDENTITY');
  let n = 0;
  for (const r of rows) {
    await db.query(
      `INSERT INTO horoscope_tarot (tarot_card_map, type, description)
       VALUES ($1,$2,$3)`,
      [r.tarot_card_map || null, r.type || 'free', r.description || '']
    );
    n++;
  }
  console.log(`  [ok] horoscope_tarot        ${n}`);
}

async function main() {
  console.log(`DB driver: ${db.driver}`);
  console.log(`Importing content from: ${DATA_DIR}\n`);
  await importWestern();
  await importLakkana();
  await importAspectTable('horoscope_transit.json',  'horoscope_transit');
  await importAspectTable('horoscope_synastry.json', 'horoscope_synastry');
  await importNumerology();
  await importTarot();
  await importHoroscopeTarot();
  console.log('\nImport complete.');
  await db.end();
}

main().catch(err => { console.error(err); process.exit(1); });
