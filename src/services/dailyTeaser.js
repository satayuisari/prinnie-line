// Teaser "ดวงคำนวณแล้วแต่ล็อก" — สำหรับคนลงทะเบียนแล้วแต่ยังไม่จ่าย
// โชว์ว่าดวงเขาคำนวณเสร็จ (อาทิตย์/จันทร์ของเขาจริง + ไพ่ของเขา) แต่ปิดคำทำนายไว้ → ล่อสมัคร
// ใช้ทั้งตอนกดดูดวง (webhook) และ push 8 โมงเช้า (scheduler)
const horoscope = require('./horoscopeService');

const LIFF_URL = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}`
  : 'https://liff.line.me/YOUR_LIFF_ID';

// คืน array ข้อความ (รูปไพ่ + ข้อความ teaser) ให้ reply/push ได้เลย
async function build(chart, nickname, date = new Date()) {
  const reading = await horoscope.dailyReading(chart, date);
  const heads   = horoscope.aspectHeadlines(reading.aspects || []);
  const dateStr = date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });

  const lines = [
    `✨ ดวงวันนี้ของ ${nickname || 'คุณ'} คำนวณเสร็จแล้ว! 🌙`,
    `📅 ${dateStr}`,
    '',
  ];
  if (heads.length) {
    lines.push('🌟 วันนี้ดวงดาวส่งพลังถึงคุณ:', ...heads.map(h => `${h}   🔒`), '');
  } else {
    lines.push('🌙 วันนี้ดาวของคุณมีพลังพิเศษรออยู่   🔒', '');
  }
  if (reading.tarot) lines.push(`🃏 ไพ่ประจำวันของคุณ: ${reading.tarot.name}   🔒`, '');

  lines.push(
    '━━━━━━━━━━━━',
    '🔒 คำทำนายเต็ม + ความหมายไพ่ของคุณ ถูกล็อกไว้',
    'สมาชิกอ่านดวงส่วนตัวเต็ม ๆ ได้ทุกเช้า 8 โมง ✨',
    '',
    'ปลดล็อกเลย เพียง 399 บาท/เดือน',
    `👉 ${LIFF_URL}`,
  );

  const msgs = [];
  // โชว์ "รูปไพ่ของเขา" ได้ (เป็น hook) แต่ความหมายล็อก
  if (reading.tarot && reading.tarot.image) {
    msgs.push({ type: 'image', originalContentUrl: reading.tarot.image, previewImageUrl: reading.tarot.image });
  }
  msgs.push({
    type: 'text',
    text: lines.join('\n').slice(0, 4900),
    quickReply: { items: [
      { type: 'action', action: { type: 'uri', label: '🔓 ปลดล็อก สมัคร 399', uri: LIFF_URL } },
    ] },
  });
  return msgs;
}

// ดวงเต็ม "ฟรี 1 วัน" — ให้ชิมของจริงก่อน (วันแรก) แล้วปิดท้ายด้วย upsell
async function buildFreeFullDay(chart, nickname, date = new Date()) {
  const reading = await horoscope.dailyReading(chart, date);
  const dateStr = date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
  const lines = [`🎁 ดวงวันนี้ของ ${nickname || 'คุณ'} — ฟรีวันนี้วันเดียว!`, `📅 ${dateStr}`, ''];
  if (reading.aspects && reading.aspects.length) {
    lines.push('🌟 พลังดาวที่ส่งถึงคุณวันนี้', '', ...horoscope.aspectBlocks(reading.aspects), '');
  } else {
    lines.push('🌙 วันนี้ดวงดาวของคุณนิ่งสงบ ขอให้ไพ่ใบนี้นำทางคุณนะคะ ✨', '');
  }
  if (reading.tarot) {
    const head = reading.theme ? horoscope.tarotHeading(reading.theme) : '🃏 ' + reading.tarot.name;
    lines.push(reading.theme ? `${head}: ${reading.tarot.name}` : head, reading.tarot.text);
  }
  lines.push('', '━━━━━━━━━━━━',
    '🎁 นี่คือดวงเต็ม "ฟรี 1 วัน" ของคุณ',
    'อยากอ่านดวงส่วนตัวเต็ม ๆ ทุกเช้า 8 โมง? สมัครสมาชิก 399 บาท/เดือน',
    `👉 ${LIFF_URL}`);
  const msgs = [];
  if (reading.tarot && reading.tarot.image) {
    msgs.push({ type: 'image', originalContentUrl: reading.tarot.image, previewImageUrl: reading.tarot.image });
  }
  msgs.push({
    type: 'text', text: lines.join('\n').slice(0, 4900),
    quickReply: { items: [{ type: 'action', action: { type: 'uri', label: '✨ สมัครอ่านต่อ 399', uri: LIFF_URL } }] },
  });
  return msgs;
}

// ดวงรายวัน "รวมทุกเรื่อง" อันเดียว — งาน/ความรัก/การเงิน + ไพ่ประจำวัน (flow เดียว)
// locked=true → teaser (โชว์หัวข้อ+ล็อกเนื้อหา) สำหรับคนยังไม่จ่าย
const PERIOD_TITLE = { daily: 'ดวงวันนี้', weekly: 'ดวงสัปดาห์นี้', monthly: 'ดวงเดือนนี้', annual: 'ดวงปีนี้' };
const PERIOD_WORD  = { daily: 'วันนี้', weekly: 'สัปดาห์นี้', monthly: 'เดือนนี้', annual: 'ปีนี้' };
const TAROT_WORD   = { daily: 'วัน', weekly: 'สัปดาห์', monthly: 'เดือน', annual: 'ปี' };

// ดวงแบบดั้งเดิม prinnie333 — พลังดาว + คำทำนายต้นฉบับของ อ.ปรินนี่เต็ม ๆ (ไม่แยกหมวด)
// รองรับทุกช่วง (daily/weekly/monthly/annual) + ไพ่ฉลาดจากกองความหมายของอาจารย์
// opts.userId (line_user_id) ทำให้ไพ่จำประวัติ: งวดเดียวกันได้ใบเดิม + ไม่ซ้ำใบใน 21 วัน
async function buildCombined(period, chart, nickname, date = new Date(), { locked = false, freeDay = false, userId = null } = {}) {
  // dailyReading มีตัวกรอง "มุมที่เพิ่งเข้าใหม่วันนี้" กันข้อความซ้ำข้ามวันอยู่แล้ว
  const reading = period === 'daily'
    ? await horoscope.dailyReading(chart, date)
    : await horoscope.periodReading(period, chart, date);
  // ไพ่ฉลาด: รายวันหยิบตามธีมดาวเด่นของวัน (ดวงไปทางเงิน → กองไพ่การเงินของอาจารย์)
  const tarot = await horoscope.smartTarot({ userId, period, date, theme: period === 'daily' ? (reading.theme || null) : null });
  const tarotHead = period === 'daily'
    ? (tarot && tarot.theme ? horoscope.tarotHeading(tarot.theme) : '🃏 ไพ่ประจำวัน')
    : `🃏 ไพ่ประจำ${TAROT_WORD[period] || ''}`;
  // ประกาศพิเศษจาก อ.ปรินนี่ (เช่น ช่วงดาวพุธถอยหลัง) — เจาะตามลัคนา แสดงกับทุกคนรวมถึง teaser
  const notes = period === 'daily' ? await horoscope.seasonalNotes(chart.rising, date) : [];

  const lines = [`✨ ${PERIOD_TITLE[period] || 'ดวง'}ของ ${nickname || 'คุณ'} 🌙`];
  if (period === 'daily') lines.push(`📅 ${date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}`);
  lines.push('');
  for (const n of notes) lines.push(`📌 จาก อ.ปรินนี่: ${n}`, '');

  const aspects = reading.aspects || [];
  const word = PERIOD_WORD[period] || 'ช่วงนี้';
  if (aspects.length) {
    if (locked) {
      lines.push(`🌟 ${word}ดวงดาวส่งพลังถึงคุณ:`, ...horoscope.aspectHeadlines(aspects).map(h => `${h}   🔒`), '');
    } else {
      lines.push(`🌟 พลังดาวที่ส่งถึงคุณ${word}`, '', ...horoscope.aspectBlocks(aspects), '');
    }
  } else {
    lines.push(`🌙 ${word}ดวงดาวของคุณนิ่งสงบ ขอให้ไพ่ใบนี้เป็นเพื่อนนำทางคุณนะคะ ✨`, '');
  }
  lines.push('━━━━━━━━━━━━');
  if (tarot) {
    if (locked) lines.push(`${tarotHead}ของคุณ: ${tarot.name}   🔒`);
    else lines.push(`${tarotHead}: ${tarot.name}`, tarot.text);
  }
  if (locked) {
    lines.push('', '🔒 คำทำนายเต็มทุกเรื่อง + ความหมายไพ่ ถูกล็อกไว้สำหรับสมาชิก',
      'ปลดล็อกอ่านเต็มทุกช่วง เพียง 399 บาท/เดือน', `👉 ${LIFF_URL}`);
  } else if (freeDay) {
    lines.push('', '🎁 นี่คือดวงเต็ม "ฟรี 1 วัน" ของคุณ',
      'อยากอ่านครบทุกเรื่องทุกเช้า? สมัครสมาชิก 399 บาท/เดือน', `👉 ${LIFF_URL}`);
  }

  const msgs = [];
  if (tarot && tarot.image) msgs.push({ type: 'image', originalContentUrl: tarot.image, previewImageUrl: tarot.image });
  const m = { type: 'text', text: lines.join('\n').slice(0, 4900) };
  if (locked) m.quickReply = { items: [{ type: 'action', action: { type: 'uri', label: '🔓 ปลดล็อก สมัคร 399', uri: LIFF_URL } }] };
  else if (freeDay) m.quickReply = { items: [{ type: 'action', action: { type: 'uri', label: '✨ สมัครอ่านต่อ 399', uri: LIFF_URL } }] };
  msgs.push(m);
  return msgs;
}

// alias เดิม (รายวัน)
function buildCombinedDaily(chart, nickname, date, opts) { return buildCombined('daily', chart, nickname, date, opts); }

module.exports = { build, buildFreeFullDay, buildCombined, buildCombinedDaily };
