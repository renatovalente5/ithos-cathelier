/* ===========================================================================
   The shop, client side. No framework, no build step, no dependencies.
   ===========================================================================
   The basket holds ids, quantities and option ids. It never holds a price.
   Prices are recomputed by the Worker from the catalogue file, which is named
   after the hash of its own contents — so a basket built against an old
   catalogue is refused rather than silently repriced. */

/* Filled in by the build. Empty on the real domain, '/ithos-cathelier' when
   the site is served from a GitHub project page. Every URL this file builds
   has to carry it. */
const BASE = '/ithos-cathelier';
/* Filled in by the build too. Empty means the shop cannot take money, and the
   checkout button says so rather than failing silently. */
const API = '';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const BASKET = 'ic-basket-v1';
const MAP_OK = 'ic-map-v1';

const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
  catch { return fallback; }                 // private window, blocked storage
};
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nothing to do */ } };

const basket = () => read(BASKET, { country: 'PT', lines: [] });
const setBasket = (b) => { save(BASKET, b); paintCount(); };

function paintCount() {
  const n = basket().lines.reduce((t, l) => t + l.qty, 0);
  for (const el of $$('[data-cart-count]')) {
    el.textContent = n ? String(n) : '';
    el.dataset.empty = n ? 'no' : 'yes';
  }
}

let catalogueCache;
async function catalogue() {
  if (catalogueCache) return catalogueCache;
  const hash = (await (await fetch(`${BASE}/data/catalogue-current.txt`)).text()).trim();
  catalogueCache = await (await fetch(`${BASE}/data/catalogue.${hash}.json`)).json();
  catalogueCache.hash = hash;
  return catalogueCache;
}

