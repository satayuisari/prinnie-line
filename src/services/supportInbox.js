// support_inbox — เก็บ/จัดการข้อความลูกค้าที่ต้องให้ staff ดู/ตอบ
const db = require('../db');
const { pushText } = require('./lineMessaging');
const triage = require('./supportTriage');
const supportAI = require('./supportAI');

// หมวดที่ "บอทตอบเอง" ได้ (ปลอดภัย) — เงิน/อารมณ์/โกรธ ไม่อยู่ในนี้ → ให้คนตอบ
const AUTO_REPLY = new Set(['astro', 'general']);

// เก็บข้อความเข้า inbox (กันสแปม: ถ้ามี OPEN ของ user เดิม + ข้อความซ้ำใน 60 วิ ไม่เก็บซ้ำ)
async function capture(lineUserId, displayName, message) {
  try {
    const dup = await db.query(
      `SELECT 1 FROM support_inbox
       WHERE line_user_id=$1 AND message=$2 AND created_at > NOW() - INTERVAL '60 seconds' LIMIT 1`,
      [lineUserId, message]);
    if (dup.rows.length) return null;
    const { category, priority } = triage.classify(message);
    const r = await db.query(
      `INSERT INTO support_inbox (line_user_id, display_name, message, category, priority)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [lineUserId, displayName || null, message, category, priority]);
    return r.rows[0].id;
  } catch (e) { console.error('[inbox] capture error:', e.message); return null; }
}

async function listOpen(limit = 50) {
  const r = await db.query(
    `SELECT id, line_user_id, display_name, message, ai_draft, status, category, priority,
            to_char(created_at AT TIME ZONE 'Asia/Bangkok','DD/MM HH24:MI') AS created
     FROM support_inbox WHERE status='OPEN'
     ORDER BY (priority='high') DESC, created_at DESC LIMIT $1`, [limit]);
  return r.rows;
}

async function counts() {
  const r = await db.query(`SELECT COUNT(*) FILTER (WHERE status='OPEN')::int AS open FROM support_inbox`);
  return r.rows[0];
}

async function saveDraft(id, draft) {
  await db.query(`UPDATE support_inbox SET ai_draft=$2 WHERE id=$1`, [id, draft]);
}

// staff กดส่ง → push หาลูกค้าจริง + mark REPLIED (handled_by=staff)
async function reply(id, text) {
  const r = await db.query(`SELECT line_user_id FROM support_inbox WHERE id=$1`, [id]);
  if (!r.rows.length) return { ok: false, error: 'not_found' };
  await pushText(r.rows[0].line_user_id, text);
  await db.query(
    `UPDATE support_inbox SET status='REPLIED', reply_text=$2, replied_at=NOW(), handled_by='staff' WHERE id=$1`,
    [id, text]);
  return { ok: true };
}

// บอทตอบเอง (auto-reply) → mark REPLIED + handled_by=bot (ไม่ push ซ้ำ; ผู้เรียกส่งผ่าน reply token แล้ว)
// ไว้ตรวจคุณภาพบอทบน dashboard และไม่ให้เคสค้างใน OPEN queue ของ staff
async function markAutoReplied(id, text) {
  if (!id) return;
  await db.query(
    `UPDATE support_inbox SET status='REPLIED', reply_text=$2, replied_at=NOW(), handled_by='bot' WHERE id=$1`,
    [id, text]);
}

async function close(id) {
  await db.query(`UPDATE support_inbox SET status='CLOSED' WHERE id=$1`, [id]);
  return { ok: true };
}

module.exports = { capture, listOpen, counts, saveDraft, reply, markAutoReplied, close, AUTO_REPLY };
