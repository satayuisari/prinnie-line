#!/bin/bash
# สร้างเพลงพื้นหลัง ambient (คอร์ด Am7 นุ่ม ๆ) ด้วย ffmpeg — ไว้ใส่วิดีโอโปรโม/สอน
# ไม่มีลิขสิทธิ์ (สังเคราะห์เอง). ปรับความรู้สึก mystical: sine chord + tremolo + echo + lowpass
set -e
FF=node_modules/ffmpeg-static/ffmpeg
OUT="${1:-marketing/ambient.m4a}"
D=50

"$FF" -y \
  -f lavfi -i "sine=f=110:d=$D" \
  -f lavfi -i "sine=f=220:d=$D" \
  -f lavfi -i "sine=f=261.63:d=$D" \
  -f lavfi -i "sine=f=329.63:d=$D" \
  -f lavfi -i "sine=f=392:d=$D" \
  -filter_complex "\
[0]volume=0.45[a0];[1]volume=0.32[a1];[2]volume=0.28[a2];[3]volume=0.26[a3];[4]volume=0.22[a4];\
[a0][a1][a2][a3][a4]amix=inputs=5:normalize=0,\
tremolo=f=0.11:d=0.45,lowpass=f=2000,aecho=0.8:0.7:550:0.35,\
loudnorm=I=-16:TP=-1.5[m]" \
  -map "[m]" -ac 2 -c:a aac -b:a 160k "$OUT" 2>/dev/null
echo "  ✓ $OUT"
