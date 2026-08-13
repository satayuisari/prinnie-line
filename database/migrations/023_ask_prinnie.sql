-- Ask Prinnie 3 — สิทธิ์สมาชิก: ส่ง 3 คำถามให้ อ.ปรินนี่ ตอบเป็นการส่วนตัว
--
-- เปลี่ยนจากดีไซน์เดิม (022: ดูดวง 1 ชม. มูลค่า 3,000) ตามที่ Bon สั่ง:
--   เวลาอาจารย์คือทรัพยากรที่ scale ไม่ได้ — 1 ชม./คน ระเบิดทันทีที่สมาชิกโต
--   3 คำถามตอบเป็นชุดเดียว ใช้เวลาอาจารย์ ~5–10 นาที/สิทธิ์แทน
--   และ "ไม่ประกาศมูลค่า" เพราะของที่ให้ไม่เท่ากับบริการ 1 ชม. ที่ราคา 3,000
--
-- ⚖️ ยังคงเป็นสิทธิ์ตามเงื่อนไข ไม่มีการสุ่ม (ดู 022 + loyaltyReward.js)
--    Terms ต้องผ่านที่ปรึกษากฎหมายก่อนเปิดใช้จริง
--
-- ROLLBACK:
--   ALTER TABLE loyalty_rewards DROP COLUMN IF EXISTS questions;
--   ALTER TABLE loyalty_rewards DROP COLUMN IF EXISTS brief;
--   ALTER TABLE loyalty_rewards DROP COLUMN IF EXISTS answered_at;
--   ALTER TABLE loyalty_rewards DROP COLUMN IF EXISTS asked_at;
--   DELETE FROM schema_migrations WHERE filename='023_ask_prinnie.sql';

-- 3 คำถามที่ลูกค้าส่งมาพร้อมกันครั้งเดียว (array ของข้อความ)
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS questions   JSONB;
-- สรุปหน้าเดียวให้อาจารย์เปิดแล้วตอบได้เลย (AI เตรียมให้ ไม่ได้ตอบแทน)
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS brief       TEXT;
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS asked_at    TIMESTAMP;   -- ลูกค้าส่งคำถามครบ
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP;   -- อาจารย์ตอบกลับแล้ว

-- reward_value: เก็บคอลัมน์ไว้เพื่อความเข้ากันได้ แต่ของใหม่ไม่ประกาศมูลค่า → 0
UPDATE loyalty_rewards SET reward_value = 0 WHERE reward_value = 3000;
ALTER TABLE loyalty_rewards ALTER COLUMN reward_value SET DEFAULT 0;
ALTER TABLE loyalty_rewards ALTER COLUMN reward SET DEFAULT 'Ask Prinnie 3';

-- คิวงานอาจารย์: ดึงเฉพาะสิทธิ์ที่ลูกค้าส่งคำถามแล้วแต่ยังไม่ได้ตอบ
CREATE INDEX IF NOT EXISTS idx_loyalty_queue ON loyalty_rewards(asked_at) WHERE answered_at IS NULL;
