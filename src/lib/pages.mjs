import { esc, money } from './html.mjs';
import { icon } from './icons.mjs';

/* ===========================================================================
   The pages that are prose, plus the three that are not.
   ===========================================================================

   The prose ones are Markdown with {{MARKERS}} in them. Contacts, deadlines and
   the shipping table are NEVER typed into a legal page by hand: on another
   project the address on a terms page and the address in the settings drifted
   apart in silence, and the one people read was the wrong one. The markers are
   filled from the settings at build time, and an unknown marker kills the
   build rather than reaching a page. */

export function markers({ identity, shop, shipping }) {
  const i = identity;
  const address = [i.street, [i.postcode, i.town].filter(Boolean).join(' '), i.country]
    .filter(Boolean).join(', ');

  const rows = shipping.zones
    .filter((z) => z.countries.some((c) => shipping.active.includes(c.slice(0, 2))))
    .map((z) => `| ${z.name} | ${money(z.price)} | ${z.daysMin}–${z.daysMax} working days |`);
  const table = rows.length
    ? ['| Where | Shipping | Time |', '|---|---|---|', ...rows].join('\n')
    : '_We are not shipping anywhere yet._';

  return {
    LEGAL_NAME: i.legalName, TRADING_NAME: i.tradingName, LEGAL_FORM: i.legalForm,
    TAX_NUMBER: i.taxNumber, ADDRESS: address || i.town,
    EMAIL: i.email, PHONE: i.phone, PHONE_TEXT: i.phoneText,
    CALL_COST: '(Call to the national mobile network)',
    COMPLAINTS_BOOK: i.complaintsBook,
    ADR_NAME: i.adr.name, ADR_SITE: i.adr.site, ADR_EMAIL: i.adr.email,
    ADR_PHONE: i.adr.phone, ADR_ADDRESS: i.adr.address,
    CARRIER: shipping.carrier,
    /* O NOME DE QUEM RECEBE O PAGAMENTO VIVE NUM SÍTIO SÓ.
       Estava escrito à mão nos termos e na privacidade, e no dia em que a loja
       trocou de processador as duas páginas passaram a mentir -- publicadas,
       em quatro moradas. Um marcador obriga a que mudem juntas. */
    PAYMENT_PROVIDER: shop.payment?.provider ?? 'the payment provider',
    PAYMENT_METHODS: shop.payment?.methods ?? 'the methods shown at checkout',
    PAYMENT_REFERENCE_DAYS: String(shop.payment?.referenceDays ?? 2),
    COOLING_OFF_DAYS: String(shop.returns.coolingOffDays),
    WARRANTY_YEARS: String(shop.returns.warrantyYears),
    FORM_URL: '/legal/returns-form/',
    SHIPPING_TABLE: table,
    SAFETY_LIST: (shop.safetyIthos || []).map((s) => `- ${s}`).join('\n'),
    // Under the Portuguese small-business exemption there is no VAT to state,
    // and saying so is required rather than optional.
    VAT_NOTE: 'VAT is not charged: article 53 of the Portuguese VAT code applies.',
  };
}

export function fill(text, table) {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => {
    if (!(key in table)) throw new Error(`Unknown marker ${whole} — a legal page would ship with a hole in it`);
    return table[key];
  });
}

/* A deliberately small Markdown reader. It understands what these pages use and
   nothing else: headings, paragraphs, lists, tables, links, bold, italics,
   rules. Anything more would be a dependency, and this has to still build in
   three years. */
