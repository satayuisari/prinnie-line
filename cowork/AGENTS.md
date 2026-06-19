# AGENTS.md — Prinnie333 LINE Support Agents

> Source of truth สำหรับ AI agent ที่ช่วยตอบแชท/แก้ปัญหาใน LINE OA ของ Prinnie333
> แก้ flow/กฎ ให้แก้ไฟล์นี้ก่อน แล้วค่อยอัปเดต YAML / โค้ดตาม
>
> หมายเหตุ: ไฟล์นี้ควรอยู่ที่ **repo root** (`prinnie-line/AGENTS.md`) เพื่อให้ลิงก์ `../AGENTS.md`
> ใน `cowork/README.md` ทำงาน — ตอนนี้วางไว้ใน `cowork/` ก่อนเพราะ mount เฉพาะโฟลเดอร์นี้

เอกสาร/ไฟล์ที่เกี่ยวข้อง:
- `cowork/README.md` — ขั้นตอน deploy ด้วย `ant` CLI
- `cowork/tools-contract.md` — สัญญา tool ฉบับย่อ (ตาราง)
- `cowork/tools-spec.md` — spec เต็ม: JSON schema, error, gating, event
- `cowork/environment.yaml` — container ที่ agent ทำงาน
- `cowork/agents/*.agent.yaml` — นิยาม agent + system prompt (5 ตัว)
- `cowork/poc/` — orchestrator proof-of-concept (เฟส 1 copilot)

---

## บริบทธุรกิจ

| รายการ | ค่า |
|---|---|
| ช่องทาง | LINE Official Account |
| ผู้ติดตาม | ~10,000 คนจริง |
| สถานะปัจจุบัน | staff ตอบแชทเอง |
| สินค้า | บริการดูดวง/โหราศาสตร์ (subscription) |
| ราคา | 399 / 149 |
| การจ่ายเงิน | Stripe |
| ฐานข้อมูล | `line_subscribers` (มี `getMemberStatus` ใน memberService) |
| โครงสร้างเดิม | LINE webhook `src/routes/webhook.js` (host บน Railway) |

---

## หลักคิดสำคัญ (อ่านก่อนเสมอ)

1. **Copilot ก่อน Autopilot** — เฟสแรก agent *ร่าง* คำตอบให้ staff กดส่ง/อนุมัติ ไม่ส่งเองทันที
   (10k คนจริง + เรื่องเงินพลาดไม่ได้) ค่อยปล่อยออโต้เฉพาะหมวดปลอดภัยทีหลัง
2. **เงิน + อารมณ์ = คนตัดสินใจเสมอ** — agent วินิจฉัย/ร่างได้ แต่ "เปิดสิทธิ์ / คืนเงิน / ปลอบลูกค้าที่เครียด"
   ต้องให้คนยืนยัน
3. **เริ่มเล็ก** — โตค่อยแตก subagent เพิ่มตามปริมาณ

---

## สถานการณ์จริงที่จะเข้ามา (หมวด A–F)

| # | ประเภทข้อความ | ตัวอย่าง | ความเสี่ยง | ปลายทาง |
|---|---|---|---|---|
| **A** | คำถามทั่วไป | สมัครยังไง / ของฟรี / วิธีใช้ (ถาม *ราคา* → FAQ ไม่ตอบเอง ให้ escalate) | ต่ำ | FAQ |
| **B** | ปัญหาจ่ายเงิน | จ่ายแล้วไม่ได้สิทธิ์ / บัตรเด้ง / จ่ายซ้ำ / ขอคืนเงิน | **สูง (เงิน)** | Payment → 🔒 คน |
| **C** | ปัญหาใช้งาน | กรอกวันเกิดผิด / ดวงไม่ขึ้น / LIFF จอขาว / แก้ดวง | กลาง | Account |
| **D** | ถามความหมายดวง | ลัคนาคืออะไร / ดวงฉันแปลว่า | กลาง (ห้ามทำนายร้าย) | Astro |
| **E** | อารมณ์ / ร้องเรียน | เครียดเรื่องชีวิต-ความรัก / โกรธ | **สูง (คน)** | escalate + ร่างให้ staff |
| **F** | สแปม / ไม่เกี่ยว | — | ต่ำ (เงียบ) | ไม่ตอบ |
| **U** | **ไม่เข้าข่าย A–F / ไม่รู้ว่าต้องการอะไร** | ข้อความกำกวม สั้นเกิน นอกสคริปต์ | กลาง | escalate `reason=unknown` + ถามลูกค้าว่าต้องการช่วยด้านใด |

> **U ต่างจาก F:** F = ไม่ได้ต้องการอะไรจากเรา → เงียบ. U = คนจริงที่ดูจะต้องการอะไรสักอย่างแต่กำกวม
> → **ห้ามเดา ห้ามเงียบ** ให้ escalate (แจ้ง staff) พร้อมถามกลับว่าต้องการให้ช่วยเรื่องใด

---

## การแบ่ง Agent (coordinator → subagents)

