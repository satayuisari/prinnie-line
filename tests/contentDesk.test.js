// โต๊ะคอนเทนต์: เสนอโพสต์ → กดโพสต์แล้ว → วัดผล → จัดอันดับมุม
//
// ไม่มี ANTHROPIC_API_KEY ในเทส ทุกเคสจึงเดินเส้นทางแผนสำรอง ซึ่งเป็นเส้นทางที่ต้องไม่พังที่สุด
// (โปรดักชันตกมาใช้เส้นนี้ทุกครั้งที่ AI ปิดหรืองบหมด)
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const helpers = require('./helpers');

helpers.prepareEnv('content');
delete process.env.ANTHROPIC_API_KEY;

const db = require('../src/db');
const contentDesk = require('../src/services/contentDesk');
const { BANNED } = require('../src/services/pickAnnounce');

before(async () => {
  await helpers.migrate(db);
});
after(async () => {
  await db.end();
});

test('เสนอโพสต์ได้ และแคปชั่นไม่มีคำต้องห้าม', async () => {
  const { row } = await contentDesk.propose({ forDate: '2026-09-20' });
  assert.equal(row.status, 'DRAFT');
  assert.equal(row.source, 'fallback');          // ไม่มีคีย์ AI ในเทส
  assert.ok(row.caption.length > 60, 'แคปชั่นต้องยาวพอใช้จริง');
  assert.ok(row.theme, 'ต้องระบุมุม');
  for (const w of BANNED) assert.ok(!row.caption.includes(w), `แคปชั่นมีคำต้องห้าม "${w}"`);
});

test('วันเดิมเสนอซ้ำไม่สร้างแถวใหม่', async () => {
  const again = await contentDesk.propose({ forDate: '2026-09-20' });
  assert.equal(again.reused, true);
  const n = (await db.query(`SELECT COUNT(*)::int n FROM content_posts WHERE for_date='2026-09-20'`)).rows[0].n;
  assert.equal(n, 1);
});

test('มุมที่เพิ่งเล่าไปจะไม่ถูกหยิบซ้ำทันที', async () => {
  const ctx = await contentDesk.context();
  const next = contentDesk.pickAngle(ctx);
  const used = ctx.recent.slice(0, 5).map((r) => r.theme);
  assert.ok(!used.includes(next.key), `เลือกมุมซ้ำกับที่เพิ่งเล่า (${next.key})`);
});

test('กดโพสต์แล้ว → วัดผลนับคนแอดใหม่และคนจ่ายในหน้าต่าง 3 วัน', async () => {
  const { row } = await contentDesk.propose({ forDate: '2026-09-21' });
  await contentDesk.markPosted(row.id);
  // ย้อนเวลาโพสต์ไป 4 วัน ให้เลยหน้าต่างวัดผล แล้วสร้างเหตุการณ์ในช่วง 3 วันหลังโพสต์
  await db.query(`UPDATE content_posts SET posted_at = NOW() - INTERVAL '4 days' WHERE id=$1`, [row.id]);
  await db.query(`INSERT INTO line_subscribers (line_user_id, created_at)
                  VALUES ('U-in', NOW() - INTERVAL '3 days'), ('U-out', NOW())`);
  await db.query(`INSERT INTO payment_orders (ref, line_user_id, type, amount, status, paid_at)
                  VALUES ('R1','U-in','subscription',39900,'PAID', NOW() - INTERVAL '3 days')`);

  const done = await contentDesk.measure();
  assert.equal(done, 1);
  const after = (await db.query('SELECT * FROM content_posts WHERE id=$1', [row.id])).rows[0];
  assert.equal(after.signups_after, 1, 'ต้องนับเฉพาะคนที่แอดในหน้าต่าง 3 วัน');
  assert.equal(after.paid_after, 1);
  assert.ok(after.measured_at, 'ต้องบันทึกว่าวัดแล้ว จะได้ไม่วัดซ้ำ');
  assert.equal(await contentDesk.measure(), 0, 'วัดแล้วต้องไม่วัดซ้ำ');
});

test('ตารางอันดับมุมอ่านรู้เรื่องหลังมีผลวัดแล้ว', async () => {
  const board = await contentDesk.scoreboard();
  assert.ok(board.includes('มุมคอนเทนต์ที่ได้ผล'), board);
  assert.ok(/แอดใหม่ 1/.test(board), board);
});

test('ข้อความที่ส่งเข้าไลน์มีครบทั้งแคปชั่น บรีฟภาพ และเหตุผล', async () => {
  const rows = await contentDesk.list(1);
  const text = contentDesk.toLineText(rows[0]);
  assert.ok(text.includes('🖼'), 'ต้องมีบรีฟภาพ');
  assert.ok(text.includes('💡'), 'ต้องมีเหตุผล');
  assert.ok(text.includes(rows[0].caption.slice(0, 30)), 'ต้องมีแคปชั่นเต็ม');
});
