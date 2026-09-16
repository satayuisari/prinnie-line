// ตั้งเวลาให้โต๊ะคอนเทนต์ทำงานเอง
//
//   17:00 ทุกวัน  — คิดโพสต์ของพรุ่งนี้ แล้วส่งเข้าไลน์แอดมิน (บอง + แม่) พร้อมก๊อปไปโพสต์
//   09:30 ทุกวัน  — วัดผลโพสต์ที่โพสต์ไปแล้วเกิน 3 วัน (เงียบ ๆ ไม่กวนใคร)
//   09:40 จันทร์  — สรุปว่ามุมไหนได้ผล ส่งเข้าไลน์ครั้งเดียวต่อสัปดาห์
//
// ปิดทั้งชุดได้ด้วย CONTENT_DESK_ENABLED=false — ทุกอย่างในระบบนี้ต้องปิดได้จากตัวแปรเดียว
const cron = require('node-cron');
const contentDesk = require('../services/contentDesk');
const lineMessaging = require('../services/lineMessaging');

const TZ = { timezone: 'Asia/Bangkok' };
const enabled = () => process.env.CONTENT_DESK_ENABLED !== 'false';

async function proposeAndSend() {
  if (!enabled()) return;
  try {
    const { row, reused } = await contentDesk.propose({});
    if (reused && row.status !== 'DRAFT') return;   // ตัดสินใจไปแล้ว ไม่ต้องกวนซ้ำ
    await lineMessaging.notifyAdmins(contentDesk.toLineText(row));
    console.log(`[content] เสนอโพสต์ ${row.for_date} มุม "${row.theme}" (${row.source})`);
  } catch (e) {
    console.error('[content] เสนอโพสต์ไม่สำเร็จ:', e.message);
  }
}

async function measureQuietly() {
  if (!enabled()) return;
  try {
    const n = await contentDesk.measure();
    if (n) console.log(`[content] วัดผลโพสต์แล้ว ${n} ชิ้น`);
  } catch (e) {
    console.error('[content] วัดผลไม่สำเร็จ:', e.message);
  }
}

async function weeklyScoreboard() {
  if (!enabled()) return;
  try {
    await lineMessaging.notifyAdmins(await contentDesk.scoreboard());
  } catch (e) {
    console.error('[content] สรุปมุมไม่สำเร็จ:', e.message);
  }
}

function start() {
  cron.schedule('0 17 * * *', proposeAndSend, TZ);
  cron.schedule('30 9 * * *', measureQuietly, TZ);
  cron.schedule('40 9 * * 1', weeklyScoreboard, TZ);
  console.log(`[content] โต๊ะคอนเทนต์ — เสนอโพสต์พรุ่งนี้ 17:00 · วัดผล 09:30 · สรุปมุมวันจันทร์ 09:40${enabled() ? '' : ' (ปิดอยู่)'}`);
}

module.exports = { start, proposeAndSend, measureQuietly, weeklyScoreboard };
