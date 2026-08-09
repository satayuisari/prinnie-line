// หน้าจอแอดมินสำหรับระบบ affiliate — Bon ใช้งานได้ครบโดยไม่ต้องแตะ terminal
//   แท็บ Affiliates   : สร้างอินฟลู / ก๊อปลิงก์ / pause-off / KPI / promoter kit / รายงาน
//   แท็บ Commissions  : ค่าคอมทีละใบ → APPROVE → MARK PAID → REVERSE (ต้องมีเหตุผล)
//   แท็บ Recruitment  : CRM หาอินฟลู candidate → onboarded + ข้อความทาบทาม
// ใช้ auth เดิมของแดชบอร์ด (DASHBOARD_KEY) — ทุก endpoint การเงินอยู่หลังคีย์นี้
const affiliates = require('../services/affiliates');
const commission = require('../services/affiliateCommission');
const candidates = require('../services/affiliateCandidates');
const kit = require('../services/promoterKit');
const audit = require('../services/affiliateAudit');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ok = (req) => process.env.DASHBOARD_KEY && req.query.key === process.env.DASHBOARD_KEY;
const baht = n => '฿' + Number(n || 0).toLocaleString();
const STATUS_COLOR = { ACTIVE: '#5CE6A1', PAUSED: '#F0C868', OFF: '#8a8a8a' };
const COM_COLOR = { PENDING: '#F0C868', APPROVED: '#5CE6A1', PAID: '#7FD8E8', REVERSED: '#e0457b' };
const RECRUIT_COLOR = {
  CANDIDATE: '#8a8a8a', CONTACTED: '#7FD8E8', REPLIED: '#9b8ede', INTERESTED: '#F0C868',
  APPROVED: '#5CE6A1', ONBOARDED: '#D4AF37', DECLINED: '#b94646',
};

// ── ดึงข้อมูลทุกแท็บในรอบเดียว (หน้าแดชบอร์ด render ฝั่ง server) ──────────────
async function load() {
  const [perf, comList, comTotals, cands, funnel, outreach] = await Promise.all([
    affiliates.performance(),
    commission.list({ limit: 200 }),
    commission.totals(),
    candidates.list({}),
    candidates.funnel(),
    kit.getOutreach(),
  ]);
  return { perf, comList, comTotals, cands, funnel, outreach };
}

