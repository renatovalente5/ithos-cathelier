import { esc, money, picture, prose } from './html.mjs';
import { icon } from './icons.mjs';

/* ===========================================================================
   cathelier — navigation by occasion, which is how the model shop works and
   exactly how the owner described hers: by date and by celebration, never by
   what the thing is made of.
   =========================================================================== */

/* Not one of the 41 pieces has been photographed yet. Until they are, the
   frame carries the piece's name the way it would be engraved — honest about
   being a placeholder, and it leaves by itself the moment a photograph lands. */
function frame(p, sizes, eager = false) {
  if (!p.photos?.length || !p.photoFolder) {
    return `<div class="frame awaiting"><span>${esc(p.name)}</span></div>`;
  }
  return `<div class="frame">${picture({
    dir: `cathelier/${p.photoFolder}`, name: p.cover || p.photos[0],
    alt: `${p.name} — laser cut and engraved to order`,
    // Only the widths that exist. The stand-in photographs are 360px wide, so
    // offering a 1000w candidate would be a promise the file cannot keep.
    widths: [200, 400],
    sizes, loading: eager ? 'eager' : 'lazy',
  })}</div>`;
}

export function card(p, { eager = false } = {}) {
  const tags = [p.occasion, ...(p.alsoIn || [])].join(' ');
  return `<article class="card" data-product="${esc(p.slug)}" data-family="${esc(tags)}">
  <a class="card__link" href="/cathelier/pieces/${esc(p.slug)}/">
    ${frame(p, '(min-width: 64rem) 280px, (min-width: 48rem) 30vw, 46vw', eager)}
    <h3 class="card__name">${esc(p.name)}</h3>
    <p class="card__price">from ${money(p.price)}</p>
  </a>
</article>`;
}

/* A photograph in each circle, the way the model shop does it — a row of round
   badges is the whole navigation there, and a row of ten identical line icons
   would say nothing about what is behind them. */
const BADGE = {
  christmas: '04', 'mothers-day': '06', 'fathers-day': '12',
  'childrens-day': '02', keepsakes: '03', 'new-baby': '05',
  names: '07', home: '08', hanging: '09', awards: '12',
};

function occasionRow(occasions, current) {
  return `<nav class="occasions" aria-label="Occasions">
  ${occasions.map((o) => `<a class="occasion" href="/cathelier/${esc(o.slug)}/"${o.slug === current ? ' aria-current="page"' : ''}>
    <span class="occasion__badge">${picture({
      dir: 'cathelier/pool', name: BADGE[o.slug] || '02', widths: [200],
      alt: '', sizes: '74px',
    })}</span>
    <span class="occasion__name">${esc(o.name)}</span>
  </a>`).join('\n  ')}
</nav>`;
}

export function home({ occasions, pieces }) {
  const featured = occasions.slice(0, 3);
  return `
<section class="hero">
  <div class="hero__photo">
    ${picture({ dir: 'cathelier/pool', name: '06', widths: [200, 400],
      alt: 'Laser-cut wooden keepsakes with names engraved into them',
      sizes: '100vw', loading: 'eager', fetchpriority: 'high' })}
  </div>
  <div class="hero__body">
    <h1 class="hero__title">Pieces cut and engraved with your names on them</h1>
    <a class="hero__cta" href="/cathelier/pieces/">See everything</a>
  </div>
</section>

<div class="shell">
  ${occasionRow(occasions)}
</div>

${featured.map((o) => {
  const list = pieces.filter((p) => p.occasion === o.slug || (p.alsoIn || []).includes(o.slug)).slice(0, 4);
  if (!list.length) return '';
  return `<section class="collection">
  <div class="shell">
    <div class="collection__head">
      <span class="eyebrow">Featured collection</span>
      <h2>${esc(o.name)}</h2>
      <p class="lede" style="margin-block-start:.75rem">${esc(o.summary)}</p>
    </div>
    <div class="grid-products" style="margin-block-start:2rem">${list.map((p) => card(p)).join('\n      ')}</div>
    <p style="text-align:center;margin-block-start:2rem">
      <a class="btn btn--ghost" href="/cathelier/${esc(o.slug)}/">See all of ${esc(o.name)}</a>
    </p>
  </div>
</section>`;
}).join('\n')}

<section class="collection" style="background:var(--bg-soft)">
  <div class="shell shell--narrow" style="text-align:center">
    <h2>How it works</h2>
    <div class="stack lede" style="--stack:1rem;margin-block-start:1.25rem">
      <p>Tell us the names, the dates or the words. We send you a drawing to approve
         before anything is cut — nothing goes on the laser until you say yes.</p>
      <p>Then it is cut, sanded and finished by hand, and it comes to you ready to give.</p>
    </div>
    <p style="margin-block-start:1.75rem"><a class="btn" href="/cathelier/quote/">Ask for a quote</a></p>
  </div>
</section>
`;
}

export function occasion({ o, pieces, occasions }) {
  const list = pieces.filter((p) => p.occasion === o.slug || (p.alsoIn || []).includes(o.slug));
  return `
<section class="collection">
  <div class="shell">
    <div class="collection__head">
      <h1>${esc(o.name)}</h1>
      <p class="lede" style="margin-block-start:.75rem">${esc(o.summary)}</p>
    </div>
    <div class="grid-products" style="margin-block-start:2rem">
      ${list.map((p, i) => card(p, { eager: i < 4 })).join('\n      ')}
    </div>
  </div>
</section>

<section class="collection" style="background:var(--bg-soft)">
  <div class="shell">
    <div class="collection__head"><span class="eyebrow">Or look by</span></div>
    ${occasionRow(occasions, o.slug)}
  </div>
</section>
`;
}

