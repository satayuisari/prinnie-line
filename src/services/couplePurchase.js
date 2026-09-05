// ปลดล็อกดวงคู่ (หลังชำระเงินสำเร็จ) — คำนวณดวงคู่จากข้อมูลใน order.payload แล้ว push ผลเต็ม
// เรียกจากขั้นตอน staff อนุมัติสลิป (PromptPay) บน dashboard
const subscribers   = require('./subscriberService');
const synastry      = require('./synastryService');
const geocoding     = require('./geocodingService');
const lineMessaging = require('./lineMessaging');
const { computeNatalChart } = require('../astro/natalChart');

const LIFF_URL = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}`
  : 'https://liff.line.me/YOUR_LIFF_ID';

async function fulfill(order) {
  const m  = order.payload || {};
  const me = await subscribers.getByLineUserId(order.line_user_id);
  if (!me || !me.chart_data) return false;

  let lat = m.lat != null ? Number(m.lat) : null;
  let lng = m.lng != null ? Number(m.lng) : null;
  if ((lat == null || lng == null) && m.birth_place) {
    const g = await geocoding.geocode(m.birth_place);
    lat = g.lat; lng = g.lng;
  }
  const partnerChart = computeNatalChart({ date: m.birth_date, time: m.birth_time || null, lat, lng });
  const reading = await synastry.synastryReading(me.chart_data, partnerChart);

  await lineMessaging.pushText(order.line_user_id, synastry.formatFull(reading, m.partner_name));
  await lineMessaging.pushText(order.line_user_id,
    `อยากดูดวงคู่ไม่จำกัด + รับดวงรายวันส่วนตัวทุกเช้าไหม? ✨\nสมาชิก Prinnie333 เพียง 399 บาท/เดือน\n\n👉 ${LIFF_URL}`);
  return true;
}

module.exports = { fulfill };
