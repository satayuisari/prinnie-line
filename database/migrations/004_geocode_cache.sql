-- Cache ผลลัพธ์ geocoding (ชื่อสถานที่ → พิกัด + timezone)
-- กัน Nominatim rate limit + เร็วขึ้นเวลา query ซ้ำ

CREATE TABLE IF NOT EXISTS geocode_cache (
  query        VARCHAR(255) PRIMARY KEY,   -- ชื่อสถานที่ (lowercase, trimmed)
  lat          NUMERIC(9,6),
  lng          NUMERIC(9,6),
  display_name TEXT,
  timezone     VARCHAR(64),
  created_at   TIMESTAMP DEFAULT NOW()
);
