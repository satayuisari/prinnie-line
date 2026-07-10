const line        = require('@line/bot-sdk');
const subscribers = require('../services/subscriberService');
const horoscope   = require('../services/horoscopeService');
const { replyMessage, isAllowed, TEST_MODE, client } = require('../services/lineMessaging');
const flex         = require('../marketing/flexTemplates');
const supportInbox = require('../services/supportInbox');
const supportAI    = require('../services/supportAI');
const triage       = require('../services/supportTriage');
const paymentOrders = require('../services/paymentOrders');

async function lineClient_safeProfile(userId) {
  try { const p = await client.getProfile(userId); return p && p.displayName; }
  catch (_) { return null; }
}

const LIFF_URL = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}`
  : 'https://liff.line.me/YOUR_LIFF_ID';
// เปิด LIFF ไปที่ฟอร์มผูกดวงคู่ (signup.html อ่าน ?view=couple)
const COUPLE_LIFF = `${LIFF_URL}?view=couple`;

const SIGNUP_PROMPT = {
  type: 'text',
  text: `ยังไม่มีข้อมูลดวงของคุณ 🌙\nกรุณากรอกวันเกิดก่อน เพื่อรับดวงส่วนตัว\n\n👉 ${LIFF_URL}`,
};

const PAYWALL_PROMPT = {
  type: 'text',
  text: `ฟีเจอร์นี้สำหรับสมาชิก Prinnie333 ✨\n\nสมัคร/ต่ออายุ เพียง 399 บาท/เดือน\nรับดวงส่วนตัวทุกเช้า + ผูกดวงคู่ + ดวงรายสัปดาห์/เดือน/ปี\n\n👉 ${LIFF_URL}`,
};

// ปุ่ม quick reply เลือกช่วงเวลา (ติดท้ายข้อความดวง)
const PERIOD_QR = {
  items: [
    { type: 'action', action: { type: 'postback', label: '☀️ รายวัน',     data: 'action=daily',   displayText: 'ดูดวงรายวัน' } },
    { type: 'action', action: { type: 'postback', label: '📅 รายสัปดาห์', data: 'action=weekly',  displayText: 'ดูดวงรายสัปดาห์' } },
    { type: 'action', action: { type: 'postback', label: '🗓️ รายเดือน',  data: 'action=monthly', displayText: 'ดูดวงรายเดือน' } },
    { type: 'action', action: { type: 'postback', label: '✨ รายปี',      data: 'action=annual',  displayText: 'ดูดวงรายปี' } },
    { type: 'action', action: { type: 'uri',      label: '💞 ดูดวงคู่',   uri: COUPLE_LIFF } },
  ],
};
function textQR(text) {
  return { type: 'text', text: text.slice(0, 4900), quickReply: PERIOD_QR };
}

function formatReading(reading, title, nickname) {
  const lines = [`${title} ของ ${nickname || 'คุณ'}`, ''];
  if (reading.aspects && reading.aspects.length) {
    lines.push('🌟 พลังดาวที่ส่งถึงคุณวันนี้', '');
    lines.push(...horoscope.aspectBlocks(reading.aspects), '');
  } else {
    lines.push('🌙 ช่วงนี้ดวงดาวของคุณนิ่งสงบ ไม่มีมุมเด่นพิเศษ',
               'เป็นวันสบาย ๆ ขอให้ไพ่ใบนี้นำทางคุณนะคะ ✨', '');
  }
  if (reading.tarot) {
    // ดวงรายวันติดป้ายหมวด (ไพ่การเงิน/ความรัก/การงาน) ตามดวงดาว — รายสัปดาห์/เดือน/ปี ใช้หัวธรรมดา
    const head = reading.theme ? horoscope.tarotHeading(reading.theme) : '🃏 ' + reading.tarot.name;
    lines.push(reading.theme ? `${head}: ${reading.tarot.name}` : head, reading.tarot.text);
  }
  return lines.join('\n').trim();
}

// สร้าง array ข้อความ: ถ้ามีรูปไพ่ → ส่งรูปนำหน้า แล้วตามด้วยข้อความ+quick reply
function buildMessages(reading, title, nickname) {
  const msgs = [];
  if (reading.tarot && reading.tarot.image) {
    msgs.push({ type: 'image', originalContentUrl: reading.tarot.image, previewImageUrl: reading.tarot.image });
  }
  msgs.push(textQR(formatReading(reading, title, nickname)));
  return msgs;
}

function formatNatal(r) {
  const parts = [
    `🌟 พื้นดวงของคุณ`,
    `☀️ อาทิตย์: ${r.sun_sign}`,
    `🌙 จันทร์: ${r.moon_sign}`,
    `⬆️ ลัคนา: ${r.rising_sign || 'ไม่ระบุ (ต้องมีเวลาเกิด)'}`,
    `🔢 เลขชีวิต: ${r.life_path}`,
    '',
  ];
  if (r.sections.sun)  parts.push(`☀️ ${r.sections.sun}`, '');
  if (r.sections.rising) parts.push(`⬆️ ${r.sections.rising}`, '');
  return parts.join('\n').trim().slice(0, 4900); // LINE จำกัด 5000 ตัว
}

// แปลงสถานะสมาชิกจริง (getMemberStatus) → ข้อความบริบทให้ AI ตอบตรงตัวบุคคล
function memberContext(ms) {
  if (!ms || ms.status === 'NOT_FOUND') {
    return `สถานะ: ยังไม่ลงทะเบียน (ยังไม่เคยกรอกวันเกิด). ค่าสมาชิก 399 บาท/เดือน. ลิงก์เริ่มต้น/สมัคร: ${LIFF_URL}`;
  }
  const name = ms.nickname ? `ชื่อเล่น: ${ms.nickname}. ` : '';
  if (ms.status === 'ACTIVE') {
    const d = ms.expire_date ? new Date(ms.expire_date).toLocaleDateString('th-TH') : '-';
    return `${name}สถานะสมาชิก: ACTIVE (ใช้งานได้) หมดอายุ ${d}. ราคาต่ออายุ 399 บาท/เดือน.`;
  }
  if (ms.status === 'EXPIRED') {
    return `${name}สถานะสมาชิก: หมดอายุแล้ว. ต่ออายุ 399 บาท/เดือน ลิงก์: ${LIFF_URL}`;
  }
  return `${name}สถานะสมาชิก: PENDING (ลงทะเบียนแล้วแต่ยังไม่ชำระ). ค่าสมาชิก 399 บาท/เดือน ลิงก์ชำระ: ${LIFF_URL}`;
}

async function handleEvent(event) {
  // ════════ SAFETY: ตอน TEST_MODE ไม่ตอบ/ไม่ทำอะไรกับคนนอก allowlist ════════
  // กัน follower จริงที่บังเอิญทักมาในช่วงเทส เห็น auto-reply แล้วรู้ตัว
  const sourceUserId = event.source && event.source.userId;
  if (TEST_MODE && !isAllowed(sourceUserId)) {
    console.log(`[TEST_MODE] 🚫 เพิกเฉย event จาก ${sourceUserId} (ไม่อยู่ใน allowlist)`);
    return;
  }

  // follow = เพิ่งกด add (หรือ unblock)
  if (event.type === 'follow') {
    // เก็บ lead ไว้วัด funnel + ตามกลับ (ไม่ทับคนที่ลงทะเบียน/จ่ายแล้ว) — non-blocking
    const uid = event.source && event.source.userId;
    if (uid) {
      const p = await client.getProfile(uid).catch(() => null);
      await subscribers.captureFollower({
        line_user_id: uid,
        display_name: p && p.displayName,
        picture_url:  p && p.pictureUrl,
      }).catch(e => console.error('[follow] captureFollower:', e.message));
    }
    return replyMessage(event.replyToken, flex.welcomeCard(LIFF_URL));
  }

  // รูปภาพ = น่าจะเป็นสลิปโอนเงิน → ผูกกับออเดอร์ PromptPay ที่ค้างอยู่ของ user นี้
  // มีออเดอร์ค้าง → ตอบรับสลิป (staff อนุมัติบน dashboard). ไม่มี → รูปทั่วไป เงียบไว้ให้ staff ดูแล
  if (event.type === 'message' && event.message.type === 'image') {
    const order = await paymentOrders.attachSlip(event.source.userId, event.message.id).catch(() => null);
    if (order) {
      const what = order.type === 'couple' ? 'ปลดล็อกผลดวงคู่' : 'เปิดใช้งานสมาชิก';
      return replyMessage(event.replyToken, { type: 'text', text:
        `ได้รับสลิปแล้วค่ะ ✨\nทีมงานกำลังตรวจสอบการชำระเงิน จะ${what}ให้ภายใน 24 ชม. แล้วแจ้งกลับนะคะ 🙏` });
    }
    return;
  }

  // ปุ่ม rich menu ส่ง postback / ข้อความพิมพ์ → เดาเจตนา
  //   คีย์เวิร์ดดวงคู่ → synastry, คีย์เวิร์ดช่วยเหลือ/ทักทาย → help
  //   ข้อความอื่น → เงียบ (return) ให้พนักงานตอบแชทเอง ไม่ให้บอทแย่งตอบ
  let action = null;
  if (event.type === 'postback') {
    action = new URLSearchParams(event.postback.data).get('action');
  } else if (event.type === 'message' && event.message.type === 'text') {
    const t = (event.message.text || '').trim();
    if (/คู่|ผูกดวง|ความรัก|แฟน/.test(t)) action = 'synastry';
    else if (/ช่วยเหลือ|วิธีใช้|เมนู|help|สวัสดี|hello|hi|^\?+$/i.test(t)) action = 'help';
    else action = null;
  }

  // ข้อความที่บอทไม่ตอบ (non-keyword) → เก็บเข้า support inbox
  // 🤖 AI auto-reply (เปิดเมื่อ ANTHROPIC_API_KEY + AI_AUTOREPLY=true): บอทตอบเองเฉพาะหมวด
  //    ปลอดภัย (ถามดวง/ทั่วไป). เงิน/อารมณ์/โกรธ → เงียบ ให้ staff ตอบบน dashboard.
  //    ถ้าไม่เปิด/ไม่เข้าเงื่อนไข → พฤติกรรมเดิม: เงียบ เก็บเข้า inbox อย่างเดียว
  if (!action && event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    let name = null;
    try { name = (await lineClient_safeProfile(event.source.userId)); } catch (_) {}
    const id = await supportInbox.capture(event.source.userId, name, text).catch(() => null);

    if (id && process.env.AI_AUTOREPLY === 'true' && supportAI.isEnabled()) {
      const { category } = triage.classify(text);
      if (supportInbox.AUTO_REPLY.has(category)) {
        const ms = await subscribers.getMemberStatus(event.source.userId).catch(() => null);
        // 🛡️ ข้อพิพาทการจ่าย: ลูกค้าอ้างว่าจ่ายแล้วแต่ระบบยังไม่ ACTIVE → ให้คนตรวจสอบจริง ไม่ให้บอทตอบ
        const claimsPaid = /จ่ายแล้ว|โอนแล้ว|ชำระแล้ว|ตัดเงิน|เงินออก|สลิป/.test(text);
        if (category === 'payment' && claimsPaid && (!ms || ms.status !== 'ACTIVE')) {
          return; // เงียบ → staff เช็คการชำระเอง (ข้อความอยู่ใน inbox แล้ว)
        }
        const ans = await supportAI.generate(text, category, memberContext(ms));
        if (ans) {
          await supportInbox.markAutoReplied(id, ans).catch(() => {});
          return replyMessage(event.replyToken, { type: 'text', text: ans.slice(0, 4900) });
        }
      }
    }
    return; // เงียบ → staff ตอบบน dashboard
  }

  if (!action) return;

  const userId = event.source.userId;
  const sub    = await subscribers.getByLineUserId(userId);

  // ════ PAYWALL: ฟีเจอร์พรีเมียมต้องเป็นสมาชิกที่ยัง active ════
  // ฟรี: natal (พื้นดวง=hook), tarot (ไพ่รายวัน teaser), profile, help
  // จ่าย: daily, weekly, monthly, annual
  // synastry ไม่อยู่ใน gate นี้ — คนนอกเข้าถึง teaser ได้ แล้วจ่าย 149 ปลดล็อก (คุมใน /synastry route)
  const PAID   = new Set(['daily', 'weekly', 'monthly', 'annual']);
  const active = !!(sub && sub.subscribe_end && new Date(sub.subscribe_end) > new Date());
  if (PAID.has(action)) {
    if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
    if (!active) return replyMessage(event.replyToken, PAYWALL_PROMPT);
  }

  try {
    switch (action) {
      case 'daily': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const reading = await horoscope.dailyReading(sub.chart_data, new Date());
        return replyMessage(event.replyToken, buildMessages(reading, '✨ ดวงวันนี้', sub.nickname));
      }
      case 'weekly':
      case 'monthly':
      case 'annual': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const labels = { weekly: '📅 ดวงรายสัปดาห์', monthly: '🗓️ ดวงรายเดือน', annual: '✨ ดวงรายปี' };
        const reading = await horoscope.periodReading(action, sub.chart_data, new Date());
        return replyMessage(event.replyToken, buildMessages(reading, labels[action], sub.nickname));
      }
      case 'natal': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const reading = await horoscope.natalReading(sub.chart_data);
        return replyMessage(event.replyToken, { type: 'text', text: formatNatal(reading) });
      }
      case 'tarot': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const t = await horoscope.tarotByType('free');
        if (!t) return replyMessage(event.replyToken, { type: 'text', text: 'ไม่มีไพ่ในขณะนี้' });
        const msgs = [];
        if (t.image) msgs.push({ type: 'image', originalContentUrl: t.image, previewImageUrl: t.image });
        msgs.push({ type: 'text', text: `🃏 ${t.name}\n\n${t.text}`.slice(0, 4900) });
        return replyMessage(event.replyToken, msgs);
      }
      case 'profile': {
        if (!sub) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const active = sub.subscribe_end && new Date(sub.subscribe_end) > new Date();
        return replyMessage(event.replyToken, {
          type: 'text',
          text: [
            `👤 โปรไฟล์: ${sub.nickname || sub.display_name || '-'}`,
            `🎂 เกิด: ${sub.birth_date || '-'} ${sub.birth_time || ''}`,
            `📍 ${sub.birth_place || '-'}`,
            `💳 สมาชิก: ${active ? 'ใช้งานอยู่ ถึง ' + new Date(sub.subscribe_end).toLocaleDateString('th-TH') : 'ยังไม่สมัคร/หมดอายุ'}`,
            '',
            `✏️ แก้ไขวันเกิด/เวลา/สถานที่ (กรอกผิดแก้ได้):`,
            `👉 ${LIFF_URL}`,
          ].join('\n'),
        });
      }
      case 'synastry': {
        // ผูกดวงคู่ — ต้องมีดวงของตัวเองก่อน แล้วเปิด LIFF กรอกวันเกิดของอีกฝ่าย
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        return replyMessage(event.replyToken, {
          type: 'text',
          text: `💞 ผูกดวงคู่ — ดูความเข้ากันของคุณกับคนพิเศษ\n\nกรอกวันเกิดของอีกฝ่าย แล้วดูดวงความสัมพันธ์ได้เลย\n\n👉 ${COUPLE_LIFF}`,
        });
      }
      case 'help':
      default:
        return replyMessage(event.replyToken, {
          type: 'text',
          text: `📖 วิธีใช้งาน Prinnie333\n\n• ☀️ ดูดวงวันนี้ — ดวงรายวันส่วนตัว\n• 🌟 พื้นดวง — ดวงกำเนิดของคุณ\n• 🃏 ไพ่ทาโรต์ — ไพ่ประจำวัน\n• 💞 ผูกดวงคู่ — ดูดวงความเข้ากันกับคนพิเศษ\n• 💎 สมัคร/ต่ออายุ/แก้ไขข้อมูล — ${LIFF_URL}\n\nดวงจะส่งอัตโนมัติทุกเช้า 08:00 น.\n\n💜 มีคำถามเพิ่มเติม พิมพ์ทักแชทได้เลย ทีมงานยินดีช่วยดูแลค่ะ`,
        });
    }
  } catch (err) {
    console.error('[webhook] handler error:', err.message);
    return replyMessage(event.replyToken, { type: 'text', text: 'ขออภัย เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะคะ' });
  }
}

// register บน express app (ต้องเรียกก่อน bodyParser.json() global)
function register(app) {
  const config = { channelSecret: process.env.LINE_CHANNEL_SECRET };

  app.post('/webhook', line.middleware(config), async (req, res) => {
    res.status(200).end(); // ตอบ LINE ทันที
    const events = req.body.events || [];
    if (events.length) {
      console.log('[webhook] รับ event:', events.map(e =>
        `${e.type}${e.postback ? `(${e.postback.data})` : ''} from ${e.source && e.source.userId}`
      ).join(', '));
    }
    try {
      await Promise.all(events.map(handleEvent));
    } catch (err) {
      console.error('[webhook]', err.message);
    }
  });
}

module.exports = { register, handleEvent };
