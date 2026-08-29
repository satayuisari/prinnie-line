// ดึงรูปไพ่ทั้งหมดจาก Directus มาเก็บไว้ในโปรเจกต์ — รันได้ทันทีที่ data.prinnie333.com กลับมา
//
//   node scripts/fetch-tarot-images.js            ดึงที่ยังไม่มี (ข้ามที่โหลดแล้ว)
//   node scripts/fetch-tarot-images.js --force    ดึงใหม่ทั้งหมด
//   node scripts/fetch-tarot-images.js --check    เช็คว่าโฮสต์พร้อมไหม ไม่ดาวน์โหลด
//
// 🔴 ทำไมต้องมี (28 ส.ค. 69): รูปไพ่ 123 ใบอยู่บน data.prinnie333.com เครื่องเดียว
// ไม่มีสำเนาที่ไหนเลย เครื่องดับ = รูปในไลน์ขึ้นเป็นกรอบเสียทั้งระบบ
// เอาลงมาไว้กับโค้ดแล้ว deploy ไปพร้อมกัน จะไม่มีเครื่องที่สองให้ล่มอีก
//
// รายการ image_id อ่านจากไฟล์แบ็คอัพในเครื่อง (~/prinnie-backups/*.json) — ไม่ต้องพึ่ง DB ที่ล่ม

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST     = process.env.ASSET_HOST || 'https://data.prinnie333.com';
const OUT_DIR  = path.join(__dirname, '..', 'assets', 'tarot');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.homedir(), 'prinnie-backups');
const FORCE    = process.argv.includes('--force');
const CHECK    = process.argv.includes('--check');

const EXT = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
  'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif',
};

function newestBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'))
    .map(f => path.join(BACKUP_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

function cardsFromBackup(file) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const t = d.tables && d.tables.tarot;
  const rows = Array.isArray(t) ? t : (t && t.rows) || [];
  return rows.filter(r => r.image_id).map(r => ({ id: r.image_id, name: r.name || '', deck: r.deck || '' }));
}

async function hostUp() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${HOST}/server/health`, { signal: ctl.signal });
    clearTimeout(timer);
    return r.status < 500;      // 5xx รวม 522 ของ Cloudflare = ต้นทางยังไม่กลับมา
  } catch { return false; }
}

async function grab(card) {
  const r = await fetch(`${HOST}/assets/${card.id}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ext = EXT[(r.headers.get('content-type') || '').split(';')[0].trim()] || '.jpg';
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 512) throw new Error(`ไฟล์เล็กผิดปกติ (${buf.length} bytes) — น่าจะไม่ใช่รูป`);
  fs.writeFileSync(path.join(OUT_DIR, card.id + ext), buf);
  return { ext, bytes: buf.length };
}

(async () => {
  const backup = newestBackup();
  if (!backup) { console.error(`ไม่เจอไฟล์แบ็คอัพใน ${BACKUP_DIR}`); process.exit(1); }
  const cards = cardsFromBackup(backup);
  console.log(`แบ็คอัพ: ${path.basename(backup)}`);
  console.log(`ไพ่ที่มี image_id: ${cards.length} ใบ\n`);

  const up = await hostUp();
  console.log(`${HOST} → ${up ? '🟢 พร้อมแล้ว' : '🔴 ยังต่อไม่ได้'}`);
  if (CHECK) process.exit(up ? 0 : 1);
  if (!up) {
    console.error('\nยังดึงไม่ได้ — ต้องกู้เครื่องต้นทางให้ขึ้นก่อน แล้วรันคำสั่งนี้ซ้ำ');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const have = new Set(fs.readdirSync(OUT_DIR).map(f => f.replace(/\.[^.]+$/, '')));
  let ok = 0, skip = 0, fail = 0, bytes = 0;
  const failed = [];

  for (const [i, card] of cards.entries()) {
    const tag = `[${String(i + 1).padStart(3)}/${cards.length}]`;
    if (!FORCE && have.has(card.id)) { skip++; continue; }
    try {
      const r = await grab(card);
      ok++; bytes += r.bytes;
      console.log(`${tag} ✓ ${card.name.slice(0, 42).padEnd(44)} ${(r.bytes / 1024).toFixed(0)}KB`);
    } catch (e) {
      fail++; failed.push({ ...card, why: e.message });
      console.log(`${tag} ✗ ${card.name.slice(0, 42).padEnd(44)} ${e.message}`);
    }
  }

  console.log(`\nโหลดใหม่ ${ok} · มีอยู่แล้ว ${skip} · ล้มเหลว ${fail} · รวม ${(bytes / 1048576).toFixed(1)} MB`);
  console.log(`เก็บที่ ${path.relative(process.cwd(), OUT_DIR)}`);
  if (failed.length) {
    fs.writeFileSync(path.join(OUT_DIR, '_failed.json'), JSON.stringify(failed, null, 2));
    console.log(`ใบที่โหลดไม่ได้บันทึกไว้ที่ ${path.relative(process.cwd(), path.join(OUT_DIR, '_failed.json'))}`);
  }
  process.exit(fail && !ok ? 1 : 0);
})();
