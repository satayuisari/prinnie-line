// เช็คว่า OA2 ต่อได้จริงหลังใส่ค่าใน .env แล้ว — ไม่ส่งข้อความหาใคร ไม่พิมพ์ค่าลับ
require('dotenv').config();

const mask = v => v ? `${v.slice(0, 4)}…${v.slice(-3)} (${v.length} ตัว)` : '◻︎ ยังว่าง';

(async () => {
  const id = process.env.LINE_CHANNEL_ID_2;
  const sec = process.env.LINE_CHANNEL_SECRET_2;
  const tok = process.env.LINE_CHANNEL_ACCESS_TOKEN_2;

  console.log('\n=== ค่าที่อ่านได้จาก .env ===');
  console.log('   LINE_CHANNEL_ID_2            ' + mask(id));
  console.log('   LINE_CHANNEL_SECRET_2        ' + mask(sec));
  console.log('   LINE_CHANNEL_ACCESS_TOKEN_2  ' + mask(tok));

  if (!id || !sec) { console.log('\n   ✗ ยังใส่ไม่ครบ — ตัวส่ง OA2 เช็ค ID กับ SECRET เป็นหลัก\n'); process.exit(1); }

  // ตัว broadcastOA2 ขอ token เองจาก ID+SECRET ทดสอบเส้นทางเดียวกันเลย
  console.log('\n=== ขอ access token จาก ID + SECRET ===');
  const r = await fetch('https://api.line.me/v2/oauth/accessToken', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${id}&client_secret=${sec}`,
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    console.log(`   ✗ ไม่ผ่าน HTTP ${r.status}: ${JSON.stringify(j).slice(0, 160)}`);
    console.log('     เช็คว่า ID/SECRET มาจาก channel ของ @efb2738a จริง ไม่ใช่ของ @prinnie333\n');
    process.exit(1);
  }
  console.log('   ✓ ได้ token แล้ว');

  const use = tok || j.access_token;
  const info = await (await fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + use } })).json();
  console.log('\n=== OA นี้คือบัญชีไหน ===');
  console.log('   ชื่อ       : ' + (info.displayName || '-'));
  console.log('   basic ID  : ' + (info.basicId || '-'));
  console.log('   premium ID: ' + (info.premiumId || '-'));

  const d = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  const f = await (await fetch('https://api.line.me/v2/bot/insight/followers?date=' + d, { headers: { Authorization: 'Bearer ' + use } })).json();
  console.log('   ผู้ติดตาม  : ' + (f.followers !== undefined ? `${f.followers} คน · ส่งถึงได้ ${f.targetedReaches}` : 'ยังดูไม่ได้'));

  const q = await (await fetch('https://api.line.me/v2/bot/message/quota', { headers: { Authorization: 'Bearer ' + use } })).json();
  const c = await (await fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers: { Authorization: 'Bearer ' + use } })).json();
  console.log('   โควต้า     : ใช้ไป ' + (c.totalUsage ?? '?') + ' จาก ' + (q.value ?? q.type ?? '?'));

  const right = (info.basicId === '@efb2738a' || info.premiumId === '@efb2738a');
  console.log(`\n   ${right ? '✓ ใช่ @efb2738a — พร้อมยิง' : '⚠️ ไม่ใช่ @efb2738a — ตรวจว่าหยิบ channel ถูกตัวมั้ย'}\n`);
})();
