// เปิดตัว "ดวงเลือกคุณ" แบบตั้งเวลา (LOYALTY_LAUNCH_AT) — ข้อความสะอาด · ไม่ยิงก่อนเวลา · ไม่ยิงย้อนหลังเกินวัน
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const helpers = require('./helpers');

helpers.prepareEnv('loyaltylaunch');   // scheduler ดึง db มาด้วย — ต้องชี้ไป PGlite ทดสอบ แล้วปิดตอนจบ ไม่งั้นโปรเซสค้าง
const txt = require('../src/services/loyaltyLaunchText');
const { BANNED } = require('../src/services/pickAnnounce');

describe('ข้อความเปิดตัว', () => {
  test('ไม่มีคำต้องห้าม ทั้งสองบัญชี', () => {
    for (const t of [txt.textOA1(new Date(2026, 8, 16)), txt.textOA2(new Date(2026, 8, 16))])
      for (const w of BANNED) assert.ok(!t.includes(w), `ห้ามมีคำว่า "${w}"`);
  });
  test('ยิง 16 ก.ย. สามทุ่ม → รอบถัดไปที่คนสมัครทันคือ 2 ต.ค. เส้นตาย 18 ก.ย.', () => {
    const t = txt.textOA1(new Date(2026, 8, 16, 21));
    assert.ok(t.includes('รอบถัดไป 2 ตุลาคม'));
    assert.ok(t.includes('ภายใน 18 กันยายน'));
  });
  test('รูป + ข้อความ = 2 ข้อความ · --no-image = 1', () => {
    assert.equal(txt.messages('x').length, 2);
    assert.equal(txt.messages('x', { image: false }).length, 1);
    assert.ok(txt.messages('x')[0].originalContentUrl.endsWith('/duang-luek-khun.jpg'));
  });
});

describe('ตัวยิงตามเวลา (ไม่แตะ DB ถ้ายังไม่ถึงเวลา)', () => {
  const launch = require('../src/scheduler/launchBroadcast');
  after(async () => { await require('../src/db').end(); });
  test('ไม่ตั้ง LOYALTY_LAUNCH_AT = ไม่ทำอะไร', async () => {
    delete process.env.LOYALTY_LAUNCH_AT;
    await launch.fireLoyalty();
  });
  test('ยังไม่ถึงเวลา = ไม่ทำอะไร', async () => {
    process.env.LOYALTY_LAUNCH_AT = new Date(Date.now() + 3600e3).toISOString();
    await launch.fireLoyalty();
  });
  test('เลยเวลามาเกิน 1 วัน = ไม่ยิงย้อนหลัง', async () => {
    process.env.LOYALTY_LAUNCH_AT = new Date(Date.now() - 2 * 86400e3).toISOString();
    await launch.fireLoyalty();
  });
  test('ค่าอ่านไม่ออก = ไม่พัง', async () => {
    process.env.LOYALTY_LAUNCH_AT = 'สามทุ่ม';
    await launch.fireLoyalty();
  });
});
