import { esc, picture, prose, wholePicture } from './html.mjs';
import { shapeOf, rungs, cardFocus } from './photo.mjs';
import { viewer } from './viewer.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PHOTOS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'photos');
import { icon } from './icons.mjs';
import { occasionArt } from './occasions-art.mjs';
import { cover } from './cover.mjs';
import { prazos } from './prazos.mjs';
import { t, tn } from './i18n.mjs';

/* As frases destas páginas estão em src/i18n/<língua>/cathelier.json e lêem-se
   com t() DENTRO das funções que desenham: o gerador escolhe a língua depois
   de importar este ficheiro, e uma frase lida ao importar ficava na língua de
   quem correu primeiro. */

/* O PREÇO: o número aqui, o símbolo no dicionário. O inglês escreve «€24,00»
   e o português «24,00 €», por isso a posição do € é da frase e não do
   número. A vírgula decimal é a de money() em html.mjs, que é quem manda. */
const valor = (n) => Number(n).toFixed(2).replace('.', ',');
const desde = (n) => esc(t('cathelier.desde', { preco: valor(n) }));

/* ===========================================================================
   cathelier — navigation by collection, which is how the model shop works and
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
    alt: t('cathelier.foto.alt', { nome: p.name }),
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
        aria-label="${esc(t('cathelier.cartao.foto', { i: n + 1, n: shots.length }))}"></button>`;

  return `<article class="card" data-product="${esc(p.slug)}" data-family="${esc(tags)}"
  data-price="${p.price}"${p.added ? ` data-added="${esc(p.added)}"` : ''}${temFotos
    ? `
  data-shots="${esc(shots.join(','))}" data-dir="cathelier/${esc(p.photoFolder)}"` : ''}>
  <a class="card__media" href="${href}" tabindex="-1" aria-hidden="true">
    ${frame(p, '(min-width: 64rem) 280px, (min-width: 48rem) 30vw, 46vw', eager, true)}
  </a>
  ${shots.length > 1
    ? `<div class="card__thumbs" role="group" aria-label="${esc(t('cathelier.cartao.fotos', { nome: p.name, n: shots.length }))}">
    ${shots.map(thumb).join('\n    ')}
  </div>`
    : '<div class="card__thumbs card__thumbs--none" aria-hidden="true"></div>'}
  <h3 class="card__name"><a class="card__link" href="${href}">${esc(p.name)}</a></h3>
  <p class="card__price">${desde(p.price)}</p>
</article>`;
}

/* OS CIRCULOS NAO SAO UM MENU DE PAGINAS, SAO UM ATALHO PARA UM FILTRO.
   Cada ocasiao tinha a sua propria pagina; o filtro de /cathelier/pieces/
   reproduz EXACTAMENTE a mesma lista (mesmo predicado, mesmas contagens), por
   isso a pagina era uma segunda morada para o mesmo conteudo. O fragmento e a
   forma combinada: nao precisa de servidor, sobrevive ao GitHub Pages e o
   filters() do shop.js le-o ao arrancar. Quem muda isto aqui tem de mudar la,
   e a guarda em guards.mjs recusa um atalho que nao case com nenhum chip. */
/* O «&» NUNCA FICA SOZINHO NUMA LINHA. Num círculo de 84px, «Magnets &
   keyrings» partia em «MAGNETS / & / KEYRINGS», com o sinal pendurado ao
   meio. Um espaço inquebrável antes dele cola-o à palavra da frente. Faz-se
   aqui e não nos dados: um carácter invisível no JSON é uma armadilha para
   quem o editar a seguir. */
const semAmpersandSolto = (nome) => esc(nome).replace(/ &amp; /g, '&nbsp;&amp; ');

function occasionRow(occasions) {
  /* «Browse» e não «Occasions»: desde 25 set 2026 os separadores são os da
     lista da dona, e Ímanes, Porta-chaves ou Decoração de parede não são
     ocasiões. */
  return `<nav class="occasions" aria-label="${esc(t('cathelier.separadores'))}">
  ${occasions.map((o) => `<a class="occasion" href="/cathelier/pieces/#${esc(o.slug)}"${o.summary ? ` title="${esc(o.summary)}"` : ''}>
    <span class="occasion__badge">${occasionArt(o.slug, 30)}</span>
    <span class="occasion__name">${semAmpersandSolto(o.name)}</span>
  </a>`).join('\n  ')}
</nav>`;
}



