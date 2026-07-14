# 🚀 Launch Checklist — ย้ายไป OA จริง (Prinnie333, ~10,000 followers)

> ✅ **LAUNCHED 11/07/2026 18:00** — TEST_MODE=false, broadcast ยิงแล้ว, rich menu default แล้ว
> การเงินจริงใช้ **PromptPay QR + SlipOK ตรวจสลิปอัตโนมัติ** (Stripe/Beam ปฏิเสธหมวดดูดวง —
> สเตป Stripe ข้างล่างเลิกใช้แล้ว) · ยอด ณ 14/07: สมาชิก 28, รายได้ ~8.4k
> ⚠️ ค้างเปิด: `DAILY_TEASER_ENABLED` (teaser เช้าถึงคนยังไม่จ่าย — เช็คโควต้า push ของ
> แพลน LINE OA ก่อนเปิด: ~750 คน/วัน ≈ 23k ข้อความ/เดือน), `RENEWAL_REMINDERS_ENABLED`,
> `NUDGES_ENABLED` — checklist ด้านล่างเก็บไว้อ้างอิง/rollback

> หลักการ: OA จริงยังมีพนักงานตอบแชทลูกค้าอยู่ + มี follower 10k ที่ห้ามโดน broadcast พลาด
> → เปิดทีละสเตป, ใช้ `TEST_MODE` กันพลาด, ตั้ง rich menu แบบ per-user ก่อน แล้วค่อย default

---

## STEP 0 — ก่อนเริ่ม (เช็กของให้พร้อม)
- [ ] โค้ดล่าสุด deploy ขึ้น Railway แล้ว (`railway up --service prinnie-app --detach`)
- [ ] DB import ล่าสุด (preDeployCommand รัน migrate+import ให้อัตโนมัติทุก deploy)
- [ ] มี **Channel access token + secret ของ OA จริง** (LINE Developers → channel ของ OA prod)
- [ ] รู้ **userId ของตัวเองบน OA จริง** = `U64863990e25404efe3f8a656e6288773` (ของ Bon, ใช้เป็น allowlist)

## STEP 1 — ตั้ง ENV บน Railway (ยัง TEST_MODE!)
ตั้งใน Railway Variables ของ service `prinnie-app`:
- [ ] `LINE_CHANNEL_ACCESS_TOKEN` = **token ของ OA จริง** (เปลี่ยนจาก OA เทส)
- [ ] `LINE_CHANNEL_SECRET` = **secret ของ OA จริง**
- [ ] `TEST_MODE=true`  ← ⚠️ ยังเปิดไว้ ห้ามเป็น false ตอนนี้
- [ ] `TEST_USER_IDS=U64863990e25404efe3f8a656e6288773` (+ id ทีมงานที่จะช่วยเทส)
- [ ] `FREE_ACCESS=false` (หรือ true ถ้าจะเทส flow จ่ายเงินแบบฟรีก่อน)
- [ ] ยืนยัน `DATABASE_URL` ยัง ref `${{Postgres.DATABASE_URL}}` (Postgres ของ prod)
- [ ] redeploy ให้ env ใหม่มีผล

## STEP 2 — Webhook ของ OA จริง
- [ ] LINE Developers → Messaging API → **Webhook URL** = `https://prinnie-app-production.up.railway.app/webhook`
- [ ] กด **Verify** → ต้องขึ้น Success
- [ ] เปิด **Use webhook = ON**
- [ ] ปิด **Auto-reply / Greeting message** ของ LINE OA (ไม่ให้ชนกับบอท)
- [ ] ⚠️ **Allow bot to join group chats** ปิดไว้ก็ได้

## STEP 3 — LIFF ชี้มาที่ backend เดิม
- [ ] LIFF (LINE Login channel) endpoint = `https://prinnie-app-production.up.railway.app/signup.html`
- [ ] ตั้ง `LINE_LIFF_ID` ใน Railway = LIFF ID ที่ผูกกับ **OA จริง**
      (LIFF ผูกกับ channel — ถ้า OA จริงเป็นคนละ channel ต้องสร้าง/ผูก LIFF ใหม่ แล้ว **publish**)
