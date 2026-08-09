// CRM หาอินฟลู — รายชื่อผู้สมัคร → ทาบทาม → ตอบกลับ → สนใจ → อนุมัติ → เปิดใช้งานจริง
// V1 ไม่ scrape social/ไม่ auto DM — Bon กรอกเอง แล้วใช้แดชบอร์ดไล่สถานะ
const db = require('../db');
const audit = require('./affiliateAudit');
const affiliates = require('./affiliates');

const STATUSES = ['CANDIDATE', 'CONTACTED', 'REPLIED', 'INTERESTED', 'APPROVED', 'ONBOARDED', 'DECLINED'];
const SCORE_FIELDS = ['score_audience_fit', 'score_engagement', 'score_content', 'score_trust', 'score_cta', 'score_brand_safety'];

const int = (v, max = 5) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
const str = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);

// ไม่บังคับกรอกครบ — มีแค่ชื่อก็เพิ่มได้
function normalize(input = {}) {
  const scores = {};
  for (const f of SCORE_FIELDS) scores[f] = int(input[f]);
  const total = SCORE_FIELDS.reduce((s, f) => s + scores[f], 0);
  return {
    display_name: str(input.display_name, 120),
    platform: str(input.platform, 40),
    profile_url: str(input.profile_url, 500),
    contact_method: str(input.contact_method, 40),
    contact_value: str(input.contact_value, 200),
    followers: Math.max(0, parseInt(input.followers, 10) || 0),
    category: str(input.category, 60),
    notes: str(input.notes, 2000),
    ...scores,
    total_score: total,
  };
}

async function create(input, { actor = 'admin' } = {}) {
  const c = normalize(input);
  if (!c.display_name) throw new Error('ต้องมีชื่อ');
  const row = (await db.query(
    `INSERT INTO affiliate_candidates
       (display_name, platform, profile_url, contact_method, contact_value, followers, category, notes,
        score_audience_fit, score_engagement, score_content, score_trust, score_cta, score_brand_safety,
        total_score, recruitment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'CANDIDATE') RETURNING id`,
    [c.display_name, c.platform, c.profile_url, c.contact_method, c.contact_value, c.followers, c.category, c.notes,
     c.score_audience_fit, c.score_engagement, c.score_content, c.score_trust, c.score_cta, c.score_brand_safety,
     c.total_score])).rows[0];
  await audit.log('CANDIDATE_CREATED', { actor, entityType: 'candidate', entityId: row.id, newValue: c.display_name });
  return row;
}

async function update(id, input, { actor = 'admin' } = {}) {
  const c = normalize(input);
  if (!c.display_name) throw new Error('ต้องมีชื่อ');
  const r = await db.query(
    `UPDATE affiliate_candidates SET
       display_name=$2, platform=$3, profile_url=$4, contact_method=$5, contact_value=$6,
       followers=$7, category=$8, notes=$9,
       score_audience_fit=$10, score_engagement=$11, score_content=$12,
       score_trust=$13, score_cta=$14, score_brand_safety=$15, total_score=$16, updated_at=NOW()
     WHERE id=$1 RETURNING id`,
    [Number(id), c.display_name, c.platform, c.profile_url, c.contact_method, c.contact_value,
     c.followers, c.category, c.notes, c.score_audience_fit, c.score_engagement, c.score_content,
     c.score_trust, c.score_cta, c.score_brand_safety, c.total_score]);
  if (!r.rows[0]) throw new Error('ไม่พบ candidate');
  return r.rows[0];
}

// เปลี่ยนสถานะการทาบทาม — CONTACTED จะจดเวลาติดต่อล่าสุดให้ด้วย
async function setStatus(id, status, { actor = 'admin', reason = null } = {}) {
  if (!STATUSES.includes(status)) throw new Error('สถานะไม่ถูกต้อง');
  const before = (await db.query('SELECT recruitment_status FROM affiliate_candidates WHERE id=$1', [Number(id)])).rows[0];
  if (!before) throw new Error('ไม่พบ candidate');
  await db.query(
    `UPDATE affiliate_candidates SET recruitment_status=$2, updated_at=NOW(),
       last_contacted_at = CASE WHEN $2='CONTACTED' THEN NOW() ELSE last_contacted_at END
     WHERE id=$1`, [Number(id), status]);
  await audit.log('CANDIDATE_STATUS_CHANGED', { actor, entityType: 'candidate', entityId: id,
    oldValue: before.recruitment_status, newValue: status, reason });
  return { id: Number(id), status, from: before.recruitment_status };
}

