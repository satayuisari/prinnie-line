// เฝ้าโฮสต์รูปไพ่ (data.prinnie333.com — Directus คนละเครื่องกับแอปนี้)
//
// 🔴 เหตุที่ต้องมี (28 ส.ค. 69): เครื่องนั้นดับ Cloudflare ตอบ 522 รูปไพ่ทุกใบจึงขึ้น
// เป็นกรอบเสียในแชทลูกค้า ทั้งที่ "ชื่อไพ่ + คำทำนาย" อยู่ในข้อความอยู่แล้ว
// ไม่ส่งรูปเลยดูเป็นปกติกว่าส่งรูปเสีย — ลูกค้าไม่เสียอะไร นอกจากภาพประกอบ
//
// ตรวจเป็นระยะในพื้นหลัง แล้วให้ isUp() อ่านค่าที่แคชไว้แบบ sync
// (จุดที่เรียกใช้เป็นฟังก์ชัน sync ทั้งหมด ไม่ต้องแก้ลายเซ็นให้ลามไปทั้งไฟล์)

const path = require('path');
const fs = require('fs');

const HOST = process.env.ASSET_HOST || 'https://data.prinnie333.com';
// การ์ดสำรองที่วาดไว้เอง เสิร์ฟจากแอปนี้ (assets/tarot-cards) — ไม่พึ่งเครื่องอื่น
const CARDS_DIR = path.join(__dirname, '..', '..', 'assets', 'tarot-cards');
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL
  || `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'prinnie-app-production.up.railway.app'}`).replace(/\/$/, '');
const PROBE_URL = `${HOST}/server/health`;
const EVERY_MS = 3 * 60 * 1000;
const TIMEOUT_MS = 5000;

let up = true;              // เริ่มที่ true — ยังไม่ได้ตรวจ อย่าเพิ่งตัดรูปทิ้ง
let lastChange = null;
let checked = false;

async function probe() {
  const before = up;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const r = await fetch(PROBE_URL, { signal: ctl.signal, redirect: 'manual' });
    clearTimeout(timer);
    // 5xx = ต้นทางมีปัญหา (รวม 520-527 ของ Cloudflare ที่แปลว่าต่อเข้าเครื่องจริงไม่ได้)
    // 401/403/404 ถือว่า "โฮสต์ยังอยู่" — แค่ path ตรวจสุขภาพไม่ตรง ไม่ใช่เครื่องดับ
    up = r.status < 500;
  } catch {
    up = false;             // ต่อไม่ติด / timeout / DNS พัง
  }
  checked = true;
  if (before !== up) {
    lastChange = new Date().toISOString();
    console[up ? 'log' : 'error'](
      up ? `[assetHost] ${HOST} กลับมาแล้ว — เริ่มแนบรูปไพ่อีกครั้ง`
         : `[assetHost] ${HOST} ต่อไม่ได้ — งดแนบรูปไพ่ชั่วคราว (ข้อความยังส่งครบ)`);
  }
  return up;
}

function isUp() { return up; }

// มีการ์ดสำรองของไพ่ใบนี้ไหม — เช็คไฟล์จริงบนดิสก์ แคชผลไว้ (ไฟล์ไม่เปลี่ยนระหว่างรัน)
let cardSet = null;
function hasCard(imageId) {
  if (cardSet === null) {
    try { cardSet = new Set(fs.readdirSync(CARDS_DIR).map(f => f.replace(/\.[^.]+$/, ''))); }
    catch { cardSet = new Set(); }
  }
  return cardSet.has(imageId);
}

// 🔑 กฎเลือกรูปไพ่ อยู่ที่เดียวทั้งระบบ:
//   โฮสต์ต้นฉบับใช้ได้ → ใช้รูปต้นฉบับของอาจารย์ (ดีที่สุดเสมอ)
//   โฮสต์ล่ม แต่มีการ์ดสำรอง → ใช้การ์ดสำรอง
//   ไม่มีทั้งคู่ → null แล้วให้คนเรียกข้ามการแนบรูปไป
function imageUrl(imageId) {
  if (!imageId) return null;
  if (up) return `${HOST}/assets/${imageId}`;
  return hasCard(imageId) ? `${PUBLIC_BASE}/tarot/${imageId}.jpg` : null;
}

function status() {
  return { host: HOST, up, checked, lastChange, cards: (cardSet || (hasCard(''), cardSet)).size };
}

function start() {
  probe().catch(() => {});
  const t = setInterval(() => probe().catch(() => {}), EVERY_MS);
  if (t.unref) t.unref();
  return t;
}

module.exports = { isUp, imageUrl, hasCard, status, probe, start, HOST, CARDS_DIR };
