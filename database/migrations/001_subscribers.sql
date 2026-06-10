-- LINE subscriber — standalone (ไม่พึ่ง users table เดิม)
-- เก็บทั้ง identity, birth data, chart ที่คำนวณแล้ว, และ subscription

CREATE TABLE IF NOT EXISTS line_subscribers (
  id                 SERIAL PRIMARY KEY,
  line_user_id       VARCHAR(50)  UNIQUE NOT NULL,
  display_name       VARCHAR(255),
  picture_url        TEXT,

  -- ข้อมูลเกิด (input จาก LIFF)
  nickname           VARCHAR(255),
  birth_date         DATE,                 -- 1990-01-31
  birth_time         TIME,                 -- 13:45  (เวลาท้องถิ่นไทย)
  birth_time_known   BOOLEAN DEFAULT TRUE, -- ถ้าไม่รู้เวลา → คำนวณลัคนา/จันทร์ไม่ได้แม่น
  birth_place        VARCHAR(255),
  birth_lat          NUMERIC(9,6),
  birth_lng          NUMERIC(9,6),

  -- natal chart ที่คำนวณแล้ว (cache ไว้ ไม่ต้องคำนวณซ้ำ)
  chart_data         JSONB,                -- { sun, moon, rising, planets:{}, life_path }

  -- subscription (จัดการเอง)
  status             VARCHAR(20) DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED')),
  subscribe_start    TIMESTAMP,
  subscribe_end      TIMESTAMP,
  payment_ref        VARCHAR(255),

  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_line_user_id ON line_subscribers(line_user_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_status       ON line_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_sub_end      ON line_subscribers(subscribe_end);
