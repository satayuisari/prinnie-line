// ยิงบรอดแคสต์เปิดตัวอัตโนมัติ "ครั้งเดียว" ตอนเวลา LAUNCH_BROADCAST_AT (ทั้ง 2 บัญชี)
//   - เช็กทุกนาที ถ้าถึงเวลาแล้ว + ยังไม่ยิง (claim key ใน broadcast_flags) → ยิง
//   - claim ก่อนยิง กันยิงซ้ำ; ถ้ายิง error → ลบ flag ให้ retry รอบหน้า
//   - ไม่ตั้ง LAUNCH_BROADCAST_AT = ไม่ทำอะไร (ปลอดภัย)
const cron = require('node-cron');
const db = require('../db');
const lineMessaging = require('../services/lineMessaging');
const flex = require('../marketing/flexTemplates');

const BASE    = (process.env.PUBLIC_BASE_URL || 'https://prinnie-app-production.up.railway.app').replace(/\/$/, '');
const VIDEO   = `${BASE}/promo.mp4`;
const PREVIEW = `${BASE}/promo-preview.png`;
const LIFF    = process.env.LINE_LIFF_ID ? `https://liff.line.me/${process.env.LINE_LIFF_ID}` : null;
const ADD     = 'https://line.me/R/ti/p/%40prinnie333';

// เคลมแบบ atomic: insert แล้วได้ row = เราเคลมสำเร็จ (ยังไม่เคยยิง)
async function claim(key) {
  const r = await db.query(
    `INSERT INTO broadcast_flags (key) VALUES ($1) ON CONFLICT (key) DO NOTHING RETURNING key`, [key]);
  return r.rows.length > 0;
}
async function unclaim(key) {
  await db.query('DELETE FROM broadcast_flags WHERE key=$1', [key]).catch(() => {});
}

async function send(key, fn, label) {
  if (!(await claim(key))) return;               // เคยยิงแล้ว
  try { await fn(); console.log(`[launch] ✅ ${label} sent`); }
  catch (e) { console.error(`[launch] ❌ ${label}:`, e.message); await unclaim(key); }  // ให้ลองใหม่รอบหน้า
}

async function fire() {
  const at = process.env.LAUNCH_BROADCAST_AT;
  if (!at) return;
  if (Date.now() < new Date(at).getTime()) return;   // ยังไม่ถึงเวลา

  if (LIFF) await send('launch-oa1-' + at,
    () => lineMessaging.broadcast(flex.launchVideo(VIDEO, PREVIEW, LIFF)), 'OA1 (บริการ)');
  if (lineMessaging.oa2Enabled()) await send('launch-oa2-' + at,
    () => lineMessaging.broadcastOA2(flex.launchVideo(VIDEO, PREVIEW, ADD)), 'OA2 (23k)');
}

function start() {
  cron.schedule('* * * * *', () => fire().catch(e => console.error('[launch]', e.message)),
    { timezone: 'Asia/Bangkok' });
  console.log('[launch] one-time broadcast watcher — ยิงตอน LAUNCH_BROADCAST_AT (ถ้าตั้งไว้)');
}

module.exports = { start, fire };
