// Proofreading pass — fix confirmed, unambiguous Thai typos across content JSON.
// Meaning-locked: only misspellings / dropped syllables / clear run-ons. No restyle.
// Usage: node scripts/fix-thai-typos.js         (dry run — reports counts)
//        node scripts/fix-thai-typos.js --write  (apply + save)
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const WRITE = process.argv.includes('--write');

// [bad, good] — each verified in context as an unambiguous error
const FIXES = [
  ['อารามณ์', 'อารมณ์'],            // อารมณ์ misspelled
  ['เล้นลับ', 'เร้นลับ'],            // เร้นลับ (mysterious)
  ['จิตนาการ', 'จินตนาการ'],        // dropped น
  ['สัมพันธ์ุ', 'สัมพันธ์'],          // stray สระอุ after ์
  ['แอลกอฮอลล์', 'แอลกอฮอล์'],      // double ล
  ['หยิงกับหยาง', 'หญิงกับหยาง'],   // หญิง misspelled
  ['ได้รับอิทธิจาก', 'ได้รับอิทธิพลจาก'], // dropped พล
  ['ช่วงเวลที่', 'ช่วงเวลาที่'],       // dropped า
  ['เหตุผลการมีปากเสียง', 'เหตุผล การมีปากเสียง'], // run-on
  ['สิ่งเล็กๆในน้อย', 'สิ่งเล็ก ๆ น้อย ๆ'],        // garbled
  ['สุนทรีย์ภาพ', 'สุนทรียภาพ'],     // สุนทรียภาพ
  ['สมดุลย์', 'สมดุล'],              // สมดุล (common misspelling)
];

// content files → the text field(s) that hold Thai prose
const FILES = {
  'horoscope_transit.json':   ['prediction'],
  'horoscope_synastry.json':  ['prediction'],
  'horoscope_western.json':   ['prediction'],
  'horoscope_lakkana.json':   ['prediction'],
  'horoscope_numerology.json':['prediction'],
  'horoscope_tarot.json':     ['description'],
  'tarot.json':               ['description'],
};

let grand = 0;
for (const [file, fields] of Object.entries(FILES)) {
  const p = path.join(DATA, file);
  if (!fs.existsSync(p)) { console.log(`  [skip] ${file} (missing)`); continue; }
  const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
  let fileHits = 0;
  for (const r of rows) {
    for (const f of fields) {
      if (typeof r[f] !== 'string') continue;
      for (const [bad, good] of FIXES) {
        if (r[f].includes(bad)) {
          fileHits += r[f].split(bad).length - 1;
          r[f] = r[f].split(bad).join(good);
        }
      }
    }
  }
  grand += fileHits;
  console.log(`  ${String(fileHits).padStart(3)}  ${file}`);
  if (WRITE && fileHits) fs.writeFileSync(p, JSON.stringify(rows, null, 2));
}
console.log(`  ---\n  ${grand} fixes ${WRITE ? 'APPLIED + saved' : '(dry run — use --write to apply)'}`);
