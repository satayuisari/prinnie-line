// ตาข่ายกันตกของสิทธิ์ Ask Prinnie 3
//
// ปกติสิทธิ์ถูกให้ "ทันทีที่จ่ายครบเกณฑ์" ใน paymentApprove แล้ว
// ตัวนี้คือรอบตรวจซ้ำสิ้นเดือน เผื่อมีเคสที่ให้ไม่สำเร็จตอนนั้น (เช่น DB สะดุด/แจ้งไม่ผ่าน)
// → "ตรวจสอบและแจ้งสิทธิ์สมาชิกที่ครบเกณฑ์" ไม่ใช่การประกาศรายชื่อผู้ชนะ (ไม่ใช่การแข่งขัน/สุ่ม)
//
// ⚖️ ไม่มีการสุ่มในไฟล์นี้โดยตั้งใจ — ครบเกณฑ์ได้ทุกคน
// ความปลอดภัย: ปิดโดยดีฟอลต์ (LOYALTY_ENABLED) · เคารพ TEST_MODE · ให้สิทธิ์ก่อนค่อยส่งข้อความ
const cron    = require('node-cron');
const loyalty = require('../services/loyaltyReward');
const lineMsg = require('../services/lineMessaging');

const askUrl = () => (process.env.PUBLIC_BASE_URL
  || 'https://prinnie-app-production.up.railway.app').replace(/\/$/, '') + '/ask.html';

async function runLoyalty({ dryRun = false } = {}) {
  if (process.env.LOYALTY_ENABLED !== 'true') {
    console.log('[Loyalty] ข้าม — ตั้ง LOYALTY_ENABLED=true เพื่อเปิดใช้งาน');
    return { granted: 0, notified: 0, disabled: true };
  }

  const eligible = await loyalty.findEligible();
  if (dryRun) {
    console.log(`[Loyalty] dry-run — ครบเกณฑ์แต่ยังไม่ได้สิทธิ์ ${eligible.length} คน`);
    return { granted: 0, notified: 0, eligible: eligible.length, dryRun: true };
  }

  const granted = await loyalty.grantAllEligible();
  let notified = 0;
  for (const g of granted) {
    try {
      await lineMsg.pushText(g.line_user_id, loyalty.grantMessage(g.nickname, askUrl()));
      await loyalty.markNotified(g.id);
      notified++;
    } catch (err) {
      // สิทธิ์ให้ไปแล้ว แค่ยังแจ้งไม่ได้ — รอบหน้าเก็บตก หรือแอดมินส่งเองจากแดชบอร์ด
      console.error(`[Loyalty] แจ้งไม่สำเร็จ ${g.line_user_id}: ${err.message}`);
    }
  }

  console.log(`[Loyalty] เสร็จ — สิทธิ์ใหม่ ${granted.length} · แจ้งแล้ว ${notified}`);

  // เตือนแอดมินถ้าคิวอาจารย์เริ่มยาว (capacity guard — ไม่ได้จำกัดคนได้สิทธิ์ แต่เตือนให้จัดคิวทัน)
  const queue = await loyalty.advisorQueue();
  if (queue.length) {
    const oldest = Math.round(Math.max(...queue.map(q => Number(q.hours_waiting) || 0)));
    await lineMsg.notifyAdmins(
      `📋 คิว Ask Prinnie 3: รอตอบ ${queue.length} ราย (รอนานสุด ${oldest} ชม.)`
    ).catch(() => {});
  }
  return { granted: granted.length, notified, eligible: eligible.length, queue: queue.length };
}

function start() {
  // 19:00 ของวันที่ 28–31 แล้วเช็คในโค้ดว่าเป็นวันสุดท้ายของเดือนจริงไหม
  cron.schedule('0 19 28-31 * *', () => {
    const tomorrow = new Date(Date.now() + 86400000);
    if (tomorrow.getDate() !== 1) return;
    runLoyalty();
  }, { timezone: 'Asia/Bangkok' });

  const state = process.env.LOYALTY_ENABLED === 'true'
    ? '(ENABLED)' : '(ปิดอยู่ — ตั้ง LOYALTY_ENABLED=true)';
  console.log(`[Loyalty] ${loyalty.REWARD_NAME} — ตรวจสิทธิ์สิ้นเดือน 19:00 · ครบ ${loyalty.MILESTONE} รอบ ${state}`);
}

module.exports = { start, runLoyalty };
