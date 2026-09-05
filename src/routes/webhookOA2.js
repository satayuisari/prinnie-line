// ทางรับข้อความของ @efb2738a (บัญชีใหญ่ ~13,100 คน)
//
// ทำไมต้องมี: บัญชีนี้ไม่เคยมี webhook คนที่ทักมาหรือส่งสลิปมาที่นี่จึงไม่เข้าระบบเลย
// ไม่ถูกตรวจ ไม่สร้างออเดอร์ ไม่มีใครได้รับแจ้ง = ลูกค้าโอนเงินแล้วเงียบหาย
// เจอจริงหลังบรอดแคสต์ 2 ก.ย. 69 — สามรายโอน 399 มาที่นี่ รวม 1,197 บาท
//
// บัญชีนี้ประกาศอย่างเดียว ไม่รับชำระเงิน หน้าที่ของไฟล์นี้คือ "พาไปให้ถูกที่ ไม่ปล่อยให้เงียบ"
// ตอบตามสิ่งที่คนถามจริง ไม่ใช่ข้อความเดียวใช้กับทุกคน
//
// ลายเซ็นตรวจด้วย LINE_CHANNEL_SECRET_2 คนละตัวกับ /webhook
const line = require('@line/bot-sdk');

const SIGNUP = process.env.SIGNUP_LIFF_URL || 'https://liff.line.me/2010382680-c6gh82Rm';
const OA1_URL = 'https://line.me/R/ti/p/@prinnie333';

// ปุ่มให้กด ดีกว่าให้ก๊อปลิงก์เอง — คนแก่/คนไม่ถนัดมือถือกดผิดน้อยลง
const buttons = (text) => ({
  type: 'template',
  altText: text.split('\n')[0],
  template: {
    type: 'buttons', text: text.slice(0, 160),
    actions: [
      { type: 'uri', label: 'สมัครสมาชิก', uri: SIGNUP },
      { type: 'uri', label: 'ไปที่ไลน์หลัก @prinnie333', uri: OA1_URL },
    ],
  },
});

// จับความตั้งใจจากคำที่คนพิมพ์จริง เรียงจากเรื่องที่พลาดแล้วเสียหายที่สุดก่อน
//   จ่ายเงิน > สมัคร/ราคา > อยากดูดวง > ทักทาย
const INTENT = [
  { k: /สลิป|โอน|จ่าย|ชำระ|ยอด|พร้อมเพย์|promptpay|qr/i, kind: 'paid' },
  // ถามเรื่องสมาชิกตรง ๆ เท่านั้นถึงตอบราคา 399
  { k: /สมัคร|สมาชิก|ต่ออายุ|รายเดือน/i, kind: 'signup' },
  // ถามถึงบริการดูดวง (รวมถึงถามราคาดูดวงเฉพาะเรื่อง) → ส่งไปคุยกับคนที่ไลน์หลัก
  // ห้ามตอบ 399 ให้คนที่ถาม "ดูดวงคลอดบุตรเท่าไร" เพราะนั่นคนละบริการ ตอบผิดคำถาม
  { k: /ดูดวง|ดวง|ไพ่|ทาโร|ผูกดวง|ความรัก|การงาน|การเงิน|ลัคนา|วันเกิด|ฤกษ์|คลอด/i, kind: 'service' },
  // เหลือแต่ถามราคาลอย ๆ ไม่ระบุบริการ → ตอบค่าสมาชิก
  { k: /ราคา|กี่บาท|เท่าไห?ร่|เท่าไร|ค่าบริการ/i, kind: 'signup' },
  { k: /สวัสดี|หวัดดี|ทัก|hello|hi|ครับ|ค่ะ|คะ/i, kind: 'hello' },
];

