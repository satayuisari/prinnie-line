// คำนวณมุมสัมพันธ์ระหว่างดาว (aspects)
// ใช้ทำดวงรายวัน: ดาวจร (transit วันนี้) ทำมุมกับดาวกำเนิด (natal)
// ชื่อ aspect ตรงกับ content table horoscope_transit

const ASPECTS = [
  { name: 'Conjunction',  angle: 0,   orb: 3 },
  { name: 'Semi-sextile', angle: 30,  orb: 1.5 },
  { name: 'Semi-Square',  angle: 45,  orb: 1.5 },
  { name: 'Sextile',      angle: 60,  orb: 2.5 },
  { name: 'Square',       angle: 90,  orb: 3 },
  { name: 'Trine',        angle: 120, orb: 3 },
  { name: 'Quincunx',     angle: 150, orb: 1.5 },
  { name: 'Opposition',   angle: 180, orb: 3 },
];

// ระยะเชิงมุม 0-180
function separation(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// หา aspect ที่เข้าเกณฑ์ระหว่าง 2 longitude
function matchAspect(lonA, lonB) {
  const sep = separation(lonA, lonB);
  for (const asp of ASPECTS) {
    const diff = Math.abs(sep - asp.angle);
    if (diff <= asp.orb) {
      return { aspect: asp.name, orb: round(diff), exactness: round(asp.orb - diff) };
    }
  }
  return null;
}

/**
 * หามุมทั้งหมดระหว่างดาวจร (transiting) กับดาวกำเนิด (natal)
 * @param transiting { Sun: lon, Moon: lon, ... }  ตำแหน่งวันนี้
 * @param natalPlanets { Sun: {longitude}, ... }   ดาวกำเนิด
 * @returns [{ aspecting_planet, aspect, aspected_planet, exactness }]
 *          เรียงจาก aspect ที่แม่นที่สุดก่อน
 */
function transitAspects(transiting, natalPlanets) {
  const results = [];
  for (const tPlanet of Object.keys(transiting)) {
    for (const nPlanet of Object.keys(natalPlanets)) {
      const m = matchAspect(transiting[tPlanet], natalPlanets[nPlanet].longitude);
      if (m) {
        results.push({
          aspecting_planet: tPlanet,    // ดาวจร
          aspect:           m.aspect,
          aspected_planet:  nPlanet,    // ดาวกำเนิด
          exactness:        m.exactness,
        });
      }
    }
  }
  // แม่นที่สุด (exactness สูง) ขึ้นก่อน
  return results.sort((a, b) => b.exactness - a.exactness);
}

function round(n) { return Math.round(n * 100) / 100; }

module.exports = { ASPECTS, separation, matchAspect, transitAspects };
