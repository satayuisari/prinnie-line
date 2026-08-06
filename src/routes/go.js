// ลิงก์ track → เด้งไปแอด/สมัคร LINE OA
//   /go?s=yt      ช่องทางทั่วไป (YouTube/TikTok/FB) → หน้าแอดเพื่อน (นับคลิกเฉย ๆ)
//   /go?a=CODE    affiliate อินฟลู → หน้า LIFF สมัคร พร้อมรหัส (ผูก attribution ตอนลงทะเบียน)
const db = require('../db');

const ADD_URL = 'https://line.me/R/ti/p/%40prinnie333';
const LIFF_ID = process.env.LINE_LIFF_ID;
// จำกัด source/code ให้เป็นคำสั้น a-z0-9 กัน injection + กันสร้างขยะมั่ว
const clean = s => (typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) : '');

async function countClick(source) {
  await db.query(
    `INSERT INTO channel_clicks (source, click_date, clicks) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (source, click_date) DO UPDATE SET clicks = channel_clicks.clicks + 1`,
    [source]
  ).catch(e => console.error('[go] นับคลิกไม่ได้:', e.message));
}

function register(app) {
  app.get('/go', async (req, res) => {
    const aff = clean(req.query.a);
    if (aff) {
      // affiliate: เด้งไป LIFF สมัคร พร้อมรหัส → เก็บตอนลงทะเบียน (นับคลิกด้วย prefix a:)
      res.redirect(302, LIFF_ID ? `https://liff.line.me/${LIFF_ID}?a=${aff}` : ADD_URL);
      countClick('a:' + aff);
      return;
    }
    const source = clean(req.query.s) || 'direct';
    res.redirect(302, ADD_URL);
    countClick('s:' + source);
  });
}

module.exports = { register };
