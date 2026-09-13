// จับรางวัลดูดวงฟรีกับอาจารย์ 1 ชั่วโมง
//
// ใช้:  railway run --service prinnie-app node scripts/lucky-draw.js            (ดูอย่างเดียว)
//       railway run --service prinnie-app node scripts/lucky-draw.js --commit   (บันทึกผลจริง)
//
// ตัวเลือก:
//   --round=1                รอบที่เท่าไร (default: ต่อจากรอบล่าสุดในตาราง)
//   --min-days=14            อายุสมาชิกขั้นต่ำเป็นวัน (รอบแรก 14 · รอบถัดไป 30)
//   --paid-before=2026-09-06 นับเฉพาะคนที่จ่ายก่อนวันนี้ (รอบแรก = ลูกค้าช่วงเปิดตัว)
//   --seed=prinnie-r1        ข้อความอะไรก็ได้ ใส่ seed เดิมได้ผลเดิมเสมอ
//
// ทำไม seed สำคัญ: การจับต้องพิสูจน์ได้ว่าไม่ได้เลือกเอง ใครใส่ seed เดียวกัน
// กับรายชื่อชุดเดียวกันจะได้ผู้ชนะคนเดียวกันทุกครั้ง เราประกาศ seed ได้เลย
//
// เกณฑ์ผู้มีสิทธิ์ (ทุกเงื่อนไขต้องครบ):
//   1. เคยจ่ายเงินจริง (payment_orders.status = 'PAID')
//      รอบแรกจำกัดเฉพาะคนจ่ายช่วงเปิดตัวตาม --paid-before
//   2. เป็นสมาชิกมาแล้วไม่ต่ำกว่า --min-days วัน
//      นับจาก subscribe_start (ถ้าไม่มีใช้ created_at) — กันคนสมัครวันนี้หวังรางวัลพรุ่งนี้
//   3. ไม่เคยได้รางวัลรอบก่อน — รางวัลมีไว้กระจาย ไม่ใช่ให้คนดวงดีคนเดียวเก็บทุกรอบ

const crypto = require('crypto');
const db = require('../src/db');

const arg = (name, fallback = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const COMMIT = process.argv.includes('--commit');

async function main() {
  // จับจริงต้องต่อ Postgres โปรดักชันเท่านั้น — PGlite ในเครื่องคือข้อมูลทดสอบ
  // จับจากมันแล้วประกาศคือประกาศผิดคน ยอมให้ข้ามได้เฉพาะตอนเทสต์แบบรู้ตัว
  if (db.driver !== 'pg' && !process.argv.includes('--allow-local')) {
    console.error('✗ ไม่ได้ต่อกับ Postgres จริง (กำลังใช้ ' + db.driver + ') — รันผ่าน railway run เท่านั้น');
    console.error('  (ทดสอบในเครื่อง: เติม --allow-local)');
    process.exit(1);
  }

  const minDays = Number(arg('min-days', '14'));
  const paidBefore = arg('paid-before'); // null = ไม่จำกัดช่วงจ่าย (รอบถัดไป)
  const seed = arg('seed', `prinnie-${new Date().toISOString().slice(0, 10)}`);

  const prev = await db.query('SELECT COALESCE(MAX(round), 0) AS r FROM lucky_draws');
  const round = Number(arg('round', String(Number(prev.rows[0].r) + 1)));

  // ── ผู้มีสิทธิ์ ────────────────────────────────────────────────────────────
  const { rows: eligible } = await db.query(
    `SELECT s.line_user_id, s.display_name, s.nickname,
            COALESCE(s.subscribe_start, s.created_at) AS member_since,
            MIN(p.paid_at) AS first_paid_at
       FROM line_subscribers s
       JOIN payment_orders p
         ON p.line_user_id = s.line_user_id AND p.status = 'PAID'
      WHERE COALESCE(s.subscribe_start, s.created_at) <= NOW() - ($1 || ' days')::interval
        AND ($2::timestamp IS NULL OR p.paid_at < $2::timestamp)
        AND s.line_user_id NOT IN (SELECT winner_line_user_id FROM lucky_draws)
      GROUP BY s.line_user_id, s.display_name, s.nickname, s.subscribe_start, s.created_at
      ORDER BY s.line_user_id`,
    [String(minDays), paidBefore],
  );

  console.log(`รอบที่ ${round} · สมาชิกขั้นต่ำ ${minDays} วัน` +
    (paidBefore ? ` · เฉพาะผู้จ่ายก่อน ${paidBefore}` : ' · ผู้จ่ายทุกช่วง'));
  console.log(`ผู้มีสิทธิ์ ${eligible.length} คน · seed = ${seed}\n`);
  if (!eligible.length) {
    console.log('ไม่มีผู้มีสิทธิ์ — เกณฑ์อาจแคบไป ลองเช็ค --paid-before / --min-days');
    process.exit(0);
  }

  // ── จับ — สุ่มแบบทวนซ้ำได้ ───────────────────────────────────────────────
  // แฮชของ seed เป็นตัวเลข แล้ว mod ด้วยจำนวนคน รายชื่อเรียงตาม line_user_id
  // คงที่ ใครถือ seed กับรายชื่อชุดเดียวกันย่อมได้เลขเดียวกัน
  const hash = crypto.createHash('sha256').update(seed).digest();
  const pick = hash.readUInt32BE(0) % eligible.length;
  const winner = eligible[pick];

  // สำรองเรียงถัดจากผู้ชนะ เผื่อติดต่อไม่ได้ใน 72 ชม. (ตามกติกาที่ประกาศ)
  const backups = [1, 2].map((i) => eligible[(pick + i) % eligible.length]);

  const show = (p) => `${p.display_name || p.nickname || '(ไม่มีชื่อ)'} · เป็นสมาชิกตั้งแต่ ${
    new Date(p.member_since).toLocaleDateString('th-TH')} · ${p.line_user_id.slice(0, 8)}…`;

  console.log('🎉 ผู้ได้รางวัล: ' + show(winner));
  backups.forEach((b, i) => console.log(`   สำรอง ${i + 1}: ` + show(b)));

  if (!COMMIT) {
    console.log('\n(ยังไม่บันทึก — ใส่ --commit เพื่อบันทึกผลจริง)');
  } else {
    await db.query(
      `INSERT INTO lucky_draws
         (round, min_member_days, paid_before, seed, eligible_count,
          winner_line_user_id, winner_display_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [round, minDays, paidBefore, seed, eligible.length,
       winner.line_user_id, winner.display_name || winner.nickname],
    );
    console.log('\n✓ บันทึกผลรอบที่ ' + round + ' แล้ว — คนนี้จะไม่ถูกจับซ้ำในรอบหน้า');
  }
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
