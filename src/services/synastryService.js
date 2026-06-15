// ผูกดวงคู่ (synastry) — มุมระหว่างดาวของคน A (ดวงคุณ) กับดาวของคน B (คู่)
// ใช้ matchAspect ชุดเดียวกับดวงจร ชื่อ aspect/planet ตรงกับตาราง horoscope_synastry
const db = require('../db');
const { matchAspect } = require('../astro/aspects');
const { stripHtml } = require('./horoscopeService');

// ── คะแนนความเข้ากัน (0–100) — ใช้ใน teaser ──
// น้ำหนักประเภทมุม: บวก=เข้ากัน, ลบ=ท้าทาย (opposition ลบน้อย เพราะดึงดูด+ตึง)
const ASPECT_W = {
  Conjunction: +1.0, Trine: +1.0, Sextile: +0.7, 'Semi-sextile': +0.2,
  Opposition: -0.5, Square: -0.8, Quincunx: -0.4, 'Semi-Square': -0.4,
};
// ดาวเรื่องความรัก/ตัวตน (Sun/Moon/Venus/Mars) ถ่วงหนักสุด
const PLANET_W = {
  Sun: 1.5, Moon: 1.5, Venus: 1.5, Mars: 1.3, Mercury: 1.0, Jupiter: 1.0,
  Saturn: 0.7, Uranus: 0.5, Neptune: 0.5, Pluto: 0.5,
};

// คะแนน % จากชุดมุมทั้งหมด — deterministic, อยู่ในช่วง 55–95% (กันเลขต่ำจนหมดอารมณ์)
function compatibilityScore(aspects) {
  let pos = 0, neg = 0;
  for (const a of aspects) {
    const w  = ASPECT_W[a.aspect] || 0;
    const pw = ((PLANET_W[a.aspecting_planet] || 0.6) + (PLANET_W[a.aspected_planet] || 0.6)) / 2;
    const strength = (0.4 + a.exactness) * pw;   // ความแน่นของมุม × ความสำคัญดาว
    const val = w * strength;
    if (val >= 0) pos += val; else neg += Math.abs(val);
  }
  const ratio = (pos + neg) === 0 ? 0.5 : pos / (pos + neg);
  return Math.round(55 + ratio * 40);
}

// มุมทั้งหมดระหว่างดาวคน A กับดาวคน B (เรียงแม่นสุดก่อน)
function synastryAspects(planetsA, planetsB) {
  const res = [];
  for (const pa of Object.keys(planetsA)) {
    for (const pb of Object.keys(planetsB)) {
      const m = matchAspect(planetsA[pa].longitude, planetsB[pb].longitude);
      if (m) {
        res.push({
          aspecting_planet: pa,   // ดาวของคุณ
          aspect:           m.aspect,
          aspected_planet:  pb,   // ดาวของคู่
          exactness:        m.exactness,
        });
      }
    }
  }
  return res.sort((a, b) => b.exactness - a.exactness);
}

// อ่านคำทำนายดวงคู่ + คะแนน — คะแนนคิดจากมุม "ทั้งหมด", คำทำนายเอาเฉพาะมุมที่มีเนื้อหา (limit ข้อ)
async function synastryReading(chartA, chartB, limit = 5) {
  const aspects = synastryAspects(chartA.planets, chartB.planets);
  const score   = compatibilityScore(aspects);   // จากมุมทั้งหมด ไม่ใช่แค่ที่มีคำทำนาย

  const readings = [];
  for (const a of aspects) {
    const r = await db.query(
      `SELECT prediction FROM horoscope_synastry
       WHERE aspecting_planet = $1 AND aspect = $2 AND aspected_planet = $3`,
      [a.aspecting_planet, a.aspect, a.aspected_planet]
    );
    const text = r.rows[0] ? stripHtml(r.rows[0].prediction) : '';
    if (text) {
      readings.push({ ...a, text });
      if (readings.length >= limit) break;
    }
  }
  return { score, aspects: readings, count: readings.length, has_content: readings.length > 0 };
}

// มุม "ดี" สำหรับเลือกมาโชว์ teaser ให้ล่อใจ
const HARMONIOUS = new Set(['Trine', 'Sextile', 'Conjunction', 'Semi-sextile']);

// เลือก 1 บรรทัดมาโชว์ teaser — เอามุมดีที่เด่นสุดก่อน ไม่มีค่อยเอาอันแรก
function pickTeaser(readings) {
  if (!readings || !readings.length) return null;
  const good = readings.find(a => HARMONIOUS.has(a.aspect));
  const a = good || readings[0];
  return { aspect: `${a.aspecting_planet}-${a.aspect}-${a.aspected_planet}`, text: a.text };
}

// จัดข้อความผลเต็มสำหรับ push เข้าแชท (หลังจ่าย 149 / สมาชิก)
function formatFull(result, partnerName) {
  const lines = [`💞 ดวงคู่: คุณ × ${partnerName || 'คู่ของคุณ'}`, `เข้ากัน ${result.score}%`, ''];
  if (result.aspects && result.aspects.length) {
    result.aspects.forEach(a => lines.push(`✨ ${a.text}`, ''));
  } else {
    lines.push('ดวงของคุณสองคนค่อนข้างเป็นกลาง ไม่มีมุมเด่นพิเศษระหว่างกัน', '');
  }
  return lines.join('\n').trim().slice(0, 4900);
}

module.exports = { synastryAspects, synastryReading, compatibilityScore, pickTeaser, formatFull };
