// โมเดลรายได้แคมเปญ "ปลุกฐาน 10k" + sensitivity grid
// รัน: node scripts/campaign-model.js [followers] [priceSub] [priceCouple]
//   ดีฟอลต์: 10000 ฐาน, 399/เดือน, 149 ดวงคู่ครั้งเดียว

const FOLLOWERS = Number(process.argv[2]) || 10000;
const PRICE_SUB = Number(process.argv[3]) || 399;
const PRICE_CPL = Number(process.argv[4]) || 149;

const claimRates   = [0.20, 0.30, 0.40, 0.50];        // % ฐานที่กรอกดวงฟรี
const convertRates = [0.05, 0.10, 0.15, 0.20];        // % ของคนกรอก → สมัคร 399
const coupleRates  = [0.05, 0.08, 0.12];              // % ของคนกรอก → ซื้อดวงคู่ 149

const baht = n => '฿' + Math.round(n).toLocaleString('en-US');
const pad  = (s, w) => String(s).padStart(w);

console.log(`\n📊 โมเดลแคมเปญปลุกฐาน — ฐาน ${FOLLOWERS.toLocaleString()} | สมาชิก ${baht(PRICE_SUB)}/เดือน | ดวงคู่ ${baht(PRICE_CPL)}\n`);

// ── ตาราง 1: รายได้ recurring/เดือน = ฐาน × claim% × convert% × ราคา ──
console.log('▌ รายได้สมาชิกรายเดือน (recurring) — แถว=กดรับดวงฟรี, คอลัมน์=แปลงเป็นสมาชิก');
console.log('  ' + pad('claim\\conv', 11) + convertRates.map(c => pad((c * 100) + '%', 12)).join(''));
for (const cl of claimRates) {
  const row = convertRates.map(co => {
    const subs = FOLLOWERS * cl * co;
    return pad(baht(subs * PRICE_SUB), 12);
  });
  const claimers = Math.round(FOLLOWERS * cl);
  console.log('  ' + pad(`${(cl * 100)}% (${claimers})`, 11) + row.join(''));
}

// ── ตาราง 2: จำนวนสมาชิก (หัว) ──
console.log('\n▌ จำนวนสมาชิกที่จ่าย (คน)');
console.log('  ' + pad('claim\\conv', 11) + convertRates.map(c => pad((c * 100) + '%', 12)).join(''));
for (const cl of claimRates) {
  const row = convertRates.map(co => pad(Math.round(FOLLOWERS * cl * co), 12));
  console.log('  ' + pad((cl * 100) + '%', 11) + row.join(''));
}

// ── ตาราง 3: ดวงคู่ 149 (รายได้ครั้งเดียวช่วงแคมเปญ) ──
console.log('\n▌ รายได้ดวงคู่ 149 (one-time ช่วงแคมเปญ) — แถว=กดรับดวงฟรี, คอลัมน์=ซื้อดวงคู่');
console.log('  ' + pad('claim\\cpl', 11) + coupleRates.map(c => pad((c * 100) + '%', 12)).join(''));
for (const cl of claimRates) {
  const row = coupleRates.map(cp => pad(baht(FOLLOWERS * cl * cp * PRICE_CPL), 12));
  console.log('  ' + pad((cl * 100) + '%', 11) + row.join(''));
}

// ── สรุป 3 scenario ──
const scenarios = [
  { name: 'ระมัดระวัง', claim: 0.20, conv: 0.05, cpl: 0.05 },
  { name: 'ฐาน (base)', claim: 0.30, conv: 0.10, cpl: 0.08 },
  { name: 'มองโลกสวย', claim: 0.40, conv: 0.15, cpl: 0.12 },
];
console.log('\n▌ สรุป 3 scenario');
console.log('  ' + pad('scenario', 12) + pad('สมาชิก', 9) + pad('฿/เดือน', 13) + pad('฿ ปีแรก*', 15) + pad('ดวงคู่ครั้งเดียว', 18));
for (const s of scenarios) {
  const subs    = FOLLOWERS * s.claim * s.conv;
  const monthly = subs * PRICE_SUB;
  const year    = monthly * 12;                       // *สมมติคงสมาชิกตลอดปี (upper bound)
  const couple  = FOLLOWERS * s.claim * s.cpl * PRICE_CPL;
  console.log('  ' + pad(s.name, 12) + pad(Math.round(subs), 9) + pad(baht(monthly), 13) + pad(baht(year), 15) + pad(baht(couple), 18));
}
console.log('\n* ฿ปีแรก = upper bound (สมมติ churn = 0). ใส่ churn จริงค่อยปรับลด\n');
