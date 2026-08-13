// อนุมัติออเดอร์ที่จ่ายแล้ว → เปิดใช้งาน (ใช้ร่วมกันทั้ง staff กดอนุมัติ + SlipOK auto)
// subscription → +30 วัน + แจ้งลูกค้า ; couple → ปลดล็อกดวงคู่ (ครั้งเดียว) ไม่ให้ 30 วัน
// idempotent: markPaid claim ก่อน คืน {ok, already, couple, expire}
const orders = require('./paymentOrders');
const subscribers = require('./subscriberService');
const couplePurchase = require('./couplePurchase');
const lineMessaging = require('./lineMessaging');
const commission = require('./affiliateCommission');
const loyalty = require('./loyaltyReward');

// ให้สิทธิ์ Ask Prinnie 3 ทันทีที่จ่ายครบเกณฑ์ + แจ้งลูกค้าเป็นข้อความส่วนตัว
// ปิดโดยดีฟอลต์: ต้องตั้ง LOYALTY_ENABLED=true (Bon เปิดเองเมื่อกำหนด capacity เสร็จ)
// ให้สิทธิ์ก่อน ค่อยส่งข้อความ — ส่งไม่ผ่านลูกค้าไม่เสียสิทธิ์
async function grantLoyaltyIfDue(line_user_id) {
  if (process.env.LOYALTY_ENABLED !== 'true') return null;
  const row = await loyalty.grant(line_user_id);
  if (!row) return null;
  const sub = await subscribers.getByLineUserId(line_user_id).catch(() => null);
  const askUrl = (process.env.PUBLIC_BASE_URL
    || 'https://prinnie-app-production.up.railway.app').replace(/\/$/, '') + '/ask.html';
  await lineMessaging.pushText(line_user_id,
    loyalty.grantMessage(sub && sub.nickname, askUrl)).catch(() => {});
  await loyalty.markNotified(row.id).catch(() => {});
  console.log(`[loyalty] ให้สิทธิ์ ${loyalty.REWARD_NAME} → ${line_user_id.slice(0, 10)}…`);
  return row;
}

async function approve(order, chargeRef) {
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === 'PAID') return { ok: true, already: true };
  if (!(await orders.markPaid(order.ref, chargeRef || 'manual'))) return { ok: true, already: true };

  if (order.type === 'couple') {
    await couplePurchase.fulfill({ ...order, status: 'PAID' }).catch(e => console.error('[approve] couple:', e.message));
    return { ok: true, couple: true };
  }

  const r = await subscribers.activateSubscription(order.line_user_id, order.ref, 30);
  // ค่าคอมอินฟลู: เฉพาะ subscription + จ่ายจริงครั้งแรก (renew ไม่ได้เพิ่ม) — ไม่ให้พังการเปิดสมาชิก
  await commission.recordFirstPaid(order.line_user_id, order.ref).catch(e => console.error('[approve] commission:', e.message));
  // สิทธิ์ Ask Prinnie 3: ครบเกณฑ์ปุ๊บได้ปั๊บ ไม่ต้องรอสิ้นเดือน (scheduler เป็นแค่ตาข่ายกันตกรอบ)
  await grantLoyaltyIfDue(order.line_user_id).catch(e => console.error('[approve] loyalty:', e.message));
  const expTH = new Date(r.expire_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  await lineMessaging.pushText(order.line_user_id,
    `ชำระเงินสำเร็จ! ✨\n\nสมาชิก Prinnie333 ของคุณใช้ได้ถึง ${expTH}\nรับดวงประจำวันทุกเช้า 08:00 น. 🌟`).catch(() => {});
  return { ok: true, expire: r.expire_date };
}

module.exports = { approve };
