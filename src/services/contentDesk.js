// โต๊ะคอนเทนต์ — คิดโพสต์ของพรุ่งนี้ให้เสร็จ แล้ววัดว่าโพสต์ไหนได้ผล
//
// bon 16 ก.ย. 69: "อยากให้มันเริ่มทำการผลิตเงินเองโดยที่ผมไม่ต้องมานั่งคิดแล้ว
//                  อย่างเช่นคอนเทนต์ไหนดี คอนเทนต์ไหนเหมาะ คิดให้เลย ตอบกลับแม่เลย"
//
// สิ่งที่ไฟล์นี้ทำ และไม่ทำ:
//   ทำ    — อ่านตัวเลขจริงของธุรกิจ (สมาชิกใหม่ ใกล้หมดอายุ ช่องทางที่คนคลิก โพสต์ที่ผ่านมา
//           ได้ผลแค่ไหน) แล้วเสนอ "โพสต์พรุ่งนี้" เป็นแคปชั่นพร้อมใช้ + บรีฟภาพ + เหตุผล
//   ไม่ทำ — ไม่โพสต์เอง คนยังเป็นคนกดโพสต์ เพราะเป็นเสียงของอาจารย์ปรินนี่ ไม่ใช่เสียงของเครื่อง
//
// ทุกแคปชั่นถูกตรวจคำต้องห้ามของแคมเปญ (pickAnnounce.assertClean) ก่อนบันทึกเสมอ
// ถ้า AI ปิดอยู่หรืองบวันนี้หมด จะตกไปใช้มุมสำเร็จรูปที่พิสูจน์แล้ว (source='fallback')
// — ระบบไม่มีวันเงียบ และไม่มีวันเสนอข้อความที่ผิดกฎแคมเปญ
const db = require('../db');
const aiUsage = require('./aiUsage');
const { assertClean } = require('./pickAnnounce');

const MODEL = process.env.CONTENT_MODEL || 'claude-sonnet-5';
/** กี่วันหลังโพสต์ถึงนับว่าผลนิ่งพอจะวัด */
const MEASURE_AFTER_DAYS = 3;

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const Anthropic = require('@anthropic-ai/sdk');
  client = new Anthropic();
  return client;
}

/**
 * มุมที่ใช้ได้จริงกับบริการนี้ เรียงจาก "ขายตรง" ไป "ให้ก่อนขาย"
 *
 * เป็นทั้งตัวเลือกให้ AI และเป็นแผนสำรองตอน AI ใช้ไม่ได้ ทุกมุมเขียนจากของที่บริการมีจริง
 * (ดวงรายวันจากเวลาเกิดจริง · ไพ่ทาโรต์ฟรี · ผูกดวงคู่ · ดวงเลือกคุณ) ไม่ใช่คำโฆษณาลอย ๆ
 */
const ANGLES = [
  { key: 'เวลาเกิด', hint: 'ทำไมเวลาเกิดเปลี่ยนคำทำนายทั้งดวง — ชวนคนไปเปิดสูติบัตร' },
  { key: 'ดวงรายวัน', hint: 'ดวงรายวันที่คำนวณจากดวงตัวเอง ต่างจากดวง 12 ราศีที่อ่านเหมือนกันทั้งราศี' },
  { key: 'ไพ่ทาโรต์', hint: 'ชวนเปิดไพ่ประจำสัปดาห์ฟรี ไม่ต้องสมัคร — ของฟรีที่ดึงคนเข้าไลน์' },
  { key: 'ผูกดวงคู่', hint: 'ดูความเข้ากันกับคนที่คิดถึง ฟรีคะแนน% + จุดเด่นหนึ่งข้อ' },
  { key: 'สิทธิ์ดูดวงฟรีของสมาชิก', hint: 'สมาชิกครบ 14 วันมีสิทธิ์ได้ดูดวงตัวต่อตัวฟรี คัดรอบละ 1 ท่านทุกวันที่ 2 และ 17 — ต้องบอกให้ชัดว่าเฉพาะสมาชิก' },
  { key: 'ดาวจรตอนนี้', hint: 'ดาวที่กำลังจรช่วงนี้มีผลกับใครบ้าง เล่าให้คนทั่วไปอ่านรู้เรื่อง' },
  { key: 'เบื้องหลังอาจารย์', hint: 'อาจารย์ดูดวงให้คนมาแล้วกี่คน ทำไมถึงเลือกทำแบบส่วนตัว' },
  { key: 'คำถามที่เจอบ่อย', hint: 'ตอบคำถามที่ลูกค้าถามซ้ำ ๆ เช่น จำเวลาเกิดไม่ได้ทำยังไง' },
];

