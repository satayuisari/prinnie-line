'use strict';
/**
 * lineClient.js — ส่งข้อความกลับ LINE จริง (Messaging API) + ตรวจ signature
 * -----------------------------------------------------------------------------
 * ใช้ fetch ในตัว Node 18+ (ไม่ต้องลง dependency เพิ่ม)
 * - ถ้าไม่มี LINE_CHANNEL_ACCESS_TOKEN → ตกมา console.log (โหมด dev/stub) ไม่พัง
 * - push เป็น 1:1 เท่านั้น (ห้าม broadcast หา 10k)
 */
const crypto = require('crypto');

const TOKEN = () => process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SECRET = () => process.env.LINE_CHANNEL_SECRET;

/** ส่งข้อความหาผู้ใช้ 1 คน (pushMessage — ใช้ได้แม้เกิน 1 นาที ต่างจาก replyToken) */
async function pushText(lineUserId, text) {
  if (!TOKEN()) { console.log(`[line(stub)→${lineUserId}] ${text}`); return { stub: true }; }
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN()}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[line] push ล้มเหลว ${res.status}: ${detail}`);
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

/** ตรวจลายเซ็น x-line-signature กับ raw body (Buffer) — ป้องกัน request ปลอม */
function verifySignature(rawBodyBuffer, signature) {
  if (!SECRET()) return true; // dev ไม่ตั้ง secret → ข้าม (อย่าใช้ใน prod)
  const expected = crypto.createHmac('sha256', SECRET()).update(rawBodyBuffer).digest('base64');
  // timing-safe compare
  const a = Buffer.from(expected); const b = Buffer.from(signature || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { pushText, verifySignature };
