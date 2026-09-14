-- บันทึกการเรียก AI ทุกครั้ง เพื่อให้ตอบได้ว่าเดือนที่แล้วจ่ายไปกับอะไร
--
-- ที่มา: ถูกถามว่าเดือนที่แล้วค่า AI หมดไปเท่าไหร่กับอะไรบ้าง แล้วตอบไม่ได้
-- เพราะไม่มีที่ไหนในระบบเก็บไว้เลย ต้องไปเปิดคอนโซลของผู้ให้บริการดูอย่างเดียว
-- ซึ่งบอกได้แค่ยอดรวม ไม่ได้บอกว่ามาจากฟีเจอร์ไหน
--
-- เก็บเฉพาะจำนวนโทเคนกับชื่อโมเดล ไม่เก็บเนื้อความที่ส่งไปหรือคำตอบที่ได้กลับมา
CREATE TABLE IF NOT EXISTS ai_usage (
  id            SERIAL PRIMARY KEY,
  feature       TEXT NOT NULL,          -- support_reply · support_draft · ask_brief
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  ok            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage (created_at);
CREATE INDEX IF NOT EXISTS ai_usage_feature_idx ON ai_usage (feature, created_at);
