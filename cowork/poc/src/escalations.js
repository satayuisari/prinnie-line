'use strict';
/**
 * escalations.js — คิว "เคสที่ต้องให้คนดู" (escalate_to_human) เพื่อแสดงบน staff console
 * -----------------------------------------------------------------------------
 * ครอบคลุม: อารมณ์/เปราะบาง (E), ร้องเรียน, และ "unknown-intent" (ข้อความที่ไม่เข้าข่าย A–F)
 * PoC: เก็บใน memory. ของจริงย้ายไป DB + แจ้งเตือนเข้า LINE staff group / Slack
 */
const { EventEmitter } = require('events');
const crypto = require('crypto');

const tickets = new Map(); // id -> ticket
const bus = new EventEmitter();

// reason → ป้าย + ความเร่งด่วน (unknown = ต้องถามลูกค้าว่าต้องการช่วยด้านใด)
const REASON_META = {
  emotional_distress: { label: 'อารมณ์/เปราะบาง', priority: 'high' },
  angry:              { label: 'ลูกค้าโกรธ/ร้องเรียน', priority: 'high' },
  payment_dispute:    { label: 'ข้อพิพาทการเงิน', priority: 'high' },
  unknown:            { label: 'ไม่ทราบความต้องการ (ถามลูกค้า)', priority: 'normal' },
  other:              { label: 'อื่น ๆ', priority: 'normal' },
};

function create({ lineUserId, reason, summary, draftReply, lastMessage }) {
  const meta = REASON_META[reason] || REASON_META.other;
  const id = 'tk_' + crypto.randomUUID().slice(0, 8);
  const ticket = {
    id, lineUserId, reason, label: meta.label, priority: meta.priority,
    summary: summary || '', draftReply: draftReply || '', lastMessage: lastMessage || '',
    status: 'open', createdAt: Date.now(),
  };
  tickets.set(id, ticket);
  bus.emit('escalation:new', ticket);
  console.log(`[escalate] ${meta.priority.toUpperCase()} ${id} (${meta.label}) :: ${summary || ''}`);
  return ticket;
}

function resolve(id, staffId, note) {
  const t = tickets.get(id);
  if (!t) return false;
  t.status = 'resolved';
  t.resolvedBy = staffId || 'staff';
  t.note = note;
  bus.emit('escalation:resolved', { id });
  return true;
}

const listOpen = () => [...tickets.values()].filter((t) => t.status === 'open')
  .sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1));

module.exports = { create, resolve, listOpen, bus, REASON_META };
