// "ดวงเลือกคุณ" — คัดผู้ได้รับจากดาวจร ไม่ใช่การสุ่ม
// เทสที่สำคัญที่สุดคือ "รันซ้ำวันเดิมต้องได้คนเดิม" — คือสิ่งที่ทำให้ไม่ใช่การเสี่ยงโชค
const { test, before, beforeEach, after, describe } = require('node:test');
const assert = require('node:assert');
const helpers = require('./helpers');

helpers.prepareEnv('monthlypick');

const db = require('../src/db');
const subscribers = require('../src/services/subscriberService');
const pick = require('../src/services/monthlyPick');

const AT = new Date('2026-09-15T02:00:00Z');

// สมาชิกจ่ายจริงที่เป็นสมาชิกมานานพอ (ตั้ง subscribe_start ย้อนหลัง)
async function member(id, birth, daysAgo = 60) {
  await subscribers.upsertSubscriber({
    line_user_id: id, display_name: id, nickname: id,
    birth_date: birth, birth_time: '08:30', birth_place: 'Bangkok',
    lat: 13.7563, lng: 100.5018,
  });
  // นับอายุสมาชิกเทียบกับ "วันที่คัดเลือก" ไม่ใช่ NOW() — ไม่งั้นตั้งค่า 3 วันแต่พอถึงวันคัดจริง
  // (ซึ่งอยู่ในอนาคต) กลายเป็นครบเกณฑ์ไปแล้ว เทสจะไม่ได้ทดสอบสิ่งที่ตั้งใจ
  await db.query(
    `UPDATE line_subscribers
        SET status='ACTIVE', payment_ref='sub_test',
            subscribe_start = $3::timestamp - ($2||' days')::interval,
            -- ให้อายุสมาชิกยาวพอครอบทุกวันที่ในเทส (มีเคสจัดอันดับข้ามปีเพื่อดูดาวเคลื่อน)
            -- เกณฑ์จริงต้องยังไม่หมดอายุ ณ วันคัดเลือก — เทสหมดอายุอยู่ในเคสของตัวเองด้านล่าง
            subscribe_end   = $3::timestamp + INTERVAL '3 years'
      WHERE line_user_id=$1`, [id, String(daysAgo), AT.toISOString()]);
}

before(async () => { await helpers.migrate(db); });
beforeEach(async () => {
  await db.query('DELETE FROM loyalty_rewards');
  await helpers.reset(db);
});
after(async () => { await db.end(); });

describe('การคัดเลือก', () => {
  test('รันซ้ำวันเดิม ได้ผลเดิมทุกครั้ง (ไม่ใช่การสุ่ม)', async () => {
    for (const [id, b] of [['U_a', '1990-03-14'], ['U_b', '1985-11-02'], ['U_c', '1996-07-21']]) {
      await member(id, b);
    }
    const r1 = await pick.rank(AT);
    const r2 = await pick.rank(AT);
    const r3 = await pick.rank(AT);
    assert.ok(r1.length > 0, 'ต้องมีคนเข้าเกณฑ์');
    assert.deepEqual(r1.map(x => x.line_user_id), r2.map(x => x.line_user_id));
    assert.deepEqual(r2.map(x => x.line_user_id), r3.map(x => x.line_user_id));
  });

  test('ไม่มี Math.random ในไฟล์ที่ตัดสินผล', async () => {
    const fs = require('fs');
    for (const f of ['../src/services/monthlyPick.js', '../src/scheduler/loyaltyRewards.js']) {
      // ตัดคอมเมนต์ออกก่อน — ในไฟล์มีคำว่า Math.random อยู่ในคอมเมนต์ที่อธิบายว่า "ห้ามใช้"
      const code = fs.readFileSync(require.resolve(f), 'utf8')
        .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
      assert.ok(!/Math\.random|crypto\.randomInt/.test(code), `${f} ต้องไม่มีการสุ่มในโค้ดจริง`);
    }
  });

  test('คนละเดือน ผลลัพธ์ต่างกันได้ (ดาวเคลื่อน)', async () => {
    for (let i = 0; i < 8; i++) {
      await member('U_m' + i, `199${i % 10}-0${(i % 9) + 1}-1${i % 9}`);
    }
    const sep = (await pick.rank(new Date('2026-09-15T02:00:00Z'))).map(x => x.line_user_id);
    const mar = (await pick.rank(new Date('2027-03-15T02:00:00Z'))).map(x => x.line_user_id);
    assert.ok(sep.length && mar.length);
    assert.notDeepEqual(sep, mar, 'ผ่านไปครึ่งปี อันดับควรเปลี่ยน');
  });

  test('คะแนนอธิบายได้: มีดาวและมุมกำกับเสมอ', async () => {
    await member('U_x', '1988-05-05');
    const [top] = await pick.rank(AT);
    assert.ok(top.detail && top.detail.split(' ').length === 3, 'ต้องบอกว่าดาวอะไร ทำมุมอะไร กับอะไร');
    assert.ok(top.score > 0);
  });
});

