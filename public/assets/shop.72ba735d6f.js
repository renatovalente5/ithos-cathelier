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
const BASE = '';
/* Filled in by the build too. Empty means the shop cannot take money, and the
   checkout button says so rather than failing silently. */
const API = '';
/* Filled in by the build from src/lib/redirects.mjs: an old filter word, shared
   before the collections changed, and the one it became. */
const FRAGMENTOS_ANTIGOS = {"mothers-day":"special-days","fathers-day":"special-days","childrens-day":"names","home":"wall-decor","awards":"custom"};

/* AS FRASES VÊM DE FORA, NA LÍNGUA DA PÁGINA.
   Este ficheiro é um só para o site todo; o que ele escreve no ecrã está em
   window.TEXTOS, que /assets/textos.<língua>.<hash>.js enche antes dele (sai
   de src/i18n/<língua>/js.json, e as chaves vão sem o «js.»). Uma frase que
   falte não pode partir a loja: aparece entre colchetes, que se vê, e deixa um
   erro na consola, que se procura -- mas o botão continua a funcionar.
   `hasOwn` e não `TEXTOS[chave]`: o objecto herda do Object.prototype, e a
   chave «constructor» devolvia uma função em vez de dizer que falta. */
const frasesEmFalta = new Set();
function tj(chave, vars) {
  try {
    const textos = window.TEXTOS;
    const s = textos && typeof textos === 'object' && Object.hasOwn(textos, chave) ? textos[chave] : undefined;
    if (typeof s !== 'string') {
      if (!frasesEmFalta.has(chave)) {
        frasesEmFalta.add(chave);
        console.error(`i18n: não há a frase «${chave}» em window.TEXTOS`);
      }
      return `[${chave}]`;
    }
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : m)) : s;
  } catch (e) {
    console.error(`i18n: a frase «${chave}» não se deixou escrever`, e);
    return `[${chave}]`;
  }
}
/** Singular e plural: lê «<chave>.um» ou «<chave>.varios», com {n}. */
const tjn = (chave, n, vars = {}) => tj(`${chave}.${n === 1 ? 'um' : 'varios'}`, { n, ...vars });

/* A LÍNGUA E O PREFIXO DA PÁGINA. A língua da raiz não leva prefixo; as outras
   vivem em /<língua>/, e o <html> di-lo em data-prefixo. As moradas de PÁGINAS
   que este ficheiro constrói levam-no, a par do BASE; as de /media/, /data/ e
   /assets/ não, porque são os mesmos ficheiros para todas as línguas. */
const LINGUA = (document.documentElement.lang || '').toLowerCase().split('-')[0];
const PREFIXO = document.documentElement.dataset.prefixo || '';
const pagina = (caminho) => `${BASE}${PREFIXO}${caminho}`;
/* As datas por extenso: o inglês da loja é o britânico («24 September 2026»);
   as outras línguas usam o atributo lang tal como vem («pt-PT»). */
const LOCALE_DATAS = LINGUA === 'en' ? 'en-GB' : (document.documentElement.lang || 'en-GB');

/* A morada da página de pagamento vem do Worker, absoluta e SEM língua: o
   Worker não sabe em que língua o comprador está. Se for uma morada deste
   site, ganha aqui o prefixo da página; uma morada de fora -- o formulário do
   cartão, o Pay by Link -- passa como veio. */
function naLingua(url) {
  if (!PREFIXO) return url;
  try {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin || !u.pathname.startsWith(`${BASE}/`)
      || u.pathname.startsWith(`${BASE}${PREFIXO}/`)) return url;
    u.pathname = `${BASE}${PREFIXO}${u.pathname.slice(BASE.length)}`;
    return u.href;
  } catch { return url; }
}

/* O PREÇO ESCREVE-SE COMO A LÍNGUA O ESCREVE: «€24,00» em inglês e «24,00 €»
   em português. A vírgula decimal é a da loja nas duas; o sítio do símbolo é
   a frase «euros» do dicionário. */
const dinheiro = (n) => tj('euros', { n: Number(n).toFixed(2).replace('.', ',') });

/* O NOME DA PEÇA NA LÍNGUA DA PÁGINA. O catálogo é um só, na língua de origem,
   porque é dele que o Worker tira preços e nomes para os emails; os nomes nas
   outras línguas viajam ao lado, em cat.i18n[<língua>][<slug>]. Na língua de
   origem não há i18n, e o que falte numa tradução fica com o nome de origem. */
const proprio = (o, k) => (o && typeof o === 'object' && Object.hasOwn(o, k) ? o[k] : undefined);
const traducaoDe = (cat, slug) => proprio(proprio(cat?.i18n, LINGUA), slug);
const opcaoTraduzida = (cat, slug, o) => proprio(proprio(traducaoDe(cat, slug), 'options'), o.id);
const nomeDaPeca = (cat, slug, p) => proprio(traducaoDe(cat, slug), 'name') || p.name;
const nomeDaOpcao = (cat, slug, o) => proprio(opcaoTraduzida(cat, slug, o), 'name') || o.name;
const nomeDoValor = (cat, slug, o, v) => proprio(proprio(opcaoTraduzida(cat, slug, o), 'values'), v.id) || v.name;

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

/* --- resellers ---------------------------------------------------------------
   A reseller signs in on /resellers/ (their NIF, then a button or a code from
   an email) and gets a signed session. With it, every page asks the Worker for
   the reseller's discount per piece and paints it next to the retail price.

   NOTHING HERE IS TRUSTED FOR MONEY. The discounts are shown so the reseller
   can see them; the price that is charged is worked out again by the Worker,
   which checks the session, that the reseller is still active, and that the
   order carries their NIF.

   Where the session lives: sessionStorage, which ends with the tab -- so a
   shop's counter tablet does not keep showing the reseller's margin to the
   next customer. localStorage only if they tick "keep me signed in", which
   comes unticked: remembering someone on a device is theirs to ask for.
   A visitor who never signs in has nothing written on their device and
   costs the Worker no request at all. */
const REVENDA = 'ic-revenda-v1';

function sessaoRevenda() {
  for (const nome of ['sessionStorage', 'localStorage']) {
    try {
      const v = JSON.parse(window[nome].getItem(REVENDA) || 'null');
      if (v && typeof v.sessao === 'string') return v;
    } catch { /* storage blocked: behave as signed out */ }
  }
  return null;
}

function guardarRevenda(dados, manter) {
  try { window[manter ? 'sessionStorage' : 'localStorage'].removeItem(REVENDA); } catch { /* nothing to clear */ }
  try { window[manter ? 'localStorage' : 'sessionStorage'].setItem(REVENDA, JSON.stringify({ ...dados, manter: Boolean(manter) })); } catch { /* storage blocked */ }
}

function esquecerRevenda() {
  for (const nome of ['sessionStorage', 'localStorage']) {
    try { window[nome].removeItem(REVENDA); } catch { /* nothing to clear */ }
  }
  Object.assign(revenda, { activa: false, sessao: null, nif: null, firma: null, versao: null, descontos: {}, stock: null });
}

const revenda = { activa: false, sessao: null, nif: null, firma: null, versao: null, descontos: {}, stock: null };

/* Asks the Worker for this reseller's discounts. A 401 means the session ended
   -- expired, signed out elsewhere, or the shop switched the reseller off --
   and the page quietly goes back to retail. */
async function carregarRevenda({ fresco = false } = {}) {
  const s = sessaoRevenda();
  if (!s || !API) return revenda;
  try {
    const r = await fetch(`${API}/revenda/precos`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessao: s.sessao, fresco }),
    });
    if (r.status === 401) {
      esquecerRevenda();
      avisarDepois(tj('revenda.sessaoTerminou'));
      avisoRevenda();
      return revenda;
    }
    if (!r.ok) return revenda;
    const j = await r.json();
    Object.assign(revenda, {
      activa: true, sessao: s.sessao, nif: j.nif, firma: j.firma, versao: j.versao, descontos: j.descontos || {},
      /* How many of each lamp are free. Only resellers get the numbers -- the
         owner's rule; everyone else is told "in stock" or "out of stock". */
      stock: j.stock && typeof j.stock === 'object' ? j.stock : null,
    });
  } catch { /* offline: stay on retail rather than guess */ }
  return revenda;
}
let revendaPronta = null;
/* After a 409 from the checkout the page asks for the table fresh, or a copy
   the Worker kept for a minute would show the old version again. */
let revendaFresca = false;
try { revendaFresca = sessionStorage.getItem('ic-revenda-fresca') === '1'; sessionStorage.removeItem('ic-revenda-fresca'); } catch { /* storage blocked */ }
const esperarRevenda = () => (revendaPronta ??= carregarRevenda({ fresco: revendaFresca }));

/** The discount on one piece, in euros, or 0. `preco` is ALWAYS the product's
 *  base price, `p.price` -- the same condition the Worker applies. */
function descontoDe(slug, preco) {
  if (!revenda.activa) return 0;
  const d = (revenda.descontos[slug] || 0) / 100;
  return d > 0 && d < preco ? d : 0;
}

/* THE SAME "FROM" AS THE CARD, and as what the Worker charges: the base price
   plus the cheapest value still available in each required choice. It is
   fromPrice() in src/lib/ithos.mjs, again. The product page and the price list
   used p.price on its own -- identical today, but the day the owner sells out
   the small acorn the page would have announced a price nobody can pay. */
function desdeDe(p) {
  const haveable = (o) => {
    const on = o.values.filter((v) => v.available !== false);
    return on.length ? on : o.values;
  };
  return (p.options || []).filter((o) => o.type === 'choice' && o.required)
    .reduce((sum, o) => sum + Math.min(...haveable(o).map((v) => v.extra || 0)), p.price);
}

/* A notice that survives a reload. The checkout reloads the page when a
   reseller's session ends or their prices change, and a sentence written
   before the reload vanished with it -- the reseller saw retail prices come
   back and no word of why. */
const AVISO = 'ic-revenda-aviso';
function avisarDepois(texto) { try { sessionStorage.setItem(AVISO, texto); } catch { /* storage blocked */ } }
function avisoRevenda() {
  let texto = null;
  try { texto = sessionStorage.getItem(AVISO); sessionStorage.removeItem(AVISO); } catch { /* storage blocked */ }
  const main = $('main');
  if (!texto || !main) return;
  const nota = document.createElement('p');
  nota.className = 'rv-aviso';
  nota.setAttribute('role', 'status');
  nota.textContent = texto;
  main.prepend(nota);
}

const eurosRv = (n) => dinheiro(n);
const escRv = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* Paints the reseller's price on every card and on the product page, and a
   bar that says the mode is on. Retail stays on the page, labelled as the
   recommended retail price: the reseller sets their own (Reg. (EU) 2022/720,
   art. 4(a)). */
