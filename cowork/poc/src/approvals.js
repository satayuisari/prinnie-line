'use strict';
/**
 * approvals.js — คิวอนุมัติของ staff สำหรับ gated tools (activate_subscription / issue_refund)
 * -----------------------------------------------------------------------------
 * PoC: เก็บใน memory + EventEmitter. ของจริงควรย้ายไป DB/queue + ส่งการ์ดเข้า
 *   ช่องทาง staff (LINE staff group / เว็บ console / Slack) แล้วผูกปุ่ม approve/reject กลับมาที่นี่
 */
const { EventEmitter } = require('events');
const crypto = require('crypto');

const pending = new Map(); // id -> { id, toolName, input, resolve }
const bus = new EventEmitter();

/** เรียกตอน gated tool ถูก invoke — คืน Promise ที่ resolve เมื่อ staff ตัดสินใจ */
function requestApproval({ toolName, input, lineUserId }) {
  const id = crypto.randomUUID();
  const card = { id, toolName, input, lineUserId, createdAt: Date.now() };
  return new Promise((resolve) => {
    pending.set(id, { ...card, resolve });
    bus.emit('approval:new', card); // → UI/แจ้งเตือน staff
    console.log(`[approval] ⏸️  รออนุมัติ ${toolName} (id=${id})`, JSON.stringify(input));
  });
}

/** staff กดอนุมัติ */
function approve(id, staffId) {
  const p = pending.get(id);
  if (!p) return false;
  pending.delete(id);
  p.resolve({ approved: true, approvedBy: staffId || 'staff' });
  bus.emit('approval:resolved', { id, approved: true });
  return true;
}

/** staff กดปฏิเสธ */
function reject(id, staffId, note) {
  const p = pending.get(id);
  if (!p) return false;
  pending.delete(id);
  p.resolve({ approved: false, approvedBy: staffId || 'staff', note });
  bus.emit('approval:resolved', { id, approved: false });
  return true;
}

const listPending = () => [...pending.values()].map(({ resolve, ...c }) => c);

module.exports = { requestApproval, approve, reject, listPending, bus };
