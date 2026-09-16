// หน้าโต๊ะคอนเทนต์ในแดชบอร์ด — ดูโพสต์ที่เสนอ กดว่าโพสต์แล้ว/ข้าม และดูว่ามุมไหนได้ผล
//
// ใช้ auth เดียวกับแดชบอร์ดเดิม (DASHBOARD_KEY ใน query string)
const contentDesk = require('../services/contentDesk');

const ok = (req) => process.env.DASHBOARD_KEY && req.query.key === process.env.DASHBOARD_KEY;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));

const BADGE = {
  DRAFT: '<span class="pill" style="background:#8a6d1f">ร่าง</span>',
  POSTED: '<span class="pill" style="background:#1faa59">โพสต์แล้ว</span>',
  SKIPPED: '<span class="pill" style="background:#555">ข้าม</span>',
};

function page(rows, board, key) {
  const cards = rows.map((r) => `
    <div class="card">
      <div class="head">
        <b>${day(r.for_date)}</b> · ${esc(r.theme || '-')} ${BADGE[r.status] || esc(r.status)}
        ${r.source === 'fallback' ? '<span class="pill" style="background:#7a4">สำรอง</span>' : ''}
      </div>
      <pre class="cap">${esc(r.caption)}</pre>
      <div class="muted">🖼 ${esc(r.image_brief || '-')}</div>
      <div class="muted">💡 ${esc(r.rationale || '-')}</div>
      ${r.measured_at ? `<div class="res">ผล 3 วัน: แอดใหม่ <b>${r.signups_after}</b> · คลิก <b>${r.clicks_after}</b> · จ่าย <b>${r.paid_after}</b></div>` : ''}
      ${r.status === 'DRAFT' ? `
        <form method="post" action="/dashboard/content/${r.id}/posted?key=${encodeURIComponent(key)}" style="display:inline">
          <button class="btn go">โพสต์แล้ว</button></form>
        <form method="post" action="/dashboard/content/${r.id}/skip?key=${encodeURIComponent(key)}" style="display:inline">
          <button class="btn">ข้าม</button></form>` : ''}
    </div>`).join('');

  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>โต๊ะคอนเทนต์</title>
<style>
 body{font-family:system-ui,-apple-system,"Helvetica Neue",sans-serif;background:#0f1320;color:#e8edf2;margin:0;padding:20px}
 h1{font-size:20px;margin:0 0 4px} .muted{color:#8b97a8;font-size:12.5px;margin-top:4px}
 .top{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:14px}
 a.back{color:#7fd1ff;text-decoration:none;font-size:13px}
 .board{background:#161d2e;border:1px solid #232c42;border-radius:12px;padding:12px 14px;margin-bottom:16px;white-space:pre-wrap;font-size:13px;line-height:1.7}
 .card{background:#161d2e;border:1px solid #232c42;border-radius:12px;padding:14px 16px;margin-bottom:12px}
 .head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
 .pill{font-size:11px;padding:2px 8px;border-radius:999px;color:#fff}
 pre.cap{white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.75;background:#0f1320;border:1px solid #232c42;border-radius:8px;padding:12px;margin:0 0 8px}
 .res{margin-top:8px;font-size:13px;color:#9fe0b4}
 .btn{margin-top:10px;margin-right:8px;background:#222c44;color:#dbe6f0;border:1px solid #33405e;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer}
 .btn.go{background:#1faa59;border-color:#1faa59;color:#fff;font-weight:600}
</style></head><body>
<div class="top"><h1>📝 โต๊ะคอนเทนต์</h1>
  <a class="back" href="/dashboard?key=${encodeURIComponent(key)}">← กลับแดชบอร์ด</a></div>
<div class="muted">ระบบคิดโพสต์ของพรุ่งนี้ให้ทุกวัน 17:00 แล้วส่งเข้าไลน์ · กด "โพสต์แล้ว" เมื่อโพสต์จริง ระบบจะวัดผลให้เองใน 3 วัน</div>
<div class="board">${esc(board)}</div>
${cards || '<div class="muted">ยังไม่มีโพสต์ที่เสนอ</div>'}
</body></html>`;
}

function register(app) {
  app.get('/dashboard/content', async (req, res) => {
    if (!ok(req)) return res.status(403).send('forbidden');
    try {
      const [rows, board] = await Promise.all([contentDesk.list(30), contentDesk.scoreboard()]);
      res.send(page(rows, board, req.query.key));
    } catch (e) {
      res.status(500).send('error: ' + esc(e.message));
    }
  });

  app.post('/dashboard/content/:id/posted', async (req, res) => {
    if (!ok(req)) return res.status(403).send('forbidden');
    await contentDesk.markPosted(Number(req.params.id)).catch(() => {});
    res.redirect('/dashboard/content?key=' + encodeURIComponent(req.query.key));
  });

  app.post('/dashboard/content/:id/skip', async (req, res) => {
    if (!ok(req)) return res.status(403).send('forbidden');
    await contentDesk.skip(Number(req.params.id)).catch(() => {});
    res.redirect('/dashboard/content?key=' + encodeURIComponent(req.query.key));
  });
}

module.exports = { register };
