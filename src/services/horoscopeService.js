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
    // ซ่อมสระอำที่ถูกแยกส่วน: นิคหิต ◌ํ(U+0E4D) + สระอา า(U+0E32) → ำ(U+0E33)
    // content จาก editor เก่าเก็บ "นำ" เป็น "นํา" ทำให้ฟอนต์เพี้ยน (ครอบงํา/ทํา/นํา)
    // NFC ปกติซ่อมไม่ได้ (สระอำไม่มี canonical decomposition) → ต้อง replace เอง
    .replace(/ํา/g, 'ำ')
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

// หัวข้อพลังดาว (ไม่รวมคำทำนาย) — ใช้ทำ teaser ล่อสมาชิก: โชว์ว่าดวงคำนวณแล้ว แต่ล็อกเนื้อหา
function aspectHeadlines(aspects) {
  return (aspects || []).map(a => {
    const emoji = PLANET_EMOJI[a.aspecting_planet] || '🌟';
    const name  = PLANET_TH[a.aspecting_planet] || a.aspecting_planet;
    const rel   = a.aspected_planet
      ? ` ${ASPECT_TH[a.aspect] || ''} ${PLANET_TH[a.aspected_planet] || a.aspected_planet}`.replace(/\s+/g, ' ').trimEnd()
      : '';
    return `${emoji} พลัง${name}${rel}`;
  });
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

  // กันดวงซ้ำทุกวัน: ดาวช้า (อาทิตย์ทำมุมกับดาวนอก เช่น พลูโต/เสาร์) ค้างในออร์บได้หลายวัน
  //   ฉาก (Square) ออร์บ 3° + อาทิตย์เดิน ~1°/วัน → "อาทิตย์ฉากพลูโต" ค้าง ~6 วัน
  // เดิมเทียบ "ทั้งชุด" ว่าตรงเมื่อวานไหม — แต่จันทร์ (เร็ว) เปลี่ยนทุกวัน ชุดเลยไม่มีทางตรง
  //   → มุมอาทิตย์ที่ค้างโผล่ซ้ำทุกวัน. แก้เป็นกรอง "เฉพาะมุมที่เพิ่งเข้าใหม่วันนี้ (ไม่มีเมื่อวาน)"
  //   มุมช้าที่ค้าง = มีเมื่อวานด้วย → ตัดออก (โชว์แค่วันแรกที่เข้า)  ·  มุมจันทร์ใหม่ = โชว์ต่อ
  const key = a => `${a.aspecting_planet}-${a.aspect}-${a.aspected_planet}`;
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prev    = await transitReading(chart, prevDate, DAILY_PLANETS, 3);
  const prevSet = new Set(prev.map(key));
  const shown   = aspects.filter(a => !prevSet.has(key(a)));   // เอาเฉพาะมุมที่ไม่มีเมื่อวาน
  const calm    = shown.length === 0;
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

// ===== ดวงรายวันแยกหัวข้อ (การงาน/ความรัก/การเงิน) — ไม่มีไพ่ (มีเมนูไพ่แยกแล้ว) =====
// ใช้ดาวจรเร็ว (จันทร์/อาทิตย์ เปลี่ยนทุกวัน) แต่กรองเฉพาะมุมที่ไปแตะ "ดาวเรื่องนั้น" ในดวงเกิด
//   → ได้ความหลากหลายรายวัน + เจาะเรื่องนั้นจริง (ต่างจากดวงรวม)
// ดาวจรตามช่วงเวลา (เร็ว→ยาว) — รายวันใช้ดาวเร็ว, รายปีใช้ดาวนอก
const PERIOD_TRANSIT = {
  daily:   ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'],
  weekly:  ['Mercury', 'Venus', 'Sun'],
  monthly: ['Mars', 'Jupiter'],
  annual:  ['Saturn', 'Neptune', 'Pluto'],
};
// จัดเรื่องตาม "ดาวจร" (ตัวกระตุ้น = ตัวกำหนดโทนคำทำนาย) + ดาวกำเนิด ต้องเข้าธีมทั้งคู่
//   transit = ดาวจรที่ให้โทนตรงเรื่อง (กันงานไปโผล่ความรัก) · natal = จุดในดวงที่โดนกระตุ้น
const TOPIC_CFG = {
  love:  { transit: ['Venus', 'Moon', 'Neptune'],        natal: ['Venus', 'Moon', 'Sun', 'Mars', 'Neptune'],     label: 'ความรัก', emoji: '💖' },
  work:  { transit: ['Mars', 'Mercury', 'Sun', 'Saturn', 'Moon'], natal: ['Mars', 'Mercury', 'Sun', 'Saturn', 'Jupiter'], label: 'การงาน', emoji: '💼' },
  money: { transit: ['Jupiter', 'Venus', 'Saturn', 'Pluto', 'Moon'], natal: ['Jupiter', 'Venus', 'Saturn', 'Pluto', 'Sun'], label: 'การเงิน', emoji: '💰' },
};
// คำ "นอกเรื่อง" ของแต่ละหมวด → ถ้าเจอในคำทำนายให้ตัดทิ้งจากตรงนั้น (คำทำนายเป็นย่อหน้าเดียวยาว มักไหลออกนอกเรื่องช่วงท้าย)
// ระวังคำสั้นที่ซ้อนในคำหมวดตัวเอง: ใช้ 'ทำงาน' ไม่ใช่ 'งาน' (ไม่งั้นไปโดน "แต่งงาน" ในหมวดความรัก)
const TOPIC_OFF = {
  love:  ['การเงิน', 'การลงทุน', 'ลงทุน', 'อาชีพ', 'การงาน', 'ทำงาน', 'ธุรกิจ', 'กำไร', 'เงินทอง', 'ผลงาน', 'หัวหน้า', 'เจ้านาย', 'เพื่อนร่วมงาน', 'ตำแหน่ง'],
  work:  ['ความรัก', 'คนรัก', 'เนื้อคู่', 'โรแมนติก', 'เพศตรงข้าม', 'แต่งงาน', 'เสน่ห์', 'การเงิน', 'การลงทุน', 'ลงทุน', 'กำไร'],
  money: ['ความรัก', 'คนรัก', 'เนื้อคู่', 'โรแมนติก', 'เพศตรงข้าม', 'แต่งงาน', 'ตำแหน่ง', 'เจ้านาย', 'หัวหน้า', 'เพื่อนร่วมงาน'],
};
// คำ "ในเรื่อง" ของแต่ละหมวด — ข้อความต้องพูดถึงเรื่องนั้นจริงถึงจะใช้ได้ (positive gate)
// บล็อกคำนอกเรื่องอย่างเดียวไล่ไม่ทัน: 15/07 ดวง "อารมณ์รัก/เสน่หา/คบใครผิวเผิน" หลุดไปโผล่
// ใต้การเงิน เพราะไม่มีคำต้องห้ามตรงตัวสักคำ — ต่อไปนี้ไม่มีคำเรื่องเงิน = ไม่ลงหมวดเงิน
//   รัก(?!ษ)   กัน "รักษา/อนุรักษ์"   ·   งาน กัน "แต่งงาน/งานรื่นเริง/งานเลี้ยง/งานอดิเรก"
const TOPIC_ON = {
  love:  /รัก(?!ษ)|ความสัมพันธ์|คู่รัก|คู่ครอง|เนื้อคู่|ดวงคู่|แฟน|เสน่ห|หัวใจ|โรแมนติก|คนพิเศษ|คนรู้ใจ/,
  work:  /(?<!แต่ง)งาน(?!รื่นเริง|เลี้ยง|อดิเรก)|อาชีพ|ธุรกิจ|เจ้านาย|หัวหน้า|ตำแหน่ง|ความรับผิดชอบ|วางแผน|เจรจา|ทีม|โครงการ|ประชุม|การค้า/,
  money: /เงิน|ทรัพย์|รายได้|ลงทุน|โชคลาภ|ค่าใช้จ่าย|หนี้|กำไร|ผลตอบแทน|มรดก|ซื้อขาย|การเงิน|ร่ำรวย|มั่งคั่ง/,
};
// ตัดคำทำนายให้อยู่ในเรื่องเดียว: หยุดตรงคำนอกเรื่องแรก + จำกัดความยาว + เก็บกวาดคำเชื่อมห้อยท้าย
// เปิดเรื่องมาก็นอกเรื่องแล้ว (เจอคำนอกเรื่องก่อน MIN) → คืน '' ให้ข้ามมุมนี้ไปเลย
// ดีกว่าฝืนโชว์เนื้องานใต้หัวข้อความรัก (ปัญหาจริงที่เจอ 13-14/07)
function focusTopicText(text, topic, maxLen = 320) {
  const off = TOPIC_OFF[topic] || [];
  const MIN = 90;                                  // เก็บลีดอย่างน้อยเท่านี้ก่อนยอมตัด
  let cut = text.length;
  for (const kw of off) {
    const i = text.indexOf(kw);
    if (i >= 0 && i < MIN) return '';              // ลีดนอกเรื่อง → ไม่ใช้กับหมวดนี้
    if (i >= MIN && i < cut) cut = i;
  }
  let s = text.slice(0, cut).trim();
  if (s.length > maxLen) {                          // ยังยาวไป → ตัดที่ช่องว่างก่อน maxLen
    const sp = s.lastIndexOf(' ', maxLen);
    s = s.slice(0, sp > MIN ? sp : maxLen).trim();
  }
  s = s.replace(/[\s“"'(]*(รวมไปถึง|รวมทั้ง|และ|แต่|หรือ|อีกทั้ง|นอกจากนี้|ตลอดจน|ซึ่ง|โดย)\s*$/, '').trim();
  // gate สุดท้าย: ข้อความที่จะโชว์ต้องมีคำในเรื่องนั้นจริง ไม่งั้นถือว่าไม่มีเนื้อหาหมวดนี้
  if (TOPIC_ON[topic] && !TOPIC_ON[topic].test(s)) return '';
  return s;
}
// skip = เซ็ตของ key คู่ดาวที่ช่องก่อนหน้าใช้ไปแล้ว → กันเนื้อหาเดียวกันโผล่ซ้ำข้ามเรื่อง
const aspectKey = a => `${a.aspecting_planet}-${a.aspect}-${a.aspected_planet}`;
async function topicReading(topic, chart, date = new Date(), transitPlanets = PERIOD_TRANSIT.daily, skip = null) {
  const cfg = TOPIC_CFG[topic] || TOPIC_CFG.love;
  const transiting = transitingPositions(date);
  let cand = transitAspects(transiting, chart.planets).filter(a =>
    transitPlanets.includes(a.aspecting_planet) &&   // ดาวจรอยู่ในช่วงเวลานี้
    cfg.transit.includes(a.aspecting_planet) &&      // ...และให้โทนตรงเรื่อง
    cfg.natal.includes(a.aspected_planet) &&         // จุดกำเนิดที่โดนก็เข้าธีม
    !(skip && skip.has(aspectKey(a))));              // ไม่ซ้ำกับเรื่องก่อนหน้า

  // รายวัน: กันข้อความซ้ำข้ามวัน — มุมดาวช้า (พุธ/ศุกร์/อังคาร ออร์บค้างได้หลายวัน-หลายสัปดาห์)
  // โชว์เฉพาะ "วันแรกที่มุมเข้า" เหมือน dailyReading (บั๊กจริง: การงาน 13-14/07 ขึ้นข้อความเดิมเป๊ะ)
  // จันทร์เคลื่อน ~13°/วัน มุมอยู่ไม่ถึงวัน → ผ่านตัวกรองเสมอ = แหล่งความสดรายวัน
  if (transitPlanets === PERIOD_TRANSIT.daily) {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevSet = new Set(transitAspects(transitingPositions(prevDate), chart.planets).map(aspectKey));
    cand = cand.filter(a => !prevSet.has(aspectKey(a)));
  }
  cand.sort((a, b) => (b.exactness || 0) - (a.exactness || 0));   // มุมแม่นสุดขึ้นก่อน
  const aspects = [];
  for (const a of cand) {
    const r = await db.query(
      `SELECT prediction FROM horoscope_transit WHERE aspecting_planet=$1 AND aspect=$2 AND aspected_planet=$3`,
      [a.aspecting_planet, a.aspect, a.aspected_planet]);
    const raw  = r.rows[0] ? stripHtml(r.rows[0].prediction) : '';
    const text = raw ? focusTopicText(raw, topic) : '';
    if (text) {
      aspects.push({ ...a, text });
      if (skip) skip.add(aspectKey(a));
      if (aspects.length >= 2) break;
    }
  }
  return { topic, label: cfg.label, emoji: cfg.emoji, aspects, has_content: aspects.length > 0 };
}

module.exports = {
  natalReading, dailyReading, periodReading, topicReading, tarotByType, TOPIC_CFG, PERIOD_TRANSIT,
  stripHtml, aspectBlocks, aspectHeadlines, classifyDayTheme, tarotHeading, THEME_TH,
};
