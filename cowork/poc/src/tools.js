'use strict';
/**
 * tools.js — host-side implementation ของ custom tool ทุกตัว
 * -----------------------------------------------------------------------------
 * map: tool name (จาก agent.custom_tool_use) -> ฟังก์ชันที่เรียก prinnieServices
 * รูปแบบ output ตรงกับ ../tools-spec.md (ทุกตัวมี ok:boolean; error → {ok:false,error})
 * GATED = ต้องผ่าน staff approval ก่อน (จัดการที่ dispatch ด้านล่าง)
 */
const svc = require('./prinnieServices');
const approvals = require('./approvals');
const escalations = require('./escalations');

const GATED = new Set(['activate_subscription', 'issue_refund']);

const handlers = {
  async get_subscriber({ line_user_id }) {
    if (!line_user_id) return { ok: false, error: 'invalid_input' };
    const m = await svc.getMemberStatus(line_user_id);
    if (!m) return { ok: false, error: 'not_found' };
    return { ok: true, ...m };
  },

  async get_payment_status({ line_user_id, email }) {
    if (!line_user_id && !email) return { ok: false, error: 'invalid_input' };
    try {
      const p = await svc.getStripePayment({ lineUserId: line_user_id, email });
      return p && p.charge_id ? { ok: true, ...p } : { ok: true, paid: false };
    } catch (e) {
      return { ok: false, error: 'stripe_error', message: String(e.message || e) };
    }
  },

  async detect_mismatch({ line_user_id }) {
    if (!line_user_id) return { ok: false, error: 'invalid_input' };
    const [m, p] = await Promise.all([
      svc.getMemberStatus(line_user_id),
      svc.getStripePayment({ lineUserId: line_user_id }),
    ]);
    const paidOk = p && p.paid && p.status === 'succeeded';
    const dbActive = m && m.status === 'ACTIVE';
    if (paidOk && !dbActive) {
      return { ok: true, mismatch: true, charge_id: p.charge_id, paid_amount: p.amount,
               db_status: m ? m.status : 'NONE', suggested_days: svc.PLAN_DAYS[p.type] || 30 };
    }
    return { ok: true, mismatch: false };
  },

  // GATED — ฟังก์ชันจริงถูกเรียก "หลัง" อนุมัติแล้วเท่านั้น (ดู dispatch)
  async activate_subscription({ line_user_id, days, reason }) {
    if (!line_user_id || !days) return { ok: false, error: 'invalid_input' };
    const r = await svc.activateSubscription(line_user_id, days, reason);
    return { ok: true, ...r };
  },

  async issue_refund({ payment_ref, amount, reason }) {
    if (!payment_ref) return { ok: false, error: 'invalid_input' };
    const r = await svc.refund(payment_ref, amount, reason);
    return { ok: true, ...r };
  },

  async send_liff_link({ line_user_id, view }) {
    if (!line_user_id) return { ok: false, error: 'invalid_input' };
    const r = await svc.sendLiff(line_user_id, view);
    return { ok: true, ...r };
  },

  async recompute_chart({ line_user_id }) {
    if (!line_user_id) return { ok: false, error: 'invalid_input' };
    const r = await svc.recomputeChart(line_user_id);
    return { ok: true, ...r };
  },

  async resend_daily({ line_user_id }) {
    if (!line_user_id) return { ok: false, error: 'invalid_input' };
    const m = await svc.getMemberStatus(line_user_id);
    if (!m || m.status !== 'ACTIVE') return { ok: false, error: 'not_active' };
    const r = await svc.resendDaily(line_user_id);
    return { ok: true, ...r };
  },

  async get_user_chart({ line_user_id }) {
    if (!line_user_id) return { ok: false, error: 'invalid_input' };
    const c = await svc.getUserChart(line_user_id);
    if (!c) return { ok: false, error: 'not_found' };
    return { ok: true, ...c };
  },

  async escalate_to_human({ line_user_id, reason, summary, draft_reply, last_message }) {
    const t = escalations.create({ lineUserId: line_user_id, reason, summary, draftReply: draft_reply, lastMessage: last_message });
    return { ok: true, queued: true, ticket_id: t.id, priority: t.priority };
  },
};

/**
 * dispatch — เรียกจาก orchestrator เมื่อได้ event agent.custom_tool_use
 * จัดการ gating ของ activate/refund ที่นี่ (permission policy ไม่ครอบ custom tool)
 */
async function dispatch({ name, input }) {
  const fn = handlers[name];
  if (!fn) return { ok: false, error: 'invalid_input', message: `unknown tool: ${name}` };

  if (GATED.has(name)) {
    const decision = await approvals.requestApproval({ toolName: name, input, lineUserId: input.line_user_id });
    if (!decision.approved) {
      return { ok: false, error: 'rejected_by_staff', message: decision.note || '' };
    }
    const result = await fn(input);
    if (result.ok) result.approved_by = decision.approvedBy;
    return result;
  }

  return fn(input);
}

module.exports = { dispatch, handlers, GATED };
