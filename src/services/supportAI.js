// AI ร่างคำตอบ support (copilot — staff ตรวจก่อนส่งเสมอ)
// ใช้ Anthropic SDK. ต้องตั้ง ANTHROPIC_API_KEY; ไม่ตั้ง → คืน enabled:false (ปุ่ม AI ซ่อน, staff พิมพ์เองได้)
const db = require('../db');

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const Anthropic = require('@anthropic-ai/sdk');
  client = new Anthropic();
  return client;
}
const MODEL = process.env.SUPPORT_MODEL || 'claude-opus-4-8';

const SYSTEM = `คุณคือผู้ช่วยทีมงาน Prinnie333 — บริการ "ดวงส่วนตัวรายวัน" บน LINE (คำนวณจากวันเกิดจริง ไม่ใช่ดวง 12 ราศีทั่วไป)
ร่างคำตอบลูกค้าเป็นภาษาไทย โทนอบอุ่น สุภาพ กระชับ เหมือนแอดมินหญิงใจดี ลงท้ายเป็นกันเอง

บริการ: พื้นดวงส่วนตัว(ฟรี), ดวงรายวันส่งทุกเช้า, ไพ่ทาโรต์, ผูกดวงคู่ — สมัครสมาชิก 399 บาท/เดือน
ทางเข้า: กดเมนู หรือพิมพ์ "ช่วยเหลือ"

กฎเหล็ก:
- ห้ามทำนายเรื่องสุขภาพ/ความตาย/ฟันธงแง่ร้าย
- เรื่องจ่ายเงิน/คืนเงิน/เปิดสิทธิ์ → อย่าสัญญาเอง บอกว่า "ทีมงานจะตรวจสอบและดำเนินการให้"
- ลูกค้าเครียด/โกรธ → ตอบด้วยความเข้าอกเข้าใจ ไม่โต้เถียง
- ไม่รู้คำตอบ → เสนอให้พิมพ์ "ช่วยเหลือ" หรือบอกว่าทีมงานจะติดต่อกลับ
ตอบเฉพาะ "ข้อความที่จะส่งให้ลูกค้า" เท่านั้น ไม่ต้องมีคำอธิบายอื่น`;

async function draft(inboxId, message) {
  const c = getClient();
  if (!c) return { enabled: false };
  try {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: 'user', content: `ลูกค้าพิมพ์มาว่า: "${message}"\n\nช่วยร่างคำตอบให้หน่อย` }],
    });
    const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (text) await db.query(`UPDATE support_inbox SET ai_draft=$2 WHERE id=$1`, [inboxId, text]);
    return { enabled: true, draft: text };
  } catch (e) {
    console.error('[supportAI] error:', e.message);
    return { enabled: true, error: e.message };
  }
}

const isEnabled = () => !!process.env.ANTHROPIC_API_KEY;

module.exports = { draft, isEnabled };
