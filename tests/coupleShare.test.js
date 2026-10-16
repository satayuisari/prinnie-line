// ข้อความบอกต่อดวงคู่ — ส่งคู่กับการ์ดเข้าแชทลูกค้า + ตอนแชร์ให้เพื่อน (16 ต.ค. 69)
const { test } = require('node:test');
const assert = require('node:assert');
const { shareText } = require('../src/services/coupleCard');
const { assertClean } = require('../src/services/copyGuard');

test('มี % ตามผลจริง + วิธีลอง + ลิงก์แอด และผ่านด่านคำต้องห้าม', () => {
  const t = shareText({ score: 78, a: 'ส้ม', b: 'เป้ง' });
  assert.match(t, /78%/);
  assert.match(t, /ดูดวงคู่/);
  assert.match(t, /line\.me\/R\/ti\/p\/%40prinnie333/);
  assert.doesNotMatch(t, /แม่น/);
  assert.equal(assertClean(t), t);
});

test('คะแนนเพี้ยนถูกบีบอยู่ใน 0–100', () => {
  assert.match(shareText({ score: 140 }), /100%/);
  assert.match(shareText({ score: -5 }), /0%/);
});
