import { esc, money, picture, prose } from './html.mjs';
import { icon } from './icons.mjs';
import { cover } from './cover.mjs';

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
   * The owner asked for two things: the other photographs of the same lamp
   * offered underneath the picture so they can be chosen, and -- while the
   * pointer rests on the picture -- a slow drift from one to the next, each
   * one zooming in a little before it hands over.
   *
   * THE LINK HAD TO BE BROKEN IN TWO. The whole card used to be one <a>, and
   * HTML forbids a <button> inside a link, so the thumbnails could not have
   * gone anywhere. They are now a SIBLING of the picture's link rather than a
   * descendant of it. That costs a second anchor to the same address, which is
   * paid for in the usual way: the picture's link is `tabindex="-1"` and
   * `aria-hidden`, so the card still offers exactly one link and one name.
   * Not a stretched pseudo-element over the whole card -- that works until the
   * day some later rule gives the strip `position: static`, and then a click
   * meant for a thumbnail navigates instead, silently.
   *
   * The big list of photographs stays in a data attribute and not as hidden
   * <img> tags: the script clones the frame's own <picture> when it needs a
   * second layer, which inherits its sizes, its widths and its address prefix
   * instead of composing any of them again. */
  const shots = [p.cover, ...(p.photos || []).filter((n) => n !== p.cover)];
  const dir = `ithos/${p.photoFolder}`;
  const href = `/lamps/${esc(p.slug)}/`;

  /* The buttons ship EMPTY, and the script puts the pictures in them.
   *
   * They used to ship with an <img loading="lazy"> each, and the strip is
   * display:none below 48rem -- which turns out not to matter: measured on a
   * 375px phone, the browser fetched twenty-two of them anyway, 53 KB of
   * photographs nobody can see, on the one device least able to afford it.
   * A lazy image inside a hidden box is still loading-eligible.
   *
   * So the markup carries only the button, and the script builds the <img>
   * from data-shots and data-dir -- which it already has -- and only where the
   * strip is actually shown. Without a script there is no strip at all, and
   * the card is exactly the card it was before. Nothing checks these
   * addresses in the HTML any more, which is why scripts/guards.mjs now
   * checks every rendition against the disk instead. */
  const thumb = (name, n) => `<button class="card__thumb${n === 0 ? ' is-on' : ''}" type="button"
        data-thumb="${n}" aria-pressed="${n === 0 ? 'true' : 'false'}" tabindex="${n === 0 ? '0' : '-1'}"
        aria-label="Photograph ${n + 1} of ${shots.length}"></button>`;

  return `<article class="card" data-product="${esc(p.slug)}" data-family="${esc(fams)}"
  data-shots="${esc(shots.join(','))}" data-dir="${esc(dir)}">
  <a class="card__media" href="${href}" tabindex="-1" aria-hidden="true">
    <div class="frame card__frame">
      ${picture({
        dir, name: p.cover,
        alt: `${p.name} — a handmade wooden night light`,
        sizes: '(min-width: 90rem) 340px, (min-width: 64rem) 30vw, (min-width: 48rem) 30vw, 46vw',
        loading: eager ? 'eager' : 'lazy',
        fetchpriority: eager ? 'high' : undefined,
      })}
    </div>
  </a>
  ${shots.length > 1
    ? `<div class="card__thumbs" role="group" aria-label="${esc(p.name)} — ${shots.length} photographs">
    ${shots.map(thumb).join('\n    ')}
  </div>`
    : '<div class="card__thumbs card__thumbs--none" aria-hidden="true"></div>'}
  ${dots}
  <h3 class="card__name"><a class="card__link" href="${href}">${esc(p.name)}</a></h3>
  <p class="card__price">${range ? `<span class="card__from">from </span>` : ''}${money(low)}</p>
</article>`;
}

export function home({ products, identity, cover: coverText, coverWidths }) {
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const rest = products.filter((p) => !p.featured).slice(0, 8);

  return `
${cover(coverText, 'ithos', coverWidths)}

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
