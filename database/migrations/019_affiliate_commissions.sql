-- Commission Ledger — ค่าคอมอินฟลูแบบ First Paid Customer (CAC ไม่ใช่ revenue share)
-- 1 แถว = 1 ค่าคอม ต่อ "ลูกค้าใหม่ที่จ่ายจริงครั้งแรก" เท่านั้น (renew เดือนถัดไปไม่ได้เพิ่ม)
-- สถานะ: PENDING (กันช่วง refund/fraud) → APPROVED (จ่ายได้) → PAID (จ่ายอินฟลูแล้ว)
--        REVERSED = ลูกค้า refund/ทุจริต → ตัดค่าคอมทิ้ง (ห้าม reverse ตัวที่ PAID ไปแล้ว)
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id             SERIAL PRIMARY KEY,
  affiliate_code TEXT    NOT NULL REFERENCES affiliates(code),
  line_user_id   TEXT    NOT NULL,
  order_ref      TEXT,                              -- payment_orders.ref ที่ทำให้เกิดค่าคอม (first paid)
  amount         INTEGER NOT NULL DEFAULT 50,       -- Base CPA (บาท) — 50 เป็นทางการ
  status         TEXT    NOT NULL DEFAULT 'PENDING',
  hold_until     TIMESTAMP NOT NULL DEFAULT NOW(),  -- ตั้งจริงตอน insert = NOW() + AFFILIATE_HOLD_DAYS
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at    TIMESTAMP,
  paid_at        TIMESTAMP,
  reversed_at    TIMESTAMP,
  note           TEXT DEFAULT '',
  UNIQUE (line_user_id)   -- dedup: ค่าคอมได้ครั้งเดียวต่อลูกค้าตลอดกาล (First Paid เท่านั้น)
);
CREATE INDEX IF NOT EXISTS idx_aff_com_code   ON affiliate_commissions(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_aff_com_status ON affiliate_commissions(status);
