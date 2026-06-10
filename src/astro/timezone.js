// จัดการ timezone + DST อัตโนมัติ
// พิกัด → IANA timezone → แปลงเวลาเกิดท้องถิ่นเป็น UTC (จัดการ DST ถูกต้องตามวันที่)

const tzlookup     = require('tz-lookup');
const { DateTime } = require('luxon');

// พิกัด → ชื่อ timezone (เช่น "America/Los_Angeles", "Asia/Bangkok")
function zoneFromCoords(lat, lng) {
  try {
    return tzlookup(Number(lat), Number(lng));
  } catch (e) {
    return null;
  }
}

function parseTime(timeStr) {
  if (!timeStr) return { hh: 12, mm: 0 };
  const p = String(timeStr).split(':').map(Number);
  return { hh: p[0] || 0, mm: p[1] || 0 };
}

// เวลาเกิดท้องถิ่น (wall clock) ในโซน zone → UTC JS Date
// luxon จัดการ DST เอง: ใส่ "1997-03-01 19:30 America/Los_Angeles" → รู้ว่าเป็น PST (-8)
//                       ใส่ "1997-07-01 19:30 America/Los_Angeles" → รู้ว่าเป็น PDT (-7)
function localToUTC(dateStr, timeStr, zone) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const { hh, mm } = parseTime(timeStr);

  const dt = DateTime.fromObject(
    { year: y, month: mo, day: d, hour: hh, minute: mm },
    { zone }
  );
  if (!dt.isValid) {
    throw new Error(`เวลา/โซนไม่ถูกต้อง: ${dt.invalidReason} (${zone})`);
  }
  return dt.toUTC().toJSDate();
}

// offset จริง ณ วันเกิดนั้น (ชั่วโมง) — ใช้แสดงผล/ตรวจสอบ
function offsetHours(dateStr, timeStr, zone) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const { hh, mm } = parseTime(timeStr);
  const dt = DateTime.fromObject(
    { year: y, month: mo, day: d, hour: hh, minute: mm }, { zone }
  );
  return dt.isValid ? dt.offset / 60 : null;
}

// โซนนั้นกำลัง DST อยู่ไหม ณ วันเกิด
function isDST(dateStr, timeStr, zone) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const { hh, mm } = parseTime(timeStr);
  const dt = DateTime.fromObject(
    { year: y, month: mo, day: d, hour: hh, minute: mm }, { zone }
  );
  return dt.isValid ? dt.isInDST : null;
}

module.exports = { zoneFromCoords, localToUTC, offsetHours, isDST };
