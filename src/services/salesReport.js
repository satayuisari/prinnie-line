// รายงานยอดขาย + วัดผลแคมเปญ — หน้า /dashboard/sales
//
// bon 17 ก.ย. 69: "สร้างหน้า dashboard ใหม่ให้วิเคราะห์ยอดได้ ผมเช็คยอดไม่ได้เลย
//                  วิเคราะห์ด้วยว่าทำ campaign แล้วคุ้มมั้ย"
//
// แหล่งเงินจริงมีที่เดียว: payment_orders.status='PAID' (พร้อมเพย์ + SlipOK/แอดมินอนุมัติ)
// ดึงรายการจ่ายทั้งหมดมาคิดใน JS (หลักร้อย–พันแถว) → ฟังก์ชัน build() ไม่แตะ DB เทสต์ได้
//
// เวลา: คอลัมน์เป็น TIMESTAMP (UTC ไม่มีโซน) → ดึงเป็น epoch ms แล้วบวก 7 ชม. เองเป็นวันไทย
// ไม่พึ่ง TZ ของเครื่อง (Railway กับเครื่อง dev ตั้งไม่เหมือนกัน)

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const BKK = 7 * HOUR;

// แคมเปญที่ยิงจริง — เวลาจาก broadcast_flags / git log · เพิ่มรอบใหม่ที่นี่หรือผ่าน env SALES_CAMPAIGNS
// (JSON: [{"name":"...","at":"2026-10-02T09:00:00+07:00"}])
const CAMPAIGNS = [
  { name: 'เปิดตัว Prinnie333', at: '2026-07-11T18:00:00+07:00' },
  { name: 'ชวนสมาชิกเก่ากลับมา', at: '2026-08-24T09:00:00+07:00' },
  { name: 'ดวงเลือกคุณ (ยิงรอบแรก)', at: '2026-09-02T17:00:00+07:00' },
  { name: 'จับรางวัลดูดวงกับอาจารย์ (เปิดตัว)', at: '2026-09-16T21:00:00+07:00' },
];

function campaignList() {
  let extra = [];
  try { extra = JSON.parse(process.env.SALES_CAMPAIGNS || '[]'); } catch { extra = []; }
  return [...CAMPAIGNS, ...extra]
    .map(c => ({ name: String(c.name), at: new Date(c.at).getTime() }))
    .filter(c => Number.isFinite(c.at))
    .sort((a, b) => a.at - b.at);
}

const bkkDay = (ms) => new Date(ms + BKK).toISOString().slice(0, 10);
const baht = (satang) => Math.round(Number(satang) || 0) / 100;

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ติดป้าย "ลูกค้าใหม่" (จ่ายครั้งแรกของคนนั้น) / "ต่ออายุ-ซื้อซ้ำ"
function tagPayments(payments) {
  const seen = new Set();
  return [...payments]
    .sort((a, b) => a.paid - b.paid)
    .map(p => {
      const first = !seen.has(p.user);
      seen.add(p.user);
      return { ...p, first };
    });
}

const sumBaht = (ps) => ps.reduce((t, p) => t + baht(p.amount), 0);
const inRange = (ps, from, to, key = 'paid') => ps.filter(p => p[key] >= from && p[key] < to);

// รายได้รายวัน (วันไทย) ระหว่าง from..to
function dailyRevenue(payments, from, to) {
  const map = new Map();
  for (let t = from; t < to; t += DAY) map.set(bkkDay(t), 0);
  for (const p of payments) {
    const d = bkkDay(p.paid);
    if (map.has(d)) map.set(d, map.get(d) + baht(p.amount));
  }
  return map;
}

// ฐาน "ถ้าไม่ยิง" = ค่าเฉลี่ยรายได้ต่อวัน 14 วันก่อนยิง โดยตัดวันที่อยู่ใน 7 วันหลังแคมเปญอื่นออก
// (มัธยฐานใช้ไม่ได้: วันปกติส่วนใหญ่ขายได้ 0 → ฐานกลายเป็น 0 ทั้งที่ขายได้จริงบ้าง)
// เหลือวันปกติไม่ถึง 7 วัน → ย้อนไปดู 28 วัน
function baseline(c, tagged, others) {
  const dayStart = Date.parse(bkkDay(c.at) + 'T00:00:00Z') - BKK;
  const hot = (day) => others.some(o => o.at !== c.at && day + DAY > o.at && day < o.at + 7 * DAY);
  for (const span of [14, 28]) {
    const days = [];
    for (let t = dayStart - span * DAY; t < dayStart; t += DAY) if (!hot(t)) days.push(t);
    if (days.length >= 7 || span === 28) {
      if (!days.length) return 0;
      const rev = dailyRevenue(tagged, dayStart - span * DAY, dayStart);
      return days.reduce((sum, t) => sum + rev.get(bkkDay(t)), 0) / days.length;
    }
  }
  return 0;
}

