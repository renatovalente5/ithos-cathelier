#!/usr/bin/env node
/**
 * Looks at what actually came out of the build, not at what went into it.
 *
 * Counting files does not prove pages. On another project the CI counted
 * outputs, called it 99 pages, and never looked at a single href — 43 dead
 * links went live. This reads the HTML.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');

const deaths = [];
const fragmentos = [];
const stubs = [];
const warnings = [];

function walk(dir, found = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, found);
    else if (f.endsWith('.html')) found.push(p);
  }
  return found;
}

if (!existsSync(OUT)) { console.error('public/ does not exist — did the build run?'); process.exit(1); }
const pages = walk(OUT);
if (!pages.length) { console.error('public/ has no HTML in it'); process.exit(1); }

const titles = new Map();
const descriptions = new Map();
let links = 0, images = 0, indexablePages = 0;
const placeholders = new Map();
/* Atravessam as páginas todas: o cesto e os termos são ficheiros diferentes, e
   a pergunta «os termos dizem o que o cesto oferece?» só se responde com os
   dois lidos. */
const oferecidos = [];
/* A frase dos termos com os métodos de pagamento, por língua (o atributo lang
   da página): cada língua publicada diz os mesmos métodos, com os nomes dela. */
const frasesPaga = {};

/* Uniqueness is checked on pages that go into the index. In PREVIEW every page
   is noindex — so the check quietly stopped running in the exact mode the site
   publishes in, and reported "0 distinct titles" as if that were a result. A
   condition that is never true does not print a failure, it disappears. When
   nothing is indexable, the whole set is checked instead. */
