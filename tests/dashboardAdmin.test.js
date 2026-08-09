// เทสหน้าแอดมินระดับ HTTP — สิทธิ์เข้าถึง + ใช้งานครบวงจรโดยไม่ต้องแตะ terminal
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const helpers = require('./helpers');

helpers.prepareEnv('dashboard');
process.env.DASHBOARD_KEY = 'test-key';

const express = require('express');
const bodyParser = require('body-parser');
const db = require('../src/db');
const dashboard = require('../src/routes/dashboard');
const go = require('../src/routes/go');
const subscribers = require('../src/services/subscriberService');
const orders = require('../src/services/paymentOrders');
const paymentApprove = require('../src/services/paymentApprove');
const commission = require('../src/services/affiliateCommission');

let server, base;
const KEY = 'test-key';
const url = (p, key = KEY) => `${base}${p}${p.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`;
const post = (p, body, key) => fetch(url(p, key), {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});

before(async () => {
  await helpers.migrate(db);
  await helpers.reset(db);
  const app = express();
  app.use(bodyParser.json());
  go.register(app);
  dashboard.register(app);
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await db.end(); });

describe('§19 สิทธิ์เข้าถึง', () => {
  test('ไม่มีคีย์ = เข้าไม่ได้ทุก endpoint การเงิน', async () => {
    const noKey = [
      ['GET', '/dashboard'],
      ['POST', '/dashboard/affiliate/create'],
      ['POST', '/dashboard/commission/1/approve'],
      ['POST', '/dashboard/commission/1/paid'],
      ['POST', '/dashboard/commission/1/reverse'],
      ['POST', '/dashboard/commission/approve-due'],
      ['POST', '/dashboard/candidate'],
      ['GET', '/dashboard/audit'],
    ];
    for (const [method, path] of noKey) {
      const r = await fetch(`${base}${path}`, { method });
      assert.equal(r.status, 401, `${method} ${path} ต้องเป็น 401 เมื่อไม่มีคีย์`);
    }
  });

  test('คีย์ผิด = 401', async () => {
    assert.equal((await post('/dashboard/affiliate/create', { name: 'x' }, 'wrong')).status, 401);
  });
});

