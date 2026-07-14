// ส่ง PREVIEW บรอดแคสต์เปิดตัว (video hero) ให้ owner ดูก่อนยิงจริง
// รันด้วย prod token: railway run node scripts/preview-broadcast.js
require('dotenv').config();
const lm   = require('../src/services/lineMessaging');
const flex = require('../src/marketing/flexTemplates');

const BASE = (process.env.PUBLIC_BASE_URL || 'https://prinnie-app-production.up.railway.app').replace(/\/$/, '');
const VIDEO = `${BASE}/promo.mp4`;
const PREVIEW = `${BASE}/promo-preview.png`;
const LIFF = process.env.LINE_LIFF_ID ? `https://liff.line.me/${process.env.LINE_LIFF_ID}` : 'https://liff.line.me/2010382680';
const ADD  = 'https://line.me/R/ti/p/%40prinnie333';

const OWNERS = {
  Bon:      'Ub358215999e4bede8773435eb812695a',
  prinprin: 'Ue72dc1cca95a648065ff0dc3390253a6',
};

(async () => {
  for (const [name, uid] of Object.entries(OWNERS)) {
    await lm.client.pushMessage({
      to: uid,
      messages: [
        { type: 'text', text: `👀 PREVIEW บรอดแคสต์เปิดตัว 18:00 (${name})\n① บัญชีบริการ (ปุ่ม→สมัคร):` },
        flex.launchVideo(VIDEO, PREVIEW, LIFF),
        { type: 'text', text: '② บัญชีใหญ่ 23k (ปุ่ม→แอด @prinnie333):' },
        flex.launchVideo(VIDEO, PREVIEW, ADD),
      ],
    });
    console.log('  ✓ ส่ง preview →', name);
  }
  console.log('done');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
