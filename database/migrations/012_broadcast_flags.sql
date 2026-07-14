-- กันบรอดแคสต์ยิงซ้ำ (idempotent) — scheduler เคลม key ก่อนยิง ถ้ามีแล้ว = เคยยิงแล้ว ข้าม
CREATE TABLE IF NOT EXISTS broadcast_flags (
  key     TEXT PRIMARY KEY,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);
