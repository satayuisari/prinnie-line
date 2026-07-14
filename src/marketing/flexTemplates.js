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
  return msg('🌙 ดวงจริง ไม่ใช่แค่ราศี — รับพื้นดวงฟรี', bubble({
    kicker: 'PRINNIE333',
    title: 'ดวงจริง ไม่ใช่แค่ราศี 🌙',
    lines: [
      'ที่รู้สึกว่า “ดูดวงไม่ตรง” เพราะอ่านแค่ดวง 12 ราศี — ที่คนราศีเดียวกันได้เหมือนกันหมด',
      'ดวงจริงของคุณดูจาก “ลัคนา” (ราศีที่ขึ้นตอนเกิด) + ตำแหน่งดวงดาวจริง ณ วันเวลาที่คุณเกิด',
      'ลัคนาเปลี่ยนทุก ๆ 2 ชั่วโมง เกิดคนละเวลา ดวงก็คนละแบบ',
      '---',
      '🎁 รับ “พื้นดวงส่วนตัว” ฟรี — รู้ลัคนา อาทิตย์ จันทร์ และเลขชีวิตของคุณ',
    ],
    buttonLabel: '🎁 รับดวงฟรี',
    buttonUri: liffUrl,
    note: 'กรอกวันเกิด (ใส่เวลาเกิดด้วย จะได้ลัคนาแม่น) 💜',
  }));
}

// 1b) เปิดตัวสำหรับ "บัญชีใหญ่" (@efb2738a 23k) — ดึงคนไปแอดบัญชีบริการ @prinnie333
function launchBig(addFriendUrl) {
  return msg('🌙 ดวงจริง ไม่ใช่แค่ราศี — รับพื้นดวงฟรี', bubble({
    kicker: 'PRINNIE333',
    title: 'ดูดวงไม่ตรง? เพราะดูแค่ราศี 🌙',
    lines: [
      'ดวง 12 ราศีที่ทุกคนอ่านเหมือนกัน มันเลยรู้สึกไม่ตรง',
      'ดวงจริงดูจาก “ลัคนา” + ตำแหน่งดวงดาวจริง ตอนที่คุณเกิด',
      'เกิดคนละเวลา ลัคนาคนละราศี — ดวงเลยเป็นของคุณคนเดียว',
      '---',
      '🎁 รับ “พื้นดวงส่วนตัว” ฟรี รู้ลัคนา อาทิตย์ จันทร์ ของคุณ',
    ],
    buttonLabel: '🎁 แอดรับดวงฟรี',
    buttonUri: addFriendUrl,
    note: 'แอด @prinnie333 แล้วเริ่มได้เลย 💜',
  }));
}

// 1c) เปิดตัวแบบ "วิดีโอในการ์ด" (video hero) — รวมวิดีโอ+ข้อความ+ปุ่ม เป็น 1 บับเบิล
//     ใช้ broadcast จริง (นับ 1 ข้อความ/คน). buttonUri ต่างกันตาม OA (บริการ→LIFF, ใหญ่→แอด)
function launchVideo(videoUrl, previewUrl, buttonUri) {
  return {
    type: 'flex',
    altText: '🌙 ดวงจริง ไม่ใช่แค่ราศี — รับพื้นดวงฟรี',
    contents: {
      type: 'bubble', size: 'mega',
      hero: {
        type: 'video', url: videoUrl, previewUrl, aspectRatio: '9:16',
        altContent: { type: 'image', url: previewUrl, size: 'full', aspectRatio: '9:16', aspectMode: 'cover' },
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: '#2A1B3D', paddingAll: '18px',
        contents: [
          { type: 'text', text: 'ดวงจริง ไม่ใช่แค่ราศี 🌙', weight: 'bold', size: 'lg', color: '#F6F1FF', wrap: true },
          { type: 'text', text: 'ที่รู้สึกว่า “ดูดวงไม่ตรง” เพราะอ่านแค่ดวง 12 ราศี — ดวงจริงดูจาก “ลัคนา” และตำแหน่งดวงดาวจริง ณ วันเวลาที่คุณเกิด', size: 'sm', color: '#d9cff0', wrap: true },
          { type: 'text', text: '🎁 รับพื้นดวงส่วนตัวฟรี — รู้ลัคนา อาทิตย์ จันทร์ ของคุณ', size: 'sm', color: '#E8C77A', wrap: true, margin: 'md' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', backgroundColor: '#2A1B3D', paddingAll: '18px', paddingTop: '0px',
        contents: [
          { type: 'button', style: 'primary', color: '#E8C77A', height: 'sm',
            action: { type: 'uri', label: '🎁 รับดวงฟรี', uri: buttonUri } },
        ],
      },
    },
  };
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
      '🎁 สมัครช่วงเปิดตัว แถมผูกดวงคู่ฟรี (มูลค่า 199)',
    ],
    buttonLabel: '✨ สมัครรับดวงรายวัน',
    buttonUri: liffUrl,
    note: 'สมาชิกรุ่นก่อตั้ง ล็อกราคา 399 ตลอด',
  }));
}

