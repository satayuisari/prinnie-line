# Tool Contract — custom tools ที่ orchestrator ต้อง implement

ทุก tool รันฝั่งเรา (host-side) เมื่อ agent ส่ง event `agent.custom_tool_use` orchestrator เรียกฟังก์ชันจริงใน `prinnie-line` แล้วตอบกลับด้วย `user.custom_tool_result`
Stripe secret / DATABASE_URL อยู่ฝั่งนี้เท่านั้น — ไม่ส่งเข้า container

| tool | input | ทำอะไร (ผูกกับโค้ดที่มีอยู่) | output (ตัวอย่าง) |
|---|---|---|---|
| `get_subscriber` | `line_user_id` | `getMemberStatus()` ใน memberService | `{status, birth_date, birth_time, place, expires_at}` |
| `get_payment_status` | `email?`, `line_user_id?` | query Stripe (stripeService) | `{paid, amount, type, charge_id, created}` |
| `detect_mismatch` | `line_user_id` | จ่ายสำเร็จใน Stripe แต่ DB ยัง PENDING | `{mismatch: true/false, charge_id?}` |
| 🔒 `activate_subscription` | `line_user_id, days, reason` | **รออนุมัติ staff** → `activateSubscription()` +days | `{activated: true, new_expiry}` |
| 🔒 `issue_refund` | `payment_ref, reason` | **รออนุมัติ staff** → Stripe refund | `{refunded: true, refund_id}` |
| `send_liff_link` | `line_user_id, view?` | ส่ง LIFF url (signup/couple) | `{sent: true}` |
| `recompute_chart` | `line_user_id` | `computeNatalChart()` ใหม่ ไม่เก็บเงิน | `{ok: true, sun, moon, rising}` |
| `resend_daily` | `line_user_id` | `dailyReading()` push ซ้ำ (เฉพาะ active) | `{sent: true}` หรือ `{error: "not_active"}` |
| `get_user_chart` | `line_user_id` | ดึง chart_data จาก DB | `{sun, moon, rising, transits[...]}` |
| `escalate_to_human` | `reason, summary, draft_reply?` | เข้าคิว staff (เฟส1=ทุกเคสผ่านคน) | `{queued: true, ticket_id}` |

🔒 = **gated action** — orchestrator ต้องหยุด, แจ้ง staff, รอกดอนุมัติ แล้วค่อยทำจริงและคืนผล
(Managed Agents permission policy ครอบเฉพาะ built-in/MCP tool ไม่ครอบ custom tool — การ gate ทำที่โค้ดเราเอง)

## รูปแบบ event (อ้างอิง SDK)
```
agent.custom_tool_use  → { id, name, input }      # agent เรียก, session ไป idle
  → orchestrator ทำงาน (+ ขออนุมัติถ้าเป็น 🔒)
user.custom_tool_result → { tool_use_id: id, content: [...] }   # ส่งผลกลับ, session ไปต่อ
```

## เฟสการปล่อย
- **เฟส 1 — copilot**: ทุก output ของ agent → ขึ้นจอ staff กดส่ง; `escalate_to_human` = ทุกเคสมีคนดู
- **เฟส 2 — auto เฉพาะ low-risk**: ปล่อยให้ FAQ + account ตอบเอง; payment + astro(เปราะบาง) ยังผ่านคนเสมอ
