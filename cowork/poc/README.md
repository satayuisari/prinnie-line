# poc/ — Orchestrator (เฟส 1: Copilot)

Proof-of-concept ของ "ฝั่ง orchestrator" ที่ `cowork/README.md §45–49` บอกว่าต้องทำเอง:
รับ event custom tool จาก Managed Agents → เรียกฟังก์ชันจริงใน `prinnie-line` → gate เรื่องเงิน →
เอาคำตอบขึ้นจอ staff กดส่ง (ไม่ push ตรงถึงลูกค้า)

## รันดู flow ทันที (ไม่ต้องต่อ LINE/SDK)
```sh
cd cowork/poc
npm install          # ติดตั้ง express (อย่างเดียวพอสำหรับ server; demo ไม่ต้องใช้)
node src/demo.js     # รันเคส B แบบ stub end-to-end
```
จะเห็น: ลูกค้าทัก → `detect_mismatch` → `activate_subscription` (🔒 เข้าคิวอนุมัติ จำลอง staff กด) →
คำตอบเข้า copilot (จำลอง staff กดส่ง) → push ถึงลูกค้า

## รันเป็น server + เปิด staff console (หน้าเว็บ)
```sh
cp .env.example .env   # เติมค่า
npm install
node src/index.js
# เปิดเบราว์เซอร์: http://localhost:8080/console/console.html
```
หน้าเว็บมี 3 คอลัมน์ (poll อัตโนมัติทุก 2.5 วิ): **รออนุมัติเงิน · ร่างคำตอบกดส่ง · เคสต้องให้คนดู**
แก้ข้อความในกล่องร่างได้ก่อนกดส่ง; เคส high (อารมณ์/ร้องเรียน) ขึ้นบนสุด

| endpoint | ใช้ทำอะไร |
|---|---|
| `POST /line/webhook` | รับข้อความจาก LINE → orchestrator |
| `GET  /staff/approvals` · `POST /staff/approvals/:id/approve` · `.../reject` | อนุมัติ/ปฏิเสธ gated action (เงิน) |
| `GET  /staff/drafts` · `POST /staff/drafts/:id/send` · `.../discard` | คิวร่างคำตอบ (copilot) |
| `GET  /staff/escalations` · `POST /staff/escalations/:id/resolve` | เคสต้องให้คนดู (อารมณ์ / **unknown-intent**) |
| `GET  /staff/summary` | ตัวนับ badge + เฟส |
| `GET  /console/console.html` | หน้าเว็บ staff console |
| `GET  /health` | เช็คสถานะ + เฟส |

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `src/index.js` | wire ทุกอย่าง + เปิด HTTP server + serve `/console` |
| `src/orchestrator.js` | event loop: custom_tool_use / message / idle |
| `src/tools.js` | implement tool ทุกตัว + **gating** (`activate_subscription`, `issue_refund`) |
| `src/prinnieServices.js` | **จุดต่อเดียว** ไป backend จริง — dynamic require + fallback stub (auto LIVE/STUB) |
| `src/approvals.js` | คิวอนุมัติ staff สำหรับ gated tool |
| `src/escalations.js` | คิวเคสต้องให้คนดู (อารมณ์ / unknown-intent) → แสดงบน console |
| `src/copilot.js` | เฟส 1 = ทุกคำตอบขึ้นจอ staff; เฟส 2 = auto เฉพาะ faq/account |
| `src/agentClient.js` | ห่อ Managed Agents session (stub + TODO ต่อ SDK จริง) |
| `src/lineWebhook.js` | express router: LINE webhook + staff console API |
| `public/console.html` | **หน้าเว็บ staff console** (อนุมัติเงิน / กดส่งร่าง / เคส alert) |
| `src/demo.js` | รัน flow เคส B (จ่ายเงิน) + เคส U (unknown-intent) แบบ stub |

## ต่อของจริง (3 จุด TODO)
1. **`prinnieServices.js`** — ตั้ง path service จริงผ่าน env (`MEMBER_SERVICE_PATH`, `STRIPE_SERVICE_PATH`,
   `ASTRO_SERVICE_PATH`, `LINE_SERVICE_PATH`) หรือแก้ค่า default. adapter จะ `require` ให้อัตโนมัติ →
   ขึ้น **LIVE** ถ้าเจอ, ตกมา **STUB** ถ้าไม่เจอ (ดู log ตอน start). ถ้าชื่อ method ต่างจากที่คาดไว้
   ปรับ `pick(...)` ในแต่ละฟังก์ชัน (signature ที่คาดหวังอยู่หัวไฟล์)
2. **`agentClient.js`** — ✅ ทำแล้ว: มีโหมด LIVE ที่ stream session จริง (create → user.message →
   จับ `requires_action`/`agent.custom_tool_use` → `user.custom_tool_result` → `end_turn`).
   เปิดใช้แค่ตั้ง `ANTHROPIC_API_KEY` + `TRIAGE_AGENT_ID` + `SUPPORT_ENV_ID` ใน `.env`
   (ไม่ตั้ง = โหมด STUB). ดูขั้นตอนเต็มใน `TESTING-LINE.md`
3. **`lineWebhook.js`** — รวมเข้ากับ `src/routes/webhook.js` เดิม + ตรวจ LINE signature; ผูกปุ่ม staff
   console เข้าช่องทางจริง (LINE staff group / เว็บ / Slack)

## หลักการที่ฝังไว้ (อย่าถอด)
- `activate_subscription` / `issue_refund` = **gated** เสมอ (gate ที่ `tools.dispatch`, ไม่ใช่ที่ agent)
- เฟส 1 = ไม่มีอะไร push ถึงลูกค้าโดยไม่ผ่าน staff (`copilot.handleAgentReply`)
- push เป็น 1:1 เท่านั้น — **ไม่ broadcast** (กันพลาดหา 10k followers)
- Stripe key / DATABASE_URL อยู่ในฝั่งนี้เท่านั้น ไม่เข้า container ของ agent
