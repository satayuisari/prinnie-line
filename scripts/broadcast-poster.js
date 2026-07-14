// broadcast โปสเตอร์ + แคปชัน (มีเรื่องจ่าย+สลิป auto) เข้าบัญชีบริการ @prinnie333
require('dotenv').config();
const lm = require('../src/services/lineMessaging');

const BASE = (process.env.PUBLIC_BASE_URL || 'https://prinnie-app-production.up.railway.app').replace(/\/$/, '');
const POSTER = `${BASE}/promo-poster.jpg`;

const CAPTION =
`🌙 ดูดวงส่วนตัว ครบ จบ ในไลน์เดียว — Prinnie333

ไม่ใช่ดวง 12 ราศีทั่วไป แต่ดูจาก "ลัคนา + ดวงดาวจริง" ณ วัน เวลา สถานที่เกิดของคุณ
รู้จังหวะงาน เงิน ความรัก ว่าช่วงไหนควรเดินหน้า ชะลอ หรือระวัง 🔮

🎁 แอดแล้วรับดูดวงฟรี 1 คำถาม + พื้นดวงส่วนตัวฟรี

💳 สมัครสมาชิกง่ายมาก:
จ่ายเงินเสร็จ → ส่งสลิปเข้าไลน์นี้ → ระบบอนุมัติให้อัตโนมัติทันที ไม่ต้องรอค่ะ ✨`;

(async () => {
  await lm.broadcast([
    { type: 'image', originalContentUrl: POSTER, previewImageUrl: POSTER },
    { type: 'text', text: CAPTION },
  ]);
  console.log('✅ broadcast โปสเตอร์เข้าบัญชีบริการเรียบร้อย');
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
