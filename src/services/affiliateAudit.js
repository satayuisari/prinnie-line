// Audit log — ทุกการเปลี่ยนสถานะเงิน/คน ต้องมีร่องรอยว่าใครทำ เมื่อไหร่ จากอะไรเป็นอะไร
// ห้ามใส่ token/ความลับลงในนี้ (เก็บเฉพาะค่าเชิงธุรกิจ เช่น PENDING → APPROVED)
const db = require('../db');

const EVENTS = [
  'CANDIDATE_CREATED', 'CANDIDATE_STATUS_CHANGED',
  'AFFILIATE_CREATED', 'AFFILIATE_PAUSED', 'AFFILIATE_OFF', 'AFFILIATE_ACTIVATED',
  'ATTRIBUTION_CREATED', 'FIRST_PAYMENT_ATTRIBUTED',
  'COMMISSION_CREATED', 'COMMISSION_APPROVED', 'COMMISSION_PAID', 'COMMISSION_REVERSED',
  'COMMISSION_REVIEW_FLAGGED',
];

// log ต้องไม่ทำให้ flow หลักพัง — บันทึกไม่ได้ก็แค่ขึ้น error ใน log (เงินสำคัญกว่าประวัติ)
async function log(event, { actor = 'admin', entityType = '', entityId = '', oldValue = null, newValue = null, reason = null } = {}) {
  try {
    await db.query(
      `INSERT INTO affiliate_audit_log (event, actor, entity_type, entity_id, old_value, new_value, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [event, actor, entityType, String(entityId), oldValue == null ? null : String(oldValue),
       newValue == null ? null : String(newValue), reason]);
  } catch (e) { console.error('[audit]', event, e.message); }
}

// ประวัติของ entity หนึ่ง ๆ (ใช้โชว์ในแดชบอร์ด)
async function history(entityType, entityId, limit = 50) {
  return (await db.query(
    `SELECT event, actor, old_value, new_value, reason, to_char(created_at,'MM-DD HH24:MI') created
     FROM affiliate_audit_log WHERE entity_type=$1 AND entity_id=$2 ORDER BY id DESC LIMIT $3`,
    [entityType, String(entityId), limit])).rows;
}

async function recent(limit = 100) {
  return (await db.query(
    `SELECT event, actor, entity_type, entity_id, old_value, new_value, reason,
            to_char(created_at,'MM-DD HH24:MI') created
     FROM affiliate_audit_log ORDER BY id DESC LIMIT $1`, [limit])).rows;
}

module.exports = { log, history, recent, EVENTS };
