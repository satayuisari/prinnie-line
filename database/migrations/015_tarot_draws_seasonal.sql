-- ไพ่ฉลาด: จำประวัติการหยิบต่อคน (ไม่ซ้ำใบเดิมเร็วเกิน + กดดูซ้ำได้ใบเดิมในงวดเดียวกัน)
CREATE TABLE IF NOT EXISTS tarot_draws (
  id           SERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL,
  period       TEXT NOT NULL,              -- daily | weekly | monthly | annual
  period_key   TEXT NOT NULL,              -- 2026-07-18 | 2026-W29 | 2026-07 | 2026
  card_name    TEXT NOT NULL,
  pool         TEXT NOT NULL,              -- horoscope_tarot.type ที่หยิบมา (love/work/money/free/weekly/...)
  drawn_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (line_user_id, period, period_key)
);
CREATE INDEX IF NOT EXISTS idx_tarot_draws_user ON tarot_draws(line_user_id, drawn_at);

-- ประกาศพิเศษจาก อ.ปรินนี่ (เช่น ช่วงดาวพุธถอยหลัง) — แทรกเข้าดวงรายวันตามลัคนา
-- lakkana: 'all' หรือชื่อราศีอังกฤษคั่น comma เช่น 'Virgo,Gemini' (ตรงกับ chart_data->>'rising')
CREATE TABLE IF NOT EXISTS seasonal_notes (
  id         SERIAL PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  lakkana    TEXT NOT NULL DEFAULT 'all',
  message    TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
