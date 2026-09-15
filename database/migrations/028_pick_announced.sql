-- "ดวงเลือกคุณ" — จดว่ารอบไหนประกาศสาธารณะไปแล้ว (บรอดแคสต์เข้าทั้งสองบัญชี ไม่เปิดชื่อ)
-- กันประกาศซ้ำถ้า cron/สคริปต์รันสองครั้ง และไว้ตรวจย้อนหลังว่ารอบไหนเงียบไป
--
-- ROLLBACK:
--   ALTER TABLE loyalty_rewards DROP COLUMN IF EXISTS announced_at;
--   DELETE FROM schema_migrations WHERE filename='028_pick_announced.sql';

ALTER TABLE loyalty_rewards ADD COLUMN IF NOT EXISTS announced_at TIMESTAMP;
