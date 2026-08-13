// Ask Prinnie 3 — สิทธิ์สมาชิกแบบให้ตามเงื่อนไข (ไม่มีการสุ่ม ดู 022/023)
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

// ref ต้องไม่ซ้ำข้ามการเรียกหลายรอบ
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
  test(`จ่ายครบ ${M} รอบ → ได้สิทธิ์ · ไม่ครบ → ยังไม่ได้`, async () => {
    await helpers.registerUser(subscribers, 'U_full');  await payTimes('U_full', M);
    await helpers.registerUser(subscribers, 'U_short'); await payTimes('U_short', M - 1);
    const ids = (await loyalty.findEligible()).map(e => e.line_user_id);
    assert.ok(ids.includes('U_full'));
    assert.ok(!ids.includes('U_short'));
  });

  test('ครบเกณฑ์ได้ทุกคน ไม่มีการคัดเลือก (ไม่ใช่การสุ่ม)', async () => {
    for (let i = 0; i < 5; i++) {
      await helpers.registerUser(subscribers, `U_all${i}`);
      await payTimes(`U_all${i}`, M);
    }
    assert.equal((await loyalty.grantAllEligible()).length, 5);
  });

  test('ให้สิทธิ์ซ้ำไม่ได้ แม้รันซ้ำหลายรอบ', async () => {
    await helpers.registerUser(subscribers, 'U_dup'); await payTimes('U_dup', M);
    assert.equal((await loyalty.grantAllEligible()).length, 1);
    for (let i = 0; i < 3; i++) assert.equal((await loyalty.grantAllEligible()).length, 0);
    assert.equal((await loyalty.list({})).length, 1);
  });

  test('refund รอบที่ทำให้ครบเกณฑ์ → ไม่ให้สิทธิ์ (ตรวจ eligibility สดก่อน grant)', async () => {
    await helpers.registerUser(subscribers, 'U_ref');
    await payTimes('U_ref', M);
    // คืนเงินรอบล่าสุด → หลุดเกณฑ์
    await db.query(
      `UPDATE payment_orders SET status='CANCELLED'
       WHERE ref = (SELECT ref FROM payment_orders WHERE line_user_id='U_ref' ORDER BY ref DESC LIMIT 1)`);
    assert.equal(await loyalty.paidCycles('U_ref'), M - 1);
    assert.equal(await loyalty.grant('U_ref'), null, 'จ่ายไม่ครบแล้ว ต้องไม่ได้สิทธิ์');
  });

  test('ไม่ประกาศมูลค่าเป็นเงินกับสิทธิ์นี้', async () => {
    await helpers.registerUser(subscribers, 'U_val'); await payTimes('U_val', M);
    await loyalty.grantAllEligible();
    const row = (await db.query('SELECT reward, reward_value FROM loyalty_rewards')).rows[0];
    assert.equal(row.reward, 'Ask Prinnie 3');
    assert.equal(row.reward_value, 0, 'ต้องไม่ติดป้ายราคาของบริการ 1 ชม. กับสิทธิ์ 3 คำถาม');
    const msg = loyalty.grantMessage('ส้ม', 'https://x/ask.html');
    assert.ok(!/3,000|3000|มูลค่า/.test(msg), 'ข้อความแจ้งสิทธิ์ต้องไม่พูดถึงมูลค่าเงิน');
  });
});

