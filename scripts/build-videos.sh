#!/bin/bash
# ต่อการ์ด PNG (9:16) เป็นวิดีโอ mp4 — fade เข้า/ออก ต่อการ์ด (fade-through-black) + concat
set -e
FF=node_modules/ffmpeg-static/ffmpeg
FPS=30

build() {
  local dir="$1" dur="$2" out="$3" prefix="$4"
  local tmp="$dir/_clips"; rm -rf "$tmp"; mkdir -p "$tmp"
  local fout; fout=$(echo "$dur - 0.4" | bc)
  local list="$tmp/list.txt"; : > "$list"
  local n=0
  for png in "$dir/${prefix}"-*.png; do
    local clip; clip=$(printf "%s/c%03d.mp4" "$tmp" "$n")
    "$FF" -y -loop 1 -t "$dur" -i "$png" \
      -vf "scale=1080:1920,fade=t=in:st=0:d=0.4,fade=t=out:st=${fout}:d=0.4,format=yuv420p" \
      -r "$FPS" -c:v libx264 -preset medium -crf 20 "$clip" 2>/dev/null
    echo "file 'c$(printf '%03d' $n).mp4'" >> "$list"
    n=$((n+1))
  done
  "$FF" -y -f concat -safe 0 -i "$list" -c copy "$out" 2>/dev/null
  rm -rf "$tmp"
  echo "  ✓ $out  ($n scenes)"
}

echo "building promo..."
build marketing/promo-new 4.5 marketing/promo-new/promo-9x16.mp4 promo
echo "building tutorial..."
build marketing/guide/9x16 4.8 marketing/guide/9x16/tutorial-9x16.mp4 tut
