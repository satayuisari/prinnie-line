// เทสระบบ affiliate ทั้งเส้น — attribution → first paid → ค่าคอม → refund → ยอดรวมต้องตรงกัน
// รันด้วย: npm test   (ใช้ PGlite แยกโฟลเดอร์ ไม่แตะข้อมูล dev/production)
const { test, before, beforeEach, after, describe } = require('node:test');
const assert = require('node:assert');
const helpers = require('./helpers');

helpers.prepareEnv('affiliate');            // ต้องมาก่อน require db ทุกตัว

const db = require('../src/db');
const subscribers = require('../src/services/subscriberService');
const orders = require('../src/services/paymentOrders');
const paymentApprove = require('../src/services/paymentApprove');
const commission = require('../src/services/affiliateCommission');
const affiliates = require('../src/services/affiliates');
const candidates = require('../src/services/affiliateCandidates');

const CPA = commission.BASE_CPA;
const countCommissions = async (extra = '') =>
  Number((await db.query(`SELECT COUNT(*)::int n FROM affiliate_commissions ${extra}`)).rows[0].n);
const sumCommissions = async (status = null) => Number((await db.query(
  `SELECT COALESCE(SUM(amount),0)::int s FROM affiliate_commissions ${status ? "WHERE status='" + status + "'" : ''}`
)).rows[0].s);

before(async () => { await helpers.migrate(db); });
beforeEach(async () => { await helpers.reset(db); });
after(async () => { await db.end(); });

describe('attribution', () => {
  test('A. คลิก → สมัคร → จ่ายครั้งแรก = ค่าคอม 50', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_a1', { code: 'aff_a' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_a1', 'ORD_A1');

    const rows = await commission.list({});
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, CPA);
    assert.equal(rows[0].status, 'PENDING');
    assert.equal(rows[0].affiliate_code, 'aff_a');
    assert.equal(rows[0].revenue_amount, 399, 'ต้องเก็บรายได้จริงเป็นบาท (399) ไม่ใช่สตางค์');
  });

  test('B. สมัครแล้วไม่จ่าย = ไม่มีค่าคอม', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_b1', { code: 'aff_a' });
    assert.equal(await countCommissions(), 0);
  });

  test('C. กดลิงก์ A แล้วกดลิงก์ B ก่อนสมัคร → เครดิตเป็นของ A (first touch ชนะ)', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await affiliates.create({ name: 'B', code: 'aff_b' });
    // first = คุกกี้ first-touch จาก /go (A) · code = ?a= ของลิงก์ล่าสุดที่กด (B)
    await helpers.registerUser(subscribers, 'U_c1', { code: 'aff_b', first: 'aff_a' });
    const r = await db.query('SELECT affiliate_code FROM line_subscribers WHERE line_user_id=$1', ['U_c1']);
    assert.equal(r.rows[0].affiliate_code, 'aff_a');
  });

  test('D. ลูกค้าที่ลงทะเบียนแล้ว กดลิงก์อินฟลูทีหลัง → attribution ไม่เปลี่ยน', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await affiliates.create({ name: 'B', code: 'aff_b' });
    await helpers.registerUser(subscribers, 'U_d1', { code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_d1', { code: 'aff_b' });   // สมัคร/แก้ข้อมูลซ้ำผ่านลิงก์ B
    const r = await db.query('SELECT affiliate_code FROM line_subscribers WHERE line_user_id=$1', ['U_d1']);
    assert.equal(r.rows[0].affiliate_code, 'aff_a');
  });

  test('K. รหัสอินฟลูมั่ว = ไม่ผูก attribution', async () => {
    await helpers.registerUser(subscribers, 'U_k1', { code: 'ไม่มีรหัสนี้จริง' });
    const r = await db.query('SELECT affiliate_code FROM line_subscribers WHERE line_user_id=$1', ['U_k1']);
    assert.equal(r.rows[0].affiliate_code, null);
  });

  test('L/M. อินฟลู PAUSED/OFF = ไม่ผูก attribution ใหม่ แต่ของเดิมไม่หาย', async () => {
    await affiliates.create({ name: 'P', code: 'aff_p' });
    await helpers.registerUser(subscribers, 'U_old', { code: 'aff_p' });     // ผูกไว้ตอนยัง ACTIVE

    await affiliates.setStatus('aff_p', 'PAUSED');
    await helpers.registerUser(subscribers, 'U_paused', { code: 'aff_p' });
    await affiliates.setStatus('aff_p', 'OFF');
    await helpers.registerUser(subscribers, 'U_off', { code: 'aff_p' });

    const rows = await db.query(
      'SELECT line_user_id, affiliate_code FROM line_subscribers WHERE line_user_id = ANY($1)',
      [['U_old', 'U_paused', 'U_off']]);
    const byUser = Object.fromEntries(rows.rows.map(r => [r.line_user_id, r.affiliate_code]));
    assert.equal(byUser.U_old, 'aff_p', 'attribution เดิมต้องอยู่ครบหลัง pause/off');
    assert.equal(byUser.U_paused, null);
    assert.equal(byUser.U_off, null);
  });
});

