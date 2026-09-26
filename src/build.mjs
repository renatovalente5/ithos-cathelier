#!/usr/bin/env node
/**
 * Builds the shop into public/.
 *
 * Zero dependencies, on purpose: this has to still build in three years, on a
 * laptop nobody has maintained, with no lockfile to rot.
 *
 *     node src/build.mjs                 build with the live address
 *     BASE_URL=http://localhost:4320 …   build for the local preview
 *     PREVIEW=yes node src/build.mjs     noindex, and no way to pay
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { page, MIRRORED } from './lib/shell.mjs';
import * as ithos from './lib/ithos.mjs';
import * as cath from './lib/cathelier.mjs';
import * as pages from './lib/pages.mjs';
import { esc } from './lib/html.mjs';
import { cardWidths } from './lib/photo.mjs';
import { REDIRECTS } from './lib/redirects.mjs';
import { stockDe, prateleiras } from './lib/prazos.mjs';
import { t, lingua, LOCALE, LINGUAS, ORIGEM, definirLingua, linguaDaRaiz, prefixoDe, morada } from './lib/i18n.mjs';
import { aplicar, lerPaginaTraduzida, validar, RESUMO_TAMANHO } from './lib/traduziveis.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'public');
const CONTENT = join(ROOT, 'content');

/* The address is read from CNAME and never guessed. Three places used to name
   the domain — the CNAME, a config and the Worker's allowed origins — and
   nothing compared them. */
const cname = existsSync(join(ROOT, 'CNAME')) ? readFileSync(join(ROOT, 'CNAME'), 'utf8').trim() : '';
/* With a prefix set, the site is NOT on its own domain, so the canonical URLs
   must not claim the domain either — a canonical pointing at a host that does
   not serve the page is worse than no canonical. */
const BASE_PATH_SET = !!process.env.BASE_PATH;
/* AND THE PREFIX, which was missing. The reasoning above was right and the
   arithmetic was not: with BASE_PATH set the site is served at
   github.io/ithos-cathelier/, and the canonical claimed github.io/contact/ --
   an address that serves nothing. It has been inert only because every build
   so far is a preview and noindex; it would have been wrong on all 94 pages
   the day the preview flag came off. The same constant feeds og:url and the
   sitemap, so all three were pointing at 404s. */
const SITE = process.env.BASE_URL
  || (BASE_PATH_SET ? `https://renatovalente5.github.io${(process.env.BASE_PATH || '').replace(/\/$/, '')}`
  : cname ? `https://${cname}` : 'http://localhost:4320');
const PREVIEW = process.env.PREVIEW === 'yes';

/* The address prefix, and it is not optional.
 *
 * On the real domain every path starts at the root and BASE is empty. Served
 * from a project page - renatovalente5.github.io/ithos-cathelier/ - every
 * absolute path has to carry that folder, or the stylesheet, the fonts and all
 * 836 photographs 404 at once and the shop renders as plain text.
 *
 * Rather than thread a helper through five page builders and hope nobody
 * forgets one, the prefix is applied HERE, to every page as it is written, and
 * scripts/check-output.mjs refuses to pass a page that still has a bare
 * absolute path in it. A rule that is only remembered is a rule that breaks. */
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');