function card(label, value, sub, accent) {
  return `<div class="card"${accent ? ` style="border-color:${accent}66"` : ''}>
    <div class="lbl">${label}</div>
    <div class="val"${accent ? ` style="color:${accent}"` : ''}>${value}</div>
    ${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}

// ── แท็บ Affiliates ──────────────────────────────────────────────────────────
function affiliatesPane({ perf, comTotals }) {
  const rows = perf.map(a => `<tr>
    <td>
      <b>${esc(a.name)}</b> <span class="muted">(${esc(a.code)})</span>
      <span class="pill" style="background:${STATUS_COLOR[a.status] || '#888'};color:#2A1B3D">${a.status}</span>
      <div class="muted mono" style="font-size:11px;margin-top:3px">${esc(a.url)}</div>
      <div class="irow">
        <button class="mini cp" onclick="copyText('${esc(a.url)}', this)">📋 COPY LINK</button>
        <button class="mini" onclick="showKit('${esc(a.code)}')">🎁 Promoter Kit</button>
        <button class="mini" onclick="showReport('${esc(a.code)}')">📄 รายงาน</button>
        ${a.status === 'ACTIVE'
          ? `<button class="mini warn" onclick="affStatus('${esc(a.code)}','PAUSED')">⏸ PAUSE</button>
             <button class="mini danger" onclick="affStatus('${esc(a.code)}','OFF')">⛔ OFF</button>`
          : `<button class="mini good" onclick="affStatus('${esc(a.code)}','ACTIVE')">▶️ ACTIVE</button>`}
      </div>
    </td>
    <td class="num">${a.clicks}<div class="sub">คลิก</div></td>
    <td class="num">${a.registered}<div class="sub">${a.clickToReg}% ของคลิก</div></td>
    <td class="num" style="color:#5CE6A1;font-weight:700">${a.paid}<div class="sub">${a.regToPaid}% ของสมัคร</div></td>
    <td class="num">${baht(a.revenue)}<div class="sub">รายได้จริง</div></td>
    <td class="num">${baht(a.commission)}<div class="sub">P ${a.pending_amt} · A ${a.approved_amt} · จ่าย ${a.paid_amt}</div></td>
    <td class="num" style="font-weight:700">${a.paid ? baht(a.cac) : '—'}<div class="sub">CPA/CAC</div></td>
    <td class="num">${a.reversed}<div class="sub">refund ${a.refundRate}%</div></td>
  </tr>`).join('');

  return `
  <div class="sec" style="margin-top:0">➕ สร้างอินฟลูใหม่ — ไม่ต้องใช้ terminal</div>
  <div class="card">
    <div class="frow">
      <input id="af-name" placeholder="ชื่ออินฟลู เช่น หมอดูมัดหมี่">
      <input id="af-code" placeholder="รหัส (เว้นว่าง = ตั้งให้อัตโนมัติ)">
      <button class="mini good" onclick="createAff()">+ Create Affiliate</button>
    </div>
    <div id="af-result" class="sub" style="margin-top:8px"></div>
  </div>

  <div class="sec">ผลงานอินฟลู — ค่าคอม ${kit.COMMISSION_RULE}</div>
  <div class="grid">
    ${card('💵 ค้างจ่าย (PENDING)', baht(comTotals.pending), `${comTotals.pending_n} รายการ · ยังอยู่ใน hold`, '#F0C868')}
    ${card('✅ พร้อมจ่าย (APPROVED)', baht(comTotals.approved), `${comTotals.approved_n} รายการ`, '#5CE6A1')}
    ${card('💸 จ่ายแล้ว (PAID)', baht(comTotals.paid), `${comTotals.paid_n} รายการ`, '#7FD8E8')}
    ${card('❌ ตัดทิ้ง (REVERSED)', baht(comTotals.reversed), `${comTotals.reversed_n} รายการ`, '#e0457b')}
  </div>
  ${perf.length ? `<div class="scroll"><table>
    <thead><tr><td>อินฟลู</td><td class="num">คลิก</td><td class="num">สมัคร</td><td class="num">จ่ายจริง</td>
      <td class="num">รายได้</td><td class="num">ค่าคอม</td><td class="num">CAC</td><td class="num">refund</td></tr></thead>
    <tbody>${rows}</tbody></table></div>`
    : '<div class="muted" style="padding:12px">ยังไม่มีอินฟลู — สร้างจากช่องด้านบนได้เลย</div>'}
  <div id="kitbox"></div>`;
}

// ── แท็บ Commissions ────────────────────────────────────────────────────────
function commissionsPane({ comList, comTotals }) {
  const rows = comList.map(c => `<tr${c.needs_review ? ' class="review"' : ''}>
    <td>${esc(c.affiliate_name || c.affiliate_code)}<div class="muted" style="font-size:11px">${esc(c.affiliate_code)}</div></td>
    <td class="mono" style="font-size:11px">${esc((c.line_user_id || '').slice(0, 12))}…</td>
    <td class="mono" style="font-size:11px">${esc(c.order_ref || '—')}</td>
    <td class="num">${baht(c.revenue_amount)}</td>
    <td class="num" style="font-weight:700">${baht(c.amount)}</td>
    <td><span class="pill" style="background:${COM_COLOR[c.status]};color:#2A1B3D">${c.status}</span>
        ${c.needs_review ? '<div class="sub" style="color:#e0457b">⚠️ รอตรวจสอบ</div>' : ''}
        ${c.reason ? `<div class="sub">${esc(c.reason)}</div>` : ''}</td>
    <td class="muted" style="font-size:11px">${esc(c.created || '')}<div class="sub">hold→${esc(c.hold || '')}</div></td>
    <td class="muted" style="font-size:11px">${esc(c.approved || '—')}</td>
    <td class="muted" style="font-size:11px">${esc(c.paid_on || '—')}</td>
    <td class="irow">
      ${c.status === 'PENDING' ? `<button class="mini good" onclick="comAct(${c.id},'approve')">APPROVE</button>` : ''}
      ${c.status === 'APPROVED' ? `<button class="mini cp" onclick="comAct(${c.id},'paid')">MARK PAID</button>` : ''}
      ${c.status !== 'REVERSED' ? `<button class="mini danger" onclick="comReverse(${c.id})">REVERSE</button>` : ''}
    </td>
  </tr>`).join('');

  return `
  <div class="grid" style="margin-top:0">
    ${card('⏳ PENDING', baht(comTotals.pending), `${comTotals.pending_n} รายการ`, '#F0C868')}
    ${card('✅ APPROVED', baht(comTotals.approved), `${comTotals.approved_n} รายการ`, '#5CE6A1')}
    ${card('💸 PAID', baht(comTotals.paid), `${comTotals.paid_n} รายการ`, '#7FD8E8')}
    ${card('❌ REVERSED', baht(comTotals.reversed), `${comTotals.reversed_n} รายการ`, '#e0457b')}
  </div>
  <div class="irow" style="margin-top:12px">
    <button class="mini good" onclick="approveDue()">✅ APPROVE ทุกใบที่พ้น hold</button>
    ${comTotals.review_n ? `<span class="pill" style="background:#e0457b">⚠️ ${comTotals.review_n} ใบรอแอดมินตรวจ (refund หลังจ่ายแล้ว)</span>` : ''}
  </div>
  <div class="sec">รายการค่าคอมทั้งหมด — จ่ายอินฟลูเฉพาะใบที่ APPROVED เท่านั้น</div>
  ${comList.length ? `<div class="scroll"><table>
    <thead><tr><td>อินฟลู</td><td>ลูกค้า</td><td>ออเดอร์</td><td class="num">รายได้</td><td class="num">ค่าคอม</td>
      <td>สถานะ</td><td>สร้าง</td><td>อนุมัติ</td><td>จ่าย</td><td>จัดการ</td></tr></thead>
    <tbody>${rows}</tbody></table></div>`
    : '<div class="muted" style="padding:12px">ยังไม่มีค่าคอม — เกิดขึ้นเองเมื่อลูกค้าที่มาจากลิงก์อินฟลูชำระเงินครั้งแรก</div>'}`;
}

// ── แท็บ Recruitment ────────────────────────────────────────────────────────
// ตารางรายชื่อ — ใช้ทั้งตอน render หน้าแรกและตอนค้นหา/กรอง (เปลี่ยนเฉพาะตารางไม่โหลดทั้งหน้า)
function candidatesTable(cands) {
  if (!cands.length) return '<div class="muted" style="padding:12px">ไม่พบรายชื่อตามเงื่อนไขนี้</div>';
  const rows = cands.map(c => `<tr>
    <td><b>${esc(c.display_name)}</b>
      <div class="muted" style="font-size:11px">${esc(c.platform || '—')}${c.category ? ' · ' + esc(c.category) : ''}
        ${c.followers ? ' · ' + Number(c.followers).toLocaleString() + ' ผู้ติดตาม' : ''}</div>
      ${c.profile_url ? `<a class="link" href="${esc(c.profile_url)}" target="_blank" rel="noopener">เปิดโปรไฟล์ ↗</a>` : ''}
      ${c.affiliate_code ? `<div class="sub">→ อินฟลู <b>${esc(c.affiliate_code)}</b></div>` : ''}</td>
    <td class="muted" style="font-size:11px">${esc(c.contact_method || '—')}<div>${esc(c.contact_value || '')}</div></td>
    <td class="num" style="font-weight:700">${c.total_score}<div class="sub">/30</div></td>
    <td>
      <select class="mini" onchange="candStatus(${c.id}, this.value)">
        ${candidates.STATUSES.map(s => `<option value="${s}"${s === c.recruitment_status ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
      <div class="sub"><span class="pill" style="background:${RECRUIT_COLOR[c.recruitment_status]};color:#2A1B3D">${c.recruitment_status}</span></div>
      ${c.contacted ? `<div class="sub">ติดต่อล่าสุด ${esc(c.contacted)}</div>` : ''}
    </td>
    <td style="min-width:160px">
      <div class="muted" style="font-size:11px;white-space:pre-wrap">${esc(c.notes || '')}</div>
      <div class="irow">
        <button class="mini" onclick="candNote(${c.id})">+ โน้ต</button>
        <button class="mini" onclick="candEdit(${c.id})">แก้ไข</button>
        ${c.recruitment_status === 'APPROVED' && !c.affiliate_code
          ? `<button class="mini good" onclick="candConvert(${c.id})">→ สร้างอินฟลู</button>` : ''}
      </div>
    </td>
  </tr>`).join('');
  return `<table><thead><tr><td>ชื่อ</td><td>ติดต่อ</td><td class="num">คะแนน</td><td>สถานะ</td><td>โน้ต</td></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function recruitmentPane({ cands, funnel, outreach }) {
  const opts = candidates.STATUSES.map(s => `<option value="${s}">${s}</option>`).join('');
  return `
  <div class="grid" style="margin-top:0">
    ${card('🎯 รายชื่อทั้งหมด', funnel.total, `CANDIDATE ${funnel.candidate}`)}
    ${card('📨 ทาบทามแล้ว', funnel.contacted, `ตอบกลับ ${funnel.replied}`, '#7FD8E8')}
    ${card('🙌 สนใจ', funnel.interested, `อนุมัติ ${funnel.approved}`, '#F0C868')}
    ${card('🤝 เปิดใช้งานแล้ว', funnel.onboarded, `อินฟลู ACTIVE ${funnel.active_affiliates}`, '#5CE6A1')}
    ${card('💰 มีลูกค้าจ่ายจริง', funnel.affiliates_with_paid, `จากอินฟลู ${funnel.total_affiliates} คน`, 'var(--gold)')}
  </div>
  <div class="sec">funnel: Candidate ${funnel.candidate} → Contacted ${funnel.contacted} → Replied ${funnel.replied}
    → Interested ${funnel.interested} → Approved ${funnel.approved} → Onboarded ${funnel.onboarded}
    → มีลูกค้าจ่าย ${funnel.affiliates_with_paid}${funnel.declined ? ` · ปฏิเสธ ${funnel.declined}` : ''}</div>

  <div class="sec">➕ เพิ่มรายชื่อ (กรอกแค่ชื่อก็ได้)</div>
  <div class="card">
    <input type="hidden" id="cd-id">
    <div class="frow">
      <input id="cd-name" placeholder="ชื่อ *">
      <input id="cd-platform" placeholder="แพลตฟอร์ม (tiktok/ig/yt)">
      <input id="cd-category" placeholder="หมวด (ดูดวง/ไลฟ์สไตล์)">
      <input id="cd-followers" placeholder="ผู้ติดตาม" inputmode="numeric">
    </div>
    <div class="frow">
      <input id="cd-url" placeholder="ลิงก์โปรไฟล์">
      <input id="cd-method" placeholder="ช่องทางติดต่อ (LINE/IG DM)">
      <input id="cd-contact" placeholder="ไอดี/เบอร์/อีเมล">
    </div>
    <div class="frow scores">
      <label>ตรงกลุ่ม<input id="cd-s1" type="number" min="0" max="5" value="0"></label>
      <label>engagement<input id="cd-s2" type="number" min="0" max="5" value="0"></label>
      <label>คอนเทนต์<input id="cd-s3" type="number" min="0" max="5" value="0"></label>
      <label>ความน่าเชื่อถือ<input id="cd-s4" type="number" min="0" max="5" value="0"></label>
      <label>ชวนกดเป็น<input id="cd-s5" type="number" min="0" max="5" value="0"></label>
      <label>brand safety<input id="cd-s6" type="number" min="0" max="5" value="0"></label>
    </div>
    <div class="frow">
      <input id="cd-notes" placeholder="โน้ต">
      <button class="mini good" onclick="saveCand()">บันทึก</button>
      <button class="mini" onclick="resetCand()">ล้างฟอร์ม</button>
    </div>
  </div>

  <div class="sec">📨 ข้อความทาบทาม (แก้แล้วกดบันทึกเก็บเป็นค่าเริ่มต้น)</div>
  <textarea id="outreach" rows="9">${esc(outreach)}</textarea>
  <div class="irow">
    <button class="mini cp" onclick="copyText(document.getElementById('outreach').value, this)">📋 COPY</button>
    <button class="mini good" onclick="saveOutreach()">บันทึกเป็นค่าเริ่มต้น</button>
  </div>

  <div class="sec">รายชื่อ (${cands.length})</div>
  <div class="frow">
    <input id="cd-q" placeholder="ค้นหาชื่อ/แพลตฟอร์ม/หมวด" oninput="reloadCands()">
    <select id="cd-filter" onchange="reloadCands()"><option value="">ทุกสถานะ</option>${opts}</select>
    <select id="cd-sort" onchange="reloadCands()">
      <option value="score">เรียงตามคะแนน</option><option value="followers">ผู้ติดตาม</option>
      <option value="new">ใหม่สุด</option><option value="name">ชื่อ</option></select>
  </div>
  <div class="scroll" id="cdtable">${candidatesTable(cands)}</div>`;
}

// ── CSS + JS ที่แท็บใหม่ใช้ (ฝังในหน้าเดิม) ─────────────────────────────────
const styles = `
  .scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .scroll table{min-width:620px}
  thead td{color:#a99cc8;font-size:11px;white-space:nowrap}
  td.num{text-align:right;white-space:nowrap}
  .mono{font-family:ui-monospace,Menlo,monospace}
  .mini{border:none;border-radius:8px;padding:7px 11px;font-size:12px;font-weight:600;cursor:pointer;
        background:rgba(255,255,255,.12);color:#F6F1FF}
  .mini.good{background:#1faa59}.mini.warn{background:#C98A00}.mini.danger{background:#b94646}.mini.cp{background:#3f6fa0}
  select.mini{padding:6px 8px}
  .frow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
  .frow input{flex:1 1 150px;min-width:120px;background:rgba(255,255,255,.07);color:#fff;
    border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:9px;font:inherit;font-size:13px}
  .frow select{background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.18);
    border-radius:8px;padding:9px;font-size:13px}
  .frow.scores label{display:flex;flex-direction:column;font-size:10px;color:#a99cc8;gap:2px}
  .frow.scores input{width:64px;flex:0 0 auto}
  .link{color:#7FD8E8;font-size:11px;text-decoration:none}
  tr.review{background:rgba(224,69,123,.12)}
  #kitbox pre{white-space:pre-wrap;background:rgba(0,0,0,.25);border-radius:10px;padding:12px;font-size:12px;
    max-height:340px;overflow:auto}
  @media(max-width:600px){.val{font-size:22px}}
`;

const script = `
  async function api(url, body){
    const r = await fetch(url + (url.includes('?')?'&':'?') + 'key=' + encodeURIComponent(KEY),
      {method:'POST', headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined});
    let j = {}; try{ j = await r.json(); }catch(_){}
    if(!r.ok || j.error){ alert('ไม่สำเร็จ: ' + (j.error || r.status)); return null; }
    return j;
  }
  function copyText(t, btn){
    navigator.clipboard.writeText(t).then(()=>{ if(btn){ const o=btn.textContent; btn.textContent='✓ ก๊อปแล้ว';
      setTimeout(()=>btn.textContent=o,1500);} }).catch(()=>prompt('ก๊อปข้อความนี้:', t));
  }
  async function createAff(){
    const name=document.getElementById('af-name').value.trim();
    const code=document.getElementById('af-code').value.trim();
    if(!name){ alert('ใส่ชื่ออินฟลูก่อน'); return; }
    const j = await api('/dashboard/affiliate/create', {name, code});
    if(!j) return;
    document.getElementById('af-result').innerHTML =
      '✅ สร้างแล้ว: <b>'+j.name+'</b> ('+j.code+')<br><span class="mono">'+j.url+'</span>';
    copyText(j.url);
    setTimeout(()=>location.reload(), 1200);
  }
  async function affStatus(code, status){
    let reason = null;
    if(status!=='ACTIVE'){ reason = prompt('เหตุผลที่หยุด '+code+' (ใส่ไว้ให้ตรวจย้อนหลังได้)'); if(reason===null) return; }
    if(await api('/dashboard/affiliate/'+code+'/status', {status, reason})) location.reload();
  }
  async function showKit(code){
    const r = await fetch('/dashboard/affiliate/'+code+'/kit?key='+encodeURIComponent(KEY));
    const j = await r.json();
    document.getElementById('kitbox').innerHTML =
      '<div class="sec">🎁 Promoter Kit — '+j.name+'</div><pre id="kittext">'+
      j.text.replace(/[<>&]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</pre>'+
      '<div class="irow"><button class="mini cp" onclick="copyText(document.getElementById(\\'kittext\\').textContent, this)">📋 COPY ทั้งชุด</button>'+
      '<button class="mini" onclick="copyText('+JSON.stringify(j.url)+', this)">📋 COPY LINK</button>'+
      '<button class="mini" onclick="document.getElementById(\\'kitbox\\').innerHTML=\\'\\'">ปิด</button></div>';
    document.getElementById('kitbox').scrollIntoView({behavior:'smooth'});
  }
  async function showReport(code){
    const r = await fetch('/dashboard/affiliate/'+code+'/report?key='+encodeURIComponent(KEY));
    const t = await r.text();
    document.getElementById('kitbox').innerHTML =
      '<div class="sec">📄 รายงานส่งอินฟลู</div><pre id="kittext">'+
      t.replace(/[<>&]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</pre>'+
      '<div class="irow"><button class="mini cp" onclick="copyText(document.getElementById(\\'kittext\\').textContent, this)">📋 COPY</button>'+
      '<button class="mini" onclick="document.getElementById(\\'kitbox\\').innerHTML=\\'\\'">ปิด</button></div>';
    document.getElementById('kitbox').scrollIntoView({behavior:'smooth'});
  }
  async function comAct(id, act){
    const label = act==='approve' ? 'อนุมัติค่าคอมใบนี้ (พร้อมจ่าย)?' : 'ยืนยันว่าโอนเงินให้อินฟลูแล้ว?';
    if(!confirm(label)) return;
    if(await api('/dashboard/commission/'+id+'/'+act)) location.reload();
  }
  async function approveDue(){
    if(!confirm('อนุมัติค่าคอมทุกใบที่พ้นช่วง hold แล้ว?')) return;
    const j = await api('/dashboard/commission/approve-due');
    if(j){ alert('อนุมัติ '+j.count+' ใบ'); location.reload(); }
  }
  async function comReverse(id){
    const reason = prompt('เหตุผลที่ตัดค่าคอมใบนี้ (เช่น ลูกค้า refund / ทุจริต) — บังคับกรอก');
    if(!reason || !reason.trim()) return;
    if(!confirm('ยืนยันตัดค่าคอมใบ #'+id+' ?\\nเหตุผล: '+reason)) return;
    const j = await api('/dashboard/commission/'+id+'/reverse', {reason});
    if(j){ alert(j.message || 'ตัดค่าคอมแล้ว'); location.reload(); }
  }
  function candFields(){
    return {
      display_name: v('cd-name'), platform: v('cd-platform'), category: v('cd-category'),
      followers: v('cd-followers'), profile_url: v('cd-url'), contact_method: v('cd-method'),
      contact_value: v('cd-contact'), notes: v('cd-notes'),
      score_audience_fit: v('cd-s1'), score_engagement: v('cd-s2'), score_content: v('cd-s3'),
      score_trust: v('cd-s4'), score_cta: v('cd-s5'), score_brand_safety: v('cd-s6'),
    };
  }
  function v(id){ return document.getElementById(id).value.trim(); }
  function resetCand(){ ['cd-id','cd-name','cd-platform','cd-category','cd-followers','cd-url','cd-method','cd-contact','cd-notes']
    .forEach(i=>document.getElementById(i).value='');
    ['cd-s1','cd-s2','cd-s3','cd-s4','cd-s5','cd-s6'].forEach(i=>document.getElementById(i).value='0'); }
  async function saveCand(){
    if(!v('cd-name')){ alert('ใส่ชื่อก่อน'); return; }
    const id = v('cd-id');
    if(await api('/dashboard/candidate' + (id?'/'+id:''), candFields())) location.reload();
  }
  async function candEdit(id){
    const r = await fetch('/dashboard/candidate/'+id+'?key='+encodeURIComponent(KEY));
    const c = await r.json();
    const set=(i,val)=>document.getElementById(i).value = val==null?'':val;
    set('cd-id',c.id); set('cd-name',c.display_name); set('cd-platform',c.platform); set('cd-category',c.category);
    set('cd-followers',c.followers); set('cd-url',c.profile_url); set('cd-method',c.contact_method);
    set('cd-contact',c.contact_value); set('cd-notes',c.notes);
    set('cd-s1',c.score_audience_fit); set('cd-s2',c.score_engagement); set('cd-s3',c.score_content);
    set('cd-s4',c.score_trust); set('cd-s5',c.score_cta); set('cd-s6',c.score_brand_safety);
    document.getElementById('cd-name').scrollIntoView({behavior:'smooth'});
  }
  async function candStatus(id, status){ if(await api('/dashboard/candidate/'+id+'/status', {status})) location.reload(); }
  async function candNote(id){
    const note = prompt('เพิ่มโน้ต'); if(!note) return;
    if(await api('/dashboard/candidate/'+id+'/note', {note})) location.reload();
  }
  async function candConvert(id){
    const code = prompt('รหัสอินฟลู (เว้นว่าง = ตั้งให้อัตโนมัติ)'); if(code===null) return;
    const j = await api('/dashboard/candidate/'+id+'/convert', {code});
    if(j){ copyText(j.url); alert('✅ สร้างอินฟลู '+j.code+'\\n'+j.url+'\\n(ก๊อปลิงก์ให้แล้ว)'); location.reload(); }
  }
  async function saveOutreach(){
    if(await api('/dashboard/outreach', {text: document.getElementById('outreach').value})) alert('บันทึกแล้ว');
  }
  let cdTimer;
  function reloadCands(){
    clearTimeout(cdTimer);
    cdTimer = setTimeout(async ()=>{
      const p = new URLSearchParams({key:KEY, q:v('cd-q'), status:v('cd-filter'), sort:v('cd-sort')});
      const r = await fetch('/dashboard/candidates?'+p.toString());
      document.getElementById('cdtable').innerHTML = await r.text();
    }, 250);
  }
`;

// ── endpoints ────────────────────────────────────────────────────────────────
function register(app) {
  const guard = (req, res) => { if (!ok(req)) { res.status(401).json({ error: 'unauthorized' }); return false; } return true; };
  const fail = (res, e) => { console.error('[affiliate-admin]', e.message); res.status(400).json({ error: e.message }); };

  app.post('/dashboard/affiliate/create', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await affiliates.create({ name: req.body?.name, code: req.body?.code })); }
    catch (e) { fail(res, e); }
  });

  app.post('/dashboard/affiliate/:code/status', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await affiliates.setStatus(req.params.code, req.body?.status, { reason: req.body?.reason })); }
    catch (e) { fail(res, e); }
  });

  app.get('/dashboard/affiliate/:code/kit', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await kit.kit(req.params.code)); } catch (e) { fail(res, e); }
  });

  app.get('/dashboard/affiliate/:code/report', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.type('text/plain; charset=utf-8').send(await kit.report(req.params.code)); } catch (e) { fail(res, e); }
  });

  app.post('/dashboard/commission/approve-due', async (req, res) => {
    if (!guard(req, res)) return;
    try { const rows = await commission.approve('due'); res.json({ ok: true, count: rows.length }); }
    catch (e) { fail(res, e); }
  });

  app.post('/dashboard/commission/:id/approve', async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const rows = await commission.approve(req.params.id);
      if (!rows.length) return res.status(400).json({ error: 'ใบนี้ไม่ได้อยู่สถานะ PENDING' });
      res.json({ ok: true, id: rows[0].id });
    } catch (e) { fail(res, e); }
  });

  app.post('/dashboard/commission/:id/paid', async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const rows = await commission.markPaid({ id: req.params.id });
      if (!rows.length) return res.status(400).json({ error: 'ใบนี้ไม่ได้อยู่สถานะ APPROVED' });
      res.json({ ok: true, id: rows[0].id });
    } catch (e) { fail(res, e); }
  });

  app.post('/dashboard/commission/:id/reverse', async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const r = await commission.reverse(req.params.id, req.body?.reason);
      // จ่ายไปแล้ว = ไม่ตัดเงียบ ๆ แต่ตั้งธงรอตรวจ → ตอบ 200 พร้อมข้อความให้แอดมินเห็น
      res.json(r.ok ? { ok: true, message: 'ตัดค่าคอมแล้ว (REVERSED)' }
                    : r.flagged ? { ok: true, message: '⚠️ ' + r.reason }
                                : { error: r.reason });
    } catch (e) { fail(res, e); }
  });

  app.post('/dashboard/candidate', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await candidates.create(req.body || {})); } catch (e) { fail(res, e); }
  });

  app.get('/dashboard/candidate/:id', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await candidates.get(req.params.id)); } catch (e) { fail(res, e); }
  });

  app.post('/dashboard/candidate/:id', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await candidates.update(req.params.id, req.body || {})); } catch (e) { fail(res, e); }
  });

  app.post('/dashboard/candidate/:id/status', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await candidates.setStatus(req.params.id, req.body?.status)); } catch (e) { fail(res, e); }
  });

  app.post('/dashboard/candidate/:id/note', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await candidates.addNote(req.params.id, req.body?.note)); } catch (e) { fail(res, e); }
  });

  app.post('/dashboard/candidate/:id/convert', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await candidates.convert(req.params.id, { code: req.body?.code })); } catch (e) { fail(res, e); }
  });

  // ตารางรายชื่อ (ค้นหา/กรอง/เรียง) — คืนเฉพาะตาราง เอาไปแทนในหน้าเลย ไม่ต้องโหลดใหม่ทั้งหน้า
  app.get('/dashboard/candidates', async (req, res) => {
    if (!ok(req)) return res.status(401).send('unauthorized');
    try {
      const cands = await candidates.list({
        q: req.query.q || '', status: req.query.status || '', sort: req.query.sort || 'score' });
      res.type('html').send(candidatesTable(cands));
    } catch (e) { console.error('[affiliate-admin] candidates:', e.message); res.status(500).send('error'); }
  });

  app.post('/dashboard/outreach', async (req, res) => {
    if (!guard(req, res)) return;
    try { await kit.setOutreach(req.body?.text); res.json({ ok: true }); } catch (e) { fail(res, e); }
  });

  app.get('/dashboard/audit', async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json(await audit.recent(200)); } catch (e) { fail(res, e); }
  });
}

module.exports = { register, load, affiliatesPane, commissionsPane, recruitmentPane, styles, script };
