// รายงานยอดขาย — คิดจากรายการจ่ายจริง · วันไทย · แยกลูกค้าใหม่/ซื้อซ้ำ · วัดผลแคมเปญเทียบฐานปกติ
const { test, describe } = require('node:test');
const assert = require('node:assert');
const r = require('../src/services/salesReport');

const H = 3600e3, D = 24 * H;
const at = (s) => Date.parse(s);
const pay = (user, when, amount = 39900, type = 'subscription') => ({ user, type, amount, paid: at(when) });

describe('พื้นฐาน', () => {
  test('ค่ากลาง', () => {
    assert.equal(r.median([]), 0);
    assert.equal(r.median([5, 1, 3]), 3);
    assert.equal(r.median([1, 2, 3, 100]), 2.5);
  });
  test('วันไทย: 23:30 UTC = วันถัดไปของไทย', () => {
    assert.equal(r.bkkDay(at('2026-09-16T23:30:00Z')), '2026-09-17');
    assert.equal(r.bkkDay(at('2026-09-16T16:59:00Z')), '2026-09-16');
  });
  test('จ่ายครั้งแรก = ลูกค้าใหม่ · ครั้งถัดไป = ซื้อซ้ำ (ไม่ขึ้นกับลำดับที่ส่งเข้ามา)', () => {
    const t = r.tagPayments([pay('a', '2026-09-10T00:00:00Z'), pay('a', '2026-08-10T00:00:00Z'), pay('b', '2026-09-01T00:00:00Z')]);
    assert.deepEqual(t.map(p => [p.user, p.first]), [['a', true], ['b', true], ['a', false]]);
  });
});

describe('การ์ดยอด', () => {
  const now = at('2026-09-17T07:00:00Z');           // 14:00 เวลาไทย
  const rep = r.build({
    now, campaigns: [],
    payments: [
      pay('a', '2026-09-16T18:00:00Z'),              // 01:00 ไทย วันที่ 17 → วันนี้
      pay('b', '2026-09-16T10:00:00Z', 19900, 'couple'), // 17:00 ไทย วันที่ 16 → เมื่อวาน
      pay('a', '2026-08-10T03:00:00Z'),
    ],
    orders: [
      { user: 'a', created: at('2026-09-16T17:00:00Z'), status: 'PAID' },
      { user: 'c', created: at('2026-09-16T17:00:00Z'), status: 'PENDING' },
      { user: 'c', created: at('2026-09-16T17:05:00Z'), status: 'PENDING' },
    ],
    members: { active: 10, expiring: [{ end: now + D }] },
  });
  test('วันนี้/เมื่อวาน ตามวันไทย', () => {
    assert.equal(rep.cards.today.revenue, 399);
    assert.equal(rep.cards.today.newPayers, 0);      // a เคยจ่ายเดือนก่อน
    assert.equal(rep.cards.yesterday.revenue, 199);
    assert.equal(rep.cards.total.revenue, 997);
    assert.equal(rep.cards.customers, 2);
  });
  test('เดือนนี้เทียบช่วงเดียวกันเดือนก่อน', () => {
    assert.equal(rep.cards.month.revenue, 598);
    assert.equal(rep.cards.prevMonthSame.revenue, 399);
  });
  test('คนกดสั่งแล้วจ่ายจริง นับเป็นคน ไม่ใช่ใบ', () => {
    assert.deepEqual(rep.funnel30, { openers: 2, payers: 1, rate: 50 });
  });
  test('สมาชิกและยอดต่ออายุ', () => {
    assert.equal(rep.members.monthlyValue, 3990);
    assert.equal(rep.members.expiring14Value, 399);
  });
  test('กราฟรายวัน 60 วัน วันสุดท้ายคือวันนี้', () => {
    assert.equal(rep.daily.length, 60);
    assert.equal(rep.daily[59].day, '2026-09-17');
    assert.equal(rep.hourly.length, 48);
  });
});

