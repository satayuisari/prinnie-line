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
ห้ามใช้ markdown (เช่น **ตัวหนา**, #หัวข้อ, - bullet) — LINE แสดงเป็นอักขระดิบ ใช้ข้อความธรรมดา + อิโมจิ + ขึ้นบรรทัดใหม่เท่านั้น
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

// generate — คำตอบที่ "ส่งให้ลูกค้าตรง" (auto-reply) ตาม persona หมวด
// ใช้เฉพาะหมวดปลอดภัย (astro/general/faq) — เงิน/อารมณ์/โกรธ ไม่เรียกตัวนี้ (ให้คนตอบ)
const NUANCE = {
  astro: 'ลูกค้าถามเรื่องดวง/บริการดูดวง — อธิบายอย่างอบอุ่น โทนบวก ชวนกรอกวันเกิด/แอดรับพื้นดวงฟรี ห้ามทำนายฟันธงแง่ร้าย',
  general: 'ลูกค้าถามทั่วไป/สนใจบริการ — แนะนำบริการสั้น ๆ ชวนเริ่มรับพื้นดวงฟรี หรือพิมพ์ "ช่วยเหลือ" ดูเมนู',
  payment: 'ลูกค้าถามเรื่องสมัคร/ราคา/สถานะสมาชิก — ตอบตาม "สถานะจริง" ในข้อมูลลูกค้าด้านล่างเท่านั้น. ยังไม่สมัคร/หมดอายุ → ชวนสมัคร/ต่ออายุ 399 บาท/เดือน พร้อมลิงก์. ถ้า ACTIVE → บอกวันหมดอายุ. ⚠️ ห้ามสัญญาคืนเงิน/เปิดสิทธิ์/ยืนยันการชำระเอง — ถ้าลูกค้าสงสัยเรื่องเงิน บอกว่าทีมงานจะตรวจสอบให้',
  faq: 'ตอบคำถามบริการทั่วไป กระชับ ชัดเจน',
};

// ctx = บริบทลูกค้าจริง (สถานะสมาชิก/ชื่อ) ดึงจาก DB — ให้บอทตอบตรงตัวบุคคล ไม่เดา
async function generate(message, category, ctx) {
  const c = getClient();
  if (!c) return null;
  const ctxBlock = ctx ? `\n\nข้อมูลลูกค้าคนนี้ (อ้างอิงให้ตรง ห้ามเดานอกเหนือจากนี้):\n${ctx}` : '';
  try {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM + '\n\nบริบทหมวดนี้: ' + (NUANCE[category] || NUANCE.general) + ctxBlock,
      messages: [{ role: 'user', content: `ลูกค้าพิมพ์มาว่า: "${message}"` }],
    });
    const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return text || null;
  } catch (e) {
    console.error('[supportAI] generate error:', e.message);
    return null;
  }
}

const isEnabled = () => !!process.env.ANTHROPIC_API_KEY;

module.exports = { draft, generate, isEnabled };