async function revendaNaPagina() {
  await esperarRevenda();
  if (!revenda.activa) return;
  document.documentElement.classList.add('is-reseller');

  const main = $('main');
  if (main && !$('[data-rv-bar]')) {
    const bar = document.createElement('div');
    bar.className = 'rv-bar';
    bar.dataset.rvBar = '';
    bar.innerHTML = `<span>${tj('revenda.barra', { firma: escRv(revenda.firma || revenda.nif) })}</span>
      <a href="${pagina('/resellers/')}">${escRv(tj('revenda.tabela'))}</a>
      <button type="button" data-rv-out>${escRv(tj('revenda.sair'))}</button>`;
    main.prepend(bar);
    $('[data-rv-out]', bar).addEventListener('click', () => { esquecerRevenda(); location.reload(); });
  }

  const cat = await catalogue().catch(() => null);
  for (const card of $$('article.card[data-product]')) {
    const p = cat?.products[card.dataset.product];
    if (!p) continue;
    const low = desdeDe(p);
    const d = descontoDe(card.dataset.product, p.price);
    const alvo = $('.card__price', card);
    /* A card with no reseller price says nothing: with the bar on top saying
       the mode is on, silence already means "no discount", and the same
       sentence under 24 of 26 cards was noise. The product page and the price
       list say it in words. */
    if (!alvo || !d || $('.rv-price', card)) continue;
    /* «Desde» quando o cartão o diz, e isto lê-se da FORMA do cartão e não da
       palavra: procurar «from» no texto deixava de funcionar no dia em que o
       cartão passasse a dizer «desde». Um candeeiro com preços diferentes
       leva o <span class="card__from">; uma peça da cathelier diz-o sempre. */
    const temDesde = p.brand === 'cathelier' || Boolean($('.card__from', alvo));
    alvo.insertAdjacentHTML('afterend',
      `<p class="rv-price">${tj(temDesde ? 'revenda.cartaoDesde' : 'revenda.cartao', { preco: eurosRv(low - d), desconto: eurosRv(d) })}</p>`);
  }

  const form = $('[data-product-form]');
  const preco = $('.product__price');
  if (form && preco && !$('.rv-price', preco.parentElement)) {
    const p = cat?.products[form.dataset.productId];
    if (p) {
      const d = descontoDe(form.dataset.productId, p.price);
      preco.insertAdjacentHTML('afterend', d
        ? `<p class="rv-price rv-price--big">${tj('revenda.ficha', { desconto: eurosRv(d), preco: eurosRv(desdeDe(p) - d) })}</p>`
        : `<p class="rv-price rv-price--none">${escRv(tj('revenda.fichaSemPreco'))}</p>`);
    }
  }
}

/* --- stock -------------------------------------------------------------------
   The owner's rules: a lamp in stock leaves the workshop in a few working days;
   one out of stock can still be bought, and is made -- three to four weeks.
   The public sees "in stock" or "out of stock"; only resellers see how many.

   NOTHING HERE DECIDES. The Worker reserves the unit at checkout, one buyer at
   a time, and that is the only answer that counts. The page asks so that what
   the buyer reads before paying is what they get; when the last one goes to
   someone else in between, the Worker says so (409) and the page tells the
   buyer and lets them choose to wait -- it never switches the lead time in
   silence.

   `null` means NOBODY COULD SAY (no Worker, offline) and is not "none": the
   page then shows the slow case, which is true of every lamp. */
let stockPromessa = null;
const stockPublico = () => (stockPromessa ??= (async () => {
  if (!API) return null;
  try {
    const r = await fetch(`${API}/stock`);
    if (!r.ok) return null;
    const j = await r.json();
    return new Set(Array.isArray(j.skus) ? j.skus : []);
  } catch { return null; }
})());

/** The stock units one choice of one product uses -- the Worker's `skusDe`,
    mirrored. A lamp uses itself; a model uses that model; "Both together"
    uses one of each. Cathelier pieces carry no `stock` and give null. */
function skusDaEscolha(p, options) {
  const st = p?.stock;
  if (!st) return null;
  const chave = st.option ? String((options || {})[st.option] ?? '') : '';
  const skus = st.skus?.[chave];
  return Array.isArray(skus) && skus.length ? skus : null;
}

/** How many of a choice a reseller could take: the scarcest shelf it uses. */
const quantosHa = (skus, livres) => Math.min(...skus.map((k) => livres?.[k] ?? 0));

/* THE LINE UNDER THE PRICE on a lamp's page. It is drawn with the slow case
   and kept invisible while the script asks (html[data-js] in the CSS), so the
   reader never sees "Out of stock" turn into "In stock". It is shown after the
   answer, or after two and a half seconds whatever happens: a line that waits
   forever for a slow Worker is worse than the slow case. */
async function stockNaFicha() {
  const linha = $('[data-lead]');
  const form = $('[data-product-form]');
  if (!linha || !form) return;
  const texto = $('[data-lead-text]', linha);
  const mostrar = () => linha.setAttribute('data-lead-ready', '');
  const travao = setTimeout(mostrar, 2500);

  const [cat, ha] = await Promise.all([catalogue().catch(() => null), stockPublico(), esperarRevenda()]);
  const p = cat?.products[form.dataset.productId];
  const pintar = () => {
    const escolha = {};
    for (const el of $$('[data-option]', form)) {
      if (el.type === 'radio' && !el.checked) continue;
      if (el.value) escolha[el.dataset.option] = el.value;
    }
    const skus = skusDaEscolha(p, escolha);
    let frase = linha.dataset.leadNone;
    if (skus && revenda.activa && revenda.stock) {
      const n = quantosHa(skus, revenda.stock);
      if (n > 0) frase = tj('stock.revendaFicha', { n, prazo: linha.dataset.leadDays });
    } else if (skus && ha && skus.every((k) => ha.has(k))) {
      frase = linha.dataset.leadStock;
    }
    if (texto) texto.textContent = frase;
  };
  pintar();
  clearTimeout(travao);
  mostrar();
  form.addEventListener('change', pintar);
}

/* What the basket last showed the buyer: `stock` or `encomenda`. The checkout
   sends it, and the Worker refuses (409) an order that was shown "in stock"
   and can no longer come from the shelf. After such a refusal it stays
   `encomenda` until the page reloads: the buyer has just been told. */
let prazoNoCesto = 'encomenda';
/* The shelves the Worker has just said are empty (the 409's `semStock`). They
   count as empty from then on, whatever an older answer said. `esgotouAgora`
   is for a 409 that named none: the whole basket is then made to order. */
const esgotados = new Set();
let esgotouAgora = false;
let reavaliarCesto = () => {};

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
      /* O FOCO ATERRA NO PAINEL, e não num botão dentro dele.
       *
       * Isto já esteve em dois sítios errados. Primeiro no primeiro link do
       * menu, e o anel à volta dele lia-se como «esta página é a que está
       * seleccionada» -- a dona viu no telemóvel e perguntou porquê. Passou
       * para o X de fechar, e ela viu o anel outra vez, à volta do X.
       *
       * A causa não é o sítio, é o gesto: um `.focus()` feito por JavaScript
       * conta como foco de teclado no WebKit, por isso o Safari desenha o anel
       * mesmo quando quem abriu o menu lhe tocou com o dedo.
       *
       * O painel resolve as duas coisas. O foco ENTRA no diálogo -- é o que
       * mantém o Tab lá dentro e o que faz um leitor de ecrã anunciá-lo -- mas
       * um <dialog> não é `a`, `button`, `input`, `select`, `textarea` nem
       * `summary`, que é a lista a que a regra do anel se aplica em
       * base.css:112. Sem anel, sem nada com ar de escolhido, e sem tirar o
       * anel a ninguém que navegue com o teclado: esse continua a vê-lo assim
       * que carregar em Tab.
       *
       * O `tabindex="-1"` que isto exige está no <dialog>, em shell.mjs. */
      drawer.focus();
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
    /* The third way, for Escape, which reaches none of the above -- and it has
       to ask WHAT Escape closed. This listener is on the window, so once there
       is a second dialog on the page (the photograph viewer) it would fire for
       that one too and drag the focus over to the burger, out of the gallery
       the reader was standing in. */
    addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      const eraAGaveta = drawer.open;
      setTimeout(() => { settle(); if (eraAGaveta) giveFocusBack(); }, 0);
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
    /* UM LIMIAR SÓ, E É A BARRA TER SAÍDO DO FLUXO QUE O PERMITE.
       Eram dois: o fundo aparecia aos 12px e a barra encolhia aos 240, com
       90px de histerese. Esses 240 não eram gosto -- com a barra em `sticky`,
       encolher tirava 34px à altura do documento, e uma página cujo scroll
       total ficasse mesmo em cima da linha encolhia, era travada para baixo
       dela, crescia, e baloiçava enquanto alguém lá estivesse; e o «Skip to
       content», que aterra a y=123, disparava um limiar mais baixo e punha a
       página a deslizar debaixo de quem tinha acabado de saltar.
       Agora a barra é `fixed`. Mudar de tamanho não mexe na altura do
       documento nem na posição de nada, por isso os dois motivos
       desapareceram, e o fundo, a sombra, a altura e o logótipo passam a poder
       mexer no mesmo gesto e cedo -- que é o que a barra do weldstaff.pt faz,
       e pela mesma razão.
       A banda continua a existir, mas só contra tremura: sem ela uma página
       parada a um pixel da linha pisca entre os dois estados. */
    const ON_AT = 40, OFF_AT = 8;
    let queued = false;
    const decide = () => {
      queued = false;
      const y = scrollY;
      const agora = head.dataset.shrunk === 'yes';
      const seguinte = y >= ON_AT ? true : y <= OFF_AT ? false : agora;
      if (seguinte === agora) return;
      head.dataset.shrunk = seguinte ? 'yes' : 'no';
      /* Na RAIZ, porque a linha de script no <head> já lá escreveu antes da
         primeira pintura e é lá que a folha de estilos o lê. */
      document.documentElement.dataset.scrolled = seguinte ? 'yes' : 'no';
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

  coverFilm();
  filters();
  sorting();
  cardShots();
  gallery();
  lightbox();
  productForm();
  stockNaFicha();
  basketPage();
  mapConsent();
  checkout();
  payPage();
  thankYouPage();
  previewLock();
  avisoRevenda();
  revendaNaPagina();
  paginaRevenda();
  retratacao();
});

/* --- checkout -------------------------------------------------------------
   The browser sends ids, quantities, option ids, a country and the catalogue
   hash it was looking at. Never a price. The Worker reprices from the same
   file that built the page, and refuses with 409 if the catalogue has moved
   under us in the ten minutes GitHub Pages caches it. */
