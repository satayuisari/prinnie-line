// การ์ดไพ่ชั่วคราว — ใช้แทนรูปต้นฉบับระหว่างที่ data.prinnie333.com ยังกู้ไม่ได้
//
//   node scripts/build-tarot-cards.js            สร้างครบทุกใบ
//   node scripts/build-tarot-cards.js --sample   สร้างแค่ 6 ใบไว้ดูตัวอย่าง
//
// ⚠️ นี่ไม่ใช่ภาพไพ่จริง — เป็นการ์ดชื่อไพ่ในสไตล์แบรนด์ ไว้กันไม่ให้แชทว่างเปล่า
// ได้รูปต้นฉบับคืนเมื่อไหร่ให้ใช้ scripts/fetch-tarot-images.js ทับไปได้เลย
//
// ลายเซ็นกลางการ์ด (sigil) สร้างจาก image_id — ไพ่แต่ละใบจึงได้ลายไม่ซ้ำกัน
// และ build ซ้ำได้ลายเดิมเสมอ ไม่ใช่การสุ่มใหม่ทุกครั้ง

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, '..', 'assets', 'tarot-placeholder');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.homedir(), 'prinnie-backups');
const FONT = "'Tahoma','Noto Sans Thai',sans-serif";
const W = 760, H = 1300;                       // สัดส่วนไพ่ทาโรต์ ~1:1.71