describe('first paid customer + idempotency', () => {
  test('E/F. จ่ายครั้งแรกได้ 50 · ต่ออายุเดือนถัดไปไม่ได้เพิ่ม', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_e1', { code: 'aff_a' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_e1', 'ORD_E1');
    assert.equal(await sumCommissions(), CPA);

    await helpers.payOrder(db, orders, paymentApprove, 'U_e1', 'ORD_E2');   // renew เดือน 2
    await helpers.payOrder(db, orders, paymentApprove, 'U_e1', 'ORD_E3');   // renew เดือน 3
    assert.equal(await countCommissions(), 1, 'renew ต้องไม่สร้างค่าคอมใบใหม่');
    assert.equal(await sumCommissions(), CPA);
  });

  test('G/H. webhook ซ้ำ / สลิปซ้ำ / retry — ค่าคอมยังเป็น 50 ใบเดียว', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_g1', { code: 'aff_a' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_g1', 'ORD_G1');

    // ยิงอนุมัติออเดอร์เดิมซ้ำอีก 5 รอบ (เลียนแบบ webhook/SlipOK/refresh/retry)
    const order = await orders.get('ORD_G1');
    for (let i = 0; i < 5; i++) await paymentApprove.approve(order, 'dup-' + i);
    // เรียก recordFirstPaid ตรง ๆ ซ้ำอีก (worker retry)
    for (let i = 0; i < 3; i++) await commission.recordFirstPaid('U_g1', 'ORD_G1');

    assert.equal(await countCommissions(), 1);
    assert.equal(await sumCommissions(), CPA);
  });

  test('I. ออเดอร์ที่ยังไม่จ่ายสำเร็จ = ไม่มีค่าคอม', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_i1', { code: 'aff_a' });
    await db.query(
      `INSERT INTO payment_orders (ref, type, line_user_id, amount, status)
       VALUES ('ORD_I1','subscription','U_i1',39900,'PENDING')`);
    assert.equal(await countCommissions(), 0);
  });

  // กติกาที่ยืนยันแล้ว: CPA เกิดจาก "สมาชิกรายเดือนจ่ายครั้งแรก" เท่านั้น
  // ซื้อดวงคู่ (จ่ายครั้งเดียว ไม่ใช่สมาชิก) ไม่นับเป็นลูกค้าที่ได้มา → ไม่มีค่าคอม
  test('ซื้อดวงคู่ = ไม่มีค่าคอม (แม้จ่ายสำเร็จและมี attribution)', async () => {
    await affiliates.create({ name: 'A', code: 'aff_cp' });
    await helpers.registerUser(subscribers, 'U_cp', { code: 'aff_cp' });
    await db.query(
      `INSERT INTO payment_orders (ref, type, line_user_id, amount, status)
       VALUES ('ORD_CP','couple','U_cp',14900,'PENDING')`);
    await paymentApprove.approve(await orders.get('ORD_CP'), 'test');

    assert.equal(await countCommissions(), 0, 'ดวงคู่ต้องไม่สร้างค่าคอม');

    // จ่ายค่าสมาชิกทีหลัง = ตอนนั้นถึงได้ค่าคอม 50 (ดวงคู่ก่อนหน้าไม่ทำให้กลายเป็น renew)
    await helpers.payOrder(db, orders, paymentApprove, 'U_cp', 'ORD_CP_SUB');
    assert.equal(await countCommissions(), 1);
    assert.equal(await sumCommissions(), CPA);
  });

  test('ไม่มี attribution = ไม่มีค่าคอม (ลูกค้าที่มาเอง)', async () => {
    await helpers.registerUser(subscribers, 'U_direct');
    await helpers.payOrder(db, orders, paymentApprove, 'U_direct', 'ORD_D1');
    assert.equal(await countCommissions(), 0);
  });
});