function checkout() {
  const go = $('[data-to-checkout]');
  if (!go) return;
  const form = $('[data-checkout-form]');

  /* O FORMULÁRIO VALIDA-SE AQUI, E OUTRA VEZ NO SERVIDOR.
     A validação do browser é uma cortesia -- diz onde está o erro sem ir e
     voltar. Quem manda é o Worker, que recusa 400 a um pedido sem nome, sem
     email ou sem morada. O que o browser manda nunca se acredita. */
  const cliente = () => {
    if (!form) return null;
    const v = (n) => (form.elements[n]?.value ?? '').trim();
    return {
      nome: v('nome'), email: v('email'), telefone: v('telefone'), nif: v('nif'),
      /* `linha2` saiu do formulário a pedido da dona: quem tem andar escreve-o
         na morada, que aceita 160 caracteres. Não se manda o campo em branco --
         mandar uma chave vazia é dizer ao Worker que a pergunta foi feita e
         ficou por responder, e ele guardava um `null` que não quer dizer nada. */
      morada: { linha1: v('linha1'), postal: v('postal'), cidade: v('cidade') },
    };
  };

  /* NENHUM MÉTODO COMEÇA ESCOLHIDO, a pedido da dona -- e por isso isto pode
     devolver uma string vazia. Não se inventa um valor por omissão: um
     `?? 'MBWAY'` aqui mandava o comprador pagar por um método que ele nunca
     escolheu. Quem trava é o `required` nos três rádios, que faz o browser
     dizer, na língua dele, que falta escolher. */
  const metodo = () => (form?.elements?.metodo?.value ?? '');

  /* A RESELLER BUYS WITH THEIR OWN NIF, and says they are buying for the
     business. The NIF is filled in and locked: the Worker only applies the
     discount when the order carries the reseller's NIF, and a field they
     could edit would only lead to a refusal. The box is per purchase, not per
     account -- whether someone is a consumer is decided by each purchase, and
     a reseller buying a lamp for their own home is one. */
  esperarRevenda().then(() => {
    if (!revenda.activa || !form) return;
    const nif = form.elements.nif;
    if (nif) { nif.value = revenda.nif; nif.readOnly = true; }
    if (!form.querySelector('[name="profissional"]')) {
      const caixa = document.createElement('label');
      caixa.className = 'check rv-check';
      caixa.innerHTML = `<input type="checkbox" name="profissional" required>
        <span>${tj('revenda.profissional', { firma: escRv(revenda.firma || revenda.nif), url: pagina('/legal/terms/#resellers') })}</span>`;
      (nif?.closest('.field, label') ?? form.firstElementChild)?.after(caixa);
    }
  });

  /* O CAMPO DO TELEMÓVEL SÓ EXISTE PARA O MB WAY, e pedi-lo a quem vai pagar
     uma referência Multibanco é pedir um dado que não é preciso para nada --
     que é o teste do artigo 5.º n.º 1 alínea c) do RGPD, não uma questão de
     arrumação. `hidden` sozinho não chega quando o CSS declara `display` no
     elemento; aqui a classe `.field` não o faz, mas escrever os dois é o que
     torna isto verdade em qualquer folha de estilo.
     E `required` acompanha a visibilidade: um campo escondido e obrigatório
     faz o `reportValidity` recusar o formulário sem mostrar onde, e o botão
     morre sem dizer porquê. */
  const caixaTelemovel = $('[data-mbway-phone]');
  const campoTelemovel = caixaTelemovel?.querySelector('input');
  const acertarTelemovel = () => {
    if (!caixaTelemovel || !campoTelemovel) return;
    const mbway = metodo() === 'MBWAY';
    caixaTelemovel.hidden = !mbway;
    caixaTelemovel.style.display = mbway ? '' : 'none';
    campoTelemovel.required = mbway;
    campoTelemovel.disabled = !mbway;
  };
  for (const r of $$('[data-pay-methods] input[name="metodo"]')) {
    r.addEventListener('change', acertarTelemovel);
  }
  acertarTelemovel();

  const disparar = async (e) => {
    e?.preventDefault();
    if (go.getAttribute('aria-disabled') === 'true') return;
    if (!API) { say(tj('pagamento.indisponivel')); return; }

    const cur = basket();
    if (!cur.lines.length) return;

    /* `reportValidity` faz o browser mostrar os erros dele e pôr o foco no
       primeiro campo em falta -- que é melhor do que qualquer mensagem que eu
       escrevesse, e vem traduzida para a língua de quem lá está. */
    if (form && !form.reportValidity()) return;

    go.setAttribute('aria-disabled', 'true');
    const wasSaying = go.textContent;
    let recarregar = false;
    /* O botão diz o que vai acontecer, e são três coisas diferentes: um pedido
     que chega ao telemóvel, uma referência que aparece a seguir, ou uma saída
     do site. Quem sai merece sabê-lo antes de a página mudar debaixo dos pés. */
  const SAEM = ['CCARD', 'GOOGLE', 'APPLE'];
  go.textContent = metodo() === 'MBWAY' ? tj('checkout.aEnviar')
    : SAEM.includes(metodo()) ? tj('checkout.aSair')
      : tj('checkout.aReferencia');

    try {
      const cat = await catalogue();
      await esperarRevenda();
      const r = await fetch(`${API}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hash: cat.hash, country: cur.country || 'PT', lines: cur.lines, cliente: cliente(),
          metodo: metodo(),
          /* A língua da página: o Worker devolve o comprador à página de
             pagamento nesta língua, e a ifthenpay fala-lhe nela. */
          lingua: LINGUA || undefined,
          prazo: prazoNoCesto,
          telemovel: metodo() === 'MBWAY' ? (campoTelemovel?.value ?? '').trim() : undefined,
          revenda: revenda.activa ? { sessao: revenda.sessao, versao: revenda.versao } : undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));

      /* The reseller's prices changed while they looked, or their session
         ended. Neither is fixed by pressing again: the page reloads with the
         prices that are true now, and says so -- never a silent switch to
         retail. */
      /* The button stays blocked until the page reloads: it used to come back
         for the seconds before the reload, with the reseller's prices still on
         the screen, and a second press placed a retail order. */
      if (r.status === 409 && data.error === 'reseller_prices_changed') {
        recarregar = true;
        try { sessionStorage.setItem('ic-revenda-fresca', '1'); } catch { /* storage blocked */ }
        avisarDepois(tj('revenda.precosMudaram'));
        location.reload();
        return;
      }
      if (r.status === 401 && data.error === 'reseller_session_invalid') {
        recarregar = true;
        esquecerRevenda();
        avisarDepois(tj('revenda.sessaoTerminouCompra'));
        location.reload();
        return;
      }

      /* THE LAST ONE WENT TO SOMEONE ELSE while this buyer was filling in the
         form. They were shown "in stock", so they are not moved to three or
         four weeks without being told: the basket repaints as made to order,
         this says what happened, and the next press is their choice. */
      if (r.status === 409 && data.error === 'stock_changed') {
        const foram = Array.isArray(data.semStock) ? data.semStock : [];
        for (const k of foram) esgotados.add(k);
        if (!foram.length) esgotouAgora = true;
        prazoNoCesto = 'encomenda';
        reavaliarCesto();
        const caixa = $('[data-basket-lead]');
        say(tj('checkout.esgotou', { prazo: caixa?.dataset.leadWeeks || tj('checkout.algumasSemanas') }));
        return;
      }

      if (r.status === 409 && data.error === 'catalogue_changed') {
        catalogueCache = null;
        say(tj('checkout.precosMudaram'));
        location.reload();
        return;
      }
      /* `proxima` e não `url`: o comprador já não sai do site. O que vem de
         volta é uma morada NOSSA, e a página do pagamento lê o resto de
         `/order` -- assim recarregar funciona, e voltar dois dias depois
         mostra a mesma referência Multibanco. */
      if (!r.ok || !data.proxima) { say(reason(data.error)); return; }
      location.href = naLingua(data.proxima);
    } catch {
      say(tj('checkout.semLigacao'));
    } finally {
      if (!recarregar) {
        go.removeAttribute('aria-disabled');
        go.textContent = wasSaying;
      }
    }
  };

  /* Os dois caminhos: o `submit` do formulário (que o Enter também dispara) e
     o clique no botão, para o caso de alguém tirar o formulário daqui um dia.
     O `submit` chega primeiro e o `preventDefault` impede a página de recarregar. */
  if (form) form.addEventListener('submit', disparar);
  else go.addEventListener('click', disparar);

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
    /* Cada código aponta para uma frase do dicionário. `hasOwn`, como nos
       fragmentos antigos: um código «constructor» devolvia uma função. */
    const FRASES = {
      shop_not_open_yet: 'loja.fechada',
      country_not_served: 'erro.paisSemEnvio',
      empty_basket: 'erro.cestoVazio',
      unknown_product: 'erro.pecaIndisponivel',
      option_missing: 'erro.falteEscolha',
      payments_not_configured: 'pagamento.indisponivel',
      payment_methods_not_configured: 'pagamento.indisponivel',
      storage_not_configured: 'erro.semEncomendas',
      email_invalido: 'erro.emailInvalido',
      bad_mbway_number: 'erro.mbwayNumero',
      bad_payment_method: 'erro.metodo',
      payment_unavailable: 'erro.pagamentoSemResposta',
      catalogue_unavailable: 'erro.catalogo',
      reseller_nif_mismatch: 'erro.nifRevenda',
      bad_quantity: 'erro.quantidade',
      option_unavailable: 'erro.opcaoIndisponivel',
      text_too_long: 'erro.textoLongo',
      stock_unavailable: 'erro.stockIndisponivel',
      stock_changed: 'erro.stockMudou',
    };
    const base = String(code).split(':')[0];
    if (Object.hasOwn(FRASES, base)) return tj(FRASES[base]);
    /* O Worker devolve `cliente_incompleto:nome,email` — o código traz consigo
       os campos que faltam, e dizê-los é a diferença entre corrigir à
       primeira e adivinhar. */
    return String(code).startsWith('cliente_incompleto')
      ? tj('erro.preencha', { campos: String(code).split(':')[1]?.split(',').join(', ') || tj('erro.camposEmFalta') })
      : tj('erro.generico');
  }
}

/* --- the reseller sign-in page ---------------------------------------------
   Three ways in, one way out. The email's button lands here with the signed
   entry in the fragment (#t=…): the fragment never reaches a server or its
   logs, and it is wiped from the address at once so it does not sit in the
   history or a bookmark. The code is for someone who read the email on their
   phone and buys at the shop's computer. */
async function paginaRevenda() {
  const raiz = $('[data-resellers]');
  if (!raiz) return;
  const fora = $('[data-rv-fora]', raiz);
  const dentro = $('[data-rv-dentro]', raiz);
  const dizer = (el, texto) => { if (!el) return; el.textContent = texto; el.hidden = !texto; };
  const pedirMsg = $('[data-rv-pedir-msg]', raiz);
  const codigoMsg = $('[data-rv-codigo-msg]', raiz);

  if (!API) {
    dizer(pedirMsg, tj('revenda.entrarIndisponivel'));
    for (const b of $$('button', fora)) b.disabled = true;
    return;
  }

  const post = async (caminho, corpo) => {
    const r = await fetch(`${API}${caminho}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
    });
    return { r, j: await r.json().catch(() => ({})) };
  };

  async function entrar(corpo, manter) {
    const { r, j } = await post('/revenda/entrar', corpo);
    if (!r.ok || !j.sessao) return r.status;
    guardarRevenda({ sessao: j.sessao, nif: j.nif, firma: j.firma }, manter);
    revendaPronta = null;
    return 200;
  }

  async function mostrar() {
    await esperarRevenda();
    fora.hidden = revenda.activa;
    dentro.hidden = !revenda.activa;
    if (!revenda.activa) return;
    $('[data-rv-firma]', raiz).textContent = revenda.firma || '';
    $('[data-rv-nif]', raiz).textContent = revenda.nif || '';
    $('[data-rv-manter]', raiz).checked = Boolean(sessaoRevenda()?.manter);

    const cat = await catalogue().catch(() => null);
    const corpo = $('[data-rv-tabela] tbody', raiz);
    if (!cat || !corpo) return;
    const url = (slug, p) => pagina(`${p.brand === 'cathelier' ? '/cathelier/pieces' : '/lamps'}/${slug}/`);
    const linhas = Object.entries(cat.products)
      .filter(([slug]) => !slug.startsWith('zz-'))
      .sort(([sa, a], [sb, b]) => (a.brand + nomeDaPeca(cat, sa, a)).localeCompare(b.brand + nomeDaPeca(cat, sb, b)));
    /* Os rótulos das colunas vão em data-rotulo, que a folha de estilos mostra
       no telemóvel: são texto que se lê, e por isso vêm do dicionário. */
    const rotulo = {
      pvp: escRv(tj('revenda.rotuloPvp')), preco: escRv(tj('revenda.rotuloPreco')), stock: escRv(tj('revenda.rotuloStock')),
    };
    corpo.innerHTML = linhas.map(([slug, p]) => {
      const d = descontoDe(slug, p.price);
      const low = desdeDe(p);
      const desde = (p.options || []).some((o) => o.type === 'choice' && o.values.some((v) => (v.extra || 0) > 0));
      const preco = (n) => escRv(desde ? tj('precoDesde', { preco: eurosRv(n) }) : eurosRv(n));
      return `<tr><th scope="row"><a href="${url(slug, p)}">${escRv(nomeDaPeca(cat, slug, p))}</a> <span class="rv-marca">${escRv(p.brand)}</span></th>
        <td data-rotulo="${rotulo.pvp}">${preco(low)}</td>
        <td data-rotulo="${rotulo.preco}">${d ? `<strong>${preco(low - d)}</strong> <span class="rv-menos">−${eurosRv(d)}</span>` : `<span class="muted">${escRv(tj('revenda.semPreco'))}</span>`}</td>
        <td class="rv-stock" data-rotulo="${rotulo.stock}">${stockNaTabela(cat, slug, p)}</td></tr>`;
    }).join('');
  }

  /* How many are free, per model: "Large 2 · Small 0". The combinations
     ("Both together") are left out -- they are not made, they are put
     together from the others, and the two numbers already say how many. */
  function stockNaTabela(cat, slug, p) {
    if (!p.stock) return `<span class="muted">${escRv(tj('revenda.porEncomenda'))}</span>`;
    if (!revenda.stock) return '<span class="muted">—</span>';
    const modelo = (p.options || []).find((o) => o.id === p.stock.option);
    const partes = Object.entries(p.stock.skus)
      .filter(([, skus]) => skus.length === 1)
      .map(([id, [sku]]) => {
        const n = revenda.stock[sku] ?? 0;
        const valor = modelo?.values.find((v) => String(v.id) === id);
        const nome = valor && String(nomeDoValor(cat, slug, modelo, valor) ?? '').replace(/\s*\(.*\)$/, '');
        return `${nome ? `${escRv(nome)} ` : ''}<strong>${n}</strong>`;
      });
    return partes.join(' · ');
  }

  const t = new URLSearchParams(location.hash.slice(1)).get('t');
  if (t) {
    history.replaceState(null, '', location.pathname + location.search);
    const estado = await entrar({ token: t }, false).catch(() => 0);
    if (estado !== 200) {
      dizer(pedirMsg, estado === 401 ? tj('revenda.linkExpirou') : tj('revenda.semLigacaoLink'));
    }
  }

  $('[data-rv-pedir]', raiz).addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = $('button', e.currentTarget);
    const nif = e.currentTarget.elements.nif.value;
    botao.disabled = true;
    try {
      const { r, j } = await post('/revenda/pedir', { nif });
      /* It never says the email WAS sent: the answer is the same for every
         NIF, so nobody learns who is a reseller, and the Worker may also be
         holding the email back (one per quarter of an hour). */
      dizer(pedirMsg, r.ok ? tj('revenda.emailPedido')
        : j.error === 'bad_nif' ? tj('revenda.nifErrado')
          : r.status === 429 ? tj('revenda.espereSegundos')
            : tj('revenda.erroNosso'));
    } catch {
      dizer(pedirMsg, tj('revenda.semLigacao'));
    } finally { botao.disabled = false; }
  });

  $('[data-rv-codigo]', raiz).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const botao = $('button', f);
    botao.disabled = true;
    try {
      const estado = await entrar({ nif: f.elements.nif.value, codigo: f.elements.codigo.value }, f.elements.manter.checked);
      if (estado === 200) { dizer(codigoMsg, ''); await mostrar(); revendaNaPagina(); return; }
      dizer(codigoMsg, estado === 401 ? tj('revenda.codigoFalhou')
        : estado === 429 ? tj('revenda.espereSegundo')
          : tj('revenda.erroNosso'));
    } catch {
      dizer(codigoMsg, tj('revenda.semLigacao'));
    } finally { botao.disabled = false; }
  });

  $('[data-rv-manter]', raiz).addEventListener('change', (e) => {
    const s = sessaoRevenda();
    if (s) guardarRevenda(s, e.currentTarget.checked);
  });
  $('[data-rv-sair]', raiz).addEventListener('click', () => { esquecerRevenda(); location.reload(); });

  await mostrar();
}

