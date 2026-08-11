// ให้สิทธิ์ดูดวงกับ อ.ปรินนี่ + แจ้งลูกค้า — รันทุกสิ้นเดือน 19:00 Bangkok
//
// ⚖️ ไม่มีการสุ่มในไฟล์นี้โดยตั้งใจ: ใครจ่ายครบเกณฑ์ได้ทุกคน (ดูเหตุผลใน loyaltyReward.js)
//    ถ้ามีใครแก้ให้เป็นการสุ่มเมื่อไหร่ = กลายเป็นการเสี่ยงโชค ต้องขออนุญาตก่อนจัด
//
// ความปลอดภัย:
//   - ปิดโดยดีฟอลต์: ต้องตั้ง LOYALTY_ENABLED=true ถึงจะให้สิทธิ์/ส่งข้อความ
//   - เคารพ TEST_MODE: pushText บล็อกคนนอก allowlist อยู่แล้ว
//   - ให้สิทธิ์ก่อน ค่อยส่งข้อความ — ส่งไม่ผ่านก็ไม่เสียสิทธิ์ของลูกค้า (สถานะยังเป็น GRANTED ไว้ส่งซ้ำได้)
const cron    = require('node-cron');
const loyalty = require('../services/loyaltyReward');
const lineMsg = require('../services/lineMessaging');

async function runLoyalty({ dryRun = false } = {}) {
  if (process.env.LOYALTY_ENABLED !== 'true') {
    console.log('[Loyalty] ข้าม — ตั้ง LOYALTY_ENABLED=true เพื่อเปิดใช้งาน');
    return { granted: 0, notified: 0, disabled: true };
  }

  const eligible = await loyalty.findEligible();
  if (dryRun) {
    console.log(`[Loyalty] dry-run — ครบเกณฑ์ ${eligible.length} คน (ยังไม่ให้สิทธิ์จริง)`);
    return { granted: 0, notified: 0, eligible: eligible.length, dryRun: true };
  }

  const granted = await loyalty.grantAllEligible();
  let notified = 0;
  for (const g of granted) {
    try {
      await lineMsg.pushText(g.line_user_id, loyalty.grantMessage(g.nickname));
      await loyalty.markNotified(g.id);
      notified++;
    } catch (err) {
      // สิทธิ์ให้ไปแล้ว แค่ยังแจ้งไม่ได้ — รอบหน้าหรือแอดมินส่งเองได้จากแดชบอร์ด
      console.error(`[Loyalty] แจ้งไม่สำเร็จ ${g.line_user_id}: ${err.message}`);
    }
  }

  console.log(`[Loyalty] เสร็จ — ให้สิทธิ์ใหม่ ${granted.length} คน · แจ้งแล้ว ${notified} คน`);
  if (granted.length) {
    await lineMsg.notifyAdmins(
      `🎁 สิทธิ์ดูดวงกับอาจารย์ประจำเดือนนี้: ${granted.length} คน\n` +
      granted.map(g => `· ${g.nickname || g.line_user_id.slice(0, 10)} (จ่ายครบ ${g.paid_count} ครั้ง)`).join('\n')
    ).catch(() => {});
  }
  return { granted: granted.length, notified, eligible: eligible.length };
}

function start() {
  // 19:00 ของวันที่ 28–31 แล้วเช็คในโค้ดว่าเป็นวันสุดท้ายของเดือนจริงไหม
  // (cron ไม่มีนิพจน์ "วันสุดท้ายของเดือน" ตรง ๆ)
  cron.schedule('0 19 28-31 * *', () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    if (tomorrow.getDate() !== 1) return;      // ยังไม่ใช่วันสุดท้ายของเดือน
    runLoyalty();
  }, { timezone: 'Asia/Bangkok' });

  const state = process.env.LOYALTY_ENABLED === 'true'
    ? '(ENABLED)' : '(ปิดอยู่ — ตั้ง LOYALTY_ENABLED=true)';
  console.log(`[Loyalty] สิทธิ์ดูดวงกับอาจารย์ — สิ้นเดือน 19:00 Bangkok · จ่ายครบ ${loyalty.MILESTONE} ครั้ง ${state}`);
}

module.exports = { start, runLoyalty };
