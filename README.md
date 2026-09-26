# ithos · cathelier

One domain, two shops that must not look like each other.

* **ithos** — handmade wooden night lights for children's rooms.
  Built to the shape of the shop the owner chose as the model: a 1:1 product
  frame, a four-column grid, colour swatches on the card, and a gallery-first
  product page.
* **cathelier** — personalised laser-cut pieces, organised in the ten collections
  the owner listed on 25 September 2026 (Christmas, Easter, special days, magnets
  and keyrings, new baby, names, hanging pieces, wall decor, custom orders, favours),
  in the warm cream-and-brown world of the second shop the owner chose.

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

## Onde vive

O CI (`.github/workflows/publish.yml`) constrói o site e publica `public/` num
Worker da Cloudflare só de ficheiros (`wrangler.jsonc`), servido em
ithos-cathelier.pt por uma route; o www vai para o apex por uma Redirect Rule
da zona. O GitHub Pages foi desligado a 26 set 2026: os termos dele proíbem
lojas. **Não correr `wrangler deploy` à mão:** o `public/` local não é o do CI —
não tem as versões web das fotografias juntas no painel (só o CI as gera) e,
construído sem `PREVIEW=yes` e sem `API_URL`, publicava um site indexável e sem
API (stock, revenda e retratação desligados). Os cabeçalhos (cache de um ano nos
ficheiros com resumo no nome, e os de segurança) saem de `public/_headers`,
escrito pelo build.

## Running it

```bash
node src/build.mjs                                  # live address, from CNAME
BASE_URL=http://localhost:4320 PREVIEW=yes node src/build.mjs

python3 scripts/cards.py --contact    # review sheets for the card crops
python3 scripts/cards.py              # write the card masters
python3 scripts/renditions.py         # web sizes from the masters
python3 scripts/fonts.py              # re-download the self-hosted typefaces
python3 scripts/share.py              # the link-preview picture, when a cover changes
```

Fotografias juntas no painel: o Worker grava só o original; as versões web
geram-se no CI e ficam numa cache entre publicações (ver publish.yml), por isso
cada fotografia custa uns segundos uma vez. `cards.py` e `renditions.py` passam
à frente de um original que não abre (avisam) e deitam fora os masters e as
versões de uma fotografia cujo original saiu; quem decide se alguma página
precisa de uma fotografia em falta são as guardas.

### Pages and redirect stubs are different numbers

`public/` holds 104 HTML files: **94 pages** and **10 redirect stubs**. The stubs
sit at the ten old cathelier occasion addresses (`/cathelier/christmas/` and the
rest), which were deleted on 17 September 2026 when an occasion became a filter
on `/cathelier/pieces/`. When the collections changed on 25 September 2026, five
of those old words no longer existed; their stubs now point at the collection
their pieces went to, and the same table feeds the map in `shop.js` that turns an
old `#home` or `#fathers-day` shared before the change into the new one. They are
listed in `src/lib/redirects.mjs`, they are not
in the sitemap, and both the build and `check-output` report them apart from the
page count — a file count has never been able to tell a signpost from a
destination.

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