/** ตัวเลขจริงที่ใช้ตัดสินใจ — ทุกอย่างมาจากฐานข้อมูล ไม่มีค่าที่เดาเอง */
async function context() {
  const m = (await db.query(`SELECT
      COUNT(*)::int                                                        AS followers,
      COUNT(*) FILTER (WHERE chart_data IS NOT NULL)::int                  AS registered,
      COUNT(*) FILTER (WHERE subscribe_end > NOW())::int                   AS active,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new7,
      COUNT(*) FILTER (WHERE subscribe_end BETWEEN NOW() AND NOW() + INTERVAL '7 days')::int AS expiring7
    FROM line_subscribers`)).rows[0];

  const paid = (await db.query(`SELECT
      COUNT(*) FILTER (WHERE paid_at >= NOW() - INTERVAL '7 days')::int AS paid7,
      COUNT(*) FILTER (WHERE paid_at >= date_trunc('month', NOW()))::int AS paid_month,
      COALESCE(SUM(amount) FILTER (WHERE paid_at >= date_trunc('month', NOW())), 0)::bigint AS baht_month
    FROM payment_orders WHERE status = 'PAID'`)).rows[0];

  const channels = (await db.query(`SELECT source, SUM(clicks)::int AS clicks
      FROM channel_clicks WHERE click_date >= CURRENT_DATE - 7
      GROUP BY source ORDER BY clicks DESC LIMIT 5`)).rows;

  // โพสต์ที่ผ่านมา: เอาไว้กันเล่ามุมซ้ำ และเอาไว้บอก AI ว่ามุมไหนเคยได้ผล
  const recent = (await db.query(`SELECT for_date, theme, status, signups_after, clicks_after
      FROM content_posts WHERE for_date >= CURRENT_DATE - 21
      ORDER BY for_date DESC LIMIT 20`)).rows;

  const best = (await db.query(`SELECT theme,
        COUNT(*)::int AS posts,
        ROUND(AVG(signups_after)::numeric, 1) AS avg_signups
      FROM content_posts
      WHERE status = 'POSTED' AND signups_after IS NOT NULL AND theme IS NOT NULL
      GROUP BY theme ORDER BY avg_signups DESC LIMIT 5`)).rows;

  return { ...m, ...paid, baht_month: Number(paid.baht_month) / 100, channels, recent, best };
}

/** มุมที่ยังไม่ได้เล่าเร็ว ๆ นี้ เรียงมุมที่เคยได้ผลดีไว้ก่อน */
function pickAngle(ctx) {
  const usedRecently = new Set(ctx.recent.slice(0, 5).map((r) => r.theme));
  const proven = ctx.best.map((b) => b.theme);
  const fresh = ANGLES.filter((a) => !usedRecently.has(a.key));
  const pool = fresh.length ? fresh : ANGLES;
  return pool.sort((a, b) => proven.indexOf(b.key) - proven.indexOf(a.key))[0];
}

