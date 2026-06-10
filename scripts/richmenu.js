// จัดการ Rich Menu ผ่าน LINE Messaging API
//
// วิธีใช้:
//   node scripts/richmenu.js create            สร้างเมนู + อัปโหลดรูป (richmenu/richmenu.png) → ได้ richMenuId
//   node scripts/richmenu.js link <userId>     ผูกเมนูกับ user คนเดียว  ← ✅ ปลอดภัยสำหรับเทส
//   node scripts/richmenu.js unlink <userId>   ยกเลิกเมนูของ user คนนั้น
//   node scripts/richmenu.js list              ดู rich menu ทั้งหมด
//   node scripts/richmenu.js delete <id>       ลบ rich menu
//   node scripts/richmenu.js default --force   ตั้งเป็นเมนู default ของ "ทุกคน" ← ⚠️ LAUNCH เท่านั้น
//
// richMenuId ที่สร้างล่าสุดถูกเก็บไว้ที่ richmenu/.richmenu-id (ใช้อ้างอิงอัตโนมัติ)

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) { console.error('❌ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env'); process.exit(1); }

const API      = 'https://api.line.me/v2/bot';
const API_DATA = 'https://api-data.line.me/v2/bot';
const ID_FILE  = path.join(__dirname, '..', 'richmenu', '.richmenu-id');
const CONFIG   = path.join(__dirname, '..', 'richmenu', 'menu-config.json');
const DIR      = path.join(__dirname, '..', 'richmenu');

// หารูปเมนู: รองรับทั้ง .jpg และ .png
function findImage() {
  for (const [name, mime] of [['richmenu.jpg', 'image/jpeg'], ['richmenu.png', 'image/png']]) {
    const p = path.join(DIR, name);
    if (fs.existsSync(p)) return { path: p, mime };
  }
  return null;
}

const headers = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function api(method, url, body) {
  const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${resp.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

function savedId() {
  return fs.existsSync(ID_FILE) ? fs.readFileSync(ID_FILE, 'utf8').trim() : null;
}

async function create() {
  const image = findImage();
  if (!image) {
    console.error('❌ ไม่พบรูปเมนู (richmenu/richmenu.jpg หรือ richmenu.png)');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (config.areas.some(a => a.action.uri && a.action.uri.includes('YOUR_LIFF_ID'))) {
    console.warn('⚠️  ยังไม่ได้ใส่ LIFF ID จริงใน menu-config.json (ปุ่มสมัครจะใช้ไม่ได้)');
  }

  console.log('สร้าง rich menu ...');
  const { richMenuId } = await api('POST', `${API}/richmenu`, config);
  console.log(`  richMenuId = ${richMenuId}`);

  console.log(`อัปโหลดรูป (${path.basename(image.path)}, ${image.mime}) ...`);
  const img  = fs.readFileSync(image.path);
  const resp = await fetch(`${API_DATA}/richmenu/${richMenuId}/content`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': image.mime },
    body:    img,
  });
  if (!resp.ok) throw new Error(`อัปโหลดรูปล้มเหลว: ${resp.status} ${await resp.text()}`);

  fs.writeFileSync(ID_FILE, richMenuId);
  console.log(`✅ สร้างเสร็จ (เก็บ id ไว้ที่ richmenu/.richmenu-id)`);
  console.log(`\nต่อไป: node scripts/richmenu.js link <yourUserId>   ← เทสกับตัวเองก่อน`);
}

async function link(userId) {
  const id = savedId();
  if (!id) throw new Error('ยังไม่มี richMenuId — รัน create ก่อน');
  if (!userId) throw new Error('ต้องระบุ userId');
  await api('POST', `${API}/user/${userId}/richmenu/${id}`);
  console.log(`✅ ผูกเมนูให้ ${userId} แล้ว (เฉพาะคนนี้เห็น คนอื่นไม่เห็น)`);
}

async function unlink(userId) {
  await api('DELETE', `${API}/user/${userId}/richmenu`);
  console.log(`✅ ยกเลิกเมนูของ ${userId} แล้ว`);
}

async function list() {
  const { richmenus } = await api('GET', `${API}/richmenu/list`);
  if (!richmenus || !richmenus.length) { console.log('(ยังไม่มี rich menu)'); return; }
  for (const m of richmenus) {
    console.log(`  ${m.richMenuId}  "${m.name}"  ${m.size.width}x${m.size.height}`);
  }
}

async function del(id) {
  if (!id) throw new Error('ต้องระบุ richMenuId');
  await api('DELETE', `${API}/richmenu/${id}`);
  console.log(`✅ ลบ ${id} แล้ว`);
}

async function setDefault(force) {
  const id = savedId();
  if (!id) throw new Error('ยังไม่มี richMenuId — รัน create ก่อน');
  if (!force) {
    console.error('⚠️  คำสั่งนี้จะทำให้ "ทุกคน" (รวม 10,000 followers) เห็นเมนูนี้');
    console.error('    ถ้าแน่ใจแล้ว (พร้อม launch จริง) ใส่ --force');
    process.exit(1);
  }
  await api('POST', `${API}/user/all/richmenu/${id}`);
  console.log(`✅ ตั้งเป็นเมนู default ของทุกคนแล้ว — LAUNCHED 🚀`);
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  try {
    switch (cmd) {
      case 'create':  await create(); break;
      case 'link':    await link(arg); break;
      case 'unlink':  await unlink(arg); break;
      case 'list':    await list(); break;
      case 'delete':  await del(arg); break;
      case 'default': await setDefault(arg === '--force'); break;
      default:
        console.log('คำสั่ง: create | link <userId> | unlink <userId> | list | delete <id> | default --force');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
