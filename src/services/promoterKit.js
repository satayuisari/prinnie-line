// ชุดของให้อินฟลูเอาไปโพสต์ + ข้อความทาบทาม + รายงานผลงาน
// ทุกอย่างเป็น "ข้อความก๊อปได้" — V1 ไม่มี portal ให้อินฟลูล็อกอิน Bon ส่งเองทาง LINE/IG/TikTok
const db = require('../db');
const affiliates = require('./affiliates');
const commission = require('./affiliateCommission');

const CPA = commission.BASE_CPA;
const COMMISSION_RULE = `${CPA} บาท / ลูกค้าใหม่ที่ชำระเงินจริงครั้งแรก`;

// ข้อความทาบทามเริ่มต้น (แอดมินแก้ได้จากแดชบอร์ด แล้วเก็บลง app_settings)
const DEFAULT_OUTREACH = `สวัสดีครับ เห็นคอนเทนต์ของคุณแล้วคิดว่ากลุ่มผู้ติดตามค่อนข้างตรงกับ Prinnie ซึ่งเป็นบริการดูดวงผ่าน LINE

ตอนนี้เราเปิด Affiliate Partner รุ่นแรกครับ

มีลิงก์เฉพาะให้แต่ละ Partner ระบบนับตั้งแต่คนคลิก → สมัคร → ชำระเงินจริง

ค่าตอบแทน ${CPA} บาท / ลูกค้าใหม่ที่ชำระเงินจริงครั้งแรก

ทางเรามี Link / Creative / Caption ให้พร้อม สามารถทดลองทำได้โดยไม่มีค่าใช้จ่ายครับ`;

const OUTREACH_KEY = 'affiliate_outreach_template';

async function getOutreach() {
  const r = await db.query('SELECT value FROM app_settings WHERE key=$1', [OUTREACH_KEY]).catch(() => ({ rows: [] }));
  return r.rows[0]?.value || DEFAULT_OUTREACH;
}

async function setOutreach(text) {
  const value = String(text || '').trim().slice(0, 4000);
  if (!value) throw new Error('ข้อความว่าง');
  await db.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [OUTREACH_KEY, value]);
  return value;
}

// ชุด caption/CTA ให้อินฟลูเอาไปใช้ได้เลย — เว้นที่ใส่ลิงก์เฉพาะของแต่ละคน
function captions(url) {
  return {
    short: `ลองดูดวงกับ Prinnie ดู แม่นแบบไม่ต้องทักไปถามใคร
เช็กดวงรายวัน ไพ่ทาโรต์ ดวงคู่ ครบใน LINE
${url}`,
    long: `ช่วงนี้มีคนถามเรื่องดูดวงเยอะมาก เลยขอแนะนำ Prinnie

เป็นบริการดูดวงผ่าน LINE ที่ผูกดวงกำเนิดจริงจากวันเวลาเกิด
- ดวงรายวันส่งให้ทุกเช้า
- ไพ่ทาโรต์ + พื้นดวง + ดวงคู่
- ไม่ต้องรอคิว ไม่ต้องทักไปถามใคร

ใครอยากลอง กดลิงก์นี้ได้เลย
${url}`,
    cta: [
      `กดลิงก์ในไบโอ เช็กดวงวันนี้ได้เลย`,
      `ทักไปลองก่อนได้ ไม่ต้องจ่ายตอนแรก`,
      `ใครเกิดเดือนนี้ ลองเช็กดูว่าดวงเปลี่ยนยังไง`,
      `ลิงก์อยู่ในคอมเมนต์แรกนะ`,
    ],
  };
}

// ของสำหรับอินฟลู 1 คน (โชว์ในแดชบอร์ด + ปุ่มก๊อปทั้งชุด)
async function kit(code) {
  const a = await affiliates.get(code);
  if (!a) throw new Error('ไม่พบอินฟลู');
  const cap = captions(a.url);
  return {
    name: a.name, code: a.code, status: a.status, url: a.url,
    rule: COMMISSION_RULE,
    captions: cap,
    // V1 ยังไม่มีไฟล์ครีเอทีฟจริงในระบบ — ใส่ที่อยู่ไฟล์ในโปรเจกต์ให้ Bon แนบเองก่อน
    creatives: [
      'โปสเตอร์/การ์ดโปรโมท: marketing/ (build ด้วย scripts/build-poster.js)',
      'คลิปสั้น 9:16: video/ (build ด้วย scripts/promo-reel.js)',
      'QR ลิงก์เฉพาะ: สร้างจาก URL ด้านบนได้เลย',
    ],
    text: [
      `Prinnie Affiliate Kit`,
      ``,
      `ชื่อ: ${a.name}`,
      `รหัส: ${a.code}`,
      `ลิงก์ติดตามผล: ${a.url}`,
      `ค่าตอบแทน: ${COMMISSION_RULE}`,
      ``,
      `— แคปชั่นสั้น —`,
      cap.short,
      ``,
      `— แคปชั่นยาว —`,
      cap.long,
      ``,
      `— CTA ให้เลือกใช้ —`,
      ...cap.cta.map(c => `• ${c}`),
      ``,
      `หมายเหตุ: ระบบนับผลจากลิงก์เฉพาะของคุณเท่านั้น (คลิก → สมัคร → ชำระเงินจริง)`,
    ].join('\n'),
  };
}

// รายงานผลงานให้ส่งอินฟลู — ก๊อปแล้วส่งได้เลย
async function report(code) {
  const a = await affiliates.get(code);
  if (!a) throw new Error('ไม่พบอินฟลู');
  const today = new Date().toLocaleDateString('th-TH');
  const created = a.created || '-';
  return [
    `Prinnie Affiliate Report`,
    ``,
    `ชื่อ: ${a.name}`,
    `ช่วงวันที่: ${created} – ${today}`,
    ``,
    `Clicks: ${a.clicks}`,
    `Registrations: ${a.registered}`,
    `First Paid: ${a.paid}`,
    `Revenue: ${a.revenue.toLocaleString()} บาท`,
    `Commission Pending: ${a.pending_amt.toLocaleString()} บาท`,
    `Commission Approved: ${a.approved_amt.toLocaleString()} บาท`,
    `Commission Paid: ${a.paid_amt.toLocaleString()} บาท`,
    ``,
    `Conversion:`,
    `Click → Register: ${a.clickToReg}%`,
    `Register → Paid: ${a.regToPaid}%`,
  ].join('\n');
}

module.exports = { kit, report, captions, getOutreach, setOutreach, DEFAULT_OUTREACH, COMMISSION_RULE, OUTREACH_KEY };
