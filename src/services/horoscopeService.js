const db = require('../db');
const { transitingPositions } = require('../astro/natalChart');
const { transitAspects } = require('../astro/aspects');

// content เก็บเป็น HTML (Quill) — แปลงเป็น plain text สำหรับ LINE
// Quill ใส่ typographic entities (&ldquo; &rdquo; &hellip; ฯลฯ) — LINE ไม่ render HTML
// ต้อง decode เป็นตัวอักษรจริง ไม่งั้นโชว์ดิบ
const NAMED_ENTITIES = {
  nbsp: ' ', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  hellip: '…', mdash: '—', ndash: '–', quot: '"', apos: "'",
  lt: '<', gt: '>', laquo: '«', raquo: '»', deg: '°',
};
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => {
      const k = NAMED_ENTITIES[name.toLowerCase()];
      return k !== undefined ? k : m;
    })
    .replace(/&amp;/g, '&'); // decode สุดท้าย กัน double-decode
}
function stripHtml(html) {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
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

// ===== ป้ายกำกับพลังดาว (ใช้ทำหัวข้อ + ตัวคั่นในข้อความดวง) =====
// แต่ละมุมดาว = พลังคนละตัว → ใส่อีโมจิประจำดาว + ตัวคั่น ให้ผู้อ่านแยกหัวข้อออก
const PLANET_EMOJI = {
  Sun: '☀️', Moon: '🌙', Mercury: '💫', Venus: '💖', Mars: '🔥',
  Jupiter: '🍀', Saturn: '⏳', Neptune: '🌊', Pluto: '🌑',
};
const PLANET_TH = {
  Sun: 'อาทิตย์', Moon: 'จันทร์', Mercury: 'พุธ', Venus: 'ศุกร์', Mars: 'อังคาร',
  Jupiter: 'พฤหัส', Saturn: 'เสาร์', Neptune: 'เนปจูน', Pluto: 'พลูโต',
};
const ASPECT_TH = {
  Conjunction: 'ร่วม', 'Semi-sextile': 'กึ่งโยน', 'Semi-Square': 'กึ่งฉาก',
  Sextile: 'โยน', Square: 'ฉาก', Trine: 'ตรีโกณ', Quincunx: 'ปรับมุม', Opposition: 'เล็ง',
};
const ASPECT_DIVIDER = '➖➖➖➖➖➖';

// แปลง array มุมดาว → บรรทัดข้อความ: หัวข้อพลังดาว (อีโมจิ+ชื่อไทย) + เนื้อหา + ตัวคั่นระหว่างพลัง
function aspectBlocks(aspects) {
  const lines = [];
  aspects.forEach((a, i) => {
    if (i > 0) lines.push('', ASPECT_DIVIDER, '');   // ตัวคั่น = พลังดาวคนละตัว
    const emoji = PLANET_EMOJI[a.aspecting_planet] || '🌟';
    const name  = PLANET_TH[a.aspecting_planet] || a.aspecting_planet;
    const rel   = a.aspected_planet
      ? ` ${ASPECT_TH[a.aspect] || ''} ${PLANET_TH[a.aspected_planet] || a.aspected_planet}`.replace(/\s+/g, ' ').trimEnd()
      : '';
    lines.push(`${emoji} พลัง${name}${rel}`, a.text);
  });
  return lines;
}

// ===== ดาวจร (transit) =====
// แบ่งดาวตามความเร็ว → แต่ละช่วงใช้ "คนละชุด ไม่ทับกัน" (กันดวงแต่ละช่วงซ้ำกัน)
//   รายวัน  = อาทิตย์/จันทร์ (จันทร์เปลี่ยนทุกวัน)
//   รายสัปดาห์ = พุธ/ศุกร์
//   รายเดือน = อังคาร/พฤหัส
//   รายปี   = เสาร์/เนปจูน/พลูโต (ดาวนอก อิทธิพลยาวเป็นปี)
const DAILY_PLANETS   = ['Sun', 'Moon'];
const WEEKLY_PLANETS  = ['Mercury', 'Venus'];
const MONTHLY_PLANETS = ['Mars', 'Jupiter'];
const YEARLY_PLANETS  = ['Saturn', 'Neptune', 'Pluto'];

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

// ===== ไพ่อัจฉริยะตามดวงดาว =====
// วันนี้ดาวเด่นไปทางไหน → ดึงไพ่หมวดนั้น (การงาน/การเงิน/ความรัก)
// เรามีไพ่แยกหมวดใน horoscope_tarot.type: work / money / love (นอกจาก free/weekly/monthly/annual)
// แต่ละดาวมี "พลังประจำตัว" → รวมคะแนนจากดาวที่ทำมุมวันนี้ แล้วเลือกหมวดที่แรงสุด
const PLANET_THEME = {
  Venus:   { love: 1.0, money: 0.5 },   // ศุกร์ = ความรัก/เสน่ห์/เงินทอง
  Moon:    { love: 0.6 },               // จันทร์ = อารมณ์/ความสัมพันธ์
  Mars:    { work: 1.0 },               // อังคาร = แรงผลักดัน/การงาน
  Mercury: { work: 0.8, money: 0.3 },   // พุธ = การสื่อสาร/ค้าขาย
  Jupiter: { money: 1.0, work: 0.3 },   // พฤหัส = โชคลาภ/การเงิน
  Saturn:  { work: 0.8, money: 0.3 },   // เสาร์ = ความรับผิดชอบ/หน้าที่
  // Sun + ดาวนอก (Neptune/Pluto) = ภาพรวม ไม่ผูกหมวด → ไพ่ทั่วไป
};
const HARMONIOUS = new Set(['Trine', 'Sextile', 'Conjunction']);   // มุมดี = เน้นหมวดนั้นชัดขึ้น
const THEME_TH = { love: 'ความรัก', money: 'การเงิน', work: 'การงาน' };
const THEME_EMOJI = { love: '💖', money: '💰', work: '💼' };

// ชั่งคะแนนหมวดจากชุดมุมดาววันนี้ → คืนหมวดเด่น ('love'|'money'|'work') หรือ null (ไม่เด่น = ไพ่ทั่วไป)
function classifyDayTheme(aspects) {
  const score = { love: 0, money: 0, work: 0 };
  for (const a of aspects) {
    const qual = HARMONIOUS.has(a.aspect) ? 1.3 : 1.0;   // มุมดี → ดึงไพ่หมวดนั้นแน่นขึ้น
    const ex   = 1 + (a.exactness || 0);                  // มุมยิ่งแม่น (exactness สูง) ยิ่งมีน้ำหนัก
    for (const p of [a.aspecting_planet, a.aspected_planet]) {
      const themes = PLANET_THEME[p];
      if (!themes) continue;
      for (const t in themes) score[t] += themes[t] * qual * ex;
    }
  }
  const top = Object.keys(score).sort((x, y) => score[y] - score[x])[0];
  return top && score[top] >= 1.0 ? top : null;          // ต่ำกว่าเกณฑ์ = ไม่มีหมวดเด่น
}

// ไพ่ตามช่วง/หมวด (free/weekly/monthly/annual/work/money/love)
async function tarotByType(type) {
  const r = await db.query(
    `SELECT h.description, t.name, t.image_id
     FROM horoscope_tarot h
     LEFT JOIN tarot t ON t.ext_id = h.tarot_card_map
     WHERE h.type = $1 AND h.description <> ''
     ORDER BY random() LIMIT 1`,
    [type]
  );
  if (!r.rows[0]) return null;
  const image = r.rows[0].image_id
    ? `https://data.prinnie333.com/assets/${r.rows[0].image_id}`   // รูปไพ่เดิมจาก Directus
    : null;
  return { name: r.rows[0].name || 'ไพ่ประจำช่วง', text: stripHtml(r.rows[0].description), image };
}

// ลายเซ็นของชุดมุม (ใช้เทียบว่าดวงวันนี้เหมือนวันก่อนไหม)
// เรียงก่อน join → ชุดมุมเดิมที่สลับลำดับ (ดาวขยับเล็กน้อย) ก็ถือว่าซ้ำ
function aspectSig(aspects) {
  return aspects
    .map(a => `${a.aspecting_planet}-${a.aspect}-${a.aspected_planet}`)
    .sort()
    .join('|');
}

// ===== ดวงรายวัน = ดาวเร็วทำมุมวันนี้ + ไพ่ =====
async function dailyReading(chart, date = new Date()) {
  const aspects = await transitReading(chart, date, DAILY_PLANETS, 3);

  // 🃏 ไพ่ฉลาด: ดูว่าดาวที่ทำมุมวันนี้เอนไปทางใด (การงาน/การเงิน/ความรัก) → ดึงไพ่หมวดนั้น
  // ใช้ "มุมทั้งหมด" ของดาวรายวัน (ไม่กรองเฉพาะที่มีคำทำนาย) เพื่อจับธีมจริงของท้องฟ้า
  const transiting = transitingPositions(date);
  const rawDaily   = transitAspects(transiting, chart.planets)
    .filter(a => DAILY_PLANETS.includes(a.aspecting_planet));
  const theme = classifyDayTheme(rawDaily);
  const tarot = await tarotByType(theme || 'free') || await tarotByType('free');
  if (tarot) tarot.theme = theme;   // ให้ formatter ติดป้าย "ไพ่การเงินประจำวัน" ฯลฯ

  // กันดวงซ้ำ: อาทิตย์เคลื่อนช้า (~1°/วัน) มุมค้างได้หลายวัน
  // ถ้าชุดมุมวันนี้เหมือนเมื่อวานเป๊ะ → ถือว่า "ดวงนิ่ง" ไม่ส่งคำทำนายซ้ำ ส่งไพ่อย่างเดียว
  let calm = aspects.length === 0;
  if (!calm) {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prev = await transitReading(chart, prevDate, DAILY_PLANETS, 3);
    if (aspectSig(prev) === aspectSig(aspects)) calm = true;
  }

  const shown = calm ? [] : aspects;
  return {
    date: date.toISOString().slice(0, 10),
    aspects: shown,
    tarot,
    theme,
    calm,
    has_content: shown.length > 0,
  };
}

// ป้ายชื่อไพ่ตามหมวดของวัน — "🃏 ไพ่การเงินประจำวัน: ..." (default = ไพ่ประจำวัน)
function tarotHeading(theme) {
  return theme
    ? `${THEME_EMOJI[theme]} ไพ่${THEME_TH[theme]}ประจำวัน`
    : '🃏 ไพ่ประจำวัน';
}

// ===== รายสัปดาห์/เดือน/ปี = ดาวจร (ตามชุดความเร็ว) + ไพ่ประจำช่วง =====
const PERIOD_CFG = {
  weekly:  { planets: WEEKLY_PLANETS,  tarot: 'weekly'  },
  monthly: { planets: MONTHLY_PLANETS, tarot: 'monthly' },
  annual:  { planets: YEARLY_PLANETS,  tarot: 'annual'  },
};
async function periodReading(period, chart, date = new Date()) {
  const cfg     = PERIOD_CFG[period] || PERIOD_CFG.monthly;
  const aspects = await transitReading(chart, date, cfg.planets, 3);
  const tarot   = await tarotByType(cfg.tarot);
  return { period, aspects, tarot, has_content: aspects.length > 0 || !!tarot };
}

module.exports = {
  natalReading, dailyReading, periodReading, tarotByType,
  stripHtml, aspectBlocks, classifyDayTheme, tarotHeading, THEME_TH,
};
