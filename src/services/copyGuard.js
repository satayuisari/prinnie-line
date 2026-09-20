// ด่านตรวจถ้อยคำก่อนส่งออกหาลูกค้า — ที่เดียวในระบบที่ตัดสินว่าข้อความไหนห้ามส่ง
//
// ทำไมต้องแยกไฟล์ (21 ก.ย. 69): เดิม assertClean อยู่ใน pickAnnounce แล้วให้แต่ละ
// ตัวเขียนข้อความเรียกเอง ใครลืมเรียกก็หลุดออกไปได้ — ซึ่งเกิดจริงเมื่อ 16 ก.ย.
// ข้อความเปิดตัวหัว "ดวงเลือกคุณ" ถูกบรอดแคสต์หาทุกคน คนอ่านเข้าใจว่าตัวเองได้รางวัล
// ตอนนี้ lineMessaging เรียกด่านนี้ตอน "จะส่ง" ไม่ใช่ตอน "เขียนเสร็จ" ลืมไม่ได้อีก
//
// คำต้องห้ามคือคำที่เคยทำให้คนเข้าใจผิดจริง ไม่ใช่คำที่ฟังดูไม่สุภาพ:
//   ดวงเลือกคุณ · เจ้าของดวง   หัวข้อความที่ทำให้ทุกคนคิดว่าตัวเองได้
//   ตรีโกณ · ทำมุม · จังหวะสำคัญ  ศัพท์โหราศาสตร์ที่คนทั่วไปอ่านไม่ออก
// (คำว่า จับรางวัล/ลุ้น/ผู้โชคดี ไม่ห้ามแล้ว — bon ยกเลิกเอง 17 ก.ย. 69)

const BANNED = ['ดวงเลือกคุณ', 'เจ้าของดวง', 'จังหวะสำคัญ', 'ตรีโกณ', 'ทำมุม'];

class BannedCopyError extends Error {}

function findBanned(text) {
  const s = String(text == null ? '' : text);
  return BANNED.find(w => s.includes(w)) || null;
}

function assertClean(text) {
  const hit = findBanned(text);
  if (hit) throw new BannedCopyError(`ข้อความมีคำต้องห้าม "${hit}" — แก้ก่อนส่ง`);
  return text;
}

// ตรวจทั้งชุดข้อความที่กำลังจะส่ง (text / flex altText / ปุ่มใน template)
// เดินทุกค่าที่เป็นสตริงในออบเจกต์ เพราะคำต้องห้ามโผล่ในปุ่มหรือ altText ก็เข้าใจผิดได้เหมือนกัน
function assertMessagesClean(messages) {
  const seen = [];
  const walk = (node) => {
    if (typeof node === 'string') { seen.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') { Object.values(node).forEach(walk); }
  };
  walk(messages);
  for (const s of seen) assertClean(s);
  return messages;
}

module.exports = { BANNED, assertClean, assertMessagesClean, findBanned, BannedCopyError };
