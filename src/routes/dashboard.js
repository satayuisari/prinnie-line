// Dashboard เว็บ — ดูตัวเลขสมาชิก/รายได้สด ป้องกันด้วย ?key=DASHBOARD_KEY
// เปิด: https://<host>/dashboard?key=xxxx   (auto-refresh ทุก 30 วิ)
const db = require('../db');

const PRICE = 399; // ราคา subscription /เดือน (ใช้ประมาณ MRR)
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function getStats() {
  const s = (await db.query(`
    SELECT
      COUNT(*)::int                                                                   AS total,
      COUNT(*) FILTER (WHERE status='ACTIVE')::int                                    AS active,
      COUNT(*) FILTER (WHERE status='PENDING')::int                                   AS pending,
      COUNT(*) FILTER (WHERE status='EXPIRED')::int                                   AS expired,
      COUNT(*) FILTER (WHERE status='CANCELLED')::int                                 AS cancelled,
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int                     AS today,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE))::int      AS this_week,
      COUNT(*) FILTER (WHERE status='ACTIVE' AND subscribe_end IS NOT NULL
                        AND subscribe_end <= CURRENT_DATE + INTERVAL '7 days')::int    AS expiring_soon
    FROM line_subscribers`)).rows[0];
  const recent = (await db.query(`
    SELECT display_name, nickname, status, to_char(created_at,'MM-DD HH24:MI') AS created
    FROM line_subscribers ORDER BY created_at DESC LIMIT 10`)).rows;
  return { s, recent };
}

function card(label, value, sub, accent) {
  return `<div class="card">
    <div class="lbl">${label}</div>
    <div class="val"${accent ? ` style="color:${accent}"` : ''}>${value}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ''}
  </div>`;
}

function render({ s, recent }) {
  const mrr = (s.active * PRICE).toLocaleString();
  const conv = (s.active + s.pending) ? Math.round(s.active / (s.active + s.pending) * 100) : 0;
  const badge = st => ({ ACTIVE: '#1faa59', PENDING: '#C98A00', EXPIRED: '#8a8a8a', CANCELLED: '#b94646' }[st] || '#888');
  const rows = recent.map(r => `<tr>
    <td>${esc(r.display_name || r.nickname || '(ไม่มีชื่อ)')}</td>
    <td><span class="pill" style="background:${badge(r.status)}">${r.status}</span></td>
    <td class="muted">${esc(r.created)}</td></tr>`).join('');
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  return `<!doctype html><html lang="th"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30"><title>Prinnie333 · Dashboard</title>
<style>
  :root{--p:#5B2A86;--p2:#6B3FA0;--gold:#D4AF37;--ink:#2A1B3D}
  *{box-sizing:border-box;font-family:'Segoe UI',Tahoma,sans-serif}
  body{margin:0;background:linear-gradient(160deg,#1c0f2e,#2A1B3D);color:#F6F1FF;padding:18px}
  h1{font-size:20px;margin:0 0 2px}.ts{color:#b9a9d6;font-size:12px;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
  .card{background:rgba(255,255,255,.05);border:1px solid rgba(212,175,55,.25);border-radius:14px;padding:16px}
  .lbl{font-size:12px;color:#c9bce4;margin-bottom:6px}.val{font-size:30px;font-weight:700;color:#fff}
  .sub{font-size:11px;color:#a99cc8;margin-top:4px}
  .sec{margin-top:22px;font-size:14px;color:var(--gold);font-weight:600}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  td{padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.07)}.muted{color:#a99cc8}
  .pill{color:#fff;font-size:11px;padding:2px 8px;border-radius:20px}
</style></head><body>
  <h1>🔮 Prinnie333 · Dashboard</h1>
  <div class="ts">อัปเดต ${now} · refresh อัตโนมัติทุก 30 วิ</div>
  <div class="grid">
    ${card('💚 สมาชิกจ่ายแล้ว (ACTIVE)', s.active, 'มี monthly access', '#5CE6A1')}
    ${card('💰 รายได้ต่อเดือน (MRR)', '฿' + mrr, `${s.active} × ฿${PRICE}`, 'var(--gold)')}
    ${card('👥 subscriber ทั้งหมด', s.total, `conversion ${conv}%`)}
    ${card('⏳ รอจ่าย (PENDING)', s.pending, 'กรอกวันเกิดแล้ว ยังไม่จ่าย', '#F0C868')}
    ${card('🆕 สมัครวันนี้', s.today, 'นับเที่ยงคืน–ตอนนี้')}
    ${card('📅 สัปดาห์นี้', s.this_week)}
    ${card('⚠️ ใกล้หมดอายุ (7 วัน)', s.expiring_soon, 'ควร nudge ต่ออายุ', s.expiring_soon ? '#F0A868' : undefined)}
    ${card('🗂️ EXPIRED / ยกเลิก', s.expired + s.cancelled, `EXPIRED ${s.expired} · CANCELLED ${s.cancelled}`)}
  </div>
  <div class="sec">รายชื่อสมัครล่าสุด</div>
  <table><tbody>${rows || '<tr><td class="muted">ยังไม่มีสมาชิก</td></tr>'}</tbody></table>
</body></html>`;
}

function register(app) {
  app.get('/dashboard', async (req, res) => {
    const KEY = process.env.DASHBOARD_KEY;
    if (!KEY || req.query.key !== KEY) return res.status(401).send('unauthorized');
    try {
      res.set('Cache-Control', 'no-store').send(render(await getStats()));
    } catch (e) {
      res.status(500).send('error: ' + esc(e.message));
    }
  });
}

module.exports = { register };
