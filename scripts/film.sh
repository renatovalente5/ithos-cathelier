#!/usr/bin/env bash
#
# The cover film: one short, silent, looping shot behind the words of a home
# page. Masters live one folder up, in _materiais-ithos-cathelier/filmes/, for
# the same reason the photographer's originals do -- a 19 MB phone recording
# has no business in the repository, and it is never what gets served.
#
#     bash scripts/film.sh ithos-cover
#
# WHY THE FILM IS PLAYED FORWARD AND THEN BACKWARDS
#
# A background film loops for as long as somebody is on the page, so the join
# is seen more often than any other moment in it. This camera drifts steadily
# in one direction and never comes back: measured on a 5 frames-per-second
# sample, the first and last frames are 27 grey levels apart, and the closest
# pair of cut points more than eight seconds apart is still 16 apart. There is
# no seam to find. So the film is encoded forwards and then in reverse, which
# is seamless by construction: the join is one repeated frame at each end, and
# the motion is slow enough that the turn does not read as a rewind.
#
# WHY H.264 ALONE, AND WHY 19 MB BECOMES 1.8 MB
#
# The phone recorded a nearly still, very dark scene at 8.8 Mbps, which is
# perhaps forty times what it needs. At 1600 wide and crf 30 the wicker still
# holds its texture with no banding in the dark falloff. WebM was measured
# rather than assumed: VP9 at matching quality came out at 1.29 MB against
# H.264's 1.26 MB -- no gain worth a second file, a second encode and a second
# thing to keep in step, so there is one file and every browser plays it.
set -euo pipefail

NAME="${1:?usage: bash scripts/film.sh <name>   (e.g. ithos-cover)}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$HERE/../_materiais-ithos-cathelier/filmes/$NAME.mp4"
OUT="$HERE/public/media/film"

[ -f "$SRC" ] || { echo "no master at $SRC" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is missing:  brew install ffmpeg" >&2; exit 1; }

mkdir -p "$OUT"
ffmpeg -v error -i "$SRC" \
  -filter_complex "[0:v]scale=1600:-2,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1,format=yuv420p[v]" \
  -map "[v]" -an \
  -c:v libx264 -preset veryslow -crf 30 -movflags +faststart \
  "$OUT/$NAME.mp4" -y

printf '%s  %s\n' "$(du -h "$OUT/$NAME.mp4" | cut -f1)" "public/media/film/$NAME.mp4"
