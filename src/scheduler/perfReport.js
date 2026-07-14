// รายงาน performance เข้าไลน์แอดมิน (Bon/prinprin) ทุก 12 ชม. — แอปมี DB+LINE รัน 24 ชม.อยู่แล้ว
const cron = require('node-cron');
const db = require('../db');
const lineMessaging = require('../services/lineMessaging');

const ADMINS = (process.env.ADMIN_USER_IDS ||
  'Ub358215999e4bede8773435eb812695a,Ue72dc1cca95a648065ff0dc3390253a6')
  .split(',').map(s => s.trim()).filter(Boolean);

async function snapshot() {
  const s = (await db.query(`SELECT COUNT(*)::int total,
    COUNT(*) FILTER(WHERE chart_data IS NOT NULL)::int reg,
    COUNT(*) FILTER(WHERE status='ACTIVE')::int active,
    COUNT(*) FILTER(WHERE free_daily_at IS NOT NULL)::int used_free,
    COUNT(*) FILTER(WHERE created_at >= NOW()-INTERVAL '12 hours')::int new12
    FROM line_subscribers`)).rows[0];
  const p = (await db.query(`SELECT COALESCE(SUM(amount),0)::bigint b, COUNT(*)::int n,
    COUNT(*) FILTER(WHERE charge_id LIKE 'slipok%')::int auto,
    COUNT(*) FILTER(WHERE paid_at >= NOW()-INTERVAL '12 hours')::int paid12
    FROM payment_orders WHERE status='PAID'`)).rows[0];
  const pend = (await db.query(`SELECT COUNT(*)::int n,
    COUNT(*) FILTER(WHERE slip_message_id IS NOT NULL)::int wslip
    FROM payment_orders WHERE status='PENDING'`)).rows[0];
  return [
    '📊 Prinnie333 รายงานผล (รอบ 12 ชม.)',
    `👥 ผู้ติดตาม ${s.total} · ลงทะเบียน ${s.reg} · สมาชิก ${s.active}`,
    `💰 รายได้ ${(p.b / 100).toLocaleString()}฿ (${p.n} ราย · SlipOK auto ${p.auto})`,
    `⏳ ค้าง ${pend.n}${pend.wslip ? ` · สลิปรอเช็ก ${pend.wslip} ⚠️` : ''}`,
    `📈 12 ชม.ล่าสุด: แอด +${s.new12} · จ่ายใหม่ +${p.paid12} ราย`,
  ].join('\n');
}

async function send() {
  const text = await snapshot();
  for (const uid of ADMINS) {
    await lineMessaging.pushMessage(uid, { type: 'text', text }).catch(e => console.error('[perf]', uid, e.message));
  }
  console.log(`[perf] report sent to ${ADMINS.length} admins`);
}

function start() {
  cron.schedule('0 8,20 * * *', () => send().catch(e => console.error('[perf]', e.message)),
    { timezone: 'Asia/Bangkok' });
  console.log('[perf] report scheduler — 08:00 + 20:00 Bangkok (ทุก 12 ชม.)');
}

module.exports = { start, send, snapshot };
