// ตรวจสอบตัวตนผู้ใช้จาก LINE access token (ที่ LIFF ส่งมา)
// เรียก Social API GET /v2/profile ด้วย token ของผู้ใช้เอง — ถ้า token ใช้ได้
// จะได้ profile ของ "เจ้าของ token" กลับมา → userId นี้เชื่อถือได้ (ปลอมไม่ได้)
//
// เหตุผล: เดิม endpoint รับ line_user_id จาก body/query ตรง ๆ ใครรู้ userId คนอื่น
// ก็อ่าน/เขียนข้อมูลเขาได้ การ verify token ทำให้ทำได้แค่ในนามของตัวเองเท่านั้น
const PROFILE_URL = 'https://api.line.me/v2/profile';

async function verifyAccessToken(token) {
  if (!token) throw new Error('ไม่มี access token');
  const resp = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${token}` },
    signal:  AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`token ไม่ถูกต้อง (HTTP ${resp.status})`);
  const p = await resp.json();
  if (!p.userId) throw new Error('token ไม่มี userId');
  return { userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl };
}

// Express middleware: อ่าน token จาก Authorization: Bearer / body / query → ตั้ง req.line
async function requireAuth(req, res, next) {
  try {
    const auth   = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const token  = bearer || (req.body && req.body.access_token) || req.query.access_token;
    req.line = await verifyAccessToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: 'unauthorized: ' + err.message });
  }
}

module.exports = { verifyAccessToken, requireAuth };
