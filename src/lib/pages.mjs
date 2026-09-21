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
      <!-- O RÓTULO DO BOTÃO É UMA EXIGÊNCIA LEGAL, não uma escolha de estilo.
           O artigo 5.º n.º 4 do DL 24/2014 obriga a que o botão diga, sem
           ambiguidade, que a encomenda implica pagar. «Checkout» ou «Continuar»
           não cumprem: a sanção é o contrato não vincular o consumidor. -->
      <button class="btn btn--wide" type="submit" data-to-checkout style="margin-block-start:1.25rem">
        Order and pay</button>
      <p class="small muted" style="margin-block-start:.6rem">
        You will be taken to ifthenpay to pay by Multibanco or MB WAY. We never see your card details.</p>
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
