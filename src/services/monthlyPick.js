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

// รอบ = ครึ่งเดือน ไม่ใช่ทั้งเดือน
// เดิมคีย์เป็น YYYY-MM ทำให้ cron ที่ยิงวันที่ 2 และ 17 คัดได้แค่ครั้งเดียว
// เพราะ pickForCycle เจอว่า "รอบนี้มีคนได้แล้ว" ตั้งแต่รอบวันที่ 2 → วันที่ 17 ไม่ทำอะไรเลย
// A = วันที่ 1-16 (คัดวันที่ 2) · B = วันที่ 17 เป็นต้นไป (คัดวันที่ 17)
const cycleOf = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCDate() < 17 ? 'A' : 'B'}`;

// สมาชิกที่เข้าเกณฑ์: จ่ายจริง · ยังใช้งานอยู่ · เป็นสมาชิกครบ N วัน · มีดวงกำเนิด
// · ไม่เคยได้รับสิทธิ์ในรอบ COOLDOWN_MONTHS เดือนล่าสุด
//
// ⚠️ "ยังใช้งานอยู่" ต้องเช็ก subscribe_end ด้วย ไม่ใช่ status อย่างเดียว —
//    เดิมคนที่หมดอายุแล้ว 31 คนเข้าเกณฑ์ชิงสิทธิ์ได้ เพราะ status ค้างเป็น ACTIVE
async function eligibleMembers(at = new Date()) {
  return (await db.query(`
    SELECT s.line_user_id, s.nickname, s.display_name, s.chart_data
    FROM line_subscribers s
    WHERE s.status='ACTIVE'
      AND s.subscribe_end > $1::timestamp   -- ต้องยังใช้งานได้จริง ไม่ใช่แค่ status ค้าง
      AND s.chart_data IS NOT NULL
      AND s.payment_ref IS NOT NULL
      AND s.payment_ref NOT IN ('tester','free-trial','free','founder','LIFETIME_COMP')
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

// ── จับรางวัล ─────────────────────────────────────────────────────────────
// bon 17 ก.ย. 69: "399 ใครเป็นสมาชิกมีสิทธิ์ลุ้นดูดวงกับอาจารย์ ประกาศชื่อเมื่อถึงเวลา
//                  ให้นัดดูหลังจากนั้น" · "เอาเป็นจับรางวัลนี่ละลุย"
//
// จับแบบตรวจสอบย้อนได้ (วิธีเดียวกับ scripts/lucky-draw.js): รายชื่อผู้มีสิทธิ์เรียงตาม
// line_user_id แล้วใช้ sha256 ของ seed เลือกลำดับ ใครถือ seed กับรายชื่อชุดเดียวกัน
// ได้ผลเดิมทุกครั้ง — seed เก็บไว้ในบันทึกของรอบ ถ้ามีคนถามว่าโกงไหม ชี้ย้อนได้
const crypto = require('crypto');

function seedOf(cycle) {
  return `prinnie-${cycle}`;
}

/** เลือกหนึ่งคนจากรายชื่อด้วย seed — ฟังก์ชันบริสุทธิ์ เทสได้ */
function drawOne(members, seed) {
  if (!members.length) return null;
  const list = [...members].sort((x, y) => x.line_user_id.localeCompare(y.line_user_id));
  const n = crypto.createHash('sha256').update(seed).digest().readUInt32BE(0);
  return list[n % list.length];
}

// จับผู้ได้รางวัลของรอบนี้ + บันทึก (idempotent ด้วย unique index บน cycle)
// คืน null ถ้ารอบนี้จับไปแล้ว หรือไม่มีใครมีสิทธิ์
async function pickForCycle(at = new Date()) {
  const cycle = cycleOf(at);
  const already = (await db.query('SELECT id FROM loyalty_rewards WHERE cycle=$1', [cycle])).rows[0];
  if (already) return null;

  const members = await eligibleMembers(at);
  if (!members.length) return null;
  const seed = seedOf(cycle);
  const w = drawOne(members, seed);
  const name = w.nickname || w.display_name || null;

  const expires = new Date(at.getTime() + EXPIRE_DAYS * 86400e3).toISOString();
  const r = await db.query(
    `INSERT INTO loyalty_rewards
       (line_user_id, milestone, reward, reward_value, status, cycle, score, detail, expires_at, note)
     VALUES ($1,$2,$3,0,'GRANTED',$4,NULL,'draw',$5,$6)
     ON CONFLICT DO NOTHING
     RETURNING id, line_user_id, cycle`,
    [w.line_user_id, at.getUTCFullYear(), REWARD, cycle, expires,
     `จับรางวัล seed=${seed} จากผู้มีสิทธิ์ ${members.length} คน`]);
  if (!r.rows[0]) return null;                 // ชนกับรอบที่รันพร้อมกัน — ปล่อยผ่าน
  return { ...r.rows[0], name, total: members.length, seed };
}

// ข้อความแจ้งผู้ได้รับรางวัล — ภาษาธรรมดา บอกให้ชัดว่า "คุณได้รางวัล" และต้องทำอะไรต่อ
// (ฉบับแรก "ดวงคุณเข้าจังหวะสำคัญ … ดาวพลูโตทำมุม" ผู้ได้รับตัวจริงอ่านแล้วไม่รู้ว่าตัวเองได้)
function pickMessage(name) {
  const who = name ? `คุณ ${String(name).trim()}` : 'คุณ';
  return [
    `🎉 ยินดีด้วยค่ะ ${who}`,
    ``,
    `คุณได้รับรางวัล ดูดวงตัวต่อตัวกับอาจารย์ปรินนี่ฟรี 1 ชั่วโมง`,
    `จากการจับรางวัลสมาชิก Prinnie333 รอบนี้ค่ะ`,
    ``,
    `ขั้นต่อไป: พิมพ์บอกวันและช่วงเวลาที่สะดวกในแชทนี้ได้เลย`,
    `ทีมงานจะติดต่อกลับเพื่อนัดเวลากับอาจารย์ค่ะ`,
    ``,
    `ใช้สิทธิ์ได้ภายใน ${EXPIRE_DAYS} วัน`,
  ].join('\n');
}

module.exports = {
  drawOne, seedOf,
  rank, pickForCycle, eligibleMembers, scoreMember, pickMessage, cycleOf,
  WEIGHT, MIN_WEIGHT, COOLDOWN_MONTHS, MIN_MEMBER_DAYS, REWARD, EXPIRE_DAYS,
};
