// หน้ายอดขาย — /dashboard/sales?key=DASHBOARD_KEY
// ตัวเลขทั้งหมดมาจาก services/salesReport.js (เงินจริง = payment_orders ที่ PAID)
// ต้นทุนแคมเปญ bon กรอกเองบนหน้า (เก็บในเบราว์เซอร์) → คิดความคุ้มให้ทันที
// db โหลดตอนเรียกหน้าเท่านั้น — เทสต์เรนเดอร์หน้าได้โดยไม่เปิด DB (ไม่งั้นโปรเซสเทสต์ค้าง)
const db = () => require('../db');
const report = require('../services/salesReport');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ok = (req) => process.env.DASHBOARD_KEY && req.query.key === process.env.DASHBOARD_KEY;
const fmt = n => '฿' + Math.round(Number(n) || 0).toLocaleString('en-US');
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thDay = (iso) => { const [, m, d] = iso.split('-'); return `${Number(d)} ${TH_MONTH[Number(m) - 1]}`; };
const thWhen = (ms) => {
  const t = new Date(ms + 7 * 3600e3);
  return `${t.getUTCDate()} ${TH_MONTH[t.getUTCMonth()]} ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
};

function card(label, value, sub, tone) {
  return `<div class="card${tone ? ' ' + tone : ''}"><div class="lbl">${label}</div><div class="val">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}

function change(now, before) {
  if (!before) return now ? 'เดือนก่อนช่วงเดียวกันยังไม่มียอด' : '';
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% เทียบช่วงเดียวกันเดือนก่อน (${fmt(before)})`;
}

// กราฟแท่งรายวัน: ลูกค้าใหม่ (ทอง) + ซื้อซ้ำ/ต่ออายุ (ฟ้า) + เส้นแคมเปญ
function dailyChart(daily, campaigns) {
  const W = 900, H = 220, pad = 28;
  const max = Math.max(1, ...daily.map(d => d.revenue));
  const bw = (W - pad) / daily.length;
  const y = v => H - pad - (v / max) * (H - pad - 10);
  const idx = new Map(daily.map((d, i) => [d.day, i]));
  const bars = daily.map((d, i) => {
    const x = pad + i * bw;
    const yn = y(d.newRevenue), yr = y(d.newRevenue + d.repeatRevenue);
    return `<g><title>${thDay(d.day)} · ${fmt(d.revenue)} · จ่าย ${d.paid} ราย (ใหม่ ${fmt(d.newRevenue)})</title>
      <rect x="${x + 1}" y="${yn}" width="${bw - 2}" height="${H - pad - yn}" fill="#D4AF37"/>
      <rect x="${x + 1}" y="${yr}" width="${bw - 2}" height="${yn - yr}" fill="#7FD8E8"/></g>`;
  }).join('');
  const marks = campaigns.map(c => {
    const i = idx.get(report.bkkDay(c.at));
    if (i == null) return '';
    const x = pad + i * bw + bw / 2;
    return `<line x1="${x}" x2="${x}" y1="6" y2="${H - pad}" stroke="#e0457b" stroke-dasharray="4 3"/>
      <text x="${x + 4}" y="16" fill="#f08bb0" font-size="11">${esc(c.name)}</text>`;
  }).join('');
  const ticks = daily.map((d, i) => (i % 7 === 0 || i === daily.length - 1)
    ? `<text x="${pad + i * bw + bw / 2}" y="${H - 8}" fill="#a99cc8" font-size="10" text-anchor="middle">${thDay(d.day)}</text>` : '').join('');
  const grid = [0.5, 1].map(f => `<line x1="${pad}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="rgba(255,255,255,.08)"/>
    <text x="0" y="${y(max * f) + 4}" fill="#a99cc8" font-size="10">${Math.round(max * f / 1000)}k</text>`).join('');
  return `<div class="scroll"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:640px">${grid}${bars}${marks}${ticks}</svg></div>`;
}

