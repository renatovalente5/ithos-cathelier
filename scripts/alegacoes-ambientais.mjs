/* AS ALEGAÇÕES AMBIENTAIS GENÉRICAS, e as poucas palavras que parecem uma e
 * não são.
 *
 * Desde 27 set 2026 (Diretiva (UE) 2024/825, que acrescenta os pontos 2-A e
 * 4-A ao anexo I da Diretiva 2005/29) é prática comercial desleal EM QUAISQUER
 * CIRCUNSTÂNCIAS fazer uma alegação ambiental genérica sem «excelente
 * desempenho ambiental reconhecido» (o rótulo ecológico da UE, ou um sistema
 * EN ISO 14024) -- «amigo do ambiente», «ecológico», «verde», «biodegradável»
 * são os exemplos do considerando 9. Portugal ainda não transpôs a diretiva,
 * mas o artigo 7.º do DL 57/2008 (ações enganosas) já se lê à luz dela.
 *
 * A loja não tem certificação nenhuma. Por isso a regra é simples: estas
 * palavras não chegam a uma página publicada. Quem precisar de uma delas por
 * uma razão que não seja uma alegação -- «verde» como a cor de um candeeiro --
 * junta a FRASE EXACTA a EXCECOES, com o porquê. Uma excepção é uma frase e não
 * uma palavra: «verde» sozinho continua proibido, «em verde» (a cor do
 * dinossauro) não.
 *
 * Quem usa isto é scripts/check-output.mjs, que o corre sobre o texto VISÍVEL
 * das páginas construídas (o texto, os alt, os title, os aria-label, as
 * descrições) e sobre as frases que o shop.js escreve no ecrã. Antes de olhar
 * para o site, corre os casos de TESTE abaixo: uma guarda que deixou de apanhar
 * «ecológico» ou que passou a acusar «em verde» morre antes de dizer «tudo
 * limpo». */

/* Uma palavra que conhece acentos: o `\b` do JavaScript é ASCII, e para ele o
   «é» de «sustentável» não é letra -- via ali fronteiras que não existem. */
const L = '\\p{L}\\p{N}_';
const palavra = (corpo) => new RegExp(`(?<![${L}])(?:${corpo})(?![${L}])`, 'giu');

export const PROIBIDAS = [
  /* português */
  ['sustentável', palavra('(?:eco)?sustent[aá]ve(?:l|is)|sustentabilidade|sustentavelmente')],
  ['ecológico', palavra('ecol[oó]gic[oa]s?|ecologicamente')],
  ['amigo do ambiente', palavra('amig[oa]s? d[oa] (?:ambiente|natureza|planeta|clima)|respeitador[ae]?s? do ambiente|(?:que )?respeita o ambiente|ambientalmente (?:respons[aá]ve(?:l|is)|correct[oa]s?|corret[oa]s?|consciente)')],
  ['verde', palavra('verdes?')],
  ['biodegradável', palavra('biodegrad[aá]ve(?:l|is)|compost[aá]ve(?:l|is)')],
  ['neutro em carbono', palavra('neutr[oa]s? em (?:carbono|co2|emiss[oõ]es)|carbono neutro|neutralidade carb[oó]nica|pegada (?:de carbono|ecol[oó]gica)|emiss[oõ]es compensadas|carbono compensado|impacto (?:ambiental )?(?:zero|positivo|neutro)')],
  ['eco-', palavra('eco(?:-[\\p{L}]+)?|eco[- ]?friendly|ecodesign')],
  ['gestão responsável', palavra('gest[aã]o respons[aá]vel|florestas? respons[aá]ve(?:l|is)|(?:de )?origem respons[aá]vel|(?:compra|consumo|escolha)s? conscientes?')],
  ['natural', palavra('(?:100 ?%|totalmente|puramente|completamente) natura(?:l|is)')],
  ['reciclável', palavra('recicl[aá]ve(?:l|is)|reciclad[oa]s?')],
  ['desperdício zero', palavra('(?:zero|sem) desperd[ií]cio|desperd[ií]cio zero|(?:sem|livre de) pl[aá]stico')],
  /* inglês */
  ['sustainable', palavra('sustainabl[ey]|sustainability')],
  ['eco-friendly', palavra('eco[- ]?(?:friendly|conscious|logical|logically)|ecological(?:ly)?|environment(?:ally)?[- ](?:friendly|conscious|responsible|sound)|(?:planet|earth|nature|climate)[- ]friendly|kind to the (?:planet|earth|environment)|good for the (?:planet|earth|environment)')],
  ['green', palavra('green(?:er|est)?')],
  ['biodegradable', palavra('biodegradable|compostable')],
  ['carbon neutral', palavra('(?:carbon|climate)[- ](?:neutral|positive|negative)|net[- ]zero|carbon footprint|carbon[- ]offset(?:s|ting)?')],
  ['responsibly sourced', palavra('responsibly (?:sourced|made|managed)|responsible forest(?:s|ry)?|conscious (?:choice|consumption|shopping)')],
  ['all-natural', palavra('(?:100 ?%|all|totally|purely)[- ]natural')],
  ['recyclable', palavra('recyclable|recycled')],
  ['zero waste', palavra('zero[- ]waste|plastic[- ]free')],
];

