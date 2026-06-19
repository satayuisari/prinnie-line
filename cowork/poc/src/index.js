'use strict';
/**
 * index.js — wire ทุกอย่างเข้าด้วยกันแล้วเปิด HTTP server
 * รันจริง: node src/index.js (ต้องมี .env ครบ + useStub=false เมื่อต่อ SDK จริง)
 */
try { require('dotenv').config(); } catch { /* dotenv optional — ใช้ env จากระบบได้ */ }
const express = require('express');
const { Orchestrator } = require('./orchestrator');
const { buildRouter } = require('./lineWebhook');

const orchestrator = new Orchestrator({
  agentId: process.env.TRIAGE_AGENT_ID,
  environmentId: process.env.SUPPORT_ENV_ID,
  useStub: !process.env.TRIAGE_AGENT_ID, // ยังไม่ตั้ง id → ใช้ stub
});

const path = require('path');
const app = express();
app.use(buildRouter(orchestrator));
// staff console (หน้าเว็บ) — ตั้ง console.html เป็น index → เปิด /console ได้เลย
app.use('/console', express.static(path.join(__dirname, '..', 'public'), { index: 'console.html' }));
app.get('/', (_req, res) => res.redirect('/console/')); // เปิด localhost:8080 เฉย ๆ → เด้งเข้า console
app.get('/health', (_req, res) => res.json({ ok: true, phase: Number(process.env.RELEASE_PHASE || 1) }));

const port = process.env.ORCHESTRATOR_PORT || 8080;
app.listen(port, () => {
  console.log(`[orchestrator] listening :${port} (phase ${process.env.RELEASE_PHASE || 1})`);
  console.log(`[orchestrator] เปิด staff console: http://localhost:${port}/`);
});
