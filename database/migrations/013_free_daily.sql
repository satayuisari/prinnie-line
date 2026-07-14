-- "ฟรี 1 วัน": ให้คนลงทะเบียน (ยังไม่จ่าย) ได้ดวงเต็มฟรีวันแรก แล้ววันถัดไปเป็น teaser ล็อก
-- free_daily_at = เวลาที่ใช้สิทธิ์วันฟรีไปแล้ว (NULL = ยังไม่ได้ใช้)
ALTER TABLE line_subscribers ADD COLUMN IF NOT EXISTS free_daily_at TIMESTAMP;
