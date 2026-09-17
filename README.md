# ithos · cathelier

One domain, two shops that must not look like each other.

* **ithos** — handmade wooden night lights for children's rooms.
  Built to the shape of the shop the owner chose as the model: a 1:1 product
  frame, a four-column grid, colour swatches on the card, and a gallery-first
  product page.
* **cathelier** — personalised laser-cut pieces, organised entirely by occasion
  (Christmas, Mother's Day, christenings, births, names…), in the warm
  cream-and-brown world of the second shop the owner chose.

They share one cart, one checkout, one set of legal pages and one back office.
They share almost no CSS.

English only for now. Every string lives in `src/i18n/` so other languages cost
translation, not rework.

## The photographs come first

Of the 58 studio files, two thirds are 2:3, and the shop's cards are 3:4 frames.
`scripts/cards.py` finds the subject in each portrait photograph and centres a
3:4 window on it; `photos/focus.json` records, by hand, the sixteen frames where the
guess was wrong. Read the header of that script before touching any of it.

**A cover photograph must show the whole piece.** Some of the studio files are
deliberate close-ups that run off the frame — good as the second or third
picture in a gallery, never as the face of a product card.

## Running it

```bash
node src/build.mjs                                  # live address, from CNAME
BASE_URL=http://localhost:4320 PREVIEW=yes node src/build.mjs

python3 scripts/cards.py --contact    # review sheets for the card crops
python3 scripts/cards.py              # write the card masters
python3 scripts/renditions.py         # web sizes from the masters
python3 scripts/fonts.py              # re-download the self-hosted typefaces
```

### The browser battery

Measures what only a browser knows: real contrast, tap targets, sideways
overflow, broken images, the typefaces actually loading. It **drives** the site
rather than reading it.

```bash
cp scripts/battery/battery.js public/_battery.js
cp scripts/battery/drive.html public/_drive.html
# then open /_drive.html?w=390 (and ?w=768, ?w=1280) and read window.__resultados
```

The build wipes `public/`, so both files have to be copied again after every
build. Neither goes to the live site.

### The cover photograph

Every product names its own `cover`, and it is **not** taken to be photograph
number one. The cover is the frame that shows the whole piece against a clean
background; the close-ups and the room shots are what the gallery is for, and
the card cycles through them on hover.

All 26 were reviewed on a contact sheet. Four still have a cover that is not
what it should be, and none of them has an alternative to switch to — they each
have exactly one photograph:

  penguin      a workshop shot with an easel, paint pots and two penguins
  raccoon      the raccoon runs off the left edge, cushions behind
  snail        a room shot on a chair, loosely framed
  wood-racer   lying on autumn leaves, busy background

These need one plain studio photograph each, of the whole piece on the brown
backdrop, like the other twenty-two.

## A note about analysis agents

Agents spawned to *analyse* this repository have write access to it. During the
cover study, four of them edited `src/lib/ithos.mjs`, `src/lib/cathelier.mjs`
and both brand stylesheets while I was working, and those edits were swept into
an unrelated commit by a `git add -A`.

The work was good and it survived verification, so it stayed. That was luck.
**Run `git status` after every analysis workflow, before staging anything**, and
stage by path rather than with `-A` while one is running.
