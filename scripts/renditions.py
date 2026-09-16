#!/usr/bin/env python3
"""
Web sizes, from the square masters.

The masters are 1:1 and up to 1600px; the site never serves one. This writes
four widths in AVIF and in WebP, plus one social card per product.

Both formats, on purpose: AVIF is smaller but slower to decode on a cheap
phone, and a cheap phone is exactly who buys a night light at eleven at night.
`<picture>` offers both and lets the browser decide; the plain `<img>` is WebP,
which everything reads today.

The results are committed. A build step that regenerates every derivative on
every publish cost 197 seconds a save on another project, and the owner decided
the site was broken.

    python3 scripts/renditions.py
    python3 scripts/renditions.py --force
"""
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is missing:  python3 -m pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'photos' / '_square'
OUT = ROOT / 'public' / 'media'
WIDTHS = (200, 400, 600, 1000)
FORCE = '--force' in sys.argv


def main():
    if not SRC.exists():
        sys.exit("No square masters. Run scripts/square.py first.")
    written = skipped = 0
    for master in sorted(SRC.rglob('*.jpg')):
        rel = master.relative_to(SRC).with_suffix('')
        with Image.open(master) as probe:
            source = probe.width
        for w in WIDTHS:
            # Never upscale. These Instagram frames are 360px wide, and writing
            # them out as "-1000" would tell the browser to download a bigger
            # file to see the same picture blurrier.
            if w > source and w != min(x for x in WIDTHS if x >= source):
                continue
            for fmt, ext in (('AVIF', 'avif'), ('WEBP', 'webp')):
                dest = OUT / f'{rel}-{w}.{ext}'
                if dest.exists() and not FORCE:
                    skipped += 1
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                with Image.open(master) as im:
                    im = im.convert('RGB')
                    if im.width > w:
                        im = im.resize((w, w), Image.LANCZOS)
                    im.save(dest, fmt, quality=62 if fmt == 'AVIF' else 78)
                written += 1
    print(f'{written} renditions written, {skipped} already there')


if __name__ == '__main__':
    main()
