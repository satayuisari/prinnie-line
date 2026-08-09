-- Affiliate Ops V1 — ทำให้ Bon ใช้งานระบบ affiliate ได้ครบจากแดชบอร์ด ไม่ต้องแตะ terminal
-- เพิ่มอย่างเดียว (additive) ไม่ลบ/ไม่แก้ข้อมูลเดิม — ปลอดภัยกับ production ที่มีข้อมูลอยู่แล้ว
--
-- ROLLBACK NOTES (ถ้าต้องถอย):
--   DROP TABLE IF EXISTS affiliate_candidates;
--   DROP TABLE IF EXISTS affiliate_audit_log;
--   ALTER TABLE affiliates            DROP COLUMN IF EXISTS status;
--   ALTER TABLE affiliate_commissions DROP COLUMN IF EXISTS revenue_amount;
--   ALTER TABLE affiliate_commissions DROP COLUMN IF EXISTS reason;
--   ALTER TABLE affiliate_commissions DROP COLUMN IF EXISTS needs_review;
--   DELETE FROM schema_migrations WHERE filename='020_affiliate_ops.sql';
--   คอลัมน์ affiliates.active ยังอยู่ครบ → โค้ดเวอร์ชันก่อนหน้าทำงานต่อได้ทันที

-- ── 1. สถานะ affiliate 3 ระดับ (เดิมเป็น boolean active) ────────────────────
-- ACTIVE = ผูก attribution ใหม่ได้ · PAUSED = หยุดชั่วคราว · OFF = ปิด
-- ห้ามลบ attribution/ค่าคอมย้อนหลังเมื่อ pause/off — แค่กันของใหม่
-- คง active ไว้ให้ sync กับ status เสมอ (active = status='ACTIVE') กันโค้ดเก่าพัง
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
UPDATE affiliates SET status = CASE WHEN active THEN 'ACTIVE' ELSE 'OFF' END
 WHERE status NOT IN ('ACTIVE','PAUSED','OFF') OR status IS NULL;
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);

-- ── 2. ledger: เก็บรายได้จริงของออเดอร์ + เหตุผล + ธงรอแอดมินตรวจ ──────────
-- revenue_amount = "บาท" (payment_orders.amount เป็นสตางค์ → หารตอนบันทึก)
-- หน่วยตรงกับ commission_amount เพื่อไม่ให้เผลอเอาสตางค์มาบวกกับบาท
ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS revenue_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS reason         TEXT;
-- refund ของค่าคอมที่จ่ายอินฟลูไปแล้ว: ห้ามแก้ประวัติการเงินเงียบ ๆ → ตั้งธงให้แอดมินตัดสิน
ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS needs_review   BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_aff_com_review ON affiliate_commissions(needs_review) WHERE needs_review;

-- ── 3. CRM หาอินฟลู (candidate → onboarded) ────────────────────────────────
-- ไม่บังคับกรอกครบทุกช่อง — มีแค่ชื่อก็เพิ่มได้ (V1 ไม่ scrape social)
CREATE TABLE IF NOT EXISTS affiliate_candidates (
  id                  SERIAL PRIMARY KEY,
  display_name        TEXT NOT NULL,
  platform            TEXT DEFAULT '',        -- tiktok / ig / youtube / facebook / line
  profile_url         TEXT DEFAULT '',
  contact_method      TEXT DEFAULT '',        -- LINE / IG DM / email / โทร
  contact_value       TEXT DEFAULT '',
  followers           INTEGER DEFAULT 0,
  category            TEXT DEFAULT '',        -- ดูดวง / ไลฟ์สไตล์ / ความรัก …
  notes               TEXT DEFAULT '',
  -- คะแนนคัดอินฟลู 0–5 ต่อข้อ · total_score = ผลรวม (คำนวณในแอปตอนบันทึก)
  score_audience_fit  INTEGER DEFAULT 0,
  score_engagement    INTEGER DEFAULT 0,
  score_content       INTEGER DEFAULT 0,
  score_trust         INTEGER DEFAULT 0,
  score_cta           INTEGER DEFAULT 0,
  score_brand_safety  INTEGER DEFAULT 0,
  total_score         INTEGER NOT NULL DEFAULT 0,
  recruitment_status  TEXT NOT NULL DEFAULT 'CANDIDATE',
  affiliate_code      TEXT,                   -- ตั้งเมื่อแปลงเป็นอินฟลูแล้ว (ONBOARDED)
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  last_contacted_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cand_status ON affiliate_candidates(recruitment_status);
CREATE INDEX IF NOT EXISTS idx_cand_score  ON affiliate_candidates(total_score DESC);

-- ── 4. Audit log — ทุกการเปลี่ยนสถานะเงิน/สถานะคน ต้องมีร่องรอย ────────────
-- ห้ามเก็บ token/ความลับใด ๆ ในตารางนี้ (เก็บเฉพาะค่าเชิงธุรกิจ)
CREATE TABLE IF NOT EXISTS affiliate_audit_log (
  id          SERIAL PRIMARY KEY,
  event       TEXT NOT NULL,        -- COMMISSION_APPROVED, AFFILIATE_PAUSED, …
  actor       TEXT NOT NULL DEFAULT 'admin',   -- 'admin' (dashboard) | 'system' (อัตโนมัติ) | 'cli'
  entity_type TEXT NOT NULL DEFAULT '',        -- affiliate | candidate | commission | subscriber
  entity_id   TEXT NOT NULL DEFAULT '',
  old_value   TEXT,
  new_value   TEXT,
  reason      TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON affiliate_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON affiliate_audit_log(created_at DESC);
