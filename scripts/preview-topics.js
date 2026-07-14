// พรีวิวดวงรวมทุกเรื่อง (งาน/รัก/เงิน + ไพ่) ทุกช่วง — วัน/สัปดาห์/เดือน/ปี
const subs = require('../src/services/subscriberService');
const teaser = require('../src/services/dailyTeaser');
const lm = require('../src/services/lineMessaging');

(async () => {
  const uid = 'Ub358215999e4bede8773435eb812695a';
  const bon = await subs.getByLineUserId(uid);
  if (!bon || !bon.chart_data) { console.log('Bon ไม่มีดวง'); process.exit(0); }

  for (const period of ['weekly', 'monthly', 'annual']) {
    const full = await teaser.buildCombined(period, bon.chart_data, bon.nickname, new Date(), { locked: false });
    console.log(`\n===== ${period} (สมาชิก) =====\n` + full.find(m => m.type === 'text').text.slice(0, 800));
    await lm.client.pushMessage({ to: uid, messages: [{ type: 'text', text: `━━ ${period} ━━` }, ...full] });
  }
  console.log('\n✓ ส่ง preview วัน/สัปดาห์/เดือน/ปี ให้ Bon แล้ว');
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
