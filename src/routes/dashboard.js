// Dashboard เว็บ — 2 แท็บ: Subscription (ตัวเลข/รายชื่อ) + Support (inbox ลูกค้า + ตอบกลับ)
// เปิด: https://<host>/dashboard?key=DASHBOARD_KEY
const db = require('../db');
const inbox = require('../services/supportInbox');
const supportAI = require('../services/supportAI');
const triage = require('../services/supportTriage');
const orders = require('../services/paymentOrders');
const subscribers = require('../services/subscriberService');
const lineMessaging = require('../services/lineMessaging');

const PRICE = 399;
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ok = (req) => process.env.DASHBOARD_KEY && req.query.key === process.env.DASHBOARD_KEY;

async function getStats() {
  const s = (await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE chart_data IS NOT NULL)::int AS registered,
      COUNT(*) FILTER (WHERE chart_data IS NOT NULL AND status='PENDING')::int AS pending_reg,
      COUNT(*) FILTER (WHERE status='ACTIVE')::int    AS active,
      COUNT(*) FILTER (WHERE status='ACTIVE' AND payment_ref IS NOT NULL
                        AND payment_ref NOT IN ('tester','free-trial','free'))::int AS paying,
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

// การ์ดออเดอร์ PromptPay ที่รอ staff อนุมัติ (มีปุ่มดูสลิป + อนุมัติ +30 วัน)
function payCard(o, key) {
  const baht = (o.amount / 100).toLocaleString();
  const k = encodeURIComponent(key);
  const slip = o.slip_message_id
    ? `<a class="sliplink" href="/dashboard/payment/${o.ref}/slip?key=${k}" target="_blank">🧾 ดูสลิป</a>`
    : `<span class="muted">⏳ ยังไม่ส่งสลิป</span>`;
  return `<div class="icard${o.slip_message_id ? ' hi-pay' : ''}">
    <div class="imeta">
      <span class="cat" style="background:#1faa59">฿${baht}</span>
      <span class="who">${esc(o.line_user_id).slice(0, 14)}…</span>
      <span class="muted">${o.slip_at ? 'สลิป ' + esc(o.slip_at) : 'สร้าง ' + esc(o.created)}</span>
      <span class="muted" style="font-family:monospace">${esc(o.ref)}</span></div>
    <div class="irow">
      ${slip}
      <button class="snd" onclick="approve('${o.ref}')">✅ อนุมัติ +30 วัน</button>
    </div></div>`;
}

function render({ s, recent }, msgs, pays, aiOn, key) {
  const mrr = (s.paying * PRICE).toLocaleString();   // นับเฉพาะลูกค้าจ่ายจริง (ตัด tester/free/admin)
  // funnel: ผู้ติดตาม → ลงทะเบียนดวง → สมาชิกจ่ายเงิน
  const regRate = s.total ? Math.round(s.registered / s.total * 100) : 0;       // แอด → ลงทะเบียน (จุดที่อุด 966→14)
  const payRate = s.registered ? Math.round(s.active / s.registered * 100) : 0; // ลงทะเบียน → จ่าย
  const badge = st => ({ ACTIVE:'#1faa59', PENDING:'#C98A00', EXPIRED:'#8a8a8a', CANCELLED:'#b94646' }[st] || '#888');
  const rows = recent.map(r => `<tr><td>${esc(r.display_name || r.nickname || '(ไม่มีชื่อ)')}</td>
    <td><span class="pill" style="background:${badge(r.status)}">${r.status}</span></td>
    <td class="muted">${esc(r.created)}</td></tr>`).join('');
  const inboxHtml = msgs.length ? msgs.map(m => inboxCard(m, aiOn, key)).join('')
    : '<div class="muted" style="padding:24px">ยังไม่มีข้อความรอตอบ 🎉</div>';
  const payHtml = pays.length ? pays.map(o => payCard(o, key)).join('')
    : '<div class="muted" style="padding:24px">ไม่มีรายการรอตรวจสอบการชำระเงิน 🎉</div>';
  const slipWaiting = pays.filter(o => o.slip_message_id).length;   // ส่งสลิปแล้ว รออนุมัติ
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
  .icard.hi-pay{border-left:3px solid #1faa59}
  .sliplink{display:inline-flex;align-items:center;background:rgba(127,216,232,.15);color:#7FD8E8;
            border:1px solid rgba(127,216,232,.4);border-radius:8px;padding:8px 12px;font-size:12px;
            font-weight:600;text-decoration:none}
</style></head><body>
  <h1>🔮 Prinnie333 · Dashboard</h1>
  <div class="ts">อัปเดต ${now}</div>
  <div class="tabs">
    <button class="tb on" id="t-sub" onclick="tab('sub')">📊 Subscription</button>
    <button class="tb" id="t-pay" onclick="tab('pay')">💸 Payments <span id="pbadge">${slipWaiting ? '('+slipWaiting+')' : ''}</span></button>
    <button class="tb" id="t-sup" onclick="tab('sup')">🛟 Support <span id="ibadge">${msgs.length ? '('+msgs.length+')' : ''}</span></button>
  </div>

  <div class="pane on" id="p-sub">
    <div class="sec" style="margin-top:0">🫙 Funnel — ผู้ติดตาม → ลงทะเบียน → จ่าย</div>
    <div class="grid">
      ${card('👥 ผู้ติดตาม (บันทึก)', s.total, 'นับตั้งแต่เปิด track')}
      ${card('📝 ลงทะเบียนดวง', s.registered, `${regRate}% ของผู้ติดตาม`, '#7FD8E8')}
      ${card('💚 สมาชิก (ACTIVE)', s.active, `${payRate}% ของผู้ลงทะเบียน`, '#5CE6A1')}
      ${card('💰 MRR', '฿' + mrr, `${s.paying} จ่ายจริง × ฿${PRICE}`, 'var(--gold)')}
    </div>
    <div class="sec">รายละเอียด</div>
    <div class="grid">
      ${card('⏳ ลงทะเบียนแล้ว รอจ่าย', s.pending_reg, 'มีดวงแล้ว ยังไม่สมัคร', '#F0C868')}
      ${card('🆕 แอดวันนี้', s.today)}
      ${card('📅 แอดสัปดาห์นี้', s.this_week)}
      ${card('⚠️ ใกล้หมด (7วัน)', s.expiring_soon, '', s.expiring_soon ? '#F0A868' : undefined)}
      ${card('🗂️ EXPIRED/ยกเลิก', s.expired + s.cancelled, `EXP ${s.expired}·CAN ${s.cancelled}`)}
    </div>
    <div class="sec">รายชื่อสมัครล่าสุด</div>
    <table><tbody>${rows || '<tr><td class="muted">ยังไม่มีสมาชิก</td></tr>'}</tbody></table>
  </div>

  <div class="pane" id="p-pay">
    <div class="sec" style="margin-top:0">PromptPay รอตรวจสอบ — โอนแล้วส่งสลิปเข้าแชท · กดดูสลิป → อนุมัติ +30 วัน</div>
    <div id="pays">${payHtml}</div>
  </div>

  <div class="pane" id="p-sup">
    <div class="sec" style="margin-top:0">ข้อความลูกค้ารอตอบ ${aiOn ? '' : '· (ใส่ ANTHROPIC_API_KEY เพื่อเปิดปุ่ม AI ร่าง)'}</div>
    <div id="inbox">${inboxHtml}</div>
  </div>

<script>
  const KEY = ${JSON.stringify(key)};
  function tab(n){
    ['sub','pay','sup'].forEach(x=>{
      document.getElementById('p-'+x).classList.toggle('on', n===x);
      document.getElementById('t-'+x).classList.toggle('on', n===x);
    });
  }
  async function approve(ref){
    if(!confirm('ยืนยันการชำระเงิน + เปิดสมาชิก +30 วัน?')) return;
    const r = await post('/dashboard/payment/'+ref+'/approve?key='+encodeURIComponent(KEY));
    if(r.ok){ const j=await r.json(); document.querySelector('[onclick="approve(\\''+ref+'\\')"]').closest('.icard').remove();
      alert(j.already ? 'อนุมัติไปแล้วก่อนหน้านี้' : '✅ เปิดสมาชิกแล้ว ถึง '+(j.expire||'').slice(0,10)); }
    else { alert('อนุมัติไม่สำเร็จ'); }
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
      const [stats, msgs, pays] = await Promise.all([
        getStats(), inbox.listOpen(), orders.listPendingPromptpay(),
      ]);
      res.set('Cache-Control', 'no-store').send(render(stats, msgs, pays, supportAI.isEnabled(), req.query.key));
    } catch (e) { res.status(500).send('error: ' + esc(e.message)); }
  });

  // รูปสลิปของออเดอร์ (ดึงจาก LINE ด้วย messageId) — สตรีมเป็นรูปให้ staff ดู
  app.get('/dashboard/payment/:ref/slip', async (req, res) => {
    if (!ok(req)) return res.status(401).send('unauthorized');
    try {
      const o = await orders.get(req.params.ref);
      if (!o || !o.slip_message_id) return res.status(404).send('no slip');
      const buf = await lineMessaging.getMessageContent(o.slip_message_id);
      if (!buf) return res.status(502).send('slip unavailable (อาจหมดอายุ — ขอให้ลูกค้าส่งใหม่)');
      res.set('Content-Type', 'image/jpeg').set('Cache-Control', 'no-store').send(buf);
    } catch (e) { res.status(500).send('error: ' + esc(e.message)); }
  });

  // staff อนุมัติการชำระเงิน → mark PAID (idempotent) + เปิดสมาชิก +30 วัน + แจ้งลูกค้า
  app.post('/dashboard/payment/:ref/approve', async (req, res) => {
    if (!ok(req)) return res.status(401).json({ error: 'unauthorized' });
    try {
      const o = await orders.get(req.params.ref);
      if (!o) return res.status(404).json({ error: 'not_found' });
      if (o.status === 'PAID') return res.json({ ok: true, already: true });
      if (!(await orders.markPaid(o.ref, 'promptpay-slip'))) return res.json({ ok: true, already: true });

      const r = await subscribers.activateSubscription(o.line_user_id, o.ref, 30);
      const expTH = new Date(r.expire_date).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      await lineMessaging.pushText(o.line_user_id,
        `ชำระเงินสำเร็จ! ✨\n\nสมาชิก Prinnie333 ของคุณใช้ได้ถึง ${expTH}\nรับดวงประจำวันทุกเช้า 08:00 น. 🌟`).catch(() => {});
      console.log(`[dashboard] approved ${o.ref} → activated ${o.line_user_id} until ${r.expire_date}`);
      res.json({ ok: true, expire: r.expire_date });
    } catch (e) { console.error('[dashboard] approve:', e.message); res.status(500).json({ error: e.message }); }
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
