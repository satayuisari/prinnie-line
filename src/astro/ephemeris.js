// คำนวณตำแหน่งดาว (ecliptic longitude) ด้วย astronomy-engine
// ใช้ tropical zodiac (โหราศาสตร์สากล/ตะวันตก) — ตรงกับ content "ราศี" ของ Prinnie
//
// ความแม่นยำ: astronomy-engine แม่นระดับ ~1 ลิปดา (arcminute)
// ราศีกว้าง 30° → error ระดับลิปดาไม่มีผลต่อการระบุราศี (ยกเว้นเกิดคาบเส้นราศีพอดี)

const Astronomy = require('astronomy-engine');

// ดาวที่ content รองรับ (Chiron / Node ไม่มีใน engine และคำทำนายว่างอยู่แล้ว)
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

// คืน ecliptic longitude (องศา 0-360, of-date) ของดาวดวงหนึ่ง ณ เวลา date (JS Date = UTC)
function longitudeOf(body, date) {
  if (body === 'Sun') {
    // ตำแหน่งดวงอาทิตย์ ecliptic of-date
    return Astronomy.SunPosition(date).elon;
  }
  if (body === 'Moon') {
    // ดวงจันทร์ geocentric ecliptic of-date
    return Astronomy.EclipticGeoMoon(date).lon;
  }
  // ดาวเคราะห์อื่น: geocentric apparent ecliptic longitude (of-date)
  return Astronomy.EclipticLongitude(Astronomy.Body[body], date);
}

// คืนตำแหน่งดาวทุกดวง { Sun: 123.4, Moon: 45.6, ... }
function allLongitudes(date) {
  const out = {};
  for (const b of BODIES) {
    out[b] = longitudeOf(b, date);
  }
  return out;
}

module.exports = { BODIES, longitudeOf, allLongitudes };
