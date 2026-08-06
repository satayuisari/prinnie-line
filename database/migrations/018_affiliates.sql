-- ระบบ affiliate: อินฟลูได้ลิงก์ /go?a=CODE → track คลิก + คนที่สมัคร/จ่ายผ่านเขา
CREATE TABLE IF NOT EXISTS affiliates (
  code       TEXT PRIMARY KEY,        -- รหัสในลิงก์ (a-z0-9) เช่น 'mudmee'
  name       TEXT NOT NULL,           -- ชื่ออินฟลู (แสดงในแดชบอร์ด)
  note       TEXT DEFAULT '',
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ผูกว่าสมาชิกคนนี้มาจากอินฟลูคนไหน (เก็บตอนลงทะเบียนผ่าน LIFF ?a=CODE)
-- เก็บครั้งแรกที่ผูกเท่านั้น (ไม่ทับ) — คนแนะนำคนแรกได้เครดิต
ALTER TABLE line_subscribers ADD COLUMN IF NOT EXISTS affiliate_code TEXT;
CREATE INDEX IF NOT EXISTS idx_subs_affiliate ON line_subscribers(affiliate_code);
