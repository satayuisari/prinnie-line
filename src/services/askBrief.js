// เตรียม brief หน้าเดียวให้ อ.ปรินนี่ ก่อนตอบ Ask Prinnie 3
//
// 🎯 หน้าที่ของ AI ตรงนี้คือ "จัดของบนโต๊ะให้อาจารย์" ไม่ใช่ดูดวงแทน:
//    ดึงข้อมูลดวงที่ระบบคำนวณไว้แล้ว + คำถามลูกค้า → สรุปว่าถามอะไร ดวงเกี่ยวข้องตรงไหน
//    ห้ามเขียนคำทำนาย ห้ามสรุปว่าจะเกิดอะไรขึ้น — อาจารย์เป็นคนตัดสินคำตอบเสมอ
//
// ถ้าไม่มี ANTHROPIC_API_KEY → คืน brief แบบข้อมูลดิบ (อาจารย์ยังทำงานได้ ไม่บล็อกคิว)
const db = require('../db');

const MODEL = process.env.ASK_BRIEF_MODEL || 'claude-sonnet-5';

const SYSTEM = `คุณเป็นผู้ช่วยเตรียมงานให้ "อาจารย์ปรินนี่" นักโหราศาสตร์ ไม่ใช่คนดูดวงเอง

งานของคุณ: อ่านข้อมูลดวงกำเนิดที่ระบบคำนวณมาแล้ว + คำถามของลูกค้า
แล้วสรุปเป็น brief หน้าเดียวให้อาจารย์เปิดแล้วตอบได้เลย

กติกาสำคัญ:
- ห้ามเขียนคำทำนายหรือคำตอบแทนอาจารย์เด็ดขาด
- ห้ามสรุปว่า "จะเกิด/จะได้/จะเสีย" อะไร
- ให้ระบุเฉพาะ "ข้อมูลดวงที่เกี่ยวข้องกับคำถามนี้" และ "จุดที่อาจารย์ควรพิจารณา"
- ถ้าข้อมูลไม่พอ (เช่น ไม่รู้เวลาเกิด → ลัคนาไม่แม่น) ให้บอกตรง ๆ ว่าข้อมูลจำกัดตรงไหน
- ภาษาไทย กระชับ เป็นหัวข้อ อ่านจบใน 1 นาที

รูปแบบผลลัพธ์:
【ลูกค้า】ชื่อ · ข้อมูลเกิดโดยย่อ
【ดวงโดยสรุป】อาทิตย์/จันทร์/ลัคนา + ดาวเด่นที่เกี่ยวกับคำถาม
【คำถาม 1】...
  - ข้อมูลดวงที่เกี่ยวข้อง: ...
  - จุดที่ควรพิจารณา: ...
【คำถาม 2】... (รูปแบบเดียวกัน)
【คำถาม 3】... (รูปแบบเดียวกัน)
【ข้อจำกัดของข้อมูล】... (ถ้ามี)`;

function client() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic();
}

// brief สำรองเมื่อไม่มี AI — ข้อมูลดิบเรียงให้อ่านง่าย อาจารย์ยังตอบได้ปกติ
function plainBrief(sub, questions) {
  const c = sub.chart_data || {};
  return [
    `【ลูกค้า】${sub.nickname || sub.display_name || '(ไม่มีชื่อ)'}`,
    `เกิด ${sub.birth_date || '-'} ${sub.birth_time || '(ไม่ทราบเวลา)'} · ${sub.birth_place || '-'}`,
    ``,
    `【ดวงโดยสรุป】`,
    `อาทิตย์: ${c.sun || '-'} · จันทร์: ${c.moon || '-'} · ลัคนา: ${c.rising || '-'}`,
    sub.birth_time ? '' : '⚠️ ไม่ทราบเวลาเกิด — ลัคนาอาจคลาดเคลื่อน',
    ``,
    ...questions.map((q, i) => `【คำถาม ${i + 1}】${q}`),
    ``,
    '(ไม่ได้ตั้ง ANTHROPIC_API_KEY — นี่คือข้อมูลดิบ ไม่มีสรุปช่วย)',
  ].filter(Boolean).join('\n');
}

async function build(rewardId) {
  const r = (await db.query(
    `SELECT r.id, r.questions, r.line_user_id,
            s.nickname, s.display_name, s.birth_date, s.birth_time, s.birth_place, s.chart_data
     FROM loyalty_rewards r
     LEFT JOIN line_subscribers s ON s.line_user_id = r.line_user_id
     WHERE r.id = $1`, [Number(rewardId)])).rows[0];
  if (!r) throw new Error('ไม่พบสิทธิ์นี้');

  const questions = Array.isArray(r.questions) ? r.questions : [];
  if (!questions.length) throw new Error('ลูกค้ายังไม่ได้ส่งคำถาม');

  const api = client();
  if (!api) return plainBrief(r, questions);

  const payload = {
    ลูกค้า: r.nickname || r.display_name || '(ไม่มีชื่อ)',
    วันเกิด: r.birth_date, เวลาเกิด: r.birth_time || '(ไม่ทราบ)', สถานที่เกิด: r.birth_place,
    ดวงกำเนิด: r.chart_data || {},
    คำถาม: questions,
  };

  try {
    const msg = await api.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(payload, null, 1) }],
    });
    const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return text || plainBrief(r, questions);
  } catch (e) {
    console.error('[askBrief]', e.message);
    return plainBrief(r, questions) + `\n\n(สรุปด้วย AI ไม่สำเร็จ: ${e.message})`;
  }
}

module.exports = { build, plainBrief, MODEL };
