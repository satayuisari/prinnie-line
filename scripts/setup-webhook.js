// ตั้ง webhook URL ผ่าน LINE Messaging API (ไม่ต้องเข้าคอนโซล)
//   node scripts/setup-webhook.js https://xxxx.trycloudflare.com
require('dotenv').config();

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const base  = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.error('ใส่ public URL ด้วย'); process.exit(1); }

const endpoint = base + '/webhook';
const H = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

(async () => {
  // 1. เช็ก tunnel ทะลุถึง server ไหม
  try {
    const h = await fetch(base + '/health', { signal: AbortSignal.timeout(8000) });
    console.log('1) tunnel /health :', h.status, (await h.text()).trim());
  } catch (e) { console.log('1) tunnel /health : ERROR', e.message); }

  // 2. ตั้ง webhook endpoint
  let r = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint',
    { method: 'PUT', headers: H, body: JSON.stringify({ endpoint }) });
  console.log('2) set endpoint   :', r.status, (await r.text()).trim() || 'OK');

  // 3. อ่านค่ากลับมายืนยัน
  r = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', { headers: H });
  console.log('3) current        :', (await r.text()).trim());

  // 4. LINE ยิง test event มาที่ server เรา
  r = await fetch('https://api.line.me/v2/bot/channel/webhook/test',
    { method: 'POST', headers: H, body: JSON.stringify({ endpoint }) });
  console.log('4) webhook test   :', r.status, (await r.text()).trim());
})();
