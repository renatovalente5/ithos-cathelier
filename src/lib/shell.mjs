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
    ['/cathelier/', 'Occasions', 'occasions'],
    ['/cathelier/pieces/', 'All pieces', 'pieces'],
    ['/cathelier/quote/', 'Ask for a quote'],
    ['/cathelier/about/', 'The workshop'],
  ],
};

/** Only in the drawer: things people look for that do not earn a place in the bar. */
const NAV_EXTRA = [['/contact/#faq', 'Questions']];

/* The other brand is always reachable, and always announces itself as
   elsewhere: its own name, its own lettering, and an arrow that points out. */
export const SIBLING = {
  ithos: { href: '/cathelier/', name: 'cathelier', note: 'personalised pieces' },
  cathelier: { href: '/', name: 'ithos', note: 'wooden night lights' },
};

const MARK = {
  ithos: { src: '/assets/ithos-wordmark.svg', w: 119, h: 120, alt: 'ithos' },
  cathelier: { src: '/assets/cathelier.svg', w: 117, h: 54, alt: 'cathelier' },
};

const CALL_COST = '(Call to the national mobile network)';

export function page(o) {
  const {
    brand = 'ithos', title, description, path, body,
    site, identity, image, schema = [], counts = {},
    bodyClass = '', noindex = false, crumbs = null, extraHead = '', preview = false,
  } = o;

  const abs = (p) => `${site}${p}`;
  const canonical = abs(path);
  const themeColour = brand === 'ithos' ? '#FFFFFF' : '#FFF8F2';
  const og = image ? (image.startsWith('http') ? image : abs(image)) : abs('/assets/share.jpg');

  return `<!doctype html>
<html lang="en" data-brand="${brand}">
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
<link rel="stylesheet" href="/assets/styles.css">
${extraHead}
${schema.length ? `<script type="application/ld+json">${JSON.stringify(schema.length === 1 ? schema[0] : schema)}</script>` : ''}
</head>
<body class="${esc(bodyClass)}" id="top">
<a class="skip" href="#main">Skip to content</a>

${trustStrip(brand)}
${header({ brand, path })}
${crumbs ? breadcrumbs(crumbs) : ''}

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

<script src="/assets/shop.js" defer></script>
</body>
</html>
`;
}

/* --- the strip above everything -------------------------------------------
   Three promises, in the place the model shop puts them. On a phone only the
   first survives: three of them stacked is a screen of reassurance before a
   single product, which is the opposite of reassuring. */
function trustStrip(brand) {
  const items = brand === 'ithos'
    ? [['hand', 'Made by hand in Castelo Branco'],
       ['leaf', 'Solid pine, water-based paints'],
       ['truck', 'Shipped across Europe']]
    : [['hand', 'Cut and engraved to order'],
       ['shield', 'A proof to approve before we cut'],
       ['truck', 'Shipped across Europe']];
  return `<div class="trust">
  <div class="shell trust__row">
    ${items.map(([i, t]) => `<span class="trust__item">${icon(i, 15)}<span>${esc(t)}</span></span>`).join('\n    ')}
  </div>
</div>`;
}

