import { esc, money, picture, prose, wholePicture } from './html.mjs';
import { shapeOf, rungs, cardFocus } from './photo.mjs';
import { viewer } from './viewer.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PHOTOS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'photos');
import { icon } from './icons.mjs';
import { occasionArt } from './occasions-art.mjs';
import { cover } from './cover.mjs';

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
  return `<article class="card" data-product="${esc(p.slug)}" data-family="${esc(tags)}"
  data-price="${p.price}"${p.added ? ` data-added="${esc(p.added)}"` : ''}>
  <a class="card__link" href="/cathelier/pieces/${esc(p.slug)}/">
    ${frame(p, '(min-width: 64rem) 280px, (min-width: 48rem) 30vw, 46vw', eager)}
    <h3 class="card__name">${esc(p.name)}</h3>
    <p class="card__price">from ${money(p.price)}</p>
  </a>
</article>`;
}

function occasionRow(occasions, current) {
  return `<nav class="occasions" aria-label="Occasions">
  ${occasions.map((o) => `<a class="occasion" href="/cathelier/${esc(o.slug)}/"${o.slug === current ? ' aria-current="page"' : ''}>
    <span class="occasion__badge">${occasionArt(o.slug, 30)}</span>
    <span class="occasion__name">${esc(o.name)}</span>
  </a>`).join('\n  ')}
</nav>`;
}


const ASK = [
  ['shield', 'Will I see it before it is cut?',
   `<p>Always. We draw it, send you a picture of the drawing, and nothing goes near
     the laser until you have said yes. If a letter is wrong, it is wrong on a
     screen and not in wood.</p>`],
  ['truck', 'How long does it take?',
   `<p>Around three weeks in the workshop from the moment you approve the drawing,
     and a few days to reach you. If you have a date, tell us — we work backwards
     from it.</p>`],
  ['hand', 'Can I order a hundred of them?',
   `<p>Yes, and it is priced differently from one.
     <a href="/cathelier/quote/">Ask for a quote</a> and say roughly how many and
     what for.</p>`],
  ['leaf', 'What is it made of?',
   `<p>Birch plywood or solid wood, depending on the piece, from responsibly
     managed forests. Cut, engraved, and finished by hand.</p>`],
  ['pin', 'Can I change my mind?',
   `<p>Not once we have started, and the reason is that it has your names on it —
     it cannot go to anybody else. That is the exception in article 17(c) of
     Decree-Law 24/2014. It is exactly why we send the drawing first.</p>`],
  ['mail', 'Something is wrong with mine.',
   `<p>Write to us with a photograph and we will put it right. Everything carries a
     three-year guarantee, and a mistake of ours is remade at our cost.</p>`],
];