const VOICE = `คุณเขียนแคปชั่นให้ "อาจารย์ปรินนี่" หมอดูผู้หญิงที่ดูดวงส่วนตัวจากวัน เวลา และสถานที่เกิดจริงของลูกค้า ผ่าน LINE @prinnie333

โทนเสียง: อบอุ่น สุภาพ ลงท้ายด้วย "ค่ะ/นะคะ" เหมือนผู้ใหญ่ใจดีที่รู้จริง ไม่ใช่เซลส์ ไม่ตะโกน ไม่ใช้คำเวอร์
ความยาว: 8–16 บรรทัด ขึ้นบรรทัดใหม่บ่อย ๆ อ่านบนมือถือสบายตา ใช้อิโมจิได้ไม่เกิน 3 ตัวทั้งโพสต์

สิ่งที่บริการมีจริง (ห้ามสัญญาเกินนี้):
- ดวงรายวันส่วนตัวส่งทุกเช้า 08:00 คำนวณจากดวงกำเนิดของแต่ละคน — สมาชิก 399 บาท/30 วัน
- ฟรีไม่ต้องสมัคร: พื้นดวง (อาทิตย์ จันทร์ ลัคนา) · ไพ่ทาโรต์ประจำสัปดาห์ · ผูกดวงคู่ดูคะแนน %
- ผูกดวงคู่แบบเต็ม 199 บาทครั้งเดียว
- สิทธิ์ดูดวงฟรีกับอาจารย์ (สำหรับสมาชิกเท่านั้น): ทุกวันที่ 2 และ 17 คัดสมาชิกที่เป็นสมาชิกครบ 14 วัน รอบละ 1 ท่าน ได้ดูดวงตัวต่อตัวฟรี 1 ชั่วโมง คนที่ได้จะได้รับข้อความส่วนตัว — ทุกครั้งที่พูดถึงเรื่องนี้ ต้องบอกให้ชัดว่า "ต้องเป็นสมาชิก" และ "รอบละ 1 ท่าน" ห้ามเขียนให้คนอ่านเข้าใจว่าตัวเองได้สิทธิ์แล้ว

ห้ามเด็ดขาด:
- ห้ามใช้คำว่า ผู้โชคดี จับรางวัล สุ่ม ลุ้น ประกาศผล ผู้ชนะ เสี่ยงโชค จับฉลาก ชิงโชค (แม้ในประโยคปฏิเสธ) — ใช้ "คัดจากดวงกำเนิด" "ดวงเลือกคุณ" "แจ้งสิทธิ์" แทน
- ห้ามรับปากผลลัพธ์ เช่น รวยแน่ หายป่วย ถูกหวย
- ห้ามพูดถึงการรักษาโรค การลงทุน หรือให้คำแนะนำทางการเงิน
- ห้ามเอ่ยชื่อลูกค้าหรือเล่าเคสที่ระบุตัวได้
- ห้ามใช้ศัพท์โหราศาสตร์ที่คนทั่วไปอ่านไม่ออก (เช่น ตรีโกณ จตุรัส ทำมุม 120°) เขียนภาษาคนธรรมดา`;

function buildPrompt(ctx, angle, forDate) {
  const lines = [
    `วันที่จะโพสต์: ${forDate} (โพสต์ตอนหัวค่ำ)`,
    `มุมที่ให้เล่าวันนี้: ${angle.key} — ${angle.hint}`,
    '',
    'ตัวเลขจริงของธุรกิจตอนนี้ (ใช้เลือกน้ำเสียงและคำชวน ไม่ต้องเอาตัวเลขไปใส่ในโพสต์):',
    `- ผู้ติดตาม ${ctx.followers} · ลงทะเบียนแล้ว ${ctx.registered} · สมาชิกที่ยังใช้งาน ${ctx.active}`,
    `- 7 วันล่าสุด แอดเข้ามาใหม่ ${ctx.new7} คน · จ่ายเงินใหม่ ${ctx.paid7} ราย`,
    `- กำลังจะหมดอายุใน 7 วัน ${ctx.expiring7} คน`,
  ];
  if (ctx.channels.length) {
    lines.push(`- ช่องทางที่คนคลิกเข้ามามากสุด 7 วัน: ${ctx.channels.map((c) => `${c.source} ${c.clicks}`).join(' · ')}`);
  }
  if (ctx.recent.length) {
    lines.push('', 'มุมที่เพิ่งเล่าไป (อย่าเล่าซ้ำ):', ...ctx.recent.slice(0, 6).map((r) => `- ${r.for_date instanceof Date ? r.for_date.toISOString().slice(0, 10) : r.for_date} ${r.theme || '(ไม่ระบุ)'}`));
  }
  if (ctx.best.length) {
    lines.push('', 'มุมที่เคยทำให้คนสมัครเยอะที่สุด (เฉลี่ยคนสมัครใน 3 วันหลังโพสต์):',
      ...ctx.best.map((b) => `- ${b.theme}: ${b.avg_signups} คน จาก ${b.posts} โพสต์`));
  }
  lines.push('',
    'ตอบกลับเป็น JSON อย่างเดียว ไม่มีข้อความอื่นนอก JSON:',
    '{"theme":"ชื่อมุมสั้น ๆ","caption":"แคปชั่นพร้อมโพสต์","image_brief":"บรีฟภาพหนึ่งย่อหน้า บอกข้อความบนภาพและอารมณ์ภาพ","rationale":"เหตุผลหนึ่งประโยคว่าทำไมโพสต์นี้เหมาะกับวันนี้"}');
  return lines.join('\n');
}

