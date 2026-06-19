'use strict';
/**
 * demo.js — รัน flow เคส B (จ่ายแล้วไม่ได้สิทธิ์) แบบ end-to-end ด้วย STUB
 * ไม่ต้องมี LINE / Anthropic SDK — ใช้ดูว่า orchestrator + gating + copilot ทำงานครบ
 *   node src/demo.js
 *
 * ลำดับที่จะเห็น:
 *   1. ลูกค้าทัก "จ่ายเงินแล้วแต่ดวงไม่ขึ้น"
 *   2. agent(stub) เรียก detect_mismatch → orchestrator ตอบ mismatch:true
 *   3. agent เรียก activate_subscription → 🔒 เข้าคิวอนุมัติ (จำลอง staff อนุมัติใน 1 วิ)
 *   4. agent ตอบลูกค้า → copilot เก็บเป็นร่าง (จำลอง staff กดส่งใน 1 วิ)
 */
const { Orchestrator } = require('./orchestrator');
const approvals = require('./approvals');
const copilot = require('./copilot');
const escalations = require('./escalations');

process.env.RELEASE_PHASE = process.env.RELEASE_PHASE || '1';

// จำลอง staff: อนุมัติ gated action ทันทีที่มีคำขอ
approvals.bus.on('approval:new', (card) => {
  console.log(`[staff] 👀 เห็นคำขอ ${card.toolName} → กดอนุมัติ`);
  setTimeout(() => approvals.approve(card.id, 'staff_demo'), 800);
});

// จำลอง staff: กดส่งร่างทันทีที่มี
copilot.bus.on('draft:new', (d) => {
  console.log(`[staff] ✅ ตรวจร่างของ ${d.agentTag} → กดส่ง`);
  setTimeout(() => copilot.approveSend(d.id), 800);
});

// แจ้งเตือนเคสที่ต้องให้คนดู (อารมณ์ / unknown-intent) ขึ้น staff console
escalations.bus.on('escalation:new', (t) => {
  console.log(`[staff] 🔔 ALERT [${t.priority}] ${t.label} — ลูกค้า ${t.lineUserId}\n   ข้อความ: "${t.lastMessage}"\n   ร่างถามกลับ: "${t.draftReply}"`);
});

(async () => {
  const orch = new Orchestrator({ useStub: true });

  console.log('\n=== เคส B: จ่ายแล้วไม่ได้สิทธิ์ (gated activate) ===');
  await orch.handleIncoming({ lineUserId: 'Udemo001', text: 'จ่ายเงินแล้วแต่ดวงรายวันไม่ขึ้นเลยค่ะ' });

  setTimeout(async () => {
    console.log('\n=== เคส U: ข้อความไม่เข้าข่าย → แจ้งเตือน + ถามลูกค้า ===');
    await orch.handleIncoming({ lineUserId: 'Udemo002', text: 'อันนี้...คือ...?' });
  }, 3200);

  setTimeout(() => console.log('\n=== จบ flow ==='), 6000);
})();
