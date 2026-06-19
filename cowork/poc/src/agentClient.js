'use strict';
/**
 * agentClient.js — ชั้นคุยกับ Managed Agents session (มี 2 โหมด: LIVE / STUB)
 * -----------------------------------------------------------------------------
 * อ้างอิงสเปกจริง (managed-agents-2026-04-01):
 *   - create session ด้วย agent id + environment id
 *   - send `user.message` เพื่อเริ่ม/คุยต่อ
 *   - stream events: agent.message, agent.custom_tool_use, session.status_idle
 *   - เมื่อ session.status_idle.stop_reason.type === "requires_action":
 *       loop stop_reason.event_ids → หา agent.custom_tool_use ที่ค้าง → ทำงาน →
 *       send `user.custom_tool_result` (custom_tool_use_id = event id)
 *   - stop_reason.type === "end_turn" → จบรอบ เอา agent text ไปให้ staff (copilot)
 *   docs: platform.claude.com/docs/en/managed-agents/events-and-streaming
 *
 * interface (เรียกจาก orchestrator):
 *   new AgentClient({ agentId, environmentId, useStub, dispatch, onAssistant })
 *     dispatch({name, input}) -> Promise<resultObj>     // = tools.dispatch (รวม gating เงิน)
 *     onAssistant({sessionId, text, agentTag})            // ส่งคำตอบ agent ให้ copilot
 *   await createSession({ lineUserId }) -> sessionId
 *   await handleUserText(sessionId, text)
 */

function extractText(event) {
  // agent.message content: [{type:'text', text:'...'}, ...]
  const parts = event?.content || event?.message?.content || [];
  return parts.filter((p) => p && (p.type === 'text' || typeof p.text === 'string'))
    .map((p) => p.text).join('').trim();
}

class AgentClient {
  constructor({ agentId, environmentId, useStub, dispatch, onAssistant } = {}) {
    this.agentId = agentId;
    this.environmentId = environmentId;
    this.useStub = useStub ?? !agentId;
    this._dispatch = dispatch;          // ({name,input}) => Promise<result>
    this._onAssistant = onAssistant;    // ({sessionId, text, agentTag}) => void
    this._toolUseById = new Map();      // event id -> {name, input}  (สำหรับ LIVE)
    this._locks = new Map();            // sessionId -> Promise (กันรอบซ้อน)

    if (!this.useStub) {
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      // SDK ตั้ง beta header managed-agents-2026-04-01 ให้อัตโนมัติ
      console.log('[agentClient] โหมด LIVE (Managed Agents)');
    } else {
      console.log('[agentClient] โหมด STUB (จำลอง — ไม่เรียก API)');
    }
  }

  async createSession({ lineUserId }) {
    if (this.useStub) return 'sess_stub_' + lineUserId;
    // NOTE: ถ้า SDK เวอร์ชันที่ติดตั้งใช้ camelCase ให้เปลี่ยนเป็น { agent, environmentId }
    const session = await this.client.beta.sessions.create({
      agent: this.agentId,
      environment_id: this.environmentId,
    });
    return session.id;
  }

  // ส่งข้อความลูกค้า แล้วประมวลผลจนจบ 1 turn (กันรอบซ้อนด้วย lock ต่อ session)
  async handleUserText(sessionId, text) {
    const prev = this._locks.get(sessionId) || Promise.resolve();
    const run = prev.catch(() => {}).then(() =>
      this.useStub ? this._runStub(sessionId, text) : this._runLive(sessionId, text));
    this._locks.set(sessionId, run);
    return run;
  }

  // ---------------- LIVE ----------------
  async _runLive(sessionId, text) {
    await this.client.beta.sessions.events.send(sessionId, {
      events: [{ type: 'user.message', content: [{ type: 'text', text }] }],
    });
    await this._consume(sessionId);
  }