describe('เกณฑ์ผู้มีสิทธิ์', () => {
  test('สมาชิกใหม่ยังไม่ครบ 14 วัน = ยังไม่เข้าเกณฑ์', async () => {
    await member('U_new', '1990-01-01', 3);
    await member('U_old', '1990-01-01', 30);
    const ids = (await pick.rank(AT)).map(x => x.line_user_id);
    assert.ok(!ids.includes('U_new'));
    assert.ok(ids.includes('U_old'));
  });

  test('บัญชีทดลอง/founder ไม่เข้าเกณฑ์', async () => {
    await member('U_paid', '1990-01-01');
    await member('U_founder', '1990-01-01');
    await db.query("UPDATE line_subscribers SET payment_ref='founder' WHERE line_user_id='U_founder'");
    const ids = (await pick.rank(AT)).map(x => x.line_user_id);
    assert.ok(ids.includes('U_paid'));
    assert.ok(!ids.includes('U_founder'), 'founder ไม่ควรมาแย่งสิทธิ์ลูกค้าจริง');
  });

  // ⚠️ เจอจากข้อมูลจริง 23 ส.ค. 69: status ไม่เคยถูกเปลี่ยนกลับเป็น EXPIRED
  //    → คนหมดอายุ 31 คนค้างเป็น ACTIVE และเข้าเกณฑ์ชิงสิทธิ์ได้ทั้งที่ไม่ใช่สมาชิกแล้ว
  test('หมดอายุก่อนวันคัดเลือก = ไม่เข้าเกณฑ์ แม้ status ยังค้างเป็น ACTIVE', async () => {
    await member('U_live', '1990-01-01');
    await member('U_lapsed', '1992-02-02');
    await db.query(
      `UPDATE line_subscribers SET subscribe_end = $1::timestamp - INTERVAL '5 days'
        WHERE line_user_id='U_lapsed'`, [AT.toISOString()]);
    const ids = (await pick.rank(AT)).map(x => x.line_user_id);
    assert.ok(ids.includes('U_live'));
    assert.ok(!ids.includes('U_lapsed'), 'คนที่หมดอายุแล้วต้องไม่ได้สิทธิ์');
  });

  test('คนที่เพิ่งได้รับสิทธิ์ ต้องเว้น 12 เดือน', async () => {
    await member('U_1', '1990-01-01');
    await member('U_2', '1992-02-02');
    const first = await pick.pickForCycle(AT);
    assert.ok(first, 'รอบแรกต้องมีผู้ได้รับ');
    const ids = (await pick.rank(new Date('2026-10-15T02:00:00Z'))).map(x => x.line_user_id);
    assert.ok(!ids.includes(first.line_user_id), 'เดือนถัดไปคนเดิมต้องไม่อยู่ในรายชื่อ');
  });
});

describe('การบันทึกผล', () => {
  test('1 รอบเดือน = ผู้ได้รับ 1 คน แม้รันซ้ำ', async () => {
    for (let i = 0; i < 5; i++) await member('U_p' + i, `199${i}-0${i + 1}-15`);
    const a = await pick.pickForCycle(AT);
    assert.ok(a);
    for (let i = 0; i < 3; i++) {
      assert.equal(await pick.pickForCycle(AT), null, 'รันซ้ำต้องไม่ได้ผู้ได้รับเพิ่ม');
    }
    const n = await db.query("SELECT COUNT(*)::int n FROM loyalty_rewards WHERE cycle='2026-09'");
    assert.equal(n.rows[0].n, 1);
  });

  test('บันทึกเหตุผลไว้ตรวจย้อนหลังได้', async () => {
    await member('U_r', '1991-09-09');
    const w = await pick.pickForCycle(AT);
    const row = (await db.query('SELECT cycle, score, detail, note FROM loyalty_rewards WHERE id=$1', [w.id])).rows[0];
    assert.equal(row.cycle, '2026-09');
    assert.ok(Number(row.score) > 0);
    assert.ok(row.detail.length > 3);
    assert.match(row.note, /อันดับ 1 จาก \d+ คน/);
  });

  test('ไม่มีใครเข้าเกณฑ์ → ไม่พัง คืน null', async () => {
    assert.equal(await pick.pickForCycle(AT), null);
  });

  test('ข้อความแจ้งผล ไม่ใช้คำว่าโชคดี/สุ่ม และบอกเหตุผล', async () => {
    const msg = pick.pickMessage('ส้ม', 'Saturn Trine Jupiter');
    for (const w of ['โชคดี', 'สุ่ม', 'จับรางวัล', 'ลุ้น', 'ผู้ชนะ']) {
      assert.ok(!msg.includes(w), `ห้ามมีคำว่า "${w}"`);
    }
    assert.ok(msg.includes('ดาวเสาร์'), 'ต้องบอกว่าดาวอะไรทำให้ได้รับสิทธิ์');
  });
});
