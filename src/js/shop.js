/* ===========================================================================
   The shop, client side. No framework, no build step, no dependencies.
   ===========================================================================
   The basket holds ids, quantities and option ids. It never holds a price.
   Prices are recomputed by the Worker from the catalogue file, which is named
   after the hash of its own contents — so a basket built against an old
   catalogue is refused rather than silently repriced. */

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
  const hash = (await (await fetch('/data/catalogue-current.txt')).text()).trim();
  catalogueCache = await (await fetch(`/data/catalogue.${hash}.json`)).json();
  catalogueCache.hash = hash;
  return catalogueCache;
}

document.addEventListener('DOMContentLoaded', () => {
  paintCount();

  /* --- the drawer -------------------------------------------------------- */
  const drawer = $('#menu');
  const opener = $('.open-menu');
  if (drawer && opener) {
    const close = () => { if (drawer.open) drawer.close(); };
    opener.addEventListener('click', () => {
      drawer.showModal();
      opener.setAttribute('aria-expanded', 'true');
      // Focus goes to the CLOSE button, never to the first menu link. It used
      // to go to the link, and the focus ring round it read as "this page is
      // selected" — the owner saw it on her phone and asked why. On the close
      // button the same ring tells the truth. The ring itself stays: it is
      // what keyboard users navigate by.
      $('.close-menu', drawer)?.focus();
    });
    $('.close-menu', drawer)?.addEventListener('click', close);
    // Following a link closes the drawer: without this, going back in the
    // browser restores the page with the drawer still open over it.
    for (const a of $$('a', drawer)) a.addEventListener('click', close);
    drawer.addEventListener('close', () => {
      opener.setAttribute('aria-expanded', 'false');
      opener.focus();
    });
  }

  /* --- header shrinks on the way down ------------------------------------ */
  const head = $('.head');
  if (head) {
    let last = 0;
    addEventListener('scroll', () => {
      const y = scrollY;
      if (Math.abs(y - last) < 8) return;
      head.dataset.shrunk = y > 120 ? 'yes' : 'no';
      last = y;
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
  gallery();
  productForm();
  basketPage();
  mapConsent();
  previewLock();
});

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
    for (const [id, value] of Object.entries(line.options || {})) {
      const opt = p.options[id];
      if (!opt) continue;
      if (opt.type === 'choice') each += opt.values[value] ?? 0;
      else each += opt.extra || 0;
    }
    return { name: p.name, brand: p.brand, photo: p.photo, each, total: each * line.qty };
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
        ? `<img src="/media/${p.photo}-200.webp" alt="" width="200" height="200" loading="lazy">` : ''}</div>
      <div>
        <p class="basket-line__name">${p.name}</p>
        ${Object.entries(line.options || {}).length
          ? `<p class="basket-line__opts">${Object.entries(line.options).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>` : ''}
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