const { MIRRORED } = await import('../src/lib/shell.mjs');
const { REDIRECTS } = await import('../src/lib/redirects.mjs');
const PREVIEW_BUILD = process.env.PREVIEW === 'yes';
const byCanonical = new Map();

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const where = file.slice(OUT.length) || '/';

  /* NOTHING IN A PAGE MAY RUN THAT THE PROGRAMMER DID NOT WRITE.
     The build already refuses these (safeHref, jsonInScript in src/lib/html.mjs);
     this is the second lock, on what actually came out, because the back office
     is about to let someone else write content and a single template that
     forgets the helper would be the whole hole. Three shapes: a link or a form
     that goes to a script scheme, an inline event handler written into the
     markup, and structured data that closes its own <script>. */
  for (const m of html.matchAll(/\s(?:href|src|action|formaction)\s*=\s*["']?\s*(javascript|vbscript|data):/gi)) {
    deaths.push(`${where}: an address with the ${m[1].toLowerCase()}: scheme — content must never become code`);
  }
  /* The inline handler promised above, which was never actually checked: no
     template writes one, so any `on…=` inside a tag came from content. */
  for (const m of html.matchAll(/<[a-z][^>]*?\son[a-z]+\s*=/gi)) {
    deaths.push(`${where}: an inline event handler in the markup (${m[0].slice(0, 60)}…) — content must never become code`);
  }
  /* A `</script>` inside the block ENDS it: what the lazy match returns is the
     part before the tag, which contains no tag. Looking for tags inside the
     match therefore proves nothing -- measured, it passed an injected
     `</script><script>`. What the truncation always breaks is the JSON. */
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch {
      deaths.push(`${where}: structured data is not valid JSON — something inside it closed its <script>`);
    }
    if (/<!--/.test(m[1])) deaths.push(`${where}: structured data contains <!-- `);
  }

  /* UM STUB DE REENCAMINHAMENTO NÃO É UMA PÁGINA, e é reconhecido por uma
     marca que o gerador ESCREVE -- nunca por lhe faltar o título ou o <main>.
     Reconhecer pela falta seria abrir a porta ao contrário do que isto
     defende: uma página a sério que saísse partida do build deixaria de ser
     medida, em silêncio, por parecer um sinal de trânsito. Um stub responde
     mais abaixo, ao bloco que lhe é próprio, e esse é mais exigente do que
     estas cinco linhas. */
  const ehStub = /<meta name="generator" content="redirect-stub">/.test(html);
  if (ehStub) stubs.push({ where, html });

  /* UM CAMPO OBRIGATÓRIO SÓ VALE COM UM BOTÃO QUE SUBMETA.
     O `required` do HTML só é verificado quando o formulário é submetido. O
     botão de adicionar ao cesto era `type="button"`, portanto os oitenta
     campos obrigatórios do cathelier não valiam nada: a peça entrava no cesto
     vazia e só era recusada no pagamento, sem dizer o que faltava. Medido a
     conduzir a página, não a lê-la. Esta guarda é a que impede o botão de
     voltar a ser `type="button"` sem ninguém dar por isso. */
  const formularioDeProduto = /<form[^>]*data-product-form/.test(html);
  if (formularioDeProduto) {
    const botao = html.match(/<button[^>]*data-add[^>]*>/)?.[0] ?? '';
    if (!/type="submit"/.test(botao)) {
      deaths.push(`${where}: o botão de adicionar ao cesto não é type="submit" — os campos obrigatórios não são verificados`);
    }
    const quantidade = html.match(/<input[^>]*class="qty__input"[^>]*>/)?.[0] ?? '';
    if (!/\bmax="\d+"/.test(quantidade)) {
      deaths.push(`${where}: o campo de quantidade não declara um max — o tecto do cesto lê-se dele`);
    }
  }

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const indexable = !/<meta name="robots" content="noindex/.test(html);

  if (!title && !ehStub) deaths.push(`${where}: no <title>`);
  if (!desc && !ehStub) deaths.push(`${where}: no description`);
  if (indexable && !ehStub) indexablePages++;

  /* THE QUESTION IS "ARE THESE THE SAME DOCUMENT?", NOT "THE SAME FILE?".
     Eight pages are now written twice, once in each shop's dress, and the two
     copies SHOULD carry the same title -- inventing a second description of
     one document is inventing a second claim about it. So pages are grouped by
     the canonical they name, and uniqueness is asked ACROSS groups.
     That is an exemption, so it is bounded on its own terms below: a group may
     hold at most two files, exactly one of which is the canonical. Without
     those two bounds, "same canonical" would be a way to make any two pages
     stop being compared. */
  /* O canonical de um stub é, de propósito, a morada de outra pessoa: é
     exactamente isso que um reencaminhamento diz. Metê-lo neste agrupamento
     punha onze ficheiros no grupo de /cathelier/pieces/ e, pior, o stub que
     calhasse primeiro por ordem alfabética virava `group[0]`: como não tem
     título, o laço fazia `continue` e a página verdadeira DEIXAVA de ser
     comparada com as outras. O limite das "duas roupas" foi escrito sobre
     páginas espelhadas, não sobre sinais de trânsito. */
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] || where;
  if (!ehStub) {
  if (!byCanonical.has(canonical)) byCanonical.set(canonical, []);
  byCanonical.get(canonical).push({
    where, title, desc, indexable,
    selfCanonical: canonical.endsWith(where) || canonical.endsWith(where.replace(/index\.html$/, '')),
  });
  }

  /* A FRASE DOS MÉTODOS DE PAGAMENTO TEM DE DIZER O QUE O CESTO OFERECE.
     `shop.json` tem uma frase escrita à mão que os termos mostram ao
     comprador, e o artigo 7.º do DL 24/2014 obriga a indicar os meios aceites
     de forma clara, o mais tardar no início da encomenda. Essa frase esteve a
     dizer «Multibanco reference or MB WAY» DEPOIS de o Payshop já estar no
     cesto: ninguém escreve uma frase destas duas vezes, e por isso ela fica
     para trás sozinha.
     Aqui lê-se o que o cesto construído oferece mesmo -- os `value` dos rádios
     -- e no fim exige-se que a frase dos termos nomeie cada um. É a única
     ligação entre os dois ficheiros, e sem ela a lei fica por cumprir sem erro
     nenhum em lado nenhum. */
  if (/name="metodo"/.test(html)) {
    const achados = [...html.matchAll(/name="metodo" value="([A-Z]+)"/g)].map((m) => m[1]);
    if (!achados.length) {
      deaths.push(`${where}: há rádios de método de pagamento mas não consegui ler nenhum valor`);
    }
    for (const m of achados) if (!oferecidos.includes(m)) oferecidos.push(m);
  }
  {
    const lang = (/<html lang="([^"]+)"/.exec(html) ?? [])[1] ?? '?';
    const m = !(lang in frasesPaga) && /(?:You can pay by|Pode pagar por) ([^.<]+)\./.exec(html);
    if (m) frasesPaga[lang] = m[1].trim();
  }

  /* OS CAMPOS ESTREITOS DO CHECKOUT ANDAM AOS PARES.
     A grelha é de duas colunas: os largos levam a linha toda e os estreitos
     emparelham. Se o número de estreitos for ímpar, o último fica sozinho com
     um buraco ao lado -- e ninguém repara, porque não é um erro, é uma coisa
     que parece só um bocado torta.
     Esta contagem existe porque a regra ANTERIOR contava posições
     (`:nth-child(-n+4)`) e partiu-se no dia em que um campo saiu do
     formulário: o código postal ficou com a linha toda e os pares trocaram-se
     todos, sem um erro em lado nenhum. */
  if (/class="checkout__grid"/.test(html)) {
    const grelha = html.slice(html.indexOf('class="checkout__grid"'));
    const fim = grelha.indexOf('</div>');
    const dentro = grelha.slice(0, fim < 0 ? grelha.length : fim);
    const todos = [...dentro.matchAll(/class="field(?: [^"]*)?"/g)].map((m) => m[0]);
    const largos = todos.filter((c) => c.includes('field--wide')).length;
    const estreitos = todos.length - largos;
    if (todos.length && estreitos % 2 !== 0) {
      deaths.push(`${where}: o formulário de entrega tem ${estreitos} campos estreitos, `
        + 'que é ímpar — o último fica sozinho numa linha de duas colunas. '
        + 'Emparelhar, ou marcá-lo com `field--wide`');
    }
    if (todos.length && !largos) {
      deaths.push(`${where}: nenhum campo do formulário de entrega tem \`field--wide\`, `
        + 'por isso o nome, o email e a morada estão a meia largura');
    }
  }

  // Text the owner has not filled in must never reach a LIVE page. In preview
  // it is expected — that is what preview is for — so it warns there and kills
  // everywhere else. Counted by marker rather than by page: the address is on
  // all 94 of them and 202 identical lines would bury everything else.
  // `TODO` E `FIXME` PRECISAM DE FRONTEIRA, E DE UMA QUE CONHEÇA ACENTOS.
  // Isto era `/TODO|FIXME/gi` e passou a acusar a página do cesto: em
  // português, «método» e o atributo `name="metodo"` têm TODO lá dentro. Com
  // `\b` continuava a acusar `MÉTODO` -- o `\b` do JavaScript é ASCII e o «É»
  // não conta como letra, por isso via ali uma fronteira que não existe. A
  // fronteira tem de ser por classe Unicode, e escrita à mão dos dois lados.
  // E DEIXAM DE SER INSENSÍVEIS A MAIÚSCULAS, de propósito: «todo» em
  // minúsculas é uma palavra portuguesa corrente («todo o site»), e aceitá-la
  // como marcador enchia isto de falsos alarmes em cada comentário. Um
  // marcador a sério escreve-se em maiúsculas; é a convenção e é o que se
  // procura. O `lorem ipsum` fica sem fronteira e sem maiúsculas: é uma frase,
  // não um marcador, e não há palavra portuguesa que a contenha.
  for (const m of html.matchAll(/⟨[^⟩]*⟩|\{\{[^}]*\}\}/g)) {
    placeholders.set(m[0].slice(0, 60), (placeholders.get(m[0].slice(0, 60)) ?? 0) + 1);
  }
  for (const m of html.matchAll(/(?<![\p{L}\p{N}_])(TODO|FIXME)(?![\p{L}\p{N}_])/gu)) {
    placeholders.set(m[0], (placeholders.get(m[0]) ?? 0) + 1);
  }
  for (const m of html.matchAll(/lorem ipsum/gi)) {
    placeholders.set(m[0].toLowerCase(), (placeholders.get(m[0].toLowerCase()) ?? 0) + 1);
  }

  // Every internal address has to resolve to something on disk, and the site
  // is served from a folder, so a path that forgot the prefix resolves to
  // somebody else's site — the prefix is checked here rather than trusted.
  //
  // SRCSET IS IN HERE, AND IT WAS NOT.
  // This walked `href` and `src` only, and the renditions live in `srcset`:
  // 747 of the site's 944 image addresses appeared NOWHERE ELSE, so three
  // quarters of the pictures were never checked for existence, for the prefix,
  // or for being empty. Which is the shape of the defect this file was written
  // after in the first place.
  const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
  const enderecos = [];
  for (const m of html.matchAll(/(?:href|src|poster|data-film(?:-tall)?)="(\/[^"#?]*)/g)) {
    enderecos.push(m[1]);
  }
  /* E O QUE VEM DEPOIS DO `#`.
     A expressão acima para no cardinal, de propósito: o ficheiro é o mesmo com
     ou sem fragmento. Mas o fragmento é uma promessa à mesma -- e desde que os
     círculos da cathelier passaram a levar a /cathelier/pieces/#<ocasião>, é
     uma promessa que NINGUÉM verificava: o HTML servido é byte a byte igual
     com um fragmento certo e com um errado, e a diferença só aparece no
     browser de quem clica. Guardam-se aqui e conferem-se no fim, quando já se
     sabe o que cada página tem lá dentro. */
  for (const m of html.matchAll(/href="(\/[^"#?]*)#([^"?\s]+)"/g)) {
    fragmentos.push({ where, target: m[1], frag: decodeURIComponent(m[2]) });
  }
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const parte of m[1].split(',')) {
      const url = parte.trim().split(/\s+/)[0];
      if (url.startsWith('/')) enderecos.push(url.split('#')[0].split('?')[0]);
    }
  }

  for (let target of enderecos) {
    if (BASE) {
      if (!target.startsWith(BASE + '/')) {
        deaths.push(`${where}: ${target} is missing the ${BASE} prefix and would 404`);
        continue;
      }
      target = target.slice(BASE.length);
    }
    if (/^\/(media|assets|data)\//.test(target)) {
      images++;
      const disco = join(OUT, target);
      if (!existsSync(disco)) {
        deaths.push(`${where}: ${target} does not exist`);
      } else if (statSync(disco).size === 0) {
        /* Existir não é ter conteúdo, e a diferença já custou uma publicação:
           um scripts/renditions.py interrompido a meio deixou uma imagem de
           0 bytes, o existsSync disse que sim, e a fotografia partida foi para
           o ar com todas as verificações verdes. */
        deaths.push(`${where}: ${target} exists but is empty — an interrupted write, `
          + 'or a generator that failed silently');
      }
      continue;
    }
    links++;
    const asDir = join(OUT, target, 'index.html');
    const asFile = join(OUT, target);
    if (!existsSync(asDir) && !existsSync(asFile)) deaths.push(`${where}: link to ${target} goes nowhere`);
  }

  /* A IMAGEM QUE A PÁGINA DÁ ÀS REDES E AO GOOGLE TEM DE EXISTIR.
     O og:image e o `image` dos dados estruturados são moradas absolutas, e a
     verificação de cima só lê as que começam por «/». O candeeiro da coruja
     apontou meses para um -1000 que nunca existiu (o master tem 540 px): a
     pré-visualização numa rede social e o resultado rico do Google saíam sem
     imagem, com tudo verde. Confere-se a parte a partir de /media/ -- e a
     de /assets/: 59 páginas (a entrada, as legais, o cesto) davam como imagem
     de partilha um /assets/share.jpg que nunca existiu. */
  const imagensDaPagina = [...html.matchAll(/<meta property="og:image" content="([^"]*)"/g)].map((m) => m[1]);
  const juntarImagens = (v) => {
    if (typeof v === 'string') imagensDaPagina.push(v);
    else if (Array.isArray(v)) v.forEach(juntarImagens);
    else if (v && typeof v === 'object') { juntarImagens(v.image); if (v['@graph']) juntarImagens(v['@graph']); }
  };
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { const j = JSON.parse(m[1]); (Array.isArray(j) ? j : [j]).forEach((x) => juntarImagens(x?.image)); } catch { /* já contado lá em cima */ }
  }
  for (const url of imagensDaPagina) {
    const i = ['/media/', '/assets/'].map((d) => url.indexOf(d)).filter((k) => k !== -1).sort((a, b) => a - b)[0] ?? -1;
    if (i === -1) continue;
    const alvo = url.slice(i + 1).split(/[?#]/)[0];
    if (!existsSync(join(OUT, alvo))) deaths.push(`${where}: the share image ${alvo} does not exist — social previews and search results would show none`);
  }

  /* O CARTÃO TROCA DE FOTOGRAFIA COM A ESCADA DA CAPA.
     O script do cartão clona o <picture> da capa e só lhe muda o NOME (ver
     cards() em src/js/shop.js): o srcset fica com as larguras da capa. Uma
     fotografia do mesmo produto sem uma dessas larguras -- uma pequena, como as
     do Instagram, ao lado de uma capa grande -- dava a moldura em branco no
     clique, em ecrãs retina. A tira de miniaturas pede -120 e -200 de cada. */
  for (const m of html.matchAll(/<article class="card"[^>]*>[\s\S]*?<\/article>/g)) {
    const abre = m[0].slice(0, m[0].indexOf('>') + 1);
    const shots = (abre.match(/data-shots="([^"]*)"/)?.[1] ?? '').split(',').filter(Boolean);
    const dir = abre.match(/data-dir="([^"]*)"/)?.[1];
    if (!dir || !shots.length) continue;
    const srcset = m[0].match(/srcset="([^"]+)"/)?.[1] ?? '';
    const larguras = [...new Set([...srcset.matchAll(/-(\d+)\.(?:avif|webp) \d+w/g)].map((x) => x[1]))];
    const faltam = [];
    for (const n of shots) {
      for (const w of larguras) for (const ext of ['avif', 'webp']) {
        if (!existsSync(join(OUT, 'media', dir, `${n}-${w}.${ext}`))) faltam.push(`${n}-${w}.${ext}`);
      }
      if (shots.length > 1) for (const w of [120, 200]) {
        if (!existsSync(join(OUT, 'media', dir, `${n}-${w}.webp`))) faltam.push(`${n}-${w}.webp`);
      }
    }
    if (faltam.length) {
      deaths.push(`${where}: the card for ${dir} would ask for ${faltam.length} photograph(s) that do not exist when a reader picks another shot (${faltam.slice(0, 3).join(', ')})`);
    }
  }

  // A product page has to describe itself. For a long while the 26 lamps did
  // and the 41 pieces did not — same shop, same basket, and to a search engine
  // only half of it was a shop.
  const ehProduto = /\/(lamps|pieces)\/[^/]+\/index\.html$/.test(where);
  if (ehProduto) {
    const blobs = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
      .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
      .filter(Boolean)
      .flatMap((x) => (Array.isArray(x) ? x : [x]));
    if (!blobs.some((x) => x['@type'] === 'Product')) {
      deaths.push(`${where}: a product page with no Product in its structured data`);
    }
    if (!blobs.some((x) => x['@type'] === 'BreadcrumbList')) {
      deaths.push(`${where}: a product page with no BreadcrumbList`);
    }
  }

  // Structure the shop cannot work without — of a page. A stub has none of it
  // and should have none of it.
  if (ehStub) continue;
  if (!/<main id="main"/.test(html)) deaths.push(`${where}: no <main>`);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) {
    deaths.push(`${where}: ${(html.match(/<h1[\s>]/g) || []).length} h1 elements, expected exactly 1`);
  }
  if (!/data-brand="(ithos|cathelier)"/.test(html)) deaths.push(`${where}: no brand on <html>`);
}

