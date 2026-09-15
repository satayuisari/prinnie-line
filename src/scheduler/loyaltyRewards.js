// "ดวงเลือกคุณ" — รันทุก 15 วัน (วันที่ 2 และ 17) เวลา 09:00 Bangkok
// หาสมาชิกที่ดาวจรเดือนนี้ทำมุมกับดวงกำเนิดแรงที่สุด → ให้สิทธิ์ดูดวงกับอาจารย์ 1 ชม.
//
// ⚖️ ไม่มีการสุ่ม — คำนวณจากตำแหน่งดาวจริง รันซ้ำวันเดิมได้ผลเดิมเสมอ (ดู monthlyPick.js)
//
// ความปลอดภัย:
//   - ปิดโดยดีฟอลต์: ต้องตั้ง LOYALTY_ENABLED=true
//   - เคารพ TEST_MODE (pushText บล็อกคนนอก allowlist อยู่แล้ว)
//   - บันทึกผู้ได้รับก่อน ค่อยส่งข้อความ — ส่งไม่ผ่านลูกค้าไม่เสียสิทธิ์
//   - unique index บน cycle → รอบเดือนหนึ่งมีผู้ได้รับคนเดียวเสมอ ต่อให้รันซ้ำ
const cron    = require('node-cron');
const pick    = require('../services/monthlyPick');
const loyalty = require('../services/loyaltyReward');
const lineMsg = require('../services/lineMessaging');
const announce = require('../services/pickAnnounce');
const db      = require('../db');

async function runMonthlyPick({ at = new Date(), dryRun = false } = {}) {
  if (process.env.LOYALTY_ENABLED !== 'true') {
    console.log('[ดวงเลือกคุณ] ข้าม — ตั้ง LOYALTY_ENABLED=true เพื่อเปิดใช้งาน');
    return { picked: null, disabled: true };
  }

  if (dryRun) {
    const ranked = await pick.rank(at);
    console.log(`[ดวงเลือกคุณ] dry-run ${pick.cycleOf(at)} — เข้าเกณฑ์ ${ranked.length} คน` +
      (ranked[0] ? ` · อันดับ 1: ${ranked[0].name || ranked[0].line_user_id.slice(0, 10)} (${ranked[0].detail} · ${ranked[0].score})` : ''));
    return { picked: null, dryRun: true, ranked: ranked.length, top: ranked[0] || null };
  }

  const winner = await pick.pickForCycle(at);
  if (!winner) {
    console.log(`[ดวงเลือกคุณ] ${pick.cycleOf(at)} — ไม่มีผู้ได้รับ (รอบนี้เลือกไปแล้ว หรือไม่มีใครเข้าเกณฑ์)`);
    return { picked: null };
  }

  console.log(`[ดวงเลือกคุณ] ${winner.cycle} → ${winner.line_user_id.slice(0, 10)}… · ${winner.detail} · คะแนน ${winner.score} (จาก ${winner.total} คน)`);

  try {
    await lineMsg.pushText(winner.line_user_id, pick.pickMessage(winner.name, winner.detail));
    await loyalty.markNotified(winner.id);
  } catch (err) {
    console.error(`[ดวงเลือกคุณ] แจ้งไม่สำเร็จ ${winner.line_user_id}: ${err.message}`);
  }

  // ประกาศให้ทุกคนเห็น (ไม่เปิดชื่อ) — bon สั่ง 15 ก.ย. 69: คนอื่นต้องรู้ว่ารอบนี้มีคนได้จริง
  // จะได้อยากเป็นสมาชิก · ปิดได้ด้วย LOYALTY_ANNOUNCE=false · TEST_MODE บล็อกให้เองอีกชั้น
  let announced = null;
  if (process.env.LOYALTY_ANNOUNCE !== 'false') {
    announced = await announce.broadcastAnnouncement({ at, detail: winner.detail, total: winner.total });
    if (announced.oa1 === 'sent' || announced.oa2 === 'sent') {
      await db.query('UPDATE loyalty_rewards SET announced_at=NOW() WHERE id=$1', [winner.id]).catch(() => {});
    }
    console.log(`[ดวงเลือกคุณ] ประกาศสาธารณะ: OA1 ${announced.oa1} · OA2 ${announced.oa2}`);
  }

  await lineMsg.notifyAdmins(
    `🔮 ดวงเลือกคุณ ${winner.cycle}\n` +
    `ผู้ได้รับ: ${winner.name || winner.line_user_id.slice(0, 12)}\n` +
    `เหตุผล: ${winner.detail} (คะแนน ${winner.score})\n` +
    `คัดจากสมาชิกที่เข้าเกณฑ์ ${winner.total} คน · รอนัดเวลากับอาจารย์\n` +
    (announced ? `ประกาศสาธารณะ: @prinnie333 ${announced.oa1} · บัญชีใหญ่ ${announced.oa2}` : 'ไม่ได้ประกาศสาธารณะ (LOYALTY_ANNOUNCE=false)')
  ).catch(() => {});

  return { picked: winner, announced };
}

function start() {
  // วันที่ 2 และ 17 ของทุกเดือน 09:00 Bangkok — รอบละ 15 วัน
  // ต้องตรงกับที่บอกไว้ในข้อความบรอดแคสต์ ไม่งั้นสัญญากับลูกค้าไม่เป็นจริง
  cron.schedule('0 9 2,17 * *', () => runMonthlyPick(), { timezone: 'Asia/Bangkok' });
  const state = process.env.LOYALTY_ENABLED === 'true'
    ? '(ENABLED)' : '(ปิดอยู่ — ตั้ง LOYALTY_ENABLED=true)';
  console.log(`[ดวงเลือกคุณ] คัดผู้ได้รับทุก 15 วัน (วันที่ 2 และ 17) · 09:00 Bangkok · สมาชิกครบ ${pick.MIN_MEMBER_DAYS} วัน ${state}`);
}

module.exports = { start, runMonthlyPick };
