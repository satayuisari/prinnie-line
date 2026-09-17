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
  // bon 17 ก.ย. 69: ข้อความเปิดตัวต้องไม่ทำให้ใครเข้าใจว่าตัวเองได้สิทธิ์แล้ว
  test('บอกชัดว่าสมาชิกมีสิทธิ์ลุ้น รอบละ 1 ท่าน และจะประกาศชื่อผู้ได้รับ', () => {
    for (const t of [txt.textOA1(new Date(2026, 8, 16)), txt.textOA2(new Date(2026, 8, 16))]) {
      assert.ok(t.includes('มีสิทธิ์ลุ้นดูดวงกับอาจารย์ปรินนี่ฟรี'));
      assert.ok(t.includes('รอบละ 1 ท่าน'));
      assert.ok(t.includes('ต้องเป็นสมาชิก Prinnie333'));
      assert.ok(t.includes('เราจะประกาศชื่อผู้ได้รับรางวัล'));
      assert.ok(!t.includes('จังหวะสำคัญ') && !t.includes('เจ้าของดวง'), 'ห้ามกลับไปใช้ถ้อยคำที่ชวนเข้าใจผิด');
    }
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
  test('ประกาศผลจับรางวัล: ไม่ตั้ง / ยังไม่ถึง / เลย 1 วัน / อ่านไม่ออก = ไม่ยิง', async () => {
    for (const v of [undefined, new Date(Date.now() + 3600e3).toISOString(),
                     new Date(Date.now() - 2 * 86400e3).toISOString(), 'สองทุ่ม']) {
      if (v === undefined) delete process.env.PICK_ANNOUNCE_AT; else process.env.PICK_ANNOUNCE_AT = v;
      await launch.firePickAnnounce();
    }
    delete process.env.PICK_ANNOUNCE_AT;
  });
});
