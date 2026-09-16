-- โต๊ะคอนเทนต์: เก็บทุกโพสต์ที่ "เสนอ" และที่ "โพสต์จริง" ไว้ที่เดียว
--
-- bon 16 ก.ย. 69: "คอนเทนต์ไหนดี คอนเทนต์ไหนเหมาะ คิดให้เลย ตอบกลับแม่เลย"
--
-- ก่อนหน้านี้แคปชั่นทั้งหมดเขียนมือแล้ววางไว้บน Desktop ไม่มีที่ไหนจดว่าโพสต์อะไรไปแล้ว
-- และโพสต์ไหนทำให้คนแอดเพิ่ม/สมัครเพิ่ม ตารางนี้ปิดวงจรนั้น: เสนอ → อนุมัติ → โพสต์ → วัดผล
-- แล้วรอบถัดไปหยิบผลที่วัดได้มาเป็นข้อมูลตั้งต้นให้ AI คิดต่อ
CREATE TABLE IF NOT EXISTS content_posts (
  id          SERIAL PRIMARY KEY,
  for_date    DATE        NOT NULL,             -- ตั้งใจให้โพสต์วันไหน
  slot        VARCHAR(16) NOT NULL DEFAULT 'feed', -- feed | story | line
  theme       VARCHAR(80),                      -- มุมที่เล่า เช่น เวลาเกิด / ดาวจร / รีวิว
  caption     TEXT        NOT NULL,             -- ข้อความพร้อมโพสต์ (ผ่านตรวจคำต้องห้ามแล้ว)
  image_brief TEXT,                             -- บรีฟภาพให้คนหรือเครื่องทำต่อ
  rationale   TEXT,                             -- ทำไมถึงเสนออันนี้วันนี้ (อ้างตัวเลขจริง)
  status      VARCHAR(12) NOT NULL DEFAULT 'DRAFT', -- DRAFT | POSTED | SKIPPED
  source      VARCHAR(12) NOT NULL DEFAULT 'ai',    -- ai | fallback | human
  model       VARCHAR(60),
  created_at  TIMESTAMP   DEFAULT NOW(),
  decided_at  TIMESTAMP,
  posted_at   TIMESTAMP,
  -- วัดผล 3 วันหลังโพสต์ (เติมโดย measure())
  measured_at   TIMESTAMP,
  clicks_after  INTEGER,
  signups_after INTEGER,
  paid_after    INTEGER
);

-- วันละหนึ่งชิ้นต่อช่อง กันเสนอซ้ำเวลาเครื่องรีสตาร์ต
CREATE UNIQUE INDEX IF NOT EXISTS content_posts_date_slot ON content_posts (for_date, slot);
CREATE INDEX IF NOT EXISTS content_posts_status ON content_posts (status);
