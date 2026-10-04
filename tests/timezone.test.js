// เซิร์ฟเวอร์ Railway รันเวลา UTC — ข้อความวันที่/เส้นตายต้องออกมาเป็นเวลาไทยเหมือนกันทุกเครื่อง
// 3 ต.ค. 69: เทสบน Mac (เวลาไทย) ผ่าน แต่บนเซิร์ฟเวอร์คลาด 7 ชม. → บรอดแคสต์ 13,000 คนบอกเส้นตายที่เลยไปแล้ว
// ไฟล์นี้บังคับ TZ=UTC ก่อนโหลดโมดูล แล้วสร้างเวลาด้วย ISO +07:00 เท่านั้น
process.env.TZ = 'UTC';
process.env.TEST_MODE = 'true';
process.env.LINE_CHANNEL_ACCESS_TOKEN = '';
const { test, describe, after } = require('node:test');
const helpers = require('./helpers');
helpers.prepareEnv('timezone');   // monthlyPick ดึง db มาด้วย — ชี้ไป PGlite แล้วปิดตอนจบ ไม่งั้นโปรเซสค้าง
const assert = require('node:assert');
const ann = require('../src/services/pickAnnounce');
const bkk = (s) => new Date(s + '+07:00');

describe('เขตเวลาเครื่องเป็น UTC แต่ข้อความต้องเป็นเวลาไทย', () => {
  test('เครื่องเป็น UTC จริง', () => {
    assert.equal(new Date('2026-10-03T20:00:00+07:00').getHours(), 13);
  });
  test('3 ต.ค. 19:59 ไทย → ยังทันรอบ 17 ต.ค. · 20:01 → รอบ 2 พ.ย.', () => {
    assert.equal(ann.nextRound(bkk('2026-10-03T19:59:00')).round, '17 ตุลาคม');
    assert.equal(ann.nextRound(bkk('2026-10-03T20:01:00')).round, '2 พฤศจิกายน');
  });
  test('ชวนสมัครตอน 20:00:20 ไทย ต้องไม่บอก "ภายในวันนี้ก่อน 2 ทุ่ม"', () => {
    const t = ann.inviteText({ now: bkk('2026-10-03T20:00:20') });
    assert.ok(!t.includes('ก่อน 2 ทุ่ม'), t);
    assert.ok(t.includes('ถ้าสมัครตอนนี้ มีสิทธิ์ลุ้นรอบ 2 พฤศจิกายน'));
  });
  test('ชวนสมัครตอน 09:00 ไทย วันเส้นตาย → "ภายในวันนี้ 3 ตุลาคม ก่อน 2 ทุ่ม"', () => {
    assert.ok(ann.inviteText({ now: bkk('2026-10-03T09:00:00') }).includes('ภายในวันนี้ 3 ตุลาคม ก่อน 2 ทุ่ม'));
  });
  test('เตือนก่อนจับ 30 ก.ย. 19:00 ไทย → อีก 2 วัน รอบ 2 ตุลาคม', () => {
    assert.ok(ann.reminderText({ now: bkk('2026-09-30T19:00:00') }).startsWith('อีก 2 วัน จับรางวัลดูดวงกับอาจารย์ รอบวันที่ 2 ตุลาคม'));
  });
  test('ตี 1 ไทย (ยังเป็นเมื่อวานใน UTC) ต้องนับเป็นวันที่ไทย', () => {
    assert.ok(ann.reminderText({ now: bkk('2026-10-16T01:00:00') }).startsWith('พรุ่งนี้ จับรางวัล'));
  });
  test('ประกาศผลตอน 20:00 ไทย 2 ต.ค. → รอบถัดไป 17 ต.ค. สมัครภายใน 3 ต.ค.', () => {
    const t = ann.announceText({ at: bkk('2026-10-02T20:00:00'), name: 'X', total: 75 });
    assert.ok(t.includes('รอบ 2 ตุลาคม'));
    assert.ok(t.includes('ภายใน 3 ตุลาคม'));
  });
});

describe('ขยายเส้นตายรายรอบ (รักษาคำพูดที่ประกาศผิดไป)', () => {
  const pick = require('../src/services/monthlyPick');
  after(async () => { await require('../src/db').end(); });
  test('ไม่ตั้ง = เกณฑ์ปกติ 14 วันก่อนเวลาจับ', () => {
    delete process.env.PICK_CUTOFF_EXTEND;
    assert.equal(pick.cutoffFor(bkk('2026-10-17T20:00:00')).toISOString(), bkk('2026-10-03T20:00:00').toISOString());
  });
  test('รอบ 2026-10-B ขยายถึง 3 ต.ค. 23:59 ไทย · รอบอื่นไม่โดน · ห้ามหด', () => {
    process.env.PICK_CUTOFF_EXTEND = '2026-10-B=2026-10-03T23:59:59+07:00, 2026-11-A=2026-01-01T00:00:00+07:00';
    assert.equal(pick.cutoffFor(bkk('2026-10-17T20:00:00')).toISOString(), bkk('2026-10-03T23:59:59').toISOString());
    assert.equal(pick.cutoffFor(bkk('2026-11-02T20:00:00')).toISOString(), bkk('2026-10-19T20:00:00').toISOString());
    delete process.env.PICK_CUTOFF_EXTEND;
  });
});