/* --- a função de retratação ------------------------------------------------
 *
 * Artigo 11.º-A da Diretiva 2011/83, pela Diretiva (UE) 2023/2673. O formulário
 * vem escondido no HTML e só aparece aqui, quando há um Worker para onde o
 * enviar: sem isso, o texto da página explica como fazer o mesmo por email.
 *
 * O CONTRATO COM O WORKER: POST /retratacao com {nome, encomenda, email,
 * artigos, lingua}; responde 4xx {error} ou
 *   200 {ok: true, recebidoEm: <ISO>, aviso: <bool>, repetido: <bool>,
 *        emailDiferente: <bool>}
 * (um Worker anterior manda a data em `recebido`, e lê-se na mesma).
 *   · A data e a hora que se mostram são as do servidor -- são elas que ficam
 *     no aviso de receção, e o relógio de um telemóvel pode estar horas ao
 *     lado. Dizem-se como a hora em que a pessoa ENVIOU, em hora de Lisboa.
 *   · `repetido: true` só quando ESTA declaração, igual (nome, email e
 *     artigos), já tinha chegado: `recebidoEm` é então a da primeira, não sai
 *     email novo, e a página não o promete. Uma declaração DIFERENTE para a
 *     mesma encomenda (outros artigos) é nova, e tem o sucesso de sempre.
 *   · `emailDiferente: true` quando o email escrito não é o da encomenda: o
 *     Worker grava na mesma e manda o aviso para o email DA ENCOMENDA -- a
 *     página diz isso, e não que o aviso vai para o que se escreveu.
 *   · `aviso: false` quando gravou mas o email ao comprador não saiu.
 *
 * `aria-disabled` e não `disabled` enquanto envia: desactivar o botão em que
 * se acabou de carregar tira-lhe o foco, e quem usa teclado ou leitor de ecrã
 * fica sem saber onde está. O formulário lê-se ANTES do primeiro await --
 * depois dele, `ev.currentTarget` já é null. */
