// สิทธิ์ดูดวงส่วนตัวกับ อ.ปรินนี่ 1 ชม. — ให้สมาชิกที่ชำระค่าสมาชิกครบตามเกณฑ์
//
// ⚖️ ออกแบบให้ไม่ต้องขอใบอนุญาตชิงโชค:
//    เกณฑ์เป็นตัวเลขตายตัวที่ประกาศล่วงหน้า — จ่ายครบ N ครั้ง ได้สิทธิ์ทุกคน ไม่มีการสุ่ม
//    ระบบนี้ "คำนวณ" ว่าใครครบเกณฑ์ ไม่ได้ "เลือก" ใคร (ไม่มี random ในไฟล์นี้โดยตั้งใจ)
//    ถ้าวันหน้าจะเปลี่ยนเป็นสุ่มจริง ต้องขออนุญาตกรมการปกครองก่อน แล้วค่อยแก้ที่นี่
const db = require('../db');

const MILESTONE     = Number(process.env.LOYALTY_MILESTONE) || 3;      // จ่ายครบกี่ครั้งถึงได้สิทธิ์
const REWARD_VALUE  = Number(process.env.LOYALTY_VALUE) || 3000;       // มูลค่าที่ประกาศ (บาท)
const EXPIRE_DAYS   = Number(process.env.LOYALTY_EXPIRE_DAYS) || 90;   // ใช้สิทธิ์ภายในกี่วัน
const REWARD_NAME   = 'ดูดวงส่วนตัวกับ อ.ปรินนี่ 1 ชั่วโมง';

// ข้อความเงื่อนไขที่ใช้ได้ทั้งในแอปและบนอาร์ตเวิร์ก — แหล่งเดียว จะได้ไม่พูดไม่ตรงกัน
const TERMS = [
  `สมาชิกที่ชำระค่าสมาชิกครบ ${MILESTONE} ครั้ง รับสิทธิ์ทุกคน ไม่ต้องลงทะเบียน ไม่ต้องแข่งกับใคร`,
  `สิทธิ์ละ 1 ครั้งต่อสมาชิก 1 ท่าน · ใช้ได้ภายใน ${EXPIRE_DAYS} วันนับจากวันได้รับสิทธิ์`,
  'ประกาศรายชื่อผู้ได้รับสิทธิ์ทุกสิ้นเดือน ทาง LINE ของ Prinnie333',
  'นัดหมายวันเวลาล่วงหน้ากับทีมงาน · สิทธิ์นี้โอนให้ผู้อื่นไม่ได้',
];

// นับ "จ่ายจริงกี่ครั้ง" ต่อคน — นับจากออเดอร์ที่ PAID เท่านั้น ตรวจย้อนหลังได้
async function paidCounts() {
  return (await db.query(`
    SELECT line_user_id, COUNT(*)::int paid_count, MAX(paid_at) last_paid
    FROM payment_orders
    WHERE type='subscription' AND status='PAID'
    GROUP BY line_user_id`)).rows;
}

// ใครครบเกณฑ์แต่ยังไม่เคยได้สิทธิ์ขั้นนี้
async function findEligible(milestone = MILESTONE) {
  return (await db.query(`
    SELECT p.line_user_id, p.paid_count, s.nickname, s.display_name
    FROM (SELECT line_user_id, COUNT(*)::int paid_count
          FROM payment_orders WHERE type='subscription' AND status='PAID'
          GROUP BY line_user_id) p
    JOIN line_subscribers s ON s.line_user_id = p.line_user_id
    LEFT JOIN loyalty_rewards r
      ON r.line_user_id = p.line_user_id AND r.milestone = $1
    WHERE p.paid_count >= $1 AND r.id IS NULL
    ORDER BY p.paid_count DESC`, [milestone])).rows;
}

// ให้สิทธิ์ — idempotent ด้วย UNIQUE(line_user_id, milestone) ระดับ DB
// คืน row ที่สร้าง หรือ null ถ้าเคยได้ไปแล้ว
async function grant(line_user_id, { milestone = MILESTONE, note = '' } = {}) {
  const expires = new Date(Date.now() + EXPIRE_DAYS * 86400e3).toISOString();
  const r = await db.query(
    `INSERT INTO loyalty_rewards (line_user_id, milestone, reward, reward_value, expires_at, note)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (line_user_id, milestone) DO NOTHING
     RETURNING id, line_user_id, milestone, reward_value, expires_at`,
    [line_user_id, milestone, REWARD_NAME, REWARD_VALUE, expires, note]);
  return r.rows[0] || null;
}

