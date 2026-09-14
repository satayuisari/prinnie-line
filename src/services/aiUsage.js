// จดว่าเรียก AI ไปกี่โทเคน เพื่อให้เดือนหน้ามีตัวเลขจริงให้ดู ไม่ต้องเดา
//
// จดแล้วห้ามพัง: ถ้าเขียนตารางไม่ได้ด้วยเหตุใดก็ตาม ต้องไม่ทำให้คำตอบที่
// ลูกค้ารออยู่หายไป การวัดผลสำคัญน้อยกว่าการตอบลูกค้าเสมอ
const db = require('../db');

async function record(feature, model, resp, ok = true) {
  try {
    const u = (resp && resp.usage) || {};
    await db.query(
      `INSERT INTO ai_usage (feature, model, input_tokens, output_tokens, ok)
       VALUES ($1,$2,$3,$4,$5)`,
      [feature, model, u.input_tokens || 0, u.output_tokens || 0, ok],
    );
  } catch (e) {
    console.error('[aiUsage] จดไม่ได้:', e.message);
  }
}

/** สรุปรายเดือน แยกตามฟีเจอร์และโมเดล — ใช้ตอบคำถามว่าเงินหมดไปกับอะไร */
async function monthly(months = 3) {
  const { rows } = await db.query(
    `SELECT to_char(created_at,'YYYY-MM') AS month, feature, model,
            COUNT(*)::int AS calls,
            SUM(input_tokens)::bigint  AS input_tokens,
            SUM(output_tokens)::bigint AS output_tokens
       FROM ai_usage
      WHERE created_at > NOW() - ($1 || ' months')::interval
      GROUP BY 1,2,3
      ORDER BY 1 DESC, calls DESC`,
    [String(months)],
  );
  return rows;
}

module.exports = { record, monthly };