function header({ brand, path }) {
  const nav = NAV[brand] ?? NAV.ithos;
  const mark = MARK[brand];
  const home = brand === 'cathelier' ? '/cathelier/' : '/';
  const sibling = SIBLING[brand];

  return `<header class="head" data-shrunk="no">
  <div class="shell head__row">
    <button class="icon-btn open-menu" type="button" aria-expanded="false" aria-controls="menu"
            aria-label="Open the menu">${icon('menu', 24)}</button>

    <nav class="nav-desktop" aria-label="Main">
      ${nav.map(([h, t]) => `<a href="${h}"${path === h ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('\n      ')}
    </nav>

    <a class="head__mark" href="${home}" aria-label="${esc(mark.alt)} — home">
      <img src="${mark.src}" alt="${esc(mark.alt)}" width="${mark.w}" height="${mark.h}">
    </a>

    <div class="head__actions">
      <a class="head__sibling" href="${sibling.href}" data-other-brand
         aria-label="Go to ${esc(sibling.name)}, ${esc(sibling.note)}">
        <span>${esc(sibling.name)}</span><span aria-hidden="true">↗</span>
      </a>
      <a class="icon-btn" href="/cart/" aria-label="Basket">
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
  const count = (key) => (counts[key] ? `<span class="drawer__count">${counts[key]}</span>` : '');
  const mark = MARK[brand];

  return `<dialog class="drawer" id="menu" aria-label="Menu">
  <div class="drawer__top">
    <button class="icon-btn close-menu" type="button" aria-label="Close the menu">${icon('close', 24)}</button>
    <img class="drawer__mark" src="${mark.src}" alt="${esc(mark.alt)}" width="${mark.w}" height="${mark.h}">
    <a class="icon-btn" href="/cart/" aria-label="Basket">
      ${icon('cart', 22)}<span class="cart-count" data-cart-count data-empty="yes"></span>
    </a>
  </div>

  <nav class="drawer__nav" aria-label="Main">
    ${[...nav, ...NAV_EXTRA].map(([h, t, k]) => `<a href="${h}"><span>${esc(t)}</span>${count(k)}</a>`).join('\n    ')}
  </nav>

  <a class="drawer__sibling" href="${sibling.href}" data-other-brand
     aria-label="Go to ${esc(sibling.name)}, ${esc(sibling.note)}">
    <span class="drawer__sibling-name">${esc(sibling.name)}</span>
    <span class="drawer__sibling-note">${esc(sibling.note)}</span>
    <span aria-hidden="true">↗</span>
  </a>

  <div class="drawer__contact">
    <a href="tel:${esc(identity.phone)}">${icon('phone', 18)}<span>${esc(identity.phoneText)}</span></a>
    <a href="https://wa.me/${esc(identity.whatsapp)}" rel="noopener">${icon('whatsapp', 18)}<span>WhatsApp</span></a>
    <p class="drawer__cost">${esc(CALL_COST)}</p>
  </div>
</dialog>`;
}

function breadcrumbs(items) {
  return `<nav class="crumbs shell" aria-label="Breadcrumb">
  <ol>${items.map((it, i) => (i === items.length - 1
    ? `<li><span aria-current="page">${esc(it.name)}</span></li>`
    : `<li><a href="${it.href}">${esc(it.name)}</a></li>`)).join('')}</ol>
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
  const address = [i.street, [i.postcode, i.town].filter(Boolean).join(' '), i.country].filter(Boolean).join(' · ');

  const social = brand === 'cathelier'
    ? [[i.instagramCathelier, 'cathelier on Instagram', 'instagram']]
    : [[i.instagramIthos, 'ithos on Instagram', 'instagram'],
       [i.facebookIthos, 'ithos on Facebook', 'facebook']];

  const groups = [
    ['Customer care', [
      ['/contact/#faq', 'Questions'],
      ['/legal/shipping-and-returns/', 'Delivery and returns'],
      ['/care-and-safety/', 'Care and safety'],
      ['/legal/returns-form/', 'Cancellation form'],
    ]],
    ['The shop', [
      ['/about/', 'The workshop'],
      ['/lamps/', 'Wooden night lights'],
      ['/cathelier/', 'Personalised pieces'],
      ['/contact/', 'Contact'],
    ]],
    ['Terms', [
      ['/legal/terms/', 'Terms of sale'],
      ['/legal/privacy/', 'Privacy'],
      ['/legal/cancellation/', 'Right to cancel'],
      ['/legal/identification/', 'Who you are buying from'],
    ]],
    ['Talk to us', [
      [`tel:${i.phone}`, i.phoneText],
      [`https://wa.me/${i.whatsapp}`, 'WhatsApp'],
      [`mailto:${i.email}`, i.email],
    ]],
  ];

  return `<footer class="foot">
  <div class="shell">
    <div class="foot__grid">
      ${groups.map(([name, links]) => `<details class="foot__group" open>
        <summary>${esc(name)}</summary>
        <ul>${links.map(([h, t]) => `<li><a href="${esc(h)}">${esc(t)}</a></li>`).join('')}</ul>
      </details>`).join('\n      ')}
    </div>

    <p class="foot__cost">${esc(CALL_COST)}</p>

    <div class="foot__social">
      ${social.filter(([href]) => href).map(([href, label, ic]) =>
        `<a href="${esc(href)}" rel="noopener" aria-label="${esc(label)}">${icon(ic, 18)}</a>`).join('\n      ')}
    </div>

    <div class="foot__end">
      <p>${esc(i.tradingName)} · ${esc(i.legalName)}${address ? ` · ${esc(address)}` : ''}
         · Tax no. ${esc(i.taxNumber)}</p>
      <p><a href="${esc(i.complaintsBook)}" rel="noopener">Complaints book</a> ·
         Out-of-court dispute resolution: <a href="${esc(i.adr.site)}" rel="noopener">${esc(i.adr.name.split('—')[0].trim())}</a></p>
    </div>
  </div>
</footer>`;
}