/* AS EXCEPÇÕES SÃO FRASES, uma a uma, cada uma com o porquê. Uma frase aqui
   é tirada do texto antes de se procurar -- e só ela. */
export const EXCECOES = [
  /* A cor do dinossauro das placas (content/ithos/dinosaur.json, e a
     tradução): «…e o das placas, em verde.» É uma cor, não uma alegação. */
  ['em verde', /(?<![\p{L}\p{N}_])em verde(?![\p{L}\p{N}_])/giu],
  ['in green', /(?<![\p{L}\p{N}_])in green(?![\p{L}\p{N}_])/giu],
  /* Um país, se um dia a loja enviar para lá. */
  ['Cabo Verde', /(?<![\p{L}\p{N}_])Cabo Verde(?![\p{L}\p{N}_])/gu],
  /* Nomes de cor compostos, se um dia uma variante os usar. */
  ['verde-X (cor)', /(?<![\p{L}\p{N}_])verde-(?:escuro|claro|água|agua|menta|seco|oliva|tropa)(?![\p{L}\p{N}_])/giu],
  ['X green (cor)', /(?<![\p{L}\p{N}_])(?:dark|light|mint|sage|olive|bottle) green(?![\p{L}\p{N}_])/giu],
];

/** As alegações proibidas num texto: [{ palavra, trecho }]. */
export function procurarAlegacoes(texto) {
  const original = String(texto ?? '');
  /* A excepção troca-se por espaços do MESMO comprimento, para as posições
     continuarem a ser as do texto original e o trecho mostrado ser o dele. */
  let limpo = original;
  for (const [, re] of EXCECOES) limpo = limpo.replace(re, (m) => ' '.repeat(m.length));
  const achados = [];
  for (const [nome, re] of PROIBIDAS) {
    re.lastIndex = 0;
    for (const m of limpo.matchAll(re)) {
      const i = m.index;
      achados.push({ palavra: nome, trecho: original.slice(Math.max(0, i - 40), i + m[0].length + 30).replace(/\s+/g, ' ').trim() });
    }
  }
  return achados;
}

/* OS CASOS DE TESTE da própria guarda: o que TEM de apanhar e o que NÃO pode
   acusar. Os segundos incluem as frases reais do site que roçam a lista. */
export const TESTE = {
  apanha: [
    'Madeira ecológica, pintada à mão',
    'Tintas amigas do ambiente',
    'Um candeeiro sustentável para o quarto',
    'Embalagem 100% biodegradável',
    'Oficina neutra em carbono',
    'Feito de forma responsável, com gestão responsável da floresta',
    'A escolha verde para o quarto do bebé',
    'Um eco-candeeiro',
    'An eco-friendly night light',
    'Sustainable pine from responsible forests',
    'The green choice for a nursery',
    'Carbon-neutral shipping',
    'Environmentally friendly paints',
    'Made from recycled wood',
  ],
  passa: [
    'Há o de pescoço comprido, em azul-escuro salpicado de luz, e o das placas, em verde.',
    'There is the long-necked one in deep blue, speckled with light, and the plated one in green.',
    'Natureza',
    'Nature',
    'É responsável pela perda de valor causada por um manuseamento além do necessário.',
    'Quem é responsável',
    'Pinho maciço e tintas de base aquosa',
    'Solid pine and water-based paints',
    'A madeira clareia num quarto com muita luz, e aquece com isso.',
    'Um candeeiro natural? Não: pinho maciço, cortado e pintado.',
    'Secondhand goods, economy, second-hand',
  ],
};

/** Os casos de TESTE que falham, em texto: [] quando a guarda está boa. */
export function autoTeste() {
  const falhas = [];
  for (const f of TESTE.apanha) if (!procurarAlegacoes(f).length) falhas.push(`não apanha «${f}»`);
  for (const f of TESTE.passa) {
    const a = procurarAlegacoes(f);
    if (a.length) falhas.push(`acusa «${f}» (${a.map((x) => x.palavra).join(', ')})`);
  }
  return falhas;
}
