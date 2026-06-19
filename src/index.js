require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');

const lineRoutes    = require('./routes/line');
const paymentRoutes = require('./routes/payment');
const webhook       = require('./routes/webhook');
const stripeWebhook = require('./routes/stripeWebhook');
const dashboard     = require('./routes/dashboard');
const scheduler     = require('./scheduler/dailyHoroscope');
const nudges        = require('./scheduler/nudges');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// ⚠️ webhook ต้อง register ก่อน bodyParser.json() — ใช้ raw body ตรวจลายเซ็น
webhook.register(app);        // LINE
stripeWebhook.register(app);  // Stripe

app.use(bodyParser.json());
app.use(express.static('liff'));

app.use('/api/line',    lineRoutes);
app.use('/api/payment', paymentRoutes);

dashboard.register(app);   // /dashboard?key=DASHBOARD_KEY
app.get('/health', (_, res) => res.json({ ok: true }));

scheduler.start();
nudges.start();

const mode = process.env.TEST_MODE === 'true' ? '🧪 TEST_MODE (push เฉพาะ allowlist)' : '🚀 PRODUCTION';
app.listen(PORT, () => {
  console.log(`Prinnie LINE Backend — port ${PORT}  [${mode}]`);
});