export function markdown(src) {
  // A run of underscores is one unbreakable 47-character word, and at 320px it
  // pushed the cancellation form sideways off the screen. A blank line to write
  // on is a RULE, not punctuation — drawn in CSS it fits any width and reads
  // the same to a screen reader, which would otherwise announce forty-seven
  // underscores.
  const inline = (s) => esc(s).replace(/_{3,}/g, '<span class="blank" aria-hidden="true"></span>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, h) => `<a href="${h}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');

  const out = [];
  const lines = src.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^#{1,4} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+ /, ''))}</h${level}>`);
      i++; continue;
    }
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    if (/^\| /.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(rows[1] && /^[|\s:-]+$/.test(rows[1]) ? 2 : 1);
      const hasHead = head.some(Boolean);
      out.push(`<div class="table-wrap"><table>`
        + (hasHead ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : '')
        + `<tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
        + `</table></div>`);
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) items.push(lines[i++].replace(/^[-*] /, ''));
      out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    if (!line.trim()) { i++; continue; }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4} |[-*] |\||---)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

export const prosePage = (html) => `
<section class="section">
  <div class="shell shell--narrow page-prose">
    ${html}
  </div>
</section>`;

/* --- contact --------------------------------------------------------------- */

export function contact({ identity, shop, faq }) {
  const i = identity;
  return `
<section class="section">
  <div class="shell shell--narrow page-prose">
    <h1>Contact</h1>
    <p class="lede">Ask us anything. We answer in a day, usually less.</p>

    <div class="contact-cards">
      <a class="contact-card" href="https://wa.me/${esc(i.whatsapp)}" rel="noopener">
        ${icon('whatsapp', 22)}<span><strong>WhatsApp</strong><br>The fastest way to reach us</span>
      </a>
      <a class="contact-card" href="mailto:${esc(i.email)}">
        ${icon('mail', 22)}<span><strong>${esc(i.email)}</strong><br>For orders and quotes</span>
      </a>
      <a class="contact-card" href="tel:${esc(i.phone)}">
        ${icon('phone', 22)}<span><strong>${esc(i.phoneText)}</strong><br>(Call to the national mobile network)</span>
      </a>
    </div>

    <h2>Where we are</h2>
    <p>The workshop is in ${esc(i.town)}, ${esc(i.country)}. It is a workshop rather
       than a shop, so come by arrangement — send a message first.</p>

    <!-- The map is the only third-party content on this site, and it is the
         whole reason a consent question exists at all. It is asked HERE, in
         front of the map, by whoever wants to see it — not as a banner over
         every page for visitors who will never come near it. -->
    <div class="map" data-map>
      <button class="map__ask" type="button" data-map-load>
        ${icon('pin', 22)}
        <span><strong>Show the map</strong><br>
        This loads Google Maps, which means your browser contacts Google and
        Google may set cookies. Nothing else on this site does that.</span>
      </button>
    </div>

    <h2 id="faq">Questions</h2>
    <div class="faq">
      ${faq.map(([q, a]) => `<details class="faq__item">
        <summary>${esc(q)}</summary>
        <div>${a}</div>
      </details>`).join('\n      ')}
    </div>
  </div>
</section>`;
}

export const FAQ = (shop) => [
  ['How long does it take?',
   `<p>Everything is made to order. The lamps take up to ${shop.lead.toOrderDays} working
    days in the workshop, and each product page says so. For cathelier pieces the
    clock starts when you approve the drawing.</p>`],
  ['Can I have a name on it?',
   `<p>Yes, on anything, and it costs nothing extra. Put it in the engraving box on
    the product page — a name, a date, or a short phrase.</p>
    <p>One thing to know: a piece with a name on it is made for you alone, so it
    cannot be returned under the 14-day rule. Choosing a colour we already offer
    is not personalisation and does not affect your right to cancel.</p>`],
  ['Is it safe in a baby’s room?',
   `<p>These are decorative night lights, not toys. They are made of solid pine with
    water-based paints and every edge is sanded by hand, but they are not tested
    as toys and should not be handed to a small child to play with.</p>
    <p>If it is going in a cot room, keep the cable out of the cot.
    <a href="/care-and-safety/">Everything about care and safety</a>.</p>`],
  ['Batteries or mains?',
   `<p>Both, at the same price. The battery version takes two AA cells, which are
    not included. The mains version comes with a remote that dims it, times it
    and makes it pulse.</p>`],
  ['What does delivery cost?',
   `<p>It depends where you are.
    <a href="/legal/shipping-and-returns/">The full table is here</a>.</p>`],
  ['Can I change my mind?',
   `<p>You have ${shop.returns.coolingOffDays} days on anything that is not
    personalised. <a href="/legal/cancellation/">How it works</a>.</p>`],
  ['Do you take large orders?',
   `<p>Yes — favours, place cards, corporate gifts, club trophies.
    <a href="/cathelier/quote/">Ask for a quote</a> and say roughly how many.</p>`],
];

/* --- quote ---------------------------------------------------------------- */

export function quote({ identity }) {
  return `
<section class="section">
  <div class="shell shell--narrow page-prose">
    <h1>Ask for a quote</h1>
    <p class="lede">For anything in quantity — wedding favours, christening keepsakes,
       place cards, corporate gifts, trophies for a season.</p>
    <p>Tell us roughly what and roughly how many and we will come back with a price
       and a date. There is no form to fight with: a message is enough.</p>

    <div class="contact-cards">
      <a class="contact-card" href="https://wa.me/${esc(identity.whatsapp)}" rel="noopener">
        ${icon('whatsapp', 22)}<span><strong>WhatsApp</strong><br>Send a photo of what you have in mind</span>
      </a>
      <a class="contact-card" href="mailto:${esc(identity.email)}?subject=Quote">
        ${icon('mail', 22)}<span><strong>${esc(identity.email)}</strong><br>For drawings and longer lists</span>
      </a>
    </div>

    <h2>What helps us answer quickly</h2>
    <ul>
      <li>Roughly how many.</li>
      <li>What it is for, and the date it is needed by.</li>
      <li>The names, dates or words that go on it — or just say "50 different names".</li>
      <li>Any picture of something close to what you want.</li>
    </ul>

    <h2>How it goes from there</h2>
    <ol>
      <li>We answer with a price and a date.</li>
      <li>You approve a drawing. Nothing is cut before that.</li>
      <li>We make it, and it comes to you ready to give.</li>
    </ol>
  </div>
</section>`;
}

/* --- basket ---------------------------------------------------------------- */

/* O LOGÓTIPO DE UM MÉTODO DE PAGAMENTO.
 *
 * `alt=""` de propósito, e não por esquecimento: o nome da marca já está no
 * `.pay-choice__name` a dois centímetros dali, e um `alt="MB WAY"` fazia um
 * leitor de ecrã dizer «MB WAY MB WAY». Aqui a imagem é mesmo decoração — quem
 * não a vê não perde nada, porque tudo o que ela diz está escrito.
 *
 * As DIMENSÕES vão no atributo para o browser reservar o espaço antes de o SVG
 * chegar: sem elas a lista dá um salto quando os três carregam.
 *
 * AS TRÊS ALTURAS SÃO DIFERENTES E ISSO NÃO É DISTRACÇÃO. O logótipo do
 * Multibanco é ao alto (o símbolo com a palavra por baixo) e os outros dois
 * são deitados; à mesma altura, «MULTIBANCO» fica uma mancha. Medido: lê-se a
 * partir dos ~38px, enquanto o MB WAY se lê aos 24 e o Payshop aos 19. Cada
 * marca vai ao seu tamanho óptico. O porquê por extenso, e a proveniência da
 * obra-de-arte, estão em assets/brand/pay/LEIA.md. */
const MARCAS = {
  mbway: { w: 143.2, h: 69.57, alto: 24 },
  multibanco: { w: 153.98, h: 181.88, alto: 38 },
  payshop: { w: 455.24, h: 120.57, alto: 19 },
};

function marca(qual, nome) {
  const m = MARCAS[qual];
  if (!m) throw new Error(`logótipo desconhecido: ${qual}`);
  const largura = Math.round((m.w / m.h) * m.alto);
  return `<span class="pay-choice__marca">`
    + `<img src="/assets/pay/${esc(qual)}.svg" alt="" width="${largura}" height="${m.alto}"`
    + ` style="height:${m.alto}px" loading="lazy" decoding="async">`
    + `</span>`;
}

export function basket({ shipping }) {
  return `
<section class="section">
  <div class="shell">
    <h1>Your basket</h1>

    <div data-basket-empty hidden>
      <p class="lede" style="margin-block-start:1rem">There is nothing in it yet.</p>
      <p style="margin-block-start:1.5rem">
        <a class="btn" href="/lamps/">See the lamps</a>
        <a class="btn btn--ghost" href="/cathelier/pieces/" style="margin-inline-start:.5rem">See the pieces</a>
      </p>
    </div>

    <div class="basket" data-basket hidden>
      <div class="basket__lines" data-basket-lines></div>

      <aside class="basket__total">
        <h2>Total</h2>
        <label class="field" for="country" style="margin-block-start:1rem">
          <span style="display:block;margin-block-end:.5rem">Shipping to</span>
          <span class="select"><select id="country" data-country>
            ${shipping.zones.flatMap((z) => z.countries
              .filter((c) => shipping.active.includes(c.slice(0, 2)))
              .map((c) => `<option value="${esc(c)}">${esc(COUNTRY[c] || c)}</option>`)).join('\n            ')}
          </select></span>
        </label>
        <dl class="basket__sums">
          <dt>Pieces</dt><dd data-sum-goods>—</dd>
          <dt>Shipping</dt><dd data-sum-shipping>—</dd>
          <dt class="basket__grand">To pay</dt><dd class="basket__grand" data-sum-total>—</dd>
        </dl>
        <p class="small muted">VAT is not charged: article 53 of the Portuguese VAT code applies.</p>
      </aside>
    </div>

    <!-- QUEM PERGUNTA ISTO SOMOS NÓS, AGORA.
         A página de pagamento anterior recolhia o nome, a morada, o telefone e
         o contribuinte, e a loja lia-os de volta. O Pay by Link da ifthenpay
         recebe um valor e um identificador, e não pergunta nada a ninguém --
         por isso, ou isto está aqui, ou não há para onde enviar a encomenda.

         É um <form> a sério e não campos soltos: assim o Enter funciona, o
         browser valida sozinho, e quem usa leitor de ecrã ouve os erros sem
         que ninguém os tenha de escrever à mão. -->
    <form class="checkout" data-checkout-form novalidate>
      <h2>Where it goes</h2>
      <div class="checkout__grid">
        <label class="field"><span>Your name</span>
          <input type="text" name="nome" autocomplete="name" required maxlength="120"></label>
        <label class="field"><span>Email</span>
          <input type="email" name="email" autocomplete="email" required maxlength="160"></label>
        <label class="field"><span>Address</span>
          <input type="text" name="linha1" autocomplete="address-line1" required maxlength="160"></label>
        <label class="field"><span>Flat, floor <span class="field__optional">optional</span></span>
          <input type="text" name="linha2" autocomplete="address-line2" maxlength="160"></label>
        <label class="field"><span>Post code</span>
          <input type="text" name="postal" autocomplete="postal-code" required maxlength="20"></label>
        <label class="field"><span>Town</span>
          <input type="text" name="cidade" autocomplete="address-level2" required maxlength="80"></label>
        <label class="field"><span>Phone <span class="field__optional">optional</span></span>
          <input type="tel" name="telefone" autocomplete="tel" maxlength="40"></label>
        <label class="field"><span>Tax number <span class="field__optional">optional, for the invoice</span></span>
          <input type="text" name="nif" inputmode="numeric" maxlength="20"></label>
      </div>
      <!-- A ESCOLHA DO MÉTODO PASSOU A SER AQUI.
           Era feita numa página da ifthenpay, depois de sair daqui. Agora o
           pagamento acontece numa página nossa, e por isso a pergunta é feita
           antes de o botão ser carregado -- o que também é o que a lei quer:
           o consumidor tem de saber o que vai acontecer ANTES de assumir a
           obrigação de pagar (artigo 4.º n.º 1 do DL 24/2014). -->
      <h2 style="margin-block-start:2rem">How you pay</h2>
      <div class="pay-choice" data-pay-methods>
        <label class="pay-choice__opt">
          <input type="radio" name="metodo" value="MBWAY" checked>
          <span class="pay-choice__body">
            <span class="pay-choice__name">MB WAY</span>
            <span class="pay-choice__note">You get the request on your phone and accept it there. Takes a minute.</span>
          </span>
          ${marca('mbway', 'MB WAY')}
        </label>
        <!-- SÓ APARECE COM O MB WAY ESCOLHIDO: pedir um telemóvel a quem vai
             pagar uma referência Multibanco é pedir um dado que não serve para
             nada, que é o teste do artigo 5.º n.º 1 alínea c) do RGPD.
             E VIVE COLADO À OPÇÃO A QUE PERTENCE, e não no fim da lista, onde
             ficava órfão debaixo das três como se fosse mais um campo da
             morada. Fora do <label> do rádio de propósito: um campo de texto
             dentro do rótulo de um rádio faz cada clique no campo mexer no
             rádio. -->
        <label class="field pay-choice__extra" data-mbway-phone>
          <span>Your MB WAY phone number</span>
          <input type="tel" name="mbway" inputmode="tel" autocomplete="tel"
                 placeholder="912 345 678" maxlength="20">
          <span class="small muted" style="display:block;margin-block-start:.35rem">
            Portuguese mobile. We send it to ifthenpay to raise the request, and nowhere else.</span>
        </label>

        <label class="pay-choice__opt">
          <input type="radio" name="metodo" value="MB">
          <span class="pay-choice__body">
            <span class="pay-choice__name">Multibanco reference</span>
            <span class="pay-choice__note">We give you an entity and a reference to pay at an ATM or in home banking.</span>
          </span>
          ${marca('multibanco', 'Multibanco')}
        </label>
        <label class="pay-choice__opt">
          <input type="radio" name="metodo" value="PAYSHOP">
          <span class="pay-choice__body">
            <span class="pay-choice__name">Payshop</span>
            <span class="pay-choice__note">A reference to pay in cash at any Payshop agent.</span>
          </span>
          ${marca('payshop', 'Payshop')}
        </label>
      </div>


      <!-- O RÓTULO DO BOTÃO É UMA EXIGÊNCIA LEGAL, não uma escolha de estilo.
           O artigo 5.º n.º 4 do DL 24/2014 obriga a que o botão diga, sem
           ambiguidade, que a encomenda implica pagar. «Checkout» ou «Continuar»
           não cumprem: a sanção é o contrato não vincular o consumidor. -->
      <button class="btn btn--wide" type="submit" data-to-checkout style="margin-block-start:1.25rem">
        Order and pay</button>
      <p class="small muted" style="margin-block-start:.6rem">
        Payments are handled by ifthenpay. We never see your card, your bank or your MB WAY PIN.</p>
    </form>
  </div>
</section>`;
}

const COUNTRY = {
  PT: 'Portugal (mainland)', 'PT-20': 'Azores', 'PT-30': 'Madeira',
  ES: 'Spain', FR: 'France', GB: 'United Kingdom', DE: 'Germany', CH: 'Switzerland',
  AT: 'Austria', BE: 'Belgium', NL: 'Netherlands', LU: 'Luxembourg', IT: 'Italy',
  IE: 'Ireland', DK: 'Denmark', SE: 'Sweden', FI: 'Finland', PL: 'Poland',
  CZ: 'Czechia', SK: 'Slovakia', HU: 'Hungary', SI: 'Slovenia', HR: 'Croatia',
  RO: 'Romania', BG: 'Bulgaria', GR: 'Greece', EE: 'Estonia', LV: 'Latvia',
  LT: 'Lithuania', MT: 'Malta', CY: 'Cyprus', NO: 'Norway',
};

export function notFound() {
  return `
<section class="section">
  <div class="shell shell--narrow" style="text-align:center">
    <h1>There is nothing here</h1>
    <p class="lede" style="margin-block-start:1rem">
      The page you were looking for has moved or never existed.
    </p>
    <p style="margin-block-start:2rem">
      <a class="btn" href="/lamps/">See the lamps</a>
      <a class="btn btn--ghost" href="/cathelier/" style="margin-inline-start:.5rem">See the pieces</a>
    </p>
  </div>
</section>`;
}

/* --- depois do pagamento ---------------------------------------------------
   Two pages the payment page sends people back to. Both are noindex: they are the end of
   a private transaction, not content. */

/* O número de dias vem por argumento e NÃO por marcador: a substituição de
   `{{…}}` só corre nos ficheiros de texto do `content/`, e esta página é um
   template de JavaScript. O marcador saía literal para o ecrã -- e foi a
   contagem de marcadores por preencher do check-output que o apanhou, na
   mesma construção em que nasceu. */
export function thankYou(shop = {}) {
  return `
<section class="section">
  <div class="shell shell--narrow page-prose" style="text-align:center">
    <h1>Thank you</h1>
    <p class="lede" data-order-state>Checking your payment…</p>

    <div data-order-ok hidden>
      <p>Your order is <strong data-order-ref>—</strong>. Keep that reference: it is
         what we both use if you write to us.</p>
      <p>A confirmation is on its way to your inbox. Everything is made to order,
         so the workshop starts now and we will tell you when it ships.</p>
      <p style="margin-block-start:2rem">
        <a class="btn" href="/lamps/">Back to the lamps</a>
      </p>
    </div>

    <!-- O TERCEIRO ESTADO É O NORMAL, e não existia.
         Com uma referência Multibanco o comprador volta para aqui sem ter
         pagado -- vai pagar hoje à noite, ou amanhã. A página tinha só «pago»
         e «espere um minuto e recarregue», e a segunda dizia a quase toda a
         gente que algo tinha corrido mal quando não tinha corrido mal nada. -->
    <div data-order-waiting hidden>
      <p>Your order is <strong data-order-ref-waiting>—</strong>. Keep that
         reference: it is what we both use if you write to us.</p>
      <p>We have not received the payment yet, and that is normal if you chose a
         Multibanco reference — it is yours for ${shop.payment?.referenceDays ?? 2} days.
         Nothing is made and nothing is charged until you pay it.</p>
      <p>The moment it reaches us we write to you, and the workshop starts. If
         you have just paid, give it a minute and reload this page.</p>
      <p style="margin-block-start:2rem">
        <a class="btn btn--ghost" href="/lamps/">Back to the lamps</a>
      </p>
    </div>

    <div data-order-pending hidden>
      <p>We could not find that order. If you have just paid, give it a minute
         and reload this page.</p>
      <p>If it stays like this, write to us — nothing will be charged twice.</p>
    </div>
  </div>
</section>`;
}

/* A PÁGINA ONDE SE PAGA, QUE ATÉ AQUI ERA DA IFTHENPAY.
 *
 * Três desfechos e um deles não é um erro: uma referência Multibanco fica por
 * pagar durante dias, de propósito. A página tem de servir tão bem a quem
 * acabou de a receber como a quem volta dois dias depois para a reler -- por
 * isso não guarda nada em memória: lê tudo de `/order`, que é o único sítio
 * onde o estado vive.
 *
 * TUDO PINTADO E ESCONDIDO, e não construído por JavaScript. Quem chega com um
 * ecrã de leitura vê os títulos e a estrutura; o que o JavaScript faz é
 * escolher qual dos blocos se mostra e preencher os números. */
export function payPage(shop = {}) {
  const dias = shop.payment?.referenceDays ?? 2;
  return `
<section class="section">
  <div class="shell shell--narrow page-prose">
    <h1>Pay for your order</h1>
    <p class="lede" data-pay-state>Getting your payment ready…</p>

    <!-- MB WAY: o comprador tem quatro minutos para aceitar na app. -->
    <div data-pay-mbway hidden>
      <h2>Open your MB WAY app</h2>
      <p>We sent a payment request to your phone. Open MB WAY, check the amount,
         and accept it.</p>
      <p class="pay-amount"><span data-pay-amount>—</span></p>
      <p class="pay-clock" role="status">
        Time left: <strong data-pay-countdown>4:00</strong></p>
      <p class="small muted">Leave this page open — it changes by itself the moment
         you accept. If the request expires, you can order again and choose a
         Multibanco reference instead.</p>
    </div>

    <!-- Multibanco: a referência é o produto. Grande, copiável, e com o valor
         exacto ao lado, porque pagar um cêntimo a menos não confirma nada. -->
    <div data-pay-mb hidden>
      <h2>Pay this Multibanco reference</h2>
      <p>At an ATM choose <em>Pagamentos e outros serviços</em> → <em>Pagamentos de serviços</em>,
         or use your bank&rsquo;s app or home banking.</p>
      <dl class="pay-ref">
        <div class="pay-ref__row">
          <dt>Entity</dt>
          <dd><span data-pay-entity>—</span>
            <button type="button" class="pay-copy" data-copy="entity">Copy</button></dd>
        </div>
        <div class="pay-ref__row">
          <dt>Reference</dt>
          <dd><span data-pay-reference>—</span>
            <button type="button" class="pay-copy" data-copy="reference">Copy</button></dd>
        </div>
        <div class="pay-ref__row">
          <dt>Amount</dt>
          <dd><span data-pay-amount-mb>—</span>
            <button type="button" class="pay-copy" data-copy="amount">Copy</button></dd>
        </div>
      </dl>
      <p>The reference is yours for ${dias} days<span data-pay-expiry hidden>, until
         <strong data-pay-expiry-date>—</strong></span>. Nothing is made and nothing is
         charged until you pay it.</p>
      <p class="small muted">The moment the payment reaches us we write to you and the
         workshop starts. You can close this page — we have the reference in your
         email too.</p>
    </div>

    <!-- Payshop: referência de 13 dígitos, paga-se em dinheiro ao balcão. -->
    <div data-pay-payshop hidden>
      <h2>Pay this Payshop reference</h2>
      <p>Take it to any Payshop agent — most newsagents, post offices and many
         corner shops.</p>
      <dl class="pay-ref">
        <div class="pay-ref__row">
          <dt>Reference</dt>
          <dd><span data-pay-reference-ps>—</span>
            <button type="button" class="pay-copy" data-copy="reference-ps">Copy</button></dd>
        </div>
        <div class="pay-ref__row">
          <dt>Amount</dt>
          <dd><span data-pay-amount-ps>—</span>
            <button type="button" class="pay-copy" data-copy="amount-ps">Copy</button></dd>
        </div>
      </dl>
      <p>The reference is yours for ${dias} days. Nothing is made and nothing is
         charged until you pay it.</p>
    </div>

    <!-- Pago. Não se manda ninguém para outro lado: o comprador acabou de
         fazer uma coisa e quer ver que resultou, não um redireccionamento. -->
    <div data-pay-done hidden>
      <h2>Paid — thank you</h2>
      <p>Your order is <strong data-pay-ref>—</strong>. Keep that reference: it is
         what we both use if you write to us.</p>
      <p>A confirmation is on its way to your inbox. Everything is made to order,
         so the workshop starts now and we will tell you when it ships.</p>
      <p style="margin-block-start:2rem"><a class="btn" href="/lamps/">Back to the lamps</a></p>
    </div>

    <!-- Recusado ou expirado no MB WAY. Não é uma avaria e o texto não trata
         disto como se fosse: é alguém que carregou em «não» ou deixou passar. -->
    <div data-pay-failed hidden>
      <h2 data-pay-failed-title>The request expired</h2>
      <p data-pay-failed-text>Nothing was charged. Your basket is still here, so you
         can order again — and if MB WAY is being awkward, a Multibanco reference
         always works.</p>
      <p style="margin-block-start:2rem">
        <a class="btn" href="/cart/">Back to the basket</a></p>
    </div>

    <div data-pay-unknown hidden>
      <p>We could not find that order. If you have just paid, give it a minute and
         reload this page.</p>
      <p>If it stays like this, write to us — nothing will be charged twice.</p>
    </div>

    <p class="small muted" style="margin-block-start:2.5rem">
      Payments are handled by <a href="https://ifthenpay.com/" rel="noopener">ifthenpay</a>,
      a Portuguese payment institution. We never see your card, your bank or your
      MB WAY PIN.</p>
  </div>
</section>`;
}

export function orderCancelled() {
  return `
<section class="section">
  <div class="shell shell--narrow page-prose" style="text-align:center">
    <!-- «Nothing was charged» deixou de ser verdade sempre.
         Quem chegou aqui pode ter uma referência Multibanco emitida e ainda por
         pagar: nesse caso nada foi cobrado AINDA, que é outra coisa. O texto
         diz o que se sabe -- não avançámos -- sem jurar o que não se sabe. -->
    <h1>The order was not placed</h1>
    <p class="lede">You left the payment page, so we have not taken anything and
       the order has not gone through.</p>
    <p>If you were given a Multibanco reference before you left, it may still be
       valid — paying it will confirm the order. Otherwise your basket is still
       here if you want to pick it up again.</p>
    <p style="margin-block-start:2rem">
      <a class="btn" href="/cart/">Back to the basket</a>
      <a class="btn btn--ghost" href="/lamps/" style="margin-inline-start:.5rem">Keep looking</a>
    </p>
  </div>
</section>`;
}
