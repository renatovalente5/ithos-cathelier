import { esc, money, picture, prose } from './html.mjs';
import { icon } from './icons.mjs';

/* ===========================================================================
   ithos — the pages, in the order the model shop puts things.
   =========================================================================== */

/** Families for the catalogue filter. Deliberately NOT in the data: the owner
 *  should not have to classify every lamp, and 26 of them do not justify a
 *  field in the back office she will forget to fill in. */
const FAMILY = {
  animals: ['fox', 'mouse', 'hedgehog', 'snail', 'rabbit', 'tiger', 'raccoon', 'flamingo',
            'deer', 'koala', 'lion', 'bear', 'penguin', 'owl', 'giraffe', 'goose', 'unicorn', 'dinosaur'],
  vehicles: ['red-racer', 'wood-racer', 'rocket', 'train'],
  nature: ['whale', 'acorn', 'mushroom'],
  festive: ['santa', 'train'],
};
export const familiesOf = (slug) =>
  Object.entries(FAMILY).filter(([, list]) => list.includes(slug)).map(([k]) => k);

const FILTERS = [
  ['all', 'All'], ['animals', 'Animals'], ['vehicles', 'Vehicles'],
  ['nature', 'Nature'], ['festive', 'Festive'],
];

/** The lowest price this lamp can actually be bought for. A card that says a
 *  price the product page cannot honour is a lie the shop tells on the way in;
 *  it happened once, with an option pre-ticked that carried a surcharge. */
export function fromPrice(p) {
  const cheapest = (p.options || [])
    .filter((o) => o.type === 'choice' && o.required)
    .reduce((sum, o) => sum + Math.min(...o.values.map((v) => v.extra || 0)), 0);
  const dearest = (p.options || [])
    .filter((o) => o.type === 'choice' && o.required)
    .reduce((sum, o) => sum + Math.max(...o.values.map((v) => v.extra || 0)), 0);
  return { low: p.price + cheapest, high: p.price + dearest };
}

export function card(p, { eager = false } = {}) {
  const { low, high } = fromPrice(p);
  const range = high > low;
  const fams = familiesOf(p.slug).join(' ');

  const swatches = (p.options || []).find((o) => o.id === 'variant');
  const dots = swatches
    ? `<div class="card__swatches" aria-hidden="true">${swatches.values.slice(0, 6)
        .map((v) => `<span class="swatch" title="${esc(v.name)}"></span>`).join('')}</div>`
    : '';

  /* The card carries EVERY photograph of the piece, not just the cover.
   *
   * The owner asked for two things here: the pictures bigger, and a way to see
   * the other photographs of the same lamp without opening it — the way the
   * shop she chose does it, where hovering cycles through them.
   *
   * The list goes in a data attribute rather than as hidden <img> tags: 26
   * cards times three or four photographs would be a hundred extra requests on
   * a catalogue page, and almost all of them never looked at. The script swaps
   * the `src` on first hover and the browser fetches then. */
  const others = (p.photos || []).filter((n) => n !== p.cover);

  return `<article class="card" data-product="${esc(p.slug)}" data-family="${esc(fams)}"
  data-shots="${esc([p.cover, ...others].join(','))}" data-dir="ithos/${esc(p.photoFolder)}">
  <a class="card__link" href="/lamps/${esc(p.slug)}/">
    <div class="frame card__frame">
      ${picture({
        dir: `ithos/${p.photoFolder}`, name: p.cover,
        alt: `${p.name} — a handmade wooden night light`,
        sizes: '(min-width: 90rem) 340px, (min-width: 64rem) 30vw, (min-width: 48rem) 30vw, 46vw',
        loading: eager ? 'eager' : 'lazy',
        fetchpriority: eager ? 'high' : undefined,
      })}
      ${others.length ? `<span class="card__shots" aria-hidden="true">${
        [p.cover, ...others].map((_, n) => `<i${n === 0 ? ' class="on"' : ''}></i>`).join('')
      }</span>` : ''}
    </div>
    ${dots}
    <h3 class="card__name">${esc(p.name)}</h3>
    <p class="card__price">${range ? `<span class="card__from">from </span>` : ''}${money(low)}</p>
  </a>
</article>`;
}

/* The four lamps on the cover, named here rather than in the data.
 *
 * The cover is a SHELF: four square photographs edge to edge, no gap, no crop.
 * It only works because all 120 studio files share one flat terracotta ground —
 * put four of them side by side and the joins disappear, so the band reads as
 * one wide photograph of lamps lined up. That is the "background image" the
 * owner asked for, built out of the material that exists.
 *
 * Two rules decide what can go on the shelf, and both were measured on a
 * contact sheet of all 90 squares:
 *
 *   · plain ground only. The ground colours of these four are #9C6C4B,
 *     #AE7E5D, #B1805F and #AD7D5C — within ΔE 8 of each other, which is why
 *     the seams vanish. A lamp photographed on the round straw mat (sheep,
 *     hedgehog, giraffe) breaks the band in half: the mat carries more edge
 *     energy than the lamp does.
 *   · a silhouette that survives being one of four. Whale and train are wide
 *     and lie down; mushroom is three objects in a row; bear stands. At two
 *     cells on a phone the first two are the ones that show, so the two widest
 *     go first.
 *
 * The photograph used is whatever the product names as its own `cover`, so the
 * back office still decides which frame; this list only decides which lamps. */
