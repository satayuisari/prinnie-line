#!/bin/zsh
# ยิงบรอดแคสต์ "ดวงเลือกคุณ" 18:00 — ทั้งสองบัญชี
#   @prinnie333 (OA1) ส่งถึงได้ 1,752 · @efb2738a (OA2) ส่งถึงได้ 13,120
#
# TEST_MODE=false ตั้งเฉพาะคำสั่งนี้ ไม่แตะ .env
#   ตัว gate ใน lineMessaging.js มีไว้กันยิงพลาด · การยิงครั้งนี้เจ้าของสั่งมาแล้ว 3 รอบ
#   scope ไว้ที่คำสั่งเดียวเพื่อไม่ให้ push อื่น ๆ หลุด allowlist ตามไปด้วย
#
# --no-image เพราะรูปที่เข้าถึงได้จากภายนอกยังเป็นตัวเก่าที่เขียน "ทุกวันที่ 15"
#            ขัดกับวันที่ในข้อความ · deploy แล้วค่อยเอาออก
cd "$(dirname "$0")/.." || exit 1
LOG="marketing/broadcast-$(date +%Y%m%d-%H%M).log"
{
  echo "=== ยิงบรอดแคสต์ $(date '+%F %T %Z') ==="
  echo "ส่งเลย" | TEST_MODE=false node scripts/broadcast-loyalty.js --send both --no-image
  echo "=== exit=$? ==="
} 2>&1 | tee "$LOG"
