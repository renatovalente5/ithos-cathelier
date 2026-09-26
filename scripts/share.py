#!/usr/bin/env python3
"""
The picture a link to the shop shows when it is shared (og:image), for every
page that has no photograph of its own: the home page, the about page, the
legal pages, the basket.

1200 x 630 is the shape Facebook, WhatsApp, LinkedIn and Slack all crop to
without cutting. The shop is two brands, so the picture is both covers side by
side -- ithos on the left, cathelier on the right -- each a 600 x 630 band out
of the middle of its cover photograph (photos/_covers/). No words on it: the
title of the page is shown under the picture by every app that shows one.

Run it again only when a cover changes:
    python3 scripts/share.py
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630
HALF = W // 2
# Where, from the top (0) to the bottom (1), the band is taken: the lamp and the
# piece sit a little above the middle of their portraits.
BANDS = [("ithos.jpg", 0.46), ("cathelier.jpg", 0.5)]


def band(path, focus):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    scale = HALF / im.width if im.width / im.height < HALF / H else H / im.height
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - HALF) // 2
    top = min(max(round(im.height * focus - H / 2), 0), im.height - H)
    return im.crop((left, top, left + HALF, top + H))


out = Image.new("RGB", (W, H))
for i, (name, focus) in enumerate(BANDS):
    out.paste(band(ROOT / "photos" / "_covers" / name, focus), (i * HALF, 0))
dest = ROOT / "assets" / "brand" / "share.jpg"
out.save(dest, "JPEG", quality=85, optimize=True, progressive=True)
print(f"{dest.relative_to(ROOT)}: {W}x{H}, {dest.stat().st_size // 1024} KB")
