import { esc, safeHref, jsonInScript } from './html.mjs';
import { icon } from './icons.mjs';
import { t, lingua, LINGUAS, LOCALE, OG_LOCALE, NOMES, morada, linguaDaRaiz, prefixoDe } from './i18n.mjs';

/* ===========================================================================
   The page shell: <head>, the header, the drawer, the footer.
   ===========================================================================
   One function serves both brands, and everything that differs between them
   is read from these two tables. The look is not here — it is in the two brand
   stylesheets, which share almost nothing. */

/* Os rótulos são CHAVES de tradução (src/i18n/<língua>/shell.json), lidas
   no momento de desenhar -- a tabela é avaliada antes de o gerador escolher a
   língua, e um texto escrito aqui ficaria na língua de quem o escreveu. */
export const NAV = {
  ithos: [
    ['/lamps/', 'nav.lamps', 'lamps'],
    ['/about/', 'nav.workshop'],
    ['/contact/', 'nav.contact'],
  ],
  cathelier: [
    // "Occasions" came out of the bar at the owner's request, and the ten
    // occasion PAGES have since been deleted outright: an occasion is now a
    // filter on this one list, reached from the badges on the cathelier home.
    // So this single entry is the whole catalogue, and there is nothing left
    // for the bar to orphan.
    ['/cathelier/pieces/', 'nav.pieces', 'pieces'],
    ['/cathelier/quote/', 'nav.quote'],
    ['/cathelier/about/', 'nav.workshop'],
  ],
};

/** Only in the drawer: things people look for that do not earn a place in the bar. */
const NAV_EXTRA = [['/contact/#faq', 'nav.questions']];

/* --- the pages both shops share, in both dresses ---------------------------
 *
 * These carry the same words whichever shop you are standing in, so they are
 * written TWICE: once at the address below, wearing ithos, and once at the
 * same address under /cathelier/, wearing cathelier. Only the navbar, the
 * menu and the footer differ -- which is exactly what was asked for.
 *
 * The basket is on the list and it is the worst of them: the basket icon is in
 * the header AND the drawer of all 94 pages, so a cathelier reader used to
 * change shop by clicking the most-used control on the site.
 *
 * The ithos address stays the canonical one, and not because ithos matters
 * more. It is the address that already exists, GitHub Pages cannot issue a
 * redirect, and `/cathelier/legal/terms/` would read as "cathelier's terms"
 * when there is one contract with one sole trader -- terms.md says so itself.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * · /care-and-safety/ is the lamp manual: AA cells, the mains remote, keeping
 *   the cable out of a cot, solid pine. Dressed as cathelier it would be the
 *   only safety page a reader of the other shop ever sees, and it would
 *   describe a product with no electricity in it. That one needs its own
 *   words, not a copy, and the words have to come from the owner.
 * · /404.html -- GitHub Pages serves exactly one, from the site root. A second
 *   copy is a page no address can reach.
 * · /thank-you/ and /order-cancelled/ -- the address the gateway returns to is
 *   named by the Worker, and a reader arriving from stripe.com is not standing
 *   in either shop. They stay single until the Worker can be told which.
 * · / -- on a cathelier page that is the door OUT. Mirroring it would break
 *   the one link whose whole job is to change brand.
 */
export const MIRRORED = [
  '/contact/',
  '/cart/',
  '/resellers/',
  '/legal/terms/',
  '/legal/privacy/',
  '/legal/cancellation/',
  '/legal/returns-form/',
  '/legal/shipping-and-returns/',
  '/legal/identification/',
  /* As duas de 26 set 2026: o aviso harmonizado da garantia legal (Diretiva
     (UE) 2024/825 e Reg. de Execução (UE) 2025/1960) e a função de retratação
     (art. 11.º-A da Diretiva 2011/83, pela Diretiva (UE) 2023/2673). São as
     mesmas palavras nas duas lojas, como as outras páginas legais. */
  '/legal/guarantee/',
  '/legal/withdraw/',
];

/** The address of a shared page in the dress of the shop you are standing in.
 *  Every link to one goes through here -- the bar, the menu, the footer, the
 *  breadcrumbs and the bodies -- so there is one place to be wrong, not forty. */
export function brandPath(path, brand) {
  if (brand !== 'cathelier') return path;
  const [bare, hash = ''] = String(path).split('#');
  return MIRRORED.includes(bare) ? `/cathelier${bare}${hash ? `#${hash}` : ''}` : path;
}

