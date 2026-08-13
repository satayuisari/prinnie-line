// Ask Prinnie 3 — สิทธิ์สมาชิก: ส่ง 3 คำถามให้ อ.ปรินนี่ ตอบเป็นการส่วนตัว ครั้งเดียวจบ
//
// ⚖️ ให้ตามเงื่อนไข ไม่มีการสุ่ม: จ่ายครบ N รอบ ได้สิทธิ์ทุกคน
//    ระบบนี้ "คำนวณ" ว่าใครครบเกณฑ์ ไม่ได้ "เลือก" ใคร — ไม่มี random ในไฟล์นี้โดยตั้งใจ
//    ถ้าวันหน้าจะเปลี่ยนเป็นสุ่ม ต้องผ่านที่ปรึกษากฎหมาย + ขออนุญาตก่อน แล้วค่อยแก้ที่นี่
//    คำที่ห้ามใช้กับสิทธิ์นี้: ลุ้น / ผู้โชคดี / ประกาศผล / จับรางวัล (ไม่ใช่การแข่งขันหรือการสุ่ม)
//
// 💰 ไม่ประกาศ "มูลค่า" ของสิทธิ์นี้ — 3 คำถามไม่เท่ากับบริการดู 1 ชม. ที่ราคา 3,000
//    การติดป้ายราคาเดิมจะสร้าง expectation ผิดและทำให้ offer ดูไม่ตรงสินค้า
const db = require('../db');

const MILESTONE   = Number(process.env.LOYALTY_MILESTONE) || 3;      // จ่ายครบกี่รอบถึงได้สิทธิ์
const EXPIRE_DAYS = Number(process.env.LOYALTY_EXPIRE_DAYS) || 60;   // ใช้สิทธิ์ภายในกี่วัน
const MAX_Q       = 3;                                              // ส่งได้ 3 คำถาม ครั้งเดียว
const REWARD_NAME = 'Ask Prinnie 3';

// เงื่อนไขที่ประกาศ — แหล่งเดียว ใช้ทั้งในแอปและบนอาร์ตเวิร์ก จะได้ไม่พูดไม่ตรงกัน
const TERMS = [
  `สมาชิกที่ชำระค่าสมาชิกครบ ${MILESTONE} รอบ ได้รับสิทธิ์ทุกคน ไม่ต้องลงทะเบียน ไม่มีการจับรางวัล`,
  `ส่งได้ ${MAX_Q} คำถามพร้อมกันในครั้งเดียว · 1 สิทธิ์ต่อสมาชิก 1 ท่าน`,
  `ใช้สิทธิ์ภายใน ${EXPIRE_DAYS} วันนับจากวันที่ได้รับสิทธิ์`,
  'ตรวจสอบและแจ้งสิทธิ์สมาชิกที่ครบเกณฑ์ทุกสิ้นเดือน (แจ้งเป็นข้อความส่วนตัว)',
  'อาจารย์ตอบกลับเป็นการส่วนตัวครั้งเดียว ไม่มีถามต่อเนื่องในสิทธิ์เดียวกัน',
  'สิทธิ์นี้โอนให้ผู้อื่นไม่ได้ และแลกเป็นเงินสดไม่ได้',
];

// รอบที่นับเป็น "จ่ายจริง" — เฉพาะ subscription ที่ PAID เท่านั้น
// ออเดอร์ที่ refund/ยกเลิกจะไม่มีสถานะ PAID จึงไม่ถูกนับโดยอัตโนมัติ
const PAID_CYCLES_SQL = `
  SELECT line_user_id, COUNT(*)::int paid_count
  FROM payment_orders
  WHERE type='subscription' AND status='PAID'
  GROUP BY line_user_id`;

async function paidCycles(line_user_id) {
  const r = await db.query(
    `SELECT COUNT(*)::int n FROM payment_orders
     WHERE line_user_id=$1 AND type='subscription' AND status='PAID'`, [line_user_id]);
  return r.rows[0].n;
}

// ใครครบเกณฑ์แต่ยังไม่เคยได้สิทธิ์ขั้นนี้
async function findEligible(milestone = MILESTONE) {
  return (await db.query(`
    SELECT p.line_user_id, p.paid_count, s.nickname, s.display_name
    FROM (${PAID_CYCLES_SQL}) p
    JOIN line_subscribers s ON s.line_user_id = p.line_user_id
    LEFT JOIN loyalty_rewards r ON r.line_user_id = p.line_user_id AND r.milestone = $1
    WHERE p.paid_count >= $1 AND r.id IS NULL
    ORDER BY p.paid_count DESC`, [milestone])).rows;
}

