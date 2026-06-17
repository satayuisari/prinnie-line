-- แคมเปญ follow-up: ติดตามว่าผู้ที่กรอกดวงแล้วแต่ยังไม่จ่าย ได้รับ nudge ถึงขั้นไหน
-- 0 = ยังไม่เคย, 1 = ส่งตัวอย่างดวงรายวัน, 2 = teaser ดวงคู่, 3 = เตือน early-bird
ALTER TABLE line_subscribers ADD COLUMN IF NOT EXISTS nudge_stage INT DEFAULT 0;
