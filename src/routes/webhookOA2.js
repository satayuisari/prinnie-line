// ทางรับข้อความของ @efb2738a (บัญชีใหญ่)
//
// ทำไมต้องมี: บัญชีนี้ไม่มี webhook เลย คนที่ทักมาหรือ "ส่งสลิปมาที่นี่"
// จึงไม่เข้าระบบอะไรทั้งสิ้น ไม่ถูกตรวจ ไม่สร้างออเดอร์ ไม่มีใครได้รับแจ้ง
// = ลูกค้าโอนเงินแล้วเงียบหาย (เจอจริงหลังบรอดแคสต์ 2 ก.ย. 69)
//
// บัญชีนี้ทำหน้าที่ประกาศอย่างเดียว ไม่รับชำระเงิน
// หน้าที่ของไฟล์นี้จึงมีอย่างเดียว: พาคนไปที่ @prinnie333 ให้ถูกที่ ไม่ปล่อยให้เงียบ
// ลายเซ็นต้องตรวจด้วย LINE_CHANNEL_SECRET_2 คนละตัวกับ /webhook
const line = require('@line/bot-sdk');

const SIGNUP = process.env.SIGNUP_LIFF_URL || 'https://liff.line.me/2010382680-c6gh82Rm';
const OA1 = 'https://line.me/R/ti/p/@prinnie333';

const REPLY_SLIP =
  'ขอบคุณค่ะ 🙏 แต่บัญชีนี้เป็นบัญชีประกาศ ไม่ได้รับสลิปนะคะ\n\n' +
  'รบกวนส่งสลิปอีกครั้งที่บัญชีหลัก @prinnie333 เพื่อให้ระบบเปิดใช้งานให้อัตโนมัติค่ะ\n' +
  `👉 ${OA1}\n\n` +
  'ถ้ายังไม่ได้สมัคร กดที่นี่ได้เลยค่ะ\n' +
  `👉 ${SIGNUP}`;

const REPLY_TEXT =
  'บัญชีนี้เป็นบัญชีประกาศค่ะ 🌙\n' +
  'สมัครสมาชิกและพูดคุยกับอาจารย์ ทักที่บัญชีหลัก @prinnie333 นะคะ\n' +
  `👉 ${OA1}\n\n` +
  'สมัครสมาชิกโดยตรง\n' +
  `👉 ${SIGNUP}`;

function mount(app) {
  if (!process.env.LINE_CHANNEL_SECRET_2 || !process.env.LINE_CHANNEL_ACCESS_TOKEN_2) {
    console.log('[webhookOA2] ข้าม — ยังไม่ตั้ง LINE_CHANNEL_SECRET_2 / ACCESS_TOKEN_2');
    return;
  }
  const config = {
    channelSecret: process.env.LINE_CHANNEL_SECRET_2,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN_2,
  };
  const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken });

  app.post('/webhook2', line.middleware({ channelSecret: config.channelSecret }), async (req, res) => {
    res.sendStatus(200);
    for (const ev of req.body.events || []) {
      if (ev.type !== 'message' || !ev.replyToken) continue;
      // รูป = น่าจะเป็นสลิป ตอบให้ชัดว่าต้องส่งที่ไหน · ข้อความ = พาไปบัญชีหลัก
      const text = ev.message.type === 'image' ? REPLY_SLIP : REPLY_TEXT;
      try {
        await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: 'text', text }] });
      } catch (e) { console.error('[webhookOA2] ตอบไม่ได้:', e.message); }
    }
  });
  console.log('[webhookOA2] พร้อม — ตั้ง webhook ของ @efb2738a เป็น <base>/webhook2');
}

module.exports = { mount };
