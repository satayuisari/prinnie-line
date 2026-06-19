-- เพิ่มหมวดหมู่ + ความเร่งด่วน ให้ support_inbox (triage แบบ keyword จาก cowork)
ALTER TABLE support_inbox ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'general';
ALTER TABLE support_inbox ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'normal';
CREATE INDEX IF NOT EXISTS idx_inbox_priority ON support_inbox(status, priority, created_at);