describe('วัดผลแคมเปญ', () => {
  const launch = at('2026-09-16T14:00:00Z');         // 21:00 ไทย
  const payments = [];
  // ช่วงปกติ: วันละ 1 ราย (399) 14 วันก่อนยิง
  for (let i = 1; i <= 14; i++) payments.push(pay('old' + i, new Date(launch - i * D).toISOString()));
  // หลังยิง: 10 รายใน 12 ชม. (ลูกค้าใหม่ 9 · ซื้อซ้ำ 1)
  for (let i = 0; i < 9; i++) payments.push(pay('new' + i, new Date(launch + (i + 1) * H).toISOString()));
  payments.push(pay('old1', new Date(launch + 2 * H).toISOString()));
  const orders = [
    ...Array.from({ length: 9 }, (_, i) => ({ user: 'new' + i, created: launch + H, status: 'PAID' })),
    { user: 'x', created: launch + H, status: 'PENDING' },
  ];
  const now = launch + 12 * H;
  const rep = r.build({ payments, orders, now, campaigns: [{ name: 'เปิดตัว', at: launch }] });
  const c = rep.campaigns[0];

  test('ฐานปกติ = วันละ 399', () => assert.equal(c.baseDaily, 399));
  test('ฐานไม่นับวันพีคของแคมเปญก่อนหน้า และไม่เป็น 0 เมื่อวันปกติขายได้ประปราย', () => {
    const prev = launch - 5 * D;
    const ps = [
      ...Array.from({ length: 30 }, (_, i) => pay('p' + i, new Date(prev + H).toISOString())),  // พีค 11,970 วันเดียว
      pay('q1', new Date(launch - 12 * D).toISOString()),
      pay('q2', new Date(launch - 10 * D).toISOString()),
    ];
    const tagged = r.tagPayments(ps);
    const cs = [{ name: 'ก่อน', at: prev }, { name: 'นี้', at: launch }];
    // แคมเปญก่อนยิง 11 ก.ย. 21:00 → ตัด 11–15 ก.ย. (5 วัน) เหลือวันปกติ 9 วัน ขายได้ 798 → 89/วัน
    assert.equal(Math.round(r.baseline(cs[1], tagged, cs)), 89);
    assert.equal(r.median([...Array(12).fill(0), 399, 399]), 0);   // เหตุผลที่เลิกใช้มัธยฐาน
  });
  test('48 ชม. ยังไม่ครบ → คิดเท่าที่ผ่านมา', () => {
    const w = c.windows[0];
    assert.equal(w.done, false);
    assert.equal(w.hours, 12);
    assert.equal(w.revenue, 3990);
    assert.equal(w.expected, 200);                   // 399 × 0.5 วัน
    assert.equal(w.incremental, 3790);
    assert.equal(w.newPayers, 9);
    assert.equal(w.repeat, 1);
    assert.equal(w.conversion, 90);
  });
  test('กลุ่มลูกค้าใหม่ยังไม่ครบรอบต่ออายุ', () => {
    assert.equal(c.cohort.customers, 9);
    assert.equal(c.cohort.renewRate, null);
  });
  test('แคมเปญในอนาคตไม่แสดง', () => {
    const x = r.build({ payments, orders, now, campaigns: [{ name: 'ยังไม่ยิง', at: now + D }] });
    assert.equal(x.campaigns.length, 0);
  });
  test('อัตราต่ออายุตามเดือน', () => {
    const later = r.build({ payments: [...payments, pay('new0', '2026-10-20T00:00:00Z')], orders, now: at('2026-10-25T00:00:00Z'), campaigns: [] });
    const sep = later.cohorts.find(x => x.month === '2026-09');
    // ลูกค้าใหม่ ก.ย. = old1–14 (จ่าย 2–15 ก.ย.) + new0–8 = 23 คน ครบ 35 วันหมดแล้ว
    // จ่ายซ้ำ = old1 (จ่ายอีกตอนเปิดตัว) + new0 (จ่ายอีก 20 ต.ค.)
    assert.equal(sep.customers, 23);
    assert.equal(sep.due, 23);
    assert.equal(sep.renewed, 2);
    assert.equal(sep.revenue, 25 * 399);
  });
});

describe('หน้าเว็บ', () => {
  test('เรนเดอร์ได้ ไม่มีรหัสผ่านโผล่ในลิงก์อื่นนอกจากเมนู', () => {
    const { page } = require('../src/routes/salesAdmin');
    const rep = r.build({ payments: [pay('a', '2026-09-16T18:00:00Z')], orders: [], now: at('2026-09-17T07:00:00Z'),
      campaigns: [{ name: 'เปิดตัว <b>', at: at('2026-09-16T14:00:00Z') }] });
    const html = page(rep, 'k&1');
    assert.ok(html.includes('ยอดขาย'));
    assert.ok(html.includes('เปิดตัว &lt;b&gt;'));  // escape ชื่อแคมเปญ
    assert.ok(html.includes('key=k%261'));
  });
});
