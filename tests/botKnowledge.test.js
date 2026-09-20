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