// วัดผลแคมเปญหนึ่งรอบ
function campaignStats(c, tagged, orders, now, others = []) {
  const base = baseline(c, tagged, others);
  const windows = [
    { key: 'h48', label: '48 ชม.', ms: 2 * DAY },
    { key: 'd7', label: '7 วัน', ms: 7 * DAY },
  ].map(w => {
    const end = Math.min(c.at + w.ms, now);
    const days = Math.max(0, (end - c.at) / DAY);
    const ps = inRange(tagged, c.at, end);
    const os = inRange(orders, c.at, end, 'created');
    // คนที่เปิดออเดอร์ในช่วงนี้ จ่ายจริงกี่คน (นับคน ไม่นับใบ — คนเดียวกดหลายใบบ่อย)
    const openers = new Set(os.map(o => o.user));
    const payers = new Set(os.filter(o => o.status === 'PAID').map(o => o.user));
    const revenue = sumBaht(ps);
    const expected = Math.round(base * days);
    return {
      ...w,
      done: now >= c.at + w.ms,
      hours: Math.round((end - c.at) / HOUR),
      revenue,
      paid: ps.length,
      newPayers: ps.filter(p => p.first).length,
      repeat: ps.filter(p => !p.first).length,
      openers: openers.size,
      conversion: openers.size ? Math.round((payers.size / openers.size) * 100) : 0,
      expected,
      incremental: Math.round(revenue - expected),
    };
  });

  // ลูกค้าใหม่ 7 วันแรก จ่ายซ้ำไหม (ความคุ้มระยะยาว)
  const cohortEnd = c.at + 7 * DAY;
  const newbies = inRange(tagged, c.at, cohortEnd).filter(p => p.first);
  const ids = new Set(newbies.map(p => p.user));
  const later = tagged.filter(p => ids.has(p.user) && !p.first);
  const repeaters = new Set(later.map(p => p.user));
  const due = newbies.filter(p => now - p.paid >= 35 * DAY);           // ครบรอบต่ออายุ + ผ่อนผัน 5 วัน
  const renewed = due.filter(p => repeaters.has(p.user));
  return {
    name: c.name,
    at: c.at,
    baseDaily: Math.round(base),
    windows,
    cohort: {
      customers: ids.size,
      laterRevenue: sumBaht(later),
      due: due.length,
      renewed: renewed.length,
      renewRate: due.length ? Math.round((renewed.length / due.length) * 100) : null,
    },
  };
}

// อัตราต่ออายุตามเดือนที่จ่ายครั้งแรก
function cohorts(tagged, now) {
  const byMonth = new Map();
  const count = new Map();
  for (const p of tagged) count.set(p.user, (count.get(p.user) || 0) + 1);
  for (const p of tagged.filter(x => x.first)) {
    const m = bkkDay(p.paid).slice(0, 7);
    const row = byMonth.get(m) || { month: m, customers: 0, due: 0, renewed: 0, revenue: 0 };
    row.customers++;
    if (now - p.paid >= 35 * DAY) {
      row.due++;
      if (count.get(p.user) > 1) row.renewed++;
    }
    byMonth.set(m, row);
  }
  const firstMonth = new Map(tagged.filter(x => x.first).map(x => [x.user, bkkDay(x.paid).slice(0, 7)]));
  for (const p of tagged) byMonth.get(firstMonth.get(p.user)).revenue += baht(p.amount);
  return [...byMonth.values()].map(r => ({
    ...r,
    renewRate: r.due ? Math.round((r.renewed / r.due) * 100) : null,
    perCustomer: r.customers ? Math.round(r.revenue / r.customers) : 0,
  }));
}