const REPLY = {
  // คนกลุ่มนี้จ่ายเงินไปแล้ว ต้องรีบบอกว่าเงินไม่หาย และต้องทำอะไรต่อ
  paid:
    'ได้รับข้อความแล้วนะคะ 🙏\n\n' +
    'ไลน์นี้เป็นบัญชีประกาศ ระบบตรวจสลิปอยู่ที่ไลน์หลัก @prinnie333 ค่ะ\n\n' +
    'ถ้าโอนมาแล้ว ไม่ต้องโอนซ้ำนะคะ\n' +
    '1) กดปุ่ม "ไปที่ไลน์หลัก" ด้านล่าง\n' +
    '2) กดเมนู "สมัครสมาชิก" เพื่อรับ QR\n' +
    '3) ส่งสลิปใบเดิมเข้าไปในแชทนั้น\n\n' +
    'ระบบจะเปิดใช้งานให้อัตโนมัติทันทีค่ะ ✨',
  signup:
    'สมาชิก Prinnie333 399 บาท / 30 วันค่ะ 🌙\n\n' +
    'ได้ดวงเฉพาะคุณส่งเข้าไลน์ทุกเช้า 08:00\n' +
    'คำนวณจากวัน เวลา และสถานที่เกิดของคุณจริง\n' +
    'พร้อมไพ่ประจำวันที่เลือกตามธีมดาวของวันนั้น\n\n' +
    'ครบ 14 วัน ดวงคุณจะเข้าสู่รอบพิเศษเอง\n' +
    'ทุกวันที่ 2 และ 17 สมาชิก 1 คนได้คุยกับอาจารย์\n' +
    'ตัวต่อตัว 1 ชั่วโมง ไม่มีค่าใช้จ่ายเพิ่ม\n\n' +
    'กดปุ่มด้านล่างสมัครได้เลยค่ะ',
  service:
    'ดูดวงกับอาจารย์ปรินนี่ ทักที่ไลน์หลัก @prinnie333 นะคะ 🔮\n\n' +
    'สมาชิกจะได้ดวงเฉพาะตัวทุกเช้า 08:00\n' +
    'คำนวณจากวัน เวลา สถานที่เกิดจริงของคุณ\n' +
    'ไม่ใช่ดวงราศีที่ใครก็อ่านเหมือนกัน\n\n' +
    'กดปุ่มด้านล่างได้เลยค่ะ',
  hello:
    'สวัสดีค่ะ 🙏\n\n' +
    'ไลน์นี้เป็นบัญชีประกาศค่ะ\n' +
    'สมัครสมาชิก ส่งสลิป และพูดคุยกับอาจารย์\n' +
    'ทักที่ไลน์หลัก @prinnie333 นะคะ',
};
REPLY.other = REPLY.hello;

const pick = (t) => (INTENT.find(i => i.k.test(t)) || { kind: 'other' }).kind;

function mount(app) {
  if (!process.env.LINE_CHANNEL_SECRET_2 || !process.env.LINE_CHANNEL_ACCESS_TOKEN_2) {
    console.log('[webhookOA2] ข้าม — ยังไม่ตั้ง LINE_CHANNEL_SECRET_2 / ACCESS_TOKEN_2');
    return;
  }
  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN_2,
  });

  app.post('/webhook2', line.middleware({ channelSecret: process.env.LINE_CHANNEL_SECRET_2 }), async (req, res) => {
    res.sendStatus(200);                       // ตอบ LINE ก่อนเสมอ กัน timeout
    for (const ev of req.body.events || []) {
      if (ev.type !== 'message' || !ev.replyToken) continue;
      // รูป = แทบทั้งหมดคือสลิป ตอบแบบคนจ่ายเงินไปแล้วเลย ไม่ต้องเดา
      const kind = ev.message.type === 'image' ? 'paid'
        : ev.message.type === 'text' ? pick(ev.message.text || '')
        : 'other';
      try {
        await client.replyMessage({ replyToken: ev.replyToken, messages: [buttons(REPLY[kind])] });
        console.log(`[webhookOA2] ${ev.message.type} → ตอบแบบ "${kind}"`);
      } catch (e) { console.error('[webhookOA2] ตอบไม่ได้:', e.message); }
    }
  });
  console.log('[webhookOA2] พร้อม — ตั้ง webhook ของ @efb2738a เป็น <base>/webhook2');
}

module.exports = { mount, pick, REPLY };