export function all({ pieces, occasions }) {
  return `
<section class="collection">
  <div class="shell">
    <div class="collection__head">
      <h1>Every piece</h1>
      <p class="lede" style="margin-block-start:.5rem">
        ${pieces.length} pieces, all made to order. Each one carries the names,
        the dates or the words you choose.
      </p>
    </div>

    <div class="filters" data-filters style="margin-block-start:1.25rem;justify-content:center">
      <button class="filter" type="button" data-filter="all" aria-pressed="true">All</button>
      ${occasions.map((o) => `<button class="filter" type="button" data-filter="${esc(o.slug)}" aria-pressed="false">${esc(o.name)}</button>`).join('\n      ')}
    </div>

    <div class="grid-products" data-product-list style="margin-block-start:1.5rem">
      ${pieces.map((p, i) => card(p, { eager: i < 4 })).join('\n      ')}
    </div>
    <p class="lede" data-no-results hidden style="margin-block-start:2rem">Nothing in that occasion yet.</p>
  </div>
</section>
`;
}

export function piece({ p, all: everything, shop, occasions }) {
  const here = occasions.find((o) => o.slug === p.occasion);
  const related = everything.filter((x) => x.slug !== p.slug && x.occasion === p.occasion).slice(0, 4);
  return `
<section class="product shell">
  <div class="product__gallery">
    ${(p.photos || []).length > 1 ? `
    <div class="gallery" data-gallery>
      <div class="gallery__track" data-gallery-track>
        ${p.photos.map((n, i) => `<div class="frame gallery__slide">${picture({
          dir: `cathelier/${p.photoFolder}`, name: n, widths: [200, 400],
          alt: `${esc(p.name)} — photograph ${i + 1}`,
          sizes: '(min-width: 64rem) 560px, 100vw',
          loading: i === 0 ? 'eager' : 'lazy',
        })}</div>`).join('\n        ')}
      </div>
      <button class="gallery__arrow gallery__arrow--prev" type="button" data-gallery-prev aria-label="Previous photograph">${icon('arrowLeft', 20)}</button>
      <button class="gallery__arrow gallery__arrow--next" type="button" data-gallery-next aria-label="Next photograph">${icon('arrowRight', 20)}</button>
    </div>
    <div class="gallery__thumbs" role="tablist" aria-label="Photographs">
      ${p.photos.map((n, i) => `<button class="frame gallery__thumb" type="button" role="tab"
        data-gallery-go="${i}" aria-selected="${i === 0}" aria-label="Photograph ${i + 1}">
        ${picture({ dir: `cathelier/${p.photoFolder}`, name: n, alt: '', sizes: '84px', widths: [200] })}
      </button>`).join('\n      ')}
    </div>` : frame(p, '(min-width: 64rem) 560px, 100vw', true)}
  </div>

  <div class="product__detail">
    <h1>${esc(p.name)}</h1>
    <p class="product__price">from ${money(p.price)}</p>
    <p class="product__lead">${esc(shop.lead.toOrder)}</p>

    <form class="product__form" data-product-form data-product-id="${esc(p.slug)}">
      ${(p.options || []).map((o) => `<div class="field">
        <label for="opt-${esc(o.id)}">${esc(o.name)}</label>
        ${o.help ? `<p class="field__help">${esc(o.help)}</p>` : ''}
        <textarea id="opt-${esc(o.id)}" rows="3" maxlength="${o.max || 80}"
                  data-option="${esc(o.id)}" placeholder="Names, a date, a short phrase"></textarea>
      </div>`).join('\n      ')}

      <div class="product__buy">
        <div class="qty" data-qty>
          <button class="qty__btn" type="button" data-qty-down aria-label="One fewer">${icon('minus', 16)}</button>
          <input class="qty__input" type="number" name="quantity" value="1" min="1" max="200" inputmode="numeric" aria-label="Quantity">
          <button class="qty__btn" type="button" data-qty-up aria-label="One more">${icon('plus', 16)}</button>
        </div>
        <button class="btn btn--wide" type="button" data-add>Add to basket</button>
      </div>
    </form>

    <div class="reassure">
      ${[['shield', 'A drawing to approve before anything is cut'],
         ['hand', 'Cut, sanded and finished by hand'],
         ['truck', 'Shipped across Europe'],
         ['leaf', 'Wood from responsibly managed forests']]
        .map(([i, t]) => `<p>${icon(i, 18)}<span>${esc(t)}</span></p>`).join('\n      ')}
    </div>

    <div class="product__text stack" style="--stack:1rem">${prose(p.text)}</div>

    <p class="small muted" style="margin-block-start:1.25rem">
      Ordering a lot of them? <a href="/cathelier/quote/">Ask for a quote</a> and we will
      price the whole run.
    </p>
  </div>
</section>

${related.length ? `<section class="collection" style="background:var(--bg-soft)">
  <div class="shell">
    <div class="collection__head"><span class="eyebrow">More for</span><h2>${esc(here?.name || 'the same day')}</h2></div>
    <div class="grid-products" style="margin-block-start:2rem">${related.map((x) => card(x)).join('\n      ')}</div>
  </div>
</section>` : ''}
`;
}
