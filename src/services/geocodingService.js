const { zoneFromCoords } = require('../astro/timezone');

// geocoding ผ่าน OpenStreetMap Nominatim (ฟรี ไม่ต้อง API key)
// policy: ต้องมี User-Agent ระบุตัวตน + ไม่เกิน 1 req/วินาที
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'Prinnie333-LINE/2.0 (horoscope binding app)';

// แปลงชื่อสถานที่ → พิกัด + timezone (ไม่ใช้ cache — pure)
// ใช้ global fetch (Node 18+) — ไม่ต้องพึ่ง dependency
async function geocodeRaw(place) {
  const url = `${NOMINATIM}?q=${encodeURIComponent(place)}&format=json&limit=1&accept-language=th,en`;

  const resp = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal:  AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`geocoding ล้มเหลว: HTTP ${resp.status}`);

  const data = await resp.json();
  if (!data || !data.length) {
    throw new Error(`หาสถานที่ไม่พบ: "${place}"`);
  }

  const r   = data[0];
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  return {
    lat,
    lng,
    display_name: r.display_name,
    timezone:     zoneFromCoords(lat, lng),
  };
}

// geocode พร้อม cache ใน DB (lazy require db เพื่อให้ geocodeRaw ใช้ได้โดยไม่ต้องมี DB)
async function geocode(place) {
  const db  = require('../db');
  const key = place.toLowerCase().trim();

  const cached = await db.query(
    'SELECT lat, lng, display_name, timezone FROM geocode_cache WHERE query = $1', [key]
  );
  if (cached.rows[0]) {
    return { ...cached.rows[0], lat: Number(cached.rows[0].lat), lng: Number(cached.rows[0].lng), cached: true };
  }

  const result = await geocodeRaw(place);

  await db.query(
    `INSERT INTO geocode_cache (query, lat, lng, display_name, timezone)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (query) DO NOTHING`,
    [key, result.lat, result.lng, result.display_name, result.timezone]
  );

  return { ...result, cached: false };
}

module.exports = { geocode, geocodeRaw };
