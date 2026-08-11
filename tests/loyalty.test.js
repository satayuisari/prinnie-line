// เทสสิทธิ์ดูดวงกับ อ.ปรินนี่ — เกณฑ์ตายตัว ไม่มีสุ่ม (ข้อกำหนดทางกฎหมาย ดู 022_loyalty_rewards.sql)
const { test, before, beforeEach, after, describe } = require('node:test');
const assert = require('node:assert');
const helpers = require('./helpers');

helpers.prepareEnv('loyalty');

const db = require('../src/db');
const subscribers = require('../src/services/subscriberService');
const orders = require('../src/services/paymentOrders');
const paymentApprove = require('../src/services/paymentApprove');
const loyalty = require('../src/services/loyaltyReward');

const M = loyalty.MILESTONE;

// จ่ายค่าสมาชิก n ครั้งให้ผู้ใช้คนหนึ่ง (เส้นทางเดียวกับ staff อนุมัติสลิป)
// ref ต้องไม่ซ้ำข้ามการเรียกหลายรอบ — ใช้ตัวนับกลางแทนดัชนีในลูป
let refSeq = 0;
async function payTimes(userId, n) {
  for (let i = 0; i < n; i++) {
    await helpers.payOrder(db, orders, paymentApprove, userId, `${userId}_ORD${refSeq++}`);
  }
}

before(async () => { await helpers.migrate(db); });
beforeEach(async () => {
  await db.query('DELETE FROM loyalty_rewards');
  await helpers.reset(db);
});
after(async () => { await db.end(); });

describe('เกณฑ์ได้สิทธิ์', () => {
  test(`จ่ายครบ ${M} ครั้ง → ได้สิทธิ์ · จ่ายไม่ครบ → ยังไม่ได้`, async () => {
    await helpers.registerUser(subscribers, 'U_full');
    await payTimes('U_full', M);
    await helpers.registerUser(subscribers, 'U_short');
    await payTimes('U_short', M - 1);

    const eligible = await loyalty.findEligible();
    const ids = eligible.map(e => e.line_user_id);
    assert.ok(ids.includes('U_full'), 'คนจ่ายครบต้องอยู่ในรายชื่อ');
    assert.ok(!ids.includes('U_short'), 'คนจ่ายไม่ครบต้องไม่อยู่');
  });

  test('ทุกคนที่ครบเกณฑ์ได้หมด ไม่มีการคัดเลือก (ไม่ใช่การเสี่ยงโชค)', async () => {
    for (let i = 0; i < 5; i++) {
      await helpers.registerUser(subscribers, `U_all${i}`);
      await payTimes(`U_all${i}`, M);
    }
    const granted = await loyalty.grantAllEligible();
    assert.equal(granted.length, 5, 'ครบเกณฑ์ 5 คน ต้องได้สิทธิ์ทั้ง 5 คน');
  });

  test('ให้สิทธิ์ซ้ำไม่ได้ แม้รัน scheduler ซ้ำหลายรอบ', async () => {
    await helpers.registerUser(subscribers, 'U_dup');
    await payTimes('U_dup', M);
    const first = await loyalty.grantAllEligible();
    assert.equal(first.length, 1);
    for (let i = 0; i < 3; i++) {
      const again = await loyalty.grantAllEligible();
      assert.equal(again.length, 0, 'รอบถัดไปต้องไม่ให้ซ้ำ');
    }
    assert.equal((await loyalty.list({})).length, 1);
  });

  test('จ่ายต่ออีกหลังได้สิทธิ์แล้ว ไม่ได้สิทธิ์ขั้นเดิมซ้ำ', async () => {
    await helpers.registerUser(subscribers, 'U_more');
    await payTimes('U_more', M);
    await loyalty.grantAllEligible();
    await payTimes('U_more', 3);                 // ต่ออายุอีก 3 เดือน
    const again = await loyalty.grantAllEligible();
    assert.equal(again.length, 0);
  });

  test('ค่าที่บันทึกถูกต้อง: มูลค่า 3,000 + วันหมดอายุ', async () => {
    await helpers.registerUser(subscribers, 'U_val');
    await payTimes('U_val', M);
    const [row] = await loyalty.grantAllEligible();
    assert.equal(row.reward_value, 3000);
    assert.equal(row.milestone, M);
    const days = (new Date(row.expires_at) - Date.now()) / 86400000;
    assert.ok(days > loyalty.EXPIRE_DAYS - 1 && days <= loyalty.EXPIRE_DAYS, 'วันหมดอายุต้องตรงกับที่ประกาศ');
  });
});

describe('สถานะและรายงาน', () => {
  test('ไล่สถานะ GRANTED → NOTIFIED → BOOKED → USED', async () => {
    await helpers.registerUser(subscribers, 'U_flow');
    await payTimes('U_flow', M);
    const [row] = await loyalty.grantAllEligible();
    assert.equal((await loyalty.list({}))[0].status, 'GRANTED');
    await loyalty.markNotified(row.id);
    assert.equal((await loyalty.list({}))[0].status, 'NOTIFIED');
    await loyalty.setStatus(row.id, 'BOOKED');
    await loyalty.setStatus(row.id, 'USED');
    const done = (await loyalty.list({}))[0];
    assert.equal(done.status, 'USED');
    assert.ok(done.used, 'ต้องบันทึกวันที่ใช้สิทธิ์');
  });

  test('สถิติ: นับคนที่ใกล้ได้สิทธิ์ไว้กระตุ้นต่ออายุ', async () => {
    await helpers.registerUser(subscribers, 'U_a');  await payTimes('U_a', M);
    await helpers.registerUser(subscribers, 'U_b');  await payTimes('U_b', M - 1);
    await helpers.registerUser(subscribers, 'U_c');  await payTimes('U_c', M - 1);
    await loyalty.grantAllEligible();
    const s = await loyalty.stats();
    assert.equal(s.total, 1);
    assert.equal(s.waiting, 1);
    assert.equal(s.value_out, 3000);
    assert.equal(s.almost, 2, 'อีก 1 ครั้งก็ได้สิทธิ์ ต้องนับได้ 2 คน');
  });

  test('ข้อความแจ้งลูกค้าบอกครบ: เกณฑ์ มูลค่า และวันหมดอายุ', async () => {
    const t = loyalty.grantMessage('ส้ม');
    assert.match(t, /ส้ม/);
    assert.match(t, new RegExp(String(M)));
    assert.match(t, /3,000/);
    assert.match(t, new RegExp(String(loyalty.EXPIRE_DAYS)));
  });

  test('เงื่อนไขที่ประกาศ ต้องไม่มีคำที่สื่อว่าเป็นการเสี่ยงโชค', async () => {
    const all = loyalty.TERMS.join(' ');
    for (const word of ['สุ่ม', 'เสี่ยงโชค', 'จับรางวัล', 'ชิงโชค', 'ลุ้น']) {
      assert.ok(!all.includes(word), `เงื่อนไขต้องไม่มีคำว่า "${word}" (เลี่ยงการเข้าข่ายเสี่ยงโชค)`);
    }
    assert.ok(all.includes('ทุกคน'), 'ต้องระบุชัดว่าครบเกณฑ์ได้ทุกคน');
  });
});