const SHELF = ['whale', 'train', 'mushroom', 'bear'];

export function home({ products, identity }) {
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const rest = products.filter((p) => !p.featured).slice(0, 8);

  /* If a slug on the shelf is unpublished or renamed, the cover must not lose a
     cell and go three-across on a four-column grid. Featured lamps fill in. */
  const picked = SHELF.map((slug) => products.find((p) => p.slug === slug)).filter(Boolean);
  const shelf = [...picked, ...products.filter((p) => !picked.includes(p))].slice(0, 4);

  return `
<section class="hero hero--shelf">
  <div class="shell">
    <h1 class="shelf__line">Handmade wooden night lights for children’s rooms</h1>
  </div>

  <div class="shelf">
    ${shelf.map((p, i) => `<a class="shelf__cell" href="/lamps/${esc(p.slug)}/">
      ${picture({
        dir: `ithos/${p.photoFolder}`, name: p.cover,
        /* The alt describes THIS photograph. The old one promised a lamp
           "glowing in a child's room" and not one of the 120 files is a room
           shot — it described a photograph that does not exist. */
        alt: `${p.name} — ${p.summary}`,
        sizes: '(min-width: 80rem) 25vw, (min-width: 48rem) 33vw, 50vw',
        loading: i < 2 ? 'eager' : 'lazy',
        fetchpriority: i < 2 ? 'high' : undefined,
      })}
    </a>`).join('\n    ')}
  </div>

  <div class="shell">
    <p class="shelf__more"><a class="hero__cta" href="/lamps/">See all ${products.length} lamps</a></p>
  </div>
</section>

<section class="section">
  <div class="shell">
    <div class="section__head"><h2>Favourites</h2></div>
    <div class="grid-products">
      ${featured.map((p, i) => card(p, { eager: i < 4 })).join('\n      ')}
    </div>
  </div>
</section>

<section class="section section--soft">
  <div class="shell">
    <div class="maker">
      <div class="maker__text">
        <h2>Hello</h2>
        <p>Lovely that you are here. We are a small family workshop in Castelo Branco,
           where we make wooden night lights for children’s rooms by hand, one at a time.</p>
        <p>Come and look around. We hope you find something here that steals your heart.</p>
        <p class="maker__sign">Cathia</p>
      </div>
      <div class="frame maker__photo">
        ${picture({
          dir: `ithos/${(products.find((x) => x.slug === 'sheep') ?? products[0]).photoFolder}`,
          name: (products.find((x) => x.slug === 'sheep') ?? products[0]).cover,
          alt: 'A wooden night light from the workshop',
          sizes: '(min-width: 56rem) 45vw, 100vw',
        })}
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="shell">
    <div class="section__head"><h2>More from the workshop</h2></div>
    <div class="grid-products">
      ${rest.map((p) => card(p)).join('\n      ')}
    </div>
    <p style="text-align:center;margin-block-start:2.5rem">
      <a class="btn btn--ghost" href="/lamps/">See all ${products.length} lamps</a>
    </p>
  </div>
</section>
`;
}

export function catalogue({ products }) {
  const prices = products.map((p) => fromPrice(p).low);
  return `
<section class="section" style="padding-block-start:clamp(1rem,2vw,2rem)">
  <div class="shell">
    <h1>Wooden night lights</h1>
    <p class="lede measure" style="margin-block-start:.5rem">
      ${products.length} designs, handmade in solid pine, ${money(Math.min(...prices))}–${money(Math.max(...prices))}.
      Each one can carry an engraved name.
    </p>

    <div class="filters" data-filters style="margin-block-start:1.25rem">
      ${FILTERS.map(([id, label], i) =>
        `<button class="filter" type="button" data-filter="${id}" aria-pressed="${i === 0}">${esc(label)}</button>`).join('\n      ')}
    </div>

    <div class="grid-products" data-product-list style="margin-block-start:1.5rem">
      ${products.map((p, i) => card(p, { eager: i < 4 })).join('\n      ')}
    </div>
    <p class="lede" data-no-results hidden style="margin-block-start:2rem">No lamps in that family.</p>
  </div>
</section>
`;
}

