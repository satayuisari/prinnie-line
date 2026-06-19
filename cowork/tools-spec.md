# tools-spec.md — Custom Tool Spec (ฉบับเต็ม)

> ขยายจาก `tools-contract.md` (ตารางย่อ) เป็น spec ที่ implement ได้จริง: JSON schema input/output,
> error cases, gating flow, และตัวอย่าง event ของ Managed Agents SDK
>
> หลักการ: ทุก tool รัน **host-side (orchestrator)**. agent เห็นแค่ชื่อ + schema ไม่เห็น Stripe key / DB
> ทุก output เป็น JSON ที่ orchestrator ส่งกลับใน `user.custom_tool_result.content[0].text`

ค่าคงที่ที่ใช้ร่วม:
- `line_user_id` = LINE user id (`U...`) — เป็น key หลักที่ agent ใช้อ้างลูกค้า
- ทุก output ควรมี field `ok: boolean`; ถ้า `ok:false` ต้องมี `error: string` (รหัส) + `message?: string`
- error codes มาตรฐาน: `not_found` · `not_active` · `stripe_error` · `db_error` · `invalid_input` · `awaiting_approval` · `rejected_by_staff`

---

## 1. `get_subscriber` — อ่านสถานะสมาชิก

ผูกกับ: `memberService.getMemberStatus(lineUserId)`

**input**
```json
{ "line_user_id": "U1234..." }
```
**output (ok)**
```json
{
  "ok": true,
  "status": "ACTIVE",            // ACTIVE | PENDING | EXPIRED | NONE
  "plan": "399",                 // "399" | "149" | null
  "birth_date": "1995-08-21",    // ISO date | null
  "birth_time": "14:30",         // HH:mm | null  (null = ไม่รู้เวลาเกิด → ลัคนาอาจไม่แม่น)
  "place": "Bangkok, TH",        // string | null
  "expires_at": "2026-07-15T00:00:00+07:00"  // ISO | null
}
```
**output (error)**: `{ "ok": false, "error": "not_found" }`
**หมายเหตุ**: read-only, ไม่ gate. Triage เรียกตัวนี้ทุกครั้งเพื่อดึง context ก่อน route

---

## 2. `get_payment_status` — เช็คการจ่ายฝั่ง Stripe

ผูกกับ: `stripeService` (query customer/charges ด้วย email หรือ metadata `line_user_id`)

**input** (ต้องมีอย่างน้อย 1 field)
```json
{ "line_user_id": "U1234...", "email": "user@example.com" }
```
**output (ok)**
```json
{
  "ok": true,
  "paid": true,
  "amount": 399,
  "currency": "thb",
  "type": "399",                 // "399" | "149"
  "charge_id": "ch_3Q...",
  "status": "succeeded",         // succeeded | pending | failed
  "created": "2026-06-18T09:12:00+07:00"
}
```
**output (ไม่เจอการจ่าย)**: `{ "ok": true, "paid": false }`
**output (error)**: `{ "ok": false, "error": "stripe_error", "message": "..." }`
**หมายเหตุ**: read-only. ใช้ตอบเคส B "จ่ายแล้วหรือยัง / จ่ายเท่าไหร่"

---

## 3. `detect_mismatch` — จ่ายสำเร็จแต่ DB ยังไม่ active (เคสยอดฮิต)

ผูกกับ: เทียบ `get_payment_status.paid==true && status==succeeded` กับ `get_subscriber.status!=ACTIVE`

**input**
```json
{ "line_user_id": "U1234..." }
```
**output**
```json
{
  "ok": true,
  "mismatch": true,              // true = จ่ายแล้วแต่ DB ไม่ active → ควรเสนอ activate
  "charge_id": "ch_3Q...",
  "paid_amount": 399,
  "db_status": "PENDING",
  "suggested_days": 30           // คำนวณจาก plan → ใช้ป้อน activate_subscription
}
```
**output (ไม่ mismatch)**: `{ "ok": true, "mismatch": false }`
**หมายเหตุ**: read-only แต่ "ผลลัพธ์" มักนำไปสู่ `activate_subscription` (gated) → Payment agent ห้ามถือว่าแก้แล้ว

---

## 4. 🔒 `activate_subscription` — เปิด/ต่อสิทธิ์ (GATED)

