// "ดวงเลือกคุณ" — หาสมาชิกที่ดาวจรเดือนนี้ทำมุมกับดวงกำเนิดแรงที่สุด
//
// ⚖️ ไม่มีการสุ่มในไฟล์นี้โดยตั้งใจ (ไม่มี Math.random)
//    ผลลัพธ์คำนวณจากตำแหน่งดาวจริง ณ วันที่กำหนด เทียบกับดวงกำเนิดที่เก็บไว้
//    รันซ้ำด้วยวันเดิม ต้องได้คนเดิมเสมอ → ตรวจสอบย้อนหลังได้ ไม่ใช่การเสี่ยงโชค
//
// ทำไมชั่งน้ำหนักดาวช้ามากกว่าดาวเร็ว:
//    จันทร์เคลื่อนรอบจักรราศีใน 28 วัน → ทำมุมกับดวงทุกคนทุกสัปดาห์ ไม่ได้บอกอะไร
//    เสาร์/พลูโตใช้เวลาหลายปี → มุมที่เกิดขึ้นคือจังหวะเปลี่ยนผ่านของชีวิตจริง
const db = require('../db');
const { transitingPositions } = require('../astro/natalChart');
const { transitAspects } = require('../astro/aspects');

const WEIGHT = {
  Saturn: 5, Pluto: 5, Uranus: 4, Neptune: 4, Jupiter: 3,
  Mars: 2, Sun: 1, Venus: 1, Mercury: 1, Moon: 0,
};
const MIN_WEIGHT = 3;                 // นับเฉพาะดาวช้า (พฤหัสขึ้นไป)
const COOLDOWN_MONTHS = 12;           // คนเดิมเว้น 12 เดือนถึงมีสิทธิ์อีก
const MIN_MEMBER_DAYS = Number(process.env.PICK_MIN_DAYS) || 14;
const REWARD = 'ดูดวงส่วนตัวกับ อ.ปรินนี่ 1 ชั่วโมง';
const EXPIRE_DAYS = Number(process.env.LOYALTY_EXPIRE_DAYS) || 60;

const cycleOf = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

// สมาชิกที่เข้าเกณฑ์: จ่ายจริง · ยังใช้งานอยู่ · เป็นสมาชิกครบ N วัน · มีดวงกำเนิด
// · ไม่เคยได้รับสิทธิ์ในรอบ COOLDOWN_MONTHS เดือนล่าสุด
async function eligibleMembers(at = new Date()) {
  return (await db.query(`
    SELECT s.line_user_id, s.nickname, s.display_name, s.chart_data
    FROM line_subscribers s
    WHERE s.status='ACTIVE'
      AND s.chart_data IS NOT NULL
      AND s.payment_ref IS NOT NULL
      AND s.payment_ref NOT IN ('tester','free-trial','free','founder')
      AND s.subscribe_start IS NOT NULL
      AND s.subscribe_start <= $1::timestamp - ($2 || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM loyalty_rewards r
        WHERE r.line_user_id = s.line_user_id
          AND r.cycle IS NOT NULL
          AND r.granted_at > $1::timestamp - ($3 || ' months')::interval
      )`,
    [at.toISOString(), String(MIN_MEMBER_DAYS), String(COOLDOWN_MONTHS)])).rows;
}

// ให้คะแนนหนึ่งคน: มุมที่แรงที่สุดจากดาวช้า × น้ำหนักของดาวดวงนั้น
function scoreMember(member, transits) {
  const planets = member.chart_data && member.chart_data.planets;
  if (!planets) return null;
  const aspects = transitAspects(transits, planets)
    .filter(a => (WEIGHT[a.aspecting_planet] || 0) >= MIN_WEIGHT);
  if (!aspects.length) return null;
  const top = aspects[0];
  return {
    line_user_id: member.line_user_id,
    name: member.nickname || member.display_name || null,
    score: Math.round(top.exactness * WEIGHT[top.aspecting_planet] * 100) / 100,
    detail: `${top.aspecting_planet} ${top.aspect} ${top.aspected_planet}`,
    aspect: top,
  };
}