describe('refund / reverse', () => {
  test('J. refund ก่อนจ่ายอินฟลู → REVERSED พร้อมเหตุผล', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_j1', { code: 'aff_a' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_j1', 'ORD_J1');

    const r = await commission.reverseForOrder('ORD_J1', 'ลูกค้าขอคืนเงิน');
    assert.equal(r.ok, true);
    const row = (await commission.list({}))[0];
    assert.equal(row.status, 'REVERSED');
    assert.equal(row.reason, 'ลูกค้าขอคืนเงิน');
    assert.equal(await sumCommissions('REVERSED'), CPA);
  });

  test('APPROVED แต่ยังไม่จ่าย → reverse ได้', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_j2', { code: 'aff_a' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_j2', 'ORD_J2');
    const id = (await commission.list({}))[0].id;
    await commission.approve(id);
    const r = await commission.reverse(id, 'ทุจริต');
    assert.equal(r.ok, true);
    assert.equal((await commission.list({}))[0].status, 'REVERSED');
  });

  test('จ่ายอินฟลูไปแล้ว (PAID) → ห้ามแก้เงียบ ๆ ต้องตั้งธงรอตรวจ', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_j3', { code: 'aff_a' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_j3', 'ORD_J3');
    const id = (await commission.list({}))[0].id;
    await commission.approve(id);
    await commission.markPaid({ id });

    const r = await commission.reverse(id, 'ลูกค้า refund หลังจ่ายอินฟลูแล้ว');
    assert.equal(r.ok, false);
    assert.equal(r.flagged, true);
    const row = (await commission.list({}))[0];
    assert.equal(row.status, 'PAID', 'ประวัติการเงินต้องไม่ถูกเปลี่ยน');
    assert.equal(row.needs_review, true);
    assert.equal((await commission.totals()).review_n, 1);
  });

  test('reverse ต้องมีเหตุผลเสมอ', async () => {
    await affiliates.create({ name: 'A', code: 'aff_a' });
    await helpers.registerUser(subscribers, 'U_j4', { code: 'aff_a' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_j4', 'ORD_J4');
    const id = (await commission.list({}))[0].id;
    await assert.rejects(() => commission.reverse(id, '   '), /เหตุผล/);
  });
});

