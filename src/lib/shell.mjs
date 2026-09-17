import { esc } from './html.mjs';
import { icon } from './icons.mjs';

/* ===========================================================================
   The page shell: <head>, the header, the drawer, the footer.
   ===========================================================================
   One function serves both brands, and everything that differs between them
   is read from these two tables. The look is not here — it is in the two brand
   stylesheets, which share almost nothing. */

export const NAV = {
  ithos: [
    ['/lamps/', 'Lamps', 'lamps'],
    ['/about/', 'The workshop'],
    ['/contact/', 'Contact'],
  ],
  cathelier: [
    // "Occasions" came out of the bar at the owner's request. The ten occasion
    // pages are not orphaned by it: the cathelier home draws all ten as
    // badges, every occasion page links to the other nine, and the drawer
    // carries them on a phone — eleven pages of origin, which is where they
    // were being found anyway.
    ['/cathelier/pieces/', 'All pieces', 'pieces'],
    ['/cathelier/quote/', 'Ask for a quote'],
    ['/cathelier/about/', 'The workshop'],
  ],
};

/** Only in the drawer: things people look for that do not earn a place in the bar. */
const NAV_EXTRA = [['/contact/#faq', 'Questions']];

/* --- the pages both shops share, in both dresses ---------------------------
 *
 * These carry the same words whichever shop you are standing in, so they are
 * written TWICE: once at the address below, wearing ithos, and once at the
 * same address under /cathelier/, wearing cathelier. Only the navbar, the
 * menu and the footer differ -- which is exactly what was asked for.
 *
 * The basket is on the list and it is the worst of them: the basket icon is in
 * the header AND the drawer of all 96 pages, so a cathelier reader used to
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
 * · /thank-you/ and /order-cancelled/ -- the address Stripe returns to is
 *   named by the Worker, and a reader arriving from stripe.com is not standing
 *   in either shop. They stay single until the Worker can be told which.
 * · / -- on a cathelier page that is the door OUT. Mirroring it would break
 *   the one link whose whole job is to change brand.
 */
export const MIRRORED = [
  '/contact/',
  '/cart/',
  '/legal/terms/',
  '/legal/privacy/',
  '/legal/cancellation/',
  '/legal/returns-form/',
  '/legal/shipping-and-returns/',
  '/legal/identification/',
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
  ithos: { href: '/cathelier/', name: 'cathelier', note: 'personalised pieces' },
  cathelier: { href: '/', name: 'ithos', note: 'wooden night lights' },
};

/* The light lockup of a mark, generated from the artwork by src/build.mjs.
 * An <img> renders its own document and never sees this page's custom
 * properties, so a mark cannot be recoloured by CSS -- which is why the ithos
 * artwork's own `var(--ithos-tinta, …)` hooks have never once fired here. The
 * second file is the answer: same shapes, one ink. */
const lightMark = (src) => src.replace(/\.svg$/, '-light.svg');

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
const CALL_COST = '(Call to the national mobile network)';

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
const MARCA_DE_POSICAO = "document.documentElement.dataset.scrolled=scrollY>12?'yes':'no'";

