// ประกาศผลรอบ "ดวงเลือกคุณ" ให้ทุกคนเห็น — ไม่เปิดชื่อ ไม่ใช้คำต้องห้าม
//
// ทำไมต้องมี (bon สั่ง 15 ก.ย. 69): ระบบเดิมแจ้งเฉพาะคนที่ได้รับ + แอดมิน
// คนอื่นไม่รู้เลยว่ารอบนี้มีคนได้จริง → ไม่มีแรงจูงใจให้สมัคร
// ข้อความนี้ยิงเข้าทั้งสองบัญชีหลังคัดเสร็จ บอกว่า "ดาวอะไรทำมุมกับดวงใครแรงสุด"
// โดยไม่บอกว่าเป็นใคร + บอกรอบถัดไปและเส้นตายสมัคร (คิดสดจากวันจริง ห้ามฮาร์ดโค้ด)
//
// คำที่ใช้ยึดตาม marketing/LOYALTY-CAMPAIGN.md — assertClean() กันหลุดทุกครั้งก่อนส่ง
const lm = require('./lineMessaging');

const MIN_DAYS = Number(process.env.PICK_MIN_DAYS) || 14;
const PICK_DAYS = [2, 17];
const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const SIGNUP_URL = process.env.SIGNUP_LIFF_URL || 'https://liff.line.me/2010382680-c6gh82Rm';

// คำต้องห้าม (พ.ร.บ.การพนัน ม.8 + แบรนด์) — ถ้าหลุดมาในข้อความ ห้ามส่งเด็ดขาด
// เดิมห้ามคำ จับรางวัล/ผู้โชคดี/ลุ้น เพราะห่วง พ.ร.บ. — bon ยกเลิกเอง 17 ก.ย. 69
// ("ไม่ต้องห่วงเรื่อง พ.ร.บ. เอาเป็นจับรางวัลนี่ละลุย")
// ด่านนี้ยังอยู่ แต่เปลี่ยนมากันถ้อยคำที่เคยทำให้คนเข้าใจผิดจริง:
// หัว "ดวงเลือกคุณ" ที่ส่งถึงทุกคน · ศัพท์โหราศาสตร์ที่คนทั่วไปอ่านไม่ออก
const BANNED = ['ดวงเลือกคุณ', 'เจ้าของดวง', 'จังหวะสำคัญ', 'ตรีโกณ', 'ทำมุม'];
function assertClean(text) {
  const hit = BANNED.find(w => String(text).includes(w));
  if (hit) throw new Error(`ข้อความมีคำต้องห้าม "${hit}" — แก้ก่อนส่ง`);
  return text;
}

const thDate = (d) => `${d.getDate()} ${TH_MONTH[d.getMonth()]}`;

// รอบแรกที่คนสมัคร "วันนี้" ยังทันจริง (ต้องเป็นสมาชิกครบ MIN_DAYS ก่อนวันคัด)
function nextRound(now = new Date(), minDays = MIN_DAYS) {
  const eligible = new Date(now);
  eligible.setDate(eligible.getDate() + minDays);
  for (let i = 0; i < 8; i++) {
    for (const day of PICK_DAYS) {
      const round = new Date(now.getFullYear(), now.getMonth() + i, day);
      if (round >= eligible) {
        const cut = new Date(round);
        cut.setDate(cut.getDate() - minDays);
        return { round: thDate(round), cutoff: thDate(cut), roundDate: round, cutoffDate: cut };
      }
    }
  }
  throw new Error('หารอบถัดไปไม่เจอ');
}

// รอบถัดไปหลังวันคัด at (ไม่ใช่รอบที่คนสมัครวันนี้ทัน) — ไว้บอกว่า "รอบหน้าคือวันไหน"
function roundAfter(at = new Date()) {
  const d = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  for (let i = 0; i < 3; i++) {
    for (const day of PICK_DAYS) {
      const r = new Date(d.getFullYear(), d.getMonth() + i, day);
      if (r > d) return r;
    }
  }
  return null;
}

const TH_PLANET = {
  Sun: 'ดาวอาทิตย์', Moon: 'ดาวจันทร์', Mercury: 'ดาวพุธ', Venus: 'ดาวศุกร์', Mars: 'ดาวอังคาร',
  Jupiter: 'ดาวพฤหัส', Saturn: 'ดาวเสาร์', Uranus: 'ดาวยูเรนัส', Neptune: 'ดาวเนปจูน', Pluto: 'ดาวพลูโต',
  Node: 'ราหู', Chiron: 'ไครอน', Ascendant: 'ลัคนา', MC: 'จุดกลางฟ้า',
};
const TH_ASPECT = {
  Conjunction: 'มุมกุม (0°)', Opposition: 'มุมเล็ง (180°)', Trine: 'มุมตรีโกณ (120°)',
  Square: 'มุมฉาก (90°)', Sextile: 'มุมโยค (60°)', Quincunx: 'มุม 150°',
  'Semi-sextile': 'มุม 30°', 'Semi-Square': 'มุม 45°',
};

