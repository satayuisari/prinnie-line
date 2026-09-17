// ข้อความเรื่องสลิป — bon 17 ก.ย. 69: ลูกค้าบอกว่าโอนแล้วแต่ไม่มีสลิป บอทต้องบอกให้ส่งใหม่ ไม่เงียบ
const { test, describe } = require('node:test');
const assert = require('node:assert');
const h = require('../src/services/slipHelp');

describe('จับว่าลูกค้าบอกว่าจ่ายแล้ว', () => {
  test('ประโยคที่ลูกค้าพิมพ์จริง', () => {
    for (const t of ['โอนแล้วค่ะ', 'จ่ายเงินแล้วนะคะ', 'ส่งสลิปไปแล้ว', 'เงินออกแล้วแต่ยังใช้ไม่ได้']) assert.ok(h.claimsPaid(t), t);
  });
  test('คำถามทั่วไปไม่นับ', () => {
    for (const t of ['สนใจดูดวงส่วนตัวค่ะ', 'ราคาเท่าไหร่', '']) assert.ok(!h.claimsPaid(t), t);
  });
});

describe('คำตอบตามสถานะออเดอร์', () => {
  test('ยังไม่มีสลิป → ขอให้ส่งรูปสลิป ไม่ต้องโอนซ้ำ', () => {
    const t = h.claimReply({ ref: 'r', type: 'subscription', amount: 39900, slip_message_id: null });
    assert.ok(t.includes('ยังไม่ได้รับรูปสลิป'));
    assert.ok(t.includes('ไม่ต้องโอนซ้ำ'));
    assert.ok(!t.includes('สมัครสมาชิก" ก่อน'));
  });
  test('ไม่มีออเดอร์ → บอกให้กดสมัครก่อน', () => {
    assert.ok(h.claimReply(null).includes('กดเมนู "สมัครสมาชิก" ก่อน'));
  });
  test('มีสลิปแล้ว → บอกว่ากำลังตรวจ ไม่ขอสลิปซ้ำ ไม่ยืนยันว่าเงินเข้า', () => {
    const t = h.claimReply({ slip_message_id: 'm1', type: 'subscription', amount: 39900 });
    assert.ok(t.includes('กำลังตรวจสอบ'));
    assert.ok(!t.includes('ยังไม่ได้รับ'));
    assert.ok(!/เปิดใช้งานเรียบร้อย|ได้รับเงินแล้ว/.test(t));
  });
});

describe('ข้อความเตือนออเดอร์ค้าง', () => {
  const round = { round: '2 ตุลาคม', cutoff: '18 กันยายน' };
  test('สมาชิก: บอกทั้งกรณีโอนแล้วและยังไม่โอน + ลิงก์ + รอบลุ้น', () => {
    const t = h.reminderText({ name: 'Dao', order: { type: 'subscription', amount: 39900 }, payUrl: 'https://p/x', round });
    assert.ok(t.startsWith('สวัสดีค่ะ คุณ Dao'));
    assert.ok(t.includes('สมาชิก Prinnie333 (399 บาท) ของคุณ'));
    assert.ok(t.includes('ถ้าโอนแล้ว') && t.includes('ถ้ายังไม่ได้โอน'));
    assert.ok(t.includes('https://p/x'));
    assert.ok(t.includes('สมัครภายใน 18 กันยายน'));
  });
  test('ดวงคู่: ไม่พูดถึงการจับรางวัล · ไม่มีชื่อก็ทักได้', () => {
    const t = h.reminderText({ order: { type: 'couple', amount: 19900 }, payUrl: 'u', round });
    assert.ok(t.startsWith('สวัสดีค่ะ\n'));
    assert.ok(t.includes('ปลดล็อกผลดวงคู่ (199 บาท)'));
    assert.ok(!t.includes('ลุ้น'));
  });
});
