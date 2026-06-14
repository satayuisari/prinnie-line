// ผูกดวงคู่ (synastry) — มุมระหว่างดาวของคน A (ดวงคุณ) กับดาวของคน B (คู่)
// ใช้ matchAspect ชุดเดียวกับดวงจร ชื่อ aspect/planet ตรงกับตาราง horoscope_synastry
const db = require('../db');
const { matchAspect } = require('../astro/aspects');
const { stripHtml } = require('./horoscopeService');

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

// อ่านคำทำนายดวงคู่ — เอาเฉพาะมุมที่มีเนื้อหาจริง (สูงสุด limit ข้อ)
async function synastryReading(chartA, chartB, limit = 5) {
  const aspects = synastryAspects(chartA.planets, chartB.planets);
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
  return { aspects: readings, count: readings.length, has_content: readings.length > 0 };
}

module.exports = { synastryAspects, synastryReading };
