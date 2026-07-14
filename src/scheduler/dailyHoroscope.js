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
      const msgs = await dailyTeaser.buildCombinedDaily(m.chart_data, m.nickname, today);
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
  if (process.env.DAILY_TEASER_ENABLED === 'true') {
    const leads = await subscribers.getRegisteredInactive();
    console.log(`[Teaser] ${leads.length} คนลงทะเบียนแต่ยังไม่จ่าย → ส่ง teaser`);
    let sent = 0;
    for (const m of leads) {
      try {
        const free = await subscribers.claimFreeDaily(m.line_user_id);   // วันแรก = ฟรีเต็ม, หลังจากนั้น teaser
        const msgs = await dailyTeaser.buildCombinedDaily(m.chart_data, m.nickname, today,
          free ? { freeDay: true } : { locked: true });
        const res  = await lineMessaging.pushMessage(m.line_user_id, msgs);
        if (!res || !res.skipped) { await saveLog(m.id, 'success', null, free ? 'free-day' : 'teaser'); sent++; }
      } catch (err) {
        console.error(`  ✗ teaser ${m.line_user_id}: ${err.message}`);
        await saveLog(m.id, 'failed', err.message, 'teaser').catch(() => {});
      }
    }
    console.log(`[Teaser] Done — ส่งได้ ${sent}/${leads.length}`);
  }
}

function start() {
  cron.schedule('0 8 * * *', sendDailyHoroscopes, { timezone: 'Asia/Bangkok' });
  console.log('[Scheduler] Daily horoscope — 08:00 Bangkok time');
}

module.exports = { start, sendDailyHoroscopes };