export function page(o) {
  const {
    brand = 'ithos', title, description, path, body,
    site, identity, image, schema = [], counts = {}, shipping = null, shop = null, asset = {},
    bodyClass = '', noindex = false, crumbs = null, extraHead = '', preview = false,
    /* True on the two pages that open with a cover. It rides on <html> so the
       stylesheet can lighten the header's ink there and nowhere else -- on the
       other 102 pages the bar at rest is standing on the page's own background
       and its ink must stay dark. */
    cover = false,
    /* Where the canonical points. On a mirrored page it is the OTHER copy --
       the ithos one -- which is what stops two addresses with the same words
       competing with each other. */
    canonicalPath = path,
  } = o;

  const abs = (p) => `${site}${p}`;
  const canonical = abs(canonicalPath);
  const themeColour = brand === 'ithos' ? '#FFFFFF' : '#FFF8F2';
  const og = image ? (image.startsWith('http') ? image : abs(image)) : abs('/assets/share.jpg');

  return `<!doctype html>
<html lang="en" data-brand="${brand}"${cover ? ' data-cover="yes"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex || preview ? '<meta name="robots" content="noindex, nofollow">' : ''}
<meta name="theme-color" content="${themeColour}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(identity.tradingName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:locale" content="en_GB">
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
        ...(c.href ? { item: `${site}${brandPath(c.href, brand)}` } : {}),
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
    ? `<script type="application/ld+json">${JSON.stringify(all.length === 1 ? all[0] : all)}</script>`
    : '';
})()}

  <script>${MARCA_DE_POSICAO}</script>
</head>
<body class="${esc(bodyClass)}" id="top">
<a class="skip" href="#main">Skip to content</a>

${announcement({ brand, shipping })}
${header({ brand, path })}
${crumbs ? breadcrumbs(crumbs, brand) : ''}

<main id="main">
${body}
</main>

${drawer({ brand, identity, counts })}
${footer({ brand, identity })}

<a class="to-top" href="#top" hidden aria-label="Back to the top of the page">${icon('arrowUp', 22)}</a>

<!-- There is no site-wide cookie notice, and that is a decision, not an
     omission. This site sets no analytics and no advertising cookies, the
     typefaces are served from this domain, and nothing else contacts a third
     party. Consent is owed when third-party content actually loads, and the
     only place that happens is the Google map on the contact page — so the
     question is asked there, in front of the map, by whoever wants to see it.

     A banner over every page would also have cost the thing the owner asked
     for by name: at 375x812 it covered the second row of lamps, so a
     first-time visitor saw two instead of the four she asked for. -->

<script src="/assets/${asset.js || 'shop.js'}" defer></script>
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
  return `<p class="announce">Free shipping on orders over €${Number(c.freeOver).toFixed(0)}</p>`;
}

function header({ brand }) {
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
              aria-label="Open the menu">${icon('menu', 24)}<span class="open-menu__word">Menu</span></button>
    </div>

    <a class="head__mark" href="${home}" aria-label="${esc(mark.alt)} — home">
      <img class="mark--dark" src="${mark.src}" alt="${esc(mark.alt)}"
           width="${mark.w}" height="${mark.h}">
      <img class="mark--light" src="${lightMark(mark.src)}" alt="" aria-hidden="true"
           width="${mark.w}" height="${mark.h}">
    </a>

    <div class="head__right">
      <a class="head__sibling" href="${sibling.href}" data-other-brand
         aria-label="Go to ${esc(sibling.name)}, ${esc(sibling.note)}">
        <span class="head__sibling-mark">
          <img class="mark--dark" src="${other.src}" alt="" width="${other.w}" height="${other.h}">
          <img class="mark--light" src="${lightMark(other.src)}" alt=""
               width="${other.w}" height="${other.h}">
        </span><span class="head__sibling-arrow" aria-hidden="true">↗</span>
      </a>
      <a class="icon-btn" href="${brandPath('/cart/', brand)}" aria-label="Basket">
        ${icon('cart', 22)}<span class="cart-count" data-cart-count data-empty="yes"></span>
      </a>
    </div>
  </div>
</header>`;
}

/* A native <dialog> opened with showModal(): focus goes in, stays in, and the
   rest of the page goes inert — three promises aria-modal makes and does not
   keep on its own. */
function drawer({ brand, identity, counts }) {
  const nav = NAV[brand] ?? NAV.ithos;
  const sibling = SIBLING[brand];
  const other = MARK[sibling.name];
  const count = (key) => (counts[key] ? `<span class="drawer__count">${counts[key]}</span>` : '');
  const mark = MARK[brand];

  return `<dialog class="drawer" id="menu" aria-label="Menu">
  <div class="drawer__top">
    <button class="icon-btn close-menu" type="button" aria-label="Close the menu">${icon('close', 24)}</button>
    <img class="drawer__mark" src="${mark.src}" alt="${esc(mark.alt)}" width="${mark.w}" height="${mark.h}">
    <a class="icon-btn drawer__cart" href="${brandPath('/cart/', brand)}" aria-label="Basket">
      ${icon('cart', 22)}<span class="cart-count" data-cart-count data-empty="yes"></span>
    </a>
  </div>

  <div class="drawer__body">
    <nav class="drawer__nav" aria-label="Main">
      ${[...nav, ...NAV_EXTRA].map(([h, t, k]) => `<a href="${brandPath(h, brand)}"><span>${esc(t)}</span>${count(k)}</a>`).join('\n      ')}
    </nav>

  <a class="drawer__sibling" href="${sibling.href}" data-other-brand
     aria-label="Go to ${esc(sibling.name)}, ${esc(sibling.note)}">
    <span class="drawer__sibling-mark">
      <img src="${other.src}" alt="" width="${other.w}" height="${other.h}">
    </span>
    <span class="drawer__sibling-note">${esc(sibling.note)}</span>
    <span aria-hidden="true">↗</span>
  </a>

  </div>

  <div class="drawer__contact">
    <a href="tel:${esc(identity.phone)}">${icon('phone', 18)}<span>${esc(identity.phoneText)}</span></a>
    <p class="drawer__cost">${esc(CALL_COST)}</p>
    <a href="https://wa.me/${esc(identity.whatsapp)}" rel="noopener">${icon('whatsapp', 18)}<span>WhatsApp</span></a>
  </div>
</dialog>`;
}