/* Every address INSIDE the stylesheet has to resolve too.
 *
 * The page checks above only ever read HTML attributes, and a CSS file has
 * addresses of its own. Eight @font-face rules shipped with root-relative
 * url() under a project path: every typeface 404ed on the live site and every
 * page rendered in the system fallback, while the local preview — where the
 * prefix is empty — looked perfect. */
/* --- os reencaminhamentos --------------------------------------------------
   Um stub foi dispensado de cinco exigências lá em cima, por isso paga-as
   aqui, com juros. O que ele promete é uma coisa só -- "o que estava nesta
   morada está agora naquela" -- e essa promessa tem três mecanismos: o meta
   refresh, o JavaScript e o link visível para quem os dois falharem.

   A MANEIRA DE OS TRÊS CONCORDAREM NÃO É COMPARÁ-LOS, É NÃO HAVER TRÊS.
   O JavaScript lê a morada do DOM em vez de a repetir (um literal dentro de
   <script> nunca leva o prefixo do endereço e ia 404 na produção), o que deixa
   duas cópias: o `href` e o `url=` do refresh. Essas duas comparam-se aqui,
   byte a byte.

   E a lista é comparada nos DOIS sentidos com src/lib/redirects.mjs. Contar
   não serve: dez ficheiros no sítio errado contam dez na mesma. */
{
  const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
  const esperados = new Map(REDIRECTS.map((r) => [`${r.from}index.html`, r]));
  const encontrados = new Set(stubs.map((x) => x.where));

  for (const [onde, r] of esperados) {
    if (!encontrados.has(onde)) {
      deaths.push(`${r.from}: src/lib/redirects.mjs promises a redirect here and the build wrote none`);
    }
  }
  for (const { where } of stubs) {
    if (!esperados.has(where)) {
      deaths.push(`${where}: a redirect stub at an address src/lib/redirects.mjs does not list `
        + '— every redirect is a historical fact and belongs in that file');
    }
  }

  const ondeEsta = new Map(stubs.map((x) => [x.where, x.html]));
  for (const [onde, r] of esperados) {
    const html = ondeEsta.get(onde);
    if (!html) continue;
    const querido = BASE + r.to;                       // a forma já prefixada

    // 1. o meta refresh, e o atraso
    const refresh = html.match(/<meta http-equiv="refresh" content="(\d+);\s*url=([^"]+)">/);
    if (!refresh) {
      deaths.push(`${onde}: a redirect stub with no <meta http-equiv="refresh"> — nothing redirects`);
      continue;
    }
    if (refresh[1] !== '0') {
      deaths.push(`${onde}: the refresh waits ${refresh[1]}s. Zero is not about speed: a refresh with `
        + 'a delay REPLACES the history entry, and one with a wait pushes a new one, which traps Back');
    }

    // 2. o link visível, que é a única morada escrita à mão
    const link = html.match(/<a id="go" href="([^"]+)"/);
    if (!link) {
      deaths.push(`${onde}: no <a id="go"> — if the refresh and the script both fail there is `
        + 'nothing on the page for a human to click, and the script reads its address from it');
      continue;
    }

    // 3. e as duas cópias dizem a mesma coisa
    if (refresh[2] !== link[1]) {
      deaths.push(`${onde}: the refresh goes to ${refresh[2]} and the link goes to ${link[1]} `
        + '— two answers to one question');
    }
    if (link[1] !== querido) {
      deaths.push(`${onde}: goes to ${link[1]}, but src/lib/redirects.mjs says ${querido}`);
    }

    // 4. o prefixo do endereço, que é o defeito que este projecto já pagou
    if (BASE && !link[1].startsWith(BASE + '/')) {
      deaths.push(`${onde}: ${link[1]} is missing the ${BASE} prefix and would land on somebody `
        + "else's site at the root of github.io");
    }
    if (BASE && !refresh[2].startsWith(BASE + '/')) {
      deaths.push(`${onde}: the refresh url ${refresh[2]} is missing the ${BASE} prefix. This is the `
        + 'one the attribute rule in prefix() does not reach on its own — the `url=` sits before the slash');
    }

    // 5. o destino existe, e não é outro sinal de trânsito
    const semFragmento = link[1].split('#')[0];
    const nu = BASE && semFragmento.startsWith(BASE + '/') ? semFragmento.slice(BASE.length) : semFragmento;
    const alvo = join(OUT, nu, 'index.html');
    if (!existsSync(alvo)) {
      deaths.push(`${onde}: redirects to ${nu}, which does not exist`);
    } else if (/<meta name="generator" content="redirect-stub">/.test(readFileSync(alvo, 'utf8'))) {
      deaths.push(`${onde}: redirects to ${nu}, which is itself a redirect — a chain, and every `
        + 'browser gives up on one eventually');
    }

    // 6. o canonical aponta ao destino, e sem fragmento: um canonical com `#`
    //    é normalizado para a morada sem ele, por isso escrevê-lo é escrever
    //    uma coisa e dizer outra.
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonical) deaths.push(`${onde}: a redirect stub with no canonical — nothing tells an index where the page went`);
    else if (canonical.includes('#')) deaths.push(`${onde}: the canonical carries a fragment (${canonical}), which is normalised away`);
    else if (!canonical.endsWith(nu)) deaths.push(`${onde}: the canonical is ${canonical} but it redirects to ${nu}`);

    // 7. e o script não tem morada nenhuma lá dentro
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
    if (/["'`]\//.test(script)) {
      deaths.push(`${onde}: the inline script carries an address of its own (${script.trim().slice(0, 60)}). `
        + 'A literal inside <script> never gets the BASE_PATH prefix — it must read the link instead');
    }
  }
}

