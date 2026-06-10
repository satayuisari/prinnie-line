-- Content tables — import จาก JSON ที่ export มาจาก Prinnie333 (static, นิ่งตั้งแต่ 2021)
-- ใช้เป็น "พจนานุกรมคำทำนาย" — ระบบ query จากตรงนี้

-- ดาว x ราศี  (Sun in Leo, Moon in Cancer, ...)
CREATE TABLE IF NOT EXISTS horoscope_western (
  id            SERIAL PRIMARY KEY,
  planetary     VARCHAR(20)  NOT NULL,   -- Sun, Moon, Mercury, ...
  constellation VARCHAR(20)  NOT NULL,   -- Aries, Taurus, ...
  prediction    TEXT,
  UNIQUE (planetary, constellation)
);

-- ลัคนา (ราศีที่ขึ้นตอนเกิด)
CREATE TABLE IF NOT EXISTS horoscope_lakkana (
  id            SERIAL PRIMARY KEY,
  constellation VARCHAR(20)  UNIQUE NOT NULL,
  prediction    TEXT
);

-- จรดาว (transit) — ใช้ทำดวงรายวัน: ดาวจรวันนี้ทำมุมกับดาวกำเนิด
CREATE TABLE IF NOT EXISTS horoscope_transit (
  id              SERIAL PRIMARY KEY,
  aspecting_planet VARCHAR(20) NOT NULL,  -- ดาวจร
  aspect          VARCHAR(30)  NOT NULL,  -- Conjunction, Trine, Square, ...
  aspected_planet VARCHAR(20)  NOT NULL,  -- ดาวกำเนิด
  prediction      TEXT,
  UNIQUE (aspecting_planet, aspect, aspected_planet)
);

-- ความเข้ากันคู่รัก (synastry)
CREATE TABLE IF NOT EXISTS horoscope_synastry (
  id              SERIAL PRIMARY KEY,
  aspecting_planet VARCHAR(20) NOT NULL,
  aspect          VARCHAR(30)  NOT NULL,
  aspected_planet VARCHAR(20)  NOT NULL,
  prediction      TEXT,
  UNIQUE (aspecting_planet, aspect, aspected_planet)
);

-- เลขศาสตร์ (life path 1-9)
CREATE TABLE IF NOT EXISTS horoscope_numerology (
  id          SERIAL PRIMARY KEY,
  aggregate   VARCHAR(5) UNIQUE NOT NULL,  -- "1".."9"
  prediction  TEXT
);

-- ไพ่ทาโรต์ (master)
CREATE TABLE IF NOT EXISTS tarot (
  id          SERIAL PRIMARY KEY,
  ext_id      VARCHAR(50),                -- id เดิมจากเว็บ (ใช้ join กับ horoscope_tarot)
  name        VARCHAR(255),
  image_id    VARCHAR(100),
  deck        VARCHAR(20),                -- free, love, paid
  description  TEXT
);

-- คำทำนายไพ่ (ผูกกับ tarot ผ่าน tarot_card_map = tarot.ext_id)
CREATE TABLE IF NOT EXISTS horoscope_tarot (
  id            SERIAL PRIMARY KEY,
  tarot_card_map VARCHAR(50),             -- อ้างถึง tarot.ext_id
  type          VARCHAR(20),              -- free, weekly
  description    TEXT
);

CREATE INDEX IF NOT EXISTS idx_western_lookup  ON horoscope_western(planetary, constellation);
CREATE INDEX IF NOT EXISTS idx_transit_lookup  ON horoscope_transit(aspecting_planet, aspect, aspected_planet);
CREATE INDEX IF NOT EXISTS idx_tarot_ext_id    ON tarot(ext_id);
CREATE INDEX IF NOT EXISTS idx_htarot_map       ON horoscope_tarot(tarot_card_map, type);
