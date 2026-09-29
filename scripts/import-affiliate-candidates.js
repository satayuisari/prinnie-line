// นำรายชื่อพาร์ทเนอร์ที่หาไว้ (CSV) เข้าแท็บ Recruitment — สถานะ CANDIDATE ทั้งหมด ไม่ติดต่อใคร
//
//   node scripts/import-affiliate-candidates.js <ไฟล์.csv>            ดูว่าจะเพิ่มอะไร (ไม่เขียน DB)
//   node scripts/import-affiliate-candidates.js <ไฟล์.csv> --write    เพิ่มจริง (ข้ามชื่อที่มีอยู่แล้ว)
//
// หัวคอลัมน์ตามไฟล์ที่หาไว้ 29 ก.ย. 69: display_name, platform, profile_url, followers, category,
// contact_method, contact_value, score_* 6 ช่อง, why_fit, red_flags, verified
// bon: "หา candidate ที่ไม่ใช่หมอดู" — ข้อควรเช็กของแต่ละคนเก็บไว้ในโน้ต ให้เห็นก่อนทาบทาม
require('dotenv').config();
const fs = require('fs');

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

// "IG 50K; FB 39,200" → 50000 · "78569 (27,406 talking…)" → 78569 — เอาตัวเลขแรกที่เจอ
function firstCount(s) {
  const m = String(s || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([KkMm])?/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return Math.round(m[2] ? n * (/m/i.test(m[2]) ? 1e6 : 1e3) : n);
}

function toCandidate(r) {
  const notes = [
    r.why_fit && `เหตุผลที่เหมาะ: ${r.why_fit}`,
    r.red_flags && `ต้องเช็กก่อนทาบทาม: ${r.red_flags}`,
    `ผู้ติดตาม (ตามที่เห็น 29 ก.ย. 69): ${r.followers}${r.followers_source ? ` · ที่มา ${r.followers_source}` : ''}`,
    r.verified && r.verified !== 'yes' && `ยืนยันบัญชีได้บางส่วน (${r.verified})`,
  ].filter(Boolean).join('\n');
  return {
    display_name: r.display_name, platform: r.platform, profile_url: r.profile_url,
    contact_method: r.contact_method, contact_value: r.contact_value,
    followers: firstCount(r.followers), category: r.category, notes,
    score_audience_fit: r.score_audience_fit, score_engagement: r.score_engagement,
    score_content: r.score_content, score_trust: r.score_trust,
    score_cta: r.score_cta, score_brand_safety: r.score_brand_safety,
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('ใส่ไฟล์ CSV ด้วย'); process.exit(1); }
  const list = parseCsv(fs.readFileSync(file, 'utf8')).map(toCandidate).filter(c => c.display_name);
  const write = process.argv.includes('--write');
  if (!write) {
    for (const c of list) console.log(`${c.display_name} · ${c.platform} · ${c.followers.toLocaleString()} · ${c.category}`);
    console.log(`\nจะเพิ่ม ${list.length} รายชื่อ (ยังไม่เขียน — ใส่ --write เพื่อเพิ่มจริง)`);
    return;
  }
  const db = require('../src/db');
  const candidates = require('../src/services/affiliateCandidates');
  const have = new Set((await db.query('SELECT LOWER(display_name) n FROM affiliate_candidates')).rows.map(r => r.n));
  let added = 0;
  for (const c of list) {
    if (have.has(c.display_name.toLowerCase())) { console.log('ข้าม (มีแล้ว):', c.display_name); continue; }
    await candidates.create(c, { actor: 'import-2026-09-29' });
    added++;
  }
  console.log(`เพิ่มแล้ว ${added} รายชื่อ`);
  await db.end();
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { parseCsv, firstCount, toCandidate };
