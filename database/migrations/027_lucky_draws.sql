-- จับรางวัลดูดวงฟรีกับอาจารย์ 1 ชั่วโมง — จับทุก 2 สัปดาห์
--
-- เก็บผลจับทุกครั้งไว้ในตาราง ไม่ใช่แค่ประกาศแล้วทิ้ง เพราะกติกาบอกว่า
-- คนที่เคยได้แล้วไม่ได้ซ้ำ ถ้าไม่บันทึกก็กันซ้ำไม่ได้ และเมื่อมีคนถามว่า
-- "จับยังไง โกงหรือเปล่า" เราต้องชี้ย้อนได้ว่ารอบไหนใช้เกณฑ์อะไร seed อะไร
-- มีผู้มีสิทธิ์กี่คน — การจับที่ตรวจสอบย้อนได้คือสิ่งที่ทำให้รางวัลน่าเชื่อ

CREATE TABLE IF NOT EXISTS lucky_draws (
  id             SERIAL PRIMARY KEY,
  round          INTEGER NOT NULL,             -- รอบที่ 1, 2, 3, …
  drawn_at       TIMESTAMP NOT NULL DEFAULT NOW(),

  -- เกณฑ์ของรอบนั้น เก็บไว้กับผลเลย เพราะกติกาเปลี่ยนได้ (รอบแรก 14 วัน
  -- รอบถัดไป 1 เดือน) และผลต้องอ่านออกโดยไม่ต้องไปขุดว่าตอนนั้นกติกาคืออะไร
  min_member_days INTEGER NOT NULL,
  paid_before     TIMESTAMP,                   -- รอบแรก: นับเฉพาะคนจ่ายก่อนวันนี้ (ช่วงแรก)
  seed            TEXT NOT NULL,               -- ใส่ซ้ำแล้วได้ผลเดิม — พิสูจน์ได้ว่าไม่ได้เลือกเอง
  eligible_count  INTEGER NOT NULL,

  -- ผู้ได้รางวัล
  winner_line_user_id TEXT NOT NULL,
  winner_display_name TEXT,

  -- เดินเรื่องต่อหลังจับ
  status         TEXT NOT NULL DEFAULT 'DRAWN'
    CHECK (status IN ('DRAWN', 'CONTACTED', 'SCHEDULED', 'COMPLETED', 'FORFEITED')),
  session_at     TIMESTAMP,                    -- นัดดูดวงเมื่อไร
  feedback       TEXT,                         -- ความเห็นหลังดูจบ (ขอทางไลน์ ไม่บังคับ)
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_lucky_draws_winner ON lucky_draws(winner_line_user_id);
