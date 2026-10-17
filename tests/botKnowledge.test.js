// "เปิดแคมเปญแล้วลืมอัปเดตบอท" — 17 ก.ย. 69 บอทบอกผู้ได้รางวัลตัวจริงว่าเป็นข้อความหลอกลวง
// ตอนนี้ถ้า SYSTEM ไม่รู้จักโปรแกรมที่เปิดอยู่ บอทจะเงียบให้ staff ตอบ แทนที่จะตอบผิด
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const helpers = require('./helpers');

helpers.prepareEnv('botknowledge');
const ai = require('../src/services/supportAI');
after(async () => { await require('../src/db').end(); });

describe('บอทต้องรู้จักโปรแกรมที่เปิดขายอยู่', () => {
  test('SYSTEM ปัจจุบันรู้จักทุกโปรแกรมที่เปิดอยู่', () => {
    process.env.LOYALTY_ENABLED = 'true';
    assert.deepEqual(ai.knowledgeGaps(), []);
  });
  test('ลืมใส่เรื่องจับรางวัล = จับได้ตอนเปิดโปรแกรม', () => {
    process.env.LOYALTY_ENABLED = 'true';
    assert.deepEqual(ai.knowledgeGaps('สมาชิก 399 บาท · ผูกดวงคู่ 199 บาท'),
                     ['จับรางวัลดูดวงฟรี']);
  });
  test('โปรแกรมที่ปิดอยู่ ไม่ต้องอยู่ใน SYSTEM', () => {
    process.env.LOYALTY_ENABLED = 'false';
    assert.deepEqual(ai.knowledgeGaps('สมาชิก 399 บาท · ผูกดวงคู่ 199 บาท'), []);
  });
  test('ราคาและบริการหลักต้องอยู่เสมอ', () => {
    process.env.LOYALTY_ENABLED = 'false';
    assert.deepEqual(ai.knowledgeGaps('ยินดีต้อนรับค่ะ').sort(),
                     ['ผูกดวงคู่', 'สมาชิก 399']);
  });
  test('generate เงียบเมื่อมีช่องว่าง แทนที่จะตอบผิด', async () => {
    process.env.LOYALTY_ENABLED = 'true';
    const real = ai.LIVE_PROGRAMS[0].mustSay;
    ai.LIVE_PROGRAMS[0].mustSay = ['คำที่ SYSTEM ไม่มีแน่ ๆ'];
    try {
      assert.equal(await ai.generate('ได้ดูดวงฟรีจริงไหมคะ', 'general', null), null);
    } finally {
      ai.LIVE_PROGRAMS[0].mustSay = real;
    }
  });
});

// 17 ต.ค. 69 bon: "ทำให้บอทฉลาดขึ้นหน่อยเวลาเลือกตอบคำถาม" — ลูกค้าขอนัดดูกับอาจารย์ถูกบอทตอบว่าทักผิดบัญชี
describe('เลือกคำตอบตามเจตนา', () => {
  const triage = require('../src/services/supportTriage');
  test('อยากนัดดูดวงกับอาจารย์ = booking ด่วน ไม่ใช่ทั่วไป', () => {
    for (const t of ['จองคิวดูดวงค่ะ', 'เดือนนี้อาจารย์ว่างวันไหนบ้างคะ', 'หมายถึงดูส่วนตัวทางโทรศัพท์กับอาจารย์', 'อ.ปรินนี่ มีรับดูแบบ รายชั่วโมง']) {
      const r = triage.classify(t);
      assert.equal(r.category, 'booking', t);
      assert.equal(r.priority, 'high', t);
    }
  });
  test('SYSTEM ห้ามตอบ "ทักผิดบัญชี" กับคนขอนัดดูกับอาจารย์ และมีขั้นตอนต่ออายุ', () => {
    const { SYSTEM_TEXT } = ai;
    assert.match(SYSTEM_TEXT, /นัดดูดวงส่วนตัวกับอาจารย์.*ห้ามบอกว่าทักผิดบัญชี/);
    assert.match(SYSTEM_TEXT, /"ต่อค่า"/);
    assert.match(SYSTEM_TEXT, /ไพ่ทาโรต์ไม่ได้ส่งให้เอง/);
  });
});
