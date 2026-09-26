import { esc, money, safeHref } from './html.mjs';
import { icon } from './icons.mjs';
import { prazos } from './prazos.mjs';
import { t, tn, lingua } from './i18n.mjs';

/* ===========================================================================
   The pages that are prose, plus the three that are not.
   ===========================================================================

   The prose ones are Markdown with {{MARKERS}} in them. Contacts, deadlines and
   the shipping table are NEVER typed into a legal page by hand: on another
   project the address on a terms page and the address in the settings drifted
   apart in silence, and the one people read was the wrong one. The markers are
   filled from the settings at build time, and an unknown marker kills the
   build rather than reaching a page.

   AS FRASES SÃO DA LÍNGUA DA PÁGINA, OS DADOS NÃO. O nome, o NIF e as moradas
   ficam como estão; o que é frase -- o custo da chamada, a nota do IVA, a
   tabela dos portes -- sai de src/i18n/<língua>/paginas.json. Isto é chamado
   depois de o gerador escolher a língua, por isso t() já sabe qual é. */

/* O preço na tabela dos portes: money() (html.mjs) já põe o € onde a língua
   o põe. */
const preco = (n) => money(n);

/* A MORADA POSTAL DE QUEM VENDE, numa linha. Uma função só, porque a lei a
   pede em dois sítios das páginas -- as páginas legais (DL 7/2004, art. 10.º,
   pelo marcador {{ADDRESS}}) e a ficha de cada produto (Reg. (UE) 2023/988,
   art. 19.º) -- e duas maneiras de a juntar são duas maneiras de ela divergir.
   (O catálogo do Worker leva-a às linhas, e junta-as ele.) */
export const enderecoDe = (i) => [i.street, [i.postcode, i.town].filter(Boolean).join(' '), i.country]
  .filter(Boolean).join(', ');

/* O FABRICANTE NA OFERTA (Reg. (UE) 2023/988, art. 19.º al. a)): nome, morada
   postal e endereço eletrónico, em cada ficha de produto. A dona é quem faz as
   peças e quem as vende, e os três dados saem de content/settings/identity.json
   -- nunca escritos aqui, pela mesma razão das páginas legais: no dia em que a
   morada mudar, muda em todo o lado ou em lado nenhum. */
export function fabricante(identity) {
  const i = identity;
  return `<p class="product__maker"><strong>${esc(t('paginas.fabricante.rotulo'))}:</strong> `
    + `${esc(i.legalName)}, ${esc(enderecoDe(i))} · `
    + `<a href="mailto:${esc(i.email)}">${esc(i.email)}</a></p>`;
}

