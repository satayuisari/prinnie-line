// Broadcast ครั้งเดียว: คำเตือนดาวพุธถอยหลังของ อ.ปรินนี่ เจาะรายลัคนา → lead ที่ยังไม่จ่าย
// เป้าหมาย: ปลุกคนที่มีดวงแล้ว (chart_data) แต่ไม่ได้เป็นสมาชิก ให้กลับมากดดูดวง → เจอ teaser
// กันยิงซ้ำด้วย broadcast_flags key เดียว — รัน: railway run node scripts/broadcast-mercury-retro.js
const db = require('../src/db');
const { pushMessage } = require('../src/services/lineMessaging');
const horoscope = require('../src/services/horoscopeService');

const FLAG = 'mercury-retro-leads-2026-07';

(async () => {
  const claimed = await db.query(
    'INSERT INTO broadcast_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING RETURNING key', [FLAG]);
  if (!claimed.rows.length) { console.log('เคยยิงไปแล้ว (flag ' + FLAG + ') — ยกเลิก'); process.exit(0); }

  const leads = (await db.query(
    `SELECT line_user_id, nickname, chart_data->>'rising' AS rising FROM line_subscribers
     WHERE chart_data IS NOT NULL AND (subscribe_end IS NULL OR subscribe_end < NOW())
       AND line_user_id LIKE 'U%'`)).rows;
  console.log(`เป้าหมาย ${leads.length} คน`);
  let sent = 0, fail = 0;
  for (const l of leads) {
    const notes = await horoscope.seasonalNotes(l.rising, new Date());
    const noteLine = notes.length ? `\n📌 ลัคนาของคุณ: ${notes[0]}\n` : '\n';
    const text = `สวัสดีค่ะ ${l.nickname || 'คุณ'} 🌙\n` +
      `อ.ปรินนี่ฝากคำเตือนช่วงดาวพุธเดินถอยหลัง (ถึง 23 ก.ค.) ถึงคุณโดยเฉพาะค่ะ\n` +
      noteLine +
      `\nดวงรายวันฉบับเต็มของคุณถูกคำนวณไว้แล้วทุกเช้า กดเมนู "ดูดวงรายวัน" ดูได้เลยค่ะ ✨`;
    const r = await pushMessage(l.line_user_id, [{ type: 'text', text }]).catch(() => null);
    if (r && !r.skipped) sent++; else fail++;
    if ((sent + fail) % 100 === 0) console.log(`  … ${sent + fail}/${leads.length}`);
  }
  console.log(`✓ ส่งแล้ว ${sent} / ล้มเหลว-ข้าม ${fail} (บล็อก/allowlist)`);
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
