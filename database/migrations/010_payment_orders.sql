-- payment_orders — คำสั่งซื้อที่รอชำระผ่าน Beam (แทนการฝากข้อมูลใน gateway metadata)
-- ผูกกับ Beam order.referenceId → webhook ยกมา lookup ได้ว่าใครจ่ายอะไร (subscription/couple)
-- couple เก็บข้อมูลวันเกิดคู่ใน payload (Beam ไม่ได้ส่ง metadata กลับมาเหมือน Stripe)
CREATE TABLE IF NOT EXISTS payment_orders (
  ref          TEXT PRIMARY KEY,              -- referenceId ที่ส่งให้ Beam (เราเป็นคนสร้าง)
  type         TEXT NOT NULL,                 -- 'subscription' | 'couple'
  line_user_id TEXT NOT NULL,
  amount       INTEGER NOT NULL,              -- หน่วยย่อย (สตางค์)
  payload      JSONB,                         -- couple: ข้อมูลวันเกิดของคู่
  status       TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | PAID
  charge_id    TEXT,                          -- chargeId จาก Beam (ตอนชำระสำเร็จ)
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(line_user_id);