function prefix(html) {
  if (!BASE) return html;
  return html
    /* data-film is in this list for the same reason src is: it holds an
       address, and an address that misses the prefix is a 404 the moment the
       site is served from a subfolder. Putting it here means shop.js can
       assign the attribute verbatim and never do prefix arithmetic of its
       own -- which is the whole point of there being one place. */
    .replace(/(\s(?:href|src|content|action|data-film(?:-tall)?)=")\/(?!\/)/g, `$1${BASE}/`)
    /* E O `url=` DE UM META REFRESH, QUE A REGRA DE CIMA NÃO APANHA.
       A regra de cima exige que a barra seja o PRIMEIRO carácter a seguir às
       aspas. Num reencaminhamento o valor começa pelo atraso —
       `content="0; url=/cathelier/pieces/#christmas"` — por isso passava
       intacto e ia para o ar sem o /ithos-cathelier: o favorito de alguém
       aterrava na raiz do github.io, que é o site de outra pessoa. Não havia
       nada a apanhá-lo, porque o verificador também só olhava para atributos
       cujo valor começa por barra. Isto foi medido, não suposto. */
    .replace(/(\scontent="\d+;\s*url=)\/(?!\/)/g, `$1${BASE}/`)
    .replace(/(\ssrcset=")([^"]+)"/g, (m, head, list) =>
      head + list.replace(/(^|,\s*)\/(?!\/)/g, `$1${BASE}/`) + '"');
}

/* The stylesheet needs it too, and forgetting that cost every typeface on the
 * live site.
 *
 * The HTML rewrite above only ever looked at attributes. A CSS file has its own
 * addresses — `url('/assets/fonts/...')` in eight @font-face rules — and those
 * went out unprefixed, resolved to the root of github.io, and 404ed. Every page
 * that has been published so far rendered in the system fallback: not
 * Montserrat, not Cormorant, not Klee One, not Grandstander.
 *
 * The battery could not see it. It drives localhost, where BASE is empty and
 * the fonts load, and its "typeface loaded" check passed every time. A build
 * verified against a different address than the one it ships to is not
 * verified. */
function prefixCss(css) {
  if (!BASE) return css;
  return css.replace(/url\((['"]?)\/(?!\/)/g, `url($1${BASE}/`);
}

/* O CONTEÚDO NA LÍNGUA DO PASSO. O de origem (português) está em content/;
   numa outra língua, cada campo traduzido de content/i18n/<língua>/ vai por
   cima (ver src/lib/traduziveis.mjs). Um campo sem tradução fica em
   português; uma tradução desactualizada continua a valer até o Worker a
   refazer. As contagens ficam para o fim, para se saber o que falta. */
const resumir = (texto) => createHash('sha256').update(texto).digest('hex').slice(0, RESUMO_TAMANHO);
const faltasDeTraducao = {};
function lerNaLingua(p) {
  const origem = JSON.parse(readFileSync(join(CONTENT, p), 'utf8'));
  if (lingua() === ORIGEM) return origem;
  const ficheiro = join(CONTENT, 'i18n', lingua(), p);
  const traducao = existsSync(ficheiro) ? JSON.parse(readFileSync(ficheiro, 'utf8')) : null;
  const r = aplicar(`content/${p}`, origem, traducao, resumir);
  const c = (faltasDeTraducao[lingua()] ??= { desactualizados: 0, emFalta: 0, invalidos: [] });
  c.desactualizados += r.desactualizados; c.emFalta += r.emFalta;
  c.invalidos.push(...r.invalidos.map((x) => `${p}: ${x}`));
  return r.obj;
}
const read = (p) => lerNaLingua(p);
let identity; let shipping; let shop; let covers;

/* Which cover renditions actually exist, counted off disk rather than assumed.
   The cathelier master is an enlarged Instagram still and stops short of the
   widest size; promising a file that was never written is how 548 broken image
   references got shipped once already. */
const COVER_WIDTHS = [640, 720, 960, 1280, 1600, 2000, 2600];
const haveWidths = (stem) =>
  COVER_WIDTHS.filter((w) => existsSync(join(ROOT, 'public/media/covers', `${stem}-${w}.webp`)));

/* WHAT GOES UNDER THE FILM.
   With a film on the cover, the still under it is the film's OWN first frame,
   in both of the film's shapes -- scripts/film.sh writes the two masters and
   renditions.py the web sizes. The photographic master stays on disk and stays
   unused: deleting "film" from covers.json puts it straight back, with nothing
   else to undo. That is why the name is chosen here and not baked in. */
const coverArt = (brand) => {
  const c = covers[brand];
  const stem = c && c.film ? `${c.film}-still` : brand;
  const widths = haveWidths(stem);
  if (!widths.length) {
    throw new Error(`No cover renditions for ${stem}. Run `
      + (c && c.film ? `scripts/film.sh ${c.film}` : 'scripts/covers.py')
      + ' then scripts/renditions.py.');
  }
  return { name: stem, widths, wideName: `${stem}-wide`, wideWidths: haveWidths(`${stem}-wide`) };
};

/* --- content -------------------------------------------------------------- */

function loadProducts(brand) {
  const dir = join(CONTENT, brand);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const p = lerNaLingua(`${brand}/${f}`);
    p.slug = f.replace(/\.json$/, '');
    return p;
  }).filter((p) => p.published).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

let lamps; let pieces; let occasions; let counts; let shellArgs; let MARKERS;

/* Lê tudo na língua dada. O gerador chama isto no início de cada passo. */
function prepararLingua(l) {
  definirLingua(l);
  identity = read('settings/identity.json');
  shipping = read('settings/shipping.json');
  shop = read('settings/shop.json');
  covers = read('settings/covers.json');
  lamps = loadProducts('ithos');
  pieces = loadProducts('cathelier').filter((p) => p.slug !== '_occasions');
  occasions = existsSync(join(CONTENT, 'cathelier/_occasions.json'))
    ? read('cathelier/_occasions.json').filter((o) => o.published).sort((a, b) => a.order - b.order)
    : [];
  counts = { lamps: lamps.length, pieces: pieces.length, occasions: occasions.length };
  shellArgs = { site: SITE, identity, counts, preview: PREVIEW, shipping, shop, asset: ASSET };
  MARKERS = pages.markers({ identity, shop, shipping });
}

/* --- writing -------------------------------------------------------------- */

const written = [];
/* NUMA LÍNGUA QUE NÃO É A DA RAIZ, as ligações internas levam o prefixo dela.
   Só as das páginas: /assets/, /media/ e /data/ são os mesmos ficheiros para
   todas as línguas. O seletor de língua escreve moradas absolutas, e é por
   isso que escapa a esta regra. */
function comPrefixoDeLingua(html, pre) {
  return html
    .replace(/(\shref=")\/(?!\/|assets\/|media\/|data\/)/g, `$1${pre}/`)
    .replace(/(\scontent="\d+;\s*url=)\/(?!\/)/g, `$1${pre}/`);
}

function write(pathNaOrigem, html, { sitemap = true, stub = false } = {}) {
  const path = morada(pathNaOrigem);
  const pre = prefixoDe();
  if (pre) html = comPrefixoDeLingua(html, pre);
  /* DUAS ESCRITAS NA MESMA MORADA ERAM UM SUBSTITUIR SILENCIOSO.
     Sem isto, escrever um reencaminhamento em `/cathelier/pieces/` por engano
     apagava a página verdadeira e punha lá um sinal de trânsito -- e nada
     dava por ela: o ficheiro existe, todas as ligações para ele continuam a
     resolver, o canonical continua a ser dele, e a única diferença visível é
     o título. É exactamente o disfarce contra o qual os stubs são escritos,
     por isso quem os escreve é o primeiro a ter de o impedir. */
  const ja = written.find((w) => w.path === path);
  if (ja) {
    throw new Error(`two pages claim ${path}: the second would overwrite the first `
      + `(${ja.stub ? 'a redirect stub' : 'a page'} is already there)`);
  }
  const file = path === '/' ? 'index.html'
    : path.endsWith('/') ? join(path.slice(1), 'index.html')
    : path.slice(1);
  const dest = join(OUT, file);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, prefix(html));
  written.push({ path, sitemap, stub, lingua: lingua() });
}

/* --- reencaminhamentos -----------------------------------------------------
   Um stub NÃO é uma página e não passa pelo page(): não leva cabeçalho, nem
   gaveta, nem rodapé. Se levasse, cada um trazia a navegação partilhada
   inteira e as contagens de ligações internas do verificador subiam às
   centenas por causa de dez ficheiros que ninguém lê.

   O ENDEREÇO APARECE UMA VEZ SÓ ONDE A MÃO O ESCREVE.
   Há três mecanismos e os três têm de concordar; a maneira de garantir que
   concordam não é verificá-los, é não haver três. O `href` do link visível é
   o único que este ficheiro escreve por extenso e é o único que o prefix()
   sabia tratar desde sempre; o JavaScript lê-o do DOM em vez de repetir a
   morada num literal (um literal dentro de <script> nunca leva prefixo). Fica
   uma segunda cópia inevitável, a do meta refresh, que a regra nova do
   prefix() passou a cobrir e que o verificador compara com a primeira.

   `location.replace` e não `location.href`: o stub não fica no histórico, por
   isso quem carrega em Voltar sai da página em vez de ser atirado outra vez
   para a frente. O atraso é 0 pela mesma razão, e não por pressa: um refresh
   com atraso zero é uma substituição e não uma entrada nova. */
function redirectStub({ to, name }) {
  /* O nome vai sempre entre aspas e nunca é sujeito de uma frase. "Awards and
     gifts is now" e "A new baby is now" concordam mal, e um `toLowerCase()`
     dava "See the a new baby pieces". Entre aspas é um rótulo, e um rótulo
     serve os dez nomes sem excepção.
     Não há comentários nesta saída: um stub é lido por quem estiver de
     passagem durante uns milissegundos, e o que aqui vai é servido. */
  return `<!doctype html>
<html lang="${LOCALE[lingua()]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="redirect-stub">
<meta http-equiv="refresh" content="0; url=${esc(to)}">
<link rel="canonical" href="${SITE}${morada(to.split('#')[0])}">${PREVIEW ? `
<meta name="robots" content="noindex, nofollow">` : ''}
<title>${esc(t('build.stub.titulo', { nome: name }))}</title>
</head>
<body>
<p>${esc(t('build.stub.texto', { nome: name }))}
<a id="go" href="${esc(to)}">${esc(t('build.stub.ir', { nome: name }))}</a>.</p>
<script>var a=document.getElementById('go');if(a)location.replace(a.href)</script>
</body>
</html>
`;
}

/* --- assets ---------------------------------------------------------------
   The stylesheet is one file, concatenated in a fixed order: the skeleton
   first, then each brand's world, then the shop furniture. One request, and
   the cascade order is a property of this list rather than of whatever order
   the browser happened to finish downloading in. */
/* The stylesheet and the script carry a digest of their own contents in their
 * filename, the same protocol the catalogue already uses.
 *
 * Without it, a browser that has visited once keeps the old file: the address
 * never changes, so nothing tells it to look again. That is how a fixed
 * stylesheet reached the CDN and the page in front of me still had the broken
 * one. A hashed name makes a deploy impossible to miss and lets these be
 * cached for a year instead of ten minutes. */
const digest = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);
const ASSET = { css: '', js: '', textos: {} };

function assets() {
  const css = ['styles/base.css', 'styles/brands/ithos.css', 'styles/brands/cathelier.css', 'styles/shop.css']
    .filter((f) => existsSync(join(HERE, f)))
    .map((f) => `/* ===== ${f} ===== */\n${readFileSync(join(HERE, f), 'utf8')}`)
    .join('\n\n');
  mkdirSync(join(OUT, 'assets'), { recursive: true });
  const cssOut = prefixCss(css);
  ASSET.css = `styles.${digest(cssOut)}.css`;
  writeFileSync(join(OUT, 'assets', ASSET.css), cssOut);

  cpSync(join(HERE, 'fonts'), join(OUT, 'assets', 'fonts'), { recursive: true });
  cpSync(join(ROOT, 'assets', 'brand'), join(OUT, 'assets'), { recursive: true });
  /* O aviso harmonizado da garantia legal, nos ficheiros oficiais da Comissão
     (SVG a cores e o PDF A4), para a página /legal/guarantee/. Não são
     obra-de-arte da loja e por isso não vivem em assets/brand. */
  cpSync(join(ROOT, 'assets', 'legal'), join(OUT, 'assets', 'legal'), { recursive: true });
  /* As notas que vivem ao lado da obra-de-arte não são conteúdo do site.
     Apagam-se DEPOIS de copiar, uma a uma e pelo nome, e não com um filtro no
     `cpSync`: um filtro que recusa uma pasta deita fora a subárvore toda em
     silêncio, o que já custou caro noutro projecto. */
  for (const nota of ['assets/pay/LEIA.md', 'assets/legal/LEIA.md']) {
    rmSync(join(OUT, nota), { force: true });
  }

  /* AS FRASES DO shop.js, UMA FICHEIRO POR LÍNGUA. O shop.js é um só para o
     site todo; o que ele escreve no ecrã vem de window.TEXTOS, que este
     ficheiro enche antes dele. Sai de src/i18n/<língua>/js.json, com a origem
     por baixo para o que ainda não estiver traduzido. */
  const jsOrigem = join(ROOT, 'src', 'i18n', ORIGEM, 'js.json');
  for (const l of LINGUAS) {
    const f = join(ROOT, 'src', 'i18n', l, 'js.json');
    if (!existsSync(f) && !existsSync(jsOrigem)) continue;
    const ler = (x) => (existsSync(x) ? JSON.parse(readFileSync(x, 'utf8')) : {});
    const junto = Object.fromEntries(Object.entries({ ...ler(jsOrigem), ...ler(f) })
      .filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, typeof v === 'object' && v ? v.t : v]));
    const corpo = `window.TEXTOS=${JSON.stringify(junto)};\n`;
    ASSET.textos[l] = `textos.${l}.${digest(corpo)}.js`;
    writeFileSync(join(OUT, 'assets', ASSET.textos[l]), corpo);
  }

  if (existsSync(join(HERE, 'js', 'shop.js'))) {
    const API = (process.env.API_URL || '').replace(/\/$/, '');
    const MAPA_ANTIGOS = JSON.stringify(Object.fromEntries(REDIRECTS
      .map((r) => [r.from.split('/').filter(Boolean).pop(), r.to.split('#')[1]])
      .filter(([de, para]) => de && para && de !== para)));
    const js = readFileSync(join(HERE, 'js', 'shop.js'), 'utf8')
      .replace("const BASE = '';", `const BASE = '${BASE}';`)
      .replace("const API = '';", `const API = '${API}';`)
      /* OS FRAGMENTOS ANTIGOS, tirados da MESMA tabela dos reencaminhamentos.
         Um /cathelier/pieces/#home partilhado no WhatsApp antes de 25 set 2026
         abria a lista inteira sem aviso, porque o filtro «home» deixou de
         existir. O mapa é derivado de REDIRECTS -- de cada `from` cujo slug
         não é o do `to` -- e não escrito à mão segunda vez: uma lista só. */
      .replace('const FRAGMENTOS_ANTIGOS = {};', `const FRAGMENTOS_ANTIGOS = ${MAPA_ANTIGOS};`);
    /* Um replace que não encontra a linha não dá erro nenhum: devolve o texto
       como estava, e os links antigos voltam a abrir a lista inteira sem
       ninguém saber. Como o BASE, falha alto. */
    if (MAPA_ANTIGOS !== '{}' && !js.includes(`const FRAGMENTOS_ANTIGOS = ${MAPA_ANTIGOS};`)) {
      throw new Error('shop.js has no FRAGMENTOS_ANTIGOS line to fill in — old #home and #fathers-day links would open the whole list');
    }
    ASSET.js = `shop.${digest(js)}.js`;
    if (BASE && !js.includes(`const BASE = '${BASE}'`)) {
      throw new Error('shop.js has no BASE line to fill in — every fetch in it would miss the prefix');
    }
    writeFileSync(join(OUT, 'assets', ASSET.js), js);
  }
  // The CNAME file is what tells GitHub to serve at the custom domain. While
  // the site is on a project path it must NOT be written, or Pages redirects
  // to a domain that does not resolve yet and the whole site disappears.
  if (cname && !BASE) writeFileSync(join(OUT, 'CNAME'), cname + '\n');
  /* O que a Cloudflare NÃO publica quando serve esta pasta (wrangler.jsonc):
     a bateria de browser, que se copia para aqui só para correr. */
  writeFileSync(join(OUT, '.assetsignore'), '_battery.js\n_drive.html\n.DS_Store\n');
}

/* --- the catalogue the Worker prices against -----------------------------
   Named by the hash of its own contents and therefore immutable, with a
   pointer file beside it. The browser is never trusted with a price: the
   basket carries ids and quantities, and the Worker reprices from this. */
/* O ARTIGO DE PROVA, que existe só aqui.
 *
 * Para confirmar que um pagamento verdadeiro percorre a cadeia toda é preciso
 * comprar alguma coisa -- e expor um produto de um euro à loja é convidar
 * alguém a comprá-lo. Este entra APENAS no catálogo que o Worker usa para
 * calcular preços; nenhum gerador de páginas lhe toca, por isso não há listagem
 * nem ficha nem mapa do site onde ele possa aparecer. Quem o quiser comprar tem
 * de saber o nome dele de cor.
 *
 * O prefixo `zz-` é a convenção: o Worker deixa passar uma encomenda feita SÓ
 * de artigos `zz-` mesmo com a loja fechada, e é isso que permite ensaiar um
 * pagamento sem abrir as portas a ninguém.
 *
 * Fica. Custa uma linha no JSON, não aparece em lado nenhum, e serve outra vez
 * no dia em que se mexer nos pagamentos. */
const ARTIGO_DE_PROVA = ['zz-prova', {
  brand: 'ithos',
  name: 'Internal payment test — not for sale',
  price: 1,
  made: 'in_stock',
  photo: '',
  options: [],
}];

function catalogueFile(nomesNasLinguas = {}) {
  const body = {
    ...(Object.keys(nomesNasLinguas).length ? { i18n: nomesNasLinguas } : {}),
    preview: PREVIEW || !shop.open,
    currency: 'EUR',
    lead: { inStockDays: shop.lead.inStockDays, toOrderWeeks: shop.lead.toOrderWeeks },
    /* AS PRATELEIRAS DO STOCK, com o nome que a dona reconhece. Os números não
       estão aqui -- este ficheiro é público, e a dona quer que só os
       revendedores os vejam. Vivem no Worker; aqui diz-se só QUE prateleiras
       existem, para o Worker recusar um nome mal escrito quando ela acerta. */
    stock: { skus: prateleiras(lamps) },
    shipping,
    /* QUEM VENDE VIAJA COM O CATÁLOGO, para os emails não o escreverem à mão.
     * O Worker escreve duas mensagens por encomenda -- a folha de trabalho e a
     * confirmação do artigo 6.º do DL 24/2014 -- e ambas têm de identificar o
     * vendedor, dizer o prazo de livre resolução e apontar para a entidade de
     * resolução de litígios. Se esses valores forem escritos no Worker, o dia
     * em que a morada fiscal ou o CNIACC mudarem no site deixa os emails a
     * mentir, sem um erro em lado nenhum -- foi exactamente o que aconteceu
     * com a morada antiga do CNIACC, publicada durante meses.
     * Vai daqui, de content/settings/, que é o único sítio onde se edita. */
    /* O prazo da referência viaja com o catálogo pela mesma razão que o
       vendedor: é o Worker que o manda para a ifthenpay ao gerar a referência,
       e é a página de agradecimento que o escreve ao comprador. Dois sítios a
       dizer o mesmo número, e um único ficheiro a decidi-lo. */
    payment: { referenceDays: shop.payment.referenceDays },
    seller: {
      legalName: identity.legalName,
      tradingName: identity.tradingName,
      taxNumber: identity.taxNumber,
      email: identity.email,
      phone: identity.phoneText || identity.phone,
      address: [identity.street, [identity.postcode, identity.town].filter(Boolean).join(' '), identity.country].filter(Boolean),
      complaintsBook: identity.complaintsBook,
      adr: identity.adr,
      coolingOffDays: shop.returns.coolingOffDays,
      warrantyYears: shop.returns.warrantyYears,
    },
    /* The options travel WHOLE, as an array, and not flattened to a price map.
     * The Worker has to do three things with them and only the full shape
     * allows all three: refuse a value the catalogue never offered, price the
     * one it did, and know which of them PERSONALISE — because an order
     * carrying an engraved name loses the right to cancel, and that is a legal
     * fact the shop has to be able to state on the invoice. */
    /* O artigo de prova vai em ÚLTIMO, e isso não é arrumação.
       Posto em primeiro, passou a ser «o primeiro produto do catálogo» -- e
       sete testes que compram o primeiro produto passaram a comprá-lo,
       atravessando o travão da loja fechada que é exactamente o que eles
       existem para verificar. Uma peça de andaime não pode mudar o que os
       testes vêem primeiro. */
    products: Object.fromEntries([...[...lamps, ...pieces].map((p) => [p.slug, {
      brand: lamps.includes(p) ? 'ithos' : 'cathelier',
      name: p.name,
      price: p.price,
      made: p.made || 'to_order',
      /* Só os candeeiros têm stock. As peças da cathelier são sempre feitas
         por encomenda, e não levam o campo. */
      ...(lamps.includes(p) ? { stock: stockDe(p) } : {}),
      photo: p.photoFolder && p.cover
        ? `${lamps.includes(p) ? 'ithos' : 'cathelier'}/${p.photoFolder}/${p.cover}` : '',
      options: (p.options || []).map((o) => (o.type === 'text'
        ? { id: o.id, name: o.name, type: 'text', required: !!o.required,
            personalises: !!o.personalises, max: o.max || 40, extra: o.extra || 0 }
        : { id: o.id, name: o.name, type: 'choice', required: !!o.required,
            personalises: !!o.personalises,
            /* `available` travels. Without it the shop could refuse a choice in
               the browser and accept it at the till: the Worker prices from
               THIS file and knows nothing the file does not say. A disabled
               radio is a courtesy to the reader, never a control. */
            values: o.values.map((v) => ({
              id: v.id, name: v.name, extra: v.extra || 0,
              ...(v.available === false ? { available: false } : {}),
            })) })),
    }]), ARTIGO_DE_PROVA]),
  };
  const json = JSON.stringify(body);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 12);
  mkdirSync(join(OUT, 'data'), { recursive: true });
  writeFileSync(join(OUT, 'data', `catalogue.${hash}.json`), json);
  writeFileSync(join(OUT, 'data', 'catalogue-current.txt'), hash + '\n');
  return { hash, count: Object.keys(body.products).length };
}


function buildIthos() {
  write('/', page({
    ...shellArgs, brand: 'ithos', path: '/',
    title: t('build.inicio.titulo'),
    description: t('build.inicio.descricao', { n: lamps.length }),
    cover: true,
    body: ithos.home({ products: lamps, identity, cover: covers.ithos, coverArt: coverArt('ithos') }),
    schema: [{
      '@context': 'https://schema.org', '@type': 'Organization',
      name: 'ithos', url: prefixoDe() ? `${SITE}${prefixoDe()}/` : SITE, email: identity.email, telephone: identity.phone,
    }],
  }));

  write('/lamps/', page({
    ...shellArgs, brand: 'ithos', path: '/lamps/',
    title: t('build.candeeiros.titulo', { n: lamps.length }),
    description: t('build.candeeiros.descricao', { n: lamps.length }),
    crumbs: [{ name: t('build.migalha.inicio'), href: '/' }, { name: t('build.migalha.candeeiros') }],
    body: ithos.catalogue({ products: lamps }),
  }));

  for (const p of lamps) {
    const { low } = ithos.fromPrice(p);
    /* A imagem para as redes e para o Google é a MAIOR versão da capa que
       existe -- não um -1000 fixo: a coruja (540 px) nunca o teve, e a página
       apontava para um ficheiro que dava 404. */
    const partilha = `/media/ithos/${p.photoFolder}/${p.cover}-${Math.max(...cardWidths(`ithos/${p.photoFolder}`, p.cover))}.webp`;
    write(`/lamps/${p.slug}/`, page({
      ...shellArgs, brand: 'ithos', path: `/lamps/${p.slug}/`,
      title: t('build.candeeiro.titulo', { nome: p.name }),
      description: p.summary,
      image: partilha,
      crumbs: [{ name: t('build.migalha.inicio'), href: '/' }, { name: t('build.migalha.candeeiros'), href: '/lamps/' }, { name: p.name }],
      body: ithos.product({ p, all: lamps, shop, identity }),
      schema: [{
        '@context': 'https://schema.org', '@type': 'Product',
        name: t('build.candeeiro.nomeProduto', { nome: p.name }), description: p.summary,
        image: `${SITE}${partilha}`,
        brand: { '@type': 'Brand', name: 'ithos' },
        offers: {
          '@type': 'Offer', price: low.toFixed(2), priceCurrency: 'EUR',
          availability: 'https://schema.org/MadeToOrder', url: `${SITE}${morada(`/lamps/${p.slug}/`)}`,
        },
      }],
    }));
  }
}

function buildCathelier() {
  write('/cathelier/', page({
    ...shellArgs, brand: 'cathelier', path: '/cathelier/',
    title: t('build.cathelier.titulo'),
    description: t('build.cathelier.descricao', { n: pieces.length, m: occasions.length }),
    cover: true,
    body: cath.home({ occasions, pieces, cover: covers.cathelier, coverArt: coverArt('cathelier') }),
  }));

  /* E NO LUGAR DELAS, DEZ SINAIS DE TRÂNSITO.
     As moradas estiveram no ar, e quem as tenha guardado merece chegar ao
     sítio para onde o conteúdo foi em vez de bater num 404 -- que neste site
     é ainda pior do que parece, porque o GitHub Pages serve UM 404 só, o da
     raiz, e esse veste ithos: um leitor da cathelier aterrava com a tipografia
     e as cores da outra marca a oferecer-lhe candeeiros.
     A lista está em src/lib/redirects.mjs e é história, não conteúdo. */
  /* Só na raiz: são moradas que existiram, e existiram antes de haver línguas. */
  for (const r of lingua() === linguaDaRaiz() ? REDIRECTS : []) {
    const o = occasions.find((x) => x.slug === r.to.split('#')[1]);
    write(r.from, redirectStub({ ...r, name: o ? o.name : r.to.split('#')[1] }),
      { sitemap: false, stub: true });
  }

  /* AS DEZ PAGINAS DE OCASIAO DEIXARAM DE SE ESCREVER.
     Cada uma listava `pieces` filtradas por `o.slug` -- exactamente o mesmo
     predicado que o filtro de /cathelier/pieces/ aplica no browser, com as
     mesmas contagens. Eram uma segunda morada para a mesma lista: duplicavam
     o conteudo aos olhos de quem indexa e obrigavam quem visita a escolher
     entre duas formas de fazer a mesma coisa. Os circulos da home levam agora
     a /cathelier/pieces/#<slug>, e o sitemap, os canonicals e as migalhas
     seguem sozinhos porque saem todos de `written`. */

  write('/cathelier/pieces/', page({
    ...shellArgs, brand: 'cathelier', path: '/cathelier/pieces/',
    title: t('build.pecas.titulo', { n: pieces.length }),
    description: t('build.pecas.descricao', { n: pieces.length }),
    crumbs: [{ name: 'cathelier', href: '/cathelier/' }, { name: t('build.migalha.todasPecas') }],
    body: cath.all({ pieces, occasions }),
  }));

  for (const p of pieces) {
    write(`/cathelier/pieces/${p.slug}/`, page({
      ...shellArgs, brand: 'cathelier', path: `/cathelier/pieces/${p.slug}/`,
      title: t('build.peca.titulo', { nome: p.name }),
      description: p.summary,
      crumbs: [{ name: 'cathelier', href: '/cathelier/' },
               { name: t('build.migalha.todasPecas'), href: '/cathelier/pieces/' }, { name: p.name }],
      body: cath.piece({ p, all: pieces, shop, occasions, identity }),
      image: p.photoFolder && p.cover ? `/media/cathelier/${p.photoFolder}/${p.cover}-400.webp` : undefined,
      /* The 41 cathelier pieces emitted no structured data at all while the 26
         lamps did. Same shop, same basket, same law — and to a search engine
         only half of it was a shop. `MadeToOrder` is the honest availability:
         nothing here exists until somebody asks for it. */
      schema: [{
        '@context': 'https://schema.org', '@type': 'Product',
        name: p.name, description: p.summary,
        ...(p.photoFolder && p.cover
          ? { image: `${SITE}/media/cathelier/${p.photoFolder}/${p.cover}-400.webp` } : {}),
        brand: { '@type': 'Brand', name: 'cathelier' },
        offers: {
          '@type': 'Offer', price: Number(p.price).toFixed(2), priceCurrency: 'EUR',
          availability: 'https://schema.org/MadeToOrder',
          url: `${SITE}${morada(`/cathelier/pieces/${p.slug}/`)}`,
        },
      }],
    }));
  }
}

/* --- the pages both shops share ------------------------------------------ */

const readPage = (f) => {
  const origem = readFileSync(join(CONTENT, 'pages', f), 'utf8');
  if (lingua() === ORIGEM) return origem;
  const tr = join(CONTENT, 'i18n', lingua(), 'pages', f);
  const lida = existsSync(tr) ? lerPaginaTraduzida(readFileSync(tr, 'utf8')) : null;
  const c = (faltasDeTraducao[lingua()] ??= { desactualizados: 0, emFalta: 0, invalidos: [] });
  if (!lida) { c.emFalta++; return origem; }
  /* Como nos campos: uma página traduzida com outras ligações ou outros
     títulos que a original não entra, e fica a original. */
  const porque = validar(origem, lida.texto, { pagina: true });
  if (porque) { c.emFalta++; c.invalidos.push(`pages/${f}: ${porque}`); return origem; }
  if (lida.h !== resumir(origem)) c.desactualizados++;
  return lida.texto;
};

function prose(path, file, { brand = 'ithos', title, description, crumbs, both = false, bloco = '' }) {
  const html = pages.comBloco(pages.markdown(pages.fill(readPage(file), MARKERS)), bloco);
  const body = pages.prosePage(html);
  if (both) { mirror(path, { title, description, crumbs, body }); return; }
  write(path, page({
    ...shellArgs, brand, path, title, description, crumbs,
    noindex: false, body,
  }));
}

/* Writes a shared page TWICE: at its own address wearing ithos, and under
   /cathelier/ wearing cathelier. Same body, same title, same description --
   the copy differs only in the navbar, the menu and the footer, which is what
   was asked for. The copy's canonical points home, it carries no structured
   data and it is not in the sitemap, so the two are never in competition. */
/** Rewrite every link to a shared page so it stays inside cathelier. Exact
 *  paths only, with an optional fragment -- never a prefix match, or
 *  /legal/terms-of-hire/ would be caught by /legal/terms/. */
function dressBody(html) {
  let out = String(html);
  for (const m of MIRRORED) {
    out = out.replace(new RegExp(`href="${m}(#[^"]*)?"`, 'g'), (_, hash) => `href="/cathelier${m}${hash || ''}"`);
  }
  return out;
}

function mirror(path, { title, description, crumbs, body, schema = [], noindex = false }) {
  const common = { ...shellArgs, path, title, description, body, noindex };
  write(path, page({ ...common, brand: 'ithos', crumbs, schema }),
    { sitemap: !noindex });
  write(`/cathelier${path}`, page({
    ...common, brand: 'cathelier', path: `/cathelier${path}`, canonicalPath: path,
    /* And the links INSIDE the words, not just the ones in the frame. The
       cancellation page points at the cancellation form, the delivery page
       points back at the cancellation page, and the FAQ answers point at three
       more -- every one of them a trapdoor out of cathelier and into the ithos
       wordmark, in the middle of a sentence. The body is rendered once and
       dressed here, before the address prefix is applied, because that is the
       one place that knows which shop this copy belongs to. */
    body: dressBody(body),
    /* The trail starts in the shop the reader is standing in. */
    crumbs: crumbs && [{ name: 'cathelier', href: '/cathelier/' }, ...crumbs.slice(1)],
  }), { sitemap: false });
}

function buildShared() {
  prose('/about/', 'about.md', { title: t('build.oficina.titulo'), crumbs: [{ name: t('build.migalha.inicio'), href: '/' }, { name: t('build.migalha.oficina') }],
    description: t('build.oficina.descricao') });

  prose('/cathelier/about/', 'cathelier/about.md', { brand: 'cathelier',
    title: t('build.oficinaCath.titulo'), crumbs: [{ name: 'cathelier', href: '/cathelier/' }, { name: t('build.migalha.oficina') }],
    description: t('build.oficinaCath.descricao') });

  prose('/care-and-safety/', 'care-and-safety.md', { title: t('build.cuidados.titulo'),
    crumbs: [{ name: t('build.migalha.inicio'), href: '/' }, { name: t('build.migalha.cuidados') }],
    description: t('build.cuidados.descricao') });

  /* Os blocos que não podem ser texto da dona: o botão da função de
     retratação na página do direito de livre resolução, o aviso oficial da
     garantia legal e o formulário de retratação (ver src/lib/pages.mjs). */
  const blocos = {
    cancellation: pages.botaoRetratar(),
    guarantee: pages.avisoGarantia(),
    withdraw: pages.formularioRetratacao(shop),
  };
  for (const nome of ['terms', 'privacy', 'cancellation', 'returns-form', 'shipping-and-returns', 'identification',
    'guarantee', 'withdraw']) {
    const title = t(`build.legal.${nome}`);
    prose(`/legal/${nome}/`, `legal/${nome}.md`, { both: true, title: `${title} — ${identity.tradingName}`,
      description: t(`build.legal.${nome}.descricao`), bloco: blocos[nome],
      crumbs: [{ name: t('build.migalha.inicio'), href: '/' }, { name: title }] });
  }

  mirror('/contact/', {
    title: t('build.contactos.titulo'),
    description: t('build.contactos.descricao'),
    crumbs: [{ name: t('build.migalha.inicio'), href: '/' }, { name: t('build.migalha.contactos') }],
    body: pages.contact({ identity, shop, faq: pages.FAQ(shop) }),
    schema: [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: pages.FAQ(shop).map(([q, a]) => ({
        '@type': 'Question', name: q,
        acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() },
      })),
    }],
  });

  write('/cathelier/quote/', page({
    ...shellArgs, brand: 'cathelier', path: '/cathelier/quote/',
    title: t('build.orcamento.titulo'),
    description: t('build.orcamento.descricao'),
    crumbs: [{ name: 'cathelier', href: '/cathelier/' }, { name: t('build.migalha.orcamento') }],
    body: pages.quote({ identity }),
  }));

  /* The basket is the worst of them and the one nobody would have listed: its
     icon is in the header AND the drawer of every page, so a cathelier reader
     used to change shop by clicking the most-used control on the site. */
  mirror('/cart/', {
    noindex: true,
    title: t('build.cesto.titulo'),
    description: t('build.cesto.descricao'),
    body: pages.basket({ shipping, shop }),
  });

  mirror('/resellers/', {
    noindex: true,
    title: t('build.revendedores.titulo'),
    description: t('build.revendedores.descricao'),
    body: pages.resellers(),
  });

  for (const [path, chave, body] of [
    ['/pay/', 'pagar', pages.payPage(shop)],
    ['/thank-you/', 'obrigado', pages.thankYou(shop)],
    ['/order-cancelled/', 'cancelada', pages.orderCancelled()],
  ]) {
    const title = t(`build.${chave}.titulo`);
    const description = t(`build.${chave}.descricao`);
    write(path, page({
      ...shellArgs, brand: 'ithos', path, noindex: true,
      title: `${title} — ithos · cathelier`, description, body,
    }), { sitemap: false });
  }

  /* O GitHub Pages serve UM 404, o da raiz: um /en/404.html seria uma página a
     que nenhuma morada chega. */
  if (lingua() === linguaDaRaiz()) write('/404.html', page({
    ...shellArgs, brand: 'ithos', path: '/404.html', noindex: true,
    title: t('build.naoEncontrada.titulo'),
    description: t('build.naoEncontrada.descricao'),
    body: pages.notFound(),
  }), { sitemap: false });
}

/* --- run ------------------------------------------------------------------ */

const media = join(OUT, 'media');
const keepMedia = existsSync(media);
if (keepMedia) cpSync(media, join(ROOT, '.media-cache'), { recursive: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
if (keepMedia) { cpSync(join(ROOT, '.media-cache'), media, { recursive: true }); rmSync(join(ROOT, '.media-cache'), { recursive: true, force: true }); }

assets();
/* UM PASSO POR LÍNGUA. A primeira vai para a raiz; as outras para /<língua>/. */
for (const l of LINGUAS) {
  prepararLingua(l);
  buildIthos();
  buildCathelier();
  buildShared();
}
/* O catálogo é UM só, na língua de origem: é dele que o Worker tira preços e
   nomes para os emails. Leva os nomes nas outras línguas para o cesto os
   mostrar na língua de quem compra. */
const nomesNasLinguas = {};
for (const l of LINGUAS.filter((x) => x !== ORIGEM)) {
  prepararLingua(l);
  nomesNasLinguas[l] = Object.fromEntries([...lamps, ...pieces].map((p) => [p.slug, {
    name: p.name,
    options: Object.fromEntries((p.options || []).map((o) => [o.id, {
      name: o.name, ...(o.values ? { values: Object.fromEntries(o.values.map((v) => [v.id, v.name])) } : {}),
    }])),
  }]));
}
prepararLingua(ORIGEM);
const cat = catalogueFile(nomesNasLinguas);

writeFileSync(join(OUT, 'robots.txt'),
  PREVIEW ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  /* The copies are not in here, and neither is anything noindex. A sitemap
     entry for a page that carries a canonical pointing elsewhere is two
     contradictory signals about the same document; one for a noindex page is
     the same mistake, and this build has been making it since it was written
     (the basket, the thank-you page, the 404 were all listed). */
  + written.filter((w) => w.sitemap).map((w) => `  <url><loc>${SITE}${w.path}</loc></url>`).join('\n') + '\n</urlset>\n');

console.log(`  ${SITE}${PREVIEW ? '   (preview: noindex, no checkout)' : ''}`);
/* CONTAR FICHEIROS NÃO PROVA PÁGINAS, e um stub está ao mesmo nível de uma
   página no disco. Se esta linha somasse os dois, dizia 104 sobre uma loja de
   94 -- que é precisamente a forma como um sinal de trânsito se faz passar
   por destino. Saem separados, aqui e no verificador. */
const stubs = written.filter((w) => w.stub).length;
console.log(`  ${written.length - stubs} pages · ${lamps.length} lamps · ${pieces.length} pieces`
  + (stubs ? ` · ${stubs} redirect stubs (they are not pages)` : ''));
console.log(`  catalogue.${cat.hash}.json (${cat.count} products)`);
for (const [l, c] of Object.entries(faltasDeTraducao)) {
  if (c.emFalta || c.desactualizados) console.log(`  ${l}: ${c.emFalta} textos por traduzir, ${c.desactualizados} desactualizados (o Worker trata deles)`);
  if (c.invalidos?.length) console.log(`  ${l}: ${c.invalidos.length} traduç${c.invalidos.length > 1 ? 'ões recusadas' : 'ão recusada'} (fica o português): ${c.invalidos.slice(0, 5).join('; ')}`);
}
