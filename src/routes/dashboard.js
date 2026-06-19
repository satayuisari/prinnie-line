// Dashboard เว็บ — 2 แท็บ: Subscription (ตัวเลข/รายชื่อ) + Support (inbox ลูกค้า + ตอบกลับ)
// เปิด: https://<host>/dashboard?key=DASHBOARD_KEY
const db = require('../db');
const inbox = require('../services/supportInbox');
const supportAI = require('../services/supportAI');
const triage = require('../services/supportTriage');

const PRICE = 399;
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ok = (req) => process.env.DASHBOARD_KEY && req.query.key === process.env.DASHBOARD_KEY;

async function getStats() {
  const s = (await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='ACTIVE')::int    AS active,
      COUNT(*) FILTER (WHERE status='PENDING')::int   AS pending,
      COUNT(*) FILTER (WHERE status='EXPIRED')::int   AS expired,
      COUNT(*) FILTER (WHERE status='CANCELLED')::int AS cancelled,
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int                  AS today,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE))::int   AS this_week,
      COUNT(*) FILTER (WHERE status='ACTIVE' AND subscribe_end IS NOT NULL
                        AND subscribe_end <= CURRENT_DATE + INTERVAL '7 days')::int AS expiring_soon
    FROM line_subscribers`)).rows[0];
  const recent = (await db.query(`
    SELECT display_name, nickname, status, to_char(created_at,'MM-DD HH24:MI') AS created
    FROM line_subscribers ORDER BY created_at DESC LIMIT 10`)).rows;
  return { s, recent };
}

function card(label, value, sub, accent) {
  return `<div class="card"><div class="lbl">${label}</div>
    <div class="val"${accent ? ` style="color:${accent}"` : ''}>${value}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}

function inboxCard(m, aiOn, key) {
  const cm = triage.META[m.category] || triage.META.general;
  const hi = m.priority === 'high';
  return `<div class="icard${hi ? ' hi' : ''}">
    <div class="imeta">
      <span class="cat" style="background:${cm.color}">${cm.label}</span>
      <b>${esc(m.display_name || '(ไม่มีชื่อ)')}</b>
      <span class="who">${esc(m.line_user_id).slice(0,12)}…</span>
      <span class="muted">${esc(m.created)}</span></div>
    <div class="imsg">💬 ${esc(m.message)}</div>
    <textarea id="r${m.id}" placeholder="พิมพ์คำตอบ…">${esc(m.ai_draft || '')}</textarea>
    <div class="irow">
      ${aiOn ? `<button class="ai" onclick="aiDraft(${m.id})">✨ AI ร่าง</button>` : ''}
      <button class="snd" onclick="reply(${m.id})">📤 ส่งให้ลูกค้า</button>
      <button class="cls" onclick="closeMsg(${m.id})">✕ ปิดเคส</button>
    </div></div>`;
}

