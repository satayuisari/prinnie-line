const line = require('@line/bot-sdk');

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// blob client = ดึง "เนื้อหา" ของข้อความ (รูป/ไฟล์) เช่น รูปสลิปโอนเงินที่ลูกค้าส่งมา
const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// ดึงรูปจาก messageId → Buffer (ใช้แสดงสลิปบน dashboard). คืน null ถ้าดึงไม่ได้/หมดอายุ
async function getMessageContent(messageId) {
  try {
    const stream = await blobClient.getMessageContent(messageId);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch (e) {
    console.error('[line] getMessageContent:', e.message);
    return null;
  }
}

// ════════ SAFETY NET ════════
// TEST_MODE=true → ส่งข้อความได้เฉพาะ userId ใน TEST_USER_IDS เท่านั้น
// กันพลาดส่งหา 10,000 followers ตอนทดสอบบน OA จริง
const TEST_MODE = process.env.TEST_MODE === 'true';
const ALLOWLIST = (process.env.TEST_USER_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function isAllowed(userId) {
  if (!TEST_MODE) return true;             // production: ส่งได้ปกติ
  return ALLOWLIST.includes(userId);       // test: เฉพาะ allowlist
}

async function pushMessage(lineUserId, messages) {
  if (!isAllowed(lineUserId)) {
    console.log(`[TEST_MODE] 🚫 blocked push → ${lineUserId} (ไม่อยู่ใน allowlist)`);
    return { skipped: true };
  }
  return client.pushMessage({
    to: lineUserId,
    messages: Array.isArray(messages) ? messages : [messages],
  });
}

async function pushText(lineUserId, text) {
  return pushMessage(lineUserId, { type: 'text', text });
}

// reply ใช้ replyToken (ตอบ event) — ปลอดภัยเสมอ เพราะตอบเฉพาะคนที่ทักมา
async function replyMessage(replyToken, messages) {
  return client.replyMessage({
    replyToken,
    messages: Array.isArray(messages) ? messages : [messages],
  });
}

// ⚠️ broadcast = ส่งหาทุกคน — gate ไว้ ห้ามเรียกตอน TEST_MODE
async function broadcast(messages) {
  if (TEST_MODE) {
    throw new Error('[TEST_MODE] ❌ broadcast ถูกบล็อก — จะส่งหาทุกคน!');
  }
  return client.broadcast({
    messages: Array.isArray(messages) ? messages : [messages],
  });
}

module.exports = { client, blobClient, getMessageContent, pushMessage, pushText, replyMessage, broadcast, isAllowed, TEST_MODE };
