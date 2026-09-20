// ด่านถ้อยคำก่อนส่ง — เขียนหลังเหตุจริง 16–17 ก.ย. 69
// ข้อความเปิดตัวหัว "ดวงเลือกคุณ" ถูกบรอดแคสต์หาทุกคน คนอ่านคิดว่าตัวเองได้รางวัล
// และบอทตอบผู้ได้รางวัลตัวจริงว่าน่าจะเป็นข้อความหลอกลวง เพราะ SYSTEM ยังไม่รู้จักโปรแกรม
const { test, describe } = require('node:test');
const assert = require('node:assert');
const helpers = require('./helpers');

helpers.prepareEnv('copyguard');
const guard = require('../src/services/copyGuard');

describe('คำที่เคยทำให้คนเข้าใจผิด', () => {
  test('หัวข้อความที่ทำให้ทุกคนคิดว่าตัวเองได้ = ส่งไม่ได้', () => {
    assert.throws(() => guard.assertClean('✨ ดวงเลือกคุณ เดือนนี้'), /ดวงเลือกคุณ/);
    assert.throws(() => guard.assertClean('เจ้าของดวงจะได้ดูดวงฟรี'), /เจ้าของดวง/);
  });
  test('ศัพท์โหราศาสตร์ในประกาศ = ส่งไม่ได้', () => {
    for (const w of ['ตรีโกณ', 'ทำมุม', 'จังหวะสำคัญ']) {
      assert.throws(() => guard.assertClean(`ดาวพฤหัส${w}กับดวงคุณ`));
    }
  });
  test('คำที่ bon ปลดล็อกแล้ว ส่งได้ตามปกติ', () => {
    const ok = 'ผลจับรางวัลสมาชิก · ผู้โชคดีรอบนี้ คือ คุณ ส้ม · รอบหน้ารอลุ้นใหม่นะคะ';
    assert.equal(guard.assertClean(ok), ok);
  });
});

describe('ตรวจทั้งชุดข้อความ ไม่ใช่แค่ข้อความแรก', () => {
  test('คำต้องห้ามในใบที่สองก็ต้องโดนจับ', () => {
    assert.throws(() => guard.assertMessagesClean([
      { type: 'text', text: 'สวัสดีค่ะ' },
      { type: 'text', text: 'ดวงเลือกคุณ' },
    ]), /ดวงเลือกคุณ/);
  });
  test('คำต้องห้ามใน altText ของ flex ก็เข้าใจผิดได้เหมือนกัน', () => {
    assert.throws(() => guard.assertMessagesClean(
      { type: 'flex', altText: 'ดวงเลือกคุณ', contents: { type: 'bubble' } }));
  });
  test('คำต้องห้ามในปุ่มลึก ๆ ก็ต้องโดน', () => {
    assert.throws(() => guard.assertMessagesClean({
      type: 'template',
      template: { type: 'buttons', text: 'สมัครสมาชิก',
                  actions: [{ type: 'uri', label: 'เจ้าของดวง', uri: 'https://x' }] },
    }), /เจ้าของดวง/);
  });
  test('ชุดข้อความปกติผ่านฉลุย', () => {
    const msgs = [{ type: 'text', text: '🎉 ผลจับรางวัลสมาชิก Prinnie333' }];
    assert.equal(guard.assertMessagesClean(msgs), msgs);
  });
});

describe('บรอดแคสต์ต้องผ่านด่านเสมอ (ลืมเรียกเองไม่ได้)', () => {
  test('lineMessaging.broadcast เรียกด่านก่อนส่ง', async () => {
    delete process.env.TEST_MODE;                 // ปลด TEST_MODE เพื่อให้ถึงด่านจริง
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'x';
    const lm = require('../src/services/lineMessaging');
    await assert.rejects(
      () => lm.broadcast([{ type: 'text', text: 'ดวงเลือกคุณ เดือนนี้' }]),
      /ดวงเลือกคุณ/);
    process.env.TEST_MODE = 'true';
  });
});
