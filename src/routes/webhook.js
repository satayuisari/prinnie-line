const line        = require('@line/bot-sdk');
const subscribers = require('../services/subscriberService');
const horoscope   = require('../services/horoscopeService');
const { replyMessage, isAllowed, TEST_MODE } = require('../services/lineMessaging');

const LIFF_URL = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}`
  : 'https://liff.line.me/YOUR_LIFF_ID';

const SIGNUP_PROMPT = {
  type: 'text',
  text: `ยังไม่มีข้อมูลดวงของคุณ 🌙\nกรุณากรอกวันเกิดก่อน เพื่อรับดวงส่วนตัว\n\n👉 ${LIFF_URL}`,
};

// ปุ่ม quick reply เลือกช่วงเวลา (ติดท้ายข้อความดวง)
const PERIOD_QR = {
  items: [
    { type: 'action', action: { type: 'postback', label: '☀️ รายวัน',     data: 'action=daily',   displayText: 'ดูดวงรายวัน' } },
    { type: 'action', action: { type: 'postback', label: '📅 รายสัปดาห์', data: 'action=weekly',  displayText: 'ดูดวงรายสัปดาห์' } },
    { type: 'action', action: { type: 'postback', label: '🗓️ รายเดือน',  data: 'action=monthly', displayText: 'ดูดวงรายเดือน' } },
    { type: 'action', action: { type: 'postback', label: '✨ รายปี',      data: 'action=annual',  displayText: 'ดูดวงรายปี' } },
  ],
};
function textQR(text) {
  return { type: 'text', text: text.slice(0, 4900), quickReply: PERIOD_QR };
}

function formatDaily(reading, nickname) {
  const lines = [`✨ ดวงวันนี้ของ ${nickname || 'คุณ'}`, ''];
  if (reading.has_content) {
    reading.aspects.forEach(a => lines.push(`🔮 ${a.text}`, ''));
  } else {
    lines.push('วันนี้ดวงดาวสงบ ไม่มีมุมเด่นกระทบดวงกำเนิด', '');
  }
  if (reading.tarot) lines.push(`🃏 ${reading.tarot.name}`, reading.tarot.text);
  return lines.join('\n').trim();
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
    return replyMessage(event.replyToken, {
      type: 'text',
      text: `ยินดีต้อนรับสู่ Prinnie333 ✨\nรับดวงส่วนตัวรายวันผ่าน LINE\n\nเริ่มต้นกรอกวันเกิด 👉 ${LIFF_URL}`,
    });
  }

  // ปุ่ม rich menu ส่ง postback
  const action = event.type === 'postback'
    ? new URLSearchParams(event.postback.data).get('action')
    : (event.type === 'message' && event.message.type === 'text' ? 'help' : null);

  if (!action) return;

  const userId = event.source.userId;
  const sub    = await subscribers.getByLineUserId(userId);

  try {
    switch (action) {
      case 'daily': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const reading = await horoscope.dailyReading(sub.chart_data, new Date());
        return replyMessage(event.replyToken, textQR(formatDaily(reading, sub.nickname)));
      }
      case 'weekly':
      case 'monthly':
      case 'annual': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const labels = { weekly: '📅 ดวงรายสัปดาห์', monthly: '🗓️ ดวงรายเดือน', annual: '✨ ดวงรายปี' };
        const reading = await horoscope.periodReading(action);
        const body = reading
          ? `${labels[action]} ของ ${sub.nickname || 'คุณ'}\n\n🃏 ${reading.name}\n${reading.text}`
          : `${labels[action]}\n\nยังไม่มีคำทำนายช่วงนี้`;
        return replyMessage(event.replyToken, textQR(body));
      }
      case 'natal': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const reading = await horoscope.natalReading(sub.chart_data);
        return replyMessage(event.replyToken, { type: 'text', text: formatNatal(reading) });
      }
      case 'tarot': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const reading = await horoscope.dailyReading(sub.chart_data, new Date());
        const t = reading.tarot;
        return replyMessage(event.replyToken, {
          type: 'text',
          text: t ? `🃏 ${t.name}\n\n${t.text}` : 'ไม่มีไพ่ในขณะนี้',
        });
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
          ].join('\n'),
        });
      }
      case 'help':
      default:
        return replyMessage(event.replyToken, {
          type: 'text',
          text: `📖 วิธีใช้งาน Prinnie333\n\n• ดูดวงวันนี้ — ดวงรายวันส่วนตัว\n• พื้นดวง — ดวงกำเนิดของคุณ\n• ไพ่ทาโรต์ — ไพ่ประจำวัน\n• สมัคร/ต่ออายุ — ${LIFF_URL}\n\nดวงจะส่งอัตโนมัติทุกเช้า 08:00 น.`,
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
