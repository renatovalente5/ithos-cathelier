/* OS SEPARADORES DA CATHELIER: QUAIS SE VÊEM, E PARA ONDE VAI QUEM PROCURA UM
 * QUE JÁ NÃO SE VÊ.
 *
 * Desde 27 set 2026 a dona cria, esconde e apaga separadores no painel. Três
 * coisas deixaram de ser verdade de uma vez, e é por isso que este ficheiro
 * existe -- o gerador, as guardas e o verificador fazem as mesmas perguntas e
 * têm de dar as mesmas respostas:
 *
 *   1. UM SEPARADOR PUBLICADO PODE ESTAR VAZIO. Um acabado de criar ainda não
 *      tem peças; o círculo dele na home levava à lista e esvaziava-a (o aviso
 *      está nas guardas). Não se mostra: um separador VÊ-SE quando está
 *      publicado E tem pelo menos uma peça à venda. Assim que a dona põe lá a
 *      primeira peça, aparece -- sem ela ter de voltar ao ecrã dos separadores.
 *
 *   2. UM SEPARADOR PODE DESAPARECER. Apagado, as peças dele foram para outro
 *      (a dona escolhe qual, no painel), e o painel regista a mudança em
 *      content/cathelier/_occasions-moved.json: { "moved": { "christmas":
 *      "names" } }. Quem tiver guardado /cathelier/christmas/ (um dos stubs de
 *      src/lib/redirects.mjs) ou partilhado /cathelier/pieces/#christmas vai
 *      parar a «Nomes», que é onde as peças estão. A cadeia segue-se: apagar
 *      depois «Nomes» para «Páscoa» leva as duas moradas à Páscoa. O mesmo
 *      ficheiro traz, em «removed», o que cada separador apagado era e de
 *      onde para onde foi cada peça: é do painel (para o repor com o mesmo
 *      endereço, e aí a mudança sai de «moved»), e o site não o lê.
 *
 *   3. UM SEPARADOR PODE ESTAR ESCONDIDO (o Natal fora de época). Não tem
 *      sucessor -- volta quando a dona o mostrar -- e quem procurar a morada
 *      dele vai parar à lista completa, onde as peças continuam à venda.
 *
 * O que NUNCA acontece é um reencaminhamento ou uma ligação a apontar para um
 * filtro que não existe: o check-output morre com isso, e uma publicação
 * parada por a dona ter escondido o Natal era um defeito deste código, não
 * dela. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** O ficheiro das mudanças, relativo a content/. */
export const MUDADAS = 'cathelier/_occasions-moved.json';

/** A forma de um endereço de separador: minúsculas, algarismos e hífenes, sem
 *  hífen nas pontas. «all» é o filtro «Todas» e não pode ser um separador. */
export const FORMA_DO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVADOS = new Set(['all']);

/** As peças à venda que cada separador tem (principal ou de passagem). */
export function pecasPorSeparador(pecas) {
  const n = new Map();
  for (const p of pecas ?? []) {
    if (!p?.published) continue;
    for (const s of new Set([p.occasion, ...(p.alsoIn ?? [])].filter(Boolean))) n.set(s, (n.get(s) ?? 0) + 1);
  }
  return n;
}

/** Os separadores que o site mostra, pela ordem: publicados e com peças. */
export function visiveis(ocasioes, pecas) {
  const n = pecasPorSeparador(pecas);
  return (ocasioes ?? []).filter((o) => o?.published && n.get(o.slug) > 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** O mapa das mudanças, lido do ficheiro (ou vazio). Só entram pares com
 *  forma de endereço: o que lá estiver de outra maneira não vai para o HTML. */
export function lerMudadas(obj) {
  const m = obj?.moved;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
  return Object.fromEntries(Object.entries(m).filter(([k, v]) => FORMA_DO_SLUG.test(k) && FORMA_DO_SLUG.test(String(v))));
}

/** Para onde leva hoje um separador: ele próprio, se se vê; senão o que ficou
 *  com as peças dele, seguindo a cadeia; null se a cadeia não acaba num que
 *  se veja (escondido, ou sem peças). Um separador que se vê ganha sempre a
 *  uma mudança com o mesmo nome. */
export function resolver(slug, vivas, mudadas = {}) {
  let s = slug;
  const vistos = new Set();
  while (s && !vivas.has(s)) {
    if (vistos.has(s) || !Object.hasOwn(mudadas, s)) return null;
    vistos.add(s);
    s = mudadas[s];
  }
  return s || null;
}

/** A morada para onde um reencaminhamento de redirects.mjs leva hoje. Um
 *  filtro que não se resolve cai, e fica a lista completa. */
export function destinoDe(to, vivas, mudadas) {
  const [morada, frag] = String(to).split('#');
  if (!frag) return to;
  const s = resolver(frag, vivas, mudadas);
  return s ? `${morada}#${s}` : morada;
}

/** As palavras de filtro antigas e a de hoje de cada uma, para o shop.js:
 *  as dos stubs (a palavra da morada antiga) e as dos separadores apagados.
 *  Uma palavra que é hoje um separador à vista fica de fora -- é ela própria. */
export function fragmentosAntigos(redirects, vivas, mudadas) {
  const pares = [
    ...redirects.map((r) => [r.from.split('/').filter(Boolean).pop(), r.to.split('#')[1]]),
    ...Object.entries(mudadas),
  ];
  const out = {};
  for (const [de, para] of pares) {
    if (!de || !para || vivas.has(de)) continue;
    const s = resolver(para, vivas, mudadas);
    if (s && s !== de) out[de] = s;
  }
  return out;
}

/** Tudo isto lido da pasta content/ de origem (os endereços e o «publicado»
 *  não mudam de língua para língua). */
export function lerSeparadores(CONTENT) {
  const ler = (p) => { const f = join(CONTENT, p); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
  const ocasioes = ler('cathelier/_occasions.json') ?? [];
  const dir = join(CONTENT, 'cathelier');
  const pecas = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      .map((f) => ({ ...JSON.parse(readFileSync(join(dir, f), 'utf8')), slug: f.replace(/\.json$/, '') }))
    : [];
  const mudadas = lerMudadas(ler(MUDADAS));
  const vivas = new Set(visiveis(ocasioes, pecas).map((o) => o.slug));
  return { ocasioes, pecas, mudadas, vivas };
}