function hourlyChart(hourly) {
  const W = 900, H = 150, pad = 20;
  const max = Math.max(1, ...hourly.map(h => h.paid));
  const bw = (W - pad) / hourly.length;
  return `<div class="scroll"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:640px">${hourly.map((h, i) => {
    const bh = (h.paid / max) * (H - 40);
    const x = pad + i * bw;
    return `<g><title>${thWhen(h.at)} · จ่าย ${h.paid} ราย ${fmt(h.revenue)}</title>
      <rect x="${x + 1}" y="${H - 20 - bh}" width="${bw - 2}" height="${bh}" fill="${h.label === '00' ? '#9b7fd0' : '#D4AF37'}"/>
      ${h.paid ? `<text x="${x + bw / 2}" y="${H - 24 - bh}" fill="#fff" font-size="10" text-anchor="middle">${h.paid}</text>` : ''}
      ${i % 3 === 0 ? `<text x="${x + bw / 2}" y="${H - 6}" fill="#a99cc8" font-size="10" text-anchor="middle">${h.label}</text>` : ''}</g>`;
  }).join('')}</svg></div>`;
}

// สรุปเป็นประโยค — แคมเปญล่าสุด
function verdict(c) {
  if (!c) return '';
  const w = c.windows[0];
  const lift = c.baseDaily ? Math.round(w.revenue / Math.max(1, w.expected)) : null;
  const running = w.done ? '' : ` (ผ่านมา ${w.hours} ชม.)`;
  return `<div class="verdict">
    <div class="vt">สรุปแคมเปญล่าสุด: ${esc(c.name)}</div>
    <p>ยิงเมื่อ ${thWhen(c.at)} · ${w.label}แรกได้ <b>${fmt(w.revenue)}</b> จาก ${w.paid} รายการ${running}</p>
    <p>ช่วงปกติขายได้วันละประมาณ ${fmt(c.baseDaily)} → ถ้าไม่ยิงน่าจะได้ ${fmt(w.expected)}
       ${lift && lift > 1 ? ` · <b>ยิงแล้วได้มากกว่าปกติราว ${lift} เท่า</b>` : ''}</p>
    <p>ยอดที่เพิ่มขึ้นเพราะแคมเปญ ≈ <b class="up">${fmt(w.incremental)}</b> · ลูกค้าใหม่ ${w.newPayers} คน</p>
    <p class="calc" data-inc="${w.incremental}" data-key="${c.at}">กรอกต้นทุนแคมเปญในตารางด้านล่าง ระบบจะบอกว่าคุ้มไหม</p>
  </div>`;
}

function campaignTable(campaigns) {
  const rows = campaigns.map(c => {
    const [h, d] = c.windows;
    const cell = w => `<td>${fmt(w.revenue)}<div class="sub">${w.paid} รายการ · ใหม่ ${w.newPayers}${w.done ? '' : ` · ผ่านมา ${w.hours} ชม.`}</div></td>
      <td class="${w.incremental >= 0 ? 'up' : 'down'}">${w.incremental >= 0 ? '+' : ''}${fmt(w.incremental)}<div class="sub">ปกติ ${fmt(w.expected)}</div></td>`;
    const co = c.cohort;
    const renew = co.renewRate == null ? 'ยังไม่ครบรอบ' : `${co.renewed}/${co.due} คน (${co.renewRate}%)`;
    return `<tr>
      <td><b>${esc(c.name)}</b><div class="sub">${thWhen(c.at)} · ฐานวันละ ${fmt(c.baseDaily)}</div></td>
      ${cell(h)}${cell(d)}
      <td>${d.conversion}%<div class="sub">${d.openers} คนกดสั่ง</div></td>
      <td>${co.customers} คน<div class="sub">ต่ออายุ ${renew}<br>จ่ายต่อมาอีก ${fmt(co.laterRevenue)}</div></td>
      <td><input class="cost" type="number" min="0" step="50" placeholder="0" data-key="${c.at}" data-inc="${d.incremental}"></td>
      <td class="roi" data-key="${c.at}">–</td>
    </tr>`;
  }).join('');
  return `<div class="scroll"><table class="tbl">
    <tr><th>แคมเปญ</th><th>ยอด 48 ชม.</th><th>เพิ่มจากปกติ</th><th>ยอด 7 วัน</th><th>เพิ่มจากปกติ</th>
        <th>กดสั่งแล้วจ่ายจริง</th><th>ลูกค้าใหม่ + ต่ออายุ</th><th>ต้นทุน (บาท)</th><th>คุ้มไหม</th></tr>${rows}</table></div>`;
}

