# Prinnie333 — Cowork / Managed Agents setup

ชุดนิยาม agent สำหรับให้ Claude Cowork (Managed Agents) ช่วยตอบแชท + แก้ปัญหาลูกค้าบน LINE OA
ออกแบบตาม flow ใน [`../AGENTS.md`](../AGENTS.md) — **copilot ก่อน autopilot**, เงิน/อารมณ์ให้คนตัดสินใจเสมอ

## โครงสร้าง
```
cowork/
  README.md            ← ไฟล์นี้
  environment.yaml     ← container ที่ agent ทำงาน (ไม่ต้องต่อเน็ต — tool อยู่ฝั่งเรา)
  agents/
    triage.agent.yaml   🧭 coordinator จัดเส้นทาง A–F
    faq.agent.yaml      💬 คำถามทั่วไป (Haiku)
    payment.agent.yaml  💳 ปัญหาจ่ายเงิน (Opus) — action ขออนุมัติคน
    account.agent.yaml  🛠️ แก้วันเกิด/ดวงไม่ขึ้น (Sonnet)
    astro.agent.yaml    🔮 ตีความดวง (Opus) — โทนบวก ห้ามทำนายร้าย
  tools-contract.md    ← สัญญา input/output ของ custom tool ทุกตัว (orchestrator ต้อง implement)
```

## ลำดับการเชื่อม (สำคัญ: roster อ้างด้วย agent id ที่ได้หลังสร้าง)

```sh
# 0) auth (ทำครั้งเดียว)
ant auth login

# 1) สร้าง environment → เก็บ id
ENV_ID=$(ant beta:environments create < cowork/environment.yaml --transform id -r)

# 2) สร้าง subagent 4 ตัวก่อน → เก็บ id ของแต่ละตัว
FAQ_ID=$(ant beta:agents create < cowork/agents/faq.agent.yaml --transform id -r)
PAY_ID=$(ant beta:agents create < cowork/agents/payment.agent.yaml --transform id -r)
ACC_ID=$(ant beta:agents create < cowork/agents/account.agent.yaml --transform id -r)
AST_ID=$(ant beta:agents create < cowork/agents/astro.agent.yaml --transform id -r)

# 3) ใส่ id ทั้ง 4 ลงใน multiagent.agents ของ triage.agent.yaml แล้วค่อยสร้าง coordinator
#    (แก้ค่า REPLACE_*_ID ในไฟล์ก่อน หรือ inject ผ่าน stdin)
TRIAGE_ID=$(ant beta:agents create < cowork/agents/triage.agent.yaml --transform id -r)

# 4) ทดสอบ session เดียว (ดู Console live)
ant beta:sessions create --agent "$TRIAGE_ID" --environment-id "$ENV_ID" --title "support test"
```

> **อัปเดตทีหลัง** ใช้ `ant beta:agents update --agent-id <id> --version <n> < file.yaml` (เก็บ YAML ใน git เป็น source of truth)

## ⚠️ สิ่งที่ orchestrator (ฝั่งเรา) ต้องทำเอง
1. **รับ event `agent.custom_tool_use`** จาก session stream → เรียกฟังก์ชันจริงใน prinnie-line (ดู `tools-contract.md`) → ส่ง `user.custom_tool_result` กลับ. Stripe/DB อยู่ฝั่งนี้ ไม่เข้า container
2. **Gate action เรื่องเงิน**: `activate_subscription` / `issue_refund` ถูกประกาศเป็น custom tool — เมื่อ agent เรียก **ห้ามทำทันที** ต้องเด้งให้ staff กดอนุมัติก่อน แล้วค่อยคืนผล (permission policy ของ Managed Agents ครอบเฉพาะ built-in/MCP ไม่ครอบ custom tool — การ gate จึงทำที่ orchestrator)
3. **Copilot mode (เฟส 1)**: เอา text ที่ agent ตอบไป **ขึ้นให้ staff กดส่ง** บน OA แทนการ push อัตโนมัติ (กันพลาดหา 10k followers)
4. **เชื่อม LINE**: webhook เดิม (`src/routes/webhook.js`) ส่งข้อความเข้า session ของ triage; คำตอบ/ร่างกลับไปที่หน้าจอ staff หรือ push (เฟส 2)

## โมเดลที่ใช้
triage=Sonnet 4.6 · faq=Haiku 4.5 · payment=Opus 4.8 · account=Sonnet 4.6 · astro=Opus 4.8
