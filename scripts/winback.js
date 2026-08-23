// ชวนสมาชิกที่หมดอายุกลับมา — ข้อความรายคน (ใส่ชื่อ + วันที่หมดอายุจริง)
//
// ใช้:  node scripts/winback.js                 ดูรายชื่อ + ข้อความตัวอย่าง (ไม่ส่ง)
//       node scripts/winback.js --preview       ส่งตัวอย่างให้ทีมงานดู (Prinprin + Bon)
//       node scripts/winback.js --send          ส่งจริงถึงทุกคนในรายชื่อ
//       node scripts/winback.js --send --limit 5   ส่งจริงแค่ 5 คนแรก (ทดลองก่อน)
//
// ⚠️ ส่งจริงแล้วเรียกคืนไม่ได้ — ค่าเริ่มต้นจึงเป็นแค่แสดงรายชื่อ
const lineMsg = require('../src/services/lineMessaging');
const winback = require('../src/services/winback');   // กลุ่มเป้าหมาย + ข้อความ อยู่ที่เดียว

const TEAM = [
  ['Ue72dc1cca95a648065ff0dc3390253a6', 'Prinprin'],
  ['Ub358215999e4bede8773435eb812695a', 'Bon'],
];



async function main() {
  const preview = process.argv.includes('--preview');
  const send = process.argv.includes('--send');
  const li = process.argv.indexOf('--limit');
  const limit = li > -1 ? Number(process.argv[li + 1]) : null;

  let rows = await winback.audience();
  if (limit) rows = rows.slice(0, limit);

  console.log(`กลุ่มเป้าหมาย: ${rows.length} คน (สมาชิกเก่าที่หมดอายุ)`);
  for (const r of rows.slice(0, 8)) console.log(`  ${(r.name || '-').slice(0, 20).padEnd(22)} หมด ${r.ended}`);
  if (rows.length > 8) console.log(`  … อีก ${rows.length - 8} คน`);

  if (preview) {
    const sample = rows[0] || { name: 'ตัวอย่าง', ended: '01/08' };
    const text = '🧪 ตัวอย่างข้อความชวนสมาชิกเก่ากลับมา (ยังไม่ได้ส่งถึงลูกค้า)\n──────────\n\n'
      + winback.buildMessage(sample.name, sample.ended);
    for (const [id, who] of TEAM) {
      const r = await lineMsg.pushText(id, text).catch(e => ({ error: e.message }));
      console.log(`  ส่งตัวอย่าง → ${who}:`, r && r.error ? r.error : 'สำเร็จ');
    }
    process.exit(0);
  }

  if (!send) {
    console.log('\n--- ข้อความที่จะส่ง (ตัวอย่างคนแรก) ---');
    console.log(winback.buildMessage(rows[0]?.name, rows[0]?.ended));
    console.log('\n(ยังไม่ได้ส่ง — ใส่ --preview เพื่อส่งให้ทีมงานดู หรือ --send เพื่อส่งจริง)');
    process.exit(0);
  }

  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      await lineMsg.pushText(r.line_user_id, winback.buildMessage(r.name, r.ended));
      ok++;
    } catch (e) {
      fail++;
      console.error(`  ✗ ${r.name}: ${e.message}`);
    }
    await new Promise(s => setTimeout(s, 350));   // เว้นจังหวะ กัน rate limit ของ LINE
  }
  console.log(`\n✓ ส่งแล้ว ${ok} คน · ไม่สำเร็จ ${fail} คน`);
  process.exit(0);
}

main().catch(e => {
  console.error('ERR', e.message.replace(/postgres(ql)?:\/\/\S+/g, '[REDACTED]'));
  process.exit(1);
});
