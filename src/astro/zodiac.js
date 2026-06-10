// ราศี — แปลง ecliptic longitude (0-360°) เป็นราศี
// ลำดับตรงกับค่า constellation ใน content tables (ภาษาอังกฤษ)

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const SIGN_TH = {
  Aries: 'เมษ', Taurus: 'พฤษภ', Gemini: 'เมถุน', Cancer: 'กรกฎ',
  Leo: 'สิงห์', Virgo: 'กันย์', Libra: 'ตุลย์', Scorpio: 'พิจิก',
  Sagittarius: 'ธนู', Capricorn: 'มังกร', Aquarius: 'กุมภ์', Pisces: 'มีน',
};

const PLANET_TH = {
  Sun: 'อาทิตย์', Moon: 'จันทร์', Mercury: 'พุธ', Venus: 'ศุกร์',
  Mars: 'อังคาร', Jupiter: 'พฤหัส', Saturn: 'เสาร์',
  Uranus: 'ยูเรนัส', Neptune: 'เนปจูน', Pluto: 'พลูโต',
};

// longitude (0-360) → ราศี
function signFromLongitude(lon) {
  const norm = ((lon % 360) + 360) % 360;
  const index = Math.floor(norm / 30);
  return SIGNS[index];
}

// องศาภายในราศี (0-30)
function degreeInSign(lon) {
  const norm = ((lon % 360) + 360) % 360;
  return norm % 30;
}

module.exports = { SIGNS, SIGN_TH, PLANET_TH, signFromLongitude, degreeInSign };
