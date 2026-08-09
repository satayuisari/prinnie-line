// จัดการตัวอินฟลูเอง (สร้าง / เปลี่ยนสถานะ / KPI) — ใช้ร่วมกันทั้งแดชบอร์ดและ CLI
// สถานะ: ACTIVE (ผูก attribution ใหม่ได้) · PAUSED (หยุดชั่วคราว) · OFF (ปิด)
// pause/off ไม่แตะข้อมูลย้อนหลัง — ค่าคอมและ attribution เดิมยังอยู่ครบเสมอ
const db = require('../db');
const audit = require('./affiliateAudit');

const STATUSES = ['ACTIVE', 'PAUSED', 'OFF'];
const PRICE = Number(process.env.SUB_PRICE_THB) || 399;

const BASE = (process.env.PUBLIC_BASE_URL
  || `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'prinnie-app-production.up.railway.app'}`).replace(/\/+$/, '');
const trackingUrl = code => `${BASE}/go?a=${code}`;

// รหัสในลิงก์: a-z0-9_- เท่านั้น (กัน injection + กัน URL เพี้ยน)
const clean = s => (typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) : '');

// ตั้งรหัสอัตโนมัติจากชื่อ — ชื่อไทยแปลงเป็น a-z ไม่ได้ จึงถอยไปใช้ aff + เลขสุ่ม
async function suggestCode(name) {
  let base = clean((name || '').replace(/\s+/g, ''));
  if (base.length < 3) base = 'aff' + Math.random().toString(36).slice(2, 7);
  let code = base;
  for (let i = 2; (await db.query('SELECT 1 FROM affiliates WHERE code=$1', [code])).rows.length; i++) {
    code = `${base}${i}`.slice(0, 24);              // ชนกันก็ต่อเลขไปเรื่อย ๆ
  }
  return code;
}

async function create({ name, code, note = '', actor = 'admin' }) {
  name = (name || '').trim();
  if (!name) throw new Error('ต้องมีชื่ออินฟลู');
  code = clean(code) || await suggestCode(name);
  if (code.length < 3) throw new Error('รหัสสั้นเกินไป (อย่างน้อย 3 ตัว a-z0-9)');
  const dup = (await db.query('SELECT code FROM affiliates WHERE code=$1', [code])).rows[0];
  if (dup) throw new Error(`รหัส ${code} ถูกใช้แล้ว`);
  const row = (await db.query(
    `INSERT INTO affiliates (code, name, note, active, status) VALUES ($1,$2,$3,TRUE,'ACTIVE')
     RETURNING code, name, status, to_char(created_at,'YYYY-MM-DD') created`,
    [code, name, note])).rows[0];
  await audit.log('AFFILIATE_CREATED', { actor, entityType: 'affiliate', entityId: code, newValue: name });
  return { ...row, url: trackingUrl(row.code) };
}

// เปลี่ยนสถานะ — คง active ให้ตรงกับ status เสมอ (โค้ดเดิมอ่าน active อยู่หลายที่)
async function setStatus(code, status, { actor = 'admin', reason = null } = {}) {
  code = clean(code);
  if (!STATUSES.includes(status)) throw new Error('สถานะไม่ถูกต้อง');
  const before = (await db.query('SELECT status FROM affiliates WHERE code=$1', [code])).rows[0];
  if (!before) throw new Error('ไม่พบอินฟลูรหัสนี้');
  await db.query('UPDATE affiliates SET status=$2, active=$3 WHERE code=$1',
    [code, status, status === 'ACTIVE']);
  const event = status === 'ACTIVE' ? 'AFFILIATE_ACTIVATED' : status === 'PAUSED' ? 'AFFILIATE_PAUSED' : 'AFFILIATE_OFF';
  await audit.log(event, { actor, entityType: 'affiliate', entityId: code, oldValue: before.status, newValue: status, reason });
  return { code, status, from: before.status };
}

// KPI ต่ออินฟลู — ทุกตัวเลขมาจาก ledger (paid = ลูกค้าใหม่ที่จ่ายจริงครั้งแรก ไม่ใช่จำนวนออเดอร์)
// สำคัญ: pre-aggregate ทุก subquery ก่อน join ไม่งั้น SUM พองตามจำนวนแถวที่คูณกัน
async function performance() {
  const rows = (await db.query(`
    SELECT a.code, a.name, a.status,
      to_char(a.created_at,'YYYY-MM-DD') created,
      COALESCE(c.clicks,0)::int          clicks,
      COALESCE(s.registered,0)::int      registered,
      COALESCE(m.paid,0)::int            paid,
      COALESCE(m.reversed,0)::int        reversed,
      COALESCE(m.revenue,0)::int         revenue,
      COALESCE(m.pending_amt,0)::int     pending_amt,
      COALESCE(m.approved_amt,0)::int    approved_amt,
      COALESCE(m.paid_amt,0)::int        paid_amt,
      COALESCE(m.reversed_amt,0)::int    reversed_amt
    FROM affiliates a
    LEFT JOIN (SELECT REPLACE(source,'a:','') code, SUM(clicks) clicks
               FROM channel_clicks WHERE source LIKE 'a:%' GROUP BY 1) c ON c.code = a.code
    LEFT JOIN (SELECT affiliate_code, COUNT(*) registered
               FROM line_subscribers WHERE chart_data IS NOT NULL AND affiliate_code IS NOT NULL
               GROUP BY 1) s ON s.affiliate_code = a.code
    LEFT JOIN (SELECT affiliate_code,
                 COUNT(*) FILTER (WHERE status<>'REVERSED')                  paid,
                 COUNT(*) FILTER (WHERE status='REVERSED')                   reversed,
                 COALESCE(SUM(revenue_amount) FILTER (WHERE status<>'REVERSED'),0) revenue,
                 COALESCE(SUM(amount) FILTER (WHERE status='PENDING'),0)     pending_amt,
                 COALESCE(SUM(amount) FILTER (WHERE status='APPROVED'),0)    approved_amt,
                 COALESCE(SUM(amount) FILTER (WHERE status='PAID'),0)        paid_amt,
                 COALESCE(SUM(amount) FILTER (WHERE status='REVERSED'),0)    reversed_amt
               FROM affiliate_commissions GROUP BY 1) m ON m.affiliate_code = a.code
    ORDER BY paid DESC, registered DESC, a.created_at DESC`)).rows;

  return rows.map(r => {
    const commissionTotal = r.pending_amt + r.approved_amt + r.paid_amt;   // ไม่รวม REVERSED (ตัดทิ้งแล้ว)
    return {
      ...r,
      url: trackingUrl(r.code),
      commission: commissionTotal,
      clickToReg: r.clicks ? Math.round(r.registered / r.clicks * 100) : 0,
      regToPaid: r.registered ? Math.round(r.paid / r.registered * 100) : 0,
      cac: r.paid ? Math.round(commissionTotal / r.paid) : 0,
      refundRate: (r.paid + r.reversed) ? Math.round(r.reversed / (r.paid + r.reversed) * 100) : 0,
    };
  });
}

async function get(code) {
  const all = await performance();
  return all.find(a => a.code === clean(code)) || null;
}

async function list() {
  return (await db.query(
    `SELECT code, name, status, note, to_char(created_at,'YYYY-MM-DD') created
     FROM affiliates ORDER BY created_at DESC`)).rows.map(r => ({ ...r, url: trackingUrl(r.code) }));
}

module.exports = { create, setStatus, performance, get, list, suggestCode, trackingUrl, clean, STATUSES, PRICE, BASE };
