// ประกาศผลรอบ "ดวงเลือกคุณ" ให้ทุกคนเห็น — ดูข้อความก่อนเสมอ ไม่ส่งจนกว่าจะสั่งชัด ๆ
//
//   node scripts/announce-pick.js                  พิมพ์ข้อความของรอบล่าสุดออกมาดู (ไม่ส่ง)
//   node scripts/announce-pick.js --demo           ดูตัวอย่างด้วยข้อมูลสมมติ (ไม่ต้องมี DB)
//   node scripts/announce-pick.js --to-me          ส่งเข้าไลน์ตัวเองดูของจริงก่อน
//   node scripts/announce-pick.js --send oa1|oa2|both   บรอดแคสต์จริง (ต้องยืนยันอีกครั้ง)
//
// ปกติ cron (src/scheduler/loyaltyRewards.js) ประกาศให้เองทันทีหลังคัดเสร็จ 09:00
// สคริปต์นี้ไว้ใช้ตอน (1) อยากดูข้อความก่อนถึงวันจริง (2) รอบไหน cron ประกาศไม่สำเร็จ
// (3) LOYALTY_ANNOUNCE=false แล้วอยากประกาศเอง
//
// ⚠️ --send ยิงหาผู้ติดตามจริงทั้งหมด ย้อนกลับไม่ได้ · TEST_MODE บล็อกให้อีกชั้น
require('dotenv').config();
const readline = require('readline');
const lm = require('../src/services/lineMessaging');
const ann = require('../src/services/pickAnnounce');

const has = (n) => process.argv.includes(n);
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const SEND = arg('--send');
const TO_ME = has('--to-me');
const DEMO = has('--demo');

async function latestPick() {
  const db = require('../src/db');
  const r = (await db.query(
    `SELECT id, cycle, detail, note, granted_at, announced_at
       FROM loyalty_rewards WHERE cycle IS NOT NULL
      ORDER BY granted_at DESC LIMIT 1`)).rows[0];
  if (!r) return null;
  const total = Number((String(r.note || '').match(/จาก (\d+) คน/) || [])[1]) || 0;
  return { id: r.id, cycle: r.cycle, detail: r.detail, total, at: new Date(r.granted_at), announced_at: r.announced_at, db };
}

function show(p, t1, t2) {
  const line = '─'.repeat(58);
  console.log(`\nรอบ ${p.cycle} · ${p.detail} · เข้าเกณฑ์ ${p.total} ดวง · คัดเมื่อ ${p.at.toISOString().slice(0, 16)}`
    + (p.announced_at ? ` · ประกาศไปแล้ว ${new Date(p.announced_at).toISOString().slice(0, 16)}` : ' · ยังไม่ได้ประกาศ'));
  for (const [name, t] of [['@prinnie333 (บัญชีบริการ)', t1], ['@efb2738a (บัญชีใหญ่)', t2]]) {
    console.log(line); console.log(`  ${name}   ·   ${t.length} ตัวอักษร`); console.log(line);
    console.log(t.split('\n').map(l => '  ' + l).join('\n')); console.log();
  }
  console.log(line);
  console.log('  ยังไม่ได้ส่งอะไรทั้งสิ้น · --to-me ดูของจริงในไลน์ · --send oa1|oa2|both บรอดแคสต์');
  console.log(line + '\n');
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(q, a => { rl.close(); r(a.trim()); }));
}

(async () => {
  const p = DEMO
    ? { cycle: 'demo', detail: 'Pluto Trine Mercury', total: 38, at: new Date(), announced_at: null }
    : await latestPick();
  if (!p) { console.log('ยังไม่มีรอบไหนคัดเลย — รอ cron วันที่ 2/17 เวลา 09:00 หรือดู --demo'); process.exit(0); }

  const t1 = ann.announceText({ at: p.at, detail: p.detail, total: p.total });
  const t2 = ann.announceText({ at: p.at, detail: p.detail, total: p.total, forOA2: true });
  show(p, t1, t2);
  if (!SEND && !TO_ME) { if (p.db) await p.db.end(); return; }

  if (TO_ME) {
    const allow = (process.env.TEST_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const prod = process.env.PROD_OA_USER_ID;
    const me = lm.TEST_MODE ? (allow.find(id => id === prod) || allow[0] || prod) : (prod || allow[0]);
    if (!me) { console.error('ไม่รู้ว่าจะส่งหาใคร — ตั้ง PROD_OA_USER_ID หรือ TEST_USER_IDS ก่อน'); process.exit(1); }
    const r = await lm.pushMessage(me, [{ type: 'text', text: t1 }]);
    console.log(r && r.skipped ? `✗ ไม่ได้ส่ง — ${me.slice(0, 8)}… ไม่อยู่ใน TEST_USER_IDS` : `✓ ส่งตัวอย่างเข้าไลน์แล้ว — ${me.slice(0, 8)}…`);
    if (p.db) await p.db.end();
    return;
  }

  if (!['oa1', 'oa2', 'both'].includes(SEND)) { console.error('--send ต้องเป็น oa1 · oa2 · both'); process.exit(1); }
  if (p.announced_at) console.log('⚠️  รอบนี้ประกาศไปแล้ว — ส่งอีกครั้งคือคนได้รับซ้ำ\n');
  const ok = await ask('   พิมพ์ "ส่งเลย" เพื่อยืนยันบรอดแคสต์จริง · อย่างอื่นคือยกเลิก: ');
  if (ok !== 'ส่งเลย') { console.log('\n   ยกเลิกแล้ว ไม่ได้ส่งอะไร'); if (p.db) await p.db.end(); return; }

  const targets = SEND === 'both' ? ['oa1', 'oa2'] : [SEND];
  let sent = false;
  for (const t of targets) {
    try {
      if (t === 'oa1') { await lm.broadcast([{ type: 'text', text: t1 }]); console.log('   ✓ ส่งเข้า @prinnie333 แล้ว'); sent = true; }
      if (t === 'oa2') { await lm.broadcastOA2([{ type: 'text', text: t2 }]); console.log('   ✓ ส่งเข้าบัญชีใหญ่แล้ว'); sent = true; }
    } catch (e) { console.error(`   ✗ ${t}: ${e.message}`); }
  }
  if (sent && p.db && !DEMO) await p.db.query('UPDATE loyalty_rewards SET announced_at=NOW() WHERE id=$1', [p.id]);
  if (p.db) await p.db.end();
})().catch(e => { console.error(e.message); process.exit(1); });
