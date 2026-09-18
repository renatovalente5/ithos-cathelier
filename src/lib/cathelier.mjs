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
function frame(p, sizes, eager = false, noCartao = false) {
  // `card__frame` é o que liga a troca lenta de fotografia; a moldura da FICHA
  // do produto usa a mesma função e não a leva.
  const cls = noCartao ? 'frame card__frame' : 'frame';
  if (!p.photos?.length || !p.photoFolder) {
    return `<div class="${cls} awaiting"><span>${esc(p.name)}</span></div>`;
  }
  return `<div class="${cls}">${picture({
    dir: `cathelier/${p.photoFolder}`, name: p.cover || p.photos[0],
    alt: `${p.name} — laser cut and engraved to order`,
    // Only the widths that exist. The stand-in photographs are 360px wide, so
    // offering a 1000w candidate would be a promise the file cannot keep.
    widths: [200, 400],
    sizes, loading: eager ? 'eager' : 'lazy',
  })}</div>`;
}

/* O CARTÃO DA CATHELIER PASSOU A SER O CARTÃO DA ITHOS.
   A dona pediu aqui o que já lá está: as outras fotografias da peça por baixo
   da grande, para escolher, e a passagem lenta de uma para a outra enquanto o
   ponteiro descansa. Todas as 41 peças têm exactamente duas fotografias, e a
   pasta partilhada tem as larguras de 120 e 200 que a tira pede.

   O trabalho todo já estava feito e era partilhado: o CSS da troca de camadas
   e das miniaturas vive em shop.css sem marca nenhuma, e o cards() do shop.js
   pega em qualquer `[data-shots]`. O que faltava era a FORMA do cartão.

   E A LIGAÇÃO TEVE DE SER PARTIDA EM DUAS, como lá. O cartão era um <a> à
   volta de tudo, e o HTML proíbe um <button> dentro de uma ligação: as
   miniaturas não tinham onde ficar. Agora a fotografia leva a sua própria
   ligação, `aria-hidden` e fora da ordem de tabulação, e a ligação a sério é o
   nome -- um cartão, uma ligação, um nome. */
export function card(p, { eager = false } = {}) {
  const tags = [p.occasion, ...(p.alsoIn || [])].join(' ');
  const shots = [p.cover, ...(p.photos || []).filter((n) => n !== p.cover)].filter(Boolean);
  const temFotos = Boolean(p.photoFolder && shots.length);
  const href = `/cathelier/pieces/${esc(p.slug)}/`;
  /* Os botões vão VAZIOS e é o script que lhes põe a fotografia dentro, a
     partir de `data-shots` e `data-dir`. Com um <img loading="lazy"> escrito
     aqui, o telemóvel ia buscá-los todos na mesma, escondidos ou não. */
  const thumb = (name, n) => `<button class="card__thumb${n === 0 ? ' is-on' : ''}" type="button"
        data-thumb="${n}" aria-pressed="${n === 0 ? 'true' : 'false'}" tabindex="${n === 0 ? '0' : '-1'}"
        aria-label="Photograph ${n + 1} of ${shots.length}"></button>`;

  return `<article class="card" data-product="${esc(p.slug)}" data-family="${esc(tags)}"
  data-price="${p.price}"${p.added ? ` data-added="${esc(p.added)}"` : ''}${temFotos
    ? `
  data-shots="${esc(shots.join(','))}" data-dir="cathelier/${esc(p.photoFolder)}"` : ''}>
  <a class="card__media" href="${href}" tabindex="-1" aria-hidden="true">
    ${frame(p, '(min-width: 64rem) 280px, (min-width: 48rem) 30vw, 46vw', eager, true)}
  </a>
  ${shots.length > 1
    ? `<div class="card__thumbs" role="group" aria-label="${esc(p.name)} — ${shots.length} photographs">
    ${shots.map(thumb).join('\n    ')}
  </div>`
    : '<div class="card__thumbs card__thumbs--none" aria-hidden="true"></div>'}
  <h3 class="card__name"><a class="card__link" href="${href}">${esc(p.name)}</a></h3>
  <p class="card__price">from ${money(p.price)}</p>
</article>`;
}