export function product({ p, all, shop }) {
  const { low, high } = fromPrice(p);
  const photos = p.photos;
  const dir = `ithos/${p.photoFolder}`;
  const related = all.filter((x) => x.slug !== p.slug)
    .filter((x) => familiesOf(x.slug).some((f) => familiesOf(p.slug).includes(f)))
    .slice(0, 4);
  const size = p.size || {};
  const dims = [
    size.height && `${size.height} cm tall`,
    size.width && `${size.width} cm wide`,
    size.length && `${size.length} cm long`,
    size.depth && `${size.depth} cm deep`,
  ].filter(Boolean).join(' · ');

  return `
<section class="product shell">
  <div class="product__gallery">
    <div class="gallery" data-gallery>
      <div class="gallery__track" data-gallery-track>
        ${photos.map((n, i) => `<div class="frame gallery__slide" data-index="${i}">
          ${picture({ dir, name: n, alt: `${p.name} — photograph ${i + 1}`,
            sizes: '(min-width: 64rem) 560px, 100vw',
            loading: i === 0 ? 'eager' : 'lazy', fetchpriority: i === 0 ? 'high' : undefined })}
        </div>`).join('\n        ')}
      </div>
      ${photos.length > 1 ? `
      <button class="gallery__arrow gallery__arrow--prev" type="button" data-gallery-prev aria-label="Previous photograph">${icon('arrowLeft', 20)}</button>
      <button class="gallery__arrow gallery__arrow--next" type="button" data-gallery-next aria-label="Next photograph">${icon('arrowRight', 20)}</button>` : ''}
    </div>
    ${photos.length > 1 ? `<div class="gallery__thumbs" role="tablist" aria-label="Photographs">
      ${photos.map((n, i) => `<button class="frame gallery__thumb" type="button" role="tab"
        data-gallery-go="${i}" aria-selected="${i === 0}" aria-label="Photograph ${i + 1}">
        ${picture({ dir, name: n, alt: '', sizes: '84px', widths: [200, 400] })}
      </button>`).join('\n      ')}
    </div>` : ''}
  </div>

  <div class="product__detail">
    <h1>${esc(p.name)}</h1>
    <p class="product__price">${high > low ? `${money(low)} – ${money(high)}` : money(low)}</p>
    <p class="product__blurb">${esc(p.summary)}</p>
    <p class="product__lead">${icon('truck', 15)}<span>${esc(p.made === 'to_order' ? shop.lead.toOrder : shop.lead.inStock)}</span></p>

    <form class="product__form" data-product-form data-product-id="${esc(p.slug)}">
      ${(p.options || []).map(optionField).join('\n      ')}

      <div class="product__buy">
        <div class="qty" data-qty>
          <button class="qty__btn" type="button" data-qty-down aria-label="One fewer">${icon('minus', 16)}</button>
          <input class="qty__input" type="number" name="quantity" value="1" min="1" max="20"
                 inputmode="numeric" aria-label="Quantity">
          <button class="qty__btn" type="button" data-qty-up aria-label="One more">${icon('plus', 16)}</button>
        </div>
        <button class="btn btn--wide" type="button" data-add>Add to basket</button>
      </div>
    </form>

    <div class="reassure">
      ${[['truck', 'Shipped across Europe — €5 within mainland Portugal'],
         ['leaf', 'Solid pine and water-based paints'],
         ['shield', `${shop.returns.warrantyYears}-year guarantee · ${shop.returns.coolingOffDays} days to change your mind`],
         ['hand', 'Made by hand in Castelo Branco, Portugal']]
        .map(([i, t]) => `<p>${icon(i, 18)}<span>${esc(t)}</span></p>`).join('\n      ')}
    </div>

    <div class="product__text stack" style="--stack:1rem">
      ${prose(p.text)}
      ${dims ? `<p class="small muted">${esc(dims)}</p>` : ''}
    </div>

    <details class="product__safety">
      <summary>Care and safety</summary>
      <ul>${(shop.safetyIthos || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </details>
  </div>
</section>

${related.length ? `<section class="section section--soft">
  <div class="shell">
    <div class="section__head"><h2>You might also like</h2></div>
    <div class="grid-products">${related.map((x) => card(x)).join('\n      ')}</div>
  </div>
</section>` : ''}
`;
}

/* One field per option. The cheapest choice is pre-ticked, never the first:
   a first option carrying a surcharge made the card advertise a price the page
   then refused to honour. */
function optionField(o) {
  if (o.type === 'text') {
    return `<div class="field">
        <label for="opt-${esc(o.id)}">${esc(o.name)} <span class="field__optional">optional</span></label>
        ${o.help ? `<p class="field__help">${esc(o.help)}</p>` : ''}
        <input id="opt-${esc(o.id)}" type="text" maxlength="${o.max || 40}"
               data-option="${esc(o.id)}" placeholder="A name, a date, a short phrase">
      </div>`;
  }
  const cheapest = Math.min(...o.values.map((v) => v.extra || 0));
  const chosen = o.values.find((v) => (v.extra || 0) === cheapest) ?? o.values[0];
  return `<fieldset class="field">
        <legend>${esc(o.name)}</legend>
        ${o.help ? `<p class="field__help">${esc(o.help)}</p>` : ''}
        <div class="choices">
          ${o.values.map((v) => `<label class="choice">
            <input type="radio" name="opt-${esc(o.id)}" value="${esc(v.id)}"
                   data-option="${esc(o.id)}"${v.id === chosen.id ? ' checked' : ''}>
            <span>${esc(v.name)}${v.extra ? ` <em>+${money(v.extra)}</em>` : ''}</span>
          </label>`).join('\n          ')}
        </div>
      </fieldset>`;
}
