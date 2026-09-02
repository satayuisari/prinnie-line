#!/bin/zsh
# ยิงบรอดแคสต์ตามที่เจ้าของสั่งไว้ — OA1 เท่านั้น (OA2 ไม่มี credential ในเครื่องนี้)
#
# CAMPAIGN_CYCLE=15  เพราะยังไม่ deploy → cron บน production ยังคัดวันที่ 15
#                    ถ้าบอกลูกค้าวันที่ 2/17 จะเป็นสัญญาที่ระบบไม่ทำตาม
# รูปดึงจาก GitHub raw เพราะแอปที่ deploy อยู่ยังไม่มีไฟล์นี้
cd "$(dirname "$0")/.." || exit 1
LOG="marketing/broadcast-$(date +%Y%m%d-%H%M).log"
{
  echo "=== ยิงบรอดแคสต์ $(date '+%F %T %Z') ==="
  echo "ส่งเลย" | CAMPAIGN_CYCLE=15 \
    PUBLIC_BASE_URL="https://raw.githubusercontent.com/satayuisari/prinnie-line/main/liff" \
    node scripts/broadcast-loyalty.js --send oa1
  echo "=== จบ exit=$? ==="
} 2>&1 | tee "$LOG"