// 'Pluto Trine Mercury' → { planet:'ดาวพลูโต', aspect:'มุมตรีโกณ (120°)', natal:'ดาวพุธ' }
function describeDetail(detail) {
  const [p, a, n] = String(detail || '').split(' ');
  return {
    planet: TH_PLANET[p] || 'ดาวจร',
    aspect: TH_ASPECT[a] || 'มุมสำคัญ',
    natal: TH_PLANET[n] || 'ดาวในดวงกำเนิด',
  };
}

/**
 * ข้อความประกาศสาธารณะ — ไม่มีชื่อ ไม่มีคำต้องห้าม
 * @param {object} o
 * @param {Date}   o.at      วันคัด
 * @param {string} o.detail  'Pluto Trine Mercury'
 * @param {number} o.total   จำนวนดวงที่เข้าเกณฑ์รอบนี้
 * @param {boolean} [o.forOA2]  บัญชีใหญ่ = คนยังไม่รู้จักบริการ ต้องบอกว่ามันคืออะไร
 */
function announceText({ at = new Date(), name, total, forOA2 = false } = {}) {
  // bon 17 ก.ย. 69: "399 ใครเป็นสมาชิกมีสิทธิ์ลุ้นดูดวงกับอาจารย์ โดยเราจะประกาศชื่อ
  //                  เมื่อถึงเวลา ให้นัดดูหลังจากนั้น" · ต้องชัดถ้อยชัดคำ ไม่ให้ใครเข้าใจผิด
  const next = nextRound(at);
  const after = roundAfter(at);
  const who = name ? `คุณ ${String(name).trim()}` : 'สมาชิก 1 ท่าน';
  const pool = total > 0 ? `จากสมาชิกที่มีสิทธิ์ทั้งหมด ${total} ท่าน` : 'จากสมาชิกที่มีสิทธิ์ทั้งหมด';
  const intro = forOA2 ? ['Prinnie333 คือบริการดวงส่วนตัวของอาจารย์ปรินนี่ทางไลน์', ''] : [];
  const cutoffLine = (after && next.roundDate.getTime() === after.getTime())
    ? `📅 จับรางวัลรอบถัดไป ${thDate(after)} — ต้องเป็นสมาชิกภายใน ${next.cutoff} จึงจะมีสิทธิ์รอบนี้`
    : `📅 จับรางวัลรอบถัดไป ${after ? thDate(after) : next.round} — สมัครวันนี้จะมีสิทธิ์รอบ ${next.round} (สมัครภายใน ${next.cutoff})`;
  const text = [
    `🎉 ผลจับรางวัลสมาชิก Prinnie333 · รอบ ${thDate(at)}`,
    ``,
    ...intro,
    `ผู้ได้รับรางวัลรอบนี้ คือ ${who}`,
    `ได้ดูดวงตัวต่อตัวกับอาจารย์ปรินนี่ฟรี 1 ชั่วโมง`,
    `(${pool})`,
    `ทีมงานจะติดต่อผู้ได้รับรางวัลเพื่อนัดเวลาดูดวงค่ะ`,
    ``,
    `ใครมีสิทธิ์ลุ้น`,
    `• สมาชิก Prinnie333 (399 บาท / 30 วัน)`,
    `• เป็นสมาชิกต่อเนื่องครบ ${MIN_DAYS} วัน ไม่ต้องลงทะเบียนเพิ่ม`,
    `• จับรางวัลทุกวันที่ 2 และ 17 ของเดือน รอบละ 1 ท่าน`,
    ``,
    cutoffLine,
    `👉 สมัครสมาชิก ${SIGNUP_URL}`,
  ].join('\n');
  return assertClean(text);
}

// ยิงประกาศเข้าทั้งสองบัญชี — บัญชีไหนพังก็ไม่ล้มอีกบัญชี · TEST_MODE จะโดนบล็อกใน lineMessaging
async function broadcastAnnouncement({ at, name, total }) {
  const out = { oa1: null, oa2: null };
  try {
    await lm.broadcast([{ type: 'text', text: announceText({ at, name, total }) }]);
    out.oa1 = 'sent';
  } catch (e) { out.oa1 = 'error: ' + e.message; }
  if (lm.oa2Enabled()) {
    try {
      await lm.broadcastOA2([{ type: 'text', text: announceText({ at, name, total, forOA2: true }) }]);
      out.oa2 = 'sent';
    } catch (e) { out.oa2 = 'error: ' + e.message; }
  } else {
    out.oa2 = 'skipped (OA2 ยังไม่ตั้งค่า)';
  }
  return out;
}

module.exports = {
  announceText, broadcastAnnouncement, describeDetail, nextRound, roundAfter, assertClean,
  BANNED, TH_MONTH, TH_PLANET, TH_ASPECT, MIN_DAYS, SIGNUP_URL,
};