  async _consume(sessionId) {
    const textBuf = [];
    const stream = await this.client.beta.sessions.events.stream(sessionId);
    for await (const event of stream) {
      switch (event.type) {
        case 'agent.custom_tool_use':
          this._toolUseById.set(event.id, { name: event.name, input: event.input });
          break;
        case 'agent.message': {
          const t = extractText(event);
          if (t) textBuf.push(t);
          break;
        }
        case 'session.status_idle': {
          const stop = event.stop_reason;
          if (stop?.type === 'requires_action') {
            // NOTE: gating เงินอยู่ใน dispatch → อาจ await นาน (รอ staff). PoC ยอมถือ stream ไว้;
            //       prod ควรส่ง result แบบ async แยกจาก loop
            for (const id of stop.event_ids || []) {
              const tu = this._toolUseById.get(id);
              if (!tu) continue;
              // ส่ง sessionId ไปด้วย → orchestrator ฉีด line_user_id ที่ถูกต้องของ session นี้
              // (ไม่เชื่อ id ที่ agent กรอกเอง — กันตอบผิดคน)
              const result = await this._dispatch({ name: tu.name, input: tu.input, sessionId });
              await this.client.beta.sessions.events.send(sessionId, {
                events: [{ type: 'user.custom_tool_result', custom_tool_use_id: id,
                           content: [{ type: 'text', text: JSON.stringify(result) }] }],
              });
              this._toolUseById.delete(id);
            }
            // session กลับไป running แล้ว stream จะส่ง event ต่อ — วน loop ต่อ
          } else if (stop?.type === 'end_turn') {
            const finalText = textBuf.join('\n').trim();
            if (finalText) this._onAssistant({ sessionId, text: finalText, agentTag: 'prinnie-triage' });
            return; // จบ turn
          }
          break;
        }
        case 'session.error':
          console.error('[agentClient] session.error', event);
          return;
        default:
          break;
      }
    }
  }

  // ---------------- STUB (จำลอง triage → B จ่ายเงิน / U ไม่เข้าข่าย) ----------------
  async _runStub(sessionId, text) {
    const lineUserId = sessionId.replace(/^sess_stub_/, '');
    const looksPayment = /จ่าย|ชำระ|เงิน|บัตร|สิทธิ์|คืนเงิน|โอน/.test(text || '');

    if (looksPayment) {
      const mm = await this._dispatch({ name: 'detect_mismatch', input: { line_user_id: lineUserId }, sessionId });
      if (mm.mismatch) {
        const act = await this._dispatch({
          name: 'activate_subscription',
          input: { line_user_id: lineUserId, days: mm.suggested_days,
                    reason: `stripe ${mm.charge_id} จ่าย ${mm.paid_amount} สำเร็จ แต่ DB ${mm.db_status}` },
          sessionId,
        });
        const msg = act.ok && act.activated
          ? `ตรวจสอบแล้วพบว่าคุณชำระเงินเรียบร้อยค่ะ ทีมงานเปิดสิทธิ์ให้แล้ว ใช้งานได้ถึง ${String(act.new_expiry).slice(0,10)} ขออภัยในความไม่สะดวกนะคะ 🙏`
          : `ตรวจสอบแล้วกำลังให้ทีมงานดำเนินการเปิดสิทธิ์ให้นะคะ จะรีบติดต่อกลับโดยเร็วค่ะ`;
        this._onAssistant({ sessionId, text: msg, agentTag: 'prinnie-payment' });
      }
    } else {
      // เคส U: escalate reason=unknown + ถามกลับ (staff จะกดส่ง draft จาก console)
      await this._dispatch({
        name: 'escalate_to_human',
        sessionId,
        input: {
          line_user_id: lineUserId, reason: 'unknown',
          summary: 'ข้อความกำกวม ไม่เข้าข่าย A–F — ต้องถามลูกค้าว่าต้องการช่วยด้านใด',
          draft_reply: 'ขอบคุณที่ทักมานะคะ 🙏 ไม่ทราบว่าต้องการให้ช่วยเรื่องใดดีคะ — เช่น (1) สมัคร/บริการ (2) ปัญหาการจ่ายเงิน (3) ดวงไม่ขึ้น/แก้วันเกิด (4) สอบถามความหมายดวง หรือพิมพ์เล่าได้เลยค่ะ',
          last_message: text,
        },
      });
    }
  }
}

module.exports = { AgentClient };
