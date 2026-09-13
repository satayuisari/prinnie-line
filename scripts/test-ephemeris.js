'use strict';
// เทียบตำแหน่งดาวกับ astro.com (Swiss Ephemeris) ซึ่งเป็นมาตรฐานที่วงการโหราศาสตร์ใช้อ้างอิง
//
// 🔴 ทำไมต้องมีเทสต์นี้ (9 ก.ย. 69)
//    ephemeris.js เคยใช้ Astronomy.EclipticLongitude() ซึ่งคืนค่า heliocentric
//    (ตำแหน่งดาวเมื่อมองจากดวงอาทิตย์) แต่โหราศาสตร์ต้องใช้ geocentric (มองจากโลก)
//    ผลคือดาวคลาดสูงสุด 14.76° ที่ศุกร์ และ 13.59° ที่อังคาร ซึ่งข้ามราศีไปเลย
//    อาทิตย์กับจันทร์ไม่โดนเพราะใช้ฟังก์ชันคนละตัว จึงดู "เกือบถูก" มาตลอด
//    ไม่มีใครจับได้จนกระทั่งเจ้าของดวงทักเองว่าพฤหัสของตัวเองไม่ตรงกับที่โหรบอก
//
//   node scripts/test-ephemeris.js
//
// ค่าอ้างอิงดึงจาก astro.com/cgi/swetest.cgi (Swiss Ephemeris) — geocentric, tropical, of-date

const { longitudeOf } = require('../src/astro/ephemeris.js');

// วันที่ 21 ธ.ค. 1974 00:00 UT — ค่าจาก swetest ของ astro.com
const CASES = [
  { date: Date.UTC(1974, 11, 21, 0, 0, 0), label: '21 ธ.ค. 1974 00:00 UT', expect: {
      Sun: 268.7294, Moon: 349.6974, Mercury: 269.3867, Venus: 279.5729, Mars: 247.1162,
      Jupiter: 341.5999, Saturn: 106.7499, Uranus: 211.4744, Neptune: 250.0477, Pluto: 189.1181 } },
];

// ราศีกว้าง 30° ต่อราศี — คลาด 0.05° ไม่มีผลต่อการระบุราศี แต่จับบั๊กระดับองศาได้แน่
const TOL = 0.05;

let pass = 0, fail = 0;
for (const c of CASES) {
  const d = new Date(c.date);
  console.log(`\n── ${c.label} ──`);
  for (const [body, want] of Object.entries(c.expect)) {
    const got = longitudeOf(body, d);
    let diff = Math.abs(got - want) % 360;
    if (diff > 180) diff = 360 - diff;
    const ok = diff <= TOL;
    if (ok) pass++; else fail++;
    console.log(`  ${ok ? '✅' : '❌'} ${body.padEnd(9)} ได้ ${got.toFixed(4).padStart(9)}°  ควรได้ ${want.toFixed(4).padStart(9)}°  คลาด ${diff.toFixed(4)}°`);
  }
}

// ด่านกันของเดิมกลับมา: ถ้ามีคนเปลี่ยนไปใช้ heliocentric อีก ศุกร์จะคลาด ~15° ทันที
console.log('\n── ด่านกันบั๊กเดิมกลับมา ──');
const Astronomy = require('astronomy-engine');
const d = new Date(CASES[0].date);
const helio = Astronomy.EclipticLongitude(Astronomy.Body.Venus, d);
const ours = longitudeOf('Venus', d);
const gap = Math.abs(helio - ours);
if (gap > 10) { pass++; console.log(`  ✅ ค่าเราต่างจาก heliocentric ${gap.toFixed(2)}° — ยืนยันว่าใช้ geocentric อยู่`); }
else { fail++; console.log(`  ❌ ค่าเราต่างจาก heliocentric แค่ ${gap.toFixed(2)}° — น่าจะกลับไปใช้ heliocentric แล้ว`); }

console.log(`\n${fail ? '❌' : '✅'} ผ่าน ${pass} · พัง ${fail}\n`);
process.exit(fail ? 1 : 0);
