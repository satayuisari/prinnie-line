// ชวนสมาชิกที่หมดอายุกลับมา — ข้อความรายคน (ใส่ชื่อ + วันที่หมดอายุจริง)
//
// ใช้:  node scripts/winback.js                 ดูรายชื่อ + ข้อความตัวอย่าง (ไม่ส่ง)
//       node scripts/winback.js --preview       ส่งตัวอย่างให้ทีมงานดู (Prinprin + Bon)
//       node scripts/winback.js --send          ส่งจริงถึงทุกคนในรายชื่อ
//       node scripts/winback.js --send --limit 5   ส่งจริงแค่ 5 คนแรก (ทดลองก่อน)
//
// ⚠️ ส่งจริงแล้วเรียกคืนไม่ได้ — ค่าเริ่มต้นจึงเป็นแค่แสดงรายชื่อ
const db = require('../src/db');
const lineMsg = require('../src/services/lineMessaging');

const TEAM = [
  ['Ue72dc1cca95a648065ff0dc3390253a6', 'Prinprin'],
  ['Ub358215999e4bede8773435eb812695a', 'Bon'],
];

const LIFF = process.env.LINE_LIFF_ID
  ? `https://liff.line.me/${process.env.LINE_LIFF_ID}?view=pay`
  : 'https://liff.line.me/YOUR_LIFF_ID?view=pay';

// เป้าหมาย: เคยจ่ายจริง + มีดวงแล้ว + หมดอายุแล้ว (ไม่รวมบัญชีทดลอง/แจกฟรี)
const AUDIENCE = `
  SELECT line_user_id,
         COALESCE(NULLIF(nickname,''), display_name) AS name,
         to_char(subscribe_end, 'DD/MM') AS ended
  FROM line_subscribers
  WHERE payment_ref IS NOT NULL
    AND payment_ref NOT IN ('tester','free-trial','free','founder','LIFETIME_COMP')
    AND chart_data IS NOT NULL
    AND (subscribe_end IS NULL OR subscribe_end <= NOW())
  ORDER BY subscribe_end DESC NULLS LAST`;

// ชื่อ LINE มีอักขระตกแต่งเยอะ (• ✦ อิโมจิ) — ถ้าเอามาต่อท้าย "คุณ" ตรง ๆ จะได้ "คุณ• Nanear •"
// ตัดอักขระที่ไม่ใช่ตัวอักษร/ตัวเลขออกจากหัวท้าย ถ้าเหลือสั้นเกินไปก็ไม่ต้องเรียกชื่อ
function cleanName(raw) {
  const s = String(raw || '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .trim();
  return s.length >= 2 ? s : null;
}

function buildMessage(rawName, ended) {
  const name = cleanName(rawName);
  return [
    `${name ? 'คุณ' + name + ' คะ 🌙' : 'สวัสดีค่ะ 🌙'}`,
    ``,
    `ดวงรายวันส่วนตัวของคุณหยุดส่งไปตั้งแต่ ${ended || 'เดือนที่แล้ว'} แล้วนะคะ`,
    `ช่วงนี้ดาวขยับหลายดวง จังหวะของหลายคนเปลี่ยนไปพอสมควรเลยค่ะ`,
    ``,
    `และเรากำลังจะเริ่มสิ่งใหม่สำหรับสมาชิก —`,
    `ทุกวันที่ 15 ระบบจะคำนวณว่าดาวเดือนนั้น`,
    `ทำมุมกับดวงเกิดของสมาชิกคนไหนแรงที่สุด`,
    `คนนั้นจะได้คุยกับอาจารย์ปรินนี่เป็นการส่วนตัว 1 ชั่วโมง`,
    `โดยไม่มีค่าใช้จ่ายเพิ่ม`,
    ``,
    `ไม่ใช่การจับรางวัล ไม่ต้องลุ้น — ขึ้นกับดวงของคุณล้วน ๆ`,
    `ขอแค่เป็นสมาชิกอยู่ในวันนั้นค่ะ`,
    ``,
    `กลับมาได้เลยนะคะ 399 บาท/เดือน กดแล้วจ่ายได้ทันที`,
    `👉 ${LIFF}`,
  ].join('\n');
}

async function main() {
  const preview = process.argv.includes('--preview');
  const send = process.argv.includes('--send');
  const li = process.argv.indexOf('--limit');
  const limit = li > -1 ? Number(process.argv[li + 1]) : null;

  let rows = (await db.query(AUDIENCE)).rows;
  if (limit) rows = rows.slice(0, limit);

  console.log(`กลุ่มเป้าหมาย: ${rows.length} คน (สมาชิกเก่าที่หมดอายุ)`);
  for (const r of rows.slice(0, 8)) console.log(`  ${(r.name || '-').slice(0, 20).padEnd(22)} หมด ${r.ended}`);
  if (rows.length > 8) console.log(`  … อีก ${rows.length - 8} คน`);

  if (preview) {
    const sample = rows[0] || { name: 'ตัวอย่าง', ended: '01/08' };
    const text = '🧪 ตัวอย่างข้อความชวนสมาชิกเก่ากลับมา (ยังไม่ได้ส่งถึงลูกค้า)\n──────────\n\n'
      + buildMessage(sample.name, sample.ended);
    for (const [id, who] of TEAM) {
      const r = await lineMsg.pushText(id, text).catch(e => ({ error: e.message }));
      console.log(`  ส่งตัวอย่าง → ${who}:`, r && r.error ? r.error : 'สำเร็จ');
    }
    process.exit(0);
  }

  if (!send) {
    console.log('\n--- ข้อความที่จะส่ง (ตัวอย่างคนแรก) ---');
    console.log(buildMessage(rows[0]?.name, rows[0]?.ended));
    console.log('\n(ยังไม่ได้ส่ง — ใส่ --preview เพื่อส่งให้ทีมงานดู หรือ --send เพื่อส่งจริง)');
    process.exit(0);
  }

  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      await lineMsg.pushText(r.line_user_id, buildMessage(r.name, r.ended));
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
