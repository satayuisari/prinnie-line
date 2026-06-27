-- เตือนต่ออายุ (กันรูรั่ว churn): subscription เป็นจ่ายครั้งเดียว +30 วัน ไม่ recurring
-- พอ subscribe_end ผ่าน ดวงหยุดส่งเงียบ ๆ — สเกจูเลอร์ renewals.js จะ push เตือนแทน
--
-- renewal_stage  : ถึง stage ไหนของ "รอบปัจจุบัน" แล้ว (0 ยังไม่เตือน, 1 ก่อนหมด, 2 วันหมด, 3 win-back)
-- renewal_anchor : ค่า subscribe_end ที่ stage นี้อ้างอิงอยู่ — ถ้าต่ออายุแล้ว subscribe_end ขยับ
--                  จะไม่ตรงกับ anchor → สเกจูเลอร์รีเซ็ต stage=0 ให้รอบใหม่เตือนได้อีกครั้งอัตโนมัติ
ALTER TABLE line_subscribers ADD COLUMN IF NOT EXISTS renewal_stage  INT DEFAULT 0;
ALTER TABLE line_subscribers ADD COLUMN IF NOT EXISTS renewal_anchor TIMESTAMP;
