-- ค่าตั้งที่แอดมินแก้ได้จากแดชบอร์ด (V1 ใช้เก็บข้อความทาบทามอินฟลู)
-- ห้ามเก็บ token/ความลับในตารางนี้ — ความลับอยู่ใน env เท่านั้น
--
-- ROLLBACK: DROP TABLE IF EXISTS app_settings;
--           DELETE FROM schema_migrations WHERE filename='021_app_settings.sql';
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
