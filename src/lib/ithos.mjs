import { esc, money, picture, prose, wholePicture } from './html.mjs';
import { shapeOf, rungs, cardFocus, cardWidths } from './photo.mjs';
import { viewer } from './viewer.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PHOTOS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'photos');
import { icon } from './icons.mjs';
import { cover } from './cover.mjs';
import { prazos } from './prazos.mjs';
import { t, tn } from './i18n.mjs';
import { fabricante } from './pages.mjs';

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

/* Os rótulos são CHAVES de tradução (src/i18n/<língua>/ithos.json), lidas ao
   desenhar: esta tabela é avaliada ao importar, antes de o gerador escolher a
   língua. */
const FILTERS = [
  ['all', 'filtro.todos'], ['animals', 'filtro.animais'], ['vehicles', 'filtro.veiculos'],
  ['nature', 'filtro.natureza'], ['festive', 'filtro.festivos'],
];

/** The lowest price this lamp can actually be bought for. A card that says a
 *  price the product page cannot honour is a lie the shop tells on the way in;
 *  it happened once, with an option pre-ticked that carried a surcharge. */
export function fromPrice(p) {
  /* Only values you can actually buy count towards the price on the card.
     A surcharged option that is out of stock must not make the card say
     "from" a number nobody can reach today -- and an option that is out of
     stock must not lower the floor either. The card's price has to be
     obtainable, which this shop has been caught on once before. */
  const haveable = (o) => {
    const on = o.values.filter((v) => v.available !== false);
    return on.length ? on : o.values;
  };
  const required = (p.options || []).filter((o) => o.type === 'choice' && o.required);
  const cheapest = required.reduce((sum, o) => sum + Math.min(...haveable(o).map((v) => v.extra || 0)), 0);
  const dearest = required.reduce((sum, o) => sum + Math.max(...haveable(o).map((v) => v.extra || 0)), 0);
  return { low: p.price + cheapest, high: p.price + dearest };
}

