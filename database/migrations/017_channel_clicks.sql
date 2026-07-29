-- นับคลิกลิงก์แอดเพื่อนแยกช่องทาง (YouTube/TikTok/FB/…) — วัดว่าคนใหม่มาจากไหน
-- 1 แถวต่อ (source, วัน) → เทียบกับยอดแอดใหม่รายวันได้ว่าช่องไหนพาคนมาจริง
CREATE TABLE IF NOT EXISTS channel_clicks (
  source     TEXT NOT NULL,
  click_date DATE NOT NULL DEFAULT CURRENT_DATE,
  clicks     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source, click_date)
);
