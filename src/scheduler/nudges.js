// Nudge scheduler — เครื่องจักรแปลงของแคมเปญ "ปลุกฐาน 10k"
// ยิง follow-up เป็น push "รายคน" (ไม่ใช่ broadcast) เฉพาะคนที่กรอกดวงแล้วแต่ยังไม่จ่าย
// ลำดับ: +1 วัน ตัวอย่างดวงรายวันจริง → +3 วัน teaser ดวงคู่ → +6 วัน เตือน early-bird
//
// ความปลอดภัย:
//   - ปิดโดยดีฟอลต์: ต้องตั้ง NUDGES_ENABLED=true ถึงจะส่ง (กันยิงตอนยังไม่ launch)
//   - เคารพ TEST_MODE: pushMessage จะถูกบล็อกถ้าไม่อยู่ใน allowlist (และจะไม่ขยับ stage)

const cron      = require('node-cron');
const db        = require('../db');
const horoscope = require('../services/horoscopeService');
const lineMsg   = require('../services/lineMessaging');
const flex      = require('../marketing/flexTemplates');

const LIFF_URL = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}`
  : 'https://liff.line.me/YOUR_LIFF_ID';
const COUPLE_URL    = `${LIFF_URL}?view=couple`;
const EARLYBIRD_END = process.env.EARLYBIRD_END || '2026-06-30';

function deadlineText(iso) {
  try {
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' });
  } catch { return iso; }
}

// ตัวอย่างดวงรายวัน "จริง" จากดวงเกิดของเขา (ใช้ฟอร์แมตหัวข้อพลังดาว + ตัวคั่นชุดเดียวกับ scheduler)
function sampleDailyText(reading, nickname) {
  const lines = [`✨ ชิมดวงรายวันส่วนตัวของ ${nickname || 'คุณ'} (ตัวอย่าง 1 วัน)`, ''];
  if (reading.has_content) {
    lines.push(...horoscope.aspectBlocks(reading.aspects), '');
  } else {
    lines.push('🌙 วันนี้ดวงดาวของคุณนิ่งสงบ ไม่มีมุมเด่นพิเศษ', '');
  }
  if (reading.tarot) lines.push(`🃏 ไพ่ประจำวัน: ${reading.tarot.name}`, reading.tarot.text);
  return lines.join('\n').trim().slice(0, 4900);
}

// แต่ละ stage: ส่งหลังกรอกครบ minDays วัน, คืน array ของ message objects
const STAGES = [
  {
    stage: 1, minDays: 1,
    build: async (sub) => {
      const reading = await horoscope.dailyReading(sub.chart_data, new Date());
      return [
        { type: 'text', text: sampleDailyText(reading, sub.nickname) },
        flex.upsellSubscribe(LIFF_URL),
      ];
    },
  },
  { stage: 2, minDays: 3, build: async () => [flex.coupleTeaser(COUPLE_URL)] },
  { stage: 3, minDays: 6, build: async () => [flex.earlyBirdEnding(LIFF_URL, deadlineText(EARLYBIRD_END))] },
];

async function runNudges(now = new Date()) {
  if (process.env.NUDGES_ENABLED !== 'true') {
    console.log('[Nudges] ข้าม — ตั้ง NUDGES_ENABLED=true เพื่อเปิดใช้งาน');
    return { sent: 0, candidates: 0, disabled: true };
  }

  // เป้า: กรอกดวงแล้ว (มี chart) + ยังไม่ active (ยังไม่จ่าย/หมดอายุ) + ยังไม่ครบทุก stage
  const { rows } = await db.query(
    `SELECT id, line_user_id, nickname, chart_data, COALESCE(nudge_stage,0) AS nudge_stage, created_at
       FROM line_subscribers
      WHERE chart_data IS NOT NULL
        AND (subscribe_end IS NULL OR subscribe_end <= NOW())
        AND COALESCE(nudge_stage,0) < $1
      ORDER BY id`,
    [STAGES.length]
  );

  let sent = 0;
  for (const sub of rows) {
    const next = sub.nudge_stage + 1;
    const st   = STAGES.find(s => s.stage === next);
    if (!st) continue;

    const days = (now - new Date(sub.created_at)) / 86400000;
    if (days < st.minDays) continue;

    try {
      const messages = await st.build(sub);
      const res = await lineMsg.pushMessage(sub.line_user_id, messages);
      if (res && res.skipped) continue; // TEST_MODE บล็อก → ไม่ขยับ stage ไว้ส่งตอน live

      await db.query(
        'UPDATE line_subscribers SET nudge_stage = $1, updated_at = NOW() WHERE id = $2',
        [next, sub.id]
      );
      sent++;
      console.log(`[Nudges] stage ${next} → ${sub.line_user_id} (${sub.nickname})`);
    } catch (err) {
      console.error(`[Nudges] ✗ ${sub.line_user_id}: ${err.message}`);
    }
  }

  console.log(`[Nudges] เสร็จ — ส่ง ${sent} / candidate ${rows.length}`);
  return { sent, candidates: rows.length };
}

function start() {
  cron.schedule('0 19 * * *', () => runNudges(), { timezone: 'Asia/Bangkok' });
  const state = process.env.NUDGES_ENABLED === 'true' ? '(ENABLED)' : '(ปิดอยู่ — ตั้ง NUDGES_ENABLED=true)';
  console.log(`[Nudges] follow-up scheduler — 19:00 Bangkok ${state}`);
}

module.exports = { start, runNudges, STAGES };