export function card(p, { eager = false } = {}) {
  const { low, high } = fromPrice(p);
  const range = high > low;
  const fams = familiesOf(p.slug).join(' ');

  /* A SWATCH ONLY WHERE THERE IS A COLOUR TO SHOW.
     This row used to draw one square per variant, with nothing in it: no
     colour, no picture, and -- because a <span> is inline and width does not
     apply to one -- no size either. Three marks of nothing under the mushroom,
     which is what the owner photographed and asked about.
     And most variants are not colours at all: of the three lamps that have
     them, two are sizes ("Large 25x22", "30x65 cm"). A size painted as a
     coloured square says nothing. So the colour is now a field on the value,
     the square is drawn only when it is filled in, and a variant that is a
     size simply has no row. */
  const swatches = (p.options || []).find((o) => o.id === 'variant');
  const coloured = (swatches?.values || []).filter((v) => v.colour);
  const dots = coloured.length
    ? `<div class="card__swatches" aria-hidden="true">${coloured.slice(0, 6)
        .map((v) => `<span class="swatch" style="background:${esc(v.colour)}" title="${esc(v.name)}"></span>`).join('')}</div>`
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
  /* AS LARGURAS QUE TODAS AS FOTOGRAFIAS TÊM, e não só a capa. O script da
     troca clona o <picture> da capa e muda-lhe só o nome: o srcset fica com a
     escada da capa. Uma fotografia pequena ao lado de uma capa grande (as do
     Instagram têm 414 px, e renditions.py não escreve um -1000 maior do que o
     master) pedia um ficheiro que não existe, e a moldura ficava em branco no
     clique, em ecrã retina. Com a intersecção, a capa perde o degrau de cima
     nesse candeeiro -- menos nítida num ecrã grande, mas nunca em branco.
     Todas têm o 200 (as guardas exigem-no); se um dia a intersecção ficasse
     vazia, picture() voltava à escada da capa. */
  const widths = shots.map((n) => cardWidths(dir, n))
    .reduce((comum, ws) => comum.filter((w) => ws.includes(w)));

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
        aria-label="${esc(t('ithos.cartao.fotoDe', { n: n + 1, total: shots.length }))}"></button>`;

  /* data-price is the price the card SHOWS -- the lowest this lamp can actually
     be bought for, not p.price. Sorting by anything else would reorder the
     grid by a number the reader cannot see. */
  return `<article class="card" data-product="${esc(p.slug)}" data-family="${esc(fams)}"
  data-price="${low}"${p.added ? ` data-added="${esc(p.added)}"` : ''}
  data-shots="${esc(shots.join(','))}" data-dir="${esc(dir)}">
  <a class="card__media" href="${href}" tabindex="-1" aria-hidden="true">
    <div class="frame card__frame">
      ${picture({
        dir, name: p.cover, widths,
        alt: t('ithos.cartao.alt', { nome: p.name }),
        sizes: '(min-width: 90rem) 340px, (min-width: 64rem) 30vw, (min-width: 48rem) 30vw, 46vw',
        loading: eager ? 'eager' : 'lazy',
        fetchpriority: eager ? 'high' : undefined,
      })}
    </div>
  </a>
  ${shots.length > 1
    ? `<div class="card__thumbs" role="group" aria-label="${esc(t('ithos.cartao.fotografias', { nome: p.name, n: shots.length }))}">
    ${shots.map(thumb).join('\n    ')}
  </div>`
    : '<div class="card__thumbs card__thumbs--none" aria-hidden="true"></div>'}
  ${dots}
  <h3 class="card__name"><a class="card__link" href="${href}">${esc(p.name)}</a></h3>
  <p class="card__price">${range ? `<span class="card__from">${esc(t('ithos.cartao.desde'))} </span>` : ''}${money(low)}</p>
</article>`;
}

export function home({ products, identity, cover: coverText, coverArt }) {
  /* "Bestsellers" and not "Favourites", at the owner's request. Worth knowing
     what changed with the word: a favourite is the shop's own opinion and owes
     nobody evidence, while a bestseller is a claim about what actually sells.
     The lamps under it are whatever is marked featured in the back office, so
     keeping the heading honest means keeping that list matched to real sales.
     (This note lives here and not in the markup: an HTML comment inside the
     template would ship to every visitor who opens the source.) */
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const rest = products.filter((p) => !p.featured).slice(0, 8);

  return `
${cover(coverText, 'ithos', coverArt)}

<section class="section">
  <div class="shell">
    <div class="section__head"><h2>${esc(t('ithos.inicio.maisVendidos'))}</h2></div>
    <div class="grid-products">
      ${featured.map((p, i) => card(p, { eager: i < 4 })).join('\n      ')}
    </div>
  </div>
</section>

<section class="section section--soft">
  <div class="shell">
    <div class="maker">
      <div class="maker__text">
        <h2>${esc(t('ithos.inicio.ola'))}</h2>
        <p>${esc(t('ithos.inicio.apresentacao'))}</p>
        <p>${esc(t('ithos.inicio.convite'))}</p>
        <p class="maker__sign">Cathia</p>
      </div>
      <div class="frame maker__photo">
        ${picture({
          dir: `ithos/${(products.find((x) => x.slug === 'sheep') ?? products[0]).photoFolder}`,
          name: (products.find((x) => x.slug === 'sheep') ?? products[0]).cover,
          alt: t('ithos.inicio.fotoOficina'),
          sizes: '(min-width: 56rem) 45vw, 100vw',
        })}
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="shell">
    <div class="section__head"><h2>${esc(t('ithos.inicio.maisDaOficina'))}</h2></div>
    <div class="grid-products">
      ${rest.map((p) => card(p)).join('\n      ')}
    </div>
    <p style="text-align:center;margin-block-start:2.5rem">
      <a class="btn btn--ghost" href="/lamps/">${esc(t('ithos.inicio.verTodos', { n: products.length }))}</a>
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
    <h1>${esc(t('ithos.catalogo.titulo'))}</h1>
    <p class="lede measure" style="margin-block-start:.5rem">
      ${esc(t('ithos.catalogo.lede', { n: products.length, min: money(Math.min(...prices)), max: money(Math.max(...prices)) }))}
    </p>

    <div class="filters" data-filters style="margin-block-start:1.25rem">
      ${FILTERS.map(([id, chave], i) =>
        `<button class="filter" type="button" data-filter="${id}" aria-pressed="${i === 0}">${esc(t(`ithos.${chave}`))}</button>`).join('\n      ')}
    </div>

    <div class="grid-products" data-product-list style="margin-block-start:1.5rem">
      ${products.map((p, i) => card(p, { eager: i < 4 })).join('\n      ')}
    </div>
    <p class="lede" data-no-results hidden style="margin-block-start:2rem">${esc(t('ithos.catalogo.semResultados'))}</p>
  </div>
</section>
`;
}

export function product({ p, all, shop, identity }) {
  const { low, high } = fromPrice(p);
  const photos = p.photos;
  const dir = `ithos/${p.photoFolder}`;

  /* THE FRAME TAKES THE SHAPE OF THIS LAMP'S TALLEST PHOTOGRAPH.
   *
   * Not square -- a square frame is what cut Santa's hat off, and it would
   * band every portrait photograph by 17% a side if the crop were simply
   * removed. Not per slide either: the slides of one product have to share a
   * box or the carousel changes height as you move through it.
   *
   * So: the narrowest ratio across this lamp's own photographs, written once
   * as a custom property. Measured over the 26 lamps, 14 then have no band at
   * all on any photograph and the median worst band is half a percent. The
   * three that band badly all mix one near-square lifestyle shot with portrait
   * studio shots, and there the band is the cream the cards already sit on --
   * a mat, not a failed attempt to match the photograph. A sampled ground
   * colour was measured and rejected: against each photograph's own edge it is
   * off by 18 levels at the median and 117 at the upper quartile, so it would
   * draw a seam instead of hiding one. */
  const shapes = photos.map((n) => shapeOf(join(PHOTOS, dir, `${n}.jpg`)));
  const related = all.filter((x) => x.slug !== p.slug)
    .filter((x) => familiesOf(x.slug).some((f) => familiesOf(p.slug).includes(f)))
    .slice(0, 4);
  const size = p.size || {};
  const dims = [
    size.height && t('ithos.medida.altura', { n: size.height }),
    size.width && t('ithos.medida.largura', { n: size.width }),
    size.length && t('ithos.medida.comprimento', { n: size.length }),
    size.depth && t('ithos.medida.profundidade', { n: size.depth }),
  ].filter(Boolean).join(' · ');

  return `
<section class="product shell">
  <div class="product__gallery">
    <div class="gallery" data-gallery>
      <div class="gallery__track" data-gallery-track>
        ${photos.map((n, i) => `<div class="gallery__slide" data-index="${i}" style="--focus:${cardFocus(`${dir}/${n}`, shapes[i])}">
          ${wholePicture({ key: `${dir}/${n}`, shape: shapes[i],
            alt: t('ithos.ficha.fotoAlt', { nome: p.name, n: i + 1 }),
            widths: rungs(shapes[i].w),
            sizes: '(min-width: 64rem) 560px, 100vw',
            loading: i === 0 ? 'eager' : 'lazy', fetchpriority: i === 0 ? 'high' : undefined })}
        </div>`).join('\n        ')}
      </div>
      <button class="gallery__open" type="button" data-box-open aria-label="${esc(t('ithos.ficha.ampliar'))}">${icon('search', 18)}</button>
      ${photos.length > 1 ? `
      <button class="gallery__arrow gallery__arrow--prev" type="button" data-gallery-prev aria-label="${esc(t('ithos.ficha.anterior'))}">${icon('arrowLeft', 20)}</button>
      <button class="gallery__arrow gallery__arrow--next" type="button" data-gallery-next aria-label="${esc(t('ithos.ficha.seguinte'))}">${icon('arrowRight', 20)}</button>` : ''}
    </div>
    ${photos.length > 1 ? `<div class="gallery__thumbs" role="tablist" aria-label="${esc(t('ithos.ficha.fotografias'))}">
      ${photos.map((n, i) => `<button class="frame gallery__thumb" type="button" role="tab"
        data-gallery-go="${i}" aria-selected="${i === 0}" aria-label="${esc(t('ithos.ficha.foto', { n: i + 1 }))}">
        ${picture({ dir, name: n, alt: '', sizes: '84px', widths: [200, 400] })}
      </button>`).join('\n      ')}
    </div>` : ''}
  </div>

  <div class="product__detail">
    <h1>${esc(p.name)}</h1>
    <p class="product__price">${high > low ? `${money(low)} – ${money(high)}` : money(low)}</p>
    <p class="product__blurb">${esc(p.summary)}</p>
    <!-- O PRAZO DEPENDE DO STOCK, e o stock só o Worker sabe. A página nasce a
         dizer o caso mais lento, que é verdade para qualquer candeeiro; o script
         pergunta ao Worker e troca pela frase certa para o modelo escolhido.
         Com o script a correr, a frase fica invisível (sem ocupar outro sítio)
         até à resposta, para não se ler «Out of stock» e logo a seguir «In
         stock». Ver stockNaFicha em src/js/shop.js. -->
    <p class="product__lead" data-lead
       data-lead-stock="${esc(prazos(shop.lead).stock)}"
       data-lead-none="${esc(prazos(shop.lead).semStock)}"
       data-lead-days="${esc(prazos(shop.lead).dias)}">${icon('truck', 15)}<span data-lead-text>${esc(prazos(shop.lead).semStock)}</span></p>

    <form class="product__form" data-product-form data-product-id="${esc(p.slug)}">
      ${(p.options || []).map((o) => optionField(o, shop.returns.coolingOffDays)).join('\n      ')}

      <div class="product__buy">
        <div class="qty" data-qty>
          <button class="qty__btn" type="button" data-qty-down aria-label="${esc(t('ithos.quantidade.menos'))}">${icon('minus', 16)}</button>
          <input class="qty__input" type="number" name="quantity" value="1" min="1" max="20"
                 inputmode="numeric" aria-label="${esc(t('ithos.quantidade.rotulo'))}">
          <button class="qty__btn" type="button" data-qty-up aria-label="${esc(t('ithos.quantidade.mais'))}">${icon('plus', 16)}</button>
        </div>
        <button class="btn btn--wide" type="submit" data-add>${esc(t('ithos.botao.adicionar'))}</button>
      </div>
    </form>

    <div class="reassure">
      ${/* Aqui havia uma FOLHA ao lado de «Pinho maciço e tintas de base
          aquosa». O texto é concreto e pode ficar, desde que seja verdade; a
          folha não: uma folha, uma árvore ou uma gota junto de um produto
          lêem-se como selo ambiental (FAQ da Comissão sobre a Diretiva
          2024/825, P2 e P5), e um selo sem certificação é prática proibida
          (anexo I da Diretiva 2005/29, ponto 2-A). Ficou um desenho neutro. */ ''}${[['truck', t('ithos.garantias.envio')],
         ['layers', t('ithos.garantias.materiais')],
         ['shield', `${tn('ithos.garantias.anos', shop.returns.warrantyYears)} · ${tn('ithos.garantias.mudarDeIdeias', shop.returns.coolingOffDays)}`],
         ['hand', t('ithos.garantias.feitoAMao')]]
        .map(([i, texto]) => `<p>${icon(i, 18)}<span>${esc(texto)}</span></p>`).join('\n      ')}
    </div>
    <p class="product__rights"><a href="/legal/guarantee/">${esc(t('paginas.garantia.ligacao'))}</a></p>

    <div class="product__text stack" style="--stack:1rem">
      ${prose(p.text)}
      ${dims ? `<p class="small muted">${esc(dims)}</p>` : ''}
    </div>

    <details class="product__safety">
      <summary>${esc(t('ithos.ficha.cuidados'))}</summary>
      <ul>${(shop.safetyIthos || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </details>

    ${fabricante(identity)}
  </div>
</section>

${viewer()}

${related.length ? `<section class="section section--soft">
  <div class="shell">
    <div class="section__head"><h2>${esc(t('ithos.ficha.relacionados'))}</h2></div>
    <div class="grid-products">${related.map((x) => card(x)).join('\n      ')}</div>
  </div>
</section>` : ''}
`;
}

/* One field per option. The cheapest choice is pre-ticked, never the first:
   a first option carrying a surcharge made the card advertise a price the page
   then refused to honour. */
function optionField(o, diasDeResolucao) {
  if (o.type === 'text') {
    /* UMA GRAVAÇÃO TIRA OS CATORZE DIAS, e isso diz-se AQUI, junto da caixa
       onde se escreve o nome, e não só nas condições: é informação que a lei
       manda dar antes de o consumidor ficar vinculado (DL 24/2014, art. 4.º
       n.º 1 al. p)). Sai da marca «personalises» da opção, a mesma que o
       Worker lê para pôr a exceção na fatura. */
    const aviso = o.personalises
      ? `<p class="field__aviso" id="opt-${esc(o.id)}-aviso">${esc(t('paginas.aviso.personalizada', { n: diasDeResolucao }))}</p>` : '';
    return `<div class="field">
        <label for="opt-${esc(o.id)}">${esc(o.name)} <span class="field__optional">${esc(t('ithos.opcao.opcional'))}</span></label>
        ${o.help ? `<p class="field__help">${esc(o.help)} <span class="field__limit">${esc(t('ithos.opcao.limite', { n: o.max || 40 }))}</span></p>` : ''}
        <input id="opt-${esc(o.id)}" type="text" maxlength="${Number.isInteger(o.max) && o.max > 0 ? o.max : 40}"
               data-option="${esc(o.id)}" placeholder="${esc(t('ithos.opcao.exemplo'))}"${o.personalises ? ` aria-describedby="opt-${esc(o.id)}-aviso"` : ''}>
        ${aviso}
      </div>`;
  }
  /* THE TICKED ONE HAS TO BE ONE YOU CAN ACTUALLY BUY.
     It used to be the cheapest, full stop, which is the same family of bug as
     the one that once put a surcharged option on tick and made the card
     advertise 78 EUR for a product whose page opened at 89: the default has to
     be obtainable. An option that is out of stock is neither the default nor
     selectable, and it says why rather than just going grey. */
  const haveable = o.values.filter((v) => v.available !== false);
  const pool = haveable.length ? haveable : o.values;
  const cheapest = Math.min(...pool.map((v) => v.extra || 0));
  const chosen = pool.find((v) => (v.extra || 0) === cheapest) ?? pool[0];
  return `<fieldset class="field">
        <legend>${esc(o.name)}</legend>
        ${o.help ? `<p class="field__help">${esc(o.help)}</p>` : ''}
        <div class="choices">
          ${o.values.map((v) => {
    const off = v.available === false;
    return `<label class="choice${off ? ' choice--off' : ''}">
            <input type="radio" name="opt-${esc(o.id)}" value="${esc(v.id)}"
                   data-option="${esc(o.id)}"${v.id === chosen.id ? ' checked' : ''}${off ? ' disabled' : ''}>
            <span>${esc(v.name)}${v.extra ? ` <em>+${money(v.extra)}</em>` : ''}${
      off ? ` <em class="choice__off">${esc(v.note || t('ithos.opcao.indisponivel'))}</em>` : ''}</span>
          </label>`;
  }).join('\n          ')}
        </div>
      </fieldset>`;
}
