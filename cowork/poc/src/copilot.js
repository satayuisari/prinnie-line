'use strict';
/**
 * copilot.js — เฟส 1: คำตอบของ agent ไม่ push ตรงถึงลูกค้า แต่ "ขึ้นจอ staff กดส่ง"
 * -----------------------------------------------------------------------------
 * RELEASE_PHASE=1 → ทุกข้อความเข้า outbox รอ staff กดส่ง
 * RELEASE_PHASE=2 → ปล่อยออโต้เฉพาะหมวด low-risk (faq/account); payment/astro/escalate ยังเข้า outbox
 */
const { EventEmitter } = require('events');
const crypto = require('crypto');
const lineClient = require('./lineClient');

const outbox = new Map(); // id -> { id, lineUserId, text, agentTag, status }
const bus = new EventEmitter();

const AUTO_SEND_PHASE2 = new Set(['prinnie-faq', 'prinnie-account']);

function phase() { return Number(process.env.RELEASE_PHASE || 1); }

/** orchestrator ส่งคำตอบ agent มาที่นี่ก่อนถึงลูกค้าเสมอ */
function handleAgentReply({ lineUserId, text, agentTag }) {
  const canAuto = phase() >= 2 && AUTO_SEND_PHASE2.has(agentTag);
  if (canAuto) {
    sendToLine(lineUserId, text);
    return { autoSent: true };
  }
  const id = crypto.randomUUID();
  outbox.set(id, { id, lineUserId, text, agentTag, status: 'pending', createdAt: Date.now() });
  bus.emit('draft:new', { id, lineUserId, agentTag, text });
  console.log(`[copilot] 📝 ร่างรอ staff กดส่ง (id=${id}, agent=${agentTag})\n   "${text}"`);
  return { autoSent: false, draftId: id };
}

/** staff กดส่ง (อาจแก้ข้อความก่อน) */
function approveSend(id, editedText) {
  const d = outbox.get(id);
  if (!d) return false;
  d.status = 'sent';
  sendToLine(d.lineUserId, editedText || d.text);
  return true;
}

function discard(id) { return outbox.delete(id); }
const listDrafts = () => [...outbox.values()].filter((d) => d.status === 'pending');

function sendToLine(lineUserId, text) {
  // push 1:1 เท่านั้น ห้าม broadcast (ไม่มี token → lineClient จะ log แทน)
  lineClient.pushText(lineUserId, text).catch((e) => console.error('[copilot] push error', e));
}

module.exports = { handleAgentReply, approveSend, discard, listDrafts, bus };
