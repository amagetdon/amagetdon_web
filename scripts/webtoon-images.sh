#!/usr/bin/env bash
# 웹툰 랜딩 그림 교체 — PM 이 준 폴더(NN_이름.jpg)를 public/webtoon/<slug>/ 로 변환한다. ffmpeg 필요.
#   NN.webp (파일 앞 두 자리 번호 그대로, 화면 순서 = 번호 순서), cover.mp4 (00번을 4초 살짝 움직인 표지 영상),
#   og.jpg (00번으로 만든 1200×630 공유 미리보기)
# 쓰는 법: bash scripts/webtoon-images.sh "<PM 그림 폴더>" minroro-blog
# 번호·컷 수가 바뀌면 src/lib/webtoonLandings.ts 의 cuts 목록(번호·말풍선)도 같이 고친다.
set -euo pipefail
SRC="${1:?PM 그림 폴더}"
SLUG="${2:?랜딩 slug}"
OUT="public/webtoon/$SLUG"
mkdir -p "$OUT"

shopt -s nullglob
files=("$SRC"/[0-9][0-9]_*.jpg "$SRC"/[0-9][0-9]_*.png)
[ ${#files[@]} -gt 0 ] || { echo "그림이 없습니다: $SRC"; exit 1; }

for f in "${files[@]}"; do
  n=$(basename "$f" | cut -c1-2)
  # 2K 원본도 휴대폰 폭 기준 1125px 로 줄여 용량을 맞춘다
  ffmpeg -loglevel error -y -i "$f" -vf "scale='min(1125,iw)':-2" -c:v libwebp -quality 80 "$OUT/$n.webp"
  echo "  $n.webp  ← $(basename "$f")"
done

cover=$(ls "$SRC"/00_*.* | head -1)
ffmpeg -loglevel error -y -loop 1 -i "$cover" \
  -vf "scale=1536:-2,zoompan=z='1+0.04*sin(2*PI*on/120)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=720x1290:fps=30,format=yuv420p" \
  -t 4 -c:v libx264 -crf 26 -preset slow -movflags +faststart -an "$OUT/cover.mp4"
ffmpeg -loglevel error -y -i "$cover" \
  -filter_complex "[0]scale=1200:-2,crop=1200:630,boxblur=20:2,eq=brightness=-0.25[bg];[0]scale=-2:630[fg];[bg][fg]overlay=(W-w)/2:0" \
  -q:v 3 "$OUT/og.jpg"
echo "완료: $OUT ($(du -sh "$OUT" | cut -f1))"
