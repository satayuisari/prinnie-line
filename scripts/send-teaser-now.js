// ยิง teaser/ดวงเต็มฟรี ให้ทุกคนที่ลงทะเบียนแต่ยังไม่จ่าย "เดี๋ยวนี้" (สมาชิกไม่โดน — query กรองออก)
const subs = require('../src/services/subscriberService');
const teaser = require('../src/services/dailyTeaser');
const lm = require('../src/services/lineMessaging');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const leads = await subs.getRegisteredInactive();
  console.log(`เป้าหมาย: ${leads.length} คน (ลงทะเบียนแต่ยังไม่จ่าย)`);
  let sent = 0, fail = 0, skip = 0;
  for (const m of leads) {
    try {
      const free = await subs.claimFreeDaily(m.line_user_id);   // วันแรก = ฟรีเต็ม
      const msgs = free ? await teaser.buildFreeFullDay(m.chart_data, m.nickname)
                        : await teaser.build(m.chart_data, m.nickname);
      const res = await lm.pushMessage(m.line_user_id, msgs);
      if (res && res.skipped) skip++; else sent++;
    } catch (e) { fail++; if (fail <= 5) console.error('  ✗', m.line_user_id, e.message); }
    if ((sent + fail + skip) % 50 === 0) { console.log(`  ...${sent + fail + skip}/${leads.length}`); await sleep(300); }
  }
  console.log(`\n✅ ส่งสำเร็จ ${sent} | ข้าม(TEST_MODE) ${skip} | ล้มเหลว ${fail}`);
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