/* Um fragmento aterra em qualquer sítio: o browser não se queixa de um `#`
   que não existe, limita-se a deixar a pessoa no topo da página -- e, no caso
   de um filtro, com a lista toda à frente, que é exactamente o que ela não
   pediu. Vale como âncora um `id`, ou um chip de filtro com aquele nome. */
for (const { where, target, frag } of fragmentos) {
  const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
  const limpo = base && target.startsWith(base + '/') ? target.slice(base.length) : target;
  const disco = [join(OUT, limpo, 'index.html'), join(OUT, limpo)].find((f) => existsSync(f) && statSync(f).isFile());
  if (!disco) continue;                    // a falta da página já é morte acima
  const alvoHtml = readFileSync(disco, 'utf8');
  const temId = new RegExp(`\\sid="${frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(alvoHtml);
  const temFiltro = alvoHtml.includes(`data-filter="${frag}"`);
  if (!temId && !temFiltro) {
    deaths.push(`${where}: link to ${limpo}#${frag} — that page has no id="${frag}" `
      + 'and no filter by that name, so the fragment does nothing');
  }
}

/* O NOME DE QUEM RECEBE O DINHEIRO NÃO PODE FICAR PARA TRÁS.
   Trocar de processador de pagamentos envelhece textos em silêncio: os termos
   diziam «pagamento por cartão através da Stripe» e a privacidade nomeava-a
   como destinatária dos dados, e as duas continuaram publicadas em quatro
   moradas depois de a Stripe ter sido apagada do código. Uma página legal que
   mente sobre quem recebe os dados é das piores maneiras de estar errado.

   A COMPARAÇÃO É COM MAIÚSCULA E COM FRONTEIRA DE PALAVRA, e isso não é
   pormenor: o candeeiro do tigre fala das «stripes» dele quatro vezes na mesma
   página. Uma procura ingénua por "stripe" mataria a construção por causa de
   um animal. */
{
  const CONCORRENTES = ['Stripe', 'PayPal', 'Easypay', 'Eupago', 'Mollie', 'Adyen', 'SumUp', 'Redsys'];
  /* A configuração lê-se daqui e não se supõe: quem manda é o mesmo ficheiro
     que a construção usou para escrever as páginas. */
  const shopCfg = JSON.parse(readFileSync(join(ROOT, 'content/settings/shop.json'), 'utf8'));
  const nosso = (shopCfg.payment?.provider ?? '').toLowerCase();
  const proibidos = CONCORRENTES.filter((n) => n.toLowerCase() !== nosso);
  /* As páginas E os ficheiros servidos: o comentário que ficou para trás
     estava no JavaScript publicado, não no HTML. */
  const assets = existsSync(join(OUT, 'assets'))
    ? readdirSync(join(OUT, 'assets')).filter((f) => /\.(js|css)$/.test(f)).map((f) => join(OUT, 'assets', f))
    : [];
  for (const f of [...pages, ...assets]) {
    const texto = readFileSync(f, 'utf8');
    for (const n of proibidos) {
      if (new RegExp(`\\b${n}\\b`).test(texto)) {
        deaths.push(`${f.slice(OUT.length) || '/'}: names ${n}, and the shop is paid through `
          + `${shopCfg.payment?.provider ?? '(nobody configured)'} — a page that says who takes the `
          + 'money has to say the right one');
      }
    }
  }
}