export function markers({ identity, shop, shipping }) {
  const i = identity;
  const address = enderecoDe(i);

  const rows = shipping.zones
    .filter((z) => z.countries.some((c) => shipping.active.includes(c.slice(0, 2))))
    .map((z) => `| ${z.name} | ${preco(z.price)} | ${t('paginas.envios.dias', { min: z.daysMin, max: z.daysMax })} |`);
  const table = rows.length
    ? [`| ${t('paginas.envios.onde')} | ${t('paginas.envios.portes')} | ${t('paginas.envios.prazo')} |`, '|---|---|---|', ...rows].join('\n')
    : `_${t('paginas.envios.nenhum')}_`;

  return {
    LEGAL_NAME: i.legalName, TRADING_NAME: i.tradingName, LEGAL_FORM: i.legalForm,
    TAX_NUMBER: i.taxNumber, ADDRESS: address || i.town,
    EMAIL: i.email, PHONE: i.phone, PHONE_TEXT: i.phoneText,
    /* A mesma frase da moldura (shell.json): é a que a lei manda pôr ao lado
       do número, e uma frase que a lei exige não se escreve em dois sítios. */
    CALL_COST: t('shell.custoChamada'),
    COMPLAINTS_BOOK: i.complaintsBook,
    ADR_NAME: i.adr.name, ADR_SITE: i.adr.site, ADR_EMAIL: i.adr.email,
    ADR_PHONE: i.adr.phone, ADR_ADDRESS: i.adr.address,
    CARRIER: shipping.carrier,
    /* O NOME DE QUEM RECEBE O PAGAMENTO VIVE NUM SÍTIO SÓ.
       Estava escrito à mão nos termos e na privacidade, e no dia em que a loja
       trocou de processador as duas páginas passaram a mentir -- publicadas,
       em quatro moradas. Um marcador obriga a que mudem juntas. */
    PAYMENT_PROVIDER: shop.payment?.provider ?? t('paginas.pagamento.prestador'),
    PAYMENT_METHODS: shop.payment?.methods ?? t('paginas.pagamento.metodos'),
    PAYMENT_REFERENCE_DAYS: String(shop.payment?.referenceDays ?? 2),
    /* Os prazos saem dos mesmos dois números que a ficha do produto e os
       emails usam. */
    IN_STOCK_DAYS: prazos(shop.lead).dias,
    TO_ORDER_WEEKS: prazos(shop.lead).semanas,
    COOLING_OFF_DAYS: String(shop.returns.coolingOffDays),
    WARRANTY_YEARS: String(shop.returns.warrantyYears),
    FORM_URL: '/legal/returns-form/',
    SHIPPING_TABLE: table,
    SAFETY_LIST: (shop.safetyIthos || []).map((s) => `- ${s}`).join('\n'),
    // Under the Portuguese small-business exemption there is no VAT to state,
    // and saying so is required rather than optional.
    VAT_NOTE: t('paginas.iva'),
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
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, h) => `<a href="${safeHref(h, `the link «${t}»`)}">${t}</a>`)
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
      /* `## Title {#anchor}` gives the heading an id, the way Pandoc and
         kramdown do, so a page can be linked to one section -- the reseller
         conditions are, from the sign-in page and from every reseller email. */
      const comId = line.replace(/^#+ /, '').match(/^(.*?)\s*\{#([a-z0-9-]+)\}\s*$/);
      const titulo = comId ? comId[1] : line.replace(/^#+ /, '');
      out.push(`<h${level}${comId ? ` id="${comId[2]}"` : ''}>${inline(titulo)}</h${level}>`);
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

/* UM BLOCO DO CÓDIGO NUMA PÁGINA ESCRITA EM MARKDOWN.
   O texto das páginas legais é da dona (content/pages/*.md, editável no
   painel e traduzido aos bocados); o que não pode ser texto -- o aviso oficial
   da garantia legal, o formulário de retratação, o botão que leva a ele --
   entra aqui, antes do primeiro título de secção: a seguir ao título e à
   introdução da página. Sem nenhum «##», fica no fim. */
export function comBloco(html, bloco) {
  if (!bloco) return html;
  const i = html.indexOf('<h2');
  return i < 0 ? `${html}\n${bloco}` : `${html.slice(0, i)}${bloco}\n${html.slice(i)}`;
}

/* --- o aviso harmonizado da garantia legal ---------------------------------
 *
 * O FICHEIRO É O DA COMISSÃO, TAL COMO VEM. O Regulamento de Execução (UE)
 * 2025/1960 (anexo I, nota 1) proíbe editar qualquer elemento do aviso, e a
 * nota 5 quer-no a cores quando é mostrado online. Os SVG e os PDF estão em
 * assets/legal/, copiados dos arquivos oficiais sem lhes tocar (ver o LEIA.md
 * de lá, e a guarda em scripts/guards.mjs que lhes confere o SHA-256).
 *
 * O TEXTO ALTERNATIVO É O TEXTO OFICIAL, palavra por palavra: o SVG tem as
 * letras convertidas em contornos, e um leitor de ecrã não leria nada.
 *
 * NO TELEMÓVEL, O AVISO NÃO ENCOLHE. Uma folha A4 inteira em 343 px deixa as
 * letras com cinco ou seis píxeis, e as orientações da Comissão pedem que se
 * leia no tamanho em que é mostrado. Por isso fica na largura dele, numa caixa
 * que se desloca para o lado, com o PDF oficial ao lado para quem preferir.
 *
 * A língua do aviso é a da página. Uma língua nova no site sem o aviso dela
 * pára o gerador: o arquivo da Comissão traz as 24, e é só copiar o ficheiro. */
const AVISO_GARANTIA = {
  pt: { svg: '/assets/legal/aviso-garantia-legal-pt.svg', pdf: '/assets/legal/aviso-garantia-legal-pt.pdf' },
  en: { svg: '/assets/legal/aviso-garantia-legal-en.svg', pdf: '/assets/legal/aviso-garantia-legal-en.pdf' },
};

export function avisoGarantia() {
  const a = AVISO_GARANTIA[lingua()];
  if (!a) {
    throw new Error(`Não há aviso harmonizado da garantia legal em «${lingua()}». Copie-o do arquivo SVG `
      + 'da Comissão para assets/legal/ e junte-o a AVISO_GARANTIA em src/lib/pages.mjs.');
  }
  const ligacao = `<a href="${esc(t('paginas.garantia.url'))}" rel="noopener">${esc(t('paginas.garantia.urlTexto'))}</a>`;
  return `<figure class="aviso-garantia">
      <div class="aviso-garantia__caixa" role="region" tabindex="0" aria-label="${esc(t('paginas.garantia.avisoRegiao'))}">
        <img src="${a.svg}" width="595" height="842" decoding="async" alt="${esc(t('paginas.garantia.avisoAlt'))}">
      </div>
      <figcaption>
        <p class="aviso-garantia__deslizar">${esc(t('paginas.garantia.deslizar'))}</p>
        <p>${t('paginas.garantia.portal', { ligacao })}</p>
        <p><a class="aviso-garantia__pdf" href="${a.pdf}" type="application/pdf">${esc(t('paginas.garantia.pdf'))}</a></p>
      </figcaption>
    </figure>`;
}

/* --- a função de retratação --------------------------------------------------
 *
 * Artigo 11.º-A da Diretiva 2011/83, pela Diretiva (UE) 2023/2673: numa loja
 * online, o consumidor tem de se poder retratar por uma função própria, que
 * pede o nome, o que identifica o contrato e o email para onde vai o aviso de
 * receção, e que se envia com um botão «confirmar retratação». Em Portugal, o
 * artigo 11.º n.º 4 do DL 24/2014 já obriga a acusar a receção em 24 horas,
 * em suporte duradouro, quando o site deixa desistir por via eletrónica.
 *
 * O FORMULÁRIO NASCE ESCONDIDO e é o shop.js que o mostra, quando há Worker
 * para onde o enviar. Sem JavaScript, um formulário que não vai a lado nenhum
 * seria uma promessa falsa; o texto da página (content/pages/legal/withdraw.md)
 * explica como fazer o mesmo por email, e isso vale sempre.
 *
 * TUDO PINTADO AQUI, como na página de pagamento: o script escolhe o bloco
 * que se mostra e escreve a data e a hora que o Worker devolveu -- a hora do
 * servidor, e não a do telemóvel de quem se retrata.
 *
 * TRÊS RESPOSTAS DE SUCESSO, e cada uma diz só o que é verdade para ela
 * (o contrato está no shop.js, em retratacao()):
 *   · uma declaração nova -- também quando a encomenda já tinha outra, com
 *     outros artigos: «Recebemos», a hora dela, e o aviso de receção;
 *   · `repetido: true` -- ESTA declaração, igual, já tinha chegado: a data é a
 *     da primeira, e não se promete aviso novo (não sai nenhum);
 *   · `emailDiferente: true` -- o email escrito não é o da encomenda: o aviso
 *     foi para o da encomenda, e a página di-lo em vez de apontar para o
 *     email escrito.
 * A hora diz-se sempre da mesma maneira, como no aviso de receção do Worker:
 * a hora em que a pessoa a ENVIOU, em hora de Lisboa (art. 11.º-A n.º 4 da
 * Diretiva 2011/83: «a data e a hora do envio»). */
export function formularioRetratacao() {
  /* A mesma encomenda, data e hora nas duas frases (a nova e a repetida): o
     script escreve em todos os elementos com a marca. */
  const quando = {
    encomenda: '<strong data-retratacao-encomenda></strong>',
    data: '<strong data-retratacao-data></strong>',
    hora: '<strong data-retratacao-hora></strong>',
  };
  const campo = (id, rotulo, input, { ajuda = '', opcional = false } = {}) => `<div class="field">
        <label for="rt-${id}">${esc(rotulo)}${opcional ? ` <span class="field__optional">${esc(t('paginas.entrega.opcional'))}</span>` : ''}</label>
        ${ajuda ? `<p class="field__help" id="rt-${id}-ajuda">${esc(ajuda)}</p>` : ''}
        ${input.replace('<input', `<input id="rt-${id}"${ajuda ? ` aria-describedby="rt-${id}-ajuda"` : ''}`)
          .replace('<textarea', `<textarea id="rt-${id}"${ajuda ? ` aria-describedby="rt-${id}-ajuda"` : ''}`)}
      </div>`;
  return `<form class="retratar" data-retratacao novalidate hidden aria-labelledby="rt-titulo">
      <h2 id="rt-titulo">${esc(t('paginas.retratacao.titulo'))}</h2>
      ${campo('nome', t('paginas.retratacao.nome'),
        '<input type="text" name="nome" autocomplete="name" required maxlength="120">')}
      ${campo('encomenda', t('paginas.retratacao.encomenda'),
        '<input type="text" name="encomenda" required maxlength="24" pattern="IC-[A-Z0-9]{12}" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="IC-">',
        { ajuda: t('paginas.retratacao.encomendaAjuda') })}
      ${campo('email', t('paginas.retratacao.email'),
        '<input type="email" name="email" autocomplete="email" required maxlength="160">',
        { ajuda: t('paginas.retratacao.emailAjuda') })}
      ${campo('artigos', t('paginas.retratacao.artigos'),
        '<textarea name="artigos" rows="3" maxlength="600"></textarea>',
        { ajuda: t('paginas.retratacao.artigosAjuda'), opcional: true })}
      <button class="btn" type="submit" data-retratacao-confirmar>${esc(t('paginas.retratacao.confirmar'))}</button>
    </form>
    <p class="retratar__msg" data-retratacao-msg role="status" hidden></p>
    <div class="retratar__ok" data-retratacao-ok hidden>
      <h2 tabindex="-1" data-retratacao-ok-titulo data-retratacao-nova>${esc(t('paginas.retratacao.recebida.titulo'))}</h2>
      <h2 tabindex="-1" data-retratacao-ok-titulo data-retratacao-repetida hidden>${esc(t('paginas.retratacao.repetida.titulo'))}</h2>
      <p data-retratacao-nova>${t('paginas.retratacao.recebida.texto', quando)}</p>
      <p data-retratacao-repetida hidden>${t('paginas.retratacao.repetida.texto', quando)}</p>
      ${/* O AVISO DE RECEÇÃO SÓ SE PROMETE QUANDO SAIU. O Worker responde
          `aviso: false` quando gravou a retratação mas o email ao comprador
          falhou -- e nesse caso é a dona quem o escreve (o Worker diz-lho).
          Dizer «vai receber» nessa altura era uma promessa que o código não
          cumpre. E o aviso vai SEMPRE para o email da encomenda: quando o
          escrito é outro, a página não aponta para ele. */ ''}<p data-retratacao-com-aviso hidden>${esc(t('paginas.retratacao.recebida.aviso'))}</p>
      <p data-retratacao-email-diferente hidden>${esc(t('paginas.retratacao.recebida.emailDiferente'))}</p>
      <p data-retratacao-aviso-antigo hidden>${esc(t('paginas.retratacao.repetida.aviso'))}</p>
      <p data-retratacao-sem-aviso hidden>${esc(t('paginas.retratacao.recebida.semAviso'))}</p>
      <p>${t('paginas.retratacao.recebida.devolver', { n: DIAS_PARA_DEVOLVER })}</p>
    </div>`;
}

/* O PRAZO PARA DEVOLVER AS PEÇAS DEPOIS DE SE RETRATAR É DA LEI, NÃO DA LOJA:
   14 dias a contar da comunicação da decisão (art. 13.º n.º 1 do DL 24/2014),
   o mesmo que o Worker põe no aviso de receção (PRAZOS_DA_LEI.devolverDias,
   em src/messages.js). `shop.returns.coolingOffDays` é outra coisa -- o prazo
   para desistir, que a loja pode alargar; se o alargar, este não se mexe. */
export const DIAS_PARA_DEVOLVER = 14;

/* A porta para a função de retratação, na página do direito de livre
   resolução: um botão, logo a seguir ao título, com as palavras que a
   diretiva manda usar. */
export const botaoRetratar = () => `<p class="retratar-ja"><a class="btn" href="/legal/withdraw/">${esc(t('paginas.retratacao.ligacao'))}</a></p>`;

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
    <h1>${esc(t('paginas.contacto.titulo'))}</h1>
    <p class="lede">${esc(t('paginas.contacto.entrada'))}</p>

    <div class="contact-cards">
      <a class="contact-card" href="https://wa.me/${esc(i.whatsapp)}" rel="noopener">
        ${icon('whatsapp', 22)}<span><strong>WhatsApp</strong><br>${esc(t('paginas.contacto.whatsapp'))}</span>
      </a>
      <a class="contact-card" href="mailto:${esc(i.email)}">
        ${icon('mail', 22)}<span><strong>${esc(i.email)}</strong><br>${esc(t('paginas.contacto.email'))}</span>
      </a>
      <a class="contact-card" href="tel:${esc(i.phone)}">
        ${icon('phone', 22)}<span><strong>${esc(i.phoneText)}</strong><br>${esc(t('shell.custoChamada'))}</span>
      </a>
    </div>

    <h2>${esc(t('paginas.contacto.ondeEstamos'))}</h2>
    <p>${esc(t('paginas.contacto.oficina', { cidade: i.town, pais: i.country }))}</p>

    <!-- The map is the only third-party content on this site, and it is the
         whole reason a consent question exists at all. It is asked HERE, in
         front of the map, by whoever wants to see it — not as a banner over
         every page for visitors who will never come near it. -->
    <div class="map" data-map>
      <button class="map__ask" type="button" data-map-load>
        ${icon('pin', 22)}
        <span><strong>${esc(t('paginas.contacto.mapa'))}</strong><br>
        ${esc(t('paginas.contacto.mapaAviso'))}</span>
      </button>
    </div>

    <h2 id="faq">${esc(t('paginas.contacto.perguntas'))}</h2>
    <div class="faq">
      ${faq.map(([q, a]) => `<details class="faq__item">
        <summary>${esc(q)}</summary>
        <div>${a}</div>
      </details>`).join('\n      ')}
    </div>
  </div>
</section>`;
}

/* As respostas levam marcação (<p>, <a>), e por isso vão para o dicionário
   com ela: as duas línguas têm as mesmas etiquetas, e só o texto muda. */
export const FAQ = (shop) => [
  [t('paginas.faq.prazo'), t('paginas.faq.prazo.resposta', { dias: prazos(shop.lead).dias, semanas: prazos(shop.lead).semanas })],
  [t('paginas.faq.nome'), t('paginas.faq.nome.resposta')],
  [t('paginas.faq.seguranca'), t('paginas.faq.seguranca.resposta')],
  [t('paginas.faq.pilhas'), t('paginas.faq.pilhas.resposta')],
  [t('paginas.faq.portes'), t('paginas.faq.portes.resposta')],
  [t('paginas.faq.desistir'), t('paginas.faq.desistir.resposta', { dias: shop.returns.coolingOffDays })],
  [t('paginas.faq.quantidade'), t('paginas.faq.quantidade.resposta')],
];

/* --- quote ---------------------------------------------------------------- */

export function quote({ identity }) {
  return `
<section class="section">
  <div class="shell shell--narrow page-prose">
    <h1>${esc(t('paginas.orcamento.titulo'))}</h1>
    <p class="lede">${esc(t('paginas.orcamento.entrada'))}</p>
    <p>${esc(t('paginas.orcamento.texto'))}</p>

    <div class="contact-cards">
      <a class="contact-card" href="https://wa.me/${esc(identity.whatsapp)}" rel="noopener">
        ${icon('whatsapp', 22)}<span><strong>WhatsApp</strong><br>${esc(t('paginas.orcamento.whatsapp'))}</span>
      </a>
      <a class="contact-card" href="mailto:${esc(identity.email)}?subject=${esc(encodeURIComponent(t('paginas.orcamento.assunto')))}">
        ${icon('mail', 22)}<span><strong>${esc(identity.email)}</strong><br>${esc(t('paginas.orcamento.email'))}</span>
      </a>
    </div>

    <h2>${esc(t('paginas.orcamento.ajuda'))}</h2>
    <ul>
      <li>${esc(t('paginas.orcamento.ajuda.quantas'))}</li>
      <li>${esc(t('paginas.orcamento.ajuda.para'))}</li>
      <li>${t('paginas.orcamento.ajuda.palavras')}</li>
      <li>${esc(t('paginas.orcamento.ajuda.imagem'))}</li>
    </ul>

    <h2>${esc(t('paginas.orcamento.passos'))}</h2>
    <ol>
      <li>${esc(t('paginas.orcamento.passos.preco'))}</li>
      <li>${esc(t('paginas.orcamento.passos.desenho'))}</li>
      <li>${esc(t('paginas.orcamento.passos.fazemos'))}</li>
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
 * partir dos ~38px, enquanto o MB WAY se lê aos 24. Cada
 * marca vai ao seu tamanho óptico. O porquê por extenso, e a proveniência da
 * obra-de-arte, estão em assets/brand/pay/LEIA.md. */
/* A APPLE E A GOOGLE PROÍBEM AS DUAS mostrar a sua marca mais pequena do que as
   outras identidades de pagamento «em formato semelhante». As marcas deitadas
   desta loja são o MB WAY (24); estas duas vão a 28, que não é menor. O Multibanco fica nos 38 e não entra na comparação: é
   um logótipo AO ALTO, outro formato, e a palavra dele deixa de se ler abaixo
   disso. Medi a alternativa de pôr tudo a 38 -- cumpre à letra e fica pior,
   com o Apple Pay e o Google Pay a dominar a lista. */
const MARCAS = {
  mbway: { w: 143.2, h: 69.57, alto: 24 },
  multibanco: { w: 153.98, h: 181.88, alto: 38 },
  applepay: { w: 165.52107, h: 105.9651, alto: 28 },
  googlepay: { w: 41, h: 17, alto: 28 },
};

/* O CARTÃO LEVA UM ÍCONE NOSSO E NÃO AS MARCAS DA VISA E DA MASTERCARD.
   A obra-de-arte da Visa que a ifthenpay distribui é o logótipo ANTIGO, que a
   Visa proíbe por escrito; a oficial das duas está atrás de acordos de
   descarga. E mostrar marcas de aceitação é opcional: não as mostrar não custa
   nada, mostrá-las mal custa. O porquê por extenso está em
   assets/brand/pay/LEIA.md. */
function marca(qual) {
  if (qual === 'cartao') {
    return `<span class="pay-choice__marca">${icon('card', 30)}</span>`;
  }
  const m = MARCAS[qual];
  if (!m) throw new Error(`logótipo desconhecido: ${qual}`);
  const largura = Math.round((m.w / m.h) * m.alto);
  return `<span class="pay-choice__marca">`
    + `<img src="/assets/pay/${esc(qual)}.svg" alt="" width="${largura}" height="${m.alto}"`
    + ` style="height:${m.alto}px" loading="lazy" decoding="async">`
    + `</span>`;
}

export function basket({ shipping, shop }) {
  return `
<section class="section">
  <div class="shell">
    <h1>${esc(t('paginas.cesto.titulo'))}</h1>

    <div data-basket-empty hidden>
      <p class="lede" style="margin-block-start:1rem">${esc(t('paginas.cesto.vazio'))}</p>
      <p style="margin-block-start:1.5rem">
        <a class="btn" href="/lamps/">${esc(t('paginas.botao.verCandeeiros'))}</a>
        <a class="btn btn--ghost" href="/cathelier/pieces/" style="margin-inline-start:.5rem">${esc(t('paginas.botao.verPecas'))}</a>
      </p>
    </div>

    <div class="basket" data-basket hidden>
      <div class="basket__lines" data-basket-lines></div>

      <aside class="basket__total">
        <h2>${esc(t('paginas.cesto.total'))}</h2>
        <label class="field" for="country" style="margin-block-start:1rem">
          <span style="display:block;margin-block-end:.5rem">${esc(t('paginas.cesto.enviarPara'))}</span>
          <span class="select"><select id="country" data-country>
            ${shipping.zones.flatMap((z) => z.countries
              .filter((c) => shipping.active.includes(c.slice(0, 2)))
              .map((c) => `<option value="${esc(c)}">${esc(nomeDoPais(c))}</option>`)).join('\n            ')}
          </select></span>
        </label>
        <dl class="basket__sums">
          <dt>${esc(t('paginas.cesto.pecas'))}</dt><dd data-sum-goods>—</dd>
          <dt>${esc(t('paginas.cesto.portes'))}</dt><dd data-sum-shipping>—</dd>
          <dt class="basket__grand">${esc(t('paginas.cesto.aPagar'))}</dt><dd class="basket__grand" data-sum-total>—</dd>
        </dl>
        <!-- O prazo da encomenda inteira, escrito pelo script depois de
             perguntar ao Worker pelo stock. As frases vêm daqui, dos mesmos
             números da ficha e dos emails (src/lib/prazos.mjs). -->
        <p class="basket__lead" data-basket-lead hidden
           data-lead-stock="${esc(prazos(shop.lead).stock)}"
           data-lead-order="${esc(prazos(shop.lead).encomenda)}"
           data-lead-few="${esc(t('paginas.cesto.stockInsuficiente'))}"
           data-lead-together="${esc(prazos(shop.lead).junto)}"
           data-lead-weeks="${esc(prazos(shop.lead).semanas)}"></p>
        <p class="small muted">${esc(t('paginas.iva'))}</p>
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
      <h2>${esc(t('paginas.entrega.titulo'))}</h2>
      <div class="checkout__grid">
        <label class="field field--wide"><span>${esc(t('paginas.entrega.nome'))}</span>
          <input type="text" name="nome" autocomplete="name" required maxlength="120"></label>
        <label class="field field--wide"><span>${esc(t('paginas.entrega.email'))}</span>
          <input type="email" name="email" autocomplete="email" required maxlength="160"></label>
        <label class="field field--wide"><span>${esc(t('paginas.entrega.morada'))}</span>
          <input type="text" name="linha1" autocomplete="address-line1" required maxlength="160"></label>
        <label class="field"><span>${esc(t('paginas.entrega.postal'))}</span>
          <input type="text" name="postal" autocomplete="postal-code" required maxlength="20"></label>
        <label class="field"><span>${esc(t('paginas.entrega.localidade'))}</span>
          <input type="text" name="cidade" autocomplete="address-level2" required maxlength="80"></label>
        <label class="field"><span>${esc(t('paginas.entrega.telefone'))} <span class="field__optional">${esc(t('paginas.entrega.opcional'))}</span></span>
          <input type="tel" name="telefone" autocomplete="tel" maxlength="40"></label>
        <label class="field"><span>${esc(t('paginas.entrega.nif'))} <span class="field__optional">${esc(t('paginas.entrega.nifNota'))}</span></span>
          <input type="text" name="nif" inputmode="numeric" maxlength="20"></label>
      </div>
      <!-- A ESCOLHA DO MÉTODO PASSOU A SER AQUI.
           Era feita numa página da ifthenpay, depois de sair daqui. Agora o
           pagamento acontece numa página nossa, e por isso a pergunta é feita
           antes de o botão ser carregado -- o que também é o que a lei quer:
           o consumidor tem de saber o que vai acontecer ANTES de assumir a
           obrigação de pagar (artigo 4.º n.º 1 do DL 24/2014). -->
      <h2 style="margin-block-start:2rem">${esc(t('paginas.metodo.titulo'))}</h2>
      <div class="pay-choice" data-pay-methods>
        <label class="pay-choice__opt">
          <input type="radio" name="metodo" value="MBWAY" required>
          ${marca('mbway')}
          <span class="pay-choice__body">
            <span class="pay-choice__name">MB WAY</span>
            <span class="pay-choice__note">${esc(t('paginas.metodo.mbway.nota'))}</span>
          </span>
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
          <span>${esc(t('paginas.metodo.mbway.telemovel'))}</span>
          <!-- A linha que dizia «Portuguese mobile. We send it to ifthenpay…»
               saiu a pedido da dona. O que ela dizia não se perdeu: o formato
               está no atributo placeholder, um número que não sirva devolve uma
               frase que o explica (bad_mbway_number, em shop.js), e a ida do
               telefone para a ifthenpay continua escrita na página de
               privacidade, que é onde o RGPD a quer -- o artigo 13.º admite o
               aviso em camadas, e a camada existe.
               SEM CRASES AQUI DENTRO: isto vive dentro de um template literal,
               e uma crase fecha-o. Foi a quinta vez neste projecto. -->
          <input type="tel" name="mbway" inputmode="tel" autocomplete="tel"
                 placeholder="912 345 678" maxlength="20">
        </label>

        <label class="pay-choice__opt">
          <input type="radio" name="metodo" value="MB" required>
          ${marca('multibanco')}
          <span class="pay-choice__body">
            <span class="pay-choice__name">${esc(t('paginas.metodo.mb.nome'))}</span>
            <span class="pay-choice__note">${esc(t('paginas.metodo.mb.nota'))}</span>
          </span>
        </label>
        <!-- OS TRÊS ÚLTIMOS LEVAM O COMPRADOR DAQUI PARA FORA, e as notas
             dizem-no. O cartão vai para um formulário seguro onde escreve o
             número -- que é como tem de ser, porque esses dados nunca podem
             passar por nós. O Google Pay e o Apple Pay não têm outra porta: a
             ifthenpay só os serve pela página dela. -->
        <label class="pay-choice__opt">
          <input type="radio" name="metodo" value="CCARD" required>
          ${marca('cartao')}
          <span class="pay-choice__body">
            <span class="pay-choice__name">${esc(t('paginas.metodo.cartao.nome'))}</span>
            <span class="pay-choice__note">${esc(t('paginas.metodo.cartao.nota'))}</span>
          </span>
        </label>
        <label class="pay-choice__opt">
          <input type="radio" name="metodo" value="GOOGLE" required>
          ${marca('googlepay')}
          <span class="pay-choice__body">
            <span class="pay-choice__name">Google Pay</span>
            <span class="pay-choice__note">${esc(t('paginas.metodo.google.nota'))}</span>
          </span>
        </label>
        <label class="pay-choice__opt">
          <input type="radio" name="metodo" value="APPLE" required>
          ${marca('applepay')}
          <span class="pay-choice__body">
            <span class="pay-choice__name">Apple Pay</span>
            <span class="pay-choice__note">${esc(t('paginas.metodo.apple.nota'))}</span>
          </span>
        </label>
      </div>


      <!-- O RÓTULO DO BOTÃO É UMA EXIGÊNCIA LEGAL, não uma escolha de estilo.
           O artigo 5.º n.º 4 do DL 24/2014 obriga a que o botão diga, sem
           ambiguidade, que a encomenda implica pagar. «Checkout» ou «Continuar»
           não cumprem: a sanção é o contrato não vincular o consumidor. -->
      <!-- AS PEÇAS PERSONALIZADAS NÃO TÊM OS CATORZE DIAS, e isso tem de ser
           dito ANTES de encomendar (DL 24/2014, art. 4.º n.º 1 al. p)). Aparece
           só quando o cesto leva uma linha com um nome, uma data ou uma frase:
           o script decide, pela mesma marca «personalises» que o Worker usa. -->
      <p class="basket__aviso" data-basket-personal hidden>${esc(t('paginas.aviso.personalizada', { n: shop.returns.coolingOffDays }))}</p>
      <button class="btn btn--wide" type="submit" data-to-checkout style="margin-block-start:1.25rem">
        ${esc(t('paginas.botao.encomendarEPagar'))}</button>
      <p class="small muted" style="margin-block-start:.6rem">
        ${esc(t('paginas.cesto.ifthenpay'))}</p>
      <p class="small basket__direitos"><a href="/legal/guarantee/">${esc(t('paginas.garantia.ligacao'))}</a></p>
    </form>
  </div>
</section>`;
}

/* Os países que a loja sabe nomear. O nome é da língua da página
   (paginas.json, «pais.<código>»); um código que não esteja aqui aparece como
   está, como antes. É uma lista de CÓDIGOS e não de nomes porque é avaliada
   ao importar, antes de o gerador escolher a língua. */
const PAISES = [
  'PT', 'PT-20', 'PT-30',
  'ES', 'FR', 'GB', 'DE', 'CH',
  'AT', 'BE', 'NL', 'LU', 'IT',
  'IE', 'DK', 'SE', 'FI', 'PL',
  'CZ', 'SK', 'HU', 'SI', 'HR',
  'RO', 'BG', 'GR', 'EE', 'LV',
  'LT', 'MT', 'CY', 'NO',
];
const nomeDoPais = (c) => (PAISES.includes(c) ? t(`paginas.pais.${c}`) : c);

export function notFound() {
  return `
<section class="section">
  <div class="shell shell--narrow" style="text-align:center">
    <h1>${esc(t('paginas.naoEncontrada.titulo'))}</h1>
    <p class="lede" style="margin-block-start:1rem">
      ${esc(t('paginas.naoEncontrada.texto'))}
    </p>
    <p style="margin-block-start:2rem">
      <a class="btn" href="/lamps/">${esc(t('paginas.botao.verCandeeiros'))}</a>
      <a class="btn btn--ghost" href="/cathelier/" style="margin-inline-start:.5rem">${esc(t('paginas.botao.verPecas'))}</a>
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
/* «A sua encomenda é a X»: a referência é um elemento que o script preenche,
   e entra na frase por variável, para a marcação não ir para o dicionário. */
const aReferencia = (atributo) => t('paginas.encomenda.referencia', { ref: `<strong ${atributo}>—</strong>` });

export function thankYou(shop = {}) {
  return `
<section class="section">
  <div class="shell shell--narrow page-prose" style="text-align:center">
    <h1>${esc(t('paginas.obrigado.titulo'))}</h1>
    <p class="lede" data-order-state>${esc(t('paginas.obrigado.aVerificar'))}</p>

    <div data-order-ok hidden>
      <p>${aReferencia('data-order-ref')}</p>
      <p>${esc(t('paginas.encomenda.confirmacao'))}</p>
      <p style="margin-block-start:2rem">
        <a class="btn" href="/lamps/">${esc(t('paginas.botao.voltarCandeeiros'))}</a>
      </p>
    </div>

    <!-- O TERCEIRO ESTADO É O NORMAL, e não existia.
         Com uma referência Multibanco o comprador volta para aqui sem ter
         pagado -- vai pagar hoje à noite, ou amanhã. A página tinha só «pago»
         e «espere um minuto e recarregue», e a segunda dizia a quase toda a
         gente que algo tinha corrido mal quando não tinha corrido mal nada. -->
    <div data-order-waiting hidden>
      <p>${aReferencia('data-order-ref-waiting')}</p>
      <p>${esc(t('paginas.obrigado.porPagar', { dias: tn('paginas.dias', shop.payment?.referenceDays ?? 2) }))}</p>
      <p>${esc(t('paginas.obrigado.quandoChegar'))}</p>
      <p style="margin-block-start:2rem">
        <a class="btn btn--ghost" href="/lamps/">${esc(t('paginas.botao.voltarCandeeiros'))}</a>
      </p>
    </div>

    <div data-order-pending hidden>
      <p>${esc(t('paginas.encomenda.naoEncontrada'))}</p>
      <p>${esc(t('paginas.encomenda.escreva'))}</p>
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
    <h1>${esc(t('paginas.pagar.titulo'))}</h1>
    <p class="lede" data-pay-state>${esc(t('paginas.pagar.aPreparar'))}</p>

    <!-- MB WAY: o comprador tem quatro minutos para aceitar na app. -->
    <div data-pay-mbway hidden>
      <h2>${esc(t('paginas.pagar.mbway.titulo'))}</h2>
      <p>${esc(t('paginas.pagar.mbway.texto'))}</p>
      <p class="pay-amount"><span data-pay-amount>—</span></p>
      <p class="pay-clock" role="status">
        ${t('paginas.pagar.mbway.tempo', { tempo: '<strong data-pay-countdown>4:00</strong>' })}</p>
      <p class="small muted">${esc(t('paginas.pagar.mbway.aviso'))}</p>
    </div>

    <!-- Multibanco: a referência é o produto. Grande, copiável, e com o valor
         exacto ao lado, porque pagar um cêntimo a menos não confirma nada. -->
    <div data-pay-mb hidden>
      <h2>${esc(t('paginas.pagar.mb.titulo'))}</h2>
      <p>${t('paginas.pagar.mb.como')}</p>
      <dl class="pay-ref">
        <div class="pay-ref__row">
          <dt>${esc(t('paginas.pagar.mb.entidade'))}</dt>
          <dd><span data-pay-entity>—</span>
            <button type="button" class="pay-copy" data-copy="entity">${esc(t('paginas.botao.copiar'))}</button></dd>
        </div>
        <div class="pay-ref__row">
          <dt>${esc(t('paginas.pagar.mb.referencia'))}</dt>
          <dd><span data-pay-reference>—</span>
            <button type="button" class="pay-copy" data-copy="reference">${esc(t('paginas.botao.copiar'))}</button></dd>
        </div>
        <div class="pay-ref__row">
          <dt>${esc(t('paginas.pagar.mb.valor'))}</dt>
          <dd><span data-pay-amount-mb>—</span>
            <button type="button" class="pay-copy" data-copy="amount">${esc(t('paginas.botao.copiar'))}</button></dd>
        </div>
      </dl>
      <p>${t('paginas.pagar.mb.validade', { dias: tn('paginas.dias', dias), data: '<strong data-pay-expiry-date>—</strong>' })}</p>
      <p class="small muted">${esc(t('paginas.pagar.mb.depois'))}</p>
    </div>

    <!-- Pago. Não se manda ninguém para outro lado: o comprador acabou de
         fazer uma coisa e quer ver que resultou, não um redireccionamento. -->
    <div data-pay-done hidden>
      <h2>${esc(t('paginas.pagar.pago'))}</h2>
      <p>${aReferencia('data-pay-ref')}</p>
      <p>${esc(t('paginas.encomenda.confirmacao'))}</p>
      <p style="margin-block-start:2rem"><a class="btn" href="/lamps/">${esc(t('paginas.botao.voltarCandeeiros'))}</a></p>
    </div>

    <!-- Recusado ou expirado no MB WAY. Não é uma avaria e o texto não trata
         disto como se fosse: é alguém que carregou em «não» ou deixou passar. -->
    <div data-pay-failed hidden>
      <h2 data-pay-failed-title>${esc(t('paginas.pagar.expirou.titulo'))}</h2>
      <p data-pay-failed-text>${esc(t('paginas.pagar.expirou.texto'))}</p>
      <p style="margin-block-start:2rem">
        <a class="btn" href="/cart/">${esc(t('paginas.botao.voltarCesto'))}</a></p>
    </div>

    <div data-pay-unknown hidden>
      <p>${esc(t('paginas.encomenda.naoEncontrada'))}</p>
      <p>${esc(t('paginas.encomenda.escreva'))}</p>
    </div>

    <p class="small muted" style="margin-block-start:2.5rem">
      ${t('paginas.pagar.ifthenpay', { ifthenpay: '<a href="https://ifthenpay.com/" rel="noopener">ifthenpay</a>' })}</p>
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
    <h1>${esc(t('paginas.cancelada.titulo'))}</h1>
    <p class="lede">${esc(t('paginas.cancelada.entrada'))}</p>
    <p>${esc(t('paginas.cancelada.texto'))}</p>
    <p style="margin-block-start:2rem">
      <a class="btn" href="/cart/">${esc(t('paginas.botao.voltarCesto'))}</a>
      <a class="btn btn--ghost" href="/lamps/" style="margin-inline-start:.5rem">${esc(t('paginas.botao.continuarAVer'))}</a>
    </p>
  </div>
</section>`;
}

/* The reseller sign-in. It carries no data at all: the price list is fetched
   from the Worker with a signed session, and a visitor who is not a reseller
   sees a form and nothing else. Not in the sitemap and not indexed -- it is a
   door for a handful of businesses, not a page for search engines. */
export function resellers() {
  return `
<section class="section">
  <div class="shell shell--narrow page-prose resellers" data-resellers>
    <h1>${esc(t('paginas.revenda.titulo'))}</h1>

    <div data-rv-fora>
      <p class="lede">${esc(t('paginas.revenda.entrada'))}</p>

      <form class="rv-form" data-rv-pedir novalidate>
        <label class="field"><span>${esc(t('paginas.revenda.nif'))}</span>
          <input type="text" name="nif" inputmode="numeric" autocomplete="off" maxlength="11" required></label>
        <button class="btn" type="submit">${esc(t('paginas.revenda.pedirLigacao'))}</button>
      </form>
      <p class="rv-msg" data-rv-pedir-msg role="status" hidden></p>

      <h2>${esc(t('paginas.revenda.outroDispositivo'))}</h2>
      <form class="rv-form" data-rv-codigo novalidate>
        <label class="field"><span>${esc(t('paginas.revenda.nif'))}</span>
          <input type="text" name="nif" inputmode="numeric" autocomplete="off" maxlength="11" required></label>
        <label class="field"><span>${esc(t('paginas.revenda.codigo'))}</span>
          <input type="text" name="codigo" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="12" required></label>
        <label class="check"><input type="checkbox" name="manter"><span>${esc(t('paginas.revenda.manter'))}</span></label>
        <button class="btn" type="submit">${esc(t('paginas.revenda.entrar'))}</button>
      </form>
      <p class="rv-msg" data-rv-codigo-msg role="status" hidden></p>

      <p class="small muted">${t('paginas.revenda.aindaNao')}</p>
    </div>

    <div data-rv-dentro hidden>
      <p class="lede">${t('paginas.revenda.ativos', { firma: '<strong data-rv-firma></strong>', nif: '<span data-rv-nif></span>' })}</p>
      <label class="check"><input type="checkbox" data-rv-manter><span>${esc(t('paginas.revenda.manter'))}</span></label>
      <p><button class="btn btn--ghost" type="button" data-rv-sair>${esc(t('paginas.revenda.sair'))}</button></p>

      <h2>${esc(t('paginas.revenda.tabela'))}</h2>
      <p class="small muted">${esc(t('paginas.revenda.precos'))}
        ${esc(t('paginas.iva'))}
        <a href="/legal/terms/#resellers">${esc(t('paginas.revenda.condicoes'))}</a>.</p>
      <div class="rv-table-wrap">
        <table class="rv-table" data-rv-tabela>
          <thead><tr><th scope="col">${esc(t('paginas.revenda.peca'))}</th><th scope="col">${esc(t('paginas.revenda.pvp'))}</th><th scope="col">${esc(t('paginas.revenda.seuPreco'))}</th><th scope="col">${esc(t('paginas.revenda.emStock'))}</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>
</section>
`;
}