// ให้สิทธิ์ — ตรวจ eligibility สดอีกครั้งก่อนเสมอ (กันกรณี refund หลังจากเข้าคิว)
// idempotent ด้วย UNIQUE(line_user_id, milestone) ระดับ DB
async function grant(line_user_id, { milestone = MILESTONE, note = '' } = {}) {
  const cycles = await paidCycles(line_user_id);
  if (cycles < milestone) return null;              // refund ทำให้หลุดเกณฑ์ → ไม่ให้สิทธิ์
  const expires = new Date(Date.now() + EXPIRE_DAYS * 86400e3).toISOString();
  const r = await db.query(
    `INSERT INTO loyalty_rewards (line_user_id, milestone, reward, reward_value, expires_at, note)
     VALUES ($1,$2,$3,0,$4,$5)
     ON CONFLICT (line_user_id, milestone) DO NOTHING
     RETURNING id, line_user_id, milestone, expires_at`,
    [line_user_id, milestone, REWARD_NAME, expires, note || `จ่ายครบ ${cycles} รอบ`]);
  return r.rows[0] || null;
}

async function grantAllEligible(milestone = MILESTONE) {
  const eligible = await findEligible(milestone);
  const granted = [];
  for (const e of eligible) {
    const row = await grant(e.line_user_id, { milestone, note: `จ่ายครบ ${e.paid_count} รอบ` });
    if (row) granted.push({ ...row, nickname: e.nickname || e.display_name, paid_count: e.paid_count });
  }
  return granted;
}

async function markNotified(id) {
  await db.query(`UPDATE loyalty_rewards SET status='NOTIFIED', notified_at=NOW()
                  WHERE id=$1 AND status='GRANTED'`, [id]);
}

// สิทธิ์ที่ใช้ได้อยู่ของลูกค้าคนนี้ (ยังไม่ส่งคำถาม + ยังไม่หมดอายุ)
async function activeFor(line_user_id) {
  return (await db.query(
    `SELECT id, milestone, to_char(expires_at,'YYYY-MM-DD') expires
     FROM loyalty_rewards
     WHERE line_user_id=$1 AND asked_at IS NULL AND status IN ('GRANTED','NOTIFIED')
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY id LIMIT 1`, [line_user_id])).rows[0] || null;
}

// ลูกค้าส่ง 3 คำถามพร้อมกัน — ครั้งเดียวจบ ไม่มีถามต่อเนื่อง
async function submitQuestions(line_user_id, questions) {
  const clean = (Array.isArray(questions) ? questions : [])
    .map(q => String(q || '').trim()).filter(Boolean).slice(0, MAX_Q);
  if (clean.length !== MAX_Q) throw new Error(`ต้องส่งให้ครบ ${MAX_Q} คำถาม`);

  const reward = await activeFor(line_user_id);
  if (!reward) throw new Error('ไม่พบสิทธิ์ที่ใช้ได้ (อาจใช้ไปแล้วหรือหมดอายุ)');

  const r = await db.query(
    `UPDATE loyalty_rewards SET questions=$2, asked_at=NOW(), status='ASKED'
     WHERE id=$1 AND asked_at IS NULL RETURNING id`,
    [reward.id, JSON.stringify(clean)]);
  if (!r.rows[0]) throw new Error('สิทธิ์นี้ถูกใช้ไปแล้ว');   // กันกดส่งซ้ำพร้อมกัน
  return { id: reward.id, questions: clean };
}

async function saveBrief(id, brief) {
  await db.query('UPDATE loyalty_rewards SET brief=$2 WHERE id=$1', [Number(id), brief]);
}

// อาจารย์ตอบแล้ว → ปิดสิทธิ์
async function markAnswered(id, { note = null } = {}) {
  const r = await db.query(
    `UPDATE loyalty_rewards SET status='USED', answered_at=NOW(), used_at=NOW(),
       note = COALESCE($2, note)
     WHERE id=$1 AND status<>'USED' RETURNING id, line_user_id`, [Number(id), note]);
  if (!r.rows[0]) throw new Error('ไม่พบสิทธิ์ หรือปิดไปแล้ว');
  return r.rows[0];
}

async function setStatus(id, status, { note = null } = {}) {
  const allowed = ['GRANTED', 'NOTIFIED', 'ASKED', 'USED', 'EXPIRED'];
  if (!allowed.includes(status)) throw new Error('สถานะไม่ถูกต้อง');
  const r = await db.query(
    `UPDATE loyalty_rewards SET status=$2, note=COALESCE($3, note),
       used_at = CASE WHEN $2='USED' THEN NOW() ELSE used_at END
     WHERE id=$1 RETURNING id, status`, [Number(id), status, note]);
  if (!r.rows[0]) throw new Error('ไม่พบสิทธิ์นี้');
  return r.rows[0];
}