document.addEventListener('DOMContentLoaded', () => {
  paintCount();

  /* The header's state is derived state of the same kind as the menu's, so
     settle() re-reads it too. Declared here because the drawer block below
     runs first and closes over it. */
  let headSettle = () => {};

  /* --- the drawer -------------------------------------------------------- */
  const drawer = $('#menu');
  const opener = $('.open-menu');
  if (drawer && opener) {
    /* THE LOCK IS DERIVED, NEVER MAINTAINED.
     *
     * `settle()` reads the dialog and makes the page agree with it. It says
     * nothing about what just happened, so it is safe to call from anywhere,
     * in any order, as many times as you like -- and that is the point.
     *
     * The obvious shape is add-on-open / remove-on-close, and it fails twice
     * here, both measured. (1) The close event is QUEUED, so a close-then-open
     * in one turn delivers it after the panel is open again and strips the
     * lock off a panel the reader is looking at. (2) Worse, in the browser I
     * verified this in, `close()` fired no close event at all: the listener
     * was attached -- a synthetic dispatch ran it -- and a real showModal()
     * followed by close() logged nothing. A page left at `overflow: hidden`
     * cannot be scrolled, which for a shop is the worst outcome on the list,
     * so the lock is not allowed to depend on one event arriving.
     *
     * Escape closes a modal dialog natively without passing through any of
     * this, so keydown is a third, independent way for the truth to be
     * re-read. Whichever hooks fire, the answer is the same. */
    const settle = () => {
      document.documentElement.classList.toggle('menu-open', drawer.open);
      opener.setAttribute('aria-expanded', drawer.open ? 'true' : 'false');
      headSettle();
    };
    const giveFocusBack = () => {
      if (drawer.open) return;
      /* focus() on a display:none element is a silent no-op and focus falls to
         <body>, which sends the next Tab back to the top of the document. The
         burger is rendered at every width now, but a window dragged across a
         breakpoint with the panel open is the sort of thing nobody tests. */
      (opener.offsetParent !== null ? opener : $('.head__mark'))?.focus();
    };
    const close = () => { if (drawer.open) drawer.close(); settle(); giveFocusBack(); };

    /* A RELOAD BRINGS THE MENU BACK, AND BRINGS IT BACK BROKEN.
     * Chrome restores the `open` attribute of a <dialog> the way it restores a
     * half-filled form, so reloading with the menu open returns a page whose
     * menu is open NON-MODALLY: no backdrop, no focus trap, the rest of the
     * page not inert -- and showModal() then throws InvalidStateError, because
     * a dialog that is already open cannot be opened again. From that moment
     * the button does nothing at all. Found by driving the browser, not by
     * reading: a plain reload of /lamps/ came back with open="" in markup the
     * server never sent. The existing close-on-link-click covers going BACK,
     * which is a different path and was the only one anybody had walked. */
    if (drawer.open) drawer.close();
    settle();

    opener.addEventListener('click', () => {
      if (drawer.open) drawer.close();   // never showModal() an open dialog

      /* The menu always opens in its resting state. There are no accordions in
         it today -- the owner had both removed -- so this does nothing; it
         stays because the day one comes back it will be needed and the reason
         is not obvious. An open <details> is sticky: the markup ships without
         `open`, so "closed when the menu opens" is true of the FIRST opening
         and of no other. Measured while there still was one: the ten
         occasions expanded were 710px of content in a 470px panel, and a
         returning visitor got a menu that opened already scrolled with the
         telephone below the fold. */
      for (const g of $$('details', drawer)) g.open = false;

      drawer.showModal();
      /* The page behind a modal dialog SCROLLS -- measured, with a real wheel:
         eight ticks moved it 800px with the panel open. Nobody could see that
         while the drawer covered the screen; beside a panel the shop slides
         about. The class is set here and not by `html:has(.drawer[open])`
         because the battery opens the drawer with show() to measure it, and a
         :has() lock would engage for its whole run, take away the scrollbar
         and quietly change every geometry it then read. */
      settle();
      // Focus goes to the CLOSE button, never to the first menu link. It used
      // to go to the link, and the focus ring round it read as "this page is
      // selected" -- the owner saw it on her phone and asked why. On the close
      // button the same ring tells the truth.
      $('.close-menu', drawer)?.focus();
    });

    $('.close-menu', drawer)?.addEventListener('click', close);

    /* Clicking beside the panel closes it. On a phone the menu covers the
       screen and there is no beside; on a wide screen the shop is visible next
       to it, and clicking the shop is what everyone tries first. A click on
       the backdrop reports the <dialog> ITSELF as the target, because a
       backdrop is a pseudo-element and cannot be one.

       But the target alone is not enough. A `click` fires on the nearest
       common ancestor of where the button went down and where it came up, so
       pressing on the telephone number and sliding a few pixels onto the page
       dispatches a click whose target IS the dialog -- and the menu would shut
       under the finger of someone trying to select a phone number. The press
       has to have STARTED outside the panel too. */
    let pressedOutside = false;
    drawer.addEventListener('pointerdown', (ev) => {
      const r = drawer.getBoundingClientRect();
      pressedOutside = ev.clientX < r.left || ev.clientX > r.right
                    || ev.clientY < r.top || ev.clientY > r.bottom;
    });
    drawer.addEventListener('click', (ev) => {
      if (pressedOutside && ev.target === drawer) close();
    });

    // Following a link closes the drawer: without this, going back in the
    // browser restores the page with the drawer still open over it.
    for (const a of $$('a', drawer)) a.addEventListener('click', close);

    drawer.addEventListener('close', () => { settle(); giveFocusBack(); });
    // The third way, for Escape, which reaches none of the above.
    addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') setTimeout(() => { settle(); giveFocusBack(); }, 0);
    });
  }

  /* --- header shrinks on the way down ------------------------------------ */
  const head = $('.head');
  if (head) {
    /* TWO thresholds, and the gap between them has to be WIDER than the
       height the header gives back.
       
       With a single line at 120 the shrink could trigger its own undo.
       Shrinking removes up to 34px of document (ithos at >=64rem, 96 -> 62),
       and at the bottom of a short page the browser clamps the scroll
       position by exactly that much -- so a page whose whole overflow sits
       just past the line shrinks, gets clamped back below it, grows, and
       pumps for as long as anyone looks at it. 240/150 is 90px of band
       against 34px of travel.
       
       240 and not 160 for a second reason, measured: "Skip to content" lands
       at y=123 on a page with breadcrumbs, and 44px lower again if the owner
       turns the campaign line on. A keyboard reader pressing the skip link
       was tripping the old 120 threshold by three pixels -- the page jumped,
       settled, and then slid another 22-34px on its own. */
    const SHRINK_AT = 240, GROW_AT = 150;
    let queued = false;
    const decide = () => {
      queued = false;
      const now = head.dataset.shrunk === 'yes';
      const y = scrollY;
      const next = y >= SHRINK_AT ? true : y <= GROW_AT ? false : now;
      if (next !== now) head.dataset.shrunk = next ? 'yes' : 'no';
    };
    headSettle = decide;

    /* One read and at most one write per FRAME. rAF is not here to make this
       cheaper -- the write is already guarded by the change test. It is here
       to order it: the old handler read scrollY, which can flush a pending
       layout, and then wrote an attribute that invalidates style on the one
       element whose height lays out the rest of the document. */
    addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(decide);
    }, { passive: true });

    /* Decide once, at rest, BEFORE the transitions exist.
       
       A reload or a Back restores the scroll position without firing a single
       scroll event, so the header used to be simply wrong -- full height at
       y=2000 -- until the reader moved. Fixing that alone would have bought a
       new defect: the header would then glide shut half a second after every
       arrival, with the whole page sliding up underneath, for a gesture
       nobody made. So the first decision is taken while nothing is animated,
       and the animation is armed two frames later, once that state has
       painted. Same lesson the panel above carries: the resting state must be
       the correct state, and the animation may only decorate an arrival. */
    let armTimer;
    const arm = () => { head.dataset.anim = 'yes'; };
    const armAfterPaint = () => {
      head.dataset.anim = 'no';
      clearTimeout(armTimer);
      requestAnimationFrame(() => requestAnimationFrame(arm));
      /* And a timer as well, because requestAnimationFrame does not fire at
         all in a document that is not being rendered -- a background tab, or
         a window nobody is looking at. Measured in exactly that state: zero
         frames in 600ms, and the header stayed disarmed for good. Nothing is
         painting there, so there is nothing to animate from and arming early
         costs nothing; what it buys is that the shrink is smooth the first
         time the reader actually sees it. */
      armTimer = setTimeout(arm, 300);
    };
    decide();
    armAfterPaint();
    addEventListener('pageshow', () => { decide(); armAfterPaint(); });
    /* A tab that was scrolled while hidden comes back with a stale header,
       and no scroll event is owed to anyone. Re-read the truth instead. */
    document.addEventListener('visibilitychange', () => { if (!document.hidden) decide(); });

    /* A resize is not a scroll. The wordmark's resting height is a vw clamp,
       so every pixel of a window drag is a new computed height -- and a
       transition would interpolate every one of them, leaving the logo
       trailing the rest of the bar for the whole gesture. */
    let resizeTimer;
    addEventListener('resize', () => {
      head.dataset.anim = 'no';
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(armAfterPaint, 150);
    }, { passive: true });
  }

  /* --- back to top -------------------------------------------------------- */
  const up = $('.to-top');
  if (up) {
    const decide = () => { up.hidden = scrollY < 500; };
    addEventListener('scroll', decide, { passive: true });
    decide();
  }

  /* --- the footer accordion ---------------------------------------------- */
  // Open on a wide screen, closed on a phone. The markup ships them open so
  // that with no JavaScript everything is readable.
  const narrow = matchMedia('(width < 60rem)');
  const foldFooter = () => { for (const g of $$('.foot__group')) g.open = !narrow.matches; };
  foldFooter();
  narrow.addEventListener('change', foldFooter);

  filters();
  cardShots();
  gallery();
  productForm();
  basketPage();
  mapConsent();
  checkout();
  thankYouPage();
  previewLock();
});

