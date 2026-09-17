// ประกาศผลรอบ "ดวงเลือกคุณ" — ข้อความสาธารณะต้องไม่มีชื่อ ไม่มีคำต้องห้าม และวันที่ต้องคิดสด
const { test, describe } = require('node:test');
const assert = require('node:assert');

process.env.TEST_MODE = 'true';
process.env.LINE_CHANNEL_ACCESS_TOKEN = '';
const ann = require('../src/services/pickAnnounce');

describe('รอบถัดไป (คิดสดจากวันจริง)', () => {
  test('สมัคร 15 ก.ย. → ทันรอบ 2 ต.ค. เส้นตาย 18 ก.ย.', () => {
    const r = ann.nextRound(new Date(2026, 8, 15));
    assert.equal(r.round, '2 ตุลาคม');
    assert.equal(r.cutoff, '18 กันยายน');
  });
  test('สมัคร 3 ก.ย. → ทันรอบ 17 ก.ย. พอดี', () => {
    const r = ann.nextRound(new Date(2026, 8, 3));
    assert.equal(r.round, '17 กันยายน');
    assert.equal(r.cutoff, '3 กันยายน');
  });
  test('สมัคร 4 ก.ย. → ไม่ทัน 17 ก.ย. ต้องรอ 2 ต.ค.', () => {
    assert.equal(ann.nextRound(new Date(2026, 8, 4)).round, '2 ตุลาคม');
  });
  test('รอบหลังวันคัด 17 ก.ย. คือ 2 ต.ค. · หลัง 2 ต.ค. คือ 17 ต.ค. · ข้ามปีได้', () => {
    assert.equal(ann.roundAfter(new Date(2026, 8, 17)).getDate(), 2);
    assert.equal(ann.roundAfter(new Date(2026, 8, 17)).getMonth(), 9);
    assert.equal(ann.roundAfter(new Date(2026, 9, 2)).getDate(), 17);
    const y = ann.roundAfter(new Date(2026, 11, 17));
    assert.equal(y.getFullYear(), 2027); assert.equal(y.getMonth(), 0); assert.equal(y.getDate(), 2);
  });
});

describe('ข้อความประกาศสาธารณะ', () => {
  // bon 17 ก.ย. 69: "399 ใครเป็นสมาชิกมีสิทธิ์ลุ้นดูดวงกับอาจารย์ ประกาศชื่อเมื่อถึงเวลา
  //                  ให้นัดดูหลังจากนั้น" · ภาษาไทยชัดถ้อยชัดคำ ไม่ให้ใครเข้าใจผิด
  const at = new Date(2026, 8, 17, 9, 0);
  const text = ann.announceText({ at, name: 'ส้ม', total: 38 });

  test('ประกาศชื่อผู้ได้รับรางวัลชัด ๆ', () => {
    assert.ok(text.includes('ผู้โชคดีรอบนี้ คือ คุณ ส้ม'));
    assert.ok(text.includes('ได้ดูดวงตัวต่อตัวกับอาจารย์ปรินนี่ฟรี 1 ชั่วโมง'));
    assert.ok(text.includes('ทีมงานจะติดต่อผู้ได้รับรางวัลเพื่อนัดเวลา'));
  });
  test('บอกว่าใครมีสิทธิ์ลุ้น: สมาชิก 399 บาท ครบ 14 วัน รอบละ 1 ท่าน', () => {
    assert.ok(text.includes('อยากมีสิทธิ์ลุ้นรอบ 2 ตุลาคม ทำแบบนี้ค่ะ'));
    assert.ok(text.includes('กรอกวัน เวลา และสถานที่เกิดให้ครบ'));
    assert.ok(text.includes('ต่ออายุสมาชิกให้ยังใช้งานได้ในวันจับรางวัล'));
    assert.ok(text.includes('สมาชิก Prinnie333 (399 บาท / 30 วัน)'));
    assert.ok(text.includes('ครบ 14 วัน'));
    assert.ok(text.includes('รอบละ 1 ท่าน'));
  });
  test('ไม่มีถ้อยคำที่เคยทำให้คนเข้าใจผิด (ทั้งสองบัญชี)', () => {
    for (const t of [text, ann.announceText({ at, name: 'ส้ม', total: 5, forOA2: true })]) {
      for (const w of ann.BANNED) assert.ok(!t.includes(w), `ไม่ควรมี "${w}"`);
    }
  });
  test('บอกจำนวนผู้มีสิทธิ์ · วันรอบนี้ · รอบถัดไป · เส้นตายสมัคร · ลิงก์สมัคร', () => {
    assert.ok(text.includes('จากสมาชิกที่มีสิทธิ์ทั้งหมด 38 ท่าน'));
    assert.ok(text.includes('รอบ 17 กันยายน'));
    assert.ok(text.includes('จับรางวัลรอบถัดไป 2 ตุลาคม'));
    assert.ok(text.includes('(399 บาท / 30 วัน) ภายใน 18 กันยายน'));
    // จับวันที่ 15 (สมมติ) รอบหน้า 17 ก.ย. คนสมัครวันนี้ไม่ทัน → ต้องบอกรอบที่ทันจริง
    const t15 = ann.announceText({ at: new Date(2026, 8, 15), name: 'ส้ม', total: 38 });
    assert.ok(t15.includes('จับรางวัลรอบถัดไป 17 กันยายน'));
    assert.ok(t15.includes('คนที่สมัครวันนี้ จะมีสิทธิ์รอบ 2 ตุลาคม (สมัครภายใน 18 กันยายน)'));
    assert.ok(text.includes(ann.SIGNUP_URL));
  });
  test('บัญชีใหญ่บอกก่อนว่าบริการคืออะไร · บัญชีบริการไม่ต้อง', () => {
    const oa2 = ann.announceText({ at, name: 'ส้ม', total: 38, forOA2: true });
    assert.ok(oa2.includes('Prinnie333 คือบริการดวงส่วนตัว'));
    assert.ok(!text.includes('Prinnie333 คือบริการดวงส่วนตัว'));
  });
  test('ไม่มีชื่อหรือจำนวน ก็ยังอ่านรู้เรื่อง ไม่เขียนว่า 0 ท่าน', () => {
    const t = ann.announceText({ at, total: 0 });
    assert.ok(t.includes('ผู้โชคดีรอบนี้ คือ สมาชิก 1 ท่าน'));
    assert.ok(!t.includes('0 ท่าน'));
  });
  test('ยาวไม่เกินขีดจำกัดข้อความ LINE (5000)', () => {
    assert.ok(text.length < 5000);
  });
  test('assertClean จับถ้อยคำที่ทำให้เข้าใจผิดได้', () => {
    assert.throws(() => ann.assertClean('🔮 ดวงเลือกคุณ รอบนี้'), /ดวงเลือกคุณ/);
  });
});

describe('บรอดแคสต์ภายใต้ TEST_MODE', () => {
  test('ถูกบล็อกทั้งสองบัญชี ไม่ throw ออกมา และไม่บอกว่า sent', async () => {
    const r = await ann.broadcastAnnouncement({ at: new Date(2026, 8, 17), detail: 'Pluto Trine Mercury', total: 38 });
    assert.notEqual(r.oa1, 'sent');
    assert.notEqual(r.oa2, 'sent');
  });
});
