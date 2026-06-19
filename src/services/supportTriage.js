// triage แบบ keyword — แยกหมวดข้อความลูกค้า (mirror cowork prinnie-triage A–F)
// ใช้ตอน capture เข้า inbox: ติดหมวด + ความเร่งด่วน เพื่อเรียง/เน้นบน dashboard
// (เฟสนี้ keyword-based; ต่อ Managed Agents จริงทีหลังได้ — แทน classify ตัวนี้)

const RULES = [
  // เปราะบาง/อารมณ์เสียหนัก = ด่วนสุด (flag ให้คนดูก่อน)
  { cat: 'emotional', pr: 'high', re: /เครียด|เศร้า|ท้อ|ไม่ไหว|ร้องไห้|สิ้นหวัง|อยากตาย|ทำร้ายตัว|หมดกำลังใจ|เหนื่อยใจ/ },
  // โกรธ/ร้องเรียน
  { cat: 'angry',     pr: 'high', re: /โกรธ|แย่มาก|ห่วย|หลอก|โกง|ร้องเรียน|แจ้งความ|ไม่พอใจ|เลวร้าย|คืนเงิน/ },
  // เงิน/การจ่าย
  { cat: 'payment',   pr: 'high', re: /จ่าย|เงิน|โอน|ชำระ|บัตร|ตัดเงิน|สิทธิ์|refund|charge|สมัครแล้ว|จ่ายแล้ว|ราคา|กี่บาท|เท่าไหร่|เท่าไร/ },
  // ถามดวง
  { cat: 'astro',     pr: 'normal', re: /ดวง|ลัคนา|ราศี|ไพ่|ทาโรต์|ทำนาย|พื้นดวง|ดูดวง/ },
];

function classify(text) {
  const t = String(text || '');
  for (const r of RULES) if (r.re.test(t)) return { category: r.cat, priority: r.pr };
  return { category: 'general', priority: 'normal' };
}

// meta สำหรับแสดงผล
const META = {
  emotional: { label: '🆘 เปราะบาง', color: '#e0457b' },
  angry:     { label: '😠 ร้องเรียน', color: '#d9544e' },
  payment:   { label: '💳 เงิน',      color: '#d99a3a' },
  astro:     { label: '🔮 ถามดวง',    color: '#6ea8fe' },
  general:   { label: '💬 ทั่วไป',    color: '#8a8a8a' },
};

module.exports = { classify, META };