// payments: [{ user, type, amount(สตางค์), paid(ms) }]
// orders:   [{ user, created(ms), status, type }]
// members:  { active, expiring: [{ end(ms) }] }
function build({ payments, orders, members = { active: 0, expiring: [] }, now = Date.now(), campaigns = campaignList() }) {
  const tagged = tagPayments(payments);
  const todayStart = Date.parse(bkkDay(now) + 'T00:00:00Z') - BKK;
  const monthStart = Date.parse(bkkDay(now).slice(0, 8) + '01T00:00:00Z') - BKK;
  const d = new Date(monthStart + BKK);
  const prevMonthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1) - BKK;
  const elapsed = now - monthStart;

  const period = (from, to) => {
    const ps = inRange(tagged, from, to);
    return { revenue: sumBaht(ps), paid: ps.length, newPayers: ps.filter(p => p.first).length };
  };

  const dailyFrom = todayStart - 59 * DAY;
  const daily = [];
  for (let t = dailyFrom; t <= todayStart; t += DAY) {
    const ps = inRange(tagged, t, t + DAY);
    const os = inRange(orders, t, t + DAY, 'created');
    daily.push({
      day: bkkDay(t),
      revenue: sumBaht(ps),
      newRevenue: sumBaht(ps.filter(p => p.first)),
      repeatRevenue: sumBaht(ps.filter(p => !p.first)),
      paid: ps.length,
      orders: os.length,
    });
  }

  const hourly = [];
  const hourNow = Math.floor(now / HOUR) * HOUR;
  for (let t = hourNow - 47 * HOUR; t <= hourNow; t += HOUR) {
    const ps = inRange(tagged, t, t + HOUR);
    hourly.push({ at: t, label: new Date(t + BKK).toISOString().slice(11, 13), paid: ps.length, revenue: sumBaht(ps) });
  }

  const byType = {};
  for (const p of inRange(tagged, now - 30 * DAY, now + 1)) {
    const k = p.type === 'couple' ? 'ผูกดวงคู่ 199' : 'สมาชิก 399';
    byType[k] = (byType[k] || 0) + baht(p.amount);
  }

  const last30 = inRange(orders, now - 30 * DAY, now + 1, 'created');
  const open30 = new Set(last30.map(o => o.user));
  const paid30 = new Set(last30.filter(o => o.status === 'PAID').map(o => o.user));
  return {
    now,
    cards: {
      today: period(todayStart, now + 1),
      yesterday: period(todayStart - DAY, todayStart),
      d7: period(now - 7 * DAY, now + 1),
      d30: period(now - 30 * DAY, now + 1),
      month: period(monthStart, now + 1),
      prevMonthSame: period(prevMonthStart, prevMonthStart + elapsed),
      total: period(0, now + 1),
      customers: new Set(tagged.map(p => p.user)).size,
    },
    members: {
      active: members.active,
      monthlyValue: members.active * 399,
      expiring14: members.expiring.length,
      expiring14Value: members.expiring.length * 399,
    },
    funnel30: {
      openers: open30.size,
      payers: paid30.size,
      rate: open30.size ? Math.round((paid30.size / open30.size) * 100) : 0,
    },
    byType,
    daily,
    hourly,
    campaigns: campaigns.filter(c => c.at <= now).map(c => campaignStats(c, tagged, orders, now, campaigns)).reverse(),
    cohorts: cohorts(tagged, now),
  };
}

async function load(db, now = Date.now()) {
  const payments = (await db.query(`
    SELECT line_user_id AS user, type, amount,
           (EXTRACT(EPOCH FROM COALESCE(paid_at, created_at)) * 1000)::bigint AS paid
      FROM payment_orders WHERE status='PAID'`)).rows
    .map(r => ({ user: r.user, type: r.type, amount: Number(r.amount), paid: Number(r.paid) }));
  const orders = (await db.query(`
    SELECT line_user_id AS user, status, type, (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS created
      FROM payment_orders WHERE created_at > NOW() - INTERVAL '400 days'`)).rows
    .map(r => ({ user: r.user, status: r.status, type: r.type, created: Number(r.created) }));
  const paying = `payment_ref IS NOT NULL
    AND payment_ref NOT IN ('tester','free-trial','free','founder','LIFETIME_COMP')`;
  const active = (await db.query(
    `SELECT COUNT(*)::int AS n FROM line_subscribers WHERE subscribe_end > NOW() AND ${paying}`)).rows[0].n;
  const expiring = (await db.query(
    `SELECT (EXTRACT(EPOCH FROM subscribe_end) * 1000)::bigint AS end FROM line_subscribers
      WHERE subscribe_end > NOW() AND subscribe_end <= NOW() + INTERVAL '14 days' AND ${paying}`)).rows
    .map(r => ({ end: Number(r.end) }));
  return build({ payments, orders, members: { active, expiring }, now });
}

module.exports = { build, load, median, baseline, tagPayments, campaignStats, cohorts, bkkDay, campaignList, CAMPAIGNS };
