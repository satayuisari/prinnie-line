# Content Ops — Tool Contract (orchestrator ฝั่งเรา implement)

custom tool ทุกตัวรันฝั่งเรา (มี repo + ffmpeg + fonts) เมื่อ agent ส่ง `agent.custom_tool_use` → orchestrator รัน → ตอบ `user.custom_tool_result`

| tool | agent | ทำอะไร (ผูกกับของที่มี) | output |
|---|---|---|---|
| `get_strategy` | planner | อ่าน `MARKETING.md` + positioning | text กลยุทธ์ |
| `render_zodiac_short` | producer | `node scripts/promo-zodiac.js <sign>` | `{path:"video/zodiac/prinnie-zodiac-<sign>-9x16.mp4"}` |
| `render_teaser` | producer | `node scripts/promo-teaser.js` | `{path:"video/prinnie-teaser-9x16.mp4"}` |
| `render_image` | producer | สร้าง poster ธีมม่วง-ทอง (resvg+sharp เหมือน build-richmenu) | `{path:"video/poster-*.jpg"}` |
| `list_assets` | producer | ดูไฟล์ใน `video/` ที่ render แล้ว | `{files:[...]}` |
| `save_content_pack` | planner | เขียน pack ลงคิว review | `{saved:true, id, queue_path}` |

## รูปแบบ content pack (ที่เข้าคิว review)
```json
{
  "id": "2026-06-19-ig-01",
  "channel": "IG Reels",
  "pillar": "relatable",
  "post_date": "2026-06-19 19:00",
  "caption": "...",
  "hashtags": ["#ดูดวง", "#ดวงรายวัน", "..."],
  "title": "(YouTube only)",
  "asset_path": "video/zodiac/prinnie-zodiac-มังกร-9x16.mp4",
  "status": "for_review"
}
```
เก็บไว้ที่ `content/queue/*.json` (หรือ DB) → ทำหน้า **review** (ต่อยอดจาก dashboard) ให้ staff ดู caption+preview แล้วกด "โพสต์/แก้/ทิ้ง"

## โหมดเผยแพร่ = copilot (v1)
- ระบบ **ไม่โพสต์เอง** — staff รีวิวแล้วโพสต์ (ดาวน์โหลด asset + ก๊อป caption)
- เปิด **auto-post ทีหลัง** ทีละช่อง (เก็บ credential ใน vault):
  | ช่อง | API | ความยาก |
  |---|---|---|
  | LINE VOOM/Broadcast | Messaging API (มี token แล้ว) | 🟢 ง่าย |
  | Facebook Page | Graph API + page token | 🟢 ง่าย |
  | Instagram Reels | Instagram Graph API (Business + ผูก FB) | 🟡 ตั้งค่า |
  | TikTok | Content Posting API (ขออนุมัติ app) | 🔴 รออนุมัติ |
  | YouTube Shorts | YouTube Data API + OAuth | 🔴 ตั้ง OAuth |

→ v1: gen + review. เปิด LINE/FB ก่อนเมื่อพร้อม, IG/TikTok/YT ค่อยตามเมื่อเซ็ต credential เสร็จ
