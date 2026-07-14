// ยิงข้อความ "วิธีส่งสลิป/สมัครให้สำเร็จ" ให้คนลงทะเบียนแต่ยังไม่จ่าย (สมาชิกไม่โดน)
const subs = require('../src/services/subscriberService');
const lm = require('../src/services/lineMessaging');

const LIFF = process.env.LINE_LIFF_ID ? `https://liff.line.me/${process.env.LINE_LIFF_ID}` : 'https://liff.line.me/2010382680';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TEXT =
`📢 วิธีสมัครสมาชิก Prinnie333 ให้สำเร็จ

1️⃣ กดเมนู "สมัครสมาชิก" ด้านล่าง → รับ QR พร้อมเพย์ (399 บาท/เดือน)
2️⃣ สแกนจ่ายด้วยแอปธนาคาร
3️⃣ 📸 ส่ง "รูปสลิปโอนเงิน" กลับมาในแชทนี้เลย
4️⃣ ระบบตรวจสลิปอัตโนมัติ → เปิดใช้งานสมาชิกให้ทันที ✨
   (ถ้าตรวจไม่ผ่าน แอดมินจะเช็กให้เอง ไม่ต้องห่วง)

จากนั้นรับดวงส่วนตัวเต็ม ๆ ส่งให้ทุกเช้า 8 โมง 🌙
👉 ${LIFF}`;

(async () => {
  const leads = await subs.getRegisteredInactive();
  console.log(`เป้าหมาย: ${leads.length} คน`);
  let sent = 0, fail = 0;
  const msg = { type: 'text', text: TEXT, quickReply: { items: [
    { type: 'action', action: { type: 'uri', label: '✨ สมัครสมาชิก', uri: LIFF } },
  ] } };
  for (const m of leads) {
    try {
      const res = await lm.pushMessage(m.line_user_id, msg);
      if (!(res && res.skipped)) sent++;
    } catch (e) { fail++; if (fail <= 5) console.error('  ✗', e.message); }
    if ((sent + fail) % 50 === 0) { console.log(`  ...${sent + fail}/${leads.length}`); await sleep(300); }
  }
  console.log(`\n✅ ส่งสำเร็จ ${sent} | ล้มเหลว ${fail}`);
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