ผูกกับ: `memberService.activateSubscription(lineUserId, days, { reason })`

**input**
```json
{ "line_user_id": "U1234...", "days": 30, "reason": "stripe ch_3Q... จ่าย 399 สำเร็จ แต่ DB PENDING" }
```
**gating flow (orchestrator)**
1. รับ `custom_tool_use` → **ไม่เรียกฟังก์ชันทันที**
2. โพสต์การ์ดอนุมัติให้ staff: ลูกค้า, charge, days, reason, ปุ่ม [อนุมัติ] [ปฏิเสธ]
3. ถ้ายังไม่กด → คืน `{ "ok": false, "error": "awaiting_approval" }` (หรือ hold ไว้ตาม design queue)
4. staff อนุมัติ → เรียกจริง → คืน output ด้านล่าง; ปฏิเสธ → `{ "ok": false, "error": "rejected_by_staff", "message": "<เหตุผล staff>" }`

**output (ok, หลังอนุมัติ)**
```json
{ "ok": true, "activated": true, "new_expiry": "2026-07-18T00:00:00+07:00", "approved_by": "staff_id" }
```
**หมายเหตุ**: agent ต้องสื่อกับลูกค้าว่า "กำลังดำเนินการให้ทีมงานยืนยัน" ห้ามบอกว่าเปิดให้แล้วก่อนได้ `activated:true`

---

## 5. 🔒 `issue_refund` — คืนเงิน (GATED)

ผูกกับ: Stripe refund API (host-side)

**input**
```json
{ "payment_ref": "ch_3Q...", "amount": 399, "reason": "จ่ายซ้ำ 2 รอบ คืนรอบที่ 2" }
```
**gating flow**: เหมือน `activate_subscription` — รออนุมัติ staff เสมอ
**output (ok)**
```json
{ "ok": true, "refunded": true, "refund_id": "re_3Q...", "amount": 399, "approved_by": "staff_id" }
```
**error เฉพาะ**: `already_refunded` · `charge_not_found`
**หมายเหตุ**: ห้ามสัญญายอด/เวลาคืนเงินกับลูกค้าก่อนได้ `refunded:true`

---

## 6. `send_liff_link` — ส่งลิงก์ LIFF

ผูกกับ: สร้าง LIFF url ตาม view + push ผ่าน LINE Messaging API (เฉพาะ 1:1 ห้าม broadcast)

**input**
```json
{ "line_user_id": "U1234...", "view": "signup" }   // view: "signup" | "couple" | "edit_birth"
```
**output**: `{ "ok": true, "sent": true, "url": "https://liff.line.me/...?view=signup" }`
**error**: `invalid_input` (view ไม่รู้จัก)

---

## 7. `recompute_chart` — คำนวณดวงใหม่ (หลังแก้วันเกิด)

ผูกกับ: `computeNatalChart(lineUserId)` → เขียน `chart_data` กลับ DB (ไม่เกี่ยวเงิน)

**input**
```json
{ "line_user_id": "U1234..." }
```
**output**
```json
{ "ok": true, "sun": "Leo", "moon": "Pisces", "rising": "Scorpio", "recomputed_at": "2026-06-18T10:00:00+07:00" }
```
**error**: `not_found` · `invalid_input` (วันเกิดใน DB ยังว่าง → ต้องให้แก้วันเกิดก่อน)

---

## 8. `resend_daily` — ส่งดวงรายวันซ้ำ

ผูกกับ: `dailyReading(lineUserId)` push ซ้ำ (เฉพาะ ACTIVE)

**input**: `{ "line_user_id": "U1234..." }`
**output (ok)**: `{ "ok": true, "sent": true }`
**output (ไม่ active)**: `{ "ok": false, "error": "not_active" }`  ← agent ต้องเปลี่ยนไปเส้น "เช็คสิทธิ์/จ่ายเงิน"

---

## 9. `get_user_chart` — ดึงดวงให้ Astro ตีความ

ผูกกับ: อ่าน `chart_data` จาก DB

