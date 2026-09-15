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
  const at = new Date(2026, 8, 17, 9, 0);
  const text = ann.announceText({ at, detail: 'Pluto Trine Mercury', total: 38 });

  test('ไม่มีคำต้องห้ามสักคำ (ทั้งสองบัญชี)', () => {
    for (const t of [text, ann.announceText({ at, detail: 'Saturn Square Sun', total: 5, forOA2: true })]) {
      for (const w of ann.BANNED) assert.ok(!t.includes(w), `ห้ามมีคำว่า "${w}"`);
    }
  });
  test('บอกดาวและมุมเป็นไทย ไม่บอกชื่อใคร', () => {
    assert.ok(text.includes('ดาวพลูโต'));
    assert.ok(text.includes('มุมตรีโกณ'));
    assert.ok(text.includes('ดาวพุธ'));
    assert.ok(!/SHGH|คุณ [A-Za-z]/.test(text));
  });
  test('บอกจำนวนดวงที่เข้าเกณฑ์ · วันรอบนี้ · รอบถัดไป · เส้นตายสมัคร · ลิงก์สมัคร', () => {
    assert.ok(text.includes('38 ดวง'));
    assert.ok(text.includes('รอบ 17 กันยายน'));
    assert.ok(text.includes('รอบถัดไป 2 ตุลาคม'));
    assert.ok(text.includes('สมัครภายใน 18 กันยายน ดวงของคุณทันรอบนี้'));
    // คัดวันที่ 15 (สมมติ) รอบหน้า 17 ก.ย. คนสมัครวันนี้ไม่ทัน → ต้องบอกรอบที่ทันจริง
    const t15 = ann.announceText({ at: new Date(2026, 8, 15), detail: 'Pluto Trine Mercury', total: 38 });
    assert.ok(t15.includes('รอบถัดไป 17 กันยายน'));
    assert.ok(t15.includes('ทันรอบ 2 ตุลาคม (สมัครภายใน 18 กันยายน)'));
    assert.ok(text.includes(ann.SIGNUP_URL));
  });
  test('บัญชีใหญ่มีคำอธิบายว่าสิทธิ์นี้คืออะไร · บัญชีบริการไม่ต้อง', () => {
    const oa2 = ann.announceText({ at, detail: 'Pluto Trine Mercury', total: 38, forOA2: true });
    assert.ok(oa2.includes('ทุกวันที่ 2 และ 17'));
    assert.ok(!text.includes('ทุกวันที่ 2 และ 17'));
  });
  test('detail แปลก ๆ ไม่พัง — ใช้คำกลาง', () => {
    const t = ann.announceText({ at, detail: '', total: 0 });
    assert.ok(t.includes('ดาวจร') && t.includes('มุมสำคัญ'));
    assert.ok(!t.includes('0 ดวง'));
  });
  test('ยาวไม่เกินขีดจำกัดข้อความ LINE (5000)', () => {
    assert.ok(text.length < 5000);
  });
  test('assertClean จับคำต้องห้ามได้', () => {
    assert.throws(() => ann.assertClean('รอบนี้ประกาศผลแล้ว'), /ประกาศผล/);
  });
});

describe('บรอดแคสต์ภายใต้ TEST_MODE', () => {
  test('ถูกบล็อกทั้งสองบัญชี ไม่ throw ออกมา และไม่บอกว่า sent', async () => {
    const r = await ann.broadcastAnnouncement({ at: new Date(2026, 8, 17), detail: 'Pluto Trine Mercury', total: 38 });
    assert.notEqual(r.oa1, 'sent');
    assert.notEqual(r.oa2, 'sent');
  });
});
