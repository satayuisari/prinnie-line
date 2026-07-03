-- PromptPay + slip — เพิ่มฟิลด์รองรับการโอนตรง + แนบสลิป (ไม่ผ่าน card gateway)
-- method แยกที่มาของออเดอร์: 'beam' (เดิม) | 'promptpay' (โอน+สลิป ต้องให้ staff อนุมัติ)
-- slip_message_id = LINE messageId ของรูปสลิปที่ลูกค้าส่งเข้าแชท (ดึงรูปมาดูบน dashboard ได้)
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS method           TEXT DEFAULT 'beam';
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS slip_message_id  TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS slip_received_at TIMESTAMP;

-- ดึงออเดอร์ที่รอ staff อนุมัติได้เร็ว (promptpay + ยังไม่จ่าย)
CREATE INDEX IF NOT EXISTS idx_payment_orders_pending_promptpay
  ON payment_orders (created_at DESC)
  WHERE method = 'promptpay' AND status = 'PENDING';
