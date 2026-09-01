const cron        = require('node-cron');
const db          = require('../db');
const subscribers = require('../services/subscriberService');
const horoscope   = require('../services/horoscopeService');
const lineMessaging = require('../services/lineMessaging');
const dailyTeaser = require('../services/dailyTeaser');

function formatMessage(reading, nickname) {
  const dateStr = new Date().toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const lines = [
    `✨ ดวงประจำวันของ ${nickname || 'คุณ'}`,
    `📅 ${dateStr}`,
    '',
  ];

  if (reading.has_content) {
    lines.push(...horoscope.aspectBlocks(reading.aspects), '');
  } else {
    // ดวงนิ่ง/ไม่มีมุมเด่น → ไม่มีคำทำนายซ้ำ ส่งไพ่นำทางแทน
    lines.push(
      '🌙 วันนี้ดวงดาวของคุณนิ่งสงบ ไม่มีมุมเด่นพิเศษ',
      'เป็นวันสบาย ๆ ขอให้ไพ่ใบนี้เป็นเพื่อนนำทางคุณนะคะ ✨',
      ''
    );
  }

  if (reading.tarot) {
    lines.push(`${horoscope.tarotHeading(reading.theme)}: ${reading.tarot.name}`, reading.tarot.text);
  }

  return lines.join('\n').trim();
}

async function saveLog(subscriberId, status, err = null, type = 'daily') {
  await db.query(
    `INSERT INTO delivery_logs (subscriber_id, message_type, status, error_message, sent_at)
     VALUES ($1, $4, $2, $3, NOW())`,
    [subscriberId, status, err, type]
  );
}

async function sendDailyHoroscopes() {
  const today   = new Date();
  const members = await subscribers.getActiveSubscribers();
  console.log(`[Scheduler] ${today.toISOString().slice(0,10)} — ${members.length} active subscribers`);

  for (const m of members) {
    try {
      const msgs = await dailyTeaser.buildCombinedDaily(m.chart_data, m.nickname, today, { userId: m.line_user_id });
      await lineMessaging.pushMessage(m.line_user_id, msgs);
      await saveLog(m.id, 'success');
      console.log(`  ✓  ${m.line_user_id} (${m.nickname})`);
    } catch (err) {
      console.error(`  ✗  ${m.line_user_id}: ${err.message}`);
      await saveLog(m.id, 'failed', err.message);
    }
  }
  console.log('[Scheduler] Done.');

  // ── Teaser 8 โมงเช้า: ส่ง "ดวงล็อก" ให้คนลงทะเบียนแต่ยังไม่จ่าย → ล่อสมัคร ──
  // กัน fatigue: ไม่ยิงคนเดิมทุกวันตลอดไป — ยิงหนักช่วงร้อน (3 วันแรกหลังชิมฟรี)
  // แล้วเหลือสัปดาห์ละครั้ง เพื่อคงความอุ่นไว้โดยไม่ทำให้รำคาญจนบล็อก
  if (process.env.DAILY_TEASER_ENABLED === 'true') {
    const leads = await subscribers.getRegisteredInactive();
    const due = leads.filter(m => shouldTeaseToday(m.free_daily_at, today));
    console.log(`[Teaser] lead ${leads.length} คน → เข้าเกณฑ์ส่งวันนี้ ${due.length} คน (กัน fatigue)`);
    let sent = 0;
    for (const m of due) {
      try {
        const free = await subscribers.claimFreeDaily(m.line_user_id);   // วันแรก = ฟรีเต็ม, หลังจากนั้น teaser
        const msgs = await dailyTeaser.buildCombinedDaily(m.chart_data, m.nickname, today,
          free ? { freeDay: true, userId: m.line_user_id } : { locked: true, userId: m.line_user_id });
        const res  = await lineMessaging.pushMessage(m.line_user_id, msgs);
        if (!res || !res.skipped) { await saveLog(m.id, 'success', null, free ? 'free-day' : 'teaser'); sent++; }
      } catch (err) {
        console.error(`  ✗ teaser ${m.line_user_id}: ${err.message}`);
        await saveLog(m.id, 'failed', err.message, 'teaser').catch(() => {});
      }
    }
    console.log(`[Teaser] Done — ส่งได้ ${sent}/${due.length}`);
  }
}

// จังหวะ teaser ต่อ lead (กัน fatigue จากการยิงทุกวัน):
//   - ยังไม่เคยชิมฟรี → ยิง (จะได้ freeDay วันแรก)
//   - หลังชิมฟรี 1-3 วัน → ยิงทุกวัน (ช่วงร้อน เพิ่งเห็นของดี ยอมจ่ายง่ายสุด)
//   - หลังจากนั้น → สัปดาห์ละครั้ง (ทุกวันที่ 7 นับจากวันชิมฟรี) คงความอุ่นไว้ไม่ให้เผา
function shouldTeaseToday(freeDailyAt, today = new Date()) {
  if (!freeDailyAt) return true;
  const days = Math.floor((today - new Date(freeDailyAt)) / 86400000);
  if (days <= 3) return true;
  return days % 7 === 0;
}

function start() {
  cron.schedule('0 8 * * *', sendDailyHoroscopes, { timezone: 'Asia/Bangkok' });
  // ปิดสถานะสมาชิกที่หมดอายุ ก่อนถึงรอบส่งดวง — ให้ตัวเลขรายงานและเกณฑ์แคมเปญตรงความจริง
  cron.schedule('5 0 * * *', () => subscribers.sweepExpired()
    .catch(e => console.error('[sweep]', e.message)), { timezone: 'Asia/Bangkok' });
  console.log('[Scheduler] Daily horoscope — 08:00 Bangkok time (+ ปิดสมาชิกหมดอายุ 00:05)');
}

module.exports = { start, sendDailyHoroscopes, shouldTeaseToday };
