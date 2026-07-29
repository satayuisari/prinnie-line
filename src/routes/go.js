// ลิงก์นับคลิกแยกช่องทาง → เด้งไปหน้าแอดเพื่อน LINE OA
// ใช้: prinnie-app-production.up.railway.app/go?s=yt  (yt=YouTube, tt=TikTok, fb=Facebook, ig=IG, ...)
// วัดว่าช่องทางไหนพาคนมาคลิกจริง เทียบกับยอดแอดใหม่รายวันในแดชบอร์ด
const express = require('express');
const db = require('../db');

const ADD_URL = 'https://line.me/R/ti/p/%40prinnie333';
// จำกัด source ให้เป็นคำสั้น a-z0-9 กัน SQL/log injection + กันสร้างขยะมั่ว
const clean = s => (typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) : '');

function register(app) {
  app.get('/go', async (req, res) => {
    const source = clean(req.query.s) || 'direct';
    // เด้งก่อน ไม่ให้ผู้ใช้รอ DB — นับแบบ fire-and-forget
    res.redirect(302, ADD_URL);
    db.query(
      `INSERT INTO channel_clicks (source, click_date, clicks) VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (source, click_date) DO UPDATE SET clicks = channel_clicks.clicks + 1`,
      [source]
    ).catch(e => console.error('[go] นับคลิกไม่ได้:', e.message));
  });
}

module.exports = { register };