```
LINE webhook ─▶ 🧭 Triage / Router (Sonnet 4.6)
                  │  อ่านข้อความ → จัดประเภท A–F → ดึง context ลูกค้า (get_subscriber)
                  │
                  ├─ A ▶ 💬 FAQ Agent (Haiku) ........ ตอบจากคลังคำถาม
                  ├─ B ▶ 💳 Payment Agent (Opus) ..... วินิจฉัยสถานะจ่าย/สิทธิ์  ⚠️ action = 🔒 ขออนุมัติคน
                  ├─ C ▶ 🛠️ Account Agent (Sonnet) ... แก้วันเกิด / คำนวณดวงใหม่ / ส่ง LIFF
                  ├─ D ▶ 🔮 Astro Agent (Opus) ....... ตีความดวงจริง (โทนบวก + disclaimer)
                  ├─ E ▶ 🙋 escalate_to_human ........ + ร่างคำตอบ + สรุป context ให้ staff
                  └─ F ▶ เงียบ (staff เห็นเอง)
```

แต่ละ agent มี "เครื่องมือ + กฎ + โทน" เฉพาะตัว → แม่นและคุมความเสี่ยงแยกกันได้

---

## เครื่องมือ (custom tools) — Stripe key / DB อยู่ฝั่ง orchestrator เสมอ

ทุก tool รัน **host-side**: agent ส่ง `agent.custom_tool_use` → orchestrator เรียกฟังก์ชันจริงใน
`prinnie-line` → คืน `user.custom_tool_result` Stripe secret / DATABASE_URL ไม่เข้า container

| tool | ผูกกับโค้ดเดิม | Gating |
|---|---|---|
| `get_subscriber` | `getMemberStatus()` (memberService) | — |
| `get_payment_status` | query Stripe (stripeService) | — |
| `detect_mismatch` | จ่ายสำเร็จใน Stripe แต่ DB ยัง PENDING | — |
| `activate_subscription` | `activateSubscription()` +days | 🔒 always_ask |
| `issue_refund` | Stripe refund | 🔒 always_ask |
| `send_liff_link` | ส่ง LIFF url (signup/couple) | — |
| `recompute_chart` | `computeNatalChart()` | — |
| `resend_daily` | `dailyReading()` push ซ้ำ (เฉพาะ active) | — |
| `get_user_chart` | ดึง `chart_data` จาก DB | — |
| `escalate_to_human` | เข้าคิว staff | — |

🔒 = orchestrator ต้องหยุด → แจ้ง staff → รอกดอนุมัติ → ค่อยทำจริงและคืนผล
(Managed Agents permission policy ครอบเฉพาะ built-in/MCP ไม่ครอบ custom tool — gate ที่โค้ดเราเอง)
รายละเอียด input/output ดู `cowork/tools-spec.md`

---

## การเลือกโมเดลต่อ agent

| Agent | โมเดล | เหตุผล |
|---|---|---|
| 🧭 Triage / Router | Sonnet 4.6 | ปริมาณเยอะ ต้องเร็ว + ฉลาดพอจัดประเภท |
| 💬 FAQ | Haiku 4.5 | ตอบคำถามซ้ำ ๆ ถูกสุด |
| 💳 Payment | Opus 4.8 | เรื่องเงิน ต้องแม่น ห้ามมั่ว |
| 🛠️ Account | Sonnet 4.6 | งานแก้ข้อมูล / แนะนำ |
| 🔮 Astro | Opus 4.8 | คุณภาพการตีความ = ตัวสินค้า |

---

## กฎความปลอดภัย (ใส่ใน system prompt ทุกตัว)

- ห้ามทำนายเรื่อง **สุขภาพ / ความตาย / ฟันธงแง่ร้าย** — โทนบวก ให้กำลังใจ + แนะปรึกษาผู้เชี่ยวชาญถ้าเป็นสุขภาพจริง
- ห้ามสัญญา **คืนเงิน / เปิดสิทธิ์** เองโดยไม่ผ่านคน
- เจอสัญญาณ **เครียด / โกรธ** → `escalate_to_human` ทันที ไม่ดันให้บอทตอบ
- **ไม่ broadcast เด็ดขาด** — ตอบเฉพาะคนที่ทักเข้ามา

---

## โรดแมปลงจริง

| เฟส | ขอบเขต | หมายเหตุ |
|---|---|---|
| **เฟส 1 — Copilot** | ทุก output ของ agent → ขึ้นจอ staff กดส่ง; `escalate_to_human` = ทุกเคสมีคนดู | แบ่งเบาทันที ไม่เสี่ยง |
| **เฟส 2 — auto บางส่วน** | ปล่อยออโต้เฉพาะ A (FAQ) + C (account) | B (payment) + E (อารมณ์) ผ่านคนเสมอ |
| **เฟส 3 — ขยาย** | แตก subagent เพิ่มตามปริมาณ | เมื่อ 1 roster ไม่พอ |

**Build บนอะไร (เลือกแล้ว):** Claude **Managed Agents** (coordinator + roster) ผ่าน `ant` CLI —
orchestrator ฝั่งเรารับ event custom tool + gate เรื่องเงิน + copilot staff approval + เชื่อม LINE webhook เดิม

---

## Decision log

| วันที่ | การตัดสินใจ | เหตุผล |
|---|---|---|
| 2026-06-18 | เลือก Managed Agents (ant CLI) เป็น build path | ให้ Anthropic รัน agent loop, เราดูแลแค่ tool + gate + LINE |
| 2026-06-18 | เริ่ม Copilot v1 (triage + 4 subagents + escalate) | ลดความเสี่ยง 10k คนจริง / เรื่องเงิน |
