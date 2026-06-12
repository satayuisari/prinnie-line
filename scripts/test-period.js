require('dotenv').config();
const h = require('../src/services/horoscopeService');
const { computeNatalChart } = require('../src/astro/natalChart');
const db = require('../src/db');

(async () => {
  const chart = computeNatalChart({ date: '1997-03-01', time: '19:30', lat: 34.05, lng: -118.24 });

  const daily = await h.dailyReading(chart, new Date());
  console.log('=== รายวัน (ควรเป็นดาวเร็ว: Moon/Sun/Mercury/Venus/Mars) ===');
  daily.aspects.forEach(a => console.log(`  🌟 ${a.aspecting_planet} ${a.aspect} ${a.aspected_planet}`));
  console.log('  🃏 tarot:', daily.tarot ? daily.tarot.name : '(ไม่มี)');

  for (const p of ['weekly', 'monthly', 'annual']) {
    const r = await h.periodReading(p, chart, new Date());
    console.log(`\n=== ${p} ===`);
    r.aspects.forEach(a => console.log(`  🌟 ${a.aspecting_planet} ${a.aspect} ${a.aspected_planet}`));
    if (!r.aspects.length) console.log('  (ไม่มีดาวจรช่วงนี้)');
    console.log('  🃏 tarot:', r.tarot ? r.tarot.name + ' — ' + r.tarot.text.slice(0,40) + '...' : '(ไม่มี)');
  }
  await db.end();
})();