function cohortTable(rows) {
  return `<div class="scroll"><table class="tbl">
    <tr><th>เดือนที่จ่ายครั้งแรก</th><th>ลูกค้า</th><th>ต่ออายุ</th><th>รายได้รวมจากกลุ่มนี้</th><th>ต่อคน</th></tr>
    ${rows.map(r => `<tr><td>${r.month}</td><td>${r.customers}</td>
      <td>${r.renewRate == null ? '<span class="muted">ยังไม่ครบ 35 วัน</span>' : `${r.renewed}/${r.due} (${r.renewRate}%)`}</td>
      <td>${fmt(r.revenue)}</td><td>${fmt(r.perCustomer)}</td></tr>`).join('')}
  </table></div>`;
}

function page(r, key) {
  const c = r.cards;
  const k = encodeURIComponent(key);
  const types = Object.entries(r.byType).map(([t, v]) => `${t}: ${fmt(v)}`).join(' · ') || '-';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Prinnie333 · ยอดขาย</title><style>
  *{box-sizing:border-box;font-family:'Segoe UI',Tahoma,sans-serif}
  body{margin:0;background:linear-gradient(160deg,#1c0f2e,#2A1B3D);color:#F6F1FF;padding:18px}
  a{color:#D4AF37}
  h1{font-size:20px;margin:0 0 2px}.ts{color:#b9a9d6;font-size:12px;margin-bottom:14px}
  .nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
  .nav a{background:rgba(255,255,255,.06);border:1px solid rgba(212,175,55,.25);color:#c9bce4;padding:8px 14px;border-radius:10px;text-decoration:none;font-size:13px}
  .nav a.on{background:#D4AF37;color:#2A1B3D;font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
  .card{background:rgba(255,255,255,.05);border:1px solid rgba(212,175,55,.25);border-radius:14px;padding:14px}
  .card.gold{border-color:#D4AF37;background:rgba(212,175,55,.12)}
  .lbl{font-size:12px;color:#c9bce4;margin-bottom:6px}.val{font-size:26px;font-weight:700}
  .sub{font-size:11px;color:#a99cc8;margin-top:3px;font-weight:400}
  .sec{margin:24px 0 8px;font-size:15px;color:#D4AF37;font-weight:700}
  .hint{font-size:12px;color:#a99cc8;margin:-4px 0 8px}
  .scroll{overflow-x:auto;background:rgba(255,255,255,.03);border-radius:12px;padding:8px}
  .tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:720px}
  .tbl th{text-align:left;color:#c9bce4;font-weight:600;padding:8px 6px;border-bottom:1px solid rgba(212,175,55,.3)}
  .tbl td{padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.07);vertical-align:top}
  .up{color:#5fe39a}.down{color:#f08bb0}.muted{color:#a99cc8}
  .verdict{background:rgba(212,175,55,.1);border:1px solid #D4AF37;border-radius:14px;padding:14px 16px;margin-bottom:14px}
  .verdict .vt{font-weight:700;color:#D4AF37;margin-bottom:6px}.verdict p{margin:4px 0;font-size:14px}
  .cost{width:90px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:8px;padding:6px}
  .legend span{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px}
</style></head><body>
<h1>💰 Prinnie333 · ยอดขาย</h1>
<div class="ts">อัปเดต ${thWhen(r.now)} · เงินที่จ่ายจริงเท่านั้น (ตรวจสลิปผ่านแล้ว)</div>
<div class="nav"><a href="/dashboard?key=${k}">📊 หน้าหลัก</a><a class="on" href="/dashboard/sales?key=${k}">💰 ยอดขาย</a><a href="/dashboard/content?key=${k}">📝 คอนเทนต์</a></div>

${verdict(r.campaigns[0])}

<div class="grid">
  ${card('วันนี้', fmt(c.today.revenue), `${c.today.paid} รายการ · ลูกค้าใหม่ ${c.today.newPayers}`, 'gold')}
  ${card('เมื่อวาน', fmt(c.yesterday.revenue), `${c.yesterday.paid} รายการ`)}
  ${card('7 วันล่าสุด', fmt(c.d7.revenue), `${c.d7.paid} รายการ · ใหม่ ${c.d7.newPayers}`)}
  ${card('30 วันล่าสุด', fmt(c.d30.revenue), types)}
  ${card('เดือนนี้', fmt(c.month.revenue), change(c.month.revenue, c.prevMonthSame.revenue))}
  ${card('รวมทั้งหมด', fmt(c.total.revenue), `ลูกค้าที่เคยจ่าย ${c.customers} คน`)}
</div>
<div class="grid" style="margin-top:12px">
  ${card('สมาชิกจ่ายเงินที่ใช้งานอยู่', r.members.active + ' คน', `ถ้าต่ออายุครบ = ${fmt(r.members.monthlyValue)}/เดือน`)}
  ${card('หมดอายุใน 14 วัน', r.members.expiring14 + ' คน', `ยอดต่ออายุที่ต้องเก็บ ${fmt(r.members.expiring14Value)}`)}
  ${card('กดสั่งแล้วจ่ายจริง (30 วัน)', r.funnel30.rate + '%', `${r.funnel30.payers} จาก ${r.funnel30.openers} คนที่เปิดหน้าจ่าย`)}
</div>

<div class="sec">ยอดรายวัน 60 วัน</div>
<div class="hint legend"><span style="background:#D4AF37"></span>ลูกค้าใหม่<span style="background:#7FD8E8"></span>ต่ออายุ/ซื้อซ้ำ<span style="background:#e0457b"></span>วันที่ยิงแคมเปญ · แตะแท่งเพื่อดูตัวเลข</div>
${dailyChart(r.daily, r.campaigns)}

<div class="sec">48 ชั่วโมงล่าสุด (จำนวนรายการที่จ่ายต่อชั่วโมง)</div>
<div class="hint">ตัวเลขล่างคือชั่วโมง (เวลาไทย) · แท่งม่วง = เที่ยงคืน</div>
${hourlyChart(r.hourly)}

<div class="sec">แคมเปญคุ้มไหม</div>
<div class="hint">"เพิ่มจากปกติ" = ยอดจริง ลบ ยอดที่น่าจะได้ถ้าไม่ยิง (ค่ากลางรายได้ต่อวัน 14 วันก่อนยิง) · กรอกต้นทุน เช่น ค่าข้อความ LINE ค่าโฆษณา มูลค่าเวลาอาจารย์</div>
${campaignTable(r.campaigns)}

<div class="sec">ลูกค้ากลับมาจ่ายซ้ำไหม</div>
<div class="hint">นับคนที่จ่ายครั้งแรกมาแล้วเกิน 35 วัน ว่าจ่ายครั้งที่สองหรือยัง</div>
${cohortTable(r.cohorts)}

<script>
(function(){
  var fmt=function(n){return '฿'+Math.round(n).toLocaleString('en-US')};
  var store={get:function(k){try{return localStorage.getItem('cost-'+k)}catch(e){return null}},
             set:function(k,v){try{localStorage.setItem('cost-'+k,v)}catch(e){}}};
  function show(input){
    var k=input.dataset.key, inc=Number(input.dataset.inc), cost=Number(input.value);
    var out=document.querySelector('.roi[data-key="'+k+'"]');
    var line=document.querySelector('.calc[data-key="'+k+'"]');
    if(!input.value){out.textContent='–';return}
    var net=inc-cost;
    var txt=cost>0?(net>=0?'คุ้ม ✅ กำไรเพิ่ม '+fmt(net)+' ('+(inc/cost).toFixed(1)+' เท่าของทุน)':'ไม่คุ้ม ❌ ขาด '+fmt(-net))
                  :(inc>0?'คุ้ม ✅ ไม่มีต้นทุน':'ยอดไม่เพิ่ม');
    out.textContent=txt; out.className='roi '+(net>=0?'up':'down');
    if(line) line.innerHTML='ต้นทุน '+fmt(cost)+' (ยอด 7 วัน) → <b>'+txt+'</b>';
  }
  document.querySelectorAll('.cost').forEach(function(i){
    var v=store.get(i.dataset.key); if(v){i.value=v;show(i)}
    i.addEventListener('input',function(){store.set(i.dataset.key,i.value);show(i)});
  });
})();
</script>
</body></html>`;
}

function register(app) {
  app.get('/dashboard/sales', async (req, res) => {
    if (!ok(req)) return res.status(403).send('forbidden');
    try {
      const r = await report.load(db());
      res.set('Cache-Control', 'no-store').send(page(r, req.query.key));
    } catch (e) {
      console.error('[sales]', e.message);
      res.status(500).send('error: ' + esc(e.message));
    }
  });
  app.get('/dashboard/sales.json', async (req, res) => {
    if (!ok(req)) return res.status(403).json({ error: 'forbidden' });
    try { res.set('Cache-Control', 'no-store').json(await report.load(db())); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { register, page };
