// ส่งดวงวันนี้ทันทีเมื่ออนุมัติหลัง 08:00 ไทย — ต้องถูกเสมอแม้เซิร์ฟเวอร์เป็น UTC (16 ต.ค. 69)
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { shouldCatchUp } = require('../src/services/dailyCatchup');

describe('shouldCatchUp คิดจากเวลาไทย', () => {
  test('07:59 ไทย → ยังไม่ต้อง รอบปกติจะส่งเอง', () => {
    assert.equal(shouldCatchUp(new Date('2026-10-16T00:59:00Z')), false);
  });
  test('08:48 ไทย (เคสจริง) → ต้องส่งทันที', () => {
    assert.equal(shouldCatchUp(new Date('2026-10-16T01:48:00Z')), true);
  });
  test('23:30 ไทย → ยังถือว่าวันนี้ ส่งทันที', () => {
    assert.equal(shouldCatchUp(new Date('2026-10-16T16:30:00Z')), true);
  });
  test('00:30 ไทย (17:30 UTC วันก่อน) → เป็นวันใหม่ก่อนรอบ ไม่ส่ง', () => {
    assert.equal(shouldCatchUp(new Date('2026-10-16T17:30:00Z')), false);
  });
});
