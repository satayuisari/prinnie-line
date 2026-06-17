// LINE Flex Message templates — แคมเปญ "ปลุกฐาน 10k"
// ธีมแบรนด์ Prinnie333: ม่วง (#5B2A86 / #6B3FA0) + ทอง (#D4AF37)
// ใช้ได้ทั้ง broadcast เปิดตัว และ nudge follow-up รายคน

const PURPLE      = '#5B2A86';
const PURPLE_SOFT = '#6B3FA0';
const GOLD        = '#D4AF37';
const INK         = '#2A1B3D';

// โครง bubble มาตรฐาน: header สีม่วง + body + ปุ่มทอง
function bubble({ kicker, title, lines, buttonLabel, buttonUri, note }) {
  return {
    type: 'bubble',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: PURPLE, paddingAll: '18px',
      contents: [
        ...(kicker ? [{ type: 'text', text: kicker, color: GOLD, size: 'xs', weight: 'bold' }] : []),
        { type: 'text', text: title, color: '#FFFFFF', size: 'xl', weight: 'bold', wrap: true, margin: kicker ? 'sm' : 'none' },
      ],
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: '18px', spacing: 'md', backgroundColor: '#FBF8FF',
      contents: lines.map(t => (
        t === '---'
          ? { type: 'separator', margin: 'sm', color: '#E7DCF5' }
          : { type: 'text', text: t, size: 'sm', color: INK, wrap: true }
      )),
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm', backgroundColor: '#FBF8FF',
      contents: [
        {
          type: 'button', style: 'primary', color: GOLD, height: 'sm',
          action: { type: 'uri', label: buttonLabel, uri: buttonUri },
        },
        ...(note ? [{ type: 'text', text: note, size: 'xxs', color: PURPLE_SOFT, align: 'center', wrap: true }] : []),
      ],
    },
  };
}

function msg(altText, contents) {
  return { type: 'flex', altText, contents };
}

// 1) เปิดตัว — เชิญรับพื้นดวงฟรี (ใช้ broadcast ทั้ง 10k ครั้งเดียว)
function launchOffer(liffUrl) {
  return msg('🎁 รับพื้นดวงส่วนตัวฟรีจาก Prinnie333', bubble({
    kicker: 'PRINNIE333',
    title: 'ดวงของคุณ ไม่เหมือนใคร 🌙',
    lines: [
      'เราคำนวณ “ดวงส่วนตัว” จากวัน เวลา และสถานที่เกิดจริงของคุณ',
      'ไม่ใช่ดวง 12 ราศีทั่วไปที่ใครก็อ่านได้',
      '---',
      '🎁 รับ “พื้นดวงส่วนตัว” ฟรีวันนี้',
      'รู้จักอาทิตย์–จันทร์–ลัคนา และเลขชีวิตของคุณ',
    ],
    buttonLabel: '🎁 รับดวงฟรี',
    buttonUri: liffUrl,
    note: 'กรอกวันเกิด แล้วรอดูความแม่นค่ะ 💜',
  }));
}

// 2) Upsell หลังเห็นพื้นดวง / nudge วันแรก — ชวนสมัคร 399 + โบนัสคู่
function upsellSubscribe(liffUrl) {
  return msg('รับดวงรายวันส่วนตัวทุกเช้า 399/เดือน', bubble({
    kicker: 'ดวงรายวันส่วนตัว',
    title: 'ดวงดาวขยับทุกวัน ☀️🌙',
    lines: [
      'ทุกเช้า ดวงดาวเคลื่อนทำมุมกับดวงเกิดของคุณไม่ซ้ำกัน',
      'รับ “ดวงรายวันส่วนตัว” ส่งถึงคุณทุกเช้า',
      '---',
      '✨ เพียง 399 บาท/เดือน',
      '+ ดวงสัปดาห์/เดือน/ปี + ไพ่ + ผูกดวงคู่',
      '🎁 สมัครช่วงเปิดตัว แถมผูกดวงคู่ฟรี (มูลค่า 149)',
    ],
    buttonLabel: '✨ สมัครรับดวงรายวัน',
    buttonUri: liffUrl,
    note: 'สมาชิกรุ่นก่อตั้ง ล็อกราคา 399 ตลอด',
  }));
}

// 3) ดวงคู่ teaser — ประตูราคาเบา 149 (nudge วันที่ 3)
function coupleTeaser(coupleUrl) {
  return msg('ผูกดวงคู่กับคนที่คุณคิดถึง 149 บาท', bubble({
    kicker: 'ผูกดวงคู่ 💞',
    title: 'คุณกับเขา... ดวงไปด้วยกันไหม?',
    lines: [
      'ผูกดวงจริงของสองคน ดูความเข้ากันแบบเฉพาะเจาะจง',
      'ไม่ใช่แค่ “ราศีไหนเข้ากับราศีไหน”',
      '---',
      '💞 ดูคะแนนความเข้ากัน + จุดเด่นความสัมพันธ์',
      'ปลดล็อกผลเต็มเพียง 149 บาท (ครั้งเดียว)',
    ],
    buttonLabel: '💞 ลองผูกดวงคู่',
    buttonUri: coupleUrl,
    note: 'ดูคะแนนเบื้องต้นฟรีก่อนได้',
  }));
}

// 4) early-bird ใกล้หมด — urgency (nudge วันที่ 6)
function earlyBirdEnding(liffUrl, deadlineText) {
  return msg('โปรเปิดตัวใกล้หมดแล้ว', bubble({
    kicker: 'โปรเปิดตัว',
    title: 'เหลือเวลาอีกไม่นาน ⏳',
    lines: [
      `สมัครสมาชิกก่อน ${deadlineText} รับสิทธิ์รุ่นก่อตั้ง`,
      '---',
      '🎁 แถมผูกดวงคู่ฟรี (มูลค่า 149)',
      '🔒 ล็อกราคา 399 ตลอด ไม่ขึ้นราคา',
      'รับดวงส่วนตัวส่งถึงคุณทุกเช้า ✨',
    ],
    buttonLabel: '✨ สมัครก่อนหมดสิทธิ์',
    buttonUri: liffUrl,
    note: 'เฉพาะสมาชิกรุ่นเปิดตัวเท่านั้น',
  }));
}

module.exports = { launchOffer, upsellSubscribe, coupleTeaser, earlyBirdEnding };
