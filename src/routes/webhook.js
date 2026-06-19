const line        = require('@line/bot-sdk');
const subscribers = require('../services/subscriberService');
const horoscope   = require('../services/horoscopeService');
const { replyMessage, isAllowed, TEST_MODE, client } = require('../services/lineMessaging');
const flex         = require('../marketing/flexTemplates');
const supportInbox = require('../services/supportInbox');

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
  if (reading.tarot) lines.push('🃏 ' + reading.tarot.name, reading.tarot.text);
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
    return replyMessage(event.replyToken, flex.welcomeCard(LIFF_URL));
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

  // ข้อความที่บอทไม่ตอบ (non-keyword) → เก็บเข้า support inbox ให้ staff ดู/ตอบบน dashboard
  // (ยังเงียบกับลูกค้าเหมือนเดิม — staff/AI ตอบทีหลังผ่าน dashboard)
  if (!action && event.type === 'message' && event.message.type === 'text') {
    let name = null;
    try { name = (await lineClient_safeProfile(event.source.userId)); } catch (_) {}
    supportInbox.capture(event.source.userId, name, event.message.text.trim()).catch(() => {});
    return;
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