function render({ s, recent }, msgs, aiOn, key) {
  const mrr = (s.active * PRICE).toLocaleString();
  const conv = (s.active + s.pending) ? Math.round(s.active / (s.active + s.pending) * 100) : 0;
  const badge = st => ({ ACTIVE:'#1faa59', PENDING:'#C98A00', EXPIRED:'#8a8a8a', CANCELLED:'#b94646' }[st] || '#888');
  const rows = recent.map(r => `<tr><td>${esc(r.display_name || r.nickname || '(ไม่มีชื่อ)')}</td>
    <td><span class="pill" style="background:${badge(r.status)}">${r.status}</span></td>
    <td class="muted">${esc(r.created)}</td></tr>`).join('');
  const inboxHtml = msgs.length ? msgs.map(m => inboxCard(m, aiOn, key)).join('')
    : '<div class="muted" style="padding:24px">ยังไม่มีข้อความรอตอบ 🎉</div>';
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  return `<!doctype html><html lang="th"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prinnie333 · Dashboard</title><style>
  :root{--gold:#D4AF37}
  *{box-sizing:border-box;font-family:'Segoe UI',Tahoma,sans-serif}
  body{margin:0;background:linear-gradient(160deg,#1c0f2e,#2A1B3D);color:#F6F1FF;padding:18px}
  h1{font-size:20px;margin:0 0 2px}.ts{color:#b9a9d6;font-size:12px;margin-bottom:14px}
  .tabs{display:flex;gap:6px;margin-bottom:16px}
  .tb{background:rgba(255,255,255,.06);border:1px solid rgba(212,175,55,.25);color:#c9bce4;
      padding:9px 18px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}
  .tb.on{background:var(--gold);color:#2A1B3D}
  .pane{display:none}.pane.on{display:block}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
  .card{background:rgba(255,255,255,.05);border:1px solid rgba(212,175,55,.25);border-radius:14px;padding:16px}
  .lbl{font-size:12px;color:#c9bce4;margin-bottom:6px}.val{font-size:30px;font-weight:700;color:#fff}
  .sub{font-size:11px;color:#a99cc8;margin-top:4px}
  .sec{margin-top:22px;font-size:14px;color:var(--gold);font-weight:600}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  td{padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.07)}.muted{color:#a99cc8}
  .pill{color:#fff;font-size:11px;padding:2px 8px;border-radius:20px}
  .icard{background:rgba(255,255,255,.05);border:1px solid rgba(212,175,55,.22);border-radius:14px;padding:14px;margin-bottom:12px}
  .icard.hi{border-left:3px solid #e0457b}
  .cat{color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px}
  .imeta{font-size:12px;color:#a99cc8;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .imeta b{color:#fff}.who{font-family:monospace;color:#9be}
  .imsg{margin:8px 0;font-size:14px;color:#F6F1FF}
  textarea{width:100%;background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.18);
           border-radius:8px;padding:9px;font:inherit;font-size:13px;resize:vertical;min-height:64px}
  .irow{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
  .irow button{border:none;border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer;font-weight:600;color:#fff}
  .ai{background:#6B3FA0}.snd{background:#1faa59}.cls{background:#555}
</style></head><body>
  <h1>🔮 Prinnie333 · Dashboard</h1>
  <div class="ts">อัปเดต ${now}</div>
  <div class="tabs">
    <button class="tb on" id="t-sub" onclick="tab('sub')">📊 Subscription</button>
    <button class="tb" id="t-sup" onclick="tab('sup')">🛟 Support <span id="ibadge">${msgs.length ? '('+msgs.length+')' : ''}</span></button>
  </div>

  <div class="pane on" id="p-sub">
    <div class="grid">
      ${card('💚 สมาชิก (ACTIVE)', s.active, 'มี monthly access', '#5CE6A1')}
      ${card('💰 MRR', '฿' + mrr, `${s.active} × ฿${PRICE}`, 'var(--gold)')}
      ${card('👥 ทั้งหมด', s.total, `conversion ${conv}%`)}
      ${card('⏳ รอจ่าย', s.pending, 'ยังไม่จ่าย', '#F0C868')}
      ${card('🆕 วันนี้', s.today)}
      ${card('📅 สัปดาห์นี้', s.this_week)}
      ${card('⚠️ ใกล้หมด (7วัน)', s.expiring_soon, '', s.expiring_soon ? '#F0A868' : undefined)}
      ${card('🗂️ EXPIRED/ยกเลิก', s.expired + s.cancelled, `EXP ${s.expired}·CAN ${s.cancelled}`)}
    </div>
    <div class="sec">รายชื่อสมัครล่าสุด</div>
    <table><tbody>${rows || '<tr><td class="muted">ยังไม่มีสมาชิก</td></tr>'}</tbody></table>
  </div>

  <div class="pane" id="p-sup">
    <div class="sec" style="margin-top:0">ข้อความลูกค้ารอตอบ ${aiOn ? '' : '· (ใส่ ANTHROPIC_API_KEY เพื่อเปิดปุ่ม AI ร่าง)'}</div>
    <div id="inbox">${inboxHtml}</div>
  </div>

<script>
  const KEY = ${JSON.stringify(key)};
  function tab(n){
    document.getElementById('p-sub').classList.toggle('on', n==='sub');
    document.getElementById('p-sup').classList.toggle('on', n==='sup');
    document.getElementById('t-sub').classList.toggle('on', n==='sub');
    document.getElementById('t-sup').classList.toggle('on', n==='sup');
  }
  async function post(url){ const r = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'}}); return r; }
  async function aiDraft(id){
    const ta = document.getElementById('r'+id); ta.value='⏳ กำลังร่าง…';
    const r = await fetch('/dashboard/inbox/'+id+'/draft?key='+encodeURIComponent(KEY), {method:'POST'});
    const j = await r.json();
    ta.value = j.draft || (j.error ? ('(AI error: '+j.error+')') : '(ไม่มีคำตอบ)');
  }
  async function reply(id){
    const text = document.getElementById('r'+id).value.trim();
    if(!text){ alert('พิมพ์คำตอบก่อน'); return; }
    const r = await fetch('/dashboard/inbox/'+id+'/reply?key='+encodeURIComponent(KEY),
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    if(r.ok){ document.getElementById('r'+id).closest('.icard').remove(); } else { alert('ส่งไม่สำเร็จ'); }
  }
  async function closeMsg(id){
    if(!confirm('ปิดเคสนี้?')) return;
    const r = await post('/dashboard/inbox/'+id+'/close?key='+encodeURIComponent(KEY));
    if(r.ok) document.getElementById('r'+id).closest('.icard').remove();
  }
  // poll inbox ทุก 20 วิ (เฉพาะตอนอยู่แท็บ support)
  setInterval(async ()=>{
    if(!document.getElementById('p-sup').classList.contains('on')) return;
    try{ const r = await fetch('/dashboard/inbox?key='+encodeURIComponent(KEY)); const j = await r.json();
      document.getElementById('ibadge').textContent = j.length ? '('+j.length+')' : ''; }catch(_){}
  }, 20000);
</script></body></html>`;
}

function register(app) {
  app.get('/dashboard', async (req, res) => {
    if (!ok(req)) return res.status(401).send('unauthorized');
    try {
      const [stats, msgs] = await Promise.all([getStats(), inbox.listOpen()]);
      res.set('Cache-Control', 'no-store').send(render(stats, msgs, supportAI.isEnabled(), req.query.key));
    } catch (e) { res.status(500).send('error: ' + esc(e.message)); }
  });

  app.get('/dashboard/inbox', async (req, res) => {
    if (!ok(req)) return res.status(401).json({ error: 'unauthorized' });
    try { res.json(await inbox.listOpen()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/dashboard/inbox/:id/draft', async (req, res) => {
    if (!ok(req)) return res.status(401).json({ error: 'unauthorized' });
    try {
      const m = (await db.query('SELECT message FROM support_inbox WHERE id=$1', [req.params.id])).rows[0];
      if (!m) return res.status(404).json({ error: 'not_found' });
      res.json(await supportAI.draft(req.params.id, m.message));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/dashboard/inbox/:id/reply', async (req, res) => {
    if (!ok(req)) return res.status(401).json({ error: 'unauthorized' });
    try {
      const text = (req.body && req.body.text || '').trim();
      if (!text) return res.status(400).json({ error: 'empty' });
      res.json(await inbox.reply(req.params.id, text));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/dashboard/inbox/:id/close', async (req, res) => {
    if (!ok(req)) return res.status(401).json({ error: 'unauthorized' });
    try { res.json(await inbox.close(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { register };