describe('ยอดรวมต้องตรงกันทุกหน้า (regression: JOIN คูณแถว)', () => {
  // สร้างอินฟลู 1 คน + ลูกค้าจ่ายจริง n คน — ทุกคนผูกกับอินฟลูคนเดียวกัน
  async function seedPaid(code, n) {
    await affiliates.create({ name: 'BIG', code });
    for (let i = 0; i < n; i++) {
      const u = `U_${code}_${i}`;
      await helpers.registerUser(subscribers, u, { code });
      await helpers.payOrder(db, orders, paymentApprove, u, `ORD_${code}_${i}`);
    }
  }

  test('N. ลูกค้าหลายคนของอินฟลูคนเดียว — SUM ต้องไม่พอง', async () => {
    await seedPaid('aff_n', 22);
    const perf = (await affiliates.performance()).find(a => a.code === 'aff_n');
    assert.equal(perf.paid, 22);
    assert.equal(perf.commission, 22 * CPA, `ค่าคอมต้องเป็น ${22 * CPA} ไม่ใช่ยอดที่ถูกคูณด้วยจำนวนสมาชิก`);
    assert.equal(perf.pending_amt, 1100);
    assert.equal(perf.revenue, 22 * 399, 'รายได้ต้องมาจากออเดอร์จริง');
  });

  test('§17 reconciliation: ledger = affiliate detail = ยอดรวมหน้าแดชบอร์ด', async () => {
    await seedPaid('aff_r', 22);

    const ledgerTotal = await sumCommissions();                    // ตรงจากตาราง ledger
    const perf = await affiliates.performance();                   // หน้า detail ต่ออินฟลู
    const detailTotal = perf.reduce((s, a) => s + a.commission, 0);
    const globalTotal = (t => t.pending + t.approved + t.paid)(await commission.totals());  // การ์ดรวม

    assert.equal(ledgerTotal, 1100);
    assert.equal(detailTotal, 1100);
    assert.equal(globalTotal, 1100);
    assert.equal(ledgerTotal, detailTotal);
    assert.equal(detailTotal, globalTotal);
  });

  test('ยอดยังตรงหลังผสมสถานะ APPROVED/PAID/REVERSED', async () => {
    await seedPaid('aff_m', 6);
    const ids = (await commission.list({})).map(c => c.id);
    await commission.approve(ids[0]);
    await commission.approve(ids[1]);
    await commission.markPaid({ id: ids[1] });
    await commission.reverse(ids[2], 'refund');

    const t = await commission.totals();
    const perf = (await affiliates.performance()).find(a => a.code === 'aff_m');
    assert.equal(t.pending + t.approved + t.paid, 5 * CPA, 'REVERSED ต้องไม่นับรวมเป็นค่าคอมที่ต้องจ่าย');
    assert.equal(t.reversed, CPA);
    assert.equal(perf.commission, 5 * CPA);
    assert.equal(perf.paid, 5);
    assert.equal(perf.reversed, 1);
    assert.equal(perf.cac, CPA, 'CAC = ค่าคอมรวม / ลูกค้าที่ได้จริง');
  });
});

