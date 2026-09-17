#!/usr/bin/env bash
#
# The cover film: one short, silent, looping shot behind the words of a home
# page. Masters live one folder up, in _materiais-ithos-cathelier/filmes/, for
# the same reason the photographer's originals do -- a 19 MB phone recording
# has no business in the repository, and it is never what gets served.
#
#     bash scripts/film.sh ithos-cover [focus]
#
# `focus` is where the tall cut is centred, 0 to 1 across the master's width.
# It defaults to 0.36, which on this recording keeps the lit deer in frame
# instead of centring on the koala's face.
#
# WHY TWO CUTS AND NOT ONE FILE WITH A CLEVER object-position
#
# A film is a shape, not just a file. The cover is a wide frame on a laptop and
# a tall one on a phone -- measured, 390x585 on a common phone, which is 2:3
# and not the 4:5 the stylesheet's aspect-ratio suggests, because the
# min-block-size floor wins there. Pouring the wide cut into that frame keeps
# 37.5% of its width, and the lamps live near the edges: the visitor would get
# the middle of a close-up, at the full weight of the wide file. So the master
# is cut twice, to the two shapes the page actually asks for.
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
# WHY H.264 ALONE, AND WHY 19 MB BECOMES 2 MB
#
# The phone recorded a nearly still, very dark scene at 8.8 Mbps, which is
# perhaps forty times what it needs. At crf 30 the wicker still holds its
# texture with no banding in the dark falloff. WebM was measured rather than
# assumed: VP9 at matching quality came out at 1.29 MB against H.264's 1.26 MB
# -- no gain worth a second file, a second encode and a second thing to keep in
# step, so there is one codec and every browser plays it.
set -euo pipefail

NAME="${1:?usage: bash scripts/film.sh <name> [focus 0-1]}"
FOCUS="${2:-0.36}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$HERE/../_materiais-ithos-cathelier/filmes/$NAME.mp4"
OUT="$HERE/public/media/film"

[ -f "$SRC" ] || { echo "no master at $SRC" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is missing:  brew install ffmpeg" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe is missing:  brew install ffmpeg" >&2; exit 1; }

MW=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$SRC")
MH=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$SRC")

# The tall cut is 2:3 out of the master's full height, centred on FOCUS; the
# offset is clamped so a focus near either edge cannot ask for pixels that are
# not there.
CW=$(python3 -c "print(int($MH*2/3)//2*2)")
CX=$(python3 -c "print(max(0, min($MW-$CW, int($MW*$FOCUS - $CW/2)))//2*2)")

mkdir -p "$OUT"

# O BRILHO DO FILME, E PORQUE É AQUI QUE ELE SE MEXE.
#
# A dona achou a capa escura de mais. O véu por cima dela não é o manípulo: o
# mínimo dele é fixado pelo texto PEQUENO da barra, que no topo é lido contra
# ele, e está a 58% para um chão de 55,9%. Baixá-lo tornaria a palavra «Menu»
# ilegível sobre um LED aceso.
#
# O brilho do próprio filme, esse, é livre: o limite do véu é calculado sobre
# BRANCO PURO, portanto nenhuma gravação o pode piorar, por mais clara que
# seja. Gamma e não brightness, porque gamma levanta os meios-tons e as sombras
# e deixa as altas luzes onde estão -- e as altas luzes aqui são os LEDs, que
# já estão no máximo e não têm para onde subir.
#
# 1.5 foi medido: o composto passa de mediana 39 para 56. A 1.75 fica baço.
# E a mesma correcção vai nos QUATRO derivados -- os dois filmes e os dois
# quadros parados -- porque foi uma discordância entre eles que já pôs a capa a
# dar um salto de luz no instante em que o filme arrancava.
COR="eq=gamma=1.5"

pingpong () {   # $1 = the filter that shapes one pass
  echo "[0:v]$1,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1,format=yuv420p[v]"
}
encode () {     # $1 = filter, $2 = output name
  ffmpeg -v error -i "$SRC" -filter_complex "$(pingpong "$1")" -map "[v]" -an \
    -c:v libx264 -preset veryslow -crf 30 -movflags +faststart "$OUT/$2" -y
  printf '  %-28s %s  (%s)\n' "$2" "$(du -h "$OUT/$2" | cut -f1)" \
    "$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$OUT/$2")"
}

still () {   # $1 = filter, $2 = master name in photos/_covers
  ffmpeg -v error -ss 0 -i "$SRC" -frames:v 1 -filter_complex "[0:v]$1[v]" -map "[v]" \
    -q:v 2 "$HERE/photos/_covers/$2.jpg" -y
  printf '  %-28s %s\n' "$2.jpg" \
    "$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$HERE/photos/_covers/$2.jpg")"
}

echo "master ${MW}x${MH}, tall cut ${CW} wide at x=${CX} (focus ${FOCUS})"
encode "$COR,scale=1600:-2"               "$NAME.mp4"
encode "$COR,crop=$CW:$MH:$CX:0,scale=720:-2" "$NAME-tall.mp4"

# THE STILL IS THE FILM'S FIRST FRAME, ONE PER CUT.
#
# Whatever sits under the film is what the visitor sees before it starts, and
# what they keep if they asked for less motion, if their connection says it is
# metered, or if autoplay is refused. A photograph of a different lamp there is
# a bait-and-switch the owner noticed immediately: a horse appeared and then
# turned into two other lamps. Frame 0 of each cut is the honest answer -- the
# still IS the film, paused, so nothing changes when it starts.
#
# One per cut, and not one shared, because the cuts are different shapes: a
# 16:9 still poured into the phone's 2:3 frame would show 37% of its width, and
# the film would then pull back to the full frame in front of the visitor.
#
# These go into photos/_covers/ so scripts/renditions.py makes the web sizes
# from them exactly as it does for the photographic masters. They do not
# overwrite those: covers.py writes <brand>.jpg and nothing else, so deleting
# "film" from covers.json puts the photograph back with nothing to undo.
still "$COR,scale=1920:-2"                "$NAME-still-wide"
still "$COR,crop=$CW:$MH:$CX:0"           "$NAME-still"
echo
echo "now:  python3 scripts/renditions.py"
