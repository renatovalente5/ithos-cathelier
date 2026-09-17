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
SRC = ROOT / 'photos' / '_cards'
COVERS = ROOT / 'photos' / '_covers'
OUT = ROOT / 'public' / 'media'
# 120 is for the thumbnail strip under a product card and nothing else. The
# biggest that box ever gets is 56 CSS px, which is 112 device pixels at two
# device pixels per CSS pixel, so 200 was nearly twice the file needed on every
# one of them -- and a catalogue page carries sixty-seven.
WIDTHS = (120, 200, 400, 600, 1000)
# A cover is the full width of the screen, so it needs sizes a thumbnail never
# does. 2600 covers a 1440px laptop at two device pixels with room to spare.
# 720 está aqui por causa do quadro parado do filme: um corte 2:3 de uma
# gravação 1080p tem exactamente 720px de largura, e sem este degrau a única
# rendition possível era 640 -- uma capa permanentemente suave para quem pediu
# menos movimento. Esta lista tem uma cópia em src/build.mjs e scripts/guards.mjs
# morre se as duas deixarem de dizer o mesmo.
COVER_WIDTHS = (640, 720, 960, 1280, 1600, 2000, 2600)
FORCE = '--force' in sys.argv


def main():
    if not SRC.exists():
        sys.exit("No square masters. Run scripts/square.py first.")
    written = skipped = 0
    for master in sorted(SRC.rglob('*.jpg')):
        rel = master.relative_to(SRC).with_suffix('')
        with Image.open(master) as probe:
            source, tall = probe.size
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
                        # A altura sai do MASTER e não de uma constante: esta
                        # família era quadrada e o `resize((w, w))` era verdade
                        # por acidente. Derivá-la significa que mudar a forma
                        # do cartão é mudar scripts/cards.py e mais nada aqui.
                        im = im.resize((w, round(tall * w / source)), Image.LANCZOS)
                    im.save(dest, fmt, quality=62 if fmt == 'AVIF' else 78)
                written += 1
    written, skipped = covers(written, skipped)
    written, skipped = inteiras(written, skipped)
    print(f'{written} renditions written, {skipped} already there')


# --- the WHOLE photograph, for the product page ------------------------------
#
# The square masters are a crop, and on a portrait photograph a square crop
# throws away a third of the frame. Measured across the 90 vertical ithos
# photographs: 50 of them lose part of the lamp, and Santa loses his hat --
# 1333x2000 cut to 1333x1333, and the window landed on the bottom third because
# the woven mat under the lamp scores more edge energy than the lamp does. That
# is a failure this script's own header names.
#
# A card stays square: a grid wants one shape, and a thumbnail being cropped is
# what every shop does. A PRODUCT page is where somebody decides, and there the
# photograph is shown whole.
#
# So this is a second family, from the uncropped masters, and nothing about the
# square family changes -- not photos/_cards, not focus.json, not the contact
# sheets, not the cards.
WHOLE = ROOT / 'public' / 'media' / 'whole'
# One rung above 1000 for the lightbox, and only where the master can fill it.
# Encoded harder than the rest on purpose: its job is resolution, not polish.
ZOOM_W = 1400


def _originais():
    """Exactly the sources cards.py uses, named exactly the same way -- the two
    families must never come to disagree about which photographs exist."""
    fotos = ROOT / 'photos'
    for pasta in sorted((fotos / 'ithos').iterdir()):
        if pasta.is_dir():
            for f in sorted(pasta.glob('*.jpg')):
                yield f'ithos/{pasta.name}/{f.stem}', f
    pool = fotos / 'cathelier' / '_raw'
    if pool.is_dir():
        for f in sorted(pool.glob('*.jpg')):
            yield f'cathelier/pool/{f.stem}', f


def inteiras(written, skipped):
    for key, src in _originais():
        with Image.open(src) as probe:
            sw, sh = probe.size
        # 400 up. The gallery's smallest box is about 288px wide on a 320px
        # phone, so a 200w whole photograph is a file nothing can ever choose --
        # 200 files and 1.6 MB of it.         # 400 up. The gallery's smallest box is about 288px wide on a 320px
        # phone, so a 200w whole photograph is a file nothing can ever choose --
        # 200 files and 1.6 MB of it.
        # A master narrower than 400 gets ONE rung at its own width, never a
        # "-400" holding a 361px picture: the srcset would tell the browser a
        # size the file does not have, which is the same lie as upscaling.
        larguras = [w for w in WIDTHS if 400 <= w <= sw] or [sw]
        if sw >= 1250:
            larguras = larguras + [ZOOM_W]
        for w in larguras:
            h = round(sh * w / sw)
            for fmt, ext in (('AVIF', 'avif'), ('WEBP', 'webp')):
                dest = WHOLE / f'{key}-{w}.{ext}'
                if dest.exists() and not FORCE:
                    skipped += 1
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                with Image.open(src) as im:
                    im = im.convert('RGB')
                    if im.width > w:
                        im = im.resize((w, h), Image.LANCZOS)
                    forte = w == ZOOM_W
                    im.save(dest, fmt, quality=(52 if forte else 62) if fmt == 'AVIF'
                                              else (70 if forte else 78))
                written += 1
    return written, skipped


def covers(written, skipped):
    """The brand covers, which keep their shape instead of being squared off."""
    if not COVERS.exists():
        return written, skipped
    for master in sorted(COVERS.glob('*.jpg')):
        rel = Path('covers') / master.stem
        with Image.open(master) as probe:
            source, tall = probe.width, probe.height
        for w in COVER_WIDTHS:
            # Same rule as the squares: never ask a browser to download a
            # bigger file to see the same picture blurrier.
            if w > source:
                continue
            h = round(tall * w / source)
            for fmt, ext in (('AVIF', 'avif'), ('WEBP', 'webp')):
                dest = OUT / f'{rel}-{w}.{ext}'
                if dest.exists() and not FORCE:
                    skipped += 1
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                with Image.open(master) as im:
                    im = im.convert('RGB')
                    if im.width > w:
                        im = im.resize((w, h), Image.LANCZOS)
                    im.save(dest, fmt, quality=64 if fmt == 'AVIF' else 80)
                written += 1
    return written, skipped


if __name__ == '__main__':
    main()
