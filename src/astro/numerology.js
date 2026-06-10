// เลขศาสตร์ — Life Path Number จากวันเกิด
// รวมเลขทุกหลักของ วัน+เดือน+ปี แล้วลดเหลือหลักเดียว (1-9)
// content (horoscope_numerology) มีแค่ 1-9 จึงลด master number (11,22,33) ลงด้วย
//
// 100% deterministic — ไม่ต้องใช้ ephemeris, ตรวจสอบง่าย

function reduceToDigit(n) {
  while (n > 9) {
    n = String(n).split('').reduce((s, d) => s + Number(d), 0);
  }
  return n;
}

// birthDate = 'YYYY-MM-DD' หรือ Date
function lifePath(birthDate) {
  const str = birthDate instanceof Date
    ? birthDate.toISOString().slice(0, 10)
    : String(birthDate).slice(0, 10);

  const digits = str.replace(/\D/g, '');           // เอาเฉพาะตัวเลข
  const sum = digits.split('').reduce((s, d) => s + Number(d), 0);
  return reduceToDigit(sum);
}

module.exports = { lifePath, reduceToDigit };
