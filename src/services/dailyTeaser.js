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

// วันที่เรื่องนั้นไม่มีมุมดาวเด่น — หมุนประโยคตามวัน ไม่ให้ขึ้น "ค่อนข้างนิ่ง" เดิมซ้ำทุกวัน
// (หลังกันข้อความซ้ำข้ามวันแล้ว วันเงียบจะเจอบ่อยขึ้น) โทนแบรนด์: สบาย ๆ ให้กำลังใจ ไม่ดราม่า
const QUIET_LINES = {
  love: [
    'ความรักวันนี้ไม่มีมุมดาวเด่น อยู่กับคนตรงหน้าแบบสบาย ๆ ก็ดีแล้วค่ะ',
    'วันนี้เรื่องหัวใจราบเรียบ ไม่มีอะไรต้องลุ้น ใช้เวลากับตัวเองได้เต็มที่ค่ะ',
    'ดาวความรักวันนี้พัก ความสัมพันธ์เดินตามปกติ ไม่มีเรื่องให้คิดมากค่ะ',
    'วันนี้ความรักโทนเรียบ ๆ เหมาะกับดูแลใจตัวเองให้ชุ่มชื่นค่ะ',
  ],
  work: [
    'การงานวันนี้ไม่มีมุมดาวกดดัน ทำตามจังหวะปกติได้สบาย ๆ ค่ะ',
    'วันนี้งานราบเรียบ เหมาะกับเก็บงานค้างให้จบเป็นเรื่อง ๆ ค่ะ',
    'ดาวการงานวันนี้นิ่ง เรื่องใหญ่พักไว้ก่อน ทำของตรงหน้าให้เรียบร้อยพอค่ะ',
    'วันนี้การงานไม่มีอะไรต้องลุ้นเป็นพิเศษ ถือเป็นวันพักหายใจค่ะ',
  ],
  money: [
    'การเงินวันนี้นิ่ง ไม่มีจังหวะพิเศษ ใช้จ่ายตามแผนเดิมได้เลยค่ะ',
    'วันนี้เรื่องเงินราบเรียบ ไม่เข้าไม่ออกผิดปกติ เก็บออมตามจังหวะเดิมค่ะ',
    'ดาวการเงินวันนี้พัก ยังไม่ใช่วันตัดสินใจเรื่องเงินก้อนใหญ่ค่ะ',
    'วันนี้การเงินไม่มีมุมดาวเด่น ประคองกระเป๋าตามแผนเดิมสบาย ๆ ค่ะ',
  ],
};
function quietLine(period, topic, label, date) {
  if (period !== 'daily' || !QUIET_LINES[topic]) {
    return `${PERIOD_WORD[period] || 'ช่วงนี้'}${label}ค่อนข้างนิ่ง ไม่มีจังหวะเด่นเป็นพิเศษ`;
  }
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  return QUIET_LINES[topic][dayOfYear % QUIET_LINES[topic].length];
}

// ดวง "รวมทุกเรื่อง" อันเดียว รองรับทุกช่วง (daily/weekly/monthly/annual) — งาน/รัก/เงิน + ไพ่
// opts.userId (line_user_id) ทำให้ไพ่จำประวัติ: งวดเดียวกันได้ใบเดิม + ไม่ซ้ำใบใน 21 วัน
async function buildCombined(period, chart, nickname, date = new Date(), { locked = false, freeDay = false, userId = null } = {}) {
  const tp = horoscope.PERIOD_TRANSIT[period] || horoscope.PERIOD_TRANSIT.daily;
  // เรียงตามลำดับสิทธิ์ (รัก→งาน→เงิน) + skip ร่วม → คู่ดาวเดียวกันไม่โผล่ซ้ำข้ามเรื่อง
  const skip  = new Set();
  const love  = await horoscope.topicReading('love',  chart, date, tp, skip);
  const work  = await horoscope.topicReading('work',  chart, date, tp, skip);
  const money = await horoscope.topicReading('money', chart, date, tp, skip);
  // ไพ่ฉลาด: รายวันหยิบจากกองของหมวดที่มุมดาวแม่นสุดวันนั้น (ดวงไปทางเงิน → ไพ่การเงิน)
  // ช่วงอื่นหยิบจากกองประจำช่วง — ทุกกองคือความหมายไพ่ของ อ.ปรินนี่ + จำประวัติไม่หยิบซ้ำ
  let theme = null, best = -1;
  for (const r of [love, work, money]) {
    const ex = r.aspects[0] ? (r.aspects[0].exactness || 0) : -1;
    if (r.aspects[0] && ex > best) { best = ex; theme = r.topic; }
  }
  const tarot = await horoscope.smartTarot({ userId, period, date, theme: period === 'daily' ? theme : null });
  const tarotHead = period === 'daily'
    ? (tarot && tarot.theme ? horoscope.tarotHeading(tarot.theme) : '🃏 ไพ่ประจำวัน')
    : `🃏 ไพ่ประจำ${TAROT_WORD[period] || ''}`;
  // ประกาศพิเศษจาก อ.ปรินนี่ (เช่น ช่วงดาวพุธถอยหลัง) — เจาะตามลัคนา แสดงกับทุกคนรวมถึง teaser
  const notes = period === 'daily' ? await horoscope.seasonalNotes(chart.rising, date) : [];

  const lines = [`✨ ${PERIOD_TITLE[period] || 'ดวง'}ของ ${nickname || 'คุณ'} 🌙`];
  if (period === 'daily') lines.push(`📅 ${date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}`);
  lines.push('');
  for (const n of notes) lines.push(`📌 จาก อ.ปรินนี่: ${n}`, '');
  for (const r of [work, love, money]) {
    lines.push(`${r.emoji} ${r.label}`);
    if (r.aspects && r.aspects.length) {
      // ตัดศัพท์โหราออก (เช่น "พลังดาวอังคาร กากบาท ดาวพุธ") → เหลือคำทำนายภาษาคนอ่านง่าย
      if (locked) lines.push('🔒 มีจังหวะสำคัญของคุณรออยู่ ปลดล็อกอ่านเต็มได้เลย');
      else lines.push(r.aspects[0].text);
    } else {
      lines.push(quietLine(period, r.topic, r.label, date));
    }
    lines.push('');
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
