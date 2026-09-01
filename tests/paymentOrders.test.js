// เทสวงจรออเดอร์ PromptPay — กันบั๊ก 3 ตัวที่เจอจากข้อมูลจริง (backup 23 ส.ค. 69):
//   1) กดปุ่มสมัครซ้ำ → ออเดอร์ซ้ำ (41/111 ลูกค้า สูงสุด 11 ใบ/คน)
//   2) ใบค้างเก่าดักรูปที่ลูกค้าส่งทีหลัง → สมาชิกที่จ่ายแล้วโดนบอทตอบเรื่องสลิป
//   3) สลิปที่ตรวจไม่ผ่านเกิน 90 นาที เงียบหาย ไม่มีใครรู้ (ลูกค้าโอนเงินมาแล้ว)
// รันด้วย: npm test
const { test, before, beforeEach, after, describe } = require('node:test');
const assert = require('node:assert');
const helpers = require('./helpers');

helpers.prepareEnv('payment-orders');       // ต้องมาก่อน require db ทุกตัว

const db = require('../src/db');
const orders = require('../src/services/paymentOrders');
const slipRecheck = require('../src/scheduler/slipRecheck');

const SUB = { type: 'subscription', line_user_id: 'U_pay', amount: 39900 };
const countOrders = async (where = '') =>
  Number((await db.query(`SELECT COUNT(*)::int n FROM payment_orders ${where}`)).rows[0].n);
const ageOrder = (ref, interval) =>
  db.query(`UPDATE payment_orders SET created_at = NOW() - INTERVAL '${interval}' WHERE ref=$1`, [ref]);

before(async () => { await helpers.migrate(db); });
beforeEach(async () => { await helpers.reset(db); });
after(async () => { await db.end(); });

describe('กดปุ่มจ่ายเงินซ้ำ', () => {
  test('กดซ้ำภายใน 72 ชม. → ใช้ออเดอร์ใบเดิม ไม่สร้างใบใหม่', async () => {
    const a = await orders.createOrReuse(SUB);
    const b = await orders.createOrReuse(SUB);
    assert.equal(b, a, 'ต้องได้ ref เดิม');
    assert.equal(await countOrders(), 1, 'ต้องมีออเดอร์ใบเดียว');
  });

  test('ส่งสลิปแล้วกดสมัครใหม่ → ได้ใบใหม่ (ใบเดิมกำลังรอตรวจ ห้ามทับ)', async () => {
    const a = await orders.createOrReuse(SUB);
    await orders.attachSlip(SUB.line_user_id, 'msg_1');
    const b = await orders.createOrReuse(SUB);
    assert.notEqual(b, a);
    assert.equal(await countOrders(), 2);
  });

  test('ใบเดิมเก่าเกิน 72 ชม. → ถือว่าตายแล้ว เปิดใบใหม่', async () => {
    const a = await orders.createOrReuse(SUB);
    await ageOrder(a, '80 hours');
    const b = await orders.createOrReuse(SUB);
    assert.notEqual(b, a);
  });

  test('คนละรายการ (สมาชิก / ดวงคู่) ไม่ใช้ใบเดิมปนกัน', async () => {
    const sub = await orders.createOrReuse(SUB);
    const cpl = await orders.createOrReuse({ ...SUB, type: 'couple', amount: 19900 });
    assert.notEqual(cpl, sub);
    assert.equal(await countOrders(), 2);
  });

  test('ใช้ใบเดิมซ้ำสำหรับดวงคู่ → ข้อมูลคู่ต้องเป็นของที่กรอกล่าสุด', async () => {
    const CPL = { ...SUB, type: 'couple', amount: 19900 };
    const a = await orders.createOrReuse({ ...CPL, payload: { partner_name: 'เอ' } });
    const b = await orders.createOrReuse({ ...CPL, payload: { partner_name: 'บี' } });
    assert.equal(b, a);
    const o = await orders.get(a);
    assert.equal(o.payload.partner_name, 'บี', 'ต้องทับด้วยข้อมูลคู่ล่าสุด ไม่ใช่ของเดิม');
  });

  test('ใช้ใบเดิมซ้ำ → เคลียร์สถานะเคยทวง จะได้ทวงรอบใหม่ได้', async () => {
    const a = await orders.createOrReuse(SUB);
    await db.query(`UPDATE payment_orders SET reminded_at = NOW() WHERE ref=$1`, [a]);
    await orders.createOrReuse(SUB);
    const o = await orders.get(a);
    assert.equal(o.reminded_at, null);
  });
});

