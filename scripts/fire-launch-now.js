// สั่งยิงบรอดแคสต์เปิดตัวเดี๋ยวนี้ (idempotent — claim ก่อนยิง กันซ้ำ)
// รัน: railway run bash -c 'DATABASE_URL="$PUB" node scripts/fire-launch-now.js'
require('../src/scheduler/launchBroadcast').fire()
  .then(() => { console.log('fire() เสร็จ'); process.exit(0); })
  .catch(e => { console.error('ERR', e.message); process.exit(1); });
