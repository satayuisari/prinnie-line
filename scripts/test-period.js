require('dotenv').config();
const h = require('../src/services/horoscopeService');
const { computeNatalChart } = require('../src/astro/natalChart');
const db = require('../src/db');

(async () => {
  for (const t of ['weekly', 'monthly', 'annual']) {
    const r = await h.periodReading(t);
    console.log(`${t}:`, r ? r.text.slice(0, 75).replace(/\n/g, ' ') + '...' : '(ไม่มี)');
  }
  const chart = computeNatalChart({ date: '1997-03-01', time: '19:30', lat: 34.05, lng: -118.24 });
  const d = await h.dailyReading(chart, new Date());
  console.log('daily aspects:', d.aspects.length, '| has_content:', d.has_content);
  d.aspects.forEach(a => console.log(`  - ${a.aspecting_planet} ${a.aspect} ${a.aspected_planet}`));
  await db.end();
})();