// ให้สิทธิ์ทุกคนที่ครบเกณฑ์ในรอบนี้ (ใช้โดย scheduler สิ้นเดือน)
async function grantAllEligible(milestone = MILESTONE) {
  const eligible = await findEligible(milestone);
  const granted = [];
  for (const e of eligible) {
    const row = await grant(e.line_user_id, { milestone, note: `จ่ายครบ ${e.paid_count} ครั้ง` });
    if (row) granted.push({ ...row, nickname: e.nickname || e.display_name, paid_count: e.paid_count });
  }
  return granted;
}

async function markNotified(id) {
  await db.query(`UPDATE loyalty_rewards SET status='NOTIFIED', notified_at=NOW()
                  WHERE id=$1 AND status='GRANTED'`, [id]);
}

// แอดมินกดเปลี่ยนสถานะจากแดชบอร์ด (นัดแล้ว / ใช้สิทธิ์แล้ว)
async function setStatus(id, status, { note = null } = {}) {
  const allowed = ['GRANTED', 'NOTIFIED', 'BOOKED', 'USED', 'EXPIRED'];
  if (!allowed.includes(status)) throw new Error('สถานะไม่ถูกต้อง');
  const r = await db.query(
    `UPDATE loyalty_rewards SET status=$2,
       used_at = CASE WHEN $2='USED' THEN NOW() ELSE used_at END,
       note = COALESCE($3, note)
     WHERE id=$1 RETURNING id, line_user_id, status`, [Number(id), status, note]);
  if (!r.rows[0]) throw new Error('ไม่พบสิทธิ์นี้');
  return r.rows[0];
}

async function list({ status = null, limit = 200 } = {}) {
  const params = [];
  let where = '';
  if (status) { params.push(status); where = `WHERE r.status=$${params.length}`; }
  params.push(limit);
  return (await db.query(
    `SELECT r.id, r.line_user_id, r.milestone, r.reward, r.reward_value, r.status, r.note,
            COALESCE(s.nickname, s.display_name, '(ไม่มีชื่อ)') AS name,
            to_char(r.granted_at,'YYYY-MM-DD') granted,
            to_char(r.expires_at,'YYYY-MM-DD') expires,
            to_char(r.used_at,'YYYY-MM-DD')    used
     FROM loyalty_rewards r
     LEFT JOIN line_subscribers s ON s.line_user_id = r.line_user_id
     ${where} ORDER BY r.id DESC LIMIT $${params.length}`, params)).rows;
}

async function stats() {
  const t = (await db.query(`
    SELECT COUNT(*)::int total,
      COUNT(*) FILTER (WHERE status IN ('GRANTED','NOTIFIED'))::int waiting,
      COUNT(*) FILTER (WHERE status='BOOKED')::int booked,
      COUNT(*) FILTER (WHERE status='USED')::int used,
      COALESCE(SUM(reward_value) FILTER (WHERE status<>'EXPIRED'),0)::int value_out
    FROM loyalty_rewards`)).rows[0];
  const next = (await db.query(`
    SELECT COUNT(*)::int n FROM (
      SELECT line_user_id, COUNT(*)::int c FROM payment_orders
      WHERE type='subscription' AND status='PAID' GROUP BY 1) x
    WHERE x.c = $1 - 1`, [MILESTONE])).rows[0];
  return { ...t, almost: next.n };     // almost = อีก 1 ครั้งก็ได้สิทธิ์ (ไว้ใช้กระตุ้นต่ออายุ)
}

// ข้อความแจ้งลูกค้าที่ได้สิทธิ์
function grantMessage(name) {
  return [
    `🎁 ยินดีด้วยค่ะ${name ? ' คุณ' + name : ''}`,
    ``,
    `คุณชำระค่าสมาชิกครบ ${MILESTONE} ครั้งแล้ว`,
    `จึงได้รับสิทธิ์ ${REWARD_NAME}`,
    `มูลค่า ${REWARD_VALUE.toLocaleString()} บาท`,
    ``,
    `ทักแชทมาบอกช่วงเวลาที่สะดวกได้เลยนะคะ`,
    `เดี๋ยวทีมงานนัดวันให้ค่ะ ✨`,
    ``,
    `(ใช้สิทธิ์ได้ภายใน ${EXPIRE_DAYS} วัน)`,
  ].join('\n');
}

module.exports = {
  findEligible, grant, grantAllEligible, markNotified, setStatus, list, stats,
  paidCounts, grantMessage,
  MILESTONE, REWARD_VALUE, EXPIRE_DAYS, REWARD_NAME, TERMS,
};
