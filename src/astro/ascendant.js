// คำนวณลัคนา (Ascendant / rising sign)
// ต้องใช้ วันเกิด + เวลาเกิด + พิกัด (lat/lng)
//
// สูตรมาตรฐานโหราศาสตร์ (tropical):
//   λ_asc = atan2( cos(RAMC), -(sin(RAMC)·cosε + tanφ·sinε) )
//   RAMC = local sidereal time (องศา), ε = ความเอียงแกนโลก, φ = ละติจูด

const Astronomy = require('astronomy-engine');

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// ความเอียงแกนโลกเฉลี่ย (mean obliquity) — Laskar, แม่นพอสำหรับลัคนา
function meanObliquity(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T  = (jd - 2451545.0) / 36525;
  // องศา
  return 23.439291 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
}

// คืน ecliptic longitude ของลัคนา (0-360)
// date = JS Date (UTC), lng = ลองจิจูดตะวันออก (+), lat = ละติจูดเหนือ (+)
function ascendantLongitude(date, lat, lng) {
  const gast = Astronomy.SiderealTime(date);     // Greenwich apparent sidereal time (ชั่วโมง)
  const lstHours = gast + lng / 15;              // local sidereal time (ชั่วโมง)
  const ramc = ((lstHours * 15) % 360 + 360) % 360; // องศา

  const e = meanObliquity(date) * D2R;
  const r = ramc * D2R;
  const phi = lat * D2R;

  const y = Math.cos(r);
  const x = -(Math.sin(r) * Math.cos(e) + Math.tan(phi) * Math.sin(e));

  let asc = Math.atan2(y, x) * R2D;
  return (asc % 360 + 360) % 360;
}

module.exports = { ascendantLongitude, meanObliquity };