export function home({ occasions, pieces, cover: coverText, coverArt }) {
  /* AS MESMAS TRÊS SECÇÕES DA ITHOS, pela mesma ordem: as mais vendidas, um
     bloco de texto com fotografia ao lado, e o resto das peças com o botão
     para a lista inteira. O bloco do meio é que muda: lá é o "Hello" da
     oficina, aqui é o orçamento -- é isso que esta marca tem para dizer que a
     outra não tem, porque aqui as peças fazem-se em quantidade, com um nome
     diferente em cada uma.

     "Bestsellers" e não "Favourites", como na ithos e a pedido da dona: um
     favorito é uma opinião da loja e não deve nada a ninguém; um mais-vendido
     é uma afirmação sobre o que se vende mesmo. As peças que lá estão são as
     que ela marca no backoffice, e manter o título honesto é manter essa lista
     junto das vendas a sério. */
  const retrato = (x) => (x.photoFolder && (x.cover || x.photos?.[0])
    ? `${x.photoFolder}/${x.cover || x.photos[0]}` : `sem-fotografia:${x.slug}`);

  /* NOVE FOTOGRAFIAS DE AMOSTRA PARA QUARENTA E UMA PEÇAS.
     Nenhuma foi fotografada ainda: partilham uma pasta comum, e nela há nove
     imagens ao todo. Qualquer fila com mais de nove cartões repete alguma --
     isso é aritmética e não descuido. O que se pode evitar é o que doía: a
     MESMA imagem em dois cartões lado a lado, que foi como a dona a viu.
     Por isso não se corta a fila nem se deixa uma peça de fora; distribui-se
     uma volta por cada fotografia, à vez. Duas peças com a mesma imagem ficam
     tantos cartões afastadas quantas as imagens distintas houver -- a 2, 3 ou
     4 colunas nunca caem ao lado uma da outra. No dia em que cada peça tiver a
     sua fotografia isto deixa de fazer diferença nenhuma, sem se lhe tocar. */
  const espalhar = (lista, quantos) => {
    const grupos = new Map();
    for (const x of lista) {
      const k = retrato(x);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(x);
    }
    /* O GRUPO MAIS REPETIDO ENTRA PRIMEIRO EM CADA VOLTA.
       Sem esta ordenação a distância entre duas iguais é o que sobra da volta a
       contar da posição do grupo -- e com as seis mais vendidas o par caía nos
       índices 3 e 5, que a 2 colunas é uma mesmo por cima da outra. Pondo o
       grupo carregado à cabeça, a distância passa a ser o número de
       fotografias distintas (aqui cinco), e cinco é seguro a 2, a 3 e a 4
       colunas: nunca ficam lado a lado nem uma por baixo da outra. */
    const filas = [...grupos.values()].sort((a, b) => b.length - a.length);
    const saiu = [];
    for (let i = 0; saiu.length < quantos && filas.some((f) => f[i]); i++) {
      for (const f of filas) {
        if (saiu.length >= quantos) break;
        if (f[i]) saiu.push(f[i]);
      }
    }
    return saiu;
  };

  /* Oito e não seis: a grelha é de 2 colunas abaixo de 48rem, 3 acima e 4 a
     partir de 90rem, e oito fecha a fila nas três larguras. São menos, se a
     dona marcar menos. */
  const destaques = espalhar(pieces.filter((x) => x.featured), 8);
  const resto = espalhar(pieces.filter((x) => !x.featured), 8);

  /* A fotografia ao lado do texto procura uma que ainda não esteja na página.
     Se já não houver nenhuma por usar -- e com nove não há sempre -- fica a da
     primeira peça em destaque, que é melhor do que uma fila vazia. */
  const naPagina = new Set([...destaques, ...resto].map(retrato));
  const aoLado = pieces.find((x) => x.photoFolder && !naPagina.has(retrato(x)))
    ?? destaques[0] ?? pieces[0];

  return `
${cover(coverText, 'cathelier', coverArt)}

<section class="occasions-lead">
  <div class="shell">
    ${occasionRow(occasions)}
  </div>
</section>

<section class="collection">
  <div class="shell">
    <div class="collection__head"><h2>${esc(t('cathelier.inicio.maisVendidas'))}</h2></div>
    <div class="grid-products" style="margin-block-start:2rem">
      ${destaques.map((p, i) => card(p, { eager: i < 3 })).join('\n      ')}
    </div>
  </div>
</section>

<section class="collection collection--alt">
  <div class="shell">
    <div class="maker">
      <div class="maker__text">
        <h2>${esc(t('cathelier.inicio.quantidade.titulo'))}</h2>
        <p>${esc(t('cathelier.inicio.quantidade.texto1'))}</p>
        <p>${esc(t('cathelier.inicio.quantidade.texto2'))}</p>
        <a class="btn" href="/cathelier/quote/">${esc(t('cathelier.pedirOrcamento'))}</a>
      </div>
      <div class="frame maker__photo">
        ${picture({
          dir: `cathelier/${aoLado.photoFolder}`,
          name: aoLado.cover || aoLado.photos[0],
          alt: t('cathelier.inicio.quantidade.fotoAlt'),
          sizes: '(min-width: 56rem) 45vw, 100vw', widths: [200, 400],
        })}
      </div>
    </div>
  </div>
</section>

<section class="collection">
  <div class="shell">
    <div class="collection__head">
      <h2>${esc(t('cathelier.inicio.mais.titulo'))}</h2>
      <p>${esc(tn('cathelier.inicio.mais.texto', pieces.length))}</p>
    </div>
    <div class="grid-products" style="margin-block-start:2rem">
      ${resto.map((p) => card(p)).join('\n      ')}
    </div>
    <p style="text-align:center;margin-block-start:2.5rem">
      <a class="btn btn--ghost" href="/cathelier/pieces/">${esc(tn('cathelier.inicio.verTodas', pieces.length))}</a>
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
      <h1>${esc(t('cathelier.lista.titulo'))}</h1>
      <p class="lede" style="margin-block-start:.5rem">
        ${esc(tn('cathelier.lista.lede', pieces.length))}
      </p>
    </div>

    <div class="filters" data-filters style="margin-block-start:1.25rem;justify-content:center">
      <button class="filter" type="button" data-filter="all" aria-pressed="true">${esc(t('cathelier.lista.todas'))}</button>
      ${occasions.map((o) => `<button class="filter" type="button" data-filter="${esc(o.slug)}" aria-pressed="false">${esc(o.name)}</button>`).join('\n      ')}
    </div>

    <!-- OS PEDIDOS ESPECIAIS LEVAM AO ORÇAMENTO. A dona quis as duas coisas:
         as catorze peças por medida arrumadas aqui, E o separador a levar ao
         pedido de orçamento. Um círculo não pode ser filtro e link ao mesmo
         tempo sem uma excepção em cada guarda; assim é um filtro como os
         outros, e o caminho para o orçamento aparece por cima das peças, só
         neste. Aparece pelo JavaScript: sem ele a lista mostra tudo e esta
         frase, fora de contexto, não fazia sentido. -->
    <div class="custom-note" data-custom-note hidden>
      <p>${esc(t('cathelier.lista.porMedida'))}</p>
      <a class="btn" href="/cathelier/quote/">${esc(t('cathelier.pedirOrcamento'))}</a>
    </div>

    <div class="grid-products" data-product-list style="margin-block-start:1.5rem">
      ${pieces.map((p, i) => card(p, { eager: i < 4 })).join('\n      ')}
    </div>
    <p class="lede" data-no-results hidden style="margin-block-start:2rem">${esc(t('cathelier.lista.vazia'))}</p>
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
  /* «MORE IN» PROCURA IRMÃS EM TODOS OS SEPARADORES DA PEÇA, e não só no
     principal. Com os separadores de 25 set 2026 a Páscoa ficou com uma peça
     só, e a ficha dela deixou de ter o bloco -- e a do pendente com as datas
     também. As irmãs contam-se como o filtro as conta (principal E de
     passagem), para o link do título mostrar o que a ficha prometeu. */
  const familias = (x) => [x.occasion, ...(x.alsoIn || [])];
  let here = occasions.find((o) => o.slug === p.occasion);
  let related = [];
  for (const slug of familias(p)) {
    const irmas = everything.filter((x) => x.slug !== p.slug && familias(x).includes(slug));
    if (irmas.length) {
      related = irmas.slice(0, 4);
      here = occasions.find((o) => o.slug === slug) ?? here;
      break;
    }
  }
  return `
<section class="product shell">
  <div class="product__gallery">
    ${(p.photos || []).length > 1 ? `
    <div class="gallery" data-gallery>
      <div class="gallery__track" data-gallery-track>
        ${p.photos.map((n, i) => `<div class="gallery__slide" style="--focus:${cardFocus(`cathelier/${p.photoFolder}/${n}`, shapes[i])}">${wholePicture({
          key: `cathelier/${p.photoFolder}/${n}`, shape: shapes[i], widths: rungs(shapes[i].w),
          alt: t('cathelier.ficha.fotoAlt', { nome: p.name, i: i + 1 }),
          sizes: '(min-width: 64rem) 560px, 100vw',
          loading: i === 0 ? 'eager' : 'lazy',
        })}</div>`).join('\n        ')}
      </div>
      <button class="gallery__open" type="button" data-box-open aria-label="${esc(t('cathelier.ficha.ampliar'))}">${icon('search', 18)}</button>
      <button class="gallery__arrow gallery__arrow--prev" type="button" data-gallery-prev aria-label="${esc(t('cathelier.ficha.anterior'))}">${icon('arrowLeft', 20)}</button>
      <button class="gallery__arrow gallery__arrow--next" type="button" data-gallery-next aria-label="${esc(t('cathelier.ficha.seguinte'))}">${icon('arrowRight', 20)}</button>
    </div>
    <div class="gallery__thumbs" role="tablist" aria-label="${esc(t('cathelier.ficha.fotografias'))}">
      ${p.photos.map((n, i) => `<button class="frame gallery__thumb" type="button" role="tab"
        data-gallery-go="${i}" aria-selected="${i === 0}" aria-label="${esc(t('cathelier.ficha.fotografia', { i: i + 1 }))}">
        ${picture({ dir: `cathelier/${p.photoFolder}`, name: n, alt: '', sizes: '84px', widths: [200] })}
      </button>`).join('\n      ')}
    </div>` : frame(p, '(min-width: 64rem) 560px, 100vw', true)}
  </div>

  <div class="product__detail">
    <h1>${esc(p.name)}</h1>
    <p class="product__price">${desde(p.price)}</p>
    <p class="product__lead">${esc(prazos(shop.lead).encomenda)}</p>

    <form class="product__form" data-product-form data-product-id="${esc(p.slug)}">
      <p class="field__help" style="margin-block-end:.25rem">
        ${esc(t('cathelier.ficha.ajuda'))}
      </p>
      ${(p.options || []).map((o) => `<div class="field">
        <label for="opt-${esc(o.id)}">${esc(o.name)}${o.required ? ` <span class="field__req">${esc(t('cathelier.ficha.obrigatorio'))}</span>` : ''}</label>
        <input id="opt-${esc(o.id)}" type="text" maxlength="${Number.isInteger(o.max) && o.max > 0 ? o.max : 60}"
               data-option="${esc(o.id)}"${o.required ? ' required' : ''}
               placeholder="${esc(o.example || '')}">
        <p class="field__limit">${esc(t('cathelier.ficha.limite', { n: o.max || 60 }))}</p>
      </div>`).join('\n      ')}

      <div class="product__buy">
        <div class="qty" data-qty>
          <button class="qty__btn" type="button" data-qty-down aria-label="${esc(t('cathelier.ficha.menosUm'))}">${icon('minus', 16)}</button>
          <input class="qty__input" type="number" name="quantity" value="1" min="1" max="200" inputmode="numeric" aria-label="${esc(t('cathelier.ficha.quantidade'))}">
          <button class="qty__btn" type="button" data-qty-up aria-label="${esc(t('cathelier.ficha.maisUm'))}">${icon('plus', 16)}</button>
        </div>
        <button class="btn btn--wide" type="submit" data-add>${esc(t('cathelier.ficha.adicionar'))}</button>
      </div>
    </form>

    <div class="reassure">
      ${[['shield', 'desenho'], ['hand', 'mao'], ['truck', 'envio'], ['leaf', 'madeira']]
        .map(([i, k]) => `<p>${icon(i, 18)}<span>${esc(t(`cathelier.ficha.garantia.${k}`))}</span></p>`).join('\n      ')}
    </div>

    <div class="product__text stack" style="--stack:1rem">${prose(p.text)}</div>

    ${(shop.safetyCathelier || []).length ? `<details class="product__safety">
      <summary>${esc(t('cathelier.ficha.cuidados'))}</summary>
      <ul>${shop.safetyCathelier.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </details>` : ''}

    <p class="small muted" style="margin-block-start:1.25rem">
      ${t('cathelier.ficha.muitas')}
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
      <span class="eyebrow">${esc(t('cathelier.ficha.maisEm'))}</span>
      ${here ? `<h2><a href="/cathelier/pieces/#${esc(here.slug)}">${esc(here.name)}</a></h2>`
             : `<h2>${esc(t('cathelier.ficha.mesmaColecao'))}</h2>`}
    </div>
    <div class="grid-products" style="margin-block-start:2rem">${related.map((x) => card(x)).join('\n      ')}</div>
  </div>
</section>` : ''}
`;
}
