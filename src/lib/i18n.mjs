/* AS LÍNGUAS DO SITE.
 *
 * A dona escreve em português, e é o português a língua de ORIGEM: o conteúdo
 * em content/ está nela, e as outras línguas são traduções guardadas em
 * content/i18n/<língua>/ (o conteúdo) e src/i18n/<língua>/ (as frases do
 * código). As traduções automáticas são feitas pelo Worker (ver
 * ithos-cathelier-api, src/traducoes.js); o site só as lê.
 *
 * A língua de origem vive na raiz (/lamps/fox/); cada outra num prefixo
 * (/en/lamps/fox/). Acrescentar uma língua é juntá-la a LINGUAS -- o resto
 * (páginas, hreflang, sitemap, seletor) sai daqui.
 *
 * O gerador corre UMA língua de cada vez, síncrono: `definirLingua()` diz qual,
 * e `t()` lê o dicionário dessa. Assim os modelos das páginas não levam a
 * língua como argumento em todas as funções. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A primeira é a de origem. As outras aparecem no site pela ordem daqui. */
export const LINGUAS_TODAS = ['pt', 'en', 'fr', 'de', 'es', 'it'];
export const ORIGEM = 'pt';
/* As que estão no ar: as de content/settings/languages.json («site»), que é
   também de onde o Worker lê para quais traduz. `LINGUAS` no ambiente
   sobrepõe-se (para ensaiar: `LINGUAS=pt node src/build.mjs`). */
function linguasPublicadas() {
  if (process.env.LINGUAS) return process.env.LINGUAS.split(',');
  try {
    const j = JSON.parse(readFileSync(join(RAIZ, 'content', 'settings', 'languages.json'), 'utf8'));
    if (Array.isArray(j.site) && j.site.length) return j.site;
  } catch { /* sem o ficheiro: só a origem */ }
  return [ORIGEM];
}
export const LINGUAS = linguasPublicadas().map((s) => String(s).trim()).filter((l) => LINGUAS_TODAS.includes(l));

export const NOMES = { pt: 'Português', en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español', it: 'Italiano' };
/* O atributo lang e o og:locale de cada uma. */
export const LOCALE = { pt: 'pt-PT', en: 'en', fr: 'fr', de: 'de', es: 'es', it: 'it' };
export const OG_LOCALE = { pt: 'pt_PT', en: 'en_GB', fr: 'fr_FR', de: 'de_DE', es: 'es_ES', it: 'it_IT' };

let actual = LINGUAS[0] ?? ORIGEM;
export function definirLingua(l) { actual = l; }
export const lingua = () => actual;
/** A língua que vive na raiz: a primeira das activas (em produção, o português). */
export const linguaDaRaiz = () => LINGUAS[0];

/* O prefixo das moradas numa língua: '' na raiz, '/en' nas outras. */
export const prefixoDe = (l = actual) => (l === linguaDaRaiz() ? '' : `/${l}`);
/** A morada de uma página numa língua. `morada('/lamps/', 'en')` → '/en/lamps/'. */
export const morada = (caminho, l = actual) => `${prefixoDe(l)}${caminho}`;

/* --- os dicionários do código ------------------------------------------------ */
const dicionarios = {};
function carregar(l) {
  if (dicionarios[l]) return dicionarios[l];
  const pasta = join(RAIZ, 'src', 'i18n', l);
  const d = {};
  if (existsSync(pasta)) {
    for (const f of readdirSync(pasta).filter((x) => x.endsWith('.json')).sort()) {
      const modulo = f.replace(/\.json$/, '');
      const j = JSON.parse(readFileSync(join(pasta, f), 'utf8'));
      for (const [k, v] of Object.entries(j)) {
        if (k.startsWith('_')) continue;
        d[`${modulo}.${k}`] = typeof v === 'object' && v !== null ? v.t : v;
      }
    }
  }
  dicionarios[l] = d;
  return d;
}

/**
 * Uma frase do código, na língua actual. `{nome}` é trocado por vars.nome.
 * Sem tradução nessa língua, usa a de origem (e as guardas avisam); sem
 * nenhuma, REBENTA: uma chave que não existe é um erro do programador, e
 * publicar «ithos.adicionar» num botão não é uma opção.
 */
export function t(chave, vars) {
  const d = carregar(actual);
  let s = d[chave];
  if (s === undefined) s = carregar(ORIGEM)[chave];
  if (s === undefined) {
    for (const l of LINGUAS) { s = carregar(l)[chave]; if (s !== undefined) break; }
  }
  if (s === undefined) throw new Error(`i18n: não há a frase «${chave}» em nenhuma língua`);
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Singular e plural: `tn('ithos.lampadas', n)` lê `ithos.lampadas.um` ou `.varios`. */
export const tn = (chave, n, vars = {}) => t(`${chave}.${n === 1 ? 'um' : 'varios'}`, { n, ...vars });

/** Todas as chaves de uma língua (para as guardas). */
export const chavesDe = (l) => Object.keys(carregar(l));
