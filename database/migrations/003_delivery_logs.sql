-- Log การส่ง LINE message ทุกครั้ง

CREATE TABLE IF NOT EXISTS delivery_logs (
  id            SERIAL PRIMARY KEY,
  subscriber_id INTEGER REFERENCES line_subscribers(id) ON DELETE CASCADE,
  message_type  VARCHAR(50),   -- 'daily', 'natal', 'welcome'
  status        VARCHAR(20)    CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  sent_at       TIMESTAMP      DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_subscriber ON delivery_logs(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_delivery_sent_at    ON delivery_logs(sent_at);
