'use strict';
/**
 * orchestrator.js — เชื่อม Managed Agents ↔ tools (gating) ↔ copilot (staff)
 * -----------------------------------------------------------------------------
 * ฉีด 2 callback เข้า AgentClient:
 *   dispatch({name,input}) → tools.dispatch  (รวม gating activate/refund)
 *   onAssistant({sessionId,text,agentTag}) → copilot.handleAgentReply (ขึ้นจอ staff)
 * เก็บ map: lineUserId ↔ sessionId เพื่อคุยต่อเนื่อง
 */
const { AgentClient } = require('./agentClient');
const tools = require('./tools');
const copilot = require('./copilot');

class Orchestrator {
  constructor({ agentId, environmentId, useStub } = {}) {
    this.sessionByUser = new Map();
    this.userBySession = new Map();
    this.client = new AgentClient({
      agentId, environmentId, useStub,
      dispatch: ({ name, input, sessionId }) => {
        // ฉีด line_user_id ที่ผูกกับ session นี้ทับเสมอ — ไม่เชื่อค่าที่ agent กรอกมา (กันตอบผิดคน)
        const lineUserId = this.userBySession.get(sessionId);
        const safeInput = lineUserId ? { ...input, line_user_id: lineUserId } : input;
        return tools.dispatch({ name, input: safeInput });
      },
      onAssistant: ({ sessionId, text, agentTag }) => {
        const lineUserId = this.userBySession.get(sessionId);
        // NOTE(phase2): ถ้าต้องการ auto-send เฉพาะ faq/account ต้องอ่าน identity ของ subagent
        //   จาก event (เช่น agent id) แล้ว map เป็น agentTag — ตอนนี้ default=triage (ปลอดภัย: ทุกอย่างผ่าน staff)
        copilot.handleAgentReply({ lineUserId, text, agentTag: agentTag || 'prinnie-triage' });
      },
    });
  }

  /** เรียกจาก LINE webhook เมื่อมีข้อความเข้า */
  async handleIncoming({ lineUserId, text }) {
    let sessionId = this.sessionByUser.get(lineUserId);
    if (!sessionId) {
      sessionId = await this.client.createSession({ lineUserId });
      this.sessionByUser.set(lineUserId, sessionId);
      this.userBySession.set(sessionId, lineUserId);
    }
    await this.client.handleUserText(sessionId, text);
  }
}

module.exports = { Orchestrator };