export function home({ occasions, pieces, cover: coverText, coverArt }) {
  const newest = [...pieces].sort((a, b) => (b.order ?? 0) - (a.order ?? 0)).slice(0, 8);
  const feature = occasions.find((o) => o.slug === 'keepsakes') ?? occasions[0];
  const featurePieces = pieces.filter((p) => p.occasion === feature.slug
    || (p.alsoIn || []).includes(feature.slug)).slice(0, 4);

  const shot = (name, ratio) => `<div class="frame"${ratio ? ` style="aspect-ratio:${ratio}"` : ''}>${picture({
    dir: 'cathelier/pool', name, widths: [200, 400], alt: '',
    sizes: '(min-width: 56rem) 33vw, 50vw',
  })}</div>`;

  return `
${cover(coverText, 'cathelier', coverArt)}

<section class="feature">
  <div class="shell">
    <div class="collection__head" style="margin-block-end:1.5rem">
      <span class="eyebrow">Featured collection</span>
      <h2>${esc(feature.name)}</h2>
    </div>
    <div class="feature__row">
      <div class="feature__text">
        <p>${esc(feature.summary)}</p>
        <p>Made to hold a day still: the names of the people who were there, the date
           it happened, and the small drawing that belongs to it. Each one is cut,
           engraved and finished by hand, and each one is different because the
           words are.</p>
        <p>Tell us what it has to say and we will draw it first.</p>
        <a class="btn" href="/cathelier/${esc(feature.slug)}/">See the collection</a>
      </div>
      <div class="feature__art">
        ${shot('03', '16 / 9')}${shot('09')}${shot('02')}${shot('07')}
      </div>
    </div>
  </div>
</section>

<section class="collection collection--alt">
  <div class="shell">
    <div class="grid-products">${featurePieces.map((p) => card(p)).join('\n      ')}</div>
  </div>
</section>

<section class="collection">
  <div class="shell">
    <div class="collection__head"><h2>New in the workshop</h2></div>
    <div class="grid-products" style="margin-block-start:2rem">
      ${newest.map((p) => card(p)).join('\n      ')}
    </div>
    <p style="text-align:center;margin-block-start:2.5rem">
      <a class="btn btn--ghost" href="/cathelier/pieces/">See all ${pieces.length} pieces</a>
    </p>
  </div>
</section>

<section class="feature" style="background:var(--bg-soft)">
  <div class="shell">
    <div class="feature__row feature--flip">
      <div class="feature__text">
        <h2>Nothing is cut before you say yes</h2>
        <p>Tell us the names, the dates or the words. We draw it and send you the
           drawing. Only when you have looked at it and said yes does anything go
           on the laser.</p>
        <p>It is the whole reason people trust us with a christening or a wedding:
           there is no version of this where you open the box and find a name
           spelled wrong.</p>
        <a class="btn" href="/cathelier/quote/">Ask for a quote</a>
      </div>
      <div class="feature__art">
        ${shot('05', '16 / 9')}${shot('08')}${shot('11')}${shot('12')}
      </div>
    </div>
  </div>
</section>

<section class="ask">
  <div class="shell">
    <div class="collection__head"><h2>Need a hand?</h2></div>
    <div class="ask__grid">
      ${ASK.map(([ic, q, a]) => `<details class="ask__item">
        <summary>${icon(ic, 18)}<span>${esc(q)}</span></summary>
        <div>${a}</div>
      </details>`).join('\n      ')}
    </div>
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
  /* The same as ithos: the frame takes the shape of this piece's tallest
     photograph instead of a square, because a square crop of a 361x640
     Instagram still throws away 44% of it. */
  /* The masters live in photos/cathelier/_raw; `pool` is the name the SQUARE
     family and the site addresses use. The two have never been the same word
     and this is the one place that has to know it. */
  const shapes = (p.photos || []).map((n) => shapeOf(join(PHOTOS, 'cathelier', '_raw', `${n}.jpg`)));
  const here = occasions.find((o) => o.slug === p.occasion);
  const related = everything.filter((x) => x.slug !== p.slug && x.occasion === p.occasion).slice(0, 4);
  return `
<section class="product shell">
  <div class="product__gallery">
    ${(p.photos || []).length > 1 ? `
    <div class="gallery" data-gallery>
      <div class="gallery__track" data-gallery-track>
        ${p.photos.map((n, i) => `<div class="gallery__slide" style="--focus:${cardFocus(`cathelier/${p.photoFolder}/${n}`, shapes[i])}">${wholePicture({
          key: `cathelier/${p.photoFolder}/${n}`, shape: shapes[i], widths: rungs(shapes[i].w),
          alt: `${esc(p.name)} — photograph ${i + 1}`,
          sizes: '(min-width: 64rem) 560px, 100vw',
          loading: i === 0 ? 'eager' : 'lazy',
        })}</div>`).join('\n        ')}
      </div>
      <button class="gallery__open" type="button" data-box-open aria-label="See this photograph full size">${icon('search', 18)}</button>
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
      <p class="field__help" style="margin-block-end:.25rem">
        Fill these in and we will send you a drawing to approve. Nothing is cut
        before you say yes.
      </p>
      ${(p.options || []).map((o) => `<div class="field">
        <label for="opt-${esc(o.id)}">${esc(o.name)}${o.required ? ' <span class="field__req">required</span>' : ''}</label>
        <input id="opt-${esc(o.id)}" type="text" maxlength="${o.max || 60}"
               data-option="${esc(o.id)}"${o.required ? ' required' : ''}
               placeholder="${esc(o.example || '')}">
        <p class="field__limit">Up to ${o.max || 60} characters.</p>
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

${viewer()}

${related.length ? `<section class="collection" style="background:var(--bg-soft)">
  <div class="shell">
    <!-- The heading names the occasion and now LINKS to it. It used to be flat
         text with four sibling cards under it and no way through to the page it
         was naming — a dead end on every one of the 41 pieces. -->
    <div class="collection__head">
      <span class="eyebrow">More for</span>
      ${here ? `<h2><a href="/cathelier/${esc(here.slug)}/">${esc(here.name)}</a></h2>`
             : '<h2>the same day</h2>'}
    </div>
    <div class="grid-products" style="margin-block-start:2rem">${related.map((x) => card(x)).join('\n      ')}</div>
  </div>
</section>` : ''}
`;
}
