// LOYALTY PRE-LAUNCH DRY RUN — อ่านอย่างเดียว 100%
//
// ไม่มี INSERT / UPDATE / DELETE · ไม่ push LINE · ไม่เปลี่ยนสถานะอะไรทั้งสิ้น
// ใช้ประเมินว่า "ถ้าเปิด LOYALTY_ENABLED=true ตอนนี้ จะปล่อยสิทธิ์กี่ใบพร้อมกัน"
//
// ใช้: DATABASE_URL="…" node scripts/loyalty-dryrun.js
const db = require('../src/db');
const loyalty = require('../src/services/loyaltyReward');

const M = loyalty.MILESTONE;
const MIN_PER_CASE = Number(process.env.LOYALTY_MIN_PER_CASE) || 10;

// กันพลาด: สคริปต์นี้ต้องไม่มีคำสั่งเขียนหลุดเข้ามา
const q = async (sql, params) => {
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i.test(sql)) {
    throw new Error('dry-run ห้ามมีคำสั่งเขียน DB');
  }
  return db.query(sql, params);
};

async function main() {
  const hasTable = (await q("SELECT to_regclass('public.loyalty_rewards') t")).rows[0].t;

  // ── ผู้เข้าเกณฑ์ตอนนี้ ───────────────────────────────────────────────
  // นับเฉพาะ subscription ที่ PAID (refund/ยกเลิกไม่นับ) + ต้องมีข้อมูลสมาชิกครบ
  const eligible = (await q(`
    SELECT p.line_user_id, p.paid_count, s.nickname, s.display_name,
           to_char(p.nth_paid_at,'YYYY-MM-DD') eligible_since
    FROM (
      SELECT line_user_id, COUNT(*)::int paid_count,
             MIN(paid_at) FILTER (WHERE rn = $1) nth_paid_at
      FROM (SELECT line_user_id, paid_at,
                   ROW_NUMBER() OVER (PARTITION BY line_user_id ORDER BY paid_at) rn
            FROM payment_orders WHERE type='subscription' AND status='PAID') x
      GROUP BY line_user_id) p
    JOIN line_subscribers s ON s.line_user_id = p.line_user_id
    WHERE p.paid_count >= $1 AND s.chart_data IS NOT NULL
    ${hasTable ? 'AND NOT EXISTS (SELECT 1 FROM loyalty_rewards r WHERE r.line_user_id=p.line_user_id AND r.milestone=$1)' : ''}
    ORDER BY p.nth_paid_at`, [M])).rows;

  // ── กลุ่มที่ถูกตัดออก แยกเหตุผล ──────────────────────────────────────
  // 1) จ่ายไม่ครบเพราะมีรอบที่ถูกยกเลิก/คืนเงิน (นับเฉพาะ CANCELLED เท่านั้น)
  //    ⚠️ ห้ามนับ PENDING เป็น refund — PENDING คือสร้างออเดอร์แล้วไม่ได้จ่าย (ทิ้งกลางทาง)
  //    production มี PENDING ค้างอยู่ 114 ใบ ถ้านับรวมตัวเลขจะเพี้ยนทันที
  const refunded = (await q(`
    SELECT COUNT(*)::int n FROM (
      SELECT line_user_id,
             COUNT(*) FILTER (WHERE status='PAID')::int paid,
             COUNT(*) FILTER (WHERE status='CANCELLED')::int cancelled
      FROM payment_orders WHERE type='subscription' GROUP BY 1) x
    WHERE x.paid < $1 AND x.paid + x.cancelled >= $1`, [M])).rows[0].n;

  // แยกให้เห็นต่างหาก: จ่ายไม่ครบเพราะออเดอร์ค้างจ่าย (ไม่ใช่การคืนเงิน)
  const abandoned = (await q(`
    SELECT COUNT(*)::int n FROM (
      SELECT line_user_id,
             COUNT(*) FILTER (WHERE status='PAID')::int paid,
             COUNT(*) FILTER (WHERE status='PENDING')::int pending
      FROM payment_orders WHERE type='subscription' GROUP BY 1) x
    WHERE x.paid < $1 AND x.paid + x.pending >= $1`, [M])).rows[0].n;

  // 2) เคยได้สิทธิ์ขั้นนี้ไปแล้ว
  const granted = hasTable
    ? (await q('SELECT COUNT(*)::int n FROM loyalty_rewards WHERE milestone=$1', [M])).rows[0].n
    : 0;

  // 3) จ่ายครบแต่ข้อมูลสมาชิกไม่สมบูรณ์ (ไม่มี record / ยังไม่ได้ผูกดวง)
  const invalid = (await q(`
    SELECT COUNT(*)::int n FROM (
      SELECT line_user_id, COUNT(*)::int c FROM payment_orders
      WHERE type='subscription' AND status='PAID' GROUP BY 1) p
    LEFT JOIN line_subscribers s ON s.line_user_id = p.line_user_id
    WHERE p.c >= $1 AND (s.line_user_id IS NULL OR s.chart_data IS NULL)`, [M])).rows[0].n;

  // ── คาดการณ์ 30 วันข้างหน้า ─────────────────────────────────────────
  // คนที่จ่ายมาแล้ว M-1 รอบ และสมาชิกจะหมดอายุใน 30 วัน (ต้องต่ออายุ = ครบเกณฑ์พอดี)
  const projected = (await q(`
    SELECT COUNT(*)::int n FROM (
      SELECT line_user_id, COUNT(*)::int c FROM payment_orders
      WHERE type='subscription' AND status='PAID' GROUP BY 1) p
    JOIN line_subscribers s ON s.line_user_id = p.line_user_id
    WHERE p.c = $1 - 1 AND s.subscribe_end IS NOT NULL
      AND s.subscribe_end <= NOW() + INTERVAL '30 days'`, [M])).rows[0].n;
  // กลุ่มรวมที่อยู่ห่างจากเกณฑ์ 1 รอบ (ไม่จำกัดว่าจะหมดอายุเมื่อไหร่)
  const poolOneAway = (await q(`
    SELECT COUNT(*)::int n FROM (
      SELECT line_user_id, COUNT(*)::int c FROM payment_orders
      WHERE type='subscription' AND status='PAID' GROUP BY 1) p
    WHERE p.c = $1 - 1`, [M])).rows[0].n;

  // ── คิวสิทธิ์ปัจจุบัน ────────────────────────────────────────────────
  const queue = hasTable
    ? (await q(`SELECT
        COUNT(*) FILTER (WHERE status='GRANTED')::int granted,
        COUNT(*) FILTER (WHERE status='NOTIFIED')::int notified,
        COUNT(*) FILTER (WHERE status='ASKED')::int asked,
        COUNT(*) FILTER (WHERE status='USED')::int used
      FROM loyalty_rewards`)).rows[0]
    : { granted: 0, notified: 0, asked: 0, used: 0 };

  const oldest = eligible.length ? eligible[0].eligible_since : null;
  const hours = (eligible.length * MIN_PER_CASE / 60);

  // ── รายงาน ──────────────────────────────────────────────────────────
  const L = [];
  L.push('LOYALTY PRE-LAUNCH DRY RUN');
  L.push(`(เกณฑ์: ชำระครบ ${M} รอบ · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`);
  L.push('');
  L.push(`Eligible now:`);
  L.push(`  ${eligible.length} users`);
  L.push('');
  L.push('Excluded:');
  L.push(`  - refunded milestone payment: ${refunded}   (ยกเลิก/คืนเงินจริงเท่านั้น)`);
  L.push(`  - already granted milestone: ${granted}`);
  L.push(`  - invalid/incomplete membership: ${invalid}`);
  L.push(`  - (แยกต่างหาก) ออเดอร์ค้างจ่ายไม่ใช่ refund: ${abandoned}`);
  L.push('');
  L.push('Projected eligible next 30 days:');
  L.push(`  ${projected} users   (จากกลุ่มที่ห่างเกณฑ์ 1 รอบทั้งหมด ${poolOneAway} คน)`);
  L.push('');
  L.push('Current reward queue:');
  L.push(`  GRANTED: ${queue.granted}${queue.notified ? ` (+NOTIFIED ${queue.notified})` : ''}`);
  L.push(`  ASKED:   ${queue.asked}`);
  L.push(`  USED:    ${queue.used}`);
  if (!hasTable) L.push('  ⚠️ ตาราง loyalty_rewards ยังไม่มีบน production (022/023 ยังไม่ deploy)');
  L.push('');
  L.push('Oldest eligibility date:');
  L.push(`  ${oldest || '—'}`);
  L.push('');
  L.push('Estimated workload:');
  L.push(`  ${eligible.length} cases × avg ${MIN_PER_CASE} min`);
  L.push(`  = ${hours.toFixed(1)} hours`);
  L.push('');
  L.push('No DB writes · No LINE push · No status changes');
  console.log(L.join('\n'));

  if (eligible.length) {
    console.log('\nรายชื่อผู้เข้าเกณฑ์ (เรียงตามวันที่ครบเกณฑ์):');
    for (const e of eligible) {
      console.log(`  ${e.eligible_since}  ${(e.nickname || e.display_name || '(ไม่มีชื่อ)').slice(0, 22).padEnd(22)} จ่าย ${e.paid_count} รอบ`);
    }
  }
  await db.end();
}

main().catch(e => {
  console.error('ERR', e.message.replace(/postgres(ql)?:\/\/\S+/g, '[REDACTED]'));
  process.exit(1);
});