/* --- checkout -------------------------------------------------------------
   The browser sends ids, quantities, option ids, a country and the catalogue
   hash it was looking at. Never a price. The Worker reprices from the same
   file that built the page, and refuses with 409 if the catalogue has moved
   under us in the ten minutes GitHub Pages caches it. */
function checkout() {
  const go = $('[data-to-checkout]');
  if (!go) return;

  go.addEventListener('click', async () => {
    if (go.getAttribute('aria-disabled') === 'true') return;
    if (!API) { say('The shop cannot take payments yet.'); return; }

    const cur = basket();
    if (!cur.lines.length) return;

    go.setAttribute('aria-disabled', 'true');
    const wasSaying = go.textContent;
    go.textContent = 'Taking you to payment…';

    try {
      const cat = await catalogue();
      const r = await fetch(`${API}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hash: cat.hash, country: cur.country || 'PT', lines: cur.lines }),
      });
      const data = await r.json().catch(() => ({}));

      if (r.status === 409 && data.error === 'catalogue_changed') {
        catalogueCache = null;
        say('Prices changed while you were looking. The basket has been updated — '
          + 'please check the total and try again.');
        location.reload();
        return;
      }
      if (!r.ok || !data.url) { say(reason(data.error)); return; }
      location.href = data.url;
    } catch {
      say('We could not reach the payment service. Please try again in a moment.');
    } finally {
      go.removeAttribute('aria-disabled');
      go.textContent = wasSaying;
    }
  });

  function say(text) {
    let box = $('[data-checkout-error]');
    if (!box) {
      box = document.createElement('p');
      box.dataset.checkoutError = '';
      box.className = 'small';
      box.style.cssText = 'margin-block-start:.75rem;color:#8C2F1F';
      box.setAttribute('role', 'status');
      go.after(box);
    }
    box.textContent = text;
  }

  // An error code is for us; a person needs a sentence and something to do.
  function reason(code) {
    return ({
      shop_not_open_yet: 'The shop has not opened yet.',
      country_not_served: 'We do not ship to that country yet. Write to us and we will see what we can do.',
      empty_basket: 'Your basket is empty.',
      unknown_product: 'Something in your basket is no longer available. Please reload the page.',
      option_missing: 'Something in your basket is missing a choice. Open it and pick one.',
      payments_not_configured: 'The shop cannot take payments yet.',
      catalogue_unavailable: 'The shop is briefly unavailable. Please try again in a minute.',
    })[code] || 'Something went wrong on our side. Please try again, or write to us.';
  }
}

/* --- the page Stripe sends people back to -------------------------------- */
async function thankYouPage() {
  const state = $('[data-order-state]');
  if (!state) return;
  const id = new URLSearchParams(location.search).get('session_id');
  if (!id || !API) { state.textContent = 'We could not find that order.'; return; }

  try {
    const r = await fetch(`${API}/session?id=${encodeURIComponent(id)}`);
    const s = await r.json();
    if (s.status === 'paid') {
      // The basket is emptied only once the payment is CONFIRMED. Emptying it
      // when the customer leaves for Stripe loses the order of anyone who goes
      // back to change their mind about one line.
      save(BASKET, { country: 'PT', lines: [] });
      paintCount();
      state.hidden = true;
      $('[data-order-ok]').hidden = false;
      $('[data-order-ref]').textContent = s.reference || '—';
    } else {
      state.hidden = true;
      $('[data-order-pending]').hidden = false;
    }
  } catch {
    state.textContent = 'We could not check that order just now. Your confirmation email is the record.';
  }
}

/* --- the one consent question on the site ---------------------------------
   The map is the only third-party content anywhere here, so it is the only
   place a question is owed. It is asked in front of the map, by whoever wants
   to see it, and the answer is remembered for next time. */
function mapConsent() {
  const box = $('[data-map]');
  if (!box) return;
  const show = () => {
    box.innerHTML = '<iframe title="Where the workshop is" loading="lazy"'
      + ' referrerpolicy="no-referrer-when-downgrade"'
      + ' src="https://www.google.com/maps?q=Castelo+Branco,+Portugal&output=embed"></iframe>';
  };
  if (read(MAP_OK, false)) { show(); return; }
  $('[data-map-load]', box)?.addEventListener('click', () => { save(MAP_OK, true); show(); });
}

/* --- the basket page ------------------------------------------------------
   Everything on screen is recomputed from the catalogue, never from anything
   stored in the browser. The basket holds ids, quantities and option ids; a
   price that lived in localStorage would be a price the customer could edit. */
async function basketPage() {
  const wrap = $('[data-basket]');
  if (!wrap) return;
  const empty = $('[data-basket-empty]');
  const linesBox = $('[data-basket-lines]');
  const countrySel = $('[data-country]');

  const cat = await catalogue().catch(() => null);
  if (!cat) { linesBox.innerHTML = '<p class="muted">The basket could not be loaded. Please reload the page.</p>'; return; }

  const b = basket();
  if (countrySel && b.country) countrySel.value = b.country;
  countrySel?.addEventListener('change', () => {
    const cur = basket(); cur.country = countrySel.value; setBasket(cur); paint();
  });

  const euros = (n) => `€${n.toFixed(2).replace('.', ',')}`;

  function priceOf(line) {
    const p = cat.products[line.id];
    if (!p) return null;
    let each = p.price;
    const shown = [];
    for (const o of p.options || []) {
      const value = (line.options || {})[o.id];
      if (value === undefined || value === '') continue;
      if (o.type === 'choice') {
        const v = o.values.find((x) => x.id === value);
        if (!v) continue;
        each += v.extra || 0;
        shown.push(`${o.name}: ${v.name}`);
      } else {
        each += o.extra || 0;
        shown.push(`${o.name}: “${value}”`);
      }
    }
    return { name: p.name, brand: p.brand, photo: p.photo, shown, each, total: each * line.qty };
  }

  function shippingFor(country, goods) {
    const s = cat.shipping;
    const zone = s.zones.find((z) => z.countries.includes(country))
      ?? s.zones.find((z) => z.countries.includes(country.slice(0, 2)));
    if (!zone) return null;
    const c = s.campaign;
    if (c?.active && goods >= c.freeOver && (!c.countries.length || c.countries.includes(country))) return 0;
    return zone.price;
  }

  function paint() {
    const cur = basket();
    const priced = cur.lines.map((l) => ({ line: l, p: priceOf(l) })).filter((x) => x.p);
    // A line whose product left the catalogue is dropped rather than shown at
    // a price nobody can honour.
    if (priced.length !== cur.lines.length) { cur.lines = priced.map((x) => x.line); setBasket(cur); }

    const any = priced.length > 0;
    wrap.hidden = !any;
    if (empty) empty.hidden = any;
    if (!any) return;

    linesBox.innerHTML = priced.map(({ line, p }, i) => `<div class="basket-line">
      <div class="frame">${p.photo
        ? `<img src="${BASE}/media/${p.photo}-200.webp" alt="" width="200" height="200" loading="lazy">` : ''}</div>
      <div>
        <p class="basket-line__name">${p.name}</p>
        ${p.shown.length ? `<p class="basket-line__opts">${p.shown.join(' · ')}</p>` : ''}
        <p class="basket-line__opts">${line.qty} × ${euros(p.each)}</p>
        <button class="basket-line__drop" type="button" data-drop="${i}">Remove</button>
      </div>
      <p class="basket-line__price">${euros(p.total)}</p>
    </div>`).join('');

    for (const btn of $$('[data-drop]', linesBox)) {
      btn.addEventListener('click', () => {
        const c = basket();
        c.lines.splice(Number(btn.dataset.drop), 1);
        setBasket(c); paint();
      });
    }

    const goods = priced.reduce((t, x) => t + x.p.total, 0);
    const post = shippingFor(cur.country || 'PT', goods);
    $('[data-sum-goods]').textContent = euros(goods);
    $('[data-sum-shipping]').textContent = post === null ? 'we do not ship there'
      : post === 0 ? 'free' : euros(post);
    $('[data-sum-total]').textContent = post === null ? '—' : euros(goods + post);
  }

  paint();
}

/* --- catalogue filters ----------------------------------------------------
   They wrap to two rows, with a "+N" that opens the rest. Nothing is ever off
   the screen without a way to know it is there. */
function filters() {
  const box = $('[data-filters]');
  if (!box) return;
  const list = $('[data-product-list]');
  const none = $('[data-no-results]');
  const chips = $$('[data-filter]', box);

  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    for (const other of chips) other.setAttribute('aria-pressed', String(other === b));
    const want = b.dataset.filter;
    let shown = 0;
    for (const card of $$('[data-family]', list)) {
      // A lamp can belong to more than one family, so compare against the list
      // rather than against a single word.
      const show = want === 'all' || card.dataset.family.split(' ').includes(want);
      card.style.display = show ? '' : 'none';
      if (show) shown++;
    }
    if (none) none.hidden = shown > 0;
    open();                                   // a chosen chip must never hide
  });

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'filter filter--more';
  more.hidden = true;
  more.addEventListener('click', open);
  box.appendChild(more);

  let opened = false;
  function open() { opened = true; for (const c of chips) c.hidden = false; more.hidden = true; }

  function fold() {
    if (opened) return;
    for (const c of chips) c.hidden = false;
    more.hidden = false;
    more.textContent = '+0';
    const tops = [...new Set(chips.map((c) => Math.round(c.offsetTop)))].sort((a, b) => a - b);
    if (tops.length <= 2) { more.hidden = true; return; }
    const limit = tops[1];
    let hidden = 0;
    for (const c of chips) if (Math.round(c.offsetTop) > limit) { c.hidden = true; hidden++; }
    more.textContent = `+${hidden}`;
    // The "+N" takes room of its own. If putting it there pushes it onto a
    // third row, hide one more chip until it fits — otherwise the cure adds
    // back the row it came to remove.
    let guard = chips.length;
    while (Math.round(more.offsetTop) > limit && guard-- > 0) {
      const last = chips.filter((c) => !c.hidden).pop();
      if (!last || last === chips[0]) break;  // "All" always stays
      last.hidden = true;
      more.textContent = `+${++hidden}`;
    }
    more.setAttribute('aria-label', `Show ${hidden} more filters`);
  }

  fold();
  addEventListener('resize', fold, { passive: true });
  // Chips are measured with the fallback font until the real one arrives, and
  // the answer changes when it does.
  document.fonts?.ready.then(fold);
}

/* --- the other photographs, on the card ------------------------------------
   Pointing at a card walks through the lamp's other photographs and gently
   grows the picture; leaving puts the first one back. The first photograph is
   the one that frames the piece properly — it is chosen per product in the
   content, never taken to be photograph number one — so the card always
   RETURNS to it rather than stopping wherever the cycle happened to be.

   Only where there is a pointer to hover with. On a phone this would either
   never fire or fire on the tap that was meant to open the lamp, so the whole
   thing is gated on `(hover: hover) and (pointer: fine)`; the dots under the
   frame are the only part a touch screen sees, and they say how many
   photographs are waiting inside.

   Nothing is preloaded. Twenty-six cards times four photographs is a hundred
   requests for pictures almost nobody scrolls to; the swap happens on the
   first hover and the browser fetches then. */
function cardShots() {
  /* THE THREE MOVES.
   *
   * Every change of photograph is the same three, and the third one is the
   * whole design:
   *   1. a second layer takes the next photograph, settled into place with
   *      transitions off, and is NOT shown until it has real pixels;
   *   2. it dissolves in over the first, which stays fully opaque underneath;
   *   3. once the dissolve is done, the FIRST layer is repointed at the same
   *      photograph and the second is snapped back to invisible with the
   *      transition suppressed. Both hold the identical picture at that
   *      instant, so the handover cannot be seen.
   *
   * Move 3 is what makes the card return to its resting shape after every
   * step, not just at the end of the loop: one layer, in flow, opaque,
   * scale 1, showing what it says it is showing. The alternative -- leaving
   * whichever layer happens to be on top -- means the card's correct state
   * depends on an animation having finished, and this project has already
   * paid for that lesson twice.
   *
   * The clicking of a thumbnail works even where the drift does not: it is a
   * deliberate act, so it runs on a phone, under reduced motion, and with a
   * keyboard. Only the automatic drift is gated on a fine pointer. */
  const cards = $$('[data-shots]');
  if (!cards.length) return;

  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DRIFTS = FINE && !CALM;

  const FIRST = 1400;   // before the first change: most hovers are short
  const ZOOM = 2600;    // the dwell, which is also the length of the zoom
  const FADE = 900;     // the dissolve
  const DWELL = 250;    // pointer must stay before anything is fetched
  const WARM = 700;     // deadline on decode, never an open-ended wait

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const card of cards) {
    const shots = card.dataset.shots.split(',').filter(Boolean);
    const frame = $('.card__frame', card);
    const base = frame && $('picture', frame);
    if (!frame || !base || shots.length < 2) continue;
    /* Fill the strip, but only where it is shown. On a phone there is no
       pointer to rest anywhere and the strip is display:none, so not one of
       these images is built and not one byte is fetched. */
    const strip = $('.card__thumbs', card);
    const thumbs = $$('.card__thumb', card);
    const fillStrip = () => {
      if (!strip || strip.classList.contains('ready')) return;
      const dir = card.dataset.dir;
      thumbs.forEach((t, n) => {
        const name = shots[n];
        const im = document.createElement('img');
        im.src = `${BASE}/media/${dir}/${name}-200.webp`;
        im.srcset = `${BASE}/media/${dir}/${name}-120.webp 120w, ${BASE}/media/${dir}/${name}-200.webp 200w`;
        im.sizes = '56px';
        im.width = 200; im.height = 200;
        im.alt = '';
        im.loading = 'lazy';
        im.decoding = 'async';
        im.fetchPriority = 'low';
        t.append(im);
      });
      strip.classList.add('ready');
    };
    /* And it follows the reader down the page. `loading="lazy"` did not help
       here: the images are created after layout, and Chrome's threshold
       reaches about 1250px below the fold, so all sixty-seven were fetched at
       once -- 176 KB for twenty-six cards of which four are on screen. An
       observer builds a card's strip when the card is close to being seen. */
    if (strip && matchMedia('(min-width: 48rem)').matches) {
      if (typeof IntersectionObserver === 'function') {
        const eye = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            fillStrip();
            eye.disconnect();
          }
        }, { rootMargin: '300px' });
        eye.observe(card);
      } else {
        fillStrip();
      }
    }

    let at = 0;          // which photograph layer A is holding
    let chosen = null;   // a thumbnail the reader picked; the drift respects it
    let over = null;     // layer B, while it exists
    let run = 0;         // bumped on every stop, so a stale step gives up

    /* The addresses are NEVER composed, only rewritten. Layer B is a clone of
       the frame's own <picture>, so it already carries the right widths, the
       right `sizes` and the address prefix -- which this project once shipped
       missing for days. Swapping the photograph's name inside them cannot get
       any of that wrong. */
    const rename = (url, name) => url.replace(/\/[^/]+-(\d+)\.(avif|webp)/g, `/${name}-$1.$2`);
    const point = (pic, name) => {
      for (const s of $$('source', pic)) s.srcset = rename(s.srcset, name);
      const im = $('img', pic);
      im.setAttribute('src', rename(im.getAttribute('src'), name));
    };

    /* Real pixels, or no dissolve at all. The deadline aborts the STEP; it
       never licenses a fade into an empty box, because layer A underneath is
       still correct and waiting costs nothing while fading into nothing costs
       the whole card. `decode()` rejects whenever the source changes mid
       flight, so the promise settling is not the test -- the bitmap is. */
    const hasPixels = (pic) => {
      const im = $('img', pic);
      const done = (im.decode ? im.decode() : Promise.resolve()).catch(() => {});
      return Promise.race([done, wait(WARM)]).then(() => im.complete && im.naturalWidth > 0);
    };

    const markThumbs = () => {
      thumbs.forEach((t, n) => {
        const on = n === at;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-pressed', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
    };

    const makeOver = () => {
      const pic = base.cloneNode(true);
      const im = $('img', pic);
      im.setAttribute('alt', '');
      im.setAttribute('loading', 'eager');
      /* The first four cards on a page are built eager and high priority. A
         verbatim clone would inherit that and put a decoration ahead of the
         covers the reader is scrolling towards. */
      im.setAttribute('fetchpriority', 'low');
      pic.setAttribute('aria-hidden', 'true');
      pic.classList.add('over', 'still');
      frame.append(pic);
      return pic;
    };

    /* One step: show `n`, and leave the card at rest holding it. */
    const step = async (n, mine) => {
      if (!over) over = makeOver();
      point(over, shots[n]);
      over.offsetWidth;                 // settle it before anything animates
      over.classList.remove('still');
      if (!(await hasPixels(over))) { clean(); return false; }
      if (mine !== run) return false;

      over.classList.add('up');
      await wait(FADE);
      if (mine !== run) return false;

      at = n;
      point(base, shots[at]);
      markThumbs();
      await hasPixels(base);            // a cache hit: the file is in hand
      if (mine !== run) return false;
      over.classList.add('still');
      over.classList.remove('up');
      over.offsetWidth;
      over.classList.remove('still');

      /* And the zoom starts over. Without this the layer in flow reaches 1.05
         on the first photograph and stays there: the owner asked for the
         picture to creep in a little before each change, "e assim
         sucessivamente", so every photograph has to begin at 1 again. Pinned
         with the transition off and released one reflow later, which is the
         same trick move 3 uses above -- a value set and released in the same
         frame animates from nothing. */
      restartZoom();
      return true;
    };

    const clean = () => {
      if (over) { over.remove(); over = null; }
    };

    const restartZoom = () => {
      if (CALM) return;
      base.classList.add('still');
      base.style.scale = '1';
      base.offsetWidth;
      base.classList.remove('still');
      base.style.scale = '';            // back to the CSS value, which is 1.05
    };

    /* --- the automatic drift ------------------------------------------- */
    let dwellTimer = null;
    let driving = false;

    const drive = async () => {
      const mine = run;
      driving = true;
      card.dataset.showing = 'yes';     // starts the zoom on the layer in flow
      await wait(FIRST);
      while (mine === run) {
        const next = (at + 1) % shots.length;
        if (!(await step(next, mine))) break;
        if (mine !== run) break;
        await wait(ZOOM);
      }
      driving = false;
    };

    const start = () => {
      if (!DRIFTS || driving) return;
      drive();
    };

    const stop = async () => {
      run++;
      clearTimeout(dwellTimer); dwellTimer = null;
      delete card.dataset.showing;
      driving = false;
      clean();
      /* Back to whichever photograph the reader chose, or the cover. */
      base.style.scale = '';
      const back = chosen === null ? 0 : chosen;
      if (at !== back) { at = back; point(base, shots[at]); markThumbs(); }
    };

    /* A pointer crossing a card is not a visitor looking at it. Nothing is
       fetched, cloned or decoded until it has stayed put: a mouse swept across
       the catalogue touches all twenty-six cards in a second, and the old code
       fired an uncancellable request for each one. */
    card.addEventListener('pointerenter', () => {
      clearTimeout(dwellTimer);
      dwellTimer = setTimeout(start, DWELL);
    });
    card.addEventListener('pointerleave', stop);
    card.addEventListener('focusin', () => { clearTimeout(dwellTimer); start(); });
    card.addEventListener('focusout', (e) => { if (!card.contains(e.relatedTarget)) stop(); });

    /* --- choosing one ---------------------------------------------------- */
    thumbs.forEach((t, n) => {
      t.addEventListener('click', async () => {
        run++;                          // a choice outranks the drift
        clearTimeout(dwellTimer);
        driving = false;
        delete card.dataset.showing;
        chosen = n;
        if (n === at) { clean(); markThumbs(); return; }
        const mine = run;
        if (CALM || !over) {
          // No dissolve asked for, or nothing to dissolve from: go straight.
          at = n; point(base, shots[at]); markThumbs(); clean();
          return;
        }
        await step(n, mine);
        clean();
      });
      /* Arrow keys move within the strip, which is why only the chosen
         thumbnail is tabbable: twenty-six cards times six photographs would
         otherwise be a hundred and fifty-six stops between the filters and
         the footer. */
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const to = thumbs[(n + d + thumbs.length) % thumbs.length];
        to.tabIndex = 0; to.focus();
      });
    });
  }
}


/* --- product gallery ------------------------------------------------------ */
function gallery() {
  const g = $('[data-gallery]');
  if (!g) return;
  const track = $('[data-gallery-track]', g);
  const slides = $$('.gallery__slide', track);
  const thumbs = $$('[data-gallery-go]');
  let at = 0;

  const go = (i) => {
    at = (i + slides.length) % slides.length;
    track.style.translate = `${-at * 100}% 0`;
    for (const t of thumbs) t.setAttribute('aria-selected', String(Number(t.dataset.galleryGo) === at));
  };
  $('[data-gallery-prev]', g)?.addEventListener('click', () => go(at - 1));
  $('[data-gallery-next]', g)?.addEventListener('click', () => go(at + 1));
  for (const t of thumbs) t.addEventListener('click', () => go(Number(t.dataset.galleryGo)));

  // Swipe, because this is a phone-first shop.
  let x0 = null;
  g.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  g.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(at + (dx < 0 ? 1 : -1));
    x0 = null;
  }, { passive: true });
}

/* --- add to basket -------------------------------------------------------- */
function productForm() {
  const form = $('[data-product-form]');
  const add = $('[data-add]');
  if (!form || !add) return;
  // The id comes from the FORM, which is the only element that knows which
  // product this page is about. It used to come from `$('[data-product]')`,
  // and on a product page the first element with that attribute is a related
  // product at the bottom: adding a fox to the basket put a mouse in it. It
  // only shows by driving the page, never by reading it.
  const slug = form.dataset.productId;

  const qty = $('.qty__input', form);
  $('[data-qty-down]', form)?.addEventListener('click', () => { qty.value = Math.max(1, +qty.value - 1); });
  $('[data-qty-up]', form)?.addEventListener('click', () => { qty.value = Math.min(20, +qty.value + 1); });

  add.addEventListener('click', () => {
    if (add.getAttribute('aria-disabled') === 'true') return;
    const options = {};
    for (const el of $$('[data-option]', form)) {
      if (el.type === 'radio' && !el.checked) continue;
      if (el.value.trim()) options[el.dataset.option] = el.value.trim();
    }
    const b = basket();
    const same = b.lines.find((l) => l.id === slug && JSON.stringify(l.options) === JSON.stringify(options));
    if (same) same.qty = Math.min(20, same.qty + Number(qty.value));
    else b.lines.push({ id: slug, qty: Number(qty.value), options });
    setBasket(b);

    add.textContent = 'Added';
    setTimeout(() => { add.textContent = 'Add to basket'; }, 1600);
  });
}

/* --- the shop is not open yet --------------------------------------------
   Every button that leads to money is switched off, with the reason written
   under it. `aria-disabled` and not `disabled`, so the button keeps its place
   in the tab order and a screen reader can still read why. The real stop is at
   the Worker, which refuses to open a payment session while the catalogue says
   preview — this is only so nobody wastes their time. */
async function previewLock() {
  const cat = await catalogue().catch(() => null);
  if (!cat?.preview) return;
  for (const b of $$('[data-add], [data-pay], [data-to-checkout]')) {
    b.setAttribute('aria-disabled', 'true');
    b.title = 'The shop has not opened yet.';
    const note = document.createElement('p');
    note.className = 'small muted';
    note.style.marginBlockStart = '.5rem';
    note.textContent = 'The shop has not opened yet — you cannot order just now.';
    b.after(note);
  }
}
