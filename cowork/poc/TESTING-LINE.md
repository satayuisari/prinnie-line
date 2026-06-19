# เทสกับ LINE จริง (end-to-end)

ภาพรวม: คนทักใน LINE → LINE ยิง POST เข้า `webhook` ของคุณ → orchestrator → ขึ้น staff console →
staff กดส่ง → ข้อความเด้งกลับไปหาลูกค้าใน LINE

> LINE วิ่งเข้า `localhost` ไม่ได้ — ต้องมี **public HTTPS URL** ก่อน (ngrok หรือ deploy Railway)

---

## 1. ใส่ key ของ LINE ลง .env
จาก LINE Developers Console → channel (Messaging API) ของ Prinnie333:
```
LINE_CHANNEL_ACCESS_TOKEN=xxxxx   # Messaging API > Channel access token (long-lived)
LINE_CHANNEL_SECRET=xxxxx         # Basic settings > Channel secret
RELEASE_PHASE=1
```
ไม่ใส่ token → server ยังรันได้ แต่จะ "log แทนการส่ง" (โหมด stub)

## 2. เปิด public URL (เลือกทางเดียว)

**ทาง A — ngrok (เร็วสุด สำหรับเทสในเครื่อง)**
```
node src/index.js            # terminal 1 (รันที่ :8080)
ngrok http 8080              # terminal 2 → ได้ URL เช่น https://abc123.ngrok-free.app
```
Webhook URL = `https://abc123.ngrok-free.app/line/webhook`

**ทาง B — Railway (ใกล้ของจริง ใช้ host เดิม)**
deploy โฟลเดอร์ `poc/` (หรือรวมเข้ากับ service เดิม) → ได้ public domain →
Webhook URL = `https://<railway-domain>/line/webhook`

## 3. ตั้งค่าใน LINE Developers Console
Messaging API tab:
- **Webhook URL** = URL ข้อบน → กด **Verify** (ต้องได้ Success / 200)
- เปิด **Use webhook** = ON
- ปิด **Auto-reply messages** + **Greeting messages** (กันบอท default ของ LINE แย่งตอบ)

## 4. ทดสอบ
1. เพิ่ม OA เป็นเพื่อน แล้วพิมพ์ทักเข้าไป เช่น
   - "จ่ายเงินแล้วแต่ดวงไม่ขึ้น"  → เคส B (จะมีการ์ดรออนุมัติเปิดสิทธิ์บน console)
   - "อันนี้คือ?"                  → เคส U (เด้ง alert ถามว่าต้องการช่วยด้านใด)
2. เปิด `http://localhost:8080/` (หรือ domain) → เห็นเคสโผล่บน console
3. กด **อนุมัติ** (ถ้าเป็นเรื่องเงิน) แล้วกด **ส่งให้ลูกค้า** → กลับไปดูใน LINE จะได้ข้อความตอบ

---

## ระดับการเทส (testing ladder)
| ระดับ | ทดสอบอะไร | ต้องมี |
|---|---|---|
| 0 | logic ภายใน | `node src/demo.js` (ไม่ต้องต่ออะไร) |
| 1 | LINE inbound → console → ตอบกลับ LINE | public URL + LINE token. **agent เป็น stub** (route ด้วย keyword) |
| **2 (พร้อมแล้ว)** | ใช้ agent จริง (Managed Agents) | สร้าง agent ด้วย `ant` (ดู `../README.md`) แล้วตั้ง `ANTHROPIC_API_KEY` + `TRIAGE_AGENT_ID` + `SUPPORT_ENV_ID` ใน `.env` → agentClient สลับเป็นโหมด LIVE อัตโนมัติ (ไม่ต้องแก้โค้ด) |
| 3 | ต่อ DB/Stripe จริง | ตั้ง `*_SERVICE_PATH` ใน `prinnieServices.js` (ขึ้นโหมด LIVE) |

### เปิดโหมด LIVE (ระดับ 2)
```sh
# 1) สร้าง environment + agents (ดู cowork/README.md) → ได้ id
# 2) ใส่ .env:
#    ANTHROPIC_API_KEY=sk-ant-...
#    TRIAGE_AGENT_ID=agent_...      (coordinator prinnie-triage)
#    SUPPORT_ENV_ID=env_...
npm install        # ดึง @anthropic-ai/sdk
node src/index.js  # log จะขึ้น "[agentClient] โหมด LIVE"
```
ถ้าไม่ตั้ง `TRIAGE_AGENT_ID` → ยังเป็นโหมด STUB ให้เทส flow ได้

## ข้อควรระวัง
- ต้องใช้ **Node 18+** (ใช้ `fetch` ในตัว) — เช็ก `node -v`
- เฟส 1: ไม่มีอะไรส่งถึงลูกค้าเองโดยไม่ผ่าน staff กดส่ง (ตั้งใจ)
- push เป็น 1:1 เท่านั้น — **ไม่ broadcast** หา followers ทั้งหมด
- ระดับ 1 ลูกค้าจะได้คำตอบ "แบบ stub" (ข้อความสำเร็จรูป) เพราะ agent จริงยังไม่ต่อ — พอถึงระดับ 2 ค่อยเป็นคำตอบจาก agent จริง
