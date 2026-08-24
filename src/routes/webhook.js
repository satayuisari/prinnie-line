const line        = require('@line/bot-sdk');
const subscribers = require('../services/subscriberService');
const horoscope   = require('../services/horoscopeService');
const { replyMessage, isAllowed, TEST_MODE, client, getMessageContent, notifyAdmins } = require('../services/lineMessaging');
const slipVerify     = require('../services/slipVerify');
const paymentApprove = require('../services/paymentApprove');
const dailyTeaser    = require('../services/dailyTeaser');
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

// คนเยอะพิมพ์ "วันเกิด" เข้าแชทตรง ๆ (นึกว่าบอกบอทได้) — ระบบคำนวณจากข้อความไม่ได้
// ดักไว้แล้วพาไปกรอกฟอร์ม (แก้ปัญหาหลังเปิดตัว: คนงงว่าทำไมไม่ได้ดวง)
const TH_MONTH_RE = /(มกรา|กุมภา|มีนา|เมษา|พฤษภา|มิถุนา|กรกฎา|สิงหา|กันยา|ตุลา|พฤศจิกา|ธันวา|ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค)/;
function looksLikeBirthData(t) {
  if (/(วันเกิด|เวลาเกิด|สถานที่เกิด|เกิดวันที่|วันที่เกิด|เกิดปี|เกิดเมื่อ|เกิดวัน)/.test(t)) return true;
  if (TH_MONTH_RE.test(t)) return true;                                  // ชื่อเดือนไทย
  if (/(?:^|\D)(19\d{2}|20\d{2}|25\d{2})(?:\D|$)/.test(t)) return true;   // ปี ค.ศ./พ.ศ.
  if (/\d{1,2}\s*[/.\-]\s*\d{1,2}\s*[/.\-]\s*\d{2,4}/.test(t)) return true; // 12/05/2530
  return false;
}
const BIRTH_GUIDE = (liff) =>
  `ขอบคุณที่สนใจนะคะ 🌙\nดวงส่วนตัวต้อง “กรอกวันเกิดในฟอร์ม” ก่อนนะคะ — พิมพ์ในแชทระบบยังคำนวณให้ไม่ได้ค่ะ\n\n👉 กรอกที่นี่เลย: ${liff}\n\nกรอกเสร็จรับพื้นดวงส่วนตัวฟรีทันที (อาทิตย์ · จันทร์ · ลัคนา) ✨`;

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
    if (!order) {
      // รูปแต่ไม่มีออเดอร์ค้าง — ไม่กวนแอดมิน (ส่วนใหญ่รูปทั่วไป/สติกเกอร์/ยังไม่กดสมัคร)
      // แค่ชี้ทางให้คนที่ยังไม่จ่าย กดสมัครก่อน — คนที่โอนจริงจะกดสมัครแล้วส่งสลิปใหม่เอง
      const sub = await subscribers.getByLineUserId(event.source.userId).catch(() => null);
      const active = sub && sub.subscribe_end && new Date(sub.subscribe_end) > new Date();
      if (sub && !active) {
        return replyMessage(event.replyToken, { type: 'text', text:
          'ถ้าต้องการสมัครสมาชิก รบกวนกดเมนู "สมัครสมาชิก" เพื่อรับ QR ก่อนนะคะ\nโอนแล้วค่อยส่งสลิปกลับมาในแชทนี้ ระบบจะเปิดใช้งานให้อัตโนมัติค่ะ ✨' });
      }
      return;   // รูปทั่วไปของคน active/ไม่รู้จัก = เงียบ
    }
    const what = order.type === 'couple' ? 'ปลดล็อกดวงคู่' : 'เปิดใช้งานสมาชิก';
    const amount = order.amount / 100;

    // ✅ ตรวจสลิปอัตโนมัติด้วย SlipOK → เงินเข้าจริง + ยอดถูก = เปิดใช้งานทันที ไม่ต้องรอ staff
    if (slipVerify.isEnabled()) {
      const buf = await getMessageContent(event.message.id);
      const v = buf ? await slipVerify.verify(buf, amount) : { ok: false, reason: 'ดึงรูปสลิปไม่ได้ (LINE content หมดอายุ)' };
      if (v.ok && Math.abs(v.amount - amount) < 1) {
        await paymentApprove.approve(order, 'slipok-' + (v.ref || Date.now())).catch(e => console.error('[slip] approve:', e.message));
        return replyMessage(event.replyToken, { type: 'text', text:
          `✅ ยืนยันการชำระเงินอัตโนมัติเรียบร้อย ${what}ให้แล้วค่ะ 🎉` });
      }
      console.warn(`[slip] ตรวจไม่ผ่าน ${order.ref}: ${v.reason} (code ${v.code || '-'})`);

      // รูปมั่ว/อ่าน QR ไม่ออก → ไม่กวนแอดมิน แค่ให้ลูกค้าส่งใหม่ (คนส่งรูปมั่วเยอะ = noise)
      if (v.qrReadable === false) {
        return replyMessage(event.replyToken, { type: 'text', text:
          'รูปนี้ยังอ่านไม่ออกนะคะ 🙏 รบกวนส่ง "สลิปการโอนเต็มใบ" ที่เห็น QR ชัด ๆ (แคปหน้าจอจากแอปธนาคารได้เลย) แล้วระบบจะเปิดให้อัตโนมัติค่ะ ✨' });
      }

      // บางธนาคาร (เช่น กรุงเทพ) ต้องรอ ~7 นาทีหลังโอนถึงจะตรวจสลิปได้
      // ไม่ใช่ความผิดลูกค้าและไม่ใช่สลิปซ้ำ → บอกตามจริง แล้วให้ระบบตรวจซ้ำเองทีหลัง
      // (scheduler/slipRecheck.js ไล่ตรวจให้ ลูกค้าไม่ต้องส่งใหม่)
      if (v.retryLater) {
        return replyMessage(event.replyToken, { type: 'text', text:
          `ได้รับสลิปแล้วค่ะ ✨\nสลิปของธนาคารนี้ต้องรอประมาณ 7 นาทีหลังโอน ระบบถึงจะตรวจได้\n` +
          `ไม่ต้องส่งซ้ำนะคะ เดี๋ยวระบบตรวจให้อัตโนมัติแล้ว${what}ให้เลยค่ะ 🙏` });
      }

      // สลิปจริงแต่มีปัญหา (ซ้ำ/ยอดไม่ตรง/error) → เงินอาจเข้าจริง ต้องคนเช็ก = เตือนแอดมิน
      const name = await lineClient_safeProfile(event.source.userId).catch(() => '');
      notifyAdmins(`⚠️ สลิปตรวจอัตโนมัติไม่ผ่าน — ต้องเช็กมือ\nลูกค้า: ${name || '-'}\nรายการ: ${what} ${amount}฿ (${order.ref})\nสาเหตุ: ${v.reason}${v.dup ? ' (สลิปซ้ำ)' : ''}\n👉 เข้า dashboard กดดูสลิป → อนุมัติ`).catch(() => {});
      const detail = v.dup ? ' (สลิปนี้เคยใช้ไปแล้วนะคะ หากโอนใหม่ส่งสลิปล่าสุดมาได้เลยค่ะ)' : '';
      return replyMessage(event.replyToken, { type: 'text', text:
        `ได้รับสลิปแล้วค่ะ ✨${detail}\nทีมงานกำลังตรวจสอบการชำระเงิน จะ${what}ให้เร็วที่สุดนะคะ 🙏` });
    }

    // ไม่มี SlipOK → รอ staff อนุมัติ + เตือนแอดมิน
    const name = await lineClient_safeProfile(event.source.userId).catch(() => '');
    notifyAdmins(`🧾 มีสลิปเข้ารอตรวจ\nลูกค้า: ${name || '-'}\nรายการ: ${what} ${amount}฿ (${order.ref})\n👉 เข้า dashboard กดดูสลิป → อนุมัติ`).catch(() => {});
    return replyMessage(event.replyToken, { type: 'text', text:
      `ได้รับสลิปแล้วค่ะ ✨\nทีมงานกำลังตรวจสอบการชำระเงิน จะ${what}ให้ภายใน 24 ชม. แล้วแจ้งกลับนะคะ 🙏` });
  }

  // ปุ่ม rich menu ส่ง postback / ข้อความพิมพ์ → เดาเจตนา
  //   ครอบคลุมทุกฟีเจอร์ (ลูกค้าพิมพ์ "ดูดวงรายเดือน" แล้วบอทเงียบ = ดูพัง — feedback 13/07)
  //   ข้อความอื่น → เงียบ (return) ให้ AI/พนักงานตอบ ไม่ให้บอทแย่งตอบ
  let action = null;
  if (event.type === 'postback') {
    action = new URLSearchParams(event.postback.data).get('action');
  } else if (event.type === 'message' && event.message.type === 'text') {
    const t = (event.message.text || '').trim();
    // เฉพาะข้อความสั้นแบบสั่งงาน — ประโยคยาว = คำถามจริง ปล่อยให้ AI/staff ตอบ
    if (t.length <= 30) {
      if (/รายสัปดาห|ดวงสัปดาห|สัปดาห์นี้/.test(t)) action = 'weekly';
      else if (/รายเดือ|ดวงเดือน|เดือนนี้|ประจำเดือน/.test(t)) action = 'monthly';   // "รายเดือ" กัน typo เช่น "รายเดือร"
      else if (/รายปี|ดวงปี|ปีนี้|ประจำปี/.test(t)) action = 'annual';
      else if (/รายวัน|ดวงวันนี้|^วันนี้$|^ดูดวง$|^ดวง$/.test(t)) action = 'daily';
      else if (/พื้นดวง|ดวงกำเนิด|ลัคนา/.test(t)) action = 'natal';
      else if (/ไพ่|ทาโร/.test(t)) action = 'tarot';
      else if (/โปรไฟล์|แก้ไขข้อมูล|ข้อมูลของฉัน/.test(t)) action = 'profile';
      else if (/คู่|ผูกดวง|ความรัก|แฟน/.test(t)) action = 'synastry';
      else if (/ช่วยเหลือ|วิธีใช้|เมนู|help|สวัสดี|hello|hi|^\?+$/i.test(t)) action = 'help';
    }
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

    // 🔔 เตือนแอดมินเมื่อลูกค้าติดปัญหาจริง — หมวดเร่งด่วน (อารมณ์/โกรธ/ร้องเรียน/การเงิน)
    // ไม่เตือนหมวดทั่วไป (ถามดวงเฉย ๆ) กัน spam · ตัดข้อความยาวไว้พอเห็น context
    const { priority: pr, category: cat } = triage.classify(text);
    if (pr === 'high') {
      const catTH = { emotional: 'ต้องการกำลังใจ 💛', angry: 'ไม่พอใจ/ร้องเรียน 🔴', payment: 'เรื่องเงิน/สมัคร 💰' }[cat] || cat;
      notifyAdmins(`🔔 ลูกค้าทักเรื่องด่วน (${catTH})\nชื่อ: ${name || '-'}\nid: ${event.source.userId}\n💬 "${text.slice(0, 150)}"\n👉 ตอบใน dashboard`).catch(() => {});
    }

    // 🎂 พิมพ์วันเกิดเข้าแชท → พาไปกรอกฟอร์ม (ก่อน AI จะได้ไม่ตอบมั่ว) — เฉพาะคนที่ยังไม่มีดวง
    if (looksLikeBirthData(text)) {
      const sub = await subscribers.getByLineUserId(event.source.userId).catch(() => null);
      if (!sub || !sub.chart_data) {
        const guide = BIRTH_GUIDE(LIFF_URL);
        if (id) await supportInbox.markAutoReplied(id, guide).catch(() => {});
        return replyMessage(event.replyToken, { type: 'text', text: guide });
      }
    }

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
    if (!active) {
      // กดดูดวงวันนี้: วันแรกให้ "ดวงเต็มฟรี 1 วัน" (รวมทุกเรื่อง) → หลังจากนั้น teaser ล็อก
      if (action === 'daily') {
        try {
          const free = await subscribers.claimFreeDaily(sub.line_user_id);
          return replyMessage(event.replyToken,
            await dailyTeaser.buildCombined('daily', sub.chart_data, sub.nickname, new Date(),
              free ? { freeDay: true, userId: sub.line_user_id } : { locked: true, userId: sub.line_user_id }));
        } catch (_) { return replyMessage(event.replyToken, PAYWALL_PROMPT); }
      }
      // สัปดาห์/เดือน/ปี สำหรับคนยังไม่จ่าย → teaser ล็อก (แยกงาน/รัก/เงิน)
      try {
        return replyMessage(event.replyToken,
          await dailyTeaser.buildCombined(action, sub.chart_data, sub.nickname, new Date(), { locked: true, userId: sub.line_user_id }));
      } catch (_) { return replyMessage(event.replyToken, PAYWALL_PROMPT); }
    }
  }

  try {
    switch (action) {
      case 'daily': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        return replyMessage(event.replyToken, await dailyTeaser.buildCombinedDaily(sub.chart_data, sub.nickname, new Date(), { userId: sub.line_user_id }));
      }
      case 'weekly':
      case 'monthly':
      case 'annual': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        return replyMessage(event.replyToken, await dailyTeaser.buildCombined(action, sub.chart_data, sub.nickname, new Date(), { userId: sub.line_user_id }));
      }
      case 'natal': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        const reading = await horoscope.natalReading(sub.chart_data);
        return replyMessage(event.replyToken, { type: 'text', text: formatNatal(reading) });
      }
      case 'tarot': {
        if (!sub || !sub.chart_data) return replyMessage(event.replyToken, SIGNUP_PROMPT);
        // ไพ่ฉลาด: ใบเดียวกับที่ได้ใน push เช้าวันนั้น (จำต่องวด ไม่สุ่มใหม่ทุกครั้งที่กด)
        const t = await horoscope.smartTarot({ userId: sub.line_user_id, period: 'daily', date: new Date() });
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
        // แนบปุ่มช่วงเวลาให้กดต่อได้ทันที (ลูกค้าหาดวงรายสัปดาห์/เดือน/ปีไม่เจอ — feedback 13/07)
        return replyMessage(event.replyToken, {
          type: 'text',
          text: `📖 วิธีใช้งาน Prinnie333\n\n• ☀️ ดูดวงวันนี้ — พิมพ์ "รายวัน"\n• 📅 ดวงรายสัปดาห์ — พิมพ์ "รายสัปดาห์"\n• 🗓️ ดวงรายเดือน — พิมพ์ "รายเดือน"\n• ✨ ดวงรายปี — พิมพ์ "รายปี"\n• 🌟 พื้นดวง — ดวงกำเนิดของคุณ\n• 🃏 ไพ่ทาโรต์ — ไพ่ประจำวัน\n• 💞 ผูกดวงคู่ — ดูดวงความเข้ากันกับคนพิเศษ\n• 💎 สมัคร/ต่ออายุ/แก้ไขข้อมูล — ${LIFF_URL}\n\nกดปุ่มด้านล่างได้เลยค่ะ 👇 ดวงจะส่งอัตโนมัติทุกเช้า 08:00 น.\n\n💜 มีคำถามเพิ่มเติม พิมพ์ทักแชทได้เลย ทีมงานยินดีช่วยดูแลค่ะ`,
          quickReply: PERIOD_QR,
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