/* DUAS PEÇAS COM A MESMA FOTOGRAFIA, NA MONTRA.
   Um cartão é a promessa de que ali está outra coisa, e dois cartões com a
   mesma imagem desmentem-na antes de alguém clicar. A dona viu isso na home e
   por isso esta verificação existe.

   MAS DEIXOU DE PODER MATAR. Nenhuma das 41 peças da cathelier foi
   fotografada: partilham uma pasta de amostras com NOVE imagens ao todo. Uma
   home com catorze cartões repete alguma por aritmética, e recusar publicar
   por causa disso é a guarda a mandar na loja em vez de a servir. O que ela
   faz é dizer, numa linha e com os nomes, quais os pares que se parecem --
   informação para quem vai fotografar. Quando cada peça tiver a sua imagem, o
   aviso desaparece sozinho.

   O que EVITA o defeito continua no gerador: em src/lib/cathelier.mjs as filas
   são distribuídas uma volta por fotografia, para duas iguais nunca caírem
   lado a lado. */
for (const home of ['/index.html', '/cathelier/index.html']) {
  const f = join(OUT, home.slice(1));
  if (!existsSync(f)) continue;
  const vistas = new Map();
  const pares = [];
  let cartoes = 0;
  for (const m of readFileSync(f, 'utf8').matchAll(/<article class="card"[\s\S]*?<\/article>/g)) {
    // O nome, ou o endereço da peça: as duas marcas não desenham o cartão igual
    // e uma mensagem com "?" lá dentro não diz a ninguém o que ir corrigir.
    const nome = m[0].match(/class="card__name">(?:<a[^>]*>)?([^<]*)/)?.[1]?.trim()
      || m[0].match(/data-product="([^"]*)"/)?.[1] || '?';
    const foto = m[0].match(/srcset="[^"]*?\/media\/([^"\s]+?)-\d+\.(?:avif|webp)/)?.[1];
    if (!foto) continue;
    cartoes++;
    if (vistas.has(foto)) pares.push(`${vistas.get(foto)}=${nome}`);
    else vistas.set(foto, nome);
  }
  if (pares.length) {
    warnings.push(`${home}: ${cartoes} cards share ${vistas.size} distinct photographs `
      + `(${pares.join(', ')}) — until each piece has its own, two cards can look like one thing`);
  }
}

const cssName = existsSync(join(OUT, 'assets'))
  ? readdirSync(join(OUT, 'assets')).find((f) => /^styles\.[a-f0-9]+\.css$/.test(f))
  : null;
const cssPath = cssName ? join(OUT, 'assets', cssName) : '';
if (!cssName) deaths.push('no styles.<digest>.css in assets/ — did the build write one?');
else {
  const css = readFileSync(cssPath, 'utf8');
  const BASE_CSS = (process.env.BASE_PATH || '').replace(/\/$/, '');
  let urls = 0;
  for (const m of css.matchAll(/url\((['"]?)(\/[^'")]+)\1\)/g)) {
    urls++;
    const target = m[2];
    if (BASE_CSS && !target.startsWith(BASE_CSS + '/')) {
      deaths.push(`styles.css: ${target} is missing the ${BASE_CSS} prefix — it would 404`);
      continue;
    }
    const onDisk = BASE_CSS ? target.slice(BASE_CSS.length) : target;
    if (!existsSync(join(OUT, onDisk))) deaths.push(`styles.css: ${target} does not exist`);
  }
  if (urls === 0) deaths.push('styles.css has no url() at all — are the typefaces still declared?');
  console.log(`  stylesheet: ${urls} addresses inside the CSS all resolve`);
}

/* The catalogue the Worker prices against has to be the one the pointer names. */
const pointer = join(OUT, 'data', 'catalogue-current.txt');
if (!existsSync(pointer)) deaths.push('data/catalogue-current.txt is missing');
else {
  const hash = readFileSync(pointer, 'utf8').trim();
  if (!existsSync(join(OUT, 'data', `catalogue.${hash}.json`))) {
    deaths.push(`the pointer names catalogue.${hash}.json, which does not exist`);
  }
}

for (const [marker, count] of placeholders) {
  const line = `an unfilled placeholder is on ${count} page${count > 1 ? 's' : ''}: ${marker}`;
  (PREVIEW_BUILD ? warnings : deaths).push(line);
}

/* --- nobody is dropped into the other shop's chrome ------------------------
   Eight pages exist in both dresses. The failure this guards against is not
   today's: it is the next shared page somebody adds, links from the footer,
   and forgets to put in MIRRORED -- which would put 53 cathelier pages one
   click from the ithos wordmark, silently, exactly the way the basket did
   before this change.

   The question is asked of the built HTML and of the pages themselves: a page
   wearing cathelier may not link to the ithos copy of a shared page, and the
   other way round. The doors between the shops are the brands' OWN addresses
   and are not in this list, so they are untouched. */
{
  const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
  const dressOf = new Map();
  for (const f of pages) {
    const at = (f.slice(OUT.length) || '/').replace(/index\.html$/, '');
    dressOf.set(at, readFileSync(f, 'utf8').match(/data-brand="(ithos|cathelier)"/)?.[1] || null);
  }
  for (const m of MIRRORED) {
    if (dressOf.get(m) !== 'ithos') deaths.push(`${m}: missing, or not wearing ithos`);
    if (dressOf.get(`/cathelier${m}`) !== 'cathelier') deaths.push(`/cathelier${m}: missing, or not wearing cathelier`);
  }
  for (const f of pages) {
    const at = (f.slice(OUT.length) || '/').replace(/index\.html$/, '');
    if (dressOf.get(at) !== 'cathelier') continue;
    const html = readFileSync(f, 'utf8');
    for (const m of MIRRORED) {
      const bare = new RegExp(`\\shref="${BASE}${m.replace(/\//g, '\\/')}(?:#[^"]*)?"`);
      if (bare.test(html)) {
        deaths.push(`${at}: wears cathelier but links to ${m}, which wears ithos `
          + `— that link has to go through brandPath()`);
      }
    }
  }
}

/* --- one document, one title ---------------------------------------------- */
for (const [canonical, group] of byCanonical) {
  /* The bounds that stop "same canonical" becoming a way to be excused. */
  if (group.length > 2) {
    deaths.push(`${group.length} pages name the same canonical ${canonical}: `
      + group.map((g) => g.where).join(', ') + ' — a shared page has two dresses, not more');
  }
  const selves = group.filter((g) => g.selfCanonical).length;
  if (selves !== 1) {
    deaths.push(`${canonical}: ${selves} of ${group.length} pages are their own canonical, expected exactly 1 `
      + `(${group.map((g) => g.where).join(', ')}) — a copy must point home, and the home page must point at itself`);
  }
  /* Two dresses of one document say the same thing. If they diverge, one of
     them is lying about what it is. */
  const first = group[0];
  for (const g of group.slice(1)) {
    if (g.title !== first.title) deaths.push(`${g.where}: same canonical as ${first.where} but a different title`);
    if (g.desc !== first.desc) deaths.push(`${g.where}: same canonical as ${first.where} but a different description`);
  }

  /* Uniqueness is asked of documents that go into the index. In PREVIEW
     nothing is indexable, so the whole set is checked instead -- the same
     reasoning as the note at the top of this file, where a condition that was
     never true made the check disappear and report "0 distinct titles" as if
     that were a result. */
  const home = group.find((g) => g.selfCanonical) || first;
  if (!(PREVIEW_BUILD || home.indexable) || !first.title) continue;
  if (titles.has(first.title)) deaths.push(`${first.where}: same title as ${titles.get(first.title)}`);
  else titles.set(first.title, first.where);
  if (first.desc) {
    if (descriptions.has(first.desc)) warnings.push(`${first.where}: same description as ${descriptions.get(first.desc)}`);
    else descriptions.set(first.desc, first.where);
  }
}

/* OS AVISOS IMPRIMEM-SE NO FIM, E NÃO A MEIO.
   Esta linha estava antes do laço do canonical, que ainda escreve para
   `warnings` (as descrições repetidas). Eram recolhidas para um array já
   esvaziado e nunca chegaram aos olhos de ninguém -- uma verificação que
   corre, acerta, e fala para o vazio. */
/* A frase e o cesto confrontam-se aqui, quando as duas páginas já foram lidas. */
{
  const NOMES = {
    en: { MB: 'Multibanco', MBWAY: 'MB WAY', CCARD: 'card', GOOGLE: 'Google Pay', APPLE: 'Apple Pay' },
    'pt-PT': { MB: 'Multibanco', MBWAY: 'MB WAY', CCARD: 'cartão', GOOGLE: 'Google Pay', APPLE: 'Apple Pay' },
  };
  const semNome = oferecidos.filter((m) => !NOMES.en[m]);
  if (semNome.length) {
    deaths.push(`o cesto oferece ${semNome.join(', ')} e não há nome para pôr na frase dos termos`);
  }
  if (oferecidos.length && !Object.keys(frasesPaga).length) {
    deaths.push('o cesto oferece métodos de pagamento e os termos não têm a frase «Pode pagar por …» '
      + '— o artigo 7.º do DL 24/2014 obriga a indicá-los ao comprador');
  }
  for (const [lang, frase] of Object.entries(frasesPaga)) {
    const NOME = NOMES[lang];
    if (!NOME) continue;   // uma língua sem nomes conhecidos aqui: a tradução é do Worker
    const emFalta = oferecidos.filter((m) => NOME[m]).filter((m) => !frase.toLowerCase().includes(NOME[m].toLowerCase()));
    if (emFalta.length) {
      deaths.push(`os termos (${lang}) dizem «${frase}» mas o cesto também oferece `
        + `${emFalta.map((m) => NOME[m]).join(', ')} — acertar content/settings/shop.json`);
    }
  }
}

/* --- alegações ambientais genéricas ---------------------------------------
   Diretiva (UE) 2024/825, anexo I da Diretiva 2005/29, pontos 2-A e 4-A: sem
   certificação reconhecida, «sustentável», «ecológico», «amigo do ambiente»,
   «verde» e companhia não vão a uma página. A lista e as excepções (frases
   exactas, como «em verde», a cor do dinossauro) estão em
   scripts/alegacoes-ambientais.mjs.
   Lê-se o texto VISÍVEL -- o que está entre etiquetas, os alt, os title, os
   aria-label, as descrições e as frases que o script escreve (data-lead-…) --
   e não o HTML cru: um nome de classe ou de ficheiro não é uma alegação. E as
   frases do shop.js, que chegam ao ecrã sem estarem em HTML nenhum.
   A GUARDA TESTA-SE PRIMEIRO. Uma lista que deixou de apanhar «ecológico» diz
   «tudo limpo» sobre qualquer site; por isso, se falhar um caso de teste,
   morre antes de olhar para as páginas. */
{
  const { procurarAlegacoes, autoTeste } = await import('./alegacoes-ambientais.mjs');
  const falhas = autoTeste();
  if (falhas.length) {
    deaths.push(`a guarda das alegações ambientais está partida: ${falhas.join('; ')}`);
  } else {
    const ent = (x) => x.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
      .replace(/&amp;/g, '&');
    const visivel = (html) => {
      const semLixo = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, ' ');
      const atributos = [...semLixo.matchAll(/\s(?:alt|title|aria-label|placeholder|content|data-lead-[a-z-]+)="([^"]*)"/g)].map((m) => m[1]);
      return ent([semLixo.replace(/<[^>]+>/g, ' '), ...atributos].join(' \n '));
    };
    const achados = [];
    for (const f of pages) {
      for (const a of procurarAlegacoes(visivel(readFileSync(f, 'utf8')))) {
        achados.push(`${f.slice(OUT.length) || '/'}: «${a.palavra}» em «${a.trecho}»`);
      }
    }
    const pastaAssets = join(OUT, 'assets');
    for (const f of existsSync(pastaAssets) ? readdirSync(pastaAssets).filter((x) => /^textos\..+\.js$/.test(x)) : []) {
      const corpo = readFileSync(join(pastaAssets, f), 'utf8');
      let frases = [];
      try { frases = Object.values(JSON.parse(corpo.replace(/^window\.TEXTOS=/, '').replace(/;\s*$/, ''))); }
      catch { deaths.push(`assets/${f}: não consegui ler as frases para procurar alegações ambientais`); }
      for (const a of procurarAlegacoes(frases.join(' \n '))) achados.push(`assets/${f}: «${a.palavra}» em «${a.trecho}»`);
    }
    if (achados.length) {
      deaths.push(`${achados.length} alegação(ões) ambiental(is) genérica(s) sem certificação (Diretiva (UE) 2024/825) — `
        + 'tirar, ou, se não for uma alegação (uma cor), juntar a frase exacta a EXCECOES em scripts/alegacoes-ambientais.mjs:\n    '
        + achados.slice(0, 12).join('\n    '));
    }
  }
}

/* --- o que a lei manda estar À VISTA, página a página ----------------------
   Promessas das páginas legais que só valem se o código as cumprir em todo o
   lado -- e que desaparecem sem erro nenhum no dia em que alguém mexe num
   modelo e se esquece de uma:
   · a função de retratação, «bem visível» e «permanentemente disponível» (art.
     11.º-A da Diretiva 2011/83, pela 2023/2673): em TODAS as páginas;
   · a ligação para o aviso harmonizado da garantia legal, no rodapé de todas;
   · em cada ficha: a mesma ligação, o fabricante com nome, morada e email
     (Reg. (UE) 2023/988, art. 19.º al. a)) e, se a peça se personaliza, o
     aviso de que perde os catorze dias (DL 24/2014, art. 4.º n.º 1 al. p));
   · no cesto: o aviso das personalizadas e a ligação para a garantia;
   · e esse aviso -- na ficha, no cesto e na linha dos candeeiros -- diz A
     CIRCUNSTÂNCIA em que o direito se perde (a al. p) pede-a): pode desistir
     «até começarmos a fazê-la». Um aviso que diga só «não têm os 14 dias»
     contradiz as condições e o email, que deixam desistir até lá;
   · a página do aviso com o ficheiro oficial na língua dela, o texto oficial no
     alt e as duas ligações; a da retratação com o formulário inteiro. */
{
  const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
  const identidade = JSON.parse(readFileSync(join(ROOT, 'content/settings/identity.json'), 'utf8'));
  const hash = existsSync(join(OUT, 'data', 'catalogue-current.txt'))
    ? readFileSync(join(OUT, 'data', 'catalogue-current.txt'), 'utf8').trim() : '';
  const catalogo = hash && existsSync(join(OUT, 'data', `catalogue.${hash}.json`))
    ? JSON.parse(readFileSync(join(OUT, 'data', `catalogue.${hash}.json`), 'utf8')) : { products: {} };
  const personaliza = (slug) => (catalogo.products[slug]?.options || []).some((o) => o.personalises);
  const ROTULOS_RETRATAR = ['Retrate-se do contrato aqui', 'Withdraw from contract here'];
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ligacao = (caminho) => new RegExp(`href="${esc(BASE)}(?:/[a-z]{2})?(?:/cathelier)?${esc(caminho)}"`);
  /* A circunstância, por língua. Uma língua nova sem ela pára aqui: é preciso
     dizer como se escreve «até começarmos a fazê-la» nessa língua. */
  const CIRCUNSTANCIA = { pt: /até começarmos a fazê-l[ao]s?\b/, en: /until we start making (?:it|them)\b/ };
  const semCircunstancia = (texto, lang) => {
    const re = CIRCUNSTANCIA[lang];
    if (!re) return `não sei conferir a circunstância em «${lang}» -- junte-a a CIRCUNSTANCIA em scripts/check-output.mjs`;
    return re.test(texto) ? '' : `«${texto.trim().slice(0, 90)}…» não diz até quando se pode desistir (DL 24/2014, art. 4.º n.º 1 al. p))`;
  };
  let fichas = 0;
  for (const f of pages) {
    const html = readFileSync(f, 'utf8');
    if (/<meta name="generator" content="redirect-stub">/.test(html)) continue;
    const onde = f.slice(OUT.length) || '/';
    const lang = (/<html lang="([a-z]{2})/.exec(html) ?? [])[1];
    const retratar = html.match(/class="foot__withdraw"><a href="([^"]*)">([^<]*)<\/a>/);
    if (!retratar) deaths.push(`${onde}: sem a ligação «retrate-se do contrato aqui» no rodapé (art. 11.º-A da Diretiva 2011/83)`);
    else {
      if (!ligacao('/legal/withdraw/').test(`href="${retratar[1]}"`)) deaths.push(`${onde}: a ligação de retratação vai para ${retratar[1]}`);
      if (!ROTULOS_RETRATAR.includes(retratar[2])) deaths.push(`${onde}: a ligação de retratação diz «${retratar[2]}», e a diretiva manda dizer «retrate-se do contrato aqui»`);
    }
    const rodape = html.slice(html.indexOf('<footer'));
    if (!ligacao('/legal/guarantee/').test(rodape)) deaths.push(`${onde}: o rodapé não tem a ligação para o aviso da garantia legal`);

    const ficha = onde.match(/\/(?:lamps|pieces)\/([^/]+)\/index\.html$/);
    if (ficha) {
      fichas++;
      const direitos = html.match(/class="product__rights"><a href="([^"]*)"/);
      if (!direitos || !ligacao('/legal/guarantee/').test(`href="${direitos[1]}"`)) deaths.push(`${onde}: a ficha não tem a ligação para o aviso da garantia legal`);
      const fab = html.match(/<p class="product__maker">([\s\S]*?)<\/p>/)?.[1] ?? '';
      for (const campo of ['legalName', 'street', 'postcode', 'town', 'email']) {
        if (!fab || !fab.includes(identidade[campo])) {
          deaths.push(`${onde}: o fabricante na ficha não tem «${campo}» de identity.json (Reg. (UE) 2023/988, art. 19.º al. a))`);
          break;
        }
      }
      if (personaliza(ficha[1]) && !/class="field__aviso"/.test(html)) {
        deaths.push(`${onde}: a peça personaliza-se e a ficha não avisa que perde os dias de livre resolução (DL 24/2014, art. 4.º n.º 1 al. p))`);
      }
      for (const [, texto] of html.matchAll(/<p class="field__aviso"[^>]*>([^<]*)<\/p>/g)) {
        const porque = semCircunstancia(texto, lang);
        if (porque) { deaths.push(`${onde}: o aviso das personalizadas ${porque}`); break; }
      }
      /* A linha dos candeeiros junto ao botão («14 dias de livre resolução,
         por lei…», «14-day legal right to cancel…»): é a mesma informação, e
         diz-se da mesma maneira. O número pode vir colado ao nome por um
         hífen, como no inglês. */
      const linha = html.match(/<span>[^<]*·\s*(\d+[ -][^<]*)<\/span>/)?.[1];
      if (/\/lamps\//.test(onde) && linha) {
        const porque = semCircunstancia(linha, lang);
        if (porque) deaths.push(`${onde}: a linha da garantia ${porque}`);
      } else if (/\/lamps\//.test(onde)) deaths.push(`${onde}: não encontrei a linha «garantia legal · dias para mudar de ideias»`);
    }
    if (/data-basket\b/.test(html) && /data-checkout-form/.test(html)) {
      if (!/data-basket-personal/.test(html)) deaths.push(`${onde}: o cesto não tem o aviso das peças personalizadas`);
      else {
        const texto = html.match(/<p class="basket__aviso" data-basket-personal[^>]*>([^<]*)<\/p>/)?.[1] ?? '';
        const porque = semCircunstancia(texto, lang);
        if (porque) deaths.push(`${onde}: o aviso das personalizadas no cesto ${porque}`);
      }
      if (!/class="small basket__direitos"><a href="[^"]*\/legal\/guarantee\/"/.test(html)) deaths.push(`${onde}: o cesto não tem a ligação para o aviso da garantia legal`);
    }
    if (/\/legal\/guarantee\/index\.html$/.test(onde)) {
      const img = html.match(/<img src="([^"]*\/assets\/legal\/aviso-garantia-legal-([a-z]{2})\.svg)"[^>]*alt="([^"]*)"/);
      if (!img) deaths.push(`${onde}: sem o aviso harmonizado oficial`);
      else {
        if (img[2] !== lang) deaths.push(`${onde}: a página é «${lang}» e o aviso é o de «${img[2]}»`);
        if (img[3].length < 1000) deaths.push(`${onde}: o alt do aviso tem ${img[3].length} caracteres — tem de ser o texto oficial inteiro`);
      }
      if (!/href="https:\/\/europa\.eu\/youreurope\/(?:garantias|guarantees)"/.test(html)) deaths.push(`${onde}: sem a ligação clicável para o portal A sua Europa`);
      if (!/href="[^"]*\/assets\/legal\/aviso-garantia-legal-[a-z]{2}\.pdf"/.test(html)) deaths.push(`${onde}: sem a ligação para o PDF oficial do aviso`);
    }
    if (/\/legal\/withdraw\/index\.html$/.test(onde)) {
      const form = html.match(/<form class="retratar" data-retratacao[\s\S]*?<\/form>/)?.[0] ?? '';
      for (const nome of ['nome', 'encomenda', 'email']) {
        if (!new RegExp(`name="${nome}"[^>]*required`).test(form)) deaths.push(`${onde}: o formulário de retratação não pede «${nome}»`);
      }
      if (!/<button class="btn" type="submit" data-retratacao-confirmar>(?:Confirmar retratação|Confirm withdrawal)<\/button>/.test(form)) {
        deaths.push(`${onde}: o botão da retratação não diz «confirmar retratação» (art. 11.º-A n.º 3 da Diretiva 2011/83)`);
      }
      /* O painel de sucesso tem um bloco para cada resposta do Worker, e o
         shop.js escolhe entre eles sem se queixar de um que falte: sem o da
         repetida, uma declaração repetida mostrava a hora da primeira como se
         fosse nova; sem o do email diferente, não dizia para onde foi o
         aviso; sem o da revenda, um revendedor lia os catorze dias do
         consumidor; e sem o de devolver com a marca, o shop.js não o
         conseguia esconder a um revendedor. */
      const ok = html.match(/<div class="retratar__ok" data-retratacao-ok[\s\S]*?<\/div>/)?.[0] ?? '';
      for (const bloco of ['nova', 'repetida', 'com-aviso', 'email-diferente', 'aviso-antigo', 'sem-aviso', 'repetida-sem-aviso', 'revenda', 'devolver']) {
        if (!new RegExp(`<p data-retratacao-${bloco}[ >]`).test(ok)) deaths.push(`${onde}: o painel da retratação não tem o bloco «${bloco}» que o shop.js mostra`);
      }
    }
  }
  if (!fichas) deaths.push('não encontrei nenhuma ficha de produto para conferir o fabricante e os avisos');
}

/* NADA DO QUE A DONA TIROU FICA NO AR.
   As versões web das fotografias juntas no painel não vão para o git: o CI
   gera-as e guarda-as numa cache entre publicações. Uma cache é memória, e
   memória devolve o que já não devia existir -- as versões de uma fotografia
   que a dona tirou continuavam em public/media e iam para o site, na mesma
   morada. scripts/renditions.py deita-as fora; isto confere que deitou. Uma
   versão sem original (photos/…) é uma fotografia que saiu. */
{
  const origem = (marca, pasta, nome) => join(ROOT, 'photos', marca, marca === 'cathelier' && pasta === 'pool' ? '_raw' : pasta, `${nome}.jpg`);
  const orfas = [];
  for (const base of [join(OUT, 'media'), join(OUT, 'media', 'whole')]) {
    for (const marca of ['ithos', 'cathelier']) {
      const raiz = join(base, marca);
      if (!existsSync(raiz)) continue;
      for (const pasta of readdirSync(raiz)) {
        if (!statSync(join(raiz, pasta)).isDirectory()) continue;
        for (const f of readdirSync(join(raiz, pasta))) {
          const nome = f.match(/^(.+)-\d+\.(?:avif|webp)$/)?.[1];
          if (nome && !existsSync(origem(marca, pasta, nome))) orfas.push(`${join(base, marca, pasta, f).slice(OUT.length + 1)}`);
        }
      }
    }
  }
  if (orfas.length) {
    deaths.push(`${orfas.length} rendition(s) of photographs that no longer exist would go live (${orfas.slice(0, 3).join(', ')}) — `
      + 'run python3 scripts/renditions.py, which removes them');
  }
}

for (const w of warnings) console.warn(`  warning: ${w}`);

if (deaths.length) {
  console.error(`\n${deaths.length} problem(s) in what was built:\n`);
  for (const d of deaths.slice(0, 40)) console.error(`  · ${d}`);
  if (deaths.length > 40) console.error(`  … and ${deaths.length - 40} more`);
  console.error('');
  process.exit(1);
}
/* Os stubs saem da contagem. "104 páginas" sobre uma loja de 94 é a forma
   exacta como um sinal de trânsito se faz passar por destino -- e uma
   verificação que CONTA nunca distingue os dois. */
console.log(`  output: ${pages.length - stubs.length} pages`
  + (stubs.length ? ` and ${stubs.length} redirect stubs` : '')
  + `, ${links} internal links and ${images} assets all resolve`);
console.log(`  ${titles.size} distinct titles, ${descriptions.size} distinct descriptions`
  + (PREVIEW_BUILD ? ` (checked across all pages: this is a preview build, so none is indexable)`
                   : ` across ${indexablePages} indexable pages`));
