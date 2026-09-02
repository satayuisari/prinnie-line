#!/bin/zsh
# ยิงบรอดแคสต์ "ดวงเลือกคุณ" — OA1 เท่านั้น (OA2 ไม่มี credential ในเครื่องนี้)
#
# --no-image เพราะรูปที่เข้าถึงได้จากภายนอกยังเป็นตัวเก่าที่เขียน "ทุกวันที่ 15"
#            ซึ่งขัดกับวันที่ประกาศในข้อความ · ส่งข้อความเปล่าดีกว่าส่งรูปที่บอกคนละวัน
#            deploy เมื่อไหร่ค่อยเอา --no-image ออก
cd "$(dirname "$0")/.." || exit 1
LOG="marketing/broadcast-$(date +%Y%m%d-%H%M).log"
{
  echo "=== ยิงบรอดแคสต์ $(date '+%F %T %Z') ==="
  echo "ส่งเลย" | node scripts/broadcast-loyalty.js --send oa1 --no-image
  echo "=== จบ exit=$? ==="
} 2>&1 | tee "$LOG"
