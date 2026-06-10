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

// ===== ดวงรายวัน (transit) =====
// คำนวณดาวจรวันนี้ทำมุมกับดาวกำเนิด → ดึงคำทำนาย
async function dailyReading(chart, date = new Date()) {
  const transiting = transitingPositions(date);
  const aspects    = transitAspects(transiting, chart.planets);

  // ดึงคำทำนายของแต่ละมุม เลือกเฉพาะที่มีเนื้อหา
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
      if (readings.length >= 3) break;   // เอา 3 มุมที่แม่นที่สุดที่มีเนื้อหา
    }
  }

  // ไพ่ประจำวัน (สุ่ม)
  const tarot = await randomTarot();

  return {
    date: date.toISOString().slice(0, 10),
    aspects: readings,
    tarot,
    has_content: readings.length > 0,
  };
}

// ดวงตามช่วงเวลา (weekly/monthly/annual) จาก horoscope_tarot
// type ในข้อมูล: 'free' | 'weekly' | 'monthly' | 'annual'
async function periodReading(type) {
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

async function randomTarot() {
  const r = await db.query(
    `SELECT t.name, t.image_id, h.description
     FROM horoscope_tarot h
     LEFT JOIN tarot t ON t.ext_id = h.tarot_card_map
     WHERE h.type IN ('weekly', 'free') AND h.description <> ''
     ORDER BY random() LIMIT 1`
  );
  if (!r.rows[0]) return null;
  return { name: r.rows[0].name || 'ไพ่ประจำวัน', text: stripHtml(r.rows[0].description) };
}

module.exports = { natalReading, dailyReading, periodReading, stripHtml };
