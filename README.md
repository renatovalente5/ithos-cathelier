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

Of the 58 studio files, not one is square, and the shop is built on 1:1 frames.
`scripts/square.py` finds the subject in each portrait photograph and centres a
square on it; `photos/focus.json` records, by hand, the sixteen frames where the
guess was wrong. Read the header of that script before touching any of it.

**A cover photograph must show the whole piece.** Some of the studio files are
deliberate close-ups that run off the frame — good as the second or third
picture in a gallery, never as the face of a product card.