/* The other brand is always reachable, and always announces itself as
   elsewhere: its own name, its own lettering, and an arrow that points out. */
export const SIBLING = {
  ithos: { href: '/cathelier/', name: 'cathelier', note: 'irmao.cathelier' },
  cathelier: { href: '/', name: 'ithos', note: 'irmao.ithos' },
};

const MARK = {
  ithos: { src: '/assets/ithos-wordmark.svg', w: 119, h: 120, alt: 'ithos' },
  cathelier: { src: '/assets/cathelier.svg', w: 117, h: 54, alt: 'cathelier' },
};

/* This line is not a footnote. Article 1 of DL 59/2021 requires it to sit WITH
 * the number, and in a shop that is also the only place it is any use: a
 * sentence at the bottom of a four-column footer does not tell anyone what
 * that particular call costs. It was rendered after the whole grid, detached
 * from the telephone it describes. It now follows the number everywhere the
 * number appears, and nowhere else. */
const CALL_COST = () => t('shell.custoChamada');

/* THE ONE LINE OF SCRIPT THAT IS NOT IN shop.js, AND WHY.
 *
 * The header has no background while the page is at the top. Deciding that in
 * shop.js would be a frame too late: the bar would paint solid, then go
 * transparent, and every arrival on the home page would start with a flinch.
 * This runs while the parser is still inside <head>, so the first pixel ever
 * painted is already the right one.
 *
 * It reads the real scroll position rather than assuming zero, because a
 * reload or a Back lands part-way down a page without firing a scroll event --
 * the same trap the header's shrink already documents in shop.js.
 *
 * And its ABSENCE is the safe state. A browser with no JavaScript never gets
 * the attribute, the stylesheet's rule needs data-scrolled='no' to be present
 * rather than merely not 'yes', and the bar keeps its background for good. A
 * failed script cannot leave white controls floating over white page. */
/* A segunda metade diz ao CSS que há script: a frase do stock na ficha do
   candeeiro fica invisível até o Worker responder -- e sem script, visível
   com o caso mais lento, que é verdade para qualquer candeeiro. */
const MARCA_DE_POSICAO = "document.documentElement.dataset.scrolled=scrollY>40?'yes':'no';document.documentElement.dataset.js='yes'";