async function addNote(id, note, { actor = 'admin' } = {}) {
  const text = str(note, 500);
  if (!text) throw new Error('โน้ตว่าง');
  const stamp = new Date().toLocaleDateString('th-TH');
  const r = await db.query(
    `UPDATE affiliate_candidates
     SET notes = CASE WHEN COALESCE(notes,'')='' THEN $2 ELSE notes || E'\n' || $2 END, updated_at=NOW()
     WHERE id=$1 RETURNING id`, [Number(id), `[${stamp}] ${text}`]);
  if (!r.rows[0]) throw new Error('ไม่พบ candidate');
  return r.rows[0];
}

// APPROVED → สร้างเป็นอินฟลูจริง + ได้ลิงก์ทันที (สถานะขยับเป็น ONBOARDED)
async function convert(id, { code = null, actor = 'admin' } = {}) {
  const c = (await db.query('SELECT * FROM affiliate_candidates WHERE id=$1', [Number(id)])).rows[0];
  if (!c) throw new Error('ไม่พบ candidate');
  if (c.affiliate_code) throw new Error(`แปลงเป็นอินฟลูแล้ว (${c.affiliate_code})`);
  if (c.recruitment_status !== 'APPROVED') throw new Error('ต้องเป็นสถานะ APPROVED ก่อนถึงจะแปลงเป็นอินฟลูได้');

  const aff = await affiliates.create({ name: c.display_name, code, note: `จาก candidate #${c.id}`, actor });
  await db.query(
    `UPDATE affiliate_candidates SET affiliate_code=$2, recruitment_status='ONBOARDED', updated_at=NOW() WHERE id=$1`,
    [c.id, aff.code]);
  await audit.log('CANDIDATE_STATUS_CHANGED', { actor, entityType: 'candidate', entityId: c.id,
    oldValue: 'APPROVED', newValue: 'ONBOARDED', reason: `สร้างอินฟลู ${aff.code}` });
  return aff;
}

// ค้นหา/กรอง/เรียง — ใช้กับตารางในแดชบอร์ด
async function list({ q = '', status = '', sort = 'score' } = {}) {
  const where = [];
  const params = [];
  if (q)      { params.push(`%${q.toLowerCase()}%`);
                where.push(`(LOWER(display_name) LIKE $${params.length} OR LOWER(platform) LIKE $${params.length}
                             OR LOWER(category) LIKE $${params.length} OR LOWER(contact_value) LIKE $${params.length})`); }
  if (status) { params.push(status); where.push(`recruitment_status=$${params.length}`); }
  const order = sort === 'new' ? 'created_at DESC'
              : sort === 'name' ? 'display_name ASC'
              : sort === 'followers' ? 'followers DESC'
              : 'total_score DESC, followers DESC';
  return (await db.query(
    `SELECT *, to_char(created_at,'YYYY-MM-DD') created,
            to_char(last_contacted_at,'MM-DD') contacted
     FROM affiliate_candidates ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY ${order} LIMIT 300`, params)).rows;
}

async function get(id) {
  return (await db.query('SELECT * FROM affiliate_candidates WHERE id=$1', [Number(id)])).rows[0] || null;
}

// สรุป funnel การหาอินฟลู: candidate → … → onboarded → มีลูกค้าจ่ายจริง
async function funnel() {
  const c = (await db.query(`
    SELECT
      COUNT(*)::int total,
      COUNT(*) FILTER (WHERE recruitment_status='CANDIDATE')::int  candidate,
      COUNT(*) FILTER (WHERE recruitment_status='CONTACTED')::int  contacted,
      COUNT(*) FILTER (WHERE recruitment_status='REPLIED')::int    replied,
      COUNT(*) FILTER (WHERE recruitment_status='INTERESTED')::int interested,
      COUNT(*) FILTER (WHERE recruitment_status='APPROVED')::int   approved,
      COUNT(*) FILTER (WHERE recruitment_status='ONBOARDED')::int  onboarded,
      COUNT(*) FILTER (WHERE recruitment_status='DECLINED')::int   declined
    FROM affiliate_candidates`)).rows[0];
  // นับอินฟลูแยกจากตาราง affiliates (บางคนสร้างตรงไม่ผ่าน CRM)
  const a = (await db.query(`
    SELECT COUNT(*) FILTER (WHERE status='ACTIVE')::int active_affiliates,
           COUNT(*)::int total_affiliates FROM affiliates`)).rows[0];
  const withPaid = (await db.query(`
    SELECT COUNT(DISTINCT affiliate_code)::int n FROM affiliate_commissions WHERE status<>'REVERSED'`)).rows[0];
  return { ...c, ...a, affiliates_with_paid: withPaid.n };
}

module.exports = { create, update, setStatus, addNote, convert, list, get, funnel, normalize, STATUSES, SCORE_FIELDS };
