#!/usr/bin/env python3
"""
The pictures a link to the shop shows when it is shared (og:image): in a
WhatsApp message, on Facebook, in Messenger.

WHY THERE IS A LOGO ON THEM NOW
Until 7 October 2026 the picture was the two cover photographs side by side,
with no logo, and the owner's complaint was exactly that: "when I share the
link, the logo does not show". These cards put the client's REAL artwork on
every preview -- the SVGs in assets/brand/, turned into PNG by a browser
(scripts/logos.mjs) and never redrawn or recoloured: they sit on the shop's own
ground colour, which is the only thing their dark ink and green were drawn for.

TWO SHAPES, ONE PICTURE
WhatsApp shows a link either LARGE (the whole 1.91:1 picture above the title)
or SMALL (a square thumbnail beside it, cut from the middle). Its own page
promises the large one when the image is an absolute URL, under 600 KB, at
least 300 px wide and no wider than 4:1 -- and says it may fall back to the
small one otherwise, without saying how it crops. So every card is built for
both: 1200 x 630 (what Meta recommends, 1.91:1), and everything that must be
seen sits inside the centred 630 x 630 square, x 285..915.
  https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/
  https://developers.facebook.com/documentation/sharing/webmasters/images

WHAT IT WRITES
* Three brand cards, in assets/brand/ (the build copies them to /assets/):
    share-ithos.jpg            the lamps -- logo on white, two lamps beside it
    share-cathelier.jpg        the laser-cut pieces -- logo on cream
    share-ithos-cathelier.jpg  the door and the pages both shops share
* One card per product cover, in public/media/partilha/<brand>/<folder>/<photo>.jpg:
  the logo and the product's own photograph, side by side INSIDE the square,
  so the thumbnail still shows what was shared and whose it is.
  The photograph is the cover the product page shows (`cover` in the content
  file, the same field the generator reads) in its 3:4 card crop -- the largest
  web version scripts/renditions.py wrote. Never a second opinion about which
  picture is the cover: on another shop a card cut from "the first photograph
  by file name" shared one car with another car's picture, and nobody saw it
  but the people who received the link. scripts/check-output.mjs stops a card
  no page points at.

JPEG, baseline, sRGB, no metadata but the recipe below: WebP is not on Meta's list of og:image types
(jpeg, gif, png), and WhatsApp documents no list at all.

THE ADDRESS CHANGES WHEN THE PICTURE DOES
Meta keeps an image by its URL. The files keep stable names; the build adds
?v=<digest of the file> to the og:image, so a redrawn card is a new address
and an old preview never points at a 404 (src/build.mjs, cartoes()).

The old /assets/share.jpg (the two covers, no logo) stays published on purpose:
previews made before this change point at it.

EVERY CARD SAYS WHAT IT WAS DRAWN FROM
A comment inside each JPEG carries its recipe: the layout version (DESENHO
below), the digest of each logo's SVG (which logos.mjs wrote into the PNG) and
the digest of every photograph on it. A card whose recipe is what this script
would draw today is left alone; any other is redrawn. So the studio cards that
are committed are not redone on every publish, the ones for photographs the
owner adds in the back office are made in CI, and a photograph replaced under
the same name -- or a new logo -- redraws its cards without anybody having to
remember. scripts/guards.mjs reads the same comment and stops a publish whose
cards carry an older logo than assets/brand/.

Run it:
    python3 scripts/share.py           what is missing or out of date (CI runs this)
    python3 scripts/share.py --force   redraw everything
After changing the layout, bump DESENHO.
"""
import hashlib
import json
import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageOps
except ImportError:
    sys.exit("Pillow is missing:  python3 -m pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
LOGOS = ROOT / 'scripts' / 'share'
BRAND_OUT = ROOT / 'assets' / 'brand'
MEDIA = ROOT / 'public' / 'media'
CARDS_OUT = MEDIA / 'partilha'
FORCE = '--force' in sys.argv
# The layout's version. Bump it when anything below changes how a card looks:
# every card's recipe stops matching and the next run redraws them all.
DESENHO = 1

W, H = 1200, 630
SQUARE = ((W - H) // 2, (W + H) // 2)   # 285..915: what a square thumbnail keeps

# The grounds are the site's own (src/styles/brands/*.css): ithos is white,
# cathelier is cream. The card shared by both takes the ithos trust band, the
# warm white between the two.
GROUND = {'ithos': '#FFFFFF', 'cathelier': '#FFF8F2', 'ithos-cathelier': '#FBF6F1'}
LOGO = {'ithos': 'ithos-wordmark', 'cathelier': 'cathelier'}

# The photographs either side of a brand card's logo: catalogue pieces against
# the studio backdrop, narrow enough to stand whole in a 270 px band.
# (file under photos/, horizontal focus, vertical focus, zoom)
BAND_W = 270
BANDS = {
    'ithos': [('ithos/veado/01.jpg', .5, .52, 1.15), ('ithos/girafa/01.jpg', .5, .52, 1.15)],
    'cathelier': [('_covers/cathelier.jpg', .5, .45, 1.0), ('cathelier/_raw/07.jpg', .62, .42, 1.0)],
    'ithos-cathelier': [('ithos/foguetao/01.jpg', .5, .52, 1.15), ('_covers/cathelier.jpg', .5, .45, 1.0)],
}

# A product card: the logo, a gap, the photograph -- one group, centred, inside
# the square with room to spare.
PRODUCT_PHOTO_H = 520
PRODUCT_GAP = 36
PRODUCT_LOGO_W = {'ithos': 160, 'cathelier': 180}
# cathelier's corners are round on the site (--radius: 14px on a ~300 px card),
# ithos's are square. The photograph keeps its shop's corners.
PRODUCT_RADIUS = {'ithos': 0, 'cathelier': 22}

JPEG = dict(quality=88, optimize=True, progressive=False, subsampling=0)
# WhatsApp's ceiling is 600 KB; staying under half of it leaves a margin for a
# busier photograph. scripts/check-output.mjs enforces the real ceiling.
BUDGET = 300 * 1024


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


_logos = {}
_origem = {}


def logo(brand):
    """The PNG scripts/logos.mjs drew from the SVG, cut to its ink."""
    if brand not in _logos:
        path = LOGOS / f'{LOGO[brand]}.png'
        if not path.exists():
            sys.exit(f'{path.relative_to(ROOT)} is missing: run  node scripts/logos.mjs')
        with Image.open(path) as png:
            # The digest of the SVG it was drawn from, written by logos.mjs.
            # It travels into every card (a JPEG comment) and
            # scripts/guards.mjs compares it with today's SVG.
            sha = png.info.get('svg-sha256')
            if not sha:
                sys.exit(f'{path.relative_to(ROOT)} does not say which SVG it came from: run  node scripts/logos.mjs')
            im = png.convert('RGBA')
        _origem[brand] = f'{LOGO[brand]}={sha}'
        _logos[brand] = im.crop(im.getchannel('A').getbbox())
    return _logos[brand]


def sha16(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:16]


def recipe(brands, photos):
    """What a card is drawn from, in one line: it goes in the JPEG comment."""
    for b in brands:
        logo(b)
    return ' '.join([f'share.py desenho={DESENHO}', *(_origem[b] for b in brands),
                     *(f'foto={sha16(f)}' for f in photos)])


def drawn_from(dest):
    """The recipe an existing card was drawn from ('' if none or unreadable)."""
    try:
        with Image.open(dest) as im:
            return (im.info.get('comment') or b'').decode('latin1')
    except (OSError, SyntaxError, ValueError):
        return ''


def scaled(im, w=None, h=None):
    """Resized in premultiplied alpha, or every antialiased edge of the ink
    picks up a dark fringe from the transparent pixels next to it."""
    if w is None:
        w = round(im.width * h / im.height)
    if h is None:
        h = round(im.height * w / im.width)
    return im.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')


def band(path, w, h, fx, fy, zoom):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    s = max(w / im.width, h / im.height) * zoom
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    left = min(max(round(im.width * fx - w / 2), 0), im.width - w)
    top = min(max(round(im.height * fy - h / 2), 0), im.height - h)
    return im.crop((left, top, left + w, top + h))


def inside_square(x, width, what):
    if x < SQUARE[0] or x + width > SQUARE[1]:
        raise SystemExit(f'{what} runs out of the centred square ({x}..{x + width}, '
                         f'square {SQUARE[0]}..{SQUARE[1]}) -- a square thumbnail would cut it')


def save(card, dest, rec):
    """Written beside and swapped in at once, as scripts/renditions.py does."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + '.tmp')
    try:
        card.convert('RGB').save(tmp, 'JPEG', comment=rec.encode('ascii'), **JPEG)
        os.replace(tmp, dest)
    finally:
        if tmp.exists():
            tmp.unlink()
    size = dest.stat().st_size
    if size > BUDGET:
        print(f'  warning: {dest.relative_to(ROOT)} is {size // 1024} KB, over the {BUDGET // 1024} KB budget',
              file=sys.stderr)
    return size


# --- the three brand cards ----------------------------------------------------

def brand_card(kind):
    card = Image.new('RGBA', (W, H), hexrgb(GROUND[kind]))
    (left, right) = BANDS[kind]
    card.paste(band(ROOT / 'photos' / left[0], BAND_W, H, *left[1:]), (0, 0))
    card.paste(band(ROOT / 'photos' / right[0], BAND_W, H, *right[1:]), (W - BAND_W, 0))

    if kind == 'ithos':
        mark = scaled(logo('ithos'), h=350)
        x, y = (W - mark.width) // 2, (H - mark.height) // 2
        inside_square(x, mark.width, 'the ithos logo')
        card.alpha_composite(mark, (x, y))
    elif kind == 'cathelier':
        mark = scaled(logo('cathelier'), w=470)
        x, y = (W - mark.width) // 2, (H - mark.height) // 2
        inside_square(x, mark.width, 'the cathelier logo')
        card.alpha_composite(mark, (x, y))
    else:
        # Stacked, not side by side: in a 90-point thumbnail two marks in a row
        # are each a smudge, and one above the other are each half the square.
        top = scaled(logo('ithos'), h=250)
        bottom = scaled(logo('cathelier'), w=340)
        gap = 40
        y = (H - (top.height + gap + bottom.height)) // 2
        for mark, yy in ((top, y), (bottom, y + top.height + gap)):
            x = (W - mark.width) // 2
            inside_square(x, mark.width, 'a logo on the shared card')
            card.alpha_composite(mark, (x, yy))
    return card


# --- one card per product cover -----------------------------------------------

def products():
    """(brand, folder, cover) of every published product with a photograph --
    read from the same files, by the same fields, as src/build.mjs."""
    out = set()
    for brand in ('ithos', 'cathelier'):
        d = ROOT / 'content' / brand
        if not d.is_dir():
            continue
        for f in sorted(d.glob('*.json')):
            if f.name.startswith('_'):
                continue
            p = json.loads(f.read_text('utf8'))
            if p.get('published') and p.get('photoFolder') and p.get('cover'):
                out.add((brand, p['photoFolder'], p['cover']))
    return sorted(out)


RENDITION = re.compile(r'-(\d+)\.webp$')


def largest_rendition(brand, folder, name):
    d = MEDIA / brand / folder
    best = None
    for f in d.glob(f'{name}-*.webp') if d.is_dir() else []:
        m = RENDITION.search(f.name)
        if m and f.name == f'{name}-{m.group(1)}.webp' and (best is None or int(m.group(1)) > best[0]):
            best = (int(m.group(1)), f)
    return best[1] if best else None


def rounded(im, r):
    if not r:
        return im.convert('RGBA')
    mask = Image.new('L', (im.width * 4, im.height * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, mask.width - 1, mask.height - 1), radius=r * 4, fill=255)
    out = im.convert('RGBA')
    out.putalpha(mask.resize(im.size, Image.LANCZOS))
    return out


def product_card(brand, photo):
    card = Image.new('RGBA', (W, H), hexrgb(GROUND[brand]))
    with Image.open(photo) as im:
        im = im.convert('RGB')
        ph = PRODUCT_PHOTO_H
        pw = round(im.width * ph / im.height)
        if pw > 420:                       # a wide photograph: fit the width instead
            pw, ph = 420, round(im.height * 420 / im.width)
        pic = rounded(im.resize((pw, ph), Image.LANCZOS), PRODUCT_RADIUS[brand])
    mark = scaled(logo(brand), w=PRODUCT_LOGO_W[brand])
    x0 = (W - (mark.width + PRODUCT_GAP + pw)) // 2
    inside_square(x0, mark.width + PRODUCT_GAP + pw, f'the {brand} product card')
    card.alpha_composite(mark, (x0, (H - mark.height) // 2))
    card.alpha_composite(pic, (x0 + mark.width + PRODUCT_GAP, (H - ph) // 2))
    return card


def main():
    written = skipped = 0
    for kind in ('ithos', 'cathelier', 'ithos-cathelier'):
        dest = BRAND_OUT / f'share-{kind}.jpg'
        rec = recipe(('ithos', 'cathelier') if kind == 'ithos-cathelier' else (kind,),
                     [ROOT / 'photos' / b[0] for b in BANDS[kind]])
        if not FORCE and dest.exists() and drawn_from(dest) == rec:
            skipped += 1
            continue
        size = save(brand_card(kind), dest, rec)
        print(f'  {dest.relative_to(ROOT)}: {W}x{H}, {size // 1024} KB')
        written += 1

    wanted = set()
    missing = []
    for brand, folder, cover in products():
        dest = CARDS_OUT / brand / folder / f'{cover}.jpg'
        photo = largest_rendition(brand, folder, cover)
        if photo is None:
            # The page has no photograph either; the generator gives it the
            # brand card, and the guards decide whether the page may go out.
            # An old card for it is not kept: it would show a picture the
            # page no longer has.
            missing.append(f'{brand}/{folder}/{cover}')
            continue
        wanted.add(dest)
        try:
            rec = recipe((brand,), [photo])
            if not FORCE and dest.exists() and drawn_from(dest) == rec:
                skipped += 1
                continue
            save(product_card(brand, photo), dest, rec)
            written += 1
        except (OSError, SyntaxError, ValueError) as e:
            missing.append(f'{brand}/{folder}/{cover} ({type(e).__name__}: {e})')

    # A card nobody points at any more -- a cover changed, a product taken down
    # -- does not stay on the site. Only what this script writes is touched.
    removed = 0
    if CARDS_OUT.is_dir():
        for f in sorted(CARDS_OUT.rglob('*')):
            if f.is_file() and (f.suffix == '.tmp' or (f.suffix == '.jpg' and f not in wanted)):
                f.unlink()
                removed += 1
        for d in sorted((x for x in CARDS_OUT.rglob('*') if x.is_dir()), reverse=True):
            if not any(d.iterdir()):
                d.rmdir()

    for m in missing:
        print(f'  warning: no card for {m}: no web version of the photograph -- the page gets the brand card',
              file=sys.stderr)
    print(f'{written} share cards written, {skipped} already up to date'
          + (f', {removed} removed (nobody shows them any more)' if removed else ''))


if __name__ == '__main__':
    main()