export function page(o) {
  const {
    brand = 'ithos', title, description, path, body,
    site, identity, image, schema = [], counts = {}, shipping = null, shop = null, asset = {},
    bodyClass = '', noindex = false, crumbs = null, extraHead = '', preview = false,
    /* True on the two pages that open with a cover. It rides on <html> so the
       stylesheet can lighten the header's ink there and nowhere else -- on the
       other 92 pages the bar at rest is standing on the page's own background
       and its ink must stay dark. */
    cover = false,
    /* Where the canonical points. On a mirrored page it is the OTHER copy --
       the ithos one -- which is what stops two addresses with the same words
       competing with each other. */
    canonicalPath = path,
    /* Uma página de erro não é uma morada: sem canonical, og:url nem hreflang
       (apontavam para /404.html, que a Cloudflare reencaminha). */
    semMorada = false,
  } = o;

  const abs = (p) => `${site}${p}`;
  /* O canonical e o og:url são da página NESTA língua; o hreflang diz ao
     Google onde está a mesma página nas outras (e qual é a da raiz). */
  const canonical = abs(morada(canonicalPath));
  const themeColour = brand === 'ithos' ? '#FFFFFF' : '#FFF8F2';
  const og = image ? (image.startsWith('http') ? image : abs(image)) : abs('/assets/share.jpg');

  return `<!doctype html>
<html lang="${LOCALE[lingua()]}"${prefixoDe() ? ` data-prefixo="${prefixoDe()}"` : ''} data-brand="${brand}"${cover ? ' data-cover="yes"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${semMorada ? '' : `<link rel="canonical" href="${esc(canonical)}">`}
${noindex || preview ? '<meta name="robots" content="noindex, nofollow">' : ''}
<meta name="theme-color" content="${themeColour}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(identity.tradingName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${semMorada ? '' : `<meta property="og:url" content="${esc(canonical)}">`}
<meta property="og:image" content="${esc(og)}">
<meta property="og:locale" content="${OG_LOCALE[lingua()]}">
${LINGUAS.length > 1 && !semMorada ? [...LINGUAS.map((l) => `<link rel="alternate" hreflang="${LOCALE[l]}" href="${esc(abs(morada(canonicalPath, l)))}">`),
  `<link rel="alternate" hreflang="x-default" href="${esc(abs(morada(canonicalPath, linguaDaRaiz())))}">`].join('\n') : ''}
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="/assets/fonts/${brand === 'ithos' ? 'montserrat-latin' : 'kleeone-400-latin'}.woff2">
<link rel="stylesheet" href="/assets/${asset.css || 'styles.css'}">
${extraHead}
${(() => {
  /* The breadcrumb trail is emitted from the SAME array that draws it, so the
     two can never disagree. Writing it twice is how a page ends up telling a
     search engine one path and a reader another. */
  const all = [...schema];
  if (crumbs && crumbs.length > 1) {
    all.push({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem', position: i + 1, name: c.name,
        ...(c.href ? { item: `${site}${morada(brandPath(c.href, brand))}` } : {}),
      })),
    });
  }
  /* A copy carries no structured data. Every blob in here is a claim ABOUT AN
     ADDRESS, and the address a copy names is the other one -- two FAQPage
     blobs for one set of seven questions, or two BreadcrumbLists for one page,
     is a contradiction handed to a search engine for nothing. The visible
     trail is still drawn, because the reader really is standing there. */
  if (canonicalPath !== path) return '';
  return all.length
    ? `<script type="application/ld+json">${jsonInScript(all.length === 1 ? all[0] : all)}</script>`
    : '';
})()}

  <script>${MARCA_DE_POSICAO}</script>
</head>
<body class="${esc(bodyClass)}" id="top">
<a class="skip" href="#main">${esc(t('shell.saltar'))}</a>

${announcement({ brand, shipping })}
${header({ brand, path, site, canonicalPath })}
${crumbs ? breadcrumbs(crumbs, brand) : ''}

<main id="main">
${body}
</main>

${drawer({ brand, identity, counts, site, canonicalPath })}
${footer({ brand, identity })}

<a class="to-top" href="#top" hidden aria-label="${esc(t('shell.topo'))}">${icon('arrowUp', 22)}</a>

<!-- There is no site-wide cookie notice, and that is a decision, not an
     omission. This site sets no analytics and no advertising cookies, the
     typefaces are served from this domain, and nothing else contacts a third
     party. Consent is owed when third-party content actually loads, and the
     only place that happens is the Google map on the contact page — so the
     question is asked there, in front of the map, by whoever wants to see it.

     A banner over every page would also have cost the thing the owner asked
     for by name: at 375x812 it covered the second row of lamps, so a
     first-time visitor saw two instead of the four she asked for. -->

${asset.textos?.[lingua()] ? `<script src="/assets/${asset.textos[lingua()]}" defer></script>\n` : ''}<script src="/assets/${asset.js || 'shop.js'}" defer></script>
</body>
</html>
`;
}

/* --- the line above everything -------------------------------------------
   It appears ONLY when there is a campaign running, and carries that campaign:
   a free shipping threshold, a Christmas cut-off date. Nothing else.

   It used to fall back to a line about the workshop when no campaign was on,
   and the owner had it taken down — rightly. A bar at the very top of every
   page is the place a shop says something that is true today and will not be
   true next month. A permanent claim sitting there is just furniture, and the
   promise it was making is already on the page, twice, where it means
   something: beside the button and in the questions. */
function announcement({ brand, shipping }) {
  if (brand !== 'cathelier') return '';
  const c = shipping?.campaign;
  if (!c?.active || !(c.freeOver > 0)) return '';
  return `<p class="announce">${esc(t('shell.portesGratis', { n: Number(c.freeOver).toFixed(0) }))}</p>`;
}

/* O SELETOR DE LÍNGUA: a MESMA página nas outras línguas. As moradas vão
   absolutas (com o SITE) de propósito: o gerador acrescenta o prefixo da
   língua a todas as ligações internas «/…» de uma página, e estas são as
   únicas que têm de sair dessa regra. */
function seletorDeLingua({ site, canonicalPath, classe }) {
  if (LINGUAS.length < 2) return '';
  return `<nav class="${classe}" aria-label="${esc(t('shell.lingua'))}">${LINGUAS.map((l) => (l === lingua()
    ? `<span aria-current="true" lang="${LOCALE[l]}">${l.toUpperCase()}</span>`
    : `<a href="${esc(`${site}${morada(canonicalPath, l)}`)}" hreflang="${LOCALE[l]}" lang="${LOCALE[l]}" title="${esc(NOMES[l])}">${l.toUpperCase()}</a>`)).join('')}</nav>`;
}

