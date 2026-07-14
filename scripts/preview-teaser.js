// พรีวิว teaser: สร้างจากดวงจริงของ Bon แล้วส่งให้ดู
const subs = require('../src/services/subscriberService');
const teaser = require('../src/services/dailyTeaser');
const lm = require('../src/services/lineMessaging');

(async () => {
  const uid = 'Ub358215999e4bede8773435eb812695a';
  const bon = await subs.getByLineUserId(uid);
  if (!bon || !bon.chart_data) { console.log('Bon ไม่มีดวง'); process.exit(0); }
  const free = await teaser.buildFreeFullDay(bon.chart_data, bon.nickname);
  const lock = await teaser.build(bon.chart_data, bon.nickname);
  console.log('=== วันแรก: ดวงเต็มฟรี ===\n' + free.find(m => m.type === 'text').text);
  console.log('\n=== วันถัดไป: teaser ล็อก ===\n' + lock.find(m => m.type === 'text').text);
  await lm.client.pushMessage({ to: uid, messages: [{ type: 'text', text: '━━ วันแรก (ฟรีเต็ม) ━━' }, ...free] });
  await lm.client.pushMessage({ to: uid, messages: [{ type: 'text', text: '━━ วันถัดไป (teaser ล็อก) ━━' }, ...lock] });
  console.log('\n✓ ส่ง preview 2 แบบให้ Bon แล้ว');
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
