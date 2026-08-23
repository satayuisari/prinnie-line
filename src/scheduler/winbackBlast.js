// ยิงข้อความชวนสมาชิกเก่ากลับมา "ครั้งเดียว" ตอนเวลา WINBACK_AT
//
//   ไม่ตั้ง WINBACK_AT = ไม่ทำอะไรเลย (ปลอดภัยโดยดีฟอลต์)
//   ตั้งแล้ว → เช็กทุกนาที พอถึงเวลาก็ยิง แล้วจดธงไว้กันยิงซ้ำ
//
// กันส่งซ้ำระดับ DB: เคลมธง "รายคน" ใน broadcast_flags ก่อนส่งทุกครั้ง
//   → แอปรีสตาร์ทกลางคัน / cron ยิงซ้อน / deploy ใหม่ ก็ไม่มีใครได้ข้อความสองรอบ
//   (ต่างจากการเคลมทั้งชุด ซึ่งถ้าพังกลางทางแล้ว retry คนต้น ๆ จะโดนซ้ำ)
const cron = require('node-cron');
const db = require('../db');
const lineMessaging = require('../services/lineMessaging');
const winback = require('../services/winback');

const GAP_MS = 350;        // เว้นจังหวะระหว่างคน กัน rate limit ของ LINE

async function claim(key) {
  const r = await db.query(
    `INSERT INTO broadcast_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING RETURNING key`, [key]);
  return r.rows.length > 0;
}

async function fire() {
  const at = process.env.WINBACK_AT;
  if (!at) return;
  const when = new Date(at).getTime();
  if (!when || Date.now() < when) return;                 // ยังไม่ถึงเวลา

  if (!(await claim('winback-run-' + at))) return;        // รอบนี้เริ่มไปแล้ว
  const people = await winback.audience();
  console.log(`[winback] เริ่มยิง ${people.length} คน (WINBACK_AT=${at})`);

  let sent = 0, skipped = 0, failed = 0;
  for (const p of people) {
    // ธงรายคน — ถ้าเคยส่งไปแล้วในรอบเวลานี้ ข้าม
    if (!(await claim(`winback-${at}-${p.line_user_id}`))) { skipped++; continue; }
    try {
      await lineMessaging.pushText(p.line_user_id, winback.buildMessage(p.name, p.ended));
      sent++;
    } catch (e) {
      failed++;
      console.error(`[winback] ✗ ${p.line_user_id.slice(0, 10)}: ${e.message}`);
    }
    await new Promise(s => setTimeout(s, GAP_MS));
  }

  console.log(`[winback] เสร็จ — ส่ง ${sent} · ข้าม ${skipped} · ไม่สำเร็จ ${failed}`);
  await lineMessaging.notifyAdmins(
    `📣 ยิงข้อความชวนสมาชิกเก่ากลับมาแล้ว\nส่งสำเร็จ ${sent} คน` +
    (failed ? ` · ไม่สำเร็จ ${failed} คน` : '')
  ).catch(() => {});
}

function start() {
  cron.schedule('* * * * *', () => fire().catch(e => console.error('[winback]', e.message)),
    { timezone: 'Asia/Bangkok' });
  const at = process.env.WINBACK_AT;
  console.log(at
    ? `[winback] ตั้งเวลายิงข้อความชวนสมาชิกเก่า: ${at}`
    : '[winback] ยังไม่ตั้งเวลา (ตั้ง WINBACK_AT ถึงจะยิง)');
}

module.exports = { start, fire };
