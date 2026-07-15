-- คำทำนาย transit แยกหมวด (งาน/รัก/เงิน) — สร้างครั้งเดียวด้วย AI จากคลังเดิม + หลักโหราศาสตร์
-- แก้ปัญหาเนื้อหาปนหมวด: horoscope_transit เดิมเป็นย่อหน้ารวมทุกเรื่อง ตัดด้วย keyword ไม่เนียน
-- source: 'rewritten' = ตีความจากคำทำนายเดิม, 'generated' = เขียนใหม่จากความหมายดาว (แถวเดิมว่าง)
CREATE TABLE IF NOT EXISTS horoscope_transit_topics (
  aspecting_planet TEXT NOT NULL,
  aspect           TEXT NOT NULL,
  aspected_planet  TEXT NOT NULL,
  topic            TEXT NOT NULL CHECK (topic IN ('love','work','money')),
  prediction       TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'generated',
  model            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (aspecting_planet, aspect, aspected_planet, topic)
);
