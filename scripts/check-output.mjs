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
let frasePaga = null;

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
  if (frasePaga === null) {
    const m = /You can pay by ([^.<]+)\./.exec(html);
    if (m) frasePaga = m[1].trim();
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
  const NOME = {
    MB: 'Multibanco', MBWAY: 'MB WAY', PAYSHOP: 'Payshop',
    CCARD: 'card', GOOGLE: 'Google Pay', APPLE: 'Apple Pay',
  };
  const semNome = oferecidos.filter((m) => !NOME[m]);
  if (semNome.length) {
    deaths.push(`o cesto oferece ${semNome.join(', ')} e não há nome para pôr na frase dos termos`);
  }
  if (oferecidos.length && frasePaga === null) {
    deaths.push('o cesto oferece métodos de pagamento e os termos não têm a frase «You can pay by …» '
      + '— o artigo 7.º do DL 24/2014 obriga a indicá-los ao comprador');
  } else if (oferecidos.length) {
    const emFalta = oferecidos
      .filter((m) => NOME[m])
      .filter((m) => !frasePaga.toLowerCase().includes(NOME[m].toLowerCase()));
    if (emFalta.length) {
      deaths.push(`os termos dizem «You can pay by ${frasePaga}» mas o cesto também oferece `
        + `${emFalta.map((m) => NOME[m]).join(', ')} — acertar content/settings/shop.json`);
    }
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