describe('§2 §9 §22 ใช้งานครบวงจรจากหน้าเว็บ', () => {
  test('สร้างอินฟลู → ได้ลิงก์ → ลูกค้าจ่าย → approve → mark paid', async () => {
    // สร้างอินฟลูจากหน้าเว็บ (ไม่ใช้ CLI)
    const created = await (await post('/dashboard/affiliate/create', { name: 'หมอดูมัดหมี่', code: 'mudmee' })).json();
    assert.equal(created.code, 'mudmee');
    assert.match(created.url, /\/go\?a=mudmee$/);

    // คลิกลิงก์ติดตามผล → 302 + คุกกี้ first-touch + นับคลิก
    const hit = await fetch(`${base}/go?a=mudmee`, { redirect: 'manual' });
    assert.equal(hit.status, 302);
    assert.match(hit.headers.get('set-cookie') || '', /paff=mudmee/);

    await helpers.registerUser(subscribers, 'U_ui', { code: 'mudmee' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_ui', 'ORD_UI');

    // หน้าแดชบอร์ดต้องโหลดได้และมีตัวเลขของอินฟลูคนนี้
    const page = await (await fetch(url('/dashboard'))).text();
    assert.ok(page.includes('mudmee'), 'หน้าแดชบอร์ดต้องแสดงอินฟลูที่สร้าง');
    assert.ok(page.includes('Commissions'), 'ต้องมีแท็บ Commissions');

    const id = (await commission.list({}))[0].id;
    assert.equal((await (await post(`/dashboard/commission/${id}/approve`)).json()).ok, true);
    assert.equal((await commission.totals()).approved, commission.BASE_CPA);
    assert.equal((await (await post(`/dashboard/commission/${id}/paid`)).json()).ok, true);
    assert.equal((await commission.totals()).paid, commission.BASE_CPA);

    // จ่ายซ้ำใบเดิมไม่ได้ (กันกดสองรอบ)
    assert.equal((await post(`/dashboard/commission/${id}/paid`)).status, 400);
  });

  test('reverse ต้องมีเหตุผล · promoter kit และรายงานก๊อปได้', async () => {
    const created = await (await post('/dashboard/affiliate/create', { name: 'อีกคน', code: 'aff2' })).json();
    await helpers.registerUser(subscribers, 'U_ui2', { code: 'aff2' });
    await helpers.payOrder(db, orders, paymentApprove, 'U_ui2', 'ORD_UI2');
    const id = (await commission.list({ code: 'aff2' }))[0].id;

    assert.equal((await post(`/dashboard/commission/${id}/reverse`, { reason: '' })).status, 400);
    const r = await (await post(`/dashboard/commission/${id}/reverse`, { reason: 'ลูกค้าขอคืนเงิน' })).json();
    assert.equal(r.ok, true);

    const kit = await (await fetch(url(`/dashboard/affiliate/${created.code}/kit`))).json();
    assert.ok(kit.text.includes(created.url), 'promoter kit ต้องมีลิงก์เฉพาะของอินฟลู');
    assert.ok(kit.text.includes('50 บาท'), 'ต้องบอกกติกาค่าคอมชัดเจน');

    const report = await (await fetch(url(`/dashboard/affiliate/${created.code}/report`))).text();
    assert.ok(report.includes('Prinnie Affiliate Report'));
    assert.ok(report.includes('First Paid:'));
  });

  test('CRM: เพิ่ม → เปลี่ยนสถานะ → ค้นหา → แปลงเป็นอินฟลู', async () => {
    const c = await (await post('/dashboard/candidate', {
      display_name: 'Test Creator', platform: 'tiktok', followers: '12000', score_audience_fit: '5', score_trust: '4',
    })).json();
    assert.ok(c.id);

    await post(`/dashboard/candidate/${c.id}/status`, { status: 'INTERESTED' });
    await post(`/dashboard/candidate/${c.id}/note`, { note: 'ตอบกลับเร็ว' });
    await post(`/dashboard/candidate/${c.id}/status`, { status: 'APPROVED' });

    const found = await (await fetch(url('/dashboard/candidates?q=test&sort=score'))).text();
    assert.ok(found.includes('Test Creator'));
    const filtered = await (await fetch(url('/dashboard/candidates?status=DECLINED'))).text();
    assert.ok(!filtered.includes('Test Creator'), 'กรองสถานะต้องได้ผล');

    const aff = await (await post(`/dashboard/candidate/${c.id}/convert`, { code: 'testcreator' })).json();
    assert.equal(aff.code, 'testcreator');

    // แปลงซ้ำไม่ได้
    assert.equal((await post(`/dashboard/candidate/${c.id}/convert`, {})).status, 400);
  });

  test('pause/off อินฟลู แล้วข้อมูลเดิมยังอยู่', async () => {
    const before = await commission.totals();
    const r = await (await post('/dashboard/affiliate/aff2/status', { status: 'PAUSED', reason: 'ผลงานไม่เข้าเป้า' })).json();
    assert.equal(r.status, 'PAUSED');
    const after = await commission.totals();
    assert.deepEqual(after, before, 'pause ต้องไม่แตะประวัติค่าคอม');
  });

  test('ข้อความทาบทามแก้แล้วเก็บไว้ได้', async () => {
    const kit = require('../src/services/promoterKit');
    assert.ok((await kit.getOutreach()).includes('Affiliate Partner'));
    await post('/dashboard/outreach', { text: 'ข้อความใหม่ของ Bon' });
    assert.equal(await kit.getOutreach(), 'ข้อความใหม่ของ Bon');
  });
});
