# Prinnie333 — Content Ops (Cowork / Managed Agents)

ระบบให้ Cowork **ผลิตคอนเทนต์โปรโมทครบชุด** สำหรับทุกช่อง แล้ว **stage ให้คุณ review ก่อนโพสต์** (copilot)
อิงกลยุทธ์ใน [`../MARKETING.md`](../MARKETING.md) — สะพานเชื่อม legacy (YouTube 301k / FB / LINE 13k) → personalized LINE `@prinnie333`

## โหมด: Copilot (gen → review → คุณโพสต์)
ระบบ **ไม่โพสต์เอง** ใน v1 — มันสร้าง "content pack" (แคปชั่น + แฮชแท็ก + ไฟล์คลิป/รูป + ช่อง + เวลาแนะนำ) วางไว้ในคิว แล้วคุณกดโพสต์เอง
*(ทีหลังเปิด auto-post เฉพาะ LINE/FB ได้ — ดู tools-contract.md)*

## ช่องเป้าหมาย
IG Reels · TikTok · Facebook (เพจ "ดูดวง by Prinnie") · YouTube Shorts · LINE VOOM/Broadcast (@prinnie333 + ฐาน 13k)

## โครงสร้าง
```
cowork-content/
  README.md
  environment.yaml
  agents/
    planner.agent.yaml      📅 coordinator — วางปฏิทิน + มอบงาน
    copywriter.agent.yaml   ✍️ แคปชั่น/ฮุก/แฮชแท็ก ต่อช่อง (Opus)
    producer.agent.yaml     🎬 เลือก/สั่ง render คลิป-รูป (เรียกสคริปต์เดิม)
  tools-contract.md         custom tools (host-side) + รูปแบบ content pack
```

## Flow
```
📅 Planner  → อ่านกลยุทธ์ → วางปฏิทิน N ชิ้น (pillar/ช่อง/วัน)
   ├─ ✍️ Copywriter → เขียน copy ต่อช่อง (IG≠TikTok≠FB≠YT≠LINE)
   └─ 🎬 Producer   → render คลิป/รูป (promo-zodiac, teaser, poster)
        ↓
   📦 content pack (caption+hashtag+asset+ช่อง+เวลา) → คิว review
        ↓
   🧑 คุณ review → โพสต์เอง (หรือสั่ง auto-post ช่องที่เปิดไว้)
```

## เสาคอนเทนต์ (content pillars)
1. **Educational** — "ลัคนาคืออะไร / ทำไมราศีเดียวกันดวงไม่เหมือน" (สร้าง authority)
2. **Relatable** — snippet ดวงรายวัน ให้คนรู้สึก "ตรงจัง"
3. **Social proof** — รีวิว/คอมเมนต์คนทักว่าแม่น
4. **Couple hook** — "ผูกดวงกับคนที่คิดถึง"
ทุกชิ้นปิดท้าย CTA → แอด/สมัคร `@prinnie333` · **ไม่พูดเกินจริง · ไม่ทำนายร้าย (สุขภาพ/ตาย)**

## วิธีเชื่อม (เหมือน support — ดู ../cowork/README.md)
1. `ant beta:environments create < cowork-content/environment.yaml` → ENV_ID
2. สร้าง subagent: copywriter, producer → เก็บ id
3. ใส่ id ใน `multiagent.agents` ของ planner → สร้าง planner (coordinator)
4. start session: "วางคอนเทนต์สัปดาห์นี้ 7 ชิ้น ลง IG/TikTok/LINE"

## โมเดล
planner=Sonnet 4.6 · copywriter=**Opus 4.8** (copy=ตัวสินค้า) · producer=Haiku 4.5 (เรียก tool)

## ⚠️ Orchestrator ต้อง implement (ดู tools-contract.md)
- custom tool `render_*` → รันสคริปต์เดิม (`scripts/promo-zodiac.js` ฯลฯ) ฝั่งเรา คืน path ไฟล์
- `save_content_pack` → เขียนลงคิว review (เช่น `content/queue/`)
- auto-post (LINE/FB) = เปิดทีหลัง ใส่ credential ใน vault
