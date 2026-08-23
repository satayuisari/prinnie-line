require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const bodyParser = require('body-parser');

const lineRoutes    = require('./routes/line');
const paymentRoutes = require('./routes/payment');
const webhook       = require('./routes/webhook');
const beamWebhook   = require('./routes/beamWebhook');
const dashboard     = require('./routes/dashboard');
const goRedirect    = require('./routes/go');
const scheduler     = require('./scheduler/dailyHoroscope');
const nudges        = require('./scheduler/nudges');
const renewals      = require('./scheduler/renewals');
const launchCast    = require('./scheduler/launchBroadcast');
const perfReport    = require('./scheduler/perfReport');
const pendingOrders = require('./scheduler/pendingOrders');
const loyalty       = require('./scheduler/loyaltyRewards');
const winbackBlast  = require('./scheduler/winbackBlast');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// security headers — ปิด CSP (หน้า LIFF มี inline script) + ยอมโหลดรูปข้ามโดเมน (LINE share picker)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
app.set('trust proxy', 1);   // อยู่หลัง Railway proxy → ให้ rate-limit เห็น client IP จริง

// ⚠️ webhook ต้อง register ก่อน bodyParser.json() — ใช้ raw body ตรวจลายเซ็น
// (register ก่อน rate-limit ด้วย → LINE/Beam ส่ง burst ได้ ไม่โดนจำกัด)
webhook.register(app);      // LINE
beamWebhook.register(app);  // Beam (ชำระเงิน)

app.use(bodyParser.json());
app.use(express.static('liff'));

// จำกัดอัตราคำขอ กันยิงถล่ม (signup/geocode/render รูป = แพง) — webhook ไม่โดนเพราะ register ไปก่อนแล้ว
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'คำขอถี่เกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่นะคะ ✨' },
});
// ด่านกัน brute-force คีย์ dashboard (เข้มกว่า)
const dashLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
});

app.use('/api/line',    apiLimiter, lineRoutes);
app.use('/api/payment', apiLimiter, paymentRoutes);

app.use('/dashboard', dashLimiter);
dashboard.register(app);   // /dashboard?key=DASHBOARD_KEY
goRedirect.register(app);  // /go?s=yt → นับคลิกแยกช่องทาง → แอดเพื่อน LINE
app.get('/health', (_, res) => res.json({ ok: true }));

scheduler.start();
nudges.start();
renewals.start();
launchCast.start();
perfReport.start();
pendingOrders.start();
loyalty.start();
winbackBlast.start();

const mode = process.env.TEST_MODE === 'true' ? '🧪 TEST_MODE (push เฉพาะ allowlist)' : '🚀 PRODUCTION';
app.listen(PORT, () => {
  console.log(`Prinnie LINE Backend — port ${PORT}  [${mode}]`);
});
