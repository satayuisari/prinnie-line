// Review queue — local server ดู content pack (caption + preview คลิป) แล้วอนุมัติ/แก้/ทิ้ง
// รัน: node scripts/review-server.js   → เปิด http://localhost:4321
// อ่าน content/queue/*.json, เสิร์ฟไฟล์จาก video/ ในเครื่อง, กดปุ่มแล้วอัปเดต status ในไฟล์
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const ROOT  = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'content', 'queue');
const PORT  = 4321;
const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function loadPacks() {
  if (!fs.existsSync(QUEUE)) return [];
  return fs.readdirSync(QUEUE).filter(f => f.endsWith('.json')).map(f => {
    try { return { file: f, ...JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8')) }; }
    catch { return { file: f, _error: true }; }
  });
}

const STATUS_COLOR = { for_review:'#C98A00', approved:'#1faa59', posted:'#3a7bd5', rejected:'#b94646' };

function packCard(p) {
  const st = p.status || 'for_review';
  const asset = p.asset_path ? `/asset?p=${encodeURIComponent(p.asset_path)}` : '';
  const isVid = /\.(mp4|mov|webm)$/i.test(p.asset_path || '');
  const preview = !asset ? '<div class="noasset">— ไม่มีไฟล์ —</div>'
    : isVid ? `<video src="${asset}" controls playsinline preload="metadata"></video>`
            : `<img src="${asset}" alt="">`;
  const tags = (p.hashtags || []).map(h => `<span class="tag">${esc(h)}</span>`).join(' ');
  return `<div class="card" id="c-${esc(p.file)}">
    <div class="media">${preview}</div>
    <div class="body">
      <div class="row"><span class="chan">${esc(p.channel||'?')}</span>
        <span class="pill" style="background:${STATUS_COLOR[st]||'#888'}">${esc(st)}</span>
        ${p.pillar?`<span class="muted">${esc(p.pillar)}</span>`:''}
        ${p.post_date?`<span class="muted">🕒 ${esc(p.post_date)}</span>`:''}
      </div>
      ${p.hook?`<div class="hook">🎬 ${esc(p.hook)}</div>`:''}
      ${p.title?`<div class="hook">📺 ${esc(p.title)}</div>`:''}
      <textarea id="cap-${esc(p.file)}" rows="6">${esc(p.caption||'')}</textarea>
      <div class="tags">${tags}</div>
      <div class="btns">
        <button class="ok"  onclick="act('${esc(p.file)}','approved')">✓ อนุมัติ</button>
        <button class="sv"  onclick="save('${esc(p.file)}')">💾 บันทึกแคปชั่น</button>
        <button class="po"  onclick="act('${esc(p.file)}','posted')">📤 โพสต์แล้ว</button>
        <button class="rj"  onclick="act('${esc(p.file)}','rejected')">✕ ทิ้ง</button>
        <a class="dl" href="${asset}" download>⬇ โหลดไฟล์</a>
      </div>
    </div></div>`;
}

function page() {
  const packs = loadPacks();
  const byStatus = packs.reduce((a,p)=>{const s=p.status||'for_review';a[s]=(a[s]||0)+1;return a;},{});
  const summary = Object.entries(byStatus).map(([k,v])=>`${k}: ${v}`).join(' · ') || 'ว่าง';
  const cards = packs.length ? packs.map(packCard).join('') : '<p class="muted">ยังไม่มี content pack ในคิว (content/queue/)</p>';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Prinnie333 · Review Queue</title>
<style>
  *{box-sizing:border-box;font-family:'Segoe UI',Tahoma,sans-serif}
  body{margin:0;background:#1c0f2e;color:#F6F1FF;padding:18px}
  h1{font-size:20px;margin:0 0 2px}.sub{color:#b9a9d6;font-size:13px;margin-bottom:18px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}
  .card{background:rgba(255,255,255,.05);border:1px solid rgba(212,175,55,.25);border-radius:14px;overflow:hidden}
  .media{background:#000;display:flex;justify-content:center}
  .media video,.media img{width:100%;max-height:420px;object-fit:contain}
  .noasset{padding:40px;color:#a99cc8}
  .body{padding:14px}
  .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
  .chan{font-weight:700;color:#fff}.muted{color:#a99cc8;font-size:12px}
  .pill{color:#fff;font-size:11px;padding:2px 9px;border-radius:20px}
  .hook{font-size:13px;color:#F0C868;margin-bottom:6px}
  textarea{width:100%;background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:9px;font-size:13px;resize:vertical}
  .tags{margin:8px 0;font-size:11px}.tag{color:#c9a9ff;margin-right:4px}
  .btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
  button,.dl{border:none;border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer;color:#fff;text-decoration:none}
  .ok{background:#1faa59}.sv{background:#6B3FA0}.po{background:#3a7bd5}.rj{background:#b94646}.dl{background:#444}
</style></head><body>
  <h1>📋 Prinnie333 · Review Queue</h1>
  <div class="sub">${esc(summary)} · แก้แคปชั่นในช่องได้เลย แล้วกดบันทึก · อนุมัติ/โพสต์แล้ว/ทิ้ง อัปเดตสถานะในไฟล์</div>
  <div class="grid">${cards}</div>
<script>
  async function post(body){const r=await fetch('/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.ok;}
  async function act(file,status){if(status==='rejected'&&!confirm('ทิ้ง content นี้?'))return;const cap=document.getElementById('cap-'+file).value;if(await post({file,status,caption:cap}))location.reload();else alert('error');}
  async function save(file){const cap=document.getElementById('cap-'+file).value;if(await post({file,caption:cap}))alert('บันทึกแคปชั่นแล้ว');else alert('error');}
</script></body></html>`;
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  if (u.pathname === '/' ) {
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    return res.end(page());
  }

  // เสิร์ฟไฟล์ asset จาก video/ (กัน path traversal)
  if (u.pathname === '/asset') {
    const rel = u.query.p || '';
    const abs = path.resolve(ROOT, rel);
    if (!abs.startsWith(path.join(ROOT, 'video')) || !fs.existsSync(abs)) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(abs).toLowerCase();
    const type = {'.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'}[ext]||'application/octet-stream';
    res.writeHead(200, {'Content-Type':type});
    return fs.createReadStream(abs).pipe(res);
  }

  // อัปเดต status/caption ในไฟล์ json
  if (u.pathname === '/update' && req.method === 'POST') {
    let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
      try {
        const { file, status, caption } = JSON.parse(b);
        const fp = path.join(QUEUE, path.basename(file));
        const obj = JSON.parse(fs.readFileSync(fp,'utf8'));
        if (status  !== undefined) obj.status  = status;
        if (caption !== undefined) obj.caption = caption;
        obj.updated_at = new Date().toISOString();
        fs.writeFileSync(fp, JSON.stringify(obj, null, 2));
        res.writeHead(200,{'Content-Type':'application/json'}); res.end('{"ok":true}');
      } catch(e){ res.writeHead(500); res.end(String(e.message)); }
    });
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => console.log(`📋 Review queue → http://localhost:${PORT}  (Ctrl+C เพื่อปิด)`));