// 3) ดวงคู่ teaser — ประตูราคาเบา 199 (nudge วันที่ 3)
function coupleTeaser(coupleUrl) {
  return msg('ผูกดวงคู่กับคนที่คุณคิดถึง 199 บาท', bubble({
    kicker: 'ผูกดวงคู่ 💞',
    title: 'คุณกับเขา... ดวงไปด้วยกันไหม?',
    lines: [
      'ผูกดวงจริงของสองคน ดูความเข้ากันแบบเฉพาะเจาะจง',
      'ไม่ใช่แค่ “ราศีไหนเข้ากับราศีไหน”',
      '---',
      '💞 ดูคะแนนความเข้ากัน + จุดเด่นความสัมพันธ์',
      'ปลดล็อกผลเต็มเพียง 199 บาท (ครั้งเดียว)',
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
      '🎁 แถมผูกดวงคู่ฟรี (มูลค่า 199)',
      '🔒 ล็อกราคา 399 ตลอด ไม่ขึ้นราคา',
      'รับดวงส่วนตัวส่งถึงคุณทุกเช้า ✨',
    ],
    buttonLabel: '✨ สมัครก่อนหมดสิทธิ์',
    buttonUri: liffUrl,
    note: 'เฉพาะสมาชิกรุ่นเปิดตัวเท่านั้น',
  }));
}

// ─── เตือนต่ออายุ (กัน churn) — ใช้กับสมาชิกที่เคยจ่ายแล้วใกล้/เลยวันหมดอายุ ───

// 5) ก่อนหมดอายุ (T-3..T-1) — เตือนล่วงหน้า ดวงรายวันกำลังจะหยุด
function renewalSoon(liffUrl, daysLeft, expireText) {
  const dayWord = daysLeft <= 1 ? 'พรุ่งนี้' : `อีก ${daysLeft} วัน`;
  return msg(`สมาชิกของคุณใกล้หมดอายุ (${dayWord})`, bubble({
    kicker: 'ต่ออายุสมาชิก',
    title: `ดวงรายวันส่วนตัวจะหยุดส่ง${daysLeft <= 1 ? 'เร็ว ๆ นี้' : `ใน ${daysLeft} วัน`} ⏳`,
    lines: [
      `สมาชิก Prinnie333 ของคุณจะหมดอายุ ${expireText}`,
      'ต่ออายุไว้ เพื่อรับดวงส่วนตัวส่งถึงคุณทุกเช้าต่อเนื่อง',
      '---',
      '☀️ ดวงรายวันส่วนตัวจากดวงเกิดจริงของคุณ',
      '+ ดวงสัปดาห์/เดือน/ปี + ไพ่ + ผูกดวงคู่ไม่จำกัด',
    ],
    buttonLabel: '✨ ต่ออายุสมาชิก',
    buttonUri: liffUrl,
    note: 'ต่ออายุก่อนหมด ดวงเช้าไม่สะดุดค่ะ 💜',
  }));
}

// 6) วันหมดอายุ (T-0..T+1) — แจ้งว่าหมดแล้ว ดวงหยุดส่ง
function renewalExpired(liffUrl) {
  return msg('สมาชิกของคุณหมดอายุแล้ว', bubble({
    kicker: 'สมาชิกหมดอายุ',
    title: 'ดวงรายวันส่วนตัวหยุดส่งแล้ววันนี้ 🌙',
    lines: [
      'สมาชิก Prinnie333 ของคุณหมดอายุแล้ว ดวงเช้าจึงพักไว้ก่อน',
      'ต่ออายุเมื่อไหร่ ดวงส่วนตัวพร้อมส่งถึงคุณทุกเช้าทันที',
      '---',
      '☀️ ดวงรายวันเฉพาะคุณ ทุกเช้า 08:00 น.',
      '🔒 สมาชิกรุ่นก่อตั้ง ราคาเดิม 399 บาท/เดือน',
    ],
    buttonLabel: '✨ ต่ออายุรับดวงต่อ',
    buttonUri: liffUrl,
    note: 'คิดถึงดวงเช้า ๆ ของคุณนะคะ 💜',
  }));
}