**input**: `{ "line_user_id": "U1234..." }`
**output**
```json
{
  "ok": true,
  "sun": "Leo", "moon": "Pisces", "rising": "Scorpio",
  "birth_time_known": true,            // false → เตือนว่า rising/เรือนอาจคลาดเคลื่อน
  "transits": [
    { "planet": "Jupiter", "aspect": "trine", "natal": "Sun", "window": "2026-06 ถึง 2026-08" }
  ]
}
```
**error**: `not_found` (ยังไม่เคยคำนวณ → แนะ `recompute_chart` / ให้กรอกวันเกิด)

---

## 10. `escalate_to_human` — ส่งเข้าคิว staff

ผูกกับ: สร้าง ticket ในคิว staff (เฟส 1 = ทุกเคสผ่านคนอยู่แล้ว; tool นี้ใช้ "ยก flag เร่งด่วน/แนบร่าง")

**input**
```json
{
  "line_user_id": "U1234...",
  "reason": "emotional_distress",   // payment_dispute | emotional_distress | angry | unknown | other
  "summary": "ลูกค้าเครียดเรื่องความรัก ถามดวงเชิงปรับทุกข์ ไม่ใช่คำถามใช้งาน",
  "draft_reply": "ขอบคุณที่ไว้ใจเล่าให้ฟังนะคะ ... (ร่างให้ staff ปรับ)",
  "last_message": "เครียดมากเลยช่วงนี้ ไม่ไหวแล้ว"   // ข้อความล่าสุดของลูกค้า → ให้ staff เห็นบริบท
}
```
**output**: `{ "ok": true, "queued": true, "ticket_id": "tk_8842", "priority": "high" }`
**reason → priority + ป้ายบน console**

| reason | label | priority |
|---|---|---|
| `emotional_distress` | อารมณ์/เปราะบาง | high |
| `angry` | ลูกค้าโกรธ/ร้องเรียน | high |
| `payment_dispute` | ข้อพิพาทการเงิน | high |
| `unknown` | ไม่ทราบความต้องการ (ถามลูกค้า) | normal |
| `other` | อื่น ๆ | normal |

**หมายเหตุ**:
- `emotional_distress | angry` → `priority:high`, **ไม่** auto-reply เด็ดขาด (คนตอบเท่านั้น)
- **`unknown` (หมวด U)** = ข้อความไม่เข้าข่าย A–F หรือ triage ไม่รู้ว่าลูกค้าต้องการอะไร →
  ส่ง `draft_reply` เป็น *คำถามกลับ* ถามว่าต้องการให้ช่วยเรื่องใด (ยกตัวเลือก 1–4) ให้ staff กดส่ง
- ticket ทุกใบโผล่บน staff console (`GET /staff/escalations`) เรียง high ขึ้นก่อน

---

## รูปแบบ event (Managed Agents SDK)

```
agent.custom_tool_use   → { id, name, input }          # agent เรียก → session ไป idle
   → orchestrator: ถ้าเป็น 🔒 ให้ขออนุมัติ staff ก่อน, ไม่งั้นเรียกฟังก์ชันจริงเลย
user.custom_tool_result → { tool_use_id: id, content: [{ type:"text", text:"<JSON output>" }] }
```

ตัวอย่าง round-trip (detect_mismatch → activate gated):
```
1. agent.custom_tool_use  { id:"t1", name:"detect_mismatch", input:{line_user_id:"U1"} }
2. orchestrator → getMemberStatus + stripe → result
3. user.custom_tool_result { tool_use_id:"t1", content:[{type:"text", text:'{"ok":true,"mismatch":true,"suggested_days":30,...}'}] }
4. agent.custom_tool_use  { id:"t2", name:"activate_subscription", input:{line_user_id:"U1",days:30,reason:"..."} }
5. orchestrator → 🔒 โพสต์การ์ดให้ staff, รอ
6a. staff อนุมัติ → activateSubscription() → user.custom_tool_result {ok:true,activated:true,new_expiry:...}
6b. staff ปฏิเสธ → user.custom_tool_result {ok:false,error:"rejected_by_staff"}
```

---

## เฟสการปล่อย (ย้ำ)
- **เฟส 1 — copilot**: ทุก output → ขึ้นจอ staff กดส่ง; `escalate_to_human` = ทุกเคสมีคนดู
- **เฟส 2 — auto เฉพาะ low-risk**: FAQ + account ตอบเอง; payment + astro ยังผ่านคนเสมอ
