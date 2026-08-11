-- สิทธิ์ดูดวงส่วนตัวกับ อ.ปรินนี่ 1 ชม. (มูลค่า 3,000) สำหรับสมาชิกที่จ่ายครบตามเกณฑ์
--
-- ⚖️ ทำไมเป็น "สิทธิ์ตามเงื่อนไข" ไม่ใช่ "สุ่มลุ้น":
--    การสุ่มแจกรางวัลให้ลูกค้า = การเสี่ยงโชค ต้องขออนุญาตตาม พ.ร.บ. การพนัน 2478 ม.8 ก่อนจัด
--    แบบนี้ให้ตามเงื่อนไขที่ประกาศไว้ล่วงหน้า ใครครบเกณฑ์ได้ทุกคน ไม่มีการเสี่ยง → ไม่เข้าข่าย
--    (ดู src/services/loyaltyReward.js สำหรับเกณฑ์ที่ใช้จริง)
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS loyalty_rewards;
--   DELETE FROM schema_migrations WHERE filename='022_loyalty_rewards.sql';
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id              SERIAL PRIMARY KEY,
  line_user_id    TEXT    NOT NULL,
  milestone       INTEGER NOT NULL,          -- ได้สิทธิ์ตอนจ่ายครบกี่ครั้ง (เช่น 3)
  reward          TEXT    NOT NULL DEFAULT 'ดูดวงส่วนตัวกับ อ.ปรินนี่ 1 ชั่วโมง',
  reward_value    INTEGER NOT NULL DEFAULT 3000,   -- มูลค่าที่ประกาศ (บาท)
  status          TEXT    NOT NULL DEFAULT 'GRANTED',
  -- GRANTED = ได้สิทธิ์แล้ว · NOTIFIED = แจ้งลูกค้าแล้ว · BOOKED = นัดเวลาแล้ว
  -- USED = ใช้สิทธิ์เสร็จแล้ว · EXPIRED = หมดอายุไม่ได้ใช้
  granted_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  notified_at     TIMESTAMP,
  used_at         TIMESTAMP,
  expires_at      TIMESTAMP,                 -- ตั้ง = granted_at + LOYALTY_EXPIRE_DAYS
  note            TEXT DEFAULT '',
  -- กันให้ซ้ำระดับ DB: 1 คน ได้สิทธิ์ของแต่ละขั้นได้ครั้งเดียวตลอดกาล
  -- (scheduler รันซ้ำ/ยิงซ้ำกี่รอบ ก็ไม่มีทางแจกซ้ำ)
  UNIQUE (line_user_id, milestone)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_status ON loyalty_rewards(status);
CREATE INDEX IF NOT EXISTS idx_loyalty_user   ON loyalty_rewards(line_user_id);