function retratacao() {
  const form = $('[data-retratacao]');
  if (!form) return;
  const msg = $('[data-retratacao-msg]');
  const ok = $('[data-retratacao-ok]');
  const dizer = (texto) => { if (!msg) return; msg.textContent = texto; msg.hidden = !texto; };

  if (!API) { dizer(tj('retratacao.indisponivel')); return; }
  form.hidden = false;

  const botao = $('[data-retratacao-confirmar]', form);
  const campo = form.elements.encomenda;
  /* O número tal como vem no email é «IC-» e doze caracteres. Aceita-se como
     a pessoa o escrever -- em minúsculas, com espaços, sem o hífen, ou sem o
     «IC-» -- e arruma-se antes de validar. */
  const arrumar = () => {
    let v = campo.value.toUpperCase().replace(/[\s.]+/g, '');
    if (/^IC[A-Z0-9]{12}$/.test(v)) v = `IC-${v.slice(2)}`;
    else if (/^[A-Z0-9]{12}$/.test(v)) v = `IC-${v}`;
    campo.value = v;
    campo.setCustomValidity(v && !/^IC-[A-Z0-9]{12}$/.test(v) ? tj('retratacao.formatoEncomenda') : '');
  };
  campo.addEventListener('change', arrumar);
  campo.addEventListener('input', () => campo.setCustomValidity(''));

  let aEnviar = false;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (aEnviar) return;
    for (const el of [form.elements.nome, form.elements.email, form.elements.artigos]) el.value = el.value.trim();
    arrumar();
    if (!form.reportValidity()) return;

    const corpo = {
      nome: form.elements.nome.value,
      encomenda: campo.value,
      email: form.elements.email.value,
      artigos: form.elements.artigos.value,
      lingua: LINGUA || 'pt',
    };
    aEnviar = true;
    botao.setAttribute('aria-disabled', 'true');
    dizer(tj('retratacao.aEnviar'));
    try {
      const r = await fetch(`${API}/retratacao`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        const quando = new Date(j.recebidoEm ?? j.recebido);
        const valida = !Number.isNaN(quando.getTime());
        /* A encomenda, a data e a hora estão nas duas frases (a nova e a
           repetida): escreve-se em todas. */
        const escrever = (sel, texto) => { for (const el of $$(sel, ok)) el.textContent = texto; };
        escrever('[data-retratacao-encomenda]', corpo.encomenda);
        escrever('[data-retratacao-data]', valida
          ? quando.toLocaleDateString(LOCALE_DATAS, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' }) : '—');
        escrever('[data-retratacao-hora]', valida
          ? quando.toLocaleTimeString(LOCALE_DATAS, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' }) : '—');
        /* Só `true` conta: um Worker antigo, sem os campos, fica com a
           resposta de sempre (nova, com aviso, para o email escrito). */
        const repetido = j.repetido === true;
        const semAviso = j.aviso === false;
        const emailDiferente = j.emailDiferente === true;
        const mostrar = (sel, sim) => { for (const el of $$(sel, ok)) el.hidden = !sim; };
        mostrar('[data-retratacao-nova]', !repetido);
        mostrar('[data-retratacao-repetida]', repetido);
        /* Um parágrafo sobre o aviso, e um só:
           · não saiu -- a dona escreve-o em 24 horas (vale para as duas);
           · repetida -- o aviso desta declaração já seguiu; nenhum novo;
           · nova, com o email da encomenda -- «vai receber»;
           · nova, com outro email -- foi para o da encomenda. */
        mostrar('[data-retratacao-sem-aviso]', semAviso);
        mostrar('[data-retratacao-aviso-antigo]', !semAviso && repetido);
        mostrar('[data-retratacao-com-aviso]', !semAviso && !repetido && !emailDiferente);
        mostrar('[data-retratacao-email-diferente]', !semAviso && !repetido && emailDiferente);
        dizer('');
        form.hidden = true;
        ok.hidden = false;
        $('[data-retratacao-ok-titulo]:not([hidden])', ok)?.focus();
        return;
      }
      /* Os códigos do Worker (POST /retratacao): bad_email, bad_reference,
         bad_items, missing_name, name_too_long, bad_body, order_not_found
         (só quando a encomenda não existe: um email que não bate é gravado
         na mesma, com `emailDiferente`) e too_many_requests -- que tranca
         minutos, não segundos. Tudo o resto -- a origem recusada, o armazém
         em falta, uma rota que ainda não existe -- é «envie por email», que
         vale sempre. */
      const e = String(j.error || '');
      dizer(r.status === 429 || e === 'too_many_requests' ? tj('retratacao.erroEspere')
        : e === 'bad_email' ? tj('retratacao.erroEmail')
          : e === 'bad_reference' ? tj('retratacao.formatoEncomenda')
            : e === 'bad_items' ? tj('retratacao.erroArtigos')
              : e === 'order_not_found' ? tj('retratacao.erroEncomenda')
                : ['missing_name', 'name_too_long', 'bad_body'].includes(e) ? tj('retratacao.erroCampos')
                  : tj('retratacao.erroGenerico'));
    } catch {
      dizer(tj('retratacao.semLigacao'));
    } finally {
      aEnviar = false;
      botao.removeAttribute('aria-disabled');
    }
  });
}

/* --- a página onde se paga, que até aqui era da ifthenpay -----------------
 *
 * Três desfechos, e o mais frequente não é «pago»: uma referência Multibanco
 * fica por pagar de propósito, durante dias. Por isso esta página não guarda
 * nada -- lê tudo de `/order` a cada volta, e pintar é escolher qual dos
 * blocos se mostra.
 *
 * O RELÓGIO DO MB WAY CONTA A PARTIR DE QUANDO O PEDIDO SAIU, e não de quando
 * a página abriu. São quatro minutos na app, e recarregar a página não os
 * devolve: ler a hora de nascimento da encomenda é a diferença entre dizer a
 * verdade e prometer tempo que já não existe.
 */
const MBWAY_SEGUNDOS = 240;

async function payPage() {
  const state = $('[data-pay-state]');
  if (!state) return;

  const id = new URLSearchParams(location.search).get('ref');
  const blocos = '[data-pay-mbway],[data-pay-mb],[data-pay-done],[data-pay-failed],[data-pay-unknown]';
  const mostrar = (qual) => {
    state.hidden = true;
    for (const d of $$(blocos)) d.hidden = true;
    const el = $(qual);
    if (el) el.hidden = false;
  };

  if (!id || !API) { state.textContent = tj('encomenda.naoEncontrada'); return; }

  const euros = (cents) => dinheiro(cents / 100);
  /* Uma referência Multibanco lê-se em grupos de três; copia-se sem espaços,
     porque é para um campo de uma aplicação de banco. São duas formas do mesmo
     número e cada uma serve para uma coisa. */
  const emGrupos = (r) => String(r).replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ');

  /* A ifthenpay devolve `2026-09-24`, que é uma data de base de dados e não uma
     coisa que se diga a alguém. E lê-se à mão em vez de se atirar a string ao
     `new Date()`: essa forma é interpretada como meia-noite UTC, e a quem
     estiver a oeste de Greenwich o browser mostrava o dia ANTERIOR -- uma
     referência a expirar um dia mais cedo do que expira, escrito com toda a
     confiança. Constrói-se em UTC e formata-se em UTC, e assim o dia que sai é
     o dia que entrou. */
  const porExtenso = (data) => {
    /* Aceita as DUAS formas que a ifthenpay já usou: a especificação deles
       mostra `2026-07-27` e a conta a sério devolveu `24-09-2026`. O Worker já
       normaliza, e isto aceita as duas na mesma -- uma encomenda guardada
       antes dessa correcção continua a ter a forma antiga lá dentro, e a
       página é lida por quem a tiver. */
    const t = String(data ?? '');
    const pt = /^(\d{2})-(\d{2})-(\d{4})$/.exec(t);
    const m = pt ? [t, pt[3], pt[2], pt[1]] : /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (!m) return t;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    try {
      return new Intl.DateTimeFormat(LOCALE_DATAS, {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      }).format(d);
    } catch { return t; }
  };

  const escrever = (sel, texto) => { const el = $(sel); if (el) el.textContent = texto; };

  let relogio = null;
  const pararRelogio = () => { if (relogio) { clearInterval(relogio); relogio = null; } };

  function contar(criada) {
    const nasceu = Date.parse(criada ?? '');
    if (!Number.isFinite(nasceu)) return;           // sem hora, sem relógio
    const pintar = () => {
      /* O RELÓGIO É PRESO NOS DOIS EXTREMOS, e não só em baixo.
         `Math.max(0, …)` sozinho parece suficiente e não é: a hora de
         nascimento vem do servidor e a subtracção é feita com o relógio do
         telemóvel de quem está a ver. Basta o telemóvel estar atrasado para o
         tempo decorrido dar NEGATIVO e a conta passar dos quatro minutos --
         apareceu aqui «Time left: 627:02» num pedido de quatro minutos, com
         uma diferença de dez horas entre as duas máquinas. Um relógio a
         prometer dez horas num pedido que expira em quatro é pior do que não
         ter relógio nenhum.
         O tecto é o prazo, e quem decide de verdade continua a ser a ifthenpay
         com o código 101: isto é uma indicação, não a autoridade. */
      const decorridos = Math.floor((Date.now() - nasceu) / 1000);
      const faltam = Math.min(MBWAY_SEGUNDOS, Math.max(0, MBWAY_SEGUNDOS - decorridos));
      escrever('[data-pay-countdown]', `${Math.floor(faltam / 60)}:${String(faltam % 60).padStart(2, '0')}`);
      if (faltam === 0) pararRelogio();
    };
    pintar();
    pararRelogio();
    relogio = setInterval(pintar, 1000);
  }

  /* Os botões de copiar. `navigator.clipboard` não existe em contexto
     inseguro nem em todos os browsers, e um botão que não faz nada é pior do
     que não existir -- por isso há uma segunda via, e quando nenhuma resulta o
     botão diz «select it» em vez de fingir que copiou. */
  const copiavel = new Map();
  for (const b of $$('.pay-copy')) {
    b.addEventListener('click', async () => {
      const texto = copiavel.get(b.dataset.copy);
      if (!texto) return;
      let feito = false;
      try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); feito = true; }
      } catch { feito = false; }
      if (!feito) {
        try {
          const t = document.createElement('textarea');
          t.value = texto; t.setAttribute('readonly', '');
          t.style.cssText = 'position:fixed;top:-100px;opacity:0';
          document.body.append(t); t.select();
          feito = document.execCommand('copy');
          t.remove();
        } catch { feito = false; }
      }
      const antes = b.textContent;
      b.textContent = feito ? tj('pagar.copiado') : tj('pagar.selecione');
      if (feito) b.dataset.copied = '';
      setTimeout(() => { b.textContent = antes; delete b.dataset.copied; }, 2000);
    });
  }

  let voltas = 0;
  let temporizador = null;

  async function ver() {
    let s;
    try {
      const r = await fetch(`${API}/order?id=${encodeURIComponent(id)}`);
      s = await r.json().catch(() => ({}));
      if (!r.ok) { mostrar('[data-pay-unknown]'); return false; }
    } catch {
      /* Uma falha de rede não muda o que está no ecrã: o que lá está continua
         verdade, e apagá-lo para escrever «não consegui verificar» tira a
         referência de quem a estava a copiar. */
      return true;
    }

    if (s.estado === 'paga') {
      /* O cesto esvazia-se só quando o pagamento está CONFIRMADO. Esvaziá-lo
         ao sair para pagar perde a encomenda de quem volta atrás para mudar
         uma linha -- e com Multibanco «sair para pagar» e «pagar» podem estar
         dois dias um do outro. */
      save(BASKET, { country: 'PT', lines: [] });
      paintCount();
      escrever('[data-pay-ref]', s.reference || id);
      pararRelogio();
      mostrar('[data-pay-done]');
      return false;
    }

    if (s.metodo === 'MBWAY') {
      if (s.mbway === 'expirado' || s.mbway === 'recusado') {
        pararRelogio();
        escrever('[data-pay-failed-title]',
          s.mbway === 'recusado' ? tj('mbway.recusadoTitulo') : tj('mbway.expirouTitulo'));
        escrever('[data-pay-failed-text]',
          s.mbway === 'recusado' ? tj('mbway.recusadoTexto') : tj('mbway.expirouTexto'));
        mostrar('[data-pay-failed]');
        return false;
      }
      escrever('[data-pay-amount]', euros(s.total));
      contar(s.criada);
      mostrar('[data-pay-mbway]');
      return true;
    }

    if (s.metodo === 'MB' && s.entidade && s.referencia) {
      copiavel.set('entity', String(s.entidade));
      copiavel.set('reference', String(s.referencia).replace(/\D/g, ''));
      copiavel.set('amount', (s.total / 100).toFixed(2));
      escrever('[data-pay-entity]', s.entidade);
      escrever('[data-pay-reference]', emGrupos(s.referencia));
      escrever('[data-pay-amount-mb]', euros(s.total));
      if (s.expira) {
        const caixa = $('[data-pay-expiry]');
        if (caixa) caixa.hidden = false;
        escrever('[data-pay-expiry-date]', porExtenso(s.expira));
      }
      mostrar('[data-pay-mb]');
      return true;
    }

    mostrar('[data-pay-unknown]');
    return false;
  }

  /* DUAS CADÊNCIAS, e não uma. Com o MB WAY há alguém a olhar para o ecrã com
     o telemóvel na mão: cinco segundos. Com uma referência, o pagamento chega
     hoje à noite ou amanhã e sondar não adianta -- vinte segundos durante
     cinco minutos, para apanhar quem paga logo no home banking, e depois
     pára. O email é que traz a notícia, e o Worker trata dela sozinho. */
  async function volta() {
    const continuar = await ver();
    voltas++;
    if (!continuar) return;
    const mbway = !$('[data-pay-mbway]')?.hidden;
    if (!mbway && voltas > 15) return;
    if (mbway && voltas > 60) return;
    temporizador = setTimeout(volta, mbway ? 5000 : 20000);
  }

  /* Um separador escondido não pinta nem dispara temporizadores com fiabilidade
     -- e quem volta ao separador quer o estado de agora, não o de há dez
     minutos. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && temporizador) {
      clearTimeout(temporizador);
      voltas = 0;
      volta();
    }
  });

  volta();
}

/* --- a página para onde a ifthenpay devolve o comprador ------------------- */
async function thankYouPage() {
  const state = $('[data-order-state]');
  if (!state) return;

  /* `ref` e não `session_id`, e `/order` e não `/session`.
     Os três nomes vinham do processador anterior e nenhum deles existe (o
     porquê está no registo do git, e não aqui: um comentário nomeando quem já
     não recebe o dinheiro viaja no JavaScript servido a toda a gente -- foi a
     guarda nova a apanhar-me a mim): a página lia um
     parâmetro que nunca chega, chamava uma rota que foi apagada, e comparava
     com `'paid'` quando o Worker responde `'paga'`. Estava partida de ponta a
     ponta contra o Worker novo -- e como o travão da pré-visualização nunca
     deixou lá chegar ninguém, nada disso tinha aparecido. */
  const id = new URLSearchParams(location.search).get('ref');
  const mostrar = (qual) => { state.hidden = true; const d = $(qual); if (d) d.hidden = false; };

  if (!id || !API) { state.textContent = tj('encomenda.naoEncontrada'); return; }

  try {
    const r = await fetch(`${API}/order?id=${encodeURIComponent(id)}`);
    const s = await r.json().catch(() => ({}));

    if (r.ok && s.estado === 'paga') {
      /* O cesto esvazia-se só quando o pagamento está CONFIRMADO. Esvaziá-lo
         quando o comprador sai para pagar perde a encomenda de quem volta
         atrás para mudar de ideias numa linha. E com Multibanco «sair para
         pagar» e «pagar» podem estar dois dias um do outro. */
      save(BASKET, { country: 'PT', lines: [] });
      paintCount();
      mostrar('[data-order-ok]');
      const ref = $('[data-order-ref]'); if (ref) ref.textContent = s.reference || id;
    } else if (r.ok) {
      /* Encomenda conhecida, pagamento por chegar: o desfecho NORMAL de uma
         referência Multibanco. O cesto fica como está -- ainda pode ser preciso. */
      mostrar('[data-order-waiting]');
      const ref = $('[data-order-ref-waiting]'); if (ref) ref.textContent = s.reference || id;
    } else {
      mostrar('[data-order-pending]');
    }
  } catch {
    state.textContent = tj('encomenda.naoVerificada');
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
    box.innerHTML = `<iframe title="${escRv(tj('mapa.titulo'))}" loading="lazy"`
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
  if (!cat) { linesBox.innerHTML = `<p class="muted">${escRv(tj('cesto.erroCarregar'))}</p>`; return; }
  // The reseller's prices first: painting retail and then swapping it would
  // show a total that is not the one they will pay.
  await esperarRevenda();

  const b = basket();
  if (countrySel && b.country) countrySel.value = b.country;
  countrySel?.addEventListener('change', () => {
    const cur = basket(); cur.country = countrySel.value; setBasket(cur); paint();
  });

  const euros = (n) => dinheiro(n);
  const ha = await stockPublico();
  const prazoCaixa = $('[data-basket-lead]');
  const temUm = (k) => Boolean(ha?.has(k)) && !esgotados.has(k);
  const livresRv = (k) => (esgotados.has(k) ? 0 : revenda.stock?.[k] ?? 0);

  /* THE ORDER'S LEAD TIME, decided as a whole: it comes from the shelf only if
     EVERY line can, and otherwise all of it is made and ships together. The
     public answer is yes or no -- the Worker is asked about this exact basket,
     never told how many there are; a reseller has the numbers and works it
     out here. Each call carries a turn number, so a slow answer about the
     basket as it was cannot paint over the basket as it is. */
  let vez = 0;
  async function avaliar(priced) {
    const minha = ++vez;
    const procura = {};
    const todas = priced.length > 0 && priced.every(({ p }) => p.skus);
    for (const { line, p } of priced) for (const k of p.skus ?? []) procura[k] = (procura[k] ?? 0) + line.qty;

    let deStock = false;
    let pouco = false;
    if (todas && !esgotouAgora) {
      if (revenda.activa && revenda.stock) {
        deStock = Object.entries(procura).every(([k, n]) => livresRv(k) >= n);
      } else if (Object.keys(procura).every(temUm)) {
        try {
          const q = Object.entries(procura).map(([k, n]) => `${k}:${n}`).join(',');
          const r = await fetch(`${API}/stock?cesto=${encodeURIComponent(q)}`, { cache: 'no-store' });
          deStock = r.ok && (await r.json()).deStock === true;
        } catch { deStock = false; }
        pouco = !deStock;
      }
    }
    if (minha !== vez || !prazoCaixa) return;
    prazoNoCesto = deStock ? 'stock' : 'encomenda';
    const d = prazoCaixa.dataset;
    prazoCaixa.textContent = deStock ? d.leadStock
      : [d.leadOrder, pouco ? d.leadFew : '', priced.length > 1 ? d.leadTogether : ''].filter(Boolean).join(' ');
    prazoCaixa.hidden = false;
  }

  /* One line's own state. Out of stock is said on the line, so a basket that
     turns into three to four weeks shows which lamp did it. */
  function estadoDaLinha(p, qty) {
    if (!p.skus) return tj('cesto.porEncomenda');
    if (revenda.activa && revenda.stock) {
      const n = Math.min(...p.skus.map(livresRv));
      return n >= qty ? tj('cesto.emStockN', { n }) : n > 0 ? tj('cesto.soN', { n }) : tj('cesto.semStock');
    }
    if (!ha) return '';
    return !esgotouAgora && p.skus.every(temUm) ? tj('cesto.emStock') : tj('cesto.semStock');
  }

  function priceOf(line) {
    const p = cat.products[line.id];
    if (!p) return null;
    /* The reseller's discount comes off the piece, per unit; paid options are
       added at their normal price -- the same sum the Worker does, which is
       the one that is charged. */
    const d = descontoDe(line.id, p.price);
    let each = p.price - d;
    let pvpEach = p.price;
    const shown = [];
    for (const o of p.options || []) {
      const value = (line.options || {})[o.id];
      if (value === undefined || value === '') continue;
      if (o.type === 'choice') {
        const v = o.values.find((x) => x.id === value);
        if (!v) continue;
        each += v.extra || 0;
        pvpEach += v.extra || 0;
        shown.push(`${nomeDaOpcao(cat, line.id, o)}: ${nomeDoValor(cat, line.id, o, v)}`);
      } else {
        each += o.extra || 0;
        pvpEach += o.extra || 0;
        shown.push(tj('cesto.opcaoTexto', { opcao: nomeDaOpcao(cat, line.id, o), texto: value }));
      }
    }
    return {
      name: nomeDaPeca(cat, line.id, p), brand: p.brand, photo: p.photo, shown, each, total: each * line.qty,
      pvpEach, pvpTotal: pvpEach * line.qty, desconto: d,
      skus: skusDaEscolha(p, line.options),
    };
  }

  function shippingFor(country, goods) {
    const s = cat.shipping;
    const zone = s.zones.find((z) => z.countries.includes(country))
      ?? s.zones.find((z) => z.countries.includes(country.slice(0, 2)));
    if (!zone) return null;
    const c = s.campaign;
    // `freeOver > 0`, as the Worker does: a campaign switched on with no
    // threshold said "free" here and charged shipping there.
    if (c?.active && c.freeOver > 0 && goods >= c.freeOver && (!c.countries.length || c.countries.includes(country))) return 0;
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
    /* O AVISO DAS PEÇAS PERSONALIZADAS, antes do botão de encomendar: uma
       linha com um nome, uma data ou uma frase perde os catorze dias, e a lei
       quer isso dito antes da compra (DL 24/2014, art. 4.º n.º 1 al. p)). A
       marca é a mesma que o Worker lê -- `personalises` na opção do catálogo
       -- e só conta com alguma coisa escrita: um candeeiro sem gravação não é
       personalizado. */
    const aviso = $('[data-basket-personal]');
    if (aviso) {
      aviso.hidden = !priced.some(({ line }) => (cat.products[line.id]?.options || [])
        .some((o) => o.personalises && String((line.options || {})[o.id] ?? '').trim() !== ''));
    }
    if (!any) { vez++; prazoNoCesto = 'encomenda'; return; }

    linesBox.innerHTML = priced.map(({ line, p }, i) => `<div class="basket-line">
      <div class="frame">${p.photo
        ? `<img src="${escRv(`${BASE}/media/${p.photo}-200.webp`)}" alt="" width="200" height="200" loading="lazy">` : ''}</div>
      <div>
        <p class="basket-line__name">${escRv(p.name)}</p>
        ${p.shown.length ? `<p class="basket-line__opts">${p.shown.map(escRv).join(' · ')}</p>` : ''}
        <p class="basket-line__opts">${line.qty} × ${euros(p.each)}${p.desconto
          ? ` <span class="rv-rrp">${escRv(tj('cesto.pvp', { preco: euros(p.pvpEach) }))}</span>` : ''}</p>
        ${(() => { const e = estadoDaLinha(p, line.qty); return e ? `<p class="basket-line__stock">${escRv(e)}</p>` : ''; })()}
        <button class="basket-line__drop" type="button" data-drop="${i}">${escRv(tj('cesto.remover'))}</button>
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
    /* The same basket pays the same shipping: the free-shipping threshold is
       measured at retail value, as the Worker does, or a reseller would lose
       free shipping for paying less. */
    const pvpGoods = priced.reduce((t, x) => t + x.p.pvpTotal, 0);
    const post = shippingFor(cur.country || 'PT', pvpGoods);
    $('[data-sum-goods]').textContent = euros(goods);
    $('[data-sum-shipping]').textContent = post === null ? tj('cesto.naoEnviamos')
      : post === 0 ? tj('cesto.gratis') : euros(post);
    $('[data-sum-total]').textContent = post === null ? '—' : euros(goods + post);
    avaliar(priced);
  }

  reavaliarCesto = paint;
  paint();
}

/* --- catalogue filters ----------------------------------------------------
   They wrap to two rows, with a "+N" that opens the rest. Nothing is ever off
   the screen without a way to know it is there. */
/* --- ordering the catalogue -------------------------------------------------
 *
 * Built here and not in the templates, deliberately: a control that cannot
 * work without a script should not exist without one. If this never runs, the
 * catalogue is simply in the shop's own order, which is a correct page.
 *
 * It reorders the DOM rather than setting CSS `order` on a grid. Visual order
 * and tab order then stay the same thing -- with CSS order they part company
 * silently, and a keyboard reader tabs through a sequence nobody can see.
 *
 * "Newest" only appears when the products can answer it. There is no date on
 * any product today: `order` is the arrangement the owner chooses by hand, and
 * offering it as "newest" would be a control that lies. The moment two
 * products carry an `added` date in the back office, the option appears.
 */
function sorting() {
  const list = $('[data-product-list]');
  const bar = $('[data-filters]');
  if (!list || !bar) return;
  const cards = $$('.card', list);
  if (cards.length < 2) return;

  const num = (c) => Number(c.dataset.price || 0);
  const when = (c) => c.dataset.added || '';
  const dated = cards.filter((c) => when(c)).length;

  const ORDERS = [
    ['shop', tj('ordenar.nossa'), null],
    ['low', tj('ordenar.precoSobe'), (a, b) => num(a) - num(b)],
    ['high', tj('ordenar.precoDesce'), (a, b) => num(b) - num(a)],
    ...(dated >= 2 ? [['new', tj('ordenar.novos'), (a, b) => when(b).localeCompare(when(a))]] : []),
  ];

  // The arrangement the page arrived in, kept so "Our order" can be given back
  // exactly -- rebuilding it from a field would be a second source of truth.
  const asBuilt = cards.slice();

  const box = document.createElement('div');
  box.className = 'sortby';
  const id = 'sortby-' + Math.random().toString(36).slice(2, 8);
  const label = document.createElement('label');
  label.className = 'sortby__label';
  label.htmlFor = id;
  label.textContent = tj('ordenar.rotulo');
  const sel = document.createElement('select');
  sel.className = 'sortby__select';
  sel.id = id;
  for (const [id2, text] of ORDERS) {
    const o = document.createElement('option');
    o.value = id2; o.textContent = text;
    sel.append(o);
  }
  /* O <select> vai dentro de um invólucro só por causa da seta: um <select>
     não aceita ::before nem ::after, por isso a seta tem de se pendurar em
     alguma coisa, e pendurá-la na linha inteira dependia de o select ser o
     último e estar encostado à direita. Assim está presa ao próprio controlo. */
  const caixa = document.createElement('span');
  caixa.className = 'select';
  caixa.append(sel);
  box.append(label, caixa);
  bar.after(box);

  sel.addEventListener('change', () => {
    const chosen = ORDERS.find(([id2]) => id2 === sel.value);
    const order = chosen && chosen[2] ? asBuilt.slice().sort(chosen[2]) : asBuilt;
    /* One fragment, one insertion: appending 26 cards one at a time to a live
       grid is 26 layouts. */
    const frag = document.createDocumentFragment();
    for (const c of order) frag.append(c);
    list.append(frag);
  });
}

function filters() {
  const box = $('[data-filters]');
  if (!box) return;
  const list = $('[data-product-list]');
  const none = $('[data-no-results]');
  const chips = $$('[data-filter]', box);

  // ONE way in. A click, the address the page opened at, and the Back button
  // all arrive here, so a filter can never mean two different things.
  function apply(want) {
    let shown = 0;
    for (const other of chips) other.setAttribute('aria-pressed', String(other.dataset.filter === want));
    for (const card of $$('[data-family]', list)) {
      // A lamp can belong to more than one family, so compare against the list
      // rather than against a single word.
      const show = want === 'all' || card.dataset.family.split(' ').includes(want);
      card.style.display = show ? '' : 'none';
      if (show) shown++;
    }
    if (none) none.hidden = shown > 0;
    const nota = $('[data-custom-note]');
    if (nota) nota.hidden = want !== 'custom';
    open();                                   // a chosen chip must never hide
  }

  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    const want = b.dataset.filter;
    apply(want);
    // Keep the address in step: a chosen filter can then be shared, and a
    // reload lands back on it. Replace and not push, because the chips are one
    // page seen ten ways and not ten pages -- Back should leave.
    history.replaceState(null, '', want === 'all'
      ? location.pathname + location.search
      : `#${encodeURIComponent(want)}`);
  });

  // The circles on the cathelier home point here with the occasion in the
  // fragment. Reading it is the only thing that makes those links true.
  function fromAddress(start) {
    const raw = location.hash.slice(1);
    let want = '';
    try { want = decodeURIComponent(raw); } catch { want = raw; }
    /* Uma palavra antiga passa a ser a nova, e a morada acerta-se: quem
       partilhar a seguir já partilha a certa. */
    /* `hasOwn` e não `FRAGMENTOS_ANTIGOS[want]`: o objecto herda do
       Object.prototype, e um #constructor na morada devolvia uma função. */
    if (Object.hasOwn(FRAGMENTOS_ANTIGOS, want)) {
      want = FRAGMENTOS_ANTIGOS[want];
      history.replaceState(null, '', `#${encodeURIComponent(want)}`);
    }
    if (want && chips.some((c) => c.dataset.filter === want)) apply(want);
    // An unknown word shows everything rather than nothing: a stale link is a
    // disappointment, an empty page looks broken. At the start we do not even
    // do that, because apply() unfolds the chips and the page ships folded.
    else if (!start) apply('all');
  }
  addEventListener('hashchange', () => fromAddress(false));

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
    more.setAttribute('aria-label', tjn('filtros.mais', hidden));
  }

  fromAddress(true);   // before fold(): a pre-chosen chip must not be one of the hidden ones
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
  /* A RESERVA É DE TODOS OS CARTÕES, e vem antes de qualquer desistência.
     Estava presa ao laço de baixo, que só olha para quem tem `data-shots`: um
     produto sem fotografia nenhuma ficava sem tira, e o nome dele subia em
     relação ao do vizinho na mesma linha da grelha -- que é exactamente o que
     a fila vazia veio evitar. */
  for (const t of $$('.card__thumbs')) t.classList.add('ready');

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
    /* Um candeeiro de uma só fotografia não tem tira, mas guarda o lugar dela:
       sem isso o nome dele fica cinquenta pixels acima do nome do vizinho, na
       mesma linha da grelha. Quem guarda o lugar é o script, e não o CSS, para
       que sem JavaScript não haja lugar nenhum guardado em lado nenhum. */
    /* O LUGAR É GUARDADO JÁ; SÓ AS IMAGENS É QUE ESPERAM.
       A tira só ganhava altura quando o observador a enchia, e até lá media
       zero: o cartão dava um salto de quarenta e três pixels à passagem do
       leitor. Ficava escondido abaixo da dobra porque o observador dispara
       300px antes, mas escondido não é resolvido -- e num telemóvel, onde a
       tira passou a existir, é onde menos se perdoa. Agora todos os cartões
       reservam o espaço à primeira pintura, com os botões vazios e sem
       contorno (ver `.card__thumb:empty`), e o que o observador faz é só pôr
       lá as fotografias. Inclui os de uma só fotografia, que reservam e nunca
       enchem: sem isso o nome deles ficava mais alto que o do vizinho. */
    if (!frame || !base || shots.length < 2) continue;
    /* Fill the strip. It is shown at every width now -- the owner asked for
       the other photographs on a phone too -- so the only thing still gated
       on a pointer is the automatic drift, further down. */
    const strip = $('.card__thumbs', card);
    const thumbs = $$('.card__thumb', card);
    const fillStrip = () => {
      if (!strip || strip.dataset.filled) return;
      const dir = card.dataset.dir;
      thumbs.forEach((t, n) => {
        const name = shots[n];
        const im = document.createElement('img');
        im.src = `${BASE}/media/${dir}/${name}-200.webp`;
        im.srcset = `${BASE}/media/${dir}/${name}-120.webp 120w, ${BASE}/media/${dir}/${name}-200.webp 200w`;
        /* 32px no telemóvel e 56 a partir de 48rem, que é o que o CSS
           desenha. Dizer 56 em todo o lado fazia um telemóvel de DPR 3 pedir
           o ficheiro de 200w para uma caixa de 32. */
        im.sizes = '(min-width: 48rem) 56px, 32px';
        im.width = 200; im.height = 200;
        im.alt = '';
        im.loading = 'lazy';
        im.decoding = 'async';
        im.fetchPriority = 'low';
        t.append(im);
      });
      strip.dataset.filled = 'yes';
    };
    /* And it follows the reader down the page. `loading="lazy"` did not help
       here: the images are created after layout, and Chrome's threshold
       reaches about 1250px below the fold, so all sixty-seven were fetched at
       once -- 176 KB for twenty-six cards of which four are on screen. An
       observer builds a card's strip when the card is close to being seen.
       Isto vale ainda mais desde que a tira aparece no telemóvel: é lá que os
       sessenta e sete ficheiros de uma vez doíam mais, e é lá que o observador
       os reduz ao punhado que está à vista. */
    if (strip) {
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
/* --- the photograph, full size ---------------------------------------------
 *
 * Panning is the browser's job, not mine. In "actual size" the photograph is
 * given its own pixel width inside a scrolling stage, so dragging, the
 * trackpad, the scrollbars, a two-finger swipe and the keyboard all pan it
 * without a line of code from me -- and pinch-zoom on a phone keeps working,
 * because nothing here touches touch-action. Hand-written pan is where this
 * sort of thing goes wrong, and none of it would beat what is already there.
 *
 * The stage ships empty: a product page carries no second copy of a
 * photograph nobody has asked to see, and the 1400px rendition is fetched only
 * by someone who wants it.
 */
function lightbox() {
  const box = $('.lightbox');
  const stage = $('[data-box-stage]');
  const opener = $('[data-box-open]');
  const g = $('[data-gallery]');
  if (!box || !stage || !g) return;

  // Chrome restores a <dialog>'s open attribute across a reload, the same trap
  // the menu already carries: a dialog that is open cannot be opened again.
  if (box.open) box.close();

  let last = null;                      // what to give the focus back to

  /* Sem botão de tamanho real: a lupa mostra a fotografia inteira à maior
     dimensão que cabe, e mais nada. Um segundo estado dentro de um visor que
     já é um estado era uma escolha a pedir outra escolha. */
  const fit = () => stage.scrollTo(0, 0);

  const show = (from) => {
    const src = $('img', from);
    if (!src) return;
    stage.replaceChildren();
    const pic = from.cloneNode(true);
    const im = $('img', pic);
    /* The viewer wants the biggest rung there is, and the slide's srcset is
       written for a 560px column. Asking for the largest candidate by hand
       would mean composing a URL; raising `sizes` lets the browser pick from
       the srcset it already has -- which carries the address prefix and the
       widths that actually exist. */
    for (const so of $$('source', pic)) so.sizes = '100vw';
    im.sizes = '100vw';
    im.removeAttribute('loading');
    im.removeAttribute('fetchpriority');
    im.className = 'lightbox__img';
    stage.append(pic);
    fit();
    if (box.open) box.close();
    box.showModal();
    document.documentElement.classList.add('menu-open');   // the same derived lock
    $('[data-box-close]', box)?.focus();
  };

  const hide = () => {
    if (box.open) box.close();
    document.documentElement.classList.remove('menu-open');
    stage.replaceChildren();            // nothing decoded is kept around
    (last && last.isConnected ? last : opener)?.focus();
  };

  opener?.addEventListener('click', () => {
    last = opener;
    const slide = $$('.gallery__slide', g).find((sl) => {
      const r = sl.getBoundingClientRect(); const gr = g.getBoundingClientRect();
      return Math.abs(r.left - gr.left) < 2;          // the one on screen
    }) || $('.gallery__slide', g);
    show($('picture', slide));
  });

  /* Clicking the photograph itself opens it too -- it is what everyone tries
     before they look for a button. */
  g.addEventListener('click', (ev) => {
    if (ev.target.closest('button, a')) return;
    const slide = ev.target.closest('.gallery__slide');
    if (!slide) return;
    last = opener;
    show($('picture', slide));
  });

  $('[data-box-close]', box)?.addEventListener('click', hide);
  /* Pressing beside the photograph closes it, and the press has to have
     STARTED there -- dragging a zoomed photograph past the edge must not shut
     the viewer under the reader's finger. */
  let fora = false;
  box.addEventListener('pointerdown', (ev) => { fora = ev.target === box; });
  box.addEventListener('click', (ev) => { if (fora && ev.target === box) hide(); });
  box.addEventListener('close', () => {
    document.documentElement.classList.remove('menu-open');
    stage.replaceChildren();
  });
}

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
  /* O TECTO VEM DO PRÓPRIO CAMPO, e não de um 20 escrito aqui três vezes.
     As duas marcas não vendem o mesmo: o markup do ithos diz 20 e o do
     cathelier diz 200, porque lá vendem-se lembranças às centenas -- e o
     servidor aceita 200 (`MAX_QTY`). Com o 20 à mão, quem pedia 150 e voltava
     a carregar em Adicionar via o cesto passar a VINTE, sem uma palavra:
     medido, 150 + 150 = 20. Ler o `max` do campo faz do markup a única fonte,
     e o markup é o que o comprador tem à frente. */
  const tecto = Number(qty?.max) || 20;
  $('[data-qty-down]', form)?.addEventListener('click', () => { qty.value = Math.max(1, +qty.value - 1); });
  $('[data-qty-up]', form)?.addEventListener('click', () => { qty.value = Math.min(tecto, +qty.value + 1); });

  /* Uma linha por baixo do botão, com o mesmo desenho da do checkout: o cesto
     nunca deve mudar de ideias em silêncio. */
  function dizer(texto) {
    let caixa = $('[data-add-msg]', form);
    if (!caixa) {
      caixa = document.createElement('p');
      caixa.dataset.addMsg = '';
      caixa.className = 'small';
      caixa.style.cssText = 'margin-block-start:.75rem;color:#8C2F1F';
      caixa.setAttribute('role', 'status');
      add.after(caixa);
    }
    caixa.textContent = texto;
  }

  const juntar = (ev) => {
    /* `submit` e não `click`: assim o Enter dentro de um campo também põe a
       peça no cesto, e o browser valida ANTES de nós. O `preventDefault`
       impede a página de recarregar. */
    ev?.preventDefault();
    if (add.getAttribute('aria-disabled') === 'true') return;

    /* APARAR ANTES DE VALIDAR, e voltar a perguntar.
       O `required` do HTML só olha para o vazio, e um espaço satisfá-lo. A
       seguir o `value.trim()` aqui em baixo deitava a opção fora, e a peça ia
       para o cesto SEM a gravação -- o mesmo defeito com um passo a mais. */
    for (const el of $$('input[data-option]', form)) {
      if (el.type !== 'radio') el.value = el.value.trim();
    }
    /* O browser mostra os erros dele e põe o foco no primeiro campo em falta,
       na língua de quem lá está -- é o que o checkout faz, e é melhor do que
       qualquer mensagem que eu escrevesse. Sem isto, um disco de nascimento
       com os SEIS campos obrigatórios vazios entrava no cesto e só era
       recusado no pagamento, sem dizer o que faltava nem onde. */
    if (!form.reportValidity()) return;

    const options = {};
    for (const el of $$('[data-option]', form)) {
      if (el.type === 'radio' && !el.checked) continue;
      if (el.value.trim()) options[el.dataset.option] = el.value.trim();
    }
    const quantas = Math.min(tecto, Math.max(1, Number(qty.value) || 1));
    const b = basket();
    const same = b.lines.find((l) => l.id === slug && JSON.stringify(l.options) === JSON.stringify(options));
    const antes = same ? same.qty : 0;
    if (same) same.qty = Math.min(tecto, same.qty + quantas);
    else b.lines.push({ id: slug, qty: quantas, options });
    setBasket(b);

    /* Se o tecto cortou o pedido, diz-se. Cortar e calar é o defeito que
       estava aqui. */
    const ficaram = same ? same.qty : quantas;
    if (ficaram < antes + quantas) dizer(tj('cesto.tecto', { max: tecto, n: ficaram }));
    else dizer('');

    add.textContent = tj('botao.adicionado');
    setTimeout(() => { add.textContent = tj('botao.adicionar'); }, 1600);
  };

  form.addEventListener('submit', juntar);
}

/* --- the film on the cover -------------------------------------------------
   WHAT DECIDES, AND WHAT MERELY FOLLOWS

   Nothing here "starts the film". Three questions decide whether it runs and
   which cut of it runs, and not one of them is asked once: the screen can be
   resized, the reader can change their motion setting while the page is open,
   the connection can change, and the cover scrolls away. So `settle()` asks
   them all, looks at whether the cover is on screen, and makes the element
   agree -- the same shape as the drawer's lock, and for the same reason: it
   can be called from any of the five listeners, in any order, and the answer
   is always the state the page should be in.

   The first call is what fetches a file. Until then there is no `src`, so a
   reader who asked for stillness and anyone on a metered connection pay
   nothing at all -- not a request, not a redirect.

   TWO CUTS, BECAUSE A FILM IS A SHAPE AND NOT JUST A FILE

   The cover is a tall frame on a phone and a wide one on a laptop. Pouring the
   wide film into the phone's frame keeps only 37% of its width, and the lamps
   live near the edges: the visitor would get the middle of a close-up, at the
   full weight of the wide file. So there are two encodes, cut from the same
   master to the two shapes, and `data-film-at` names the width where the page
   stops asking for the tall one. That number mirrors the stylesheet, is
   written in ONE place, and is read from the attribute rather than copied into
   this file -- a media query here that drifts from the one in the CSS is a bug
   this project has already paid for once. scripts/guards.mjs checks the two
   still agree, and checks the shapes against the real files on disk.

   Crossing that width mid-visit swaps the source, which means the film stops
   and the photograph shows through until the new cut has a frame to paint.
   That is the honest behaviour and not a flaw to paper over: the resting state
   is the photograph, and anything that is not yet playing should be showing it.

   AND THE FADE WAITS FOR A REAL FRAME

   `data-on` goes on at `playing`, never at `loadeddata`: a video that has
   loaded has not necessarily painted, and fading in on the earlier event shows
   a black rectangle for a beat where the photograph used to be. */
function coverFilm() {
  const film = $('.cover__film');
  if (!film || !film.dataset.film || !film.dataset.filmTall || !film.dataset.filmAt) return;

  const wide = matchMedia(`(min-width: ${film.dataset.filmAt})`);
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  /* Chrome and the Android browsers answer this; Safari and Firefox do not,
     and an absent answer is not a no -- it is silence, and silence means carry
     on. Only an explicit "this connection is metered or very slow" stops it. */
  const link = navigator.connection;
  const metered = () => !!link
    && (link.saveData === true || /(^|-)2g$/.test(link.effectiveType || ''));

  const allowed = () => !calm.matches && !metered();
  const cut = () => (wide.matches ? film.dataset.film : film.dataset.filmTall);
  let onScreen = true;

  const settle = () => {
    if (!allowed()) {
      delete film.dataset.on;
      if (film.getAttribute('src')) film.pause();
      return;
    }
    /* Compared through getAttribute, because reading `.src` gives an absolute
       URL back and would never equal the path we asked for -- which would set
       the source again on every scroll frame and restart the download. */
    if (film.getAttribute('src') !== cut()) {
      delete film.dataset.on;
      film.muted = true;          // the attribute says so too; Safari wants both
      film.setAttribute('src', cut());
    }
    if (!onScreen || document.visibilityState === 'hidden') { film.pause(); return; }
    /* A refused autoplay is not a failure to handle, it is an answer: the
       photograph stays, which is where the cover started. */
    film.play().catch(() => { delete film.dataset.on; });
  };

  film.addEventListener('playing', () => { if (allowed()) film.dataset.on = ''; });
  wide.addEventListener('change', settle);
  calm.addEventListener('change', settle);
  document.addEventListener('visibilitychange', settle);

  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      settle();
    }).observe(film);
  }
  settle();
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
    b.title = tj('loja.fechada');
    /* Com a loja fechada não se valida nada: o botão de adicionar é agora um
       botão de submissão, e sem isto clicá-lo numa loja fechada mostrava os
       balões de «preencha este campo» a quem não pode comprar de qualquer
       maneira. O travão a sério é o `aria-disabled`, lido no `juntar`. */
    if (b.type === 'submit') b.setAttribute('formnovalidate', '');
    const note = document.createElement('p');
    note.className = 'small muted';
    note.style.marginBlockStart = '.5rem';
    note.textContent = tj('loja.fechadaNota');
    b.after(note);
  }
}
