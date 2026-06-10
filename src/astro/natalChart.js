// คำนวณดวงกำเนิด (natal chart) จากข้อมูลเกิด
// รวม: ตำแหน่งดาวทุกดวง + ราศี, ลัคนา, เลขศาสตร์

const { BODIES, allLongitudes, longitudeOf } = require('./ephemeris');
const { ascendantLongitude } = require('./ascendant');
const { signFromLongitude, degreeInSign } = require('./zodiac');
const { lifePath } = require('./numerology');
const { zoneFromCoords, localToUTC, offsetHours, isDST } = require('./timezone');

const TZ_THAILAND = 7; // UTC+7 (fallback ถ้าไม่มีโซน/พิกัด)

// fallback: fixed offset (ใช้เมื่อไม่รู้โซนและพิกัด)
function toUTCDateFixed(birthDate, birthTime, tzOffset = TZ_THAILAND) {
  const [y, mo, d] = birthDate.split('-').map(Number);
  let hh = 12, mm = 0;
  if (birthTime) {
    const parts = birthTime.split(':').map(Number);
    hh = parts[0] || 0; mm = parts[1] || 0;
  }
  return new Date(Date.UTC(y, mo - 1, d, hh - tzOffset, mm));
}

// หา UTC instant + ข้อมูลโซน จากข้อมูลเกิด
// ลำดับความสำคัญ: zone ที่ระบุ > derive จากพิกัด > tzOffset คงที่ > ไทย
function resolveUTC(birth) {
  let zone = birth.zone || null;
  if (!zone && birth.lat != null && birth.lng != null) {
    zone = zoneFromCoords(birth.lat, birth.lng);
  }
  if (zone) {
    return {
      date:   localToUTC(birth.date, birth.time, zone),
      zone,
      offset: offsetHours(birth.date, birth.time, zone),
      dst:    isDST(birth.date, birth.time, zone),
    };
  }
  // fallback
  const tz = birth.tzOffset != null ? birth.tzOffset : TZ_THAILAND;
  return {
    date:   toUTCDateFixed(birth.date, birth.time, tz),
    zone:   `UTC${tz >= 0 ? '+' : ''}${tz}`,
    offset: tz,
    dst:    null,
  };
}

/**
 * @param {object} birth
 *   birth.date      'YYYY-MM-DD'   (required)
 *   birth.time      'HH:MM'        (optional — ถ้าไม่มี ลัคนาจะ null)
 *   birth.lat       number         (ละติจูดเหนือ +)
 *   birth.lng       number         (ลองจิจูดตะวันออก +)
 *   birth.tzOffset  number         (default 7)
 */
function computeNatalChart(birth) {
  const resolved = resolveUTC(birth);
  const date     = resolved.date;

  // ตำแหน่งดาวทุกดวง → ราศี
  const longitudes = allLongitudes(date);
  const planets = {};
  for (const body of BODIES) {
    const lon = longitudes[body];
    planets[body] = {
      longitude: round(lon),
      sign:      signFromLongitude(lon),
      degree:    round(degreeInSign(lon)),
    };
  }

  // ลัคนา (ต้องมีเวลา + พิกัด)
  let rising = null;
  const hasTime  = !!birth.time;
  const hasPlace = birth.lat != null && birth.lng != null;
  if (hasTime && hasPlace) {
    const ascLon = ascendantLongitude(date, Number(birth.lat), Number(birth.lng));
    rising = {
      longitude: round(ascLon),
      sign:      signFromLongitude(ascLon),
      degree:    round(degreeInSign(ascLon)),
    };
  }

  return {
    sun:       planets.Sun.sign,
    moon:      planets.Moon.sign,
    rising:    rising ? rising.sign : null,
    rising_known: !!rising,
    planets,                       // ดาวทุกดวง + longitude (ใช้ทำ transit รายวัน)
    life_path: lifePath(birth.date),
    computed_at: new Date().toISOString(),
    birth_utc:   date.toISOString(),
    timezone:    resolved.zone,
    tz_offset:   resolved.offset,
    dst:         resolved.dst,
  };
}

// ตำแหน่งดาว "วันนี้" (ใช้ทำดวงจร/transit) — longitude ดิบของทุกดวง
function transitingPositions(date = new Date()) {
  return allLongitudes(date);
}

function round(n) { return Math.round(n * 100) / 100; }

module.exports = { computeNatalChart, transitingPositions, resolveUTC };