function header({ brand, site, canonicalPath }) {
  const mark = MARK[brand];
  const home = brand === 'cathelier' ? '/cathelier/' : '/';
  const sibling = SIBLING[brand];
  /* The door to the other shop shows that shop's OWN mark, small, instead of
     its name in words -- the owner's request, and it reads faster: a reader
     recognises the other brand before finishing a word. The name has not gone
     anywhere, it is in the link's aria-label, which is what a screen reader
     announces and what the images (alt="") deliberately do not repeat. */
  const other = MARK[sibling.name];

  /* ONE HEADER AT EVERY WIDTH: burger, mark, the other brand, basket.
   *
   * There used to be a horizontal bar of links from 64rem up, and two
   * brand-specific grid shapes that existed only to place it — cathelier with
   * its mark pushed left, ithos in two rows. The owner asked for the phone's
   * arrangement to hold on a big screen too, so the bar and both shapes are
   * gone from the markup rather than hidden by a media query. Hidden-but-
   * present is this project's signature failure: a rule surviving where nobody
   * looks is how `.head__mark { position: absolute }` printed the navigation
   * through the wordmark.
   *
   * Three slots, always, and the CSS decides where each one sits. The logo
   * used to be absolutely centred while the navigation sat in normal flow
   * beside it, and at the width where the navigation grew past the halfway
   * point the two drew on top of each other — the owner photographed "THE
   * WORKSHOP" printed across the cathelier wordmark. A grid column cannot do
   * that: the logo has a track of its own and nothing else can enter it. */
  return `<header class="head" data-shrunk="no">
  <div class="shell head__row">
    <div class="head__left">
      <button class="icon-btn open-menu" type="button" aria-expanded="false" aria-controls="menu"
              aria-label="${esc(t('shell.abrirMenu'))}">${icon('menu', 24)}<span class="open-menu__word">${esc(t('shell.menu'))}</span></button>
    </div>

    <a class="head__mark" href="${home}" aria-label="${esc(t('shell.inicioDe', { marca: mark.alt }))}">
      <img src="${mark.src}" alt="${esc(mark.alt)}" width="${mark.w}" height="${mark.h}">
    </a>

    <div class="head__right">
      ${seletorDeLingua({ site, canonicalPath, classe: 'linguas' })}
      <a class="head__sibling" href="${sibling.href}" data-other-brand
         aria-label="${esc(t('shell.irPara', { nome: sibling.name, nota: t(`shell.${sibling.note}`) }))}">
        <span class="head__sibling-mark">
          <img src="${other.src}" alt="" width="${other.w}" height="${other.h}">
        </span><span class="head__sibling-arrow" aria-hidden="true">↗</span>
      </a>
      <a class="icon-btn" href="${brandPath('/cart/', brand)}" aria-label="${esc(t('shell.cesto'))}">
        ${icon('cart', 22)}<span class="cart-count" data-cart-count data-empty="yes"></span>
      </a>
    </div>
  </div>
</header>`;
}

/* A native <dialog> opened with showModal(): focus goes in, stays in, and the
   rest of the page goes inert — three promises aria-modal makes and does not
   keep on its own. */
