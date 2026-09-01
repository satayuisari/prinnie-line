// อนุมัติออเดอร์ที่จ่ายแล้ว → เปิดใช้งาน (ใช้ร่วมกันทั้ง staff กดอนุมัติ + SlipOK auto)
// subscription → +30 วัน + แจ้งลูกค้า ; couple → ปลดล็อกดวงคู่ (ครั้งเดียว) ไม่ให้ 30 วัน
// idempotent: markPaid claim ก่อน คืน {ok, already, couple, expire}
const orders = require('./paymentOrders');
const subscribers = require('./subscriberService');
const couplePurchase = require('./couplePurchase');
const lineMessaging = require('./lineMessaging');
const commission = require('./affiliateCommission');

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
  // หมายเหตุ: สิทธิ์ดูดวงกับอาจารย์ไม่ผูกกับการจ่ายเงินอีกแล้ว
  // เปลี่ยนเป็น "ดวงเลือกคุณ" — คัดจากดาวจรทุกวันที่ 2 และ 17 (ดู scheduler/loyaltyRewards.js)
  const expTH = new Date(r.expire_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  await lineMessaging.pushText(order.line_user_id,
    `ชำระเงินสำเร็จ! ✨\n\nสมาชิก Prinnie333 ของคุณใช้ได้ถึง ${expTH}\nรับดวงประจำวันทุกเช้า 08:00 น. 🌟`).catch(() => {});
  return { ok: true, expire: r.expire_date };
}

module.exports = { approve };