describe('CRM + workflow ของแอดมิน', () => {
  test('§22 acceptance: candidate → APPROVED → อินฟลู → ลิงก์ → จ่าย → ค่าคอม → PAID', async () => {
    const c = await candidates.create({ display_name: 'Test Creator', platform: 'tiktok', score_audience_fit: 5 });
    await candidates.setStatus(c.id, 'CONTACTED');
    await candidates.setStatus(c.id, 'INTERESTED');
    await candidates.setStatus(c.id, 'APPROVED');
    const aff = await candidates.convert(c.id, { code: 'testcreator' });
    assert.equal(aff.code, 'testcreator');
    assert.match(aff.url, /\/go\?a=testcreator$/);

    const after = await candidates.get(c.id);
    assert.equal(after.recruitment_status, 'ONBOARDED');
    assert.equal(after.affiliate_code, 'testcreator');

    await helpers.registerUser(subscribers, 'U_acc', { code: 'testcreator' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_acc', 'ORD_ACC');

    let perf = (await affiliates.performance()).find(a => a.code === 'testcreator');
    assert.equal(perf.registered, 1);
    assert.equal(perf.paid, 1);
    assert.equal(perf.revenue, 399);
    assert.equal((await commission.totals()).pending, CPA);

    const id = (await commission.list({}))[0].id;
    await commission.approve(id);
    assert.equal((await commission.totals()).approved, CPA);
    await commission.markPaid({ id });
    assert.equal((await commission.totals()).paid, CPA);

    // ต่ออายุ: รายได้เพิ่ม แต่จำนวนลูกค้าที่ได้มาและค่าคอมเท่าเดิม
    await helpers.payOrder(db, orders, paymentApprove, 'U_acc', 'ORD_ACC2');
    perf = (await affiliates.performance()).find(a => a.code === 'testcreator');
    assert.equal(perf.paid, 1, 'renew ต้องไม่เพิ่มจำนวนลูกค้าที่ได้มา');
    assert.equal(perf.commission, CPA);
  });

  test('candidate ที่ยังไม่ APPROVED แปลงเป็นอินฟลูไม่ได้', async () => {
    const c = await candidates.create({ display_name: 'ยังไม่อนุมัติ' });
    await assert.rejects(() => candidates.convert(c.id), /APPROVED/);
  });

  test('รหัสอินฟลูซ้ำไม่ได้ + เว้นว่างแล้วตั้งให้อัตโนมัติ', async () => {
    await affiliates.create({ name: 'X', code: 'dupe' });
    await assert.rejects(() => affiliates.create({ name: 'Y', code: 'dupe' }), /ถูกใช้แล้ว/);
    const auto = await affiliates.create({ name: 'หมอดูมัดหมี่' });      // ชื่อไทยแปลงเป็น a-z ไม่ได้
    assert.match(auto.code, /^[a-z0-9_-]{3,24}$/);
    assert.match(auto.url, /^https?:\/\/.+\/go\?a=/);
  });

  test('audit log บันทึกทุกการเปลี่ยนสถานะเงิน', async () => {
    await affiliates.create({ name: 'A', code: 'aff_au' });
    await helpers.registerUser(subscribers, 'U_au', { code: 'aff_au' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_au', 'ORD_AU');
    const id = (await commission.list({}))[0].id;
    await commission.approve(id);
    await commission.markPaid({ id });
    await affiliates.setStatus('aff_au', 'PAUSED', { reason: 'ผลงานไม่เข้าเป้า' });

    const events = (await db.query('SELECT event FROM affiliate_audit_log')).rows.map(r => r.event);
    for (const e of ['AFFILIATE_CREATED', 'ATTRIBUTION_CREATED', 'FIRST_PAYMENT_ATTRIBUTED',
                     'COMMISSION_CREATED', 'COMMISSION_APPROVED', 'COMMISSION_PAID', 'AFFILIATE_PAUSED']) {
      assert.ok(events.includes(e), 'ต้องมี event ' + e);
    }
  });
});

// ── ตัวเตือนออเดอร์ค้าง: ห้ามทวงคนที่จ่ายแล้ว (บั๊กจริง เกิดขึ้น 30 ครั้งบน production) ──
describe('ตัวเตือนออเดอร์ค้าง', () => {
  test('ไม่ทวงลูกค้าที่เป็นสมาชิกอยู่แล้ว', async () => {
    const { remindPending } = require('../src/scheduler/pendingOrders');
    // คนที่ 1: จ่ายสำเร็จแล้ว (ACTIVE) แต่มีออเดอร์เก่าค้าง → ห้ามทวง
    await helpers.registerUser(subscribers, 'U_member');
    await db.query(`UPDATE line_subscribers SET status='ACTIVE', payment_ref='sub_x',
                    subscribe_end = NOW() + INTERVAL '20 days' WHERE line_user_id='U_member'`);
    // คนที่ 2: ยังไม่เคยเป็นสมาชิก มีออเดอร์ค้าง → ต้องทวง
    await helpers.registerUser(subscribers, 'U_lead');

    for (const u of ['U_member', 'U_lead']) {
      await db.query(
        `INSERT INTO payment_orders (ref, type, line_user_id, amount, status, created_at)
         VALUES ($1,'subscription',$2,39900,'PENDING', NOW() - INTERVAL '2 days')`, [u + '_old', u]);
    }

    const r = await remindPending();
    assert.equal(r.total, 1, 'ต้องเหลือคนเดียวที่เข้าเกณฑ์ทวง (คนที่ยังไม่ได้เป็นสมาชิก)');
    const nagged = await db.query("SELECT ref FROM payment_orders WHERE reminded_at IS NOT NULL");
    assert.deepEqual(nagged.rows.map(x => x.ref), ['U_lead_old'], 'ต้องไม่ไปแตะออเดอร์ของสมาชิก');
  });
});