function drawer({ brand, identity, counts, site, canonicalPath }) {
  const nav = NAV[brand] ?? NAV.ithos;
  const sibling = SIBLING[brand];
  const other = MARK[sibling.name];
  const count = (key) => (counts[key] ? `<span class="drawer__count">${counts[key]}</span>` : '');
  const mark = MARK[brand];

  /* `tabindex="-1"` para o foco poder aterrar NO PAINEL e não num botão.
     Ver o porquê em src/js/shop.js, onde o foco é dado: um anel à volta do
     X lê-se como «seleccionado» num telemóvel, e um <dialog> não é nenhum
     dos elementos a que a regra do anel se aplica. */
  return `<dialog class="drawer" id="menu" aria-label="${esc(t('shell.menu'))}" tabindex="-1">
  <div class="drawer__top">
    <button class="icon-btn close-menu" type="button" aria-label="${esc(t('shell.fecharMenu'))}">${icon('close', 24)}</button>
    <img class="drawer__mark" src="${mark.src}" alt="${esc(mark.alt)}" width="${mark.w}" height="${mark.h}">
    <a class="icon-btn drawer__cart" href="${brandPath('/cart/', brand)}" aria-label="${esc(t('shell.cesto'))}">
      ${icon('cart', 22)}<span class="cart-count" data-cart-count data-empty="yes"></span>
    </a>
  </div>

  <div class="drawer__body">
    <nav class="drawer__nav" aria-label="${esc(t('shell.navPrincipal'))}">
      ${[...nav, ...NAV_EXTRA].map(([h, chave, k]) => `<a href="${brandPath(h, brand)}"><span>${esc(t(`shell.${chave}`))}</span>${count(k)}</a>`).join('\n      ')}
    </nav>

  <a class="drawer__sibling" href="${sibling.href}" data-other-brand
     aria-label="${esc(t('shell.irPara', { nome: sibling.name, nota: t(`shell.${sibling.note}`) }))}">
    <span class="drawer__sibling-mark">
      <img src="${other.src}" alt="" width="${other.w}" height="${other.h}">
    </span>
    <span class="drawer__sibling-note">${esc(t(`shell.${sibling.note}`))}</span>
    <span aria-hidden="true">↗</span>
  </a>

  </div>

  <div class="drawer__contact">
    <a href="tel:${esc(identity.phone)}">${icon('phone', 18)}<span>${esc(identity.phoneText)}</span></a>
    <p class="drawer__cost">${esc(CALL_COST())}</p>
    <a href="https://wa.me/${esc(identity.whatsapp)}" rel="noopener">${icon('whatsapp', 18)}<span>WhatsApp</span></a>
  </div>
  ${seletorDeLingua({ site, canonicalPath, classe: 'linguas linguas--gaveta' })}
</dialog>`;
}

function breadcrumbs(items, brand) {
  return `<nav class="crumbs shell" aria-label="${esc(t('shell.migalhas'))}">
  <ol>${items.map((it, i) => (i === items.length - 1
    ? `<li><span aria-current="page">${esc(it.name)}</span></li>`
    : `<li><a href="${brandPath(it.href, brand)}">${esc(it.name)}</a></li>`)).join('')}</ol>
</nav>`;
}

/* --- footer ---------------------------------------------------------------
   Four groups, and on a phone they are an accordion — the owner sent a
   screenshot of exactly this and asked for it on every page. Native
   <details>, so it works with no JavaScript at all.

   Only the social accounts of the brand you are looking at. Both used to show
   at once: two Instagram links side by side with the same icon, and clicking
   one landed you in the other brand's world with no idea why. */
