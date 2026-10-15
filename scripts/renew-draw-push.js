// ชวนสมาชิกที่กำลังจะหมดอายุ "ก่อนวันจับรางวัล" ให้ต่ออายุ — ข้อความรายคน
//
// 15 ต.ค. 69: สมาชิกรุ่นเปิดจับรางวัล (16–17 ก.ย.) หมดอายุพร้อมกัน 37 คนในวันที่ 16–17 ต.ค.
// ทุกคนเป็นสมาชิกครบ 14 วันแล้ว แต่จะหลุดจากรายชื่อลุ้นรอบ 17 ต.ค. เพราะหมดอายุก่อน 20:00
// ต่ออายุก่อนจับ → subscribe_start เดิมคงอยู่ (subscriberService COALESCE) → ชื่อกลับเข้ารายชื่อ
// bon อนุมัติข้อความ 15 ต.ค. 08:00 ("ส่ง")
//
// ใช้:  node scripts/renew-draw-push.js            ดูรายชื่อ + ข้อความตัวอย่าง (ไม่ส่ง)
//       node scripts/renew-draw-push.js --send     ส่งจริง (claim ใน broadcast_flags กันส่งซ้ำรายคน)
//
// กลุ่มเป้าหมายคิดจากฐานข้อมูลตอนรัน: ใครต่ออายุไปแล้ว subscribe_end เลยวันจับ → หลุดจากรายชื่อเอง
const db = require('../src/db');
const lineMsg = require('../src/services/lineMessaging');
const pick = require('../src/services/monthlyPick');
const { roundAfter, thDate } = require('../src/services/pickAnnounce');
const { assertClean } = require('../src/services/copyGuard');
const promptpay = require('../src/services/promptpayService');

const liffUrl = () => `https://liff.line.me/${process.env.LINE_LIFF_ID || 'YOUR_LIFF_ID'}`;

// สมาชิกที่ยังใช้งานได้ตอนนี้ แต่จะหมดอายุก่อนเวลาจับรางวัลรอบถัดไป และเข้าเกณฑ์ลุ้นทุกข้ออื่น
async function audience(now = new Date()) {
  // nextRound() คือรอบที่ยังเปิดรับสมัคร (เลยไปอีกรอบ) — ที่ต้องการคือ "วันจับถัดไป" 20:00 ไทย
  const drawAt = new Date(roundAfter(now).getTime() + 20 * 3600e3);
  const round = { at: drawAt };
  const cutoff = pick.cutoffFor(drawAt);
  const r = await db.query(`
    SELECT line_user_id, nickname, display_name, subscribe_end
    FROM line_subscribers
    WHERE status='ACTIVE'
      AND subscribe_end > $1::timestamptz AND subscribe_end <= $2::timestamptz
      AND chart_data IS NOT NULL
      AND payment_ref IS NOT NULL
      AND payment_ref NOT IN ('tester','free-trial','free','founder','LIFETIME_COMP')
      AND subscribe_start IS NOT NULL AND subscribe_start <= $3::timestamptz
    ORDER BY subscribe_end`, [now, drawAt, cutoff]);
  return { round, rows: r.rows.map(x => ({ id: x.line_user_id, name: x.nickname || x.display_name || null, ended: x.subscribe_end })) };
}

function buildMessage(name, ended, round) {
  const who = name ? `คุณ ${String(name).trim()}` : '';
  const drawDay = thDate(round.at);
  const text = [
    `สวัสดีค่ะ ${who}`.trim(),
    `สมาชิกของคุณจะหมดอายุวันที่ ${thDate(ended)}ค่ะ`,
    '',
    `วันที่ ${drawDay} 2 ทุ่ม อาจารย์จับรางวัลดูดวงตัวต่อตัวฟรี 1 ชั่วโมง 1 ท่าน`,
    `คุณเป็นสมาชิกครบ 14 วันแล้ว แต่ถ้าหมดอายุก่อน 2 ทุ่มวันที่ ${drawDay} ชื่อจะหลุดจากรายชื่อลุ้นรอบนี้ค่ะ`,
    '',
    `ต่ออายุก่อน ${drawDay} 20:00 น. ชื่อยังอยู่ในรายชื่อลุ้นเหมือนเดิม และได้ดวงรายวันต่อทุกเช้าค่ะ`,
    `👉 ${liffUrl()}`,
  ];
  const bk = promptpay.bankAccount();
  if (bk) text.push('', `สแกน QR ไม่ได้ โอนเข้าบัญชี${bk.bank ? bk.bank : ''} ${bk.no}${bk.name ? ' ชื่อบัญชี ' + bk.name : ''} ${promptpay.PRICE_THB} บาท แล้วส่งสลิปมาในแชทนี้ได้เลยค่ะ`);
  return assertClean(text.join('\n'));
}

async function main() {
  const send = process.argv.includes('--send');
  const now = new Date();
  const { round, rows } = await audience(now);
  console.log(`รอบจับ ${thDate(round.at)} 20:00 · กลุ่มเป้าหมาย ${rows.length} คน (หมดอายุก่อนจับ)`);
  for (const r of rows) console.log(`  ${r.id.slice(0, 9)}… ${(r.name || '-').slice(0, 16).padEnd(18)} หมด ${thDate(r.ended)}`);
  if (rows.length) { console.log('\n--- ตัวอย่าง ---\n' + buildMessage(rows[0].name, rows[0].ended, round) + '\n---'); }
  if (!send) { console.log('\n(ไม่ได้ส่ง — ใส่ --send เพื่อส่งจริง)'); return; }

  let ok = 0, skip = 0, fail = 0;
  for (const r of rows) {
    const key = `renew-draw-${pick.cycleOf(round.at)}-${r.id}`;
    const c = await db.query('INSERT INTO broadcast_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING RETURNING key', [key]);
    if (!c.rows.length) { skip++; continue; }
    try {
      const res = await lineMsg.pushText(r.id, buildMessage(r.name, r.ended, round));
      if (res && res.skipped) { await db.query('DELETE FROM broadcast_flags WHERE key=$1', [key]); skip++; continue; }
      ok++;
    } catch (e) {
      fail++; console.error(`  ❌ ${r.id.slice(0, 9)}… ${e.message}`);
      await db.query('DELETE FROM broadcast_flags WHERE key=$1', [key]).catch(() => {});
    }
  }
  console.log(`ส่งแล้ว ${ok} · ข้าม ${skip} · ผิดพลาด ${fail}`);
}

module.exports = { audience, buildMessage };
if (require.main === module) main().then(() => db.end()).catch(e => { console.error(e); db.end(); process.exit(1); });
