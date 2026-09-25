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
  basketPage();
  mapConsent();
  checkout();
  payPage();
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
    if (!API) { say('The shop cannot take payments yet.'); return; }

    const cur = basket();
    if (!cur.lines.length) return;

    /* `reportValidity` faz o browser mostrar os erros dele e pôr o foco no
       primeiro campo em falta -- que é melhor do que qualquer mensagem que eu
       escrevesse, e vem traduzida para a língua de quem lá está. */
    if (form && !form.reportValidity()) return;

    go.setAttribute('aria-disabled', 'true');
    const wasSaying = go.textContent;
    /* O botão diz o que vai acontecer, e são três coisas diferentes: um pedido
     que chega ao telemóvel, uma referência que aparece a seguir, ou uma saída
     do site. Quem sai merece sabê-lo antes de a página mudar debaixo dos pés. */
  const SAEM = ['CCARD', 'GOOGLE', 'APPLE'];
  go.textContent = metodo() === 'MBWAY' ? 'Sending the request…'
    : SAEM.includes(metodo()) ? 'Taking you to pay…'
      : 'Getting your reference…';

    try {
      const cat = await catalogue();
      const r = await fetch(`${API}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hash: cat.hash, country: cur.country || 'PT', lines: cur.lines, cliente: cliente(),
          metodo: metodo(),
          telemovel: metodo() === 'MBWAY' ? (campoTelemovel?.value ?? '').trim() : undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));

      if (r.status === 409 && data.error === 'catalogue_changed') {
        catalogueCache = null;
        say('Prices changed while you were looking. The basket has been updated — '
          + 'please check the total and try again.');
        location.reload();
        return;
      }
      /* `proxima` e não `url`: o comprador já não sai do site. O que vem de
         volta é uma morada NOSSA, e a página do pagamento lê o resto de
         `/order` -- assim recarregar funciona, e voltar dois dias depois
         mostra a mesma referência Multibanco. */
      if (!r.ok || !data.proxima) { say(reason(data.error)); return; }
      location.href = data.proxima;
    } catch {
      say('We could not reach the payment service. Please try again in a moment.');
    } finally {
      go.removeAttribute('aria-disabled');
      go.textContent = wasSaying;
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
    return ({
      shop_not_open_yet: 'The shop has not opened yet.',
      country_not_served: 'We do not ship to that country yet. Write to us and we will see what we can do.',
      empty_basket: 'Your basket is empty.',
      unknown_product: 'Something in your basket is no longer available. Please reload the page.',
      option_missing: 'Something in your basket is missing a choice. Open it and pick one.',
      payments_not_configured: 'The shop cannot take payments yet.',
      payment_methods_not_configured: 'The shop cannot take payments yet.',
      storage_not_configured: 'The shop cannot take orders yet.',
      email_invalido: 'That email address does not look right. Please check it.',
      bad_mbway_number: 'That does not look like a Portuguese mobile number. '
        + 'MB WAY only works with one — or choose a Multibanco reference instead.',
      bad_payment_method: 'That way of paying is not available. Please pick another one.',
      payment_unavailable: 'The payment service did not answer. Nothing was charged — please try again in a moment.',
      catalogue_unavailable: 'The shop is briefly unavailable. Please try again in a minute.',
    })[String(code).split(':')[0]]
      /* O Worker devolve `cliente_incompleto:nome,email` — o código traz consigo
         os campos que faltam, e dizê-los é a diferença entre corrigir à
         primeira e adivinhar. */
      || (String(code).startsWith('cliente_incompleto')
        ? `Please fill in: ${String(code).split(':')[1]?.split(',').join(', ') || 'the missing fields'}.`
        : 'Something went wrong on our side. Please try again, or write to us.');
  }
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
  const blocos = '[data-pay-mbway],[data-pay-mb],[data-pay-payshop],[data-pay-done],[data-pay-failed],[data-pay-unknown]';
  const mostrar = (qual) => {
    state.hidden = true;
    for (const d of $$(blocos)) d.hidden = true;
    const el = $(qual);
    if (el) el.hidden = false;
  };

  if (!id || !API) { state.textContent = 'We could not find that order.'; return; }

  const euros = (cents) => `€${(cents / 100).toFixed(2).replace('.', ',')}`;
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
      return new Intl.DateTimeFormat('en-GB', {
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
      b.textContent = feito ? 'Copied' : 'Select it';
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
          s.mbway === 'recusado' ? 'The request was declined' : 'The request expired');
        escrever('[data-pay-failed-text]', s.mbway === 'recusado'
          ? 'Nothing was charged. If that was not you, or you changed your mind, your '
            + 'basket is still here — order again and pick another way to pay.'
          : 'Nothing was charged. Your basket is still here, so you can order again — '
            + 'and if MB WAY is being awkward, a Multibanco reference always works.');
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

    if (s.metodo === 'PAYSHOP' && s.referencia) {
      copiavel.set('reference-ps', String(s.referencia).replace(/\D/g, ''));
      copiavel.set('amount-ps', (s.total / 100).toFixed(2));
      escrever('[data-pay-reference-ps]', emGrupos(s.referencia));
      escrever('[data-pay-amount-ps]', euros(s.total));
      mostrar('[data-pay-payshop]');
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

  if (!id || !API) { state.textContent = 'We could not find that order.'; return; }

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
    ['shop', 'Our order', null],
    ['low', 'Price: low to high', (a, b) => num(a) - num(b)],
    ['high', 'Price: high to low', (a, b) => num(b) - num(a)],
    ...(dated >= 2 ? [['new', 'Newest first', (a, b) => when(b).localeCompare(when(a))]] : []),
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
  label.textContent = 'Sort by';
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
    more.setAttribute('aria-label', `Show ${hidden} more filters`);
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
    if (ficaram < antes + quantas) dizer(`The basket holds at most ${tecto} of these, so it now has ${ficaram}.`);
    else dizer('');

    add.textContent = 'Added';
    setTimeout(() => { add.textContent = 'Add to basket'; }, 1600);
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
    b.title = 'The shop has not opened yet.';
    /* Com a loja fechada não se valida nada: o botão de adicionar é agora um
       botão de submissão, e sem isto clicá-lo numa loja fechada mostrava os
       balões de «preencha este campo» a quem não pode comprar de qualquer
       maneira. O travão a sério é o `aria-disabled`, lido no `juntar`. */
    if (b.type === 'submit') b.setAttribute('formnovalidate', '');
    const note = document.createElement('p');
    note.className = 'small muted';
    note.style.marginBlockStart = '.5rem';
    note.textContent = 'The shop has not opened yet — you cannot order just now.';
    b.after(note);
  }
}
