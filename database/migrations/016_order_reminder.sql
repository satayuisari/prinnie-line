-- ตามออเดอร์ค้างจ่าย: จำว่าเตือนไปแล้ว (เตือนครั้งเดียวต่อออเดอร์ ไม่สแปม)
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMP;