/* OS CIRCULOS NAO SAO UM MENU DE PAGINAS, SAO UM ATALHO PARA UM FILTRO.
   Cada ocasiao tinha a sua propria pagina; o filtro de /cathelier/pieces/
   reproduz EXACTAMENTE a mesma lista (mesmo predicado, mesmas contagens), por
   isso a pagina era uma segunda morada para o mesmo conteudo. O fragmento e a
   forma combinada: nao precisa de servidor, sobrevive ao GitHub Pages e o
   filters() do shop.js le-o ao arrancar. Quem muda isto aqui tem de mudar la,
   e a guarda em guards.mjs recusa um atalho que nao case com nenhum chip. */
function occasionRow(occasions) {
  return `<nav class="occasions" aria-label="Occasions">
  ${occasions.map((o) => `<a class="occasion" href="/cathelier/pieces/#${esc(o.slug)}"${o.summary ? ` title="${esc(o.summary)}"` : ''}>
    <span class="occasion__badge">${occasionArt(o.slug, 30)}</span>
    <span class="occasion__name">${esc(o.name)}</span>
  </a>`).join('\n  ')}
</nav>`;
}



export function home({ occasions, pieces, cover: coverText, coverArt }) {
  /* OITO CARTOES, UM POR OCASIAO, E SEM DUAS FOTOGRAFIAS IGUAIS.
     Oito porque a grelha e de 2 colunas abaixo de 48rem, 3 acima e 4 a partir
     de 90rem, e oito fecha a fila nas tres larguras.
     Um por ocasiao porque a fila de circulos esta mesmo por cima: a grelha
     mostra o que cada circulo promete, pela mesma ordem.
     E sem repetir fotografia porque nenhuma das 41 pecas foi fotografada
     ainda -- partilham uma pasta comum de amostras, e as oito primeiras da
     lista traziam a MESMA imagem tres vezes, duas delas lado a lado, na
     pagina mais vista da marca. O dia em que houver fotografias a serio isto
     continua a servir, sem se lhe tocar.
     A contagem do botao sai de `pieces.length` e nunca de um numero escrito a
     mao: assim a home nao passa a mentir quando a dona publicar mais uma. */
  const retrato = (x) => (x.photoFolder && (x.cover || x.photos?.[0])
    ? `${x.photoFolder}/${x.cover || x.photos[0]}` : `sem-fotografia:${x.slug}`);
  const mostra = [];
  const usadas = new Set();
  const cabe = (x) => mostra.length < 8 && !mostra.includes(x) && !usadas.has(retrato(x));
  const junta = (x) => { if (x) { mostra.push(x); usadas.add(retrato(x)); } };
  for (const o of occasions) {
    junta(pieces.find((x) => cabe(x) && (x.occasion === o.slug || (x.alsoIn || []).includes(o.slug))));
  }
  for (const x of pieces) if (cabe(x)) junta(x);   // ocasiões a menos, ou fotografias repetidas a mais

  return `
${cover(coverText, 'cathelier', coverArt)}

<section class="occasions-lead">
  <div class="shell">
    ${occasionRow(occasions)}
  </div>
</section>

<section class="collection collection--alt">
  <div class="shell">
    <div class="collection__head">
      <h2>Made to order</h2>
      <p>Cake toppers, signs, trophies, bookmarks, boxes, keyrings. ${pieces.length}
         pieces in all, and every one of them takes a name.</p>
    </div>
    <div class="grid-products" style="margin-block-start:2rem">
      ${mostra.map((p, i) => card(p, { eager: i < 3 })).join('\n      ')}
    </div>
    <p style="text-align:center;margin-block-start:2.5rem">
      <a class="btn btn--ghost" href="/cathelier/pieces/">See all ${pieces.length} pieces</a>
    </p>
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
    <!-- The heading names the occasion and LINKS to it: to the full list,
         filtered, which is now the only place an occasion lives. It used to be
         flat text with four sibling cards under it and no way through to the
         thing it was naming -- a dead end on every one of the 41 pieces. -->
    <div class="collection__head">
      <span class="eyebrow">More for</span>
      ${here ? `<h2><a href="/cathelier/pieces/#${esc(here.slug)}">${esc(here.name)}</a></h2>`
             : '<h2>the same day</h2>'}
    </div>
    <div class="grid-products" style="margin-block-start:2rem">${related.map((x) => card(x)).join('\n      ')}</div>
  </div>
</section>` : ''}
`;
}