describe('ส่งคำถาม (Ask Prinnie 3)', () => {
  async function grantedUser(id = 'U_ask') {
    await helpers.registerUser(subscribers, id);
    await payTimes(id, M);
    await loyalty.grantAllEligible();
    return id;
  }

  test(`ส่งครบ ${loyalty.MAX_Q} คำถาม → บันทึกและปิดสิทธิ์ไม่ให้ส่งซ้ำ`, async () => {
    const u = await grantedUser();
    const r = await loyalty.submitQuestions(u, ['งานปีนี้เป็นยังไง', 'ควรย้ายบ้านไหม', 'เนื้อคู่มาเมื่อไหร่']);
    assert.equal(r.questions.length, 3);
    const row = (await loyalty.list({}))[0];
    assert.equal(row.status, 'ASKED');
    assert.ok(row.asked);
    await assert.rejects(() => loyalty.submitQuestions(u, ['a', 'b', 'c']), /ไม่พบสิทธิ์|ใช้ไปแล้ว/);
  });

  test('ส่งไม่ครบ 3 คำถาม → ไม่รับ', async () => {
    const u = await grantedUser('U_short_q');
    await assert.rejects(() => loyalty.submitQuestions(u, ['ข้อเดียว']), /ครบ/);
    await assert.rejects(() => loyalty.submitQuestions(u, ['a', '  ', 'c']), /ครบ/);
  });

  test('ไม่มีสิทธิ์ → ส่งคำถามไม่ได้', async () => {
    await helpers.registerUser(subscribers, 'U_none');
    await assert.rejects(() => loyalty.submitQuestions('U_none', ['a', 'b', 'c']), /ไม่พบสิทธิ์/);
  });

  test('สิทธิ์หมดอายุ → ส่งคำถามไม่ได้', async () => {
    const u = await grantedUser('U_exp');
    await db.query(`UPDATE loyalty_rewards SET expires_at = NOW() - INTERVAL '1 day'`);
    assert.equal(await loyalty.activeFor(u), null);
    await assert.rejects(() => loyalty.submitQuestions(u, ['a', 'b', 'c']), /ไม่พบสิทธิ์/);
  });

  test('คิวอาจารย์: ขึ้นเมื่อส่งคำถาม หายเมื่อตอบแล้ว', async () => {
    const u = await grantedUser('U_q');
    await loyalty.submitQuestions(u, ['q1', 'q2', 'q3']);
    let queue = await loyalty.advisorQueue();
    assert.equal(queue.length, 1);
    assert.deepEqual(queue[0].questions, ['q1', 'q2', 'q3']);
    await loyalty.markAnswered(queue[0].id);
    queue = await loyalty.advisorQueue();
    assert.equal(queue.length, 0);
    assert.equal((await loyalty.list({}))[0].status, 'USED');
  });
});

describe('KPI + ถ้อยคำ', () => {
  test('KPI 3 ตัว: ต่อถึงรอบเกณฑ์ / redeem / คิว', async () => {
    await helpers.registerUser(subscribers, 'U_k1'); await payTimes('U_k1', M);
    await helpers.registerUser(subscribers, 'U_k2'); await payTimes('U_k2', M - 1);
    await loyalty.grantAllEligible();
    await loyalty.submitQuestions('U_k1', ['a', 'b', 'c']);
    const k = await loyalty.kpi();
    assert.equal(k.payers, 2);
    assert.equal(k.reached, 1);
    assert.equal(k.reach_rate, 50);
    assert.equal(k.granted, 1);
    assert.equal(k.redeemed, 1);
    assert.equal(k.redeem_rate, 100);
    assert.equal(k.in_queue, 1);
  });

  test('ถ้อยคำต้องไม่สื่อว่าเป็นการสุ่มหรือแข่งขัน', async () => {
    const raw = loyalty.TERMS.join(' ') + ' ' + loyalty.grantMessage('ส้ม', 'https://x');
    // "ไม่มีการจับรางวัล" คือการปฏิเสธ ไม่ใช่การอ้างว่ามีจับรางวัล → ตัดประโยคปฏิเสธออกก่อนตรวจ
    const all = raw.replace(/ไม่มีการ\S+/g, '');
    for (const word of ['สุ่ม', 'เสี่ยงโชค', 'จับรางวัล', 'ชิงโชค', 'ลุ้น', 'ผู้โชคดี', 'ประกาศผล', 'ผู้ชนะ']) {
      assert.ok(!all.includes(word), `ห้ามมีคำว่า "${word}"`);
    }
    assert.ok(raw.includes('ไม่มีการจับรางวัล'), 'ควรบอกชัดว่าไม่มีการจับรางวัล');
    assert.ok(loyalty.TERMS.join(' ').includes('ทุกคน'), 'ต้องระบุว่าครบเกณฑ์ได้ทุกคน');
    assert.ok(loyalty.TERMS.some(t => t.includes('แจ้งสิทธิ์')), 'ใช้คำว่าแจ้งสิทธิ์ ไม่ใช่ประกาศผล');
  });
});
