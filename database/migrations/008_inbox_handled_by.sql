-- บันทึกว่าเคสนี้ตอบโดยใคร (bot = auto-reply, staff = คนตอบ) — ไว้ตรวจคุณภาพบอท
ALTER TABLE support_inbox ADD COLUMN IF NOT EXISTS handled_by VARCHAR(10);
