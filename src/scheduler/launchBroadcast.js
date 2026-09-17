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

// เปิดตัว "ดวงเลือกคุณ" — ยิงครั้งเดียวตอน LOYALTY_LAUNCH_AT (เช่น 2026-09-16T21:00:00+07:00)
// ข้อความเดียวกับ scripts/broadcast-loyalty.js (src/services/loyaltyLaunchText.js)
// เส้นตาย/รอบคิดสด ณ เวลายิง · กันยิงซ้ำด้วย broadcast_flags เหมือนตัวบน
// bon สั่ง 15 ก.ย. 69 "setup ให้พร้อม" — ตั้ง env แล้วไม่ต้องมานั่งกดตอนสามทุ่ม
async function fireLoyalty() {
  const at = process.env.LOYALTY_LAUNCH_AT;
  if (!at) return;
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) { console.error('[launch] LOYALTY_LAUNCH_AT อ่านไม่ออก:', at); return; }
  if (Date.now() < t) return;
  // เกินเวลามาเกิน 1 วัน = ค่าเก่าค้าง ไม่ยิงย้อนหลัง (กันเปิดเซิร์ฟเวอร์ใหม่แล้วยิงซ้ำในเดือนถัดไป)
  if (Date.now() - t > 24 * 3600e3) return;
  const txt = require('../services/loyaltyLaunchText');
  await send('loyalty-launch-oa1-' + at,
    () => lineMessaging.broadcast(txt.messages(txt.textOA1())), 'ดวงเลือกคุณ OA1 (บริการ)');
  if (lineMessaging.oa2Enabled()) await send('loyalty-launch-oa2-' + at,
    () => lineMessaging.broadcastOA2(txt.messages(txt.textOA2())), 'ดวงเลือกคุณ OA2 (ใหญ่)');
}

// ประกาศผลจับรางวัลตามเวลา — ยิงครั้งเดียวตอน PICK_ANNOUNCE_AT
// bon 17 ก.ย. 69: รอบแรกผลออกตอนเช้าก่อนประกาศจริง "ต้องรอประกาศรางวัลคืนนี้"
// ประกาศผู้ได้รับล่าสุดในตาราง (ชื่อเล่นจากโปรไฟล์) · กันยิงซ้ำด้วย broadcast_flags
async function firePickAnnounce() {
  const at = process.env.PICK_ANNOUNCE_AT;
  if (!at) return;
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) { console.error('[launch] PICK_ANNOUNCE_AT อ่านไม่ออก:', at); return; }
  if (Date.now() < t || Date.now() - t > 24 * 3600e3) return;
  const row = (await db.query(
    `SELECT r.id, r.note, r.granted_at, COALESCE(s.nickname, s.display_name) AS name
       FROM loyalty_rewards r LEFT JOIN line_subscribers s ON s.line_user_id = r.line_user_id
      WHERE r.cycle IS NOT NULL ORDER BY r.granted_at DESC LIMIT 1`)).rows[0];
  if (!row) return;
  const total = Number((String(row.note || '').match(/(\d+)\s*คน/) || [])[1]) || 0;
  const announce = require('../services/pickAnnounce');
  const when = new Date(row.granted_at);
  await send('pick-announce-oa1-' + at, () => lineMessaging.broadcast([{ type: 'text',
    text: announce.announceText({ at: when, name: row.name, total }) }]), 'ประกาศผลจับรางวัล OA1');
  if (lineMessaging.oa2Enabled()) await send('pick-announce-oa2-' + at, () => lineMessaging.broadcastOA2([{ type: 'text',
    text: announce.announceText({ at: when, name: row.name, total, forOA2: true }) }]), 'ประกาศผลจับรางวัล OA2');
  await db.query('UPDATE loyalty_rewards SET announced_at=NOW() WHERE id=$1', [row.id]).catch(() => {});
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
  cron.schedule('* * * * *', () => {
    fire().catch(e => console.error('[launch]', e.message));
    fireLoyalty().catch(e => console.error('[launch:loyalty]', e.message));
    firePickAnnounce().catch(e => console.error('[launch:pick]', e.message));
  }, { timezone: 'Asia/Bangkok' });
  console.log('[launch] one-time broadcast watcher — ยิงตอน LAUNCH_BROADCAST_AT (ถ้าตั้งไว้)'
    + (process.env.LOYALTY_LAUNCH_AT ? ` · เปิดตัว ${process.env.LOYALTY_LAUNCH_AT}` : '')
    + (process.env.PICK_ANNOUNCE_AT ? ` · ประกาศผลจับรางวัล ${process.env.PICK_ANNOUNCE_AT}` : ''));
}

module.exports = { start, fire, fireLoyalty, firePickAnnounce };