/** แผนสำรองเวลา AI ใช้ไม่ได้ — เขียนจากมุมเดียวกัน แต่เป็นข้อความคงที่ที่ตรวจแล้วว่าปลอดภัย */
function fallbackDraft(angle) {
  const body = {
    'เวลาเกิด': 'ดวงของสองคนที่เกิดวันเดียวกัน\nอาจไม่เหมือนกันเลยค่ะ\n\nเพราะ "เวลาเกิด" เป็นตัวกำหนดลัคนา\nและลัคนาคือจุดตั้งต้นของทั้งดวง\nต่างกันสองชั่วโมง คำทำนายก็เปลี่ยนแล้วค่ะ\n\nใครยังไม่รู้เวลาเกิดตัวเอง\nลองเปิดสูติบัตรดูนะคะ จดไว้เลย\nแล้วดวงที่อ่านต่อจากนี้จะเป็นของคุณจริง ๆ',
    'ดวงรายวัน': 'ดวงที่อ่านแล้วรู้สึกว่า "ก็ใช่นะ แต่ก็ไม่เชิง"\nส่วนใหญ่เป็นดวงของคนทั้งราศีค่ะ\n\nอาจารย์ส่งดวงรายวันให้สมาชิกทุกเช้า 08:00\nคำนวณจากวัน เวลา และสถานที่เกิดของคุณเอง\nวันไหนควรรีบ วันไหนควรรอ จะชัดขึ้นมากค่ะ',
    'ไพ่ทาโรต์': 'สัปดาห์นี้มีอะไรรออยู่คะ\n\nเปิดไพ่ทาโรต์ประจำสัปดาห์ได้ฟรีที่ไลน์อาจารย์\nไม่ต้องสมัคร ไม่จำกัดจำนวนครั้ง\nกดเมนู "ไพ่ทาโรต์" ได้เลยค่ะ',
    'ผูกดวงคู่': 'คิดถึงใครอยู่คะ\n\nลองผูกดวงคู่กับอาจารย์ดูนะคะ\nดูคะแนนความเข้ากันและจุดเด่นหนึ่งข้อได้ฟรี\nใช้แค่วันเกิดของทั้งสองคนค่ะ',
    'สิทธิ์ดูดวงฟรีของสมาชิก': 'สมาชิก Prinnie333 มีสิทธิ์ได้ดูดวงตัวต่อตัว\nกับอาจารย์ฟรี 1 ชั่วโมงค่ะ\n\nทุกวันที่ 2 และ 17 อาจารย์มอบสิทธิ์นี้\nให้สมาชิกรอบละ 1 ท่าน\nเป็นสมาชิกต่อเนื่องครบ 14 วัน เข้ารอบคัดให้อัตโนมัติ\nคนที่ได้สิทธิ์ ทีมงานจะแจ้งทางไลน์ส่วนตัวนะคะ\n\nสมาชิก 399 บาท / 30 วัน\nได้ดวงรายวันเฉพาะคุณทุกเช้า 08:00 ด้วยค่ะ',
    'ดาวจรตอนนี้': 'ช่วงนี้หลายคนบอกตรงกันว่า\nอะไร ๆ ก็ช้ากว่าที่คิดไว้\n\nดาวจรบางดวงทำมุมกับดวงกำเนิดของแต่ละคนไม่เท่ากันค่ะ\nบางคนแค่ช้า บางคนคือจังหวะให้ทบทวน\nอยากรู้ว่าของคุณเป็นแบบไหน ทักมาได้นะคะ',
    'เบื้องหลังอาจารย์': 'อาจารย์ดูดวงมาหลายปี\nและเชื่อเสมอว่าดวงที่ดีคือดวงที่ "เป็นของคนนั้นจริง ๆ"\n\nจึงเลือกทำแบบคำนวณจากเวลาเกิดของแต่ละคน\nแทนการเขียนรวม ๆ ให้ทั้งราศีอ่านเหมือนกันค่ะ',
    'คำถามที่เจอบ่อย': 'คำถามที่เจอบ่อยที่สุดคือ\n"จำเวลาเกิดไม่ได้ ดูได้ไหมคะ"\n\nดูได้ค่ะ อาจารย์จะใช้วิธีประมาณจากเหตุการณ์สำคัญในชีวิต\nแต่ถ้าหาสูติบัตรเจอ ดวงจะละเอียดกว่ามากนะคะ',
  }[angle.key] || 'วันนี้อาจารย์อยากชวนคุยเรื่องดวงส่วนตัวค่ะ';
  return {
    theme: angle.key,
    caption: `${body}\n\nLINE @prinnie333`,
    image_brief: `ภาพพื้นหลังท้องฟ้ากลางคืนโทนน้ำเงินเข้ม มีดาวเล็ก ๆ ข้อความกลางภาพสั้น ๆ เกี่ยวกับ "${angle.key}" ฟอนต์ไทยหนาอ่านง่าย มุมล่างมี LINE @prinnie333`,
    rationale: `AI ปิดอยู่หรืองบหมด จึงใช้มุมสำรอง "${angle.key}" ที่ยังไม่ได้เล่าเร็ว ๆ นี้`,
    source: 'fallback',
    model: null,
  };
}

function parseJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('โมเดลไม่ได้ตอบเป็น JSON');
  return JSON.parse(m[0]);
}

/**
 * เสนอโพสต์ของวันที่กำหนด แล้วบันทึกเป็นฉบับร่าง
 * คืนแถวใน content_posts (หรือแถวเดิมถ้าวันนั้นเสนอไปแล้ว)
 */
async function propose({ forDate, slot = 'feed', force = false } = {}) {
  const date = forDate || new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
  const existing = (await db.query('SELECT * FROM content_posts WHERE for_date = $1 AND slot = $2', [date, slot])).rows[0];
  if (existing && !force) return { row: existing, reused: true };

  const ctx = await context();
  const angle = pickAngle(ctx);
  let draft = null;

  const c = getClient();
  if (c) {
    try {
      const resp = await c.messages.create({
        model: MODEL,
        max_tokens: 1400,
        system: VOICE,
        messages: [{ role: 'user', content: buildPrompt(ctx, angle, date) }],
      });
      await aiUsage.record('content_draft', MODEL, resp, true);
      const j = parseJson(resp.content.map((b) => b.text || '').join(''));
      draft = {
        theme: String(j.theme || angle.key).slice(0, 80),
        caption: String(j.caption || '').trim(),
        image_brief: String(j.image_brief || '').trim(),
        rationale: String(j.rationale || '').trim(),
        source: 'ai',
        model: MODEL,
      };
      assertClean(draft.caption);          // คำต้องห้ามของแคมเปญ — ถ้าไม่ผ่านจะโยนออกไปใช้แผนสำรอง
      if (draft.caption.length < 60) throw new Error('แคปชั่นสั้นผิดปกติ');
    } catch (e) {
      console.error('[content] AI ใช้ไม่ได้ ใช้มุมสำรองแทน:', e.message);
      await aiUsage.record('content_draft', MODEL, null, false).catch(() => {});
      draft = null;
    }
  }
  if (!draft) draft = fallbackDraft(angle);
  assertClean(draft.caption);              // แผนสำรองก็ต้องผ่านด่านเดียวกัน

  const sql = existing
    ? `UPDATE content_posts SET theme=$3, caption=$4, image_brief=$5, rationale=$6,
         status='DRAFT', source=$7, model=$8, created_at=NOW()
       WHERE for_date=$1 AND slot=$2 RETURNING *`
    : `INSERT INTO content_posts (for_date, slot, theme, caption, image_brief, rationale, source, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
  const row = (await db.query(sql, [date, slot, draft.theme, draft.caption, draft.image_brief, draft.rationale, draft.source, draft.model])).rows[0];
  return { row, reused: false };
}

/** ข้อความที่ส่งเข้าไลน์ให้คนอ่านแล้วก๊อปไปโพสต์ได้เลย */
function toLineText(row) {
  const d = row.for_date instanceof Date ? row.for_date.toISOString().slice(0, 10) : row.for_date;
  return [
    `📝 โพสต์ที่เสนอสำหรับ ${d} · มุม "${row.theme || '-'}"`,
    row.source === 'fallback' ? '(มุมสำรอง — AI ปิดอยู่)' : '',
    '',
    row.caption,
    '',
    '— — —',
    `🖼 ภาพ: ${row.image_brief || '-'}`,
    `💡 ทำไมอันนี้: ${row.rationale || '-'}`,
    '',
    'ถ้าโพสต์แล้วกดปุ่ม "โพสต์แล้ว" ในแดชบอร์ด ระบบจะวัดผลให้เองใน 3 วัน',
  ].filter((l) => l !== '').join('\n');
}

async function markPosted(id) {
  return (await db.query(
    `UPDATE content_posts SET status='POSTED', posted_at=NOW(), decided_at=NOW() WHERE id=$1 RETURNING *`, [id])).rows[0];
}

async function skip(id) {
  return (await db.query(
    `UPDATE content_posts SET status='SKIPPED', decided_at=NOW() WHERE id=$1 RETURNING *`, [id])).rows[0];
}

/**
 * วัดผลโพสต์ที่โพสต์ไปแล้วเกิน 3 วันและยังไม่ได้วัด
 *
 * นับสิ่งที่เกิดขึ้นในหน้าต่าง 3 วันหลังโพสต์: คลิกเข้าไลน์ คนแอดใหม่ และคนจ่ายเงิน
 * ไม่ได้อ้างว่าโพสต์เป็นเหตุให้เกิดทั้งหมด แต่พอจะเทียบกันเองระหว่างมุมได้ว่ามุมไหนดีกว่า
 */
async function measure() {
  const due = (await db.query(
    `SELECT id, posted_at FROM content_posts
     WHERE status='POSTED' AND measured_at IS NULL
       AND posted_at <= NOW() - ($1::int * INTERVAL '1 day')`, [MEASURE_AFTER_DAYS])).rows;
  for (const p of due) {
    const clicks = (await db.query(
      `SELECT COALESCE(SUM(clicks),0)::int n FROM channel_clicks
       WHERE click_date >= $1::date AND click_date < $1::date + $2::int`, [p.posted_at, MEASURE_AFTER_DAYS])).rows[0].n;
    const signups = (await db.query(
      `SELECT COUNT(*)::int n FROM line_subscribers
       WHERE created_at >= $1 AND created_at < $1::timestamp + ($2::int * INTERVAL '1 day')`, [p.posted_at, MEASURE_AFTER_DAYS])).rows[0].n;
    const paid = (await db.query(
      `SELECT COUNT(*)::int n FROM payment_orders
       WHERE status='PAID' AND paid_at >= $1 AND paid_at < $1::timestamp + ($2::int * INTERVAL '1 day')`, [p.posted_at, MEASURE_AFTER_DAYS])).rows[0].n;
    await db.query(
      `UPDATE content_posts SET measured_at=NOW(), clicks_after=$2, signups_after=$3, paid_after=$4 WHERE id=$1`,
      [p.id, clicks, signups, paid]);
  }
  return due.length;
}

/** สรุปว่ามุมไหนได้ผล สำหรับส่งให้คนอ่านสัปดาห์ละครั้ง */
async function scoreboard() {
  const rows = (await db.query(
    `SELECT theme, COUNT(*)::int posts,
       ROUND(AVG(signups_after)::numeric,1) avg_signups,
       ROUND(AVG(clicks_after)::numeric,1)  avg_clicks,
       SUM(paid_after)::int paid
     FROM content_posts
     WHERE status='POSTED' AND measured_at IS NOT NULL AND theme IS NOT NULL
     GROUP BY theme ORDER BY avg_signups DESC NULLS LAST`)).rows;
  if (!rows.length) return '📊 ยังไม่มีโพสต์ที่วัดผลแล้ว — รออีก 2-3 วันหลังโพสต์แรกค่ะ';
  return ['📊 มุมคอนเทนต์ที่ได้ผล (เฉลี่ยต่อโพสต์ ใน 3 วันหลังโพสต์)',
    ...rows.map((r, i) => `${i + 1}. ${r.theme} — แอดใหม่ ${r.avg_signups} · คลิก ${r.avg_clicks} · จ่าย ${r.paid} (${r.posts} โพสต์)`),
  ].join('\n');
}

async function list(limit = 20) {
  return (await db.query('SELECT * FROM content_posts ORDER BY for_date DESC, slot LIMIT $1', [limit])).rows;
}

module.exports = { context, propose, toLineText, markPosted, skip, measure, scoreboard, list, ANGLES, pickAngle, fallbackDraft };