function footer({ brand, identity }) {
  const i = identity;
  const social = brand === 'cathelier'
    ? [[i.instagramCathelier, t('shell.noInstagram', { marca: 'cathelier' }), 'instagram']]
    : [[i.instagramIthos, t('shell.noInstagram', { marca: 'ithos' }), 'instagram'],
       [i.facebookIthos, t('shell.noFacebook', { marca: 'ithos' }), 'facebook']];

  const groups = [
    [t('shell.rodape.apoio'), [
      ['/contact/#faq', t('shell.nav.questions')],
      ['/legal/shipping-and-returns/', t('shell.rodape.entregas')],
      /* Care and safety is the LAMP manual -- AA cells, the mains remote,
         keeping the cable out of a cot. It is offered where it is true and
         nowhere else: from a cathelier page it would be the only safety page
         that reader ever sees, and it would describe a product with no
         electricity in it. cathelier needs its own, written for keepsakes with
         small parts, magnets and a candle, and those words have to come from
         the owner. */
      ['/legal/returns-form/', t('shell.rodape.formulario')],
      [i.complaintsBook, t('shell.rodape.reclamacoes')],
    ]],
    /* THE FOOTER STAYS IN THE SHOP YOU ARE IN.
       It listed both shops' pages on every page, so the footer of an ithos
       page offered "All the pieces" and "Ask for a quote" -- links that take
       you out of the shop you are reading, with nothing to say they do. The
       owner noticed. The door between the shops is the one in the bar and in
       the menu, which names the other brand and points an arrow out of the
       page; a footer row that looks like every other footer row is not a door,
       it is a trapdoor.

       These rows exist at all because the horizontal link bar went away, and
       each shop still has to carry its own: of 53 cathelier pages, 12 had no
       visible route to the pieces or the quote outside the header and the
       drawer, and all 55 had none to how a piece is made. So the group is not
       dropped -- it is narrowed to the shop it belongs to. */
    [t('shell.rodape.loja'), brand === 'cathelier'
      ? [
        ['/cathelier/', t('shell.rodape.pecasPersonalizadas')],
        ['/cathelier/pieces/', t('shell.rodape.todasPecas')],
        ['/cathelier/quote/', t('shell.rodape.pedirOrcamento')],
        ['/cathelier/about/', t('shell.rodape.comoSeFaz')],
        ['/contact/', t('shell.rodape.contactos')],
      ]
      : [
        ['/', t('shell.rodape.candeeiros')],
        ['/lamps/', t('shell.rodape.todosCandeeiros')],
        ['/about/', t('shell.rodape.oficina')],
        ['/care-and-safety/', t('shell.rodape.cuidados')],
        ['/contact/', t('shell.rodape.contactos')],
      ]],
    [t('shell.rodape.termos'), [
      ['/legal/terms/', t('shell.rodape.condicoesVenda')],
      ['/legal/privacy/', t('shell.rodape.privacidade')],
      ['/legal/cancellation/', t('shell.rodape.resolucao')],
      /* A ligação para o aviso harmonizado da garantia legal, em todas as
         páginas: as orientações da Comissão (2026, secção 2.3) dão como
         exemplo uma frase destas no cabeçalho ou no rodapé, que abre o aviso
         inteiro ao primeiro clique. */
      ['/legal/guarantee/', t('paginas.garantia.ligacao')],
      ['/legal/identification/', t('shell.rodape.identificacao')],
      ['/resellers/', t('shell.rodape.revendedores')],
    ]],
    /* O quarto campo é o desenho, e só este grupo o leva: estas três são as
       maneiras de falar connosco e reconhecem-se pela forma antes de se
       lerem. Nas outras colunas são páginas, e uma página não tem desenho
       que a distinga -- vinte ícones diferentes numa lista seriam ruído. */
    [t('shell.rodape.falar'), [
      [`tel:${i.phone}`, i.phoneText, CALL_COST(), 'phone'],
      [`https://wa.me/${i.whatsapp}`, 'WhatsApp', '', 'whatsapp'],
      [`mailto:${i.email}`, i.email, '', 'mail'],
    ]],
  ];

  return `<footer class="foot">
  <div class="shell">
    <div class="foot__grid">
      ${groups.map(([name, links]) => `<details class="foot__group" open>
        <summary>${esc(name)}</summary>
        <ul>${links.map(([h, t, note, ic]) => `<li${ic ? ' class="foot__with-icon"' : ''}><a href="${
          esc(brandPath(safeHref(h, `the footer link «${t}»`), brand))}">${ic ? icon(ic, 16) : ''}${esc(t)}</a>${
          note ? `<span class="foot__note">${esc(note)}</span>` : ''}</li>`).join('')}</ul>
      </details>`).join('\n      ')}
    </div>

    ${/* A FUNÇÃO DE RETRATAÇÃO FICA FORA DO ACORDEÃO, de propósito. O artigo
        11.º-A da Diretiva 2011/83 (pela Diretiva (UE) 2023/2673) quer a
        ligação «retrate-se do contrato aqui» permanentemente disponível e bem
        visível; numa linha de uma lista que se fecha no telemóvel não é
        nenhuma das duas coisas. scripts/check-output.mjs recusa uma página
        sem ela. */ ''}<p class="foot__withdraw"><a href="${esc(brandPath('/legal/withdraw/', brand))}">${esc(t('paginas.retratacao.ligacao'))}</a></p>

    <div class="foot__social">
      ${social.filter(([href]) => href).map(([href, label, ic]) =>
        `<a href="${esc(safeHref(href, label))}" rel="noopener" aria-label="${esc(label)}">${icon(ic, 18)}</a>`).join('\n      ')}
    </div>

    <!-- The seller's identification used to be printed here in full, on all 94
         pages, and it is gone.

         What the law requires is ACCESS, not repetition: article 10 of
         DL 7/2004 asks for the name, address and tax number to be
         "permanently, easily and directly accessible", and a permanent link in
         the footer of every page to a page that carries them is exactly that.
         It lives at /legal/identification/ and is linked under Terms below.

         The two things that must be ON the site rather than merely reachable
         are still on it: the electronic complaints book is a link under
         Customer care, where somebody with a complaint would look for it, and
         the out-of-court dispute body is named on the terms page and on the
         identification page, which is what article 18 of Lei 144/2015 asks.

         The call-cost line stays wherever the telephone number appears. That
         one is not about access — it has to sit beside the number. -->
    <p class="foot__end">© ${new Date().getFullYear()} ${esc(i.tradingName)}</p>
  </div>
</footer>`;
}
