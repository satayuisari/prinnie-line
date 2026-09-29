// ชุดของให้อินฟลูเอาไปโพสต์ + ข้อความทาบทาม + รายงานผลงาน
// ทุกอย่างเป็น "ข้อความก๊อปได้" — V1 ไม่มี portal ให้อินฟลูล็อกอิน Bon ส่งเองทาง LINE/IG/TikTok
const db = require('../db');
const affiliates = require('./affiliates');
const commission = require('./affiliateCommission');
const creative = require('./partnerCreative');

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
    // ไม่อ้างความแม่น — กฎพาร์ทเนอร์ข้อ 1 ห้ามอ้าง "แม่น 100%" แคปชั่นของเราเองก็ต้องไม่พาไปทางนั้น
    short: `ลองดูดวงกับ Prinnie ดู ดวงที่คำนวณจากวันเวลาเกิดของเราเอง
เช็กดวงรายวัน ไพ่ทาโรต์ ดวงคู่ ครบใน LINE
${url}`,
    long: `ช่วงนี้มีคนถามเรื่องดูดวงเยอะมาก เลยขอแนะนำ Prinnie

เป็นบริการดูดวงผ่าน LINE ที่ผูกดวงกำเนิดจริงจากวันเวลาเกิด
- ดวงรายวันส่งให้ทุกเช้า
- ไพ่ทาโรต์ + พื้นดวง + ดวงคู่
- ไม่ต้องรอคิว ไม่ต้องทักไปถามใคร

ใครอยากลอง กดลิงก์นี้ได้เลย
${url}`,
    // สำหรับพาร์ทเนอร์สายไลฟ์สไตล์/ความรัก ที่คนดูไม่ได้ตามเพราะเรื่องดวง (bon 29 ก.ย. 69)
    // เล่าจากมุมผู้ใช้คนหนึ่ง ไม่ใช้ศัพท์โหราศาสตร์ บอกสิ่งที่ได้ฟรีให้ชัด
    lifestyle: `ช่วงนี้ติดเปิดดวงตอนเช้าก่อนออกจากบ้าน 555
เป็นดวงที่คำนวณจากวันเวลาเกิดของเราเอง ไม่ใช่ดวงราศีแบบที่ทุกคนอ่านเหมือนกัน
สมัครสมาชิกแล้วส่งมาในไลน์ทุกเช้า อ่านแป๊บเดียวจบ (เดือนละ 399)

ที่ชอบคือมีผูกดวงคู่ ใส่วันเกิดเรากับแฟนแล้วดูคะแนนเข้ากันได้ฟรี
ใครอยากลอง กดลิงก์นี้ได้เลย เริ่มดูพื้นดวงของตัวเองได้ฟรี
${url}`,
    couple: `ใครอยากรู้ว่าเข้ากับเขาแค่ไหน ลองผูกดวงคู่ดู
ใส่วันเกิดของเรากับของเขา ดูคะแนนความเข้ากันได้ฟรีในไลน์
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
    // ภาพมี QR ลิงก์เฉพาะของคนนี้ฝังอยู่แล้ว — แดชบอร์ดโชว์ปุ่มดาวน์โหลดทีละไฟล์
    creatives: creative.list().map(c => ({ ...c, path: `/dashboard/affiliate/${a.code}/creative/${c.name}.png` })),
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
      `— แคปชั่นสายไลฟ์สไตล์ (คนดูไม่ได้ตามเรื่องดวง) —`,
      cap.lifestyle,
      ``,
      `— แคปชั่นผูกดวงคู่ —`,
      cap.couple,
      ``,
      `— CTA ให้เลือกใช้ —`,
      ...cap.cta.map(c => `• ${c}`),
      ``,
      `หมายเหตุ: ระบบนับผลจากลิงก์เฉพาะของคุณเท่านั้น (คลิก → สมัคร → ชำระเงินจริง)`,
      `รูปโพสต์/สตอรี่มี QR ลิงก์ของคุณฝังไว้แล้ว ใช้ได้เลย`,
      ``,
      `— สิ่งที่ห้ามทำ —`,
      `• ห้ามอ้างว่าแม่น 100% หรือรับประกันผล`,
      `• ห้ามใช้ความกลัวขาย เช่น ไม่ดูแล้วจะซวย`,
      `• ห้ามแอบอ้างเป็นอาจารย์ปรินนี่ หรือพูดแทนอาจารย์`,
      `• ห้ามสัญญาสิ่งที่เราไม่ได้ให้ เช่น คืนเงิน หรือดูดวงฟรีกับอาจารย์`,
      `• ห้ามยิงแอดโดยใช้ชื่อ Prinnie333 เป็นคีย์เวิร์ด`,
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