- [ ] เปิด LIFF จากมือถือ Bon → ฟอร์มสมัครเปิดได้ ไม่จอขาว

## STEP 4 — เทสบน OA จริง (เห็นเฉพาะ allowlist)
ตอนนี้ TEST_MODE=true → คนนอก allowlist ทักมา **บอทเงียบ** (พนักงานตอบได้ปกติ)
- [ ] Bon ทักบอท → ได้ welcome
- [ ] สมัครผ่าน LIFF → ได้ดวง (sun/moon/rising/life_path)
- [ ] กดดูดวงวันนี้ → **เช็กหัวข้อพลังดาว + ตัวคั่น ➖ แสดงถูก** (ฟีเจอร์ใหม่)
- [ ] รายสัปดาห์/เดือน/ปี, ไพ่ทาโรต์ (มีรูป), พื้นดวง, ผูกดวงคู่ (teaser/จ่าย 149)
- [ ] จ่าย 399 ด้วย Stripe test card `4242 4242 4242 4242` → active +30 วัน + welcome push
- [ ] เช็ก daily scheduler: รอรอบ 7 โมง หรือ trigger มือ ว่า push เข้าเฉพาะ allowlist

## STEP 5 — Rich menu บน OA จริง (per-user ก่อน)
- [ ] ใช้ token prod ใน .env แล้ว `node scripts/richmenu.js create` → ได้ richMenuId ใหม่
- [ ] `node scripts/richmenu.js link U64863990e25404efe3f8a656e6288773` → เมนูขึ้นเฉพาะ Bon
- [ ] กดทุกปุ่มครบ loop
- [ ] (ยัง **อย่า** `default --force` — นั่นคือขึ้นกับ 10k คน)

## STEP 6 — 🟢 GO LIVE (จุดกลับตัวยาก — ทำเมื่อทุกอย่างผ่าน)
ทำ "นอกเวลาทำการ" และพร้อมมอนิเตอร์:
- [ ] Railway: `TEST_MODE=false` → redeploy  ← เปิดให้ทุกคนใช้บอทได้
- [ ] `node scripts/richmenu.js default --force` → rich menu ขึ้นกับ follower ทุกคน
- [ ] `node scripts/richmenu.js list` → เหลือเมนูที่ถูกต้องเมนูเดียว (ลบเมนูเก่า/เทสทิ้ง)
- [ ] Stripe: สลับเป็น **live keys** (`sk_live_`, `whsec_` ของ live) + สร้าง webhook endpoint live
      ⚠️ ถ้ายังไม่พร้อมรับเงินจริง ค่อยทำสเตปนี้ทีหลัง / คงไว้ test ก่อน
- [ ] โพสต์/ประกาศชวน follower กดเมนูสมัคร

## STEP 7 — หลัง launch (มอนิเตอร์)
- [ ] ดู Railway logs ว่าไม่มี error / webhook 200
- [ ] เช็ก delivery_logs / จำนวน subscriber ใหม่
- [ ] เช้าวันถัดไป: daily push ออกครบ ไม่มี fail
- [ ] เก็บกวาด: `scripts/clear-members.js` ล้าง subscriber ที่เป็น data ขยะตอนเทส (ถ้ามี)

---

## ⏮️ Rollback ด่วน (ถ้าพลาด)
- ตั้ง `TEST_MODE=true` + redeploy → บอทเงียบกับทุกคนทันที (พนักงานตอบแชทต่อได้)
- `node scripts/richmenu.js delete <id>` ลบเมนูที่ตั้งผิด
- ปิด **Use webhook = OFF** ใน LINE console = ตัดบอทออกจาก OA ทั้งหมด

## ⚠️ จุดที่พลาดบ่อย
1. ลืมเปลี่ยน token → ยังยิงไป OA เทส (เช็ก `richmenu.js list` ว่าเมนูไปโผล่ OA ไหน)
2. ตั้ง `TEST_MODE=false` เร็วเกิน ก่อนเทสครบ → 10k คนเห็น auto-reply
3. LIFF ผูกผิด channel → จอขาว/404 (ต้องเป็น LINE Login channel + **publish**)
4. Stripe ยัง test key ตอน go-live → ลูกค้าจ่ายจริงไม่ได้
