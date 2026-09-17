#!/usr/bin/env python3
"""
The cover photograph of each brand, cut once, at the largest size that exists.

A cover is one photograph filling the whole first screen, with the brand's own
words over it. That is a different job from a product thumbnail, and it needs a
different master: a product master is square and 1600px, and a square crop of a
studio portrait throws away exactly the width a cover needs.

WHY 4:5 AND NOT THE WIDE SHAPE IT ENDS UP AS

The page shows the cover at 4:5 on a phone and at 16:9 on a laptop. A master
cut to 16:9 cannot give back the phone's shape -- the pixels are gone. A master
cut to 4:5 can give both, because `object-fit: cover` takes a wide band out of
a tall picture and never the other way round. So the master is the TALLEST
shape any screen asks for, and every wider screen is a band out of its middle.

WHY THESE TWO PHOTOGRAPHS

Not taste: measurement. In a studio portrait the lamp occupies a fixed slice of
the frame, and a wide band of a tall picture shows `width / aspect` pixels of
it. The horse lamp is 1856px tall in a 3719px-wide frame, so a 1.92:1 band
still shows 1937px -- the lamp survives whole, legs and straw base included,
which is what the owner asked for. Every other candidate is taller in frame and
loses its feet:

    lamp height / frame width   widest band that still holds it
    horse      1856 / 3719      2.00 : 1
    cat        2416 / 3710      1.53 : 1
    fox        2184 / 3777      1.72 : 1
    dog        2384 / 3516      1.47 : 1
    rocket     4144 / 3912      0.94 : 1   (never fits a cover)

THE CATHELIER EXCEPTION, WRITTEN DOWN RATHER THAN HIDDEN

Every cathelier photograph is a 361x640 Instagram still. A cover 1440px wide is
a 4x enlargement, and no code fixes that -- the detail was never recorded. The
daisy was chosen because it is one large clean shape, which is the only kind of
subject that survives being enlarged; a flat-lay of small pieces turns to soup.
It is enlarged ONCE here, at the master, with the sharpening applied at that
scale, so the renditions downsample from something coherent instead of each
inventing its own pixels. It will still be softer than the ithos cover. One
landscape photograph from the owner replaces this file and the softness is
gone -- nothing else needs to change.

    python3 scripts/covers.py
"""
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit("Pillow is missing:  python3 -m pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'photos' / '_covers'
MATERIALS = ROOT.parent / '_materiais-ithos-cathelier'

ASPECT = 4 / 5          # the tallest shape any screen asks for
MIN_WIDTH = 1600        # below this the widest rendition would have no source

# brand -> (source file, top of the window as a fraction of the source height)
SOURCES = {
    'ithos': (MATERIALS / 'imagens dos produtos' / 'Ithos_jessicalopesphotography-190.jpg', 0.031),
    'cathelier': (ROOT / 'photos' / 'cathelier' / '_raw' / '06.jpg', 0.0),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for brand, (src, top) in SOURCES.items():
        if not src.exists():
            sys.exit(f"{brand}: source photograph is missing -- {src}")
        with Image.open(src) as im:
            im = im.convert('RGB')
            w, h = im.size
            band = round(w / ASPECT)
            if band > h:
                sys.exit(f"{brand}: {src.name} is {w}x{h}, too wide to cut 4:5")
            y = max(0, min(h - band, round(h * top)))
            cut = im.crop((0, y, w, y + band))

            note = ''
            if cut.width < MIN_WIDTH:
                scale = MIN_WIDTH / cut.width
                cut = cut.resize((MIN_WIDTH, round(cut.height * scale)), Image.LANCZOS)
                # Sharpening belongs at the size the enlargement happened, not
                # at each rendition: done later it sharpens its own artefacts.
                cut = cut.filter(ImageFilter.UnsharpMask(radius=2.4, percent=85, threshold=3))
                note = f'  (enlarged {scale:.1f}x from {w}px -- see the header)'

            dest = OUT / f'{brand}.jpg'
            cut.save(dest, 'JPEG', quality=94, subsampling=0, progressive=True)
            print(f'{brand:10} {src.name} -> {cut.width}x{cut.height}{note}')


if __name__ == '__main__':
    main()