describe('รับสลิปเข้าออเดอร์', () => {
  test('ออเดอร์สดของ user → แนบสลิปได้', async () => {
    const ref = await orders.createOrReuse(SUB);
    const o = await orders.attachSlip(SUB.line_user_id, 'msg_1');
    assert.equal(o && o.ref, ref);
  });

  test('มีแต่ใบค้างเก่าเกิน 72 ชม. → ไม่แนบ (รูปทั่วไปของสมาชิก ไม่ใช่สลิป)', async () => {
    const ref = await orders.createOrReuse(SUB);
    await ageOrder(ref, '5 days');
    const o = await orders.attachSlip(SUB.line_user_id, 'msg_random_photo');
    assert.equal(o, null, 'ใบค้างเก่าต้องไม่ดักรูปที่ลูกค้าส่งทีหลัง');
  });

  test('ออเดอร์ของคนอื่น → ไม่แนบข้ามคน', async () => {
    await orders.createOrReuse(SUB);
    const o = await orders.attachSlip('U_someone_else', 'msg_1');
    assert.equal(o, null);
  });
});

describe('ตาข่ายกันสลิปหาย', () => {
  const stuckOrder = async (minutesAgo) => {
    const ref = await orders.createOrReuse(SUB);
    await orders.attachSlip(SUB.line_user_id, 'msg_stuck');
    await db.query(
      `UPDATE payment_orders SET slip_received_at = NOW() - INTERVAL '${minutesAgo} minutes' WHERE ref=$1`, [ref]);
    return ref;
  };

  test('สลิปค้างเกิน 90 นาที → ส่งต่อให้แอดมิน', async () => {
    const ref = await stuckOrder(120);
    const r = await slipRecheck.escalateStuck();
    assert.equal(r.escalated, 1);
    const o = await orders.get(ref);
    assert.ok(o.escalated_at, 'ต้องบันทึกว่าส่งเรื่องแล้ว');
  });

  test('ยังไม่ถึง 90 นาที → ปล่อยให้ระบบตรวจซ้ำก่อน ไม่กวนแอดมิน', async () => {
    await stuckOrder(30);
    assert.equal((await slipRecheck.escalateStuck()).escalated, 0);
  });

  test('ส่งเรื่องแล้วไม่ส่งซ้ำ (cron ทุก 5 นาที)', async () => {
    await stuckOrder(120);
    assert.equal((await slipRecheck.escalateStuck()).escalated, 1);
    assert.equal((await slipRecheck.escalateStuck()).escalated, 0);
  });

  test('ออเดอร์ที่จ่ายสำเร็จแล้ว ไม่ถูกส่งเรื่อง', async () => {
    const ref = await stuckOrder(120);
    await orders.markPaid(ref, 'test');
    assert.equal((await slipRecheck.escalateStuck()).escalated, 0);
  });

  test('ออเดอร์ค้างที่ยังไม่ส่งสลิป ไม่ถูกส่งเรื่อง (ยังไม่มีเงินเกี่ยวข้อง)', async () => {
    const ref = await orders.createOrReuse(SUB);
    await ageOrder(ref, '3 hours');
    assert.equal((await slipRecheck.escalateStuck()).escalated, 0);
  });
});
