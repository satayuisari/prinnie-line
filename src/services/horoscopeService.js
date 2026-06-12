const db = require('../db');
const { transitingPositions } = require('../astro/natalChart');
const { transitAspects } = require('../astro/aspects');

// content เก็บเป็น HTML (Quill) — แปลงเป็น plain text สำหรับ LINE
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ===== ดวงกำเนิด (natal / พื้นดวง) =====
async function natalReading(chart) {
  const sections = {};

  // อาทิตย์ / จันทร์ ในราศี
  sections.sun  = await westernText('Sun',  chart.sun);
  sections.moon = await westernText('Moon', chart.moon);

  // ลัคนา
  if (chart.rising) {
    const r = await db.query(
      'SELECT prediction FROM horoscope_lakkana WHERE constellation = $1', [chart.rising]
    );
    sections.rising = r.rows[0] ? stripHtml(r.rows[0].prediction) : null;
  }

  // เลขศาสตร์
  const num = await db.query(
    'SELECT prediction FROM horoscope_numerology WHERE aggregate = $1', [String(chart.life_path)]
  );
  sections.numerology = num.rows[0] ? stripHtml(num.rows[0].prediction) : null;

  return {
    sun_sign:  chart.sun,
    moon_sign: chart.moon,
    rising_sign: chart.rising,
    life_path: chart.life_path,
    sections,
  };
}

async function westernText(planet, sign) {
  const r = await db.query(
    'SELECT prediction FROM horoscope_western WHERE planetary = $1 AND constellation = $2',
    [planet, sign]
  );
  return r.rows[0] ? stripHtml(r.rows[0].prediction) : null;
}

// ===== ดาวจร (transit) =====
// แยกดาวตามความเร็ว → ใช้กำหนดช่วงเวลา
//   ดาวเร็ว (จันทร์/อาทิตย์/พุธ/ศุกร์/อังคาร) เปลี่ยนมุมรายวัน → ดวงรายวัน
//   ดาวกลาง (อาทิตย์..พฤหัส) → รายเดือน
//   ดาวช้า (พฤหัส/เสาร์/ยูเรนัส/เนปจูน/พลูโต) อิทธิพลยาว → รายปี
const FAST   = ['Moon', 'Sun', 'Mercury', 'Venus', 'Mars'];
const MEDIUM = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter'];
const SLOW   = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

// คำนวณมุมดาวจร→ดาวกำเนิด เฉพาะดาวใน planetFilter แล้วดึงคำทำนายที่มีเนื้อหา
async function transitReading(chart, date, planetFilter, limit = 3) {
  const transiting = transitingPositions(date);
  let aspects = transitAspects(transiting, chart.planets);
  if (planetFilter) aspects = aspects.filter(a => planetFilter.includes(a.aspecting_planet));

  const readings = [];
  for (const a of aspects) {
    const r = await db.query(
      `SELECT prediction FROM horoscope_transit
       WHERE aspecting_planet = $1 AND aspect = $2 AND aspected_planet = $3`,
      [a.aspecting_planet, a.aspect, a.aspected_planet]
    );
    const text = r.rows[0] ? stripHtml(r.rows[0].prediction) : '';
    if (text) {
      readings.push({ ...a, text });
      if (readings.length >= limit) break;
    }
  }
  return readings;
}

// ไพ่ตามช่วง (free/weekly/monthly/annual)
async function tarotByType(type) {
  const r = await db.query(
    `SELECT h.description, t.name
     FROM horoscope_tarot h
     LEFT JOIN tarot t ON t.ext_id = h.tarot_card_map
     WHERE h.type = $1 AND h.description <> ''
     ORDER BY random() LIMIT 1`,
    [type]
  );
  if (!r.rows[0]) return null;
  return { name: r.rows[0].name || 'ไพ่ประจำช่วง', text: stripHtml(r.rows[0].description) };
}

// ===== ดวงรายวัน = ดาวเร็วทำมุมวันนี้ + ไพ่ =====
async function dailyReading(chart, date = new Date()) {
  const aspects = await transitReading(chart, date, FAST, 3);
  const tarot   = await tarotByType('free');
  return { date: date.toISOString().slice(0, 10), aspects, tarot, has_content: aspects.length > 0 };
}

// ===== รายสัปดาห์/เดือน/ปี = ดาวจร (ตามชุดความเร็ว) + ไพ่ประจำช่วง =====
const PERIOD_CFG = {
  weekly:  { planets: FAST,   tarot: 'weekly'  },
  monthly: { planets: MEDIUM, tarot: 'monthly' },
  annual:  { planets: SLOW,   tarot: 'annual'  },
};
async function periodReading(period, chart, date = new Date()) {
  const cfg     = PERIOD_CFG[period] || PERIOD_CFG.monthly;
  const aspects = await transitReading(chart, date, cfg.planets, 3);
  const tarot   = await tarotByType(cfg.tarot);
  return { period, aspects, tarot, has_content: aspects.length > 0 || !!tarot };
}

module.exports = { natalReading, dailyReading, periodReading, tarotByType, stripHtml };
