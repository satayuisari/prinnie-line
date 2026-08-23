// Renewal-reminder scheduler — กันรูรั่ว churn
// subscription เป็นจ่ายครั้งเดียว +30 วัน (ไม่ recurring) → พอ subscribe_end ผ่าน ดวงหยุดส่งเงียบ ๆ
// ตัวนี้ push เตือน "รายคน" ให้สมาชิกที่เคยจ่ายแล้ว ก่อนหมดอายุ ให้ต่ออายุทัน
//
// เตือนครั้งเดียวต่อรอบ (ตามที่เจ้าของสั่ง 22/07): เหลืออายุสมาชิก 1 วัน → ส่ง 1 ข้อความ จบ
// ไม่มี stage หมดอายุแล้ว/win-back อีก — ถ้าไม่ต่อ ก็แค่หยุดส่งดวงเงียบ ๆ ตามปกติ
//
// ความปลอดภัย:
//   - ปิดโดยดีฟอลต์: ต้องตั้ง RENEWAL_REMINDERS_ENABLED=true ถึงจะส่ง
//   - เคารพ TEST_MODE: pushMessage บล็อกถ้าไม่อยู่ใน allowlist (และจะไม่ขยับ stage ไว้ส่งตอน live)
//   - ยิงเฉพาะคน "เคยจ่าย" (payment_ref IS NOT NULL) — คนยังไม่เคยจ่ายเป็นงานของ nudges.js
//
// การรีเซ็ตต่อรอบ: เก็บ renewal_anchor = subscribe_end ที่ stage อ้างอิง
//   ต่ออายุ → activateSubscription ดัน subscribe_end ไปข้างหน้า → anchor ไม่ตรง → รีเซ็ต stage=0
//   รอบใหม่จึงเตือนได้อีกครั้งอัตโนมัติ โดยไม่ต้องแตะ flow การจ่ายเงิน

const cron    = require('node-cron');
const db      = require('../db');
const lineMsg = require('../services/lineMessaging');

const LIFF_URL = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}?view=pay`
  : 'https://liff.line.me/YOUR_LIFF_ID';

const DAY = 86400000;

function expireText(end) {
  try {
    return new Date(end).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' });
  } catch { return ''; }
}

// daysToExpiry → stage เดียว: เหลือ ≤1 วัน (รวมถึงเพิ่งหมดไปไม่เกิน 1 วัน กันพลาดรอบ cron)
// ส่งครั้งเดียวต่อรอบ — anchor-reset ด้านล่างจัดการให้เตือนซ้ำได้เองเมื่อต่ออายุรอบใหม่
function eligibleStage(daysToExpiry) {
  return daysToExpiry <= 1 ? 1 : 0;
}

function buildMessage() {
  return { type: 'text', text: 'ใกล้จะหมดเวลาแล้ว อย่าลืมสมัครต่อรายเดือนนะคะ 🌙\n\n👉 ' + LIFF_URL };
}

async function runRenewals(now = new Date()) {
  if (process.env.RENEWAL_REMINDERS_ENABLED !== 'true') {
    console.log('[Renewals] ข้าม — ตั้ง RENEWAL_REMINDERS_ENABLED=true เพื่อเปิดใช้งาน');
    return { sent: 0, candidates: 0, disabled: true };
  }

  // เป้า: เคยจ่ายแล้ว (payment_ref) + มีดวง + subscribe_end อยู่ในกรอบเตือน (ใกล้หมด..หลังหมดเล็กน้อย)
  const { rows } = await db.query(
    `SELECT id, line_user_id, nickname, subscribe_end,
            COALESCE(renewal_stage, 0) AS renewal_stage, renewal_anchor
       FROM line_subscribers
      WHERE payment_ref IS NOT NULL
        AND subscribe_end IS NOT NULL
        AND chart_data   IS NOT NULL
        AND subscribe_end BETWEEN NOW() - INTERVAL '10 days' AND NOW() + INTERVAL '4 days'
      ORDER BY id`
  );

  let sent = 0;
  for (const sub of rows) {
    // รีเซ็ต stage ถ้าต่ออายุแล้ว — ต่ออายุดัน subscribe_end ไป +30 วัน
    // ใช้ tolerance (ไม่เทียบ timestamp ตรง ๆ) กัน drift จากการ serialize TIMESTAMP
    // (node-postgres เขียน Date เป็น local-time แต่ subscribe_end เดิมเป็น UTC ISO → คลาดได้ถึง ~14 ชม.)
    // renewal = +30 วัน ใหญ่กว่า drift มาก → ใช้เกณฑ์ 1 วันแยกได้ปลอดภัย
    const drift = sub.renewal_anchor
      ? Math.abs(new Date(sub.subscribe_end) - new Date(sub.renewal_anchor))
      : Infinity;
    const anchorMatches = drift < DAY;
    let stage = anchorMatches ? sub.renewal_stage : 0;

    const daysToExpiry = (new Date(sub.subscribe_end) - now) / DAY;
    const want = eligibleStage(daysToExpiry);
    if (want <= stage) {
      // ไม่มี phase ใหม่ แต่ถ้าเพิ่งต่ออายุ (anchor หลุด) อัปเดต anchor + รีเซ็ตให้ตรง
      if (!anchorMatches) {
        await db.query(
          'UPDATE line_subscribers SET renewal_stage = $1, renewal_anchor = $2 WHERE id = $3',
          [stage, sub.subscribe_end, sub.id]
        );
      }
      continue;
    }

    try {
      const message = buildMessage();
      const res = await lineMsg.pushMessage(sub.line_user_id, [message]);
      if (res && res.skipped) continue; // TEST_MODE บล็อก → ไม่ขยับ stage ไว้ส่งตอน live

      await db.query(
        `UPDATE line_subscribers
            SET renewal_stage = $1, renewal_anchor = $2, updated_at = NOW()
          WHERE id = $3`,
        [want, sub.subscribe_end, sub.id]
      );
      sent++;
      console.log(`[Renewals] stage ${want} → ${sub.line_user_id} (${sub.nickname}) · d=${daysToExpiry.toFixed(1)}`);
    } catch (err) {
      console.error(`[Renewals] ✗ ${sub.line_user_id}: ${err.message}`);
    }
  }

  console.log(`[Renewals] เสร็จ — ส่ง ${sent} / candidate ${rows.length}`);
  return { sent, candidates: rows.length };
}

function start() {
  // 09:00 Bangkok — หลังส่งดวงรายวัน 08:00 (ดวงเช้าสุดท้ายก่อนหมด แล้วตามด้วยเตือนต่ออายุ)
  cron.schedule('0 9 * * *', () => runRenewals(), { timezone: 'Asia/Bangkok' });
  const state = process.env.RENEWAL_REMINDERS_ENABLED === 'true'
    ? '(ENABLED)' : '(ปิดอยู่ — ตั้ง RENEWAL_REMINDERS_ENABLED=true)';
  console.log(`[Renewals] renewal-reminder scheduler — 09:00 Bangkok ${state}`);
}

module.exports = { start, runRenewals, eligibleStage };
