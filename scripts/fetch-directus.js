// ดึง content ทุกตารางจาก Directus API (limit=-1 = ครบทุกแถว) → เซฟลง data/
//   node scripts/fetch-directus.js <BASE_URL> <TOKEN>
const fs = require('fs');
const path = require('path');

const BASE  = (process.argv[2] || '').replace(/\/$/, '');
const TOKEN = process.argv[3];
const DATA  = path.join(__dirname, '..', 'data');
if (!BASE || !TOKEN) { console.error('ใส่ BASE_URL และ TOKEN'); process.exit(1); }

// Directus collection key → ชื่อไฟล์ (ที่ importer ใช้)
const MAP = {
  horoscope_western:  'horoscope_western.json',
  horoscope_lakkana:  'horoscope_lakkana.json',
  horoscope_transit:  'horoscope_transit.json',
  horoscope_synastry: 'horoscope_synastry.json',
  horoscope_numerlogy:'horoscope_numerology.json',  // แก้สะกดให้ตรง importer
  horoscope_tarot:    'horoscope_tarot.json',
  tarot:              'tarot.json',
};

(async () => {
  for (const [coll, file] of Object.entries(MAP)) {
    try {
      const r = await fetch(`${BASE}/items/${coll}?limit=-1`, {
        headers: { Authorization: 'Bearer ' + TOKEN },
      });
      const j = await r.json();
      if (!j.data) { console.log(`  [ERR] ${coll}: ${JSON.stringify(j).slice(0,150)}`); continue; }
      fs.writeFileSync(path.join(DATA, file), JSON.stringify(j.data, null, 2));
      const withText = j.data.filter(x => x.prediction && String(x.prediction).replace(/<[^>]*>/g,'').trim().length > 5).length;
      console.log(`  [ok] ${coll.padEnd(20)} ${String(j.data.length).padStart(5)} rows -> ${file}` + (coll.startsWith('horoscope') ? `  (มีคำทำนาย ${withText})` : ''));
    } catch (e) {
      console.log(`  [ERR] ${coll}: ${e.message}`);
    }
  }
  console.log('\nFetch complete.');
})();
