// ทดสอบ pipeline ครบสาย: chart → DB → ดึงคำทำนายจาก content tables
require('dotenv').config();
const db = require('../src/db');
const { computeNatalChart } = require('../src/astro/natalChart');
const horoscope = require('../src/services/horoscopeService');

async function main() {
  console.log(`DB driver: ${db.driver}\n`);

  const chart = computeNatalChart({ date: '1990-01-15', time: '13:45', lat: 13.7563, lng: 100.5018 });
  console.log(`ดวง: Sun=${chart.sun} Moon=${chart.moon} Rising=${chart.rising} LifePath=${chart.life_path}\n`);

  await db.query('DELETE FROM line_subscribers WHERE line_user_id = $1', ['Utest']);
  await db.query(
    `INSERT INTO line_subscribers
       (line_user_id, nickname, birth_date, birth_time, birth_place, chart_data, status, subscribe_end)
     VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE', NOW() + interval '30 days')`,
    ['Utest', 'ทดสอบ', '1990-01-15', '13:45', 'Bangkok', JSON.stringify(chart)]
  );

  const natal = await horoscope.natalReading(chart);
  console.log('=== NATAL (พื้นดวง) ===');
  console.log('Sun :', natal.sections.sun  ? natal.sections.sun.slice(0,90)+'...'  : '(ไม่มีในคอนเทนต์)');
  console.log('Moon:', natal.sections.moon ? natal.sections.moon.slice(0,90)+'...' : '(ไม่มีในคอนเทนต์)');
  console.log('ลัคนา:', natal.sections.rising ? natal.sections.rising.slice(0,90)+'...' : '(ไม่มีในคอนเทนต์)');
  console.log('เลข :', natal.sections.numerology ? natal.sections.numerology.slice(0,90)+'...' : '(ไม่มี)');

  const daily = await horoscope.dailyReading(chart, new Date());
  console.log('\n=== DAILY (ดวงวันนี้) ===');
  console.log(`เจอมุมที่มีคำทำนาย: ${daily.aspects.length} | has_content: ${daily.has_content}`);
  daily.aspects.forEach(a => console.log(`  ${a.aspecting_planet} ${a.aspect} ${a.aspected_planet}`));
  console.log('ไพ่:', daily.tarot ? daily.tarot.name : '(ไม่มี)');

  await db.end();
}
main().catch(e => { console.error(e); process.exit(1); });