function breadcrumbs(items, brand) {
  return `<nav class="crumbs shell" aria-label="Breadcrumb">
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
    ? [[i.instagramCathelier, 'cathelier on Instagram', 'instagram']]
    : [[i.instagramIthos, 'ithos on Instagram', 'instagram'],
       [i.facebookIthos, 'ithos on Facebook', 'facebook']];

  const groups = [
    ['Customer care', [
      ['/contact/#faq', 'Questions'],
      ['/legal/shipping-and-returns/', 'Delivery and returns'],
      /* Care and safety is the LAMP manual -- AA cells, the mains remote,
         keeping the cable out of a cot. It is offered where it is true and
         nowhere else: from a cathelier page it would be the only safety page
         that reader ever sees, and it would describe a product with no
         electricity in it. cathelier needs its own, written for keepsakes with
         small parts, magnets and a candle, and those words have to come from
         the owner. */
      ['/legal/returns-form/', 'Cancellation form'],
      [i.complaintsBook, 'Complaints book'],
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
       each shop still has to carry its own: of 55 cathelier pages, 12 had no
       visible route to the pieces or the quote outside the header and the
       drawer, and all 55 had none to how a piece is made. So the group is not
       dropped -- it is narrowed to the shop it belongs to. */
    ['The shop', brand === 'cathelier'
      ? [
        ['/cathelier/', 'Personalised pieces'],
        ['/cathelier/pieces/', 'All the pieces'],
        ['/cathelier/quote/', 'Ask for a quote'],
        ['/cathelier/about/', 'How a piece is made'],
        ['/contact/', 'Contact'],
      ]
      : [
        ['/', 'Wooden night lights'],
        ['/lamps/', 'All the lamps'],
        ['/about/', 'The workshop'],
        ['/care-and-safety/', 'Care and safety'],
        ['/contact/', 'Contact'],
      ]],
    ['Terms', [
      ['/legal/terms/', 'Terms of sale'],
      ['/legal/privacy/', 'Privacy'],
      ['/legal/cancellation/', 'Right to cancel'],
      ['/legal/identification/', 'Who you are buying from'],
    ]],
    ['Talk to us', [
      [`tel:${i.phone}`, i.phoneText, CALL_COST],
      [`https://wa.me/${i.whatsapp}`, 'WhatsApp'],
      [`mailto:${i.email}`, i.email],
    ]],
  ];

  return `<footer class="foot">
  <div class="shell">
    <div class="foot__grid">
      ${groups.map(([name, links]) => `<details class="foot__group" open>
        <summary>${esc(name)}</summary>
        <ul>${links.map(([h, t, note]) => `<li><a href="${esc(brandPath(h, brand))}">${esc(t)}</a>${
          note ? `<span class="foot__note">${esc(note)}</span>` : ''}</li>`).join('')}</ul>
      </details>`).join('\n      ')}
    </div>

    <div class="foot__social">
      ${social.filter(([href]) => href).map(([href, label, ic]) =>
        `<a href="${esc(href)}" rel="noopener" aria-label="${esc(label)}">${icon(ic, 18)}</a>`).join('\n      ')}
    </div>

    <!-- The seller's identification used to be printed here in full, on all 96
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
