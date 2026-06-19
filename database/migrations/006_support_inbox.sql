-- กล่องข้อความ support: เก็บข้อความลูกค้าที่บอทไม่ได้ตอบ (non-keyword) ไว้ให้ staff ดู/ตอบบน dashboard
CREATE TABLE IF NOT EXISTS support_inbox (
  id            SERIAL PRIMARY KEY,
  line_user_id  VARCHAR(50) NOT NULL,
  display_name  VARCHAR(255),
  message       TEXT NOT NULL,
  ai_draft      TEXT,                          -- ร่างคำตอบจาก AI (ถ้ามี)
  reply_text    TEXT,                          -- ข้อความที่ staff ส่งจริง
  status        VARCHAR(20) DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','REPLIED','CLOSED')),
  created_at    TIMESTAMP DEFAULT NOW(),
  replied_at    TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON support_inbox(status, created_at);