const DECK_TH = { paid: 'สำรับหลัก', love: 'สำรับความรัก', free: 'สำรับเปิดฟรี' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function newestBackup() {
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'))
    .map(f => path.join(BACKUP_DIR, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0];
}

// ชื่อไพ่มาสามแบบ ต้องแยกให้ถูกทั้งสามแบบ
//   "The Fool (เดอะฟูลหรือโจ๊กเกอร์)"  → main: The Fool        · sub: เดอะฟูลหรือโจ๊กเกอร์
//   "El Sole ( The Sun ) 19"           → main: El Sole         · sub: The Sun · num: 19
//   "Following your Heart"             → main: Following your Heart
function parseName(raw) {
  let s = String(raw || '').trim();
  let num = '';
  const mNum = s.match(/\s(\d{1,2})\s*$/);
  if (mNum) { num = mNum[1]; s = s.slice(0, mNum.index).trim(); }
  const mPar = s.match(/^(.*?)\s*\(\s*(.+?)\s*\)\s*$/);
  if (mPar) return { main: mPar[1].trim(), sub: mPar[2].trim(), num };
  return { main: s, sub: '', num };
}

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) { let s = seed || 1; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }

// ลายเซ็นประจำใบ — ดาวหลายแฉกซ้อนวง + จุดดาว สร้างจาก image_id
function sigil(cx, cy, R, seed) {
  const r = rng(seed);
  // จำนวนแฉกต้องเป็นเลขที่ "ลากดาวได้จริง" — ตัด 6 ทิ้ง เพราะ 6 แฉกไม่มี step ไหนเลย
  // ที่ ห.ร.ม.=1 (2,3,4 หารร่วมกับ 6 หมด) ผลคือได้หกเหลี่ยมธรรมดา ไม่ใช่ดาว
  const POINTS = [5, 7, 8, 9];
  const points = POINTS[Math.floor(r() * POINTS.length)];
  // step ต้องเป็นจำนวนเฉพาะสัมพัทธ์กับ points ไม่งั้นเส้นวนกลับก่อนครบแฉก
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const cands = [];
  for (let k = 2; k < points - 1; k++) if (gcd(points, k) === 1) cands.push(k);
  const step = cands[Math.floor(r() * cands.length)];
  const rot = r() * Math.PI * 2;
  const P = i => [cx + R * Math.cos(rot + i * 2 * Math.PI / points),
                  cy + R * Math.sin(rot + i * 2 * Math.PI / points)];
  let g = '';
  g += `<circle cx="${cx}" cy="${cy}" r="${(R * 1.34).toFixed(1)}" fill="url(#halo)"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R.toFixed(1)}" fill="none" stroke="#E8C77A" stroke-opacity=".42" stroke-width="1.6"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${(R * 0.66).toFixed(1)}" fill="none" stroke="#C9A9F0" stroke-opacity=".28" stroke-width="1.1"/>`;
  let d = '';
  for (let i = 0; i <= points; i++) {
    const [x, y] = P((i * step) % points);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  g += `<path d="${d}Z" fill="none" stroke="#E8C77A" stroke-opacity=".8" stroke-width="2" stroke-linejoin="round"/>`;
  for (let i = 0; i < points; i++) {
    const [x, y] = P(i);
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="#F3D98F"/>`;
  }
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, d2 = R * (1.05 + r() * 0.28);
    g += `<circle cx="${(cx + Math.cos(a) * d2).toFixed(1)}" cy="${(cy + Math.sin(a) * d2).toFixed(1)}" r="${(1.4 + r() * 1.6).toFixed(1)}" fill="#F8D98A" opacity="${(0.35 + r() * 0.4).toFixed(2)}"/>`;
  }
  return g;
}

// ย่อข้อความยาวให้พอดีการ์ด — กะจากความกว้างเฉลี่ยของตัวอักษร
function fit(text, size, maxW) {
  const per = size * 0.56;
  const max = Math.floor(maxW / per);
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…';
}

function cardSvg(card) {
  const { main, sub, num } = parseName(card.name);
  const seed = hash32(card.id);
  const cx = W / 2;
  const M = 34;                                   // ขอบการ์ด

  const mainSize = main.length > 22 ? 44 : main.length > 15 ? 52 : 60;
  const subSize  = 32;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#1B0B3A"/><stop offset="55%" stop-color="#2D0A5A"/><stop offset="100%" stop-color="#12071F"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%">
      <stop offset="0%" stop-color="#C77DFF" stop-opacity=".26"/><stop offset="100%" stop-color="#C77DFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF7E2"/><stop offset="46%" stop-color="#F3D98F"/><stop offset="100%" stop-color="#C79A4E"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${(() => { const r = rng(seed + 99); let o = '';
    for (let i = 0; i < 90; i++) o += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(r() * 1.3 + 0.4).toFixed(1)}" fill="#F8D98A" opacity="${(r() * 0.4 + 0.15).toFixed(2)}"/>`;
    return o; })()}

  <rect x="${M}" y="${M}" width="${W - M * 2}" height="${H - M * 2}" rx="14" fill="none" stroke="#E8C77A" stroke-opacity=".55" stroke-width="2.2"/>
  <rect x="${M + 11}" y="${M + 11}" width="${W - (M + 11) * 2}" height="${H - (M + 11) * 2}" rx="9" fill="none" stroke="#E8C77A" stroke-opacity=".22" stroke-width="1.1"/>
  ${[[M + 11, M + 11, 1, 1], [W - M - 11, M + 11, -1, 1], [M + 11, H - M - 11, 1, -1], [W - M - 11, H - M - 11, -1, -1]]
    .map(([x, y, sx, sy]) => `<path d="M${x + 26 * sx},${y} L${x},${y} L${x},${y + 26 * sy}" fill="none" stroke="#E8C77A" stroke-opacity=".75" stroke-width="2.4"/>`).join('')}

  ${num ? `<text x="${cx}" y="${M + 92}" text-anchor="middle" font-size="30" font-weight="700" fill="#E8C77A" opacity=".8" letter-spacing="3">${esc(num)}</text>` : ''}

  ${sigil(cx, 470, 168, seed)}

  <text x="${cx}" y="${H - 340}" text-anchor="middle" font-size="${mainSize}" font-weight="700" fill="url(#gold)">${esc(fit(main, mainSize, W - 130))}</text>
  ${sub ? `<text x="${cx}" y="${H - 340 + subSize * 1.85}" text-anchor="middle" font-size="${subSize}" font-weight="400" fill="#CFC2EC">${esc(fit(sub, subSize, W - 130))}</text>` : ''}

  <line x1="${cx - 60}" y1="${H - 190}" x2="${cx + 60}" y2="${H - 190}" stroke="#E8C77A" stroke-opacity=".4" stroke-width="1.4"/>
  <text x="${cx}" y="${H - 138}" text-anchor="middle" font-size="25" font-weight="400" fill="#9C8CC4">${esc(DECK_TH[card.deck] || card.deck || '')}</text>
  <text x="${cx}" y="${H - 90}" text-anchor="middle" font-size="26" font-weight="700" fill="#E8C77A" opacity=".9">อาจารย์ปรินนี่ · Prinnie333</text>
</svg>`;
}

const backup = newestBackup();
const d = JSON.parse(fs.readFileSync(backup, 'utf8'));
const t = d.tables.tarot;
let cards = (Array.isArray(t) ? t : t.rows || []).filter(r => r.image_id)
  .map(r => ({ id: r.image_id, name: r.name || '', deck: r.deck || '' }));

if (process.argv.includes('--sample')) {
  // เลือกตัวอย่างให้ครบทั้งสามสำรับและครบทุกรูปแบบชื่อ
  const pick = [];
  for (const dk of ['paid', 'love', 'free']) pick.push(...cards.filter(c => c.deck === dk).slice(0, 2));
  cards = pick;
}

fs.mkdirSync(OUT, { recursive: true });
console.log(`แบ็คอัพ: ${path.basename(backup)}\nสร้างการ์ด ${cards.length} ใบ → ${path.relative(process.cwd(), OUT)}\n`);
let bytes = 0;
for (const c of cards) {
  const png = new Resvg(cardSvg(c), { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: W } }).render().asPng();
  fs.writeFileSync(path.join(OUT, c.id + '.png'), png);
  bytes += png.length;
}
console.log(`เสร็จ ${cards.length} ใบ · รวม ${(bytes / 1048576).toFixed(1)} MB · เฉลี่ย ${(bytes / cards.length / 1024).toFixed(0)}KB/ใบ`);
