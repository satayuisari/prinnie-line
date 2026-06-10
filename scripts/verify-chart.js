// ตรวจสอบความแม่นยำของ astro engine
//
// ใช้ 2 ส่วน:
//   1. Self-test — เทียบกับค่าดาราศาสตร์ที่รู้แน่ (J2000) ว่า engine ทำงานถูก
//   2. คำนวณดวงจริง — ใส่วันเกิดคนที่มีดวงในเว็บ Prinnie333 อยู่แล้ว
//      แล้วเทียบ Sun/Moon/ลัคนา ว่าตรงกันไหม
//
// วิธีใช้:
//   node scripts/verify-chart.js 1990-01-15 13:45 13.7563 100.5018 7
//   (วันเกิด เวลา ละติจูด ลองจิจูด tzOffset — tz default +7 ไทย, LA = -8)

const { computeNatalChart } = require('../src/astro/natalChart');
const { longitudeOf } = require('../src/astro/ephemeris');
const { signFromLongitude, degreeInSign, SIGN_TH, PLANET_TH } = require('../src/astro/zodiac');
const { lifePath } = require('../src/astro/numerology');

function fmt(lon) {
  const sign = signFromLongitude(lon);
  return `${lon.toFixed(2)}°  =  ${sign} (${SIGN_TH[sign]}) ${degreeInSign(lon).toFixed(1)}°`;
}

// ---------- 1. SELF-TEST ----------
console.log('═══ SELF-TEST: เทียบค่าดาราศาสตร์ที่รู้แน่ ═══\n');

// J2000.0 = 2000-01-01 12:00 UTC
const j2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
const sunJ2000 = longitudeOf('Sun', j2000);
console.log(`ดวงอาทิตย์ ณ J2000 (2000-01-01 12:00 UTC):`);
console.log(`  คำนวณได้: ${sunJ2000.toFixed(2)}°  (ค่าอ้างอิง ~280.46° = มังกร)`);
const sunOk = Math.abs(sunJ2000 - 280.46) < 0.5;
console.log(`  ${sunOk ? '✅ ผ่าน' : '❌ ผิดปกติ'} — engine ${sunOk ? 'ทำงานถูกต้อง' : 'มีปัญหา'}\n`);

// ตรวจ numerology ที่คำนวณมือได้
// 1990-01-15 → 1+9+9+0+0+1+1+5 = 26 → 2+6 = 8
const lpTest = lifePath('1990-01-15');
console.log(`เลขศาสตร์ 1990-01-15: คำนวณได้ ${lpTest}  (ตรวจมือ = 8)  ${lpTest === 8 ? '✅' : '❌'}\n`);

// ---------- 2. คำนวณดวงจริง ----------
const [, , date, time, lat, lng, tz] = process.argv;
if (!date) {
  console.log('───────────────────────────────────────────────');
  console.log('ใส่วันเกิดเพื่อคำนวณดวงจริง (timezone/DST อัตโนมัติ):');
  console.log('  ด้วยชื่อเมือง:  node scripts/verify-chart.js 1997-03-01 19:30 "Los Angeles"');
  console.log('  ด้วยพิกัด:     node scripts/verify-chart.js 1990-01-15 13:45 13.7563 100.5018');
  process.exit(0);
}

async function main() {
  let coords = { lat: null, lng: null };
  let placeLabel = '';

  // ถ้า arg ที่ 4 ไม่ใช่ตัวเลข = เป็นชื่อสถานที่ → geocode
  const isCoords = lat !== undefined && !isNaN(Number(lat));

  if (isCoords) {
    coords = { lat: Number(lat), lng: Number(lng) };
    placeLabel = `${coords.lat}, ${coords.lng}`;
  } else if (lat !== undefined) {
    // รวม args ตั้งแต่ตำแหน่งสถานที่เป็นต้นไป (รองรับชื่อมีช่องว่าง)
    const place = process.argv.slice(4).join(' ');
    const { geocodeRaw } = require('../src/services/geocodingService');
    console.log(`🌍 ค้นหาสถานที่: "${place}" ...`);
    const geo = await geocodeRaw(place);
    coords = { lat: geo.lat, lng: geo.lng };
    placeLabel = `${geo.display_name}\n     (${geo.lat}, ${geo.lng}, tz ${geo.timezone})`;
    console.log(`   พบ: ${placeLabel}\n`);
  }

  console.log(`═══ ดวงกำเนิด: ${date} ${time || '(ไม่ระบุเวลา)'} ═══\n`);

  const chart = computeNatalChart({
    date,
    time: time || null,
    lat:  coords.lat,
    lng:  coords.lng,
  });

  console.log('ดาวทุกดวง:');
  for (const [planet, p] of Object.entries(chart.planets)) {
    const th = PLANET_TH[planet] || planet;
    console.log(`  ${planet.padEnd(9)} (${th.padEnd(7)}) ${fmt(p.longitude)}`);
  }

  console.log('\nสรุป:');
  console.log(`  ☀️  อาทิตย์ (Sun):   ${chart.sun} (${SIGN_TH[chart.sun]})`);
  console.log(`  🌙  จันทร์ (Moon):   ${chart.moon} (${SIGN_TH[chart.moon]})`);
  console.log(`  ⬆️  ลัคนา (Rising):  ${chart.rising ? `${chart.rising} (${SIGN_TH[chart.rising]})` : '— (ต้องมีเวลา+พิกัด)'}`);
  console.log(`  🔢  เลขศาสตร์:        ${chart.life_path}`);
  console.log(`\n  timezone: ${chart.timezone}  (offset ${chart.tz_offset}, DST: ${chart.dst})`);
  console.log(`  UTC ที่ใช้คำนวณ: ${chart.birth_utc}`);
  console.log('\n👉 เอา Sun/Moon/ลัคนา ไปเทียบกับดวงคนเดียวกันในเว็บ Prinnie333');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
