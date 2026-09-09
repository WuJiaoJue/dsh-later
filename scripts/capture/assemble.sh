#!/usr/bin/env bash
# 把 capture-all.cjs 采集的分镜/截图合成为 README 用的 GIF 与 PNG。
# 用法: ./assemble.sh [/tmp/ss-out] [触发截图页内裁剪区 x,y,w,h(2x 坐标)]
# 例:   ./assemble.sh /tmp/ss-out 850,1058,1500,142
set -euo pipefail
OUT="${1:-/tmp/ss-out}"
CROP="${2:-}"   # fired-full.png 的消息块裁剪区（2x 页面坐标）
FR_C="$OUT/frames-create"; FR_F="$OUT/frames-fired"

pal() { # stdin frames → palette GIF
  ffmpeg -y -v error -f concat -safe 0 -i "$1" \
    -vf "scale=720:361:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    -loop 0 "$2"
}

# 1) 创建流程 GIF：7 帧，关键步骤停留更长
{
  echo "ffconcat version 1.0"
  printf "file '%s'\nduration %.1f\n" \
    "$FR_C/create-00.png" 0.7 "$FR_C/create-01.png" 0.8 "$FR_C/create-02.png" 1.0 \
    "$FR_C/create-03.png" 0.8 "$FR_C/create-04.png" 0.4 "$FR_C/create-05.png" 0.9 \
    "$FR_C/create-06.png" 1.1
  printf "file '%s'\n" "$FR_C/create-06.png"
} > "$OUT/list-create.txt"
pal "$OUT/list-create.txt" "$OUT/docs-scheduler-create.gif"

# 2) 到期触发 GIF：倒计时段 2s/帧 → 注入行+toast 1s/帧 → 跳过模型思考 → 完整消息收尾
#    帧号基于 capture-all.cjs 的 T-90s 起 1fps 序列；注入帧 INJ 由采集日志给出（默认 87）
INJ="${3:-87}"
{
  echo "ffconcat version 1.0"
  for i in $(seq 40 2 $((INJ - 1))); do printf "file '%s/f-%03d.png'\nduration 2.0\n" "$FR_F" "$i"; done
  for i in $(seq $INJ $((INJ + 5)));        do printf "file '%s/f-%03d.png'\nduration 1.0\n" "$FR_F" "$i"; done
  for i in "$((INJ + 19))" "$((INJ + 20))" "$((INJ + 21))" "$((INJ + 23))"; do
    printf "file '%s/f-%03d.png'\nduration 0.9\n" "$FR_F" "$i"
  done
  printf "file '%s/f-%03d.png'\nduration 1.8\nfile '%s/f-%03d.png'\n" "$FR_F" "$((INJ + 23))" "$FR_F" "$((INJ + 23))"
} > "$OUT/list-fired.txt"
pal "$OUT/list-fired.txt" "$OUT/docs-scheduler-fired.gif"

# 3) 到期消息块 PNG：从 fired-full.png 按 2x 坐标裁剪
if [[ -n "$CROP" ]]; then
  IFS=, read -r x y w h <<< "$CROP"
  convert "$OUT/fired-full.png" -crop "${w}x${h}+${x}+${y}" +repage "$OUT/screenshot-fired.png"
fi

ls -la "$OUT"/docs-scheduler-*.gif "$OUT"/screenshot-*.png 2>/dev/null || true
echo "done → $OUT"