// คิวงานอาจารย์ — ส่งคำถามแล้วรอตอบ (เรียงเก่าสุดก่อน)
async function advisorQueue() {
  return (await db.query(
    `SELECT r.id, r.line_user_id, r.questions, r.brief,
            COALESCE(s.nickname, s.display_name, '(ไม่มีชื่อ)') name,
            to_char(r.asked_at,'MM-DD HH24:MI') asked,
            EXTRACT(EPOCH FROM (NOW()-r.asked_at))/3600 hours_waiting
     FROM loyalty_rewards r
     LEFT JOIN line_subscribers s ON s.line_user_id=r.line_user_id
     WHERE r.asked_at IS NOT NULL AND r.answered_at IS NULL
     ORDER BY r.asked_at`)).rows;
}

async function list({ status = null, limit = 200 } = {}) {
  const params = [];
  let where = '';
  if (status) { params.push(status); where = `WHERE r.status=$${params.length}`; }
  params.push(limit);
  return (await db.query(
    `SELECT r.id, r.line_user_id, r.milestone, r.status, r.note, r.questions,
            COALESCE(s.nickname, s.display_name, '(ไม่มีชื่อ)') AS name,
            to_char(r.granted_at,'YYYY-MM-DD')  granted,
            to_char(r.expires_at,'YYYY-MM-DD')  expires,
            to_char(r.asked_at,'MM-DD HH24:MI') asked,
            to_char(r.answered_at,'MM-DD HH24:MI') answered
     FROM loyalty_rewards r
     LEFT JOIN line_subscribers s ON s.line_user_id = r.line_user_id
     ${where} ORDER BY r.id DESC LIMIT $${params.length}`, params)).rows;
}

// KPI 3 ตัวที่ Bon สั่งให้ดู
async function kpi() {
  const r = (await db.query(`
    SELECT COUNT(*)::int granted,
      COUNT(*) FILTER (WHERE asked_at IS NOT NULL)::int redeemed,
      COUNT(*) FILTER (WHERE asked_at IS NOT NULL AND answered_at IS NULL)::int in_queue,
      COUNT(*) FILTER (WHERE status='EXPIRED')::int expired,
      COALESCE(AVG(EXTRACT(EPOCH FROM (answered_at - asked_at))/60)
               FILTER (WHERE answered_at IS NOT NULL),0)::int avg_turnaround_min
    FROM loyalty_rewards`)).rows[0];
  // % สมาชิกที่ต่อถึงรอบที่ครบเกณฑ์
  const c = (await db.query(`
    SELECT COUNT(*)::int payers,
           COUNT(*) FILTER (WHERE c >= $1)::int reached
    FROM (${PAID_CYCLES_SQL.replace('COUNT(*)::int paid_count', 'COUNT(*)::int c')}) x`, [MILESTONE])).rows[0];
  return {
    ...r,
    payers: c.payers,
    reached: c.reached,
    reach_rate: c.payers ? Math.round(c.reached / c.payers * 100) : 0,
    redeem_rate: r.granted ? Math.round(r.redeemed / r.granted * 100) : 0,
  };
}

// ข้อความแจ้งสิทธิ์ (ส่วนตัว ส่งทันทีที่ครบเกณฑ์ — ไม่ใช่การประกาศรายชื่อ)
function grantMessage(name, askUrl) {
  return [
    `🎁 คุณได้รับสิทธิ์พิเศษ ${REWARD_NAME} แล้ว`,
    ``,
    `ขอบคุณที่เป็นสมาชิก Prinnie333 ต่อเนื่องครบ ${MILESTONE} รอบ${name ? ' คุณ' + name : ''}`,
    `คุณส่ง ${MAX_Q} คำถามที่อยากถามอาจารย์ปรินนี่ที่สุดได้ 1 ครั้ง`,
    `อาจารย์จะดูจากข้อมูลดวงของคุณและตอบกลับเป็นการส่วนตัว`,
    `ไม่มีค่าใช้จ่ายเพิ่มเติม`,
    ``,
    `ส่งคำถามที่นี่ 👉 ${askUrl}`,
    `(ใช้สิทธิ์ภายใน ${EXPIRE_DAYS} วัน)`,
  ].join('\n');
}

module.exports = {
  findEligible, grant, grantAllEligible, markNotified, activeFor, submitQuestions,
  saveBrief, markAnswered, setStatus, advisorQueue, list, kpi, paidCycles, grantMessage,
  MILESTONE, EXPIRE_DAYS, MAX_Q, REWARD_NAME, TERMS,
};