// 7) win-back (T+3) — ดึงกลับครั้งสุดท้ายของรอบ
function renewalWinback(liffUrl) {
  return msg('กลับมารับดวงเช้าของคุณอีกครั้งไหม', bubble({
    kicker: 'คิดถึงคุณ 💜',
    title: 'ดวงดาวยังขยับ... รอส่งถึงคุณอยู่ ✨',
    lines: [
      'ผ่านมาหลายเช้าแล้วที่ดวงส่วนตัวของคุณพักไว้',
      'ทุกวันดวงดาวเคลื่อนทำมุมกับดวงเกิดของคุณไม่ซ้ำกัน',
      '---',
      'กลับมาเป็นสมาชิก รับดวงรายวันเฉพาะคุณส่งทุกเช้า',
      'เพียง 399 บาท/เดือน + ผูกดวงคู่ไม่จำกัด',
    ],
    buttonLabel: '💜 กลับมารับดวงต่อ',
    buttonUri: liffUrl,
    note: 'ดวงเกิดของคุณยังอยู่ครบ กลับมาเมื่อไหร่ก็ส่งต่อได้เลยค่ะ',
  }));
}

// 0) Welcome ตอนแอดเพื่อน — นำด้วย "ฟรี" ล้วน (ปุ่มเดียว) เพื่อดันให้คนกรอกวันเกิด
// ไม่โชว์ราคา/ปุ่มสมัครตรงนี้ — upsell 399 ไปเกิดหลังเขาเห็นดวงฟรีของตัวเองแล้ว (แปลงดีกว่า)
function welcomeCard(liffUrl) {
  return msg('🎁 รับพื้นดวงส่วนตัวฟรี — รู้จักดวงจันทร์/ลัคนาของคุณ', {
    type: 'bubble',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: PURPLE, paddingAll: '20px',
      contents: [
        { type: 'text', text: 'PRINNIE333 · ยินดีต้อนรับ', color: GOLD, size: 'xs', weight: 'bold' },
        { type: 'text', text: 'ดวงจันทร์คุณ อยู่ราศีไหน? 🌙', color: '#FFFFFF', size: 'xl', weight: 'bold', wrap: true, margin: 'sm' },
      ],
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: '18px', spacing: 'sm', backgroundColor: '#FBF8FF',
      contents: [
        { type: 'text', text: 'กรอกแค่ “วันเกิด” แล้วรับ พื้นดวงส่วนตัว ฟรีทันที 🎁', size: 'sm', color: INK, weight: 'bold', wrap: true },
        { type: 'text', text: 'คำนวณจากวันเกิดจริงของคุณ ไม่ใช่ดวง 12 ราศีทั่วไปที่ใครก็อ่านได้', size: 'sm', color: INK, wrap: true },
        { type: 'separator', margin: 'md', color: '#E7DCF5' },
        { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: [
          { type: 'text', text: '☀️  อาทิตย์ — ตัวตนของคุณ', size: 'sm', color: INK, wrap: true },
          { type: 'text', text: '🌙  จันทร์ — อารมณ์ลึก ๆ ของคุณ', size: 'sm', color: INK, wrap: true },
          { type: 'text', text: '⬆️  ลัคนา  ·  🔢  เลขชีวิต', size: 'sm', color: INK, wrap: true },
        ] },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm', backgroundColor: '#FBF8FF',
      contents: [
        { type: 'button', style: 'primary', color: GOLD, height: 'sm',
          action: { type: 'uri', label: '🎁 รับพื้นดวงฟรี (30 วินาที)', uri: liffUrl } },
        { type: 'text', text: 'ฟรี ไม่มีค่าใช้จ่าย · กรอกแค่วันเกิดก็ดูได้เลย 💜', size: 'xxs', color: PURPLE_SOFT, align: 'center', wrap: true, margin: 'sm' },
      ],
    },
  });
}

module.exports = {
  welcomeCard, launchOffer, launchBig, launchVideo, upsellSubscribe, coupleTeaser, earlyBirdEnding,
  renewalSoon, renewalExpired, renewalWinback,
};