// จัดอันดับสมาชิกทั้งหมดสำหรับวันที่กำหนด — ใช้ทั้งตอนเลือกจริงและตอนดูตัวอย่าง
async function rank(at = new Date()) {
  const transits = transitingPositions(at);
  const members = await eligibleMembers(at);
  const scored = members.map(m => scoreMember(m, transits)).filter(Boolean);
  // เรียงคะแนนมาก→น้อย · คะแนนเท่ากันตัดสินด้วย line_user_id เพื่อให้ผลคงที่ทุกครั้งที่รัน
  scored.sort((a, b) => b.score - a.score || a.line_user_id.localeCompare(b.line_user_id));
  return scored;
}

// เลือกผู้ได้รับของรอบเดือนนี้ + บันทึก (idempotent ด้วย unique index บน cycle)
// คืน null ถ้ารอบนี้มีคนได้แล้ว หรือไม่มีใครเข้าเกณฑ์
async function pickForCycle(at = new Date()) {
  const cycle = cycleOf(at);
  const already = (await db.query('SELECT id FROM loyalty_rewards WHERE cycle=$1', [cycle])).rows[0];
  if (already) return null;

  const ranked = await rank(at);
  if (!ranked.length) return null;
  const winner = ranked[0];

  const expires = new Date(at.getTime() + EXPIRE_DAYS * 86400e3).toISOString();
  const r = await db.query(
    `INSERT INTO loyalty_rewards
       (line_user_id, milestone, reward, reward_value, status, cycle, score, detail, expires_at, note)
     VALUES ($1,$2,$3,0,'GRANTED',$4,$5,$6,$7,$8)
     ON CONFLICT DO NOTHING
     RETURNING id, line_user_id, cycle, score, detail`,
    [winner.line_user_id, at.getUTCFullYear(), REWARD, cycle, winner.score, winner.detail, expires,
     `อันดับ 1 จาก ${ranked.length} คน`]);
  if (!r.rows[0]) return null;                 // ชนกับรอบที่รันพร้อมกัน — ปล่อยผ่าน
  return { ...r.rows[0], name: winner.name, total: ranked.length };
}

// ข้อความแจ้งผู้ได้รับ — อธิบายว่าทำไมถึงเป็นเขา (ไม่ใช่ "คุณโชคดี")
function pickMessage(name, detail) {
  const th = {
    Saturn: 'ดาวเสาร์', Jupiter: 'ดาวพฤหัส', Pluto: 'ดาวพลูโต',
    Uranus: 'ดาวยูเรนัส', Neptune: 'ดาวเนปจูน',
  };
  const planet = th[String(detail || '').split(' ')[0]] || 'ดาวจร';
  return [
    `🔮 เดือนนี้ดวงคุณเข้าจังหวะสำคัญ`,
    ``,
    `จากสมาชิก Prinnie333 ทั้งหมด ${planet}ทำมุมกับดวงกำเนิด`,
    `ของคุณ${name ? ' คุณ' + name : ''} แรงที่สุดในเดือนนี้`,
    ``,
    `อาจารย์ปรินนี่เลยอยากคุยกับคุณเป็นการส่วนตัว 1 ชั่วโมง`,
    `ไม่มีค่าใช้จ่ายเพิ่มเติม`,
    ``,
    `ทักมาบอกช่วงเวลาที่สะดวกได้เลยนะคะ`,
    `(ใช้สิทธิ์ภายใน ${EXPIRE_DAYS} วัน)`,
  ].join('\n');
}

module.exports = {
  rank, pickForCycle, eligibleMembers, scoreMember, pickMessage, cycleOf,
  WEIGHT, MIN_WEIGHT, COOLDOWN_MONTHS, MIN_MEMBER_DAYS, REWARD, EXPIRE_DAYS,
};
