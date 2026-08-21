-- "ดวงเลือกคุณ" — ทุกวันที่ 15 ระบบหาสมาชิกที่ดาวจรทำมุมกับดวงกำเนิดแรงที่สุด
-- คนนั้นได้ดูดวงส่วนตัวกับ อ.ปรินนี่ 1 ชั่วโมง
--
-- ⚖️ ไม่มีการสุ่ม: คำนวณจากตำแหน่งดาวจริง (astronomy-engine) เทียบดวงกำเนิดที่เก็บไว้แล้ว
--    คนละคนกันทุกเดือนโดยธรรมชาติเพราะดาวเคลื่อน — ตรวจสอบย้อนหลังได้ทุกครั้ง
--    ต่างจากการจับรางวัลตรงที่ผลลัพธ์ถูกกำหนดโดยข้อมูล ไม่ใช่โอกาส
--
-- ต่อยอดจากตาราง loyalty_rewards เดิม (สถานะ/แจ้งเตือน/หมดอายุ ใช้ซ้ำได้ทั้งหมด)
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_loyalty_cycle;
--   ALTER TABLE loyalty_rewards DROP COLUMN IF EXISTS cycle;
--   ALTER TABLE loyalty_rewards DROP COLUMN IF EXISTS score;
--   ALTER TABLE loyalty_rewards DROP COLUMN IF EXISTS detail;
--   DELETE FROM schema_migrations WHERE filename='024_monthly_transit_pick.sql';

ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS cycle  TEXT;      -- รอบเดือน 'YYYY-MM'
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS score  NUMERIC;   -- คะแนนดาวจร ณ วันคำนวณ
ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS detail TEXT;      -- เช่น 'Saturn Trine Jupiter'

-- 1 รอบเดือน = ผู้ได้รับ 1 คนเท่านั้น (รันซ้ำกี่รอบก็ไม่มีทางได้ 2 คน)
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_cycle ON loyalty_rewards(cycle) WHERE cycle IS NOT NULL;

-- หมายเหตุ: UNIQUE(line_user_id, milestone) ที่มีอยู่เดิมถูกใช้เป็นด่านกันคนเดิมได้ซ้ำ
-- โดยเก็บ milestone = ปี ค.ศ. → 1 คนได้ไม่เกินปีละครั้ง แม้โค้ดจะพลาด
