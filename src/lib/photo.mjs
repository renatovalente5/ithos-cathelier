/* The pixel size of a JPEG, read out of the file itself.
 *
 * The product gallery needs each photograph's shape to give its frame the
 * right box and its <img> the right intrinsic size. That could have come from
 * a generated manifest; it does not, on purpose. A manifest is a second source
 * of truth that goes stale the day somebody replaces a photograph and forgets
 * to re-run the script, and then it needs a guard of its own to police it.
 * The file already knows how big it is.
 *
 * Zero dependencies: CI has no Pillow, and adding one for twenty-five lines
 * would be the tail wagging the dog. Verified against Pillow on all 209 JPEGs
 * in photos/ -- 209 agree, 0 disagree.
 */
import { openSync, readSync, closeSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const cache = new Map();

/** @returns {{w:number,h:number}} */
export function shapeOf(file) {
  if (cache.has(file)) return cache.get(file);
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(2);
    readSync(fd, head, 0, 2, 0);
    if (head[0] !== 0xFF || head[1] !== 0xD8) throw new Error(`${file} is not a JPEG`);

    let at = 2;
    const seg = Buffer.alloc(9);
    for (;;) {
      readSync(fd, seg, 0, 4, at);
      if (seg[0] !== 0xFF) throw new Error(`${file}: lost the marker chain at byte ${at}`);
      const marker = seg[1];
      // Standalone markers carry no length: skip two bytes and go on.
      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { at += 2; continue; }
      const len = seg.readUInt16BE(2);
      /* Every start-of-frame carries the size, and there are more of them than
         the famous one: C0 baseline, C1 extended, C2 progressive, and C5..CF
         minus the four that are not frames (C4 Huffman, C8 reserved, CC
         arithmetic). Reading only C0 would work on these 209 files and break on
         the first progressive JPEG the owner exports from a phone. */
      const isFrame = (marker >= 0xC0 && marker <= 0xCF)
        && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
      if (isFrame) {
        readSync(fd, seg, 0, 9, at + 4);
        const shape = { h: seg.readUInt16BE(1), w: seg.readUInt16BE(3) };
        cache.set(file, shape);
        return shape;
      }
      at += 2 + len;
    }
  } finally {
    closeSync(fd);
  }
}

/** The rendition widths that exist for a master this wide.
 *  Never wider than the file: asking a browser to fetch a bigger file to see
 *  the same picture blurrier is the rule scripts/renditions.py already keeps. */
export const LADDER = [200, 400, 600, 1000];
export const ZOOM_W = 1400;
/** The WHOLE-photograph rungs for a master this wide. Must agree with
 *  scripts/renditions.py -- the two are the same ladder written twice, which is
 *  why they are both here in one place each and both say why. */
export function rungs(w) {
  const out = LADDER.filter((x) => x >= 400 && x <= w);
  // A master narrower than the smallest rung gets one rung at its own width.
  if (!out.length) return [w];
  if (w >= 1250) out.push(ZOOM_W);
  return out;
}

/* A FORMA DOS CARTÕES, para a proporção intrínseca que o <img> declara.
 *
 * O mesmo número vive em scripts/cards.py (que corta os masters) e em
 * src/styles/base.css (que desenha a caixa). scripts/guards.mjs compara os
 * três e mede os ficheiros no disco: se o HTML declarar uma altura que os
 * ficheiros não têm, o browser reserva a caixa errada e a grelha salta quando
 * as fotografias chegam -- que é pior do que não reservar nada. */
export const CARD_RATIO = [3, 4];   // largura, altura

/** A forma de um WebP simples (VP8 com perdas), lida do cabeçalho.
 *
 * Existe para as guardas poderem medir o que está PUBLICADO. Os masters dos
 * cartões são derivados e não entram no repositório, por isso em CI não há
 * nada em photos/_cards para medir -- mas public/media está versionado, e é
 * isso que o visitante recebe.
 *
 * Só VP8 com perdas, que é o que scripts/renditions.py escreve. Qualquer outra
 * variante ATIRA em vez de devolver um palpite: uma forma adivinhada seria um
 * ✓ sobre uma pergunta que não foi feita.
 */
export function webpShape(file) {
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(30);
    readSync(fd, head, 0, 30, 0);
    if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WEBP') {
      throw new Error(`${file} is not a WebP`);
    }
    const chunk = head.toString('ascii', 12, 16);
    if (chunk !== 'VP8 ') {
      throw new Error(`${file}: ${chunk.trim()} WebP, and this reader only knows lossy VP8`);
    }
    /* 12 chunk header + 3 frame tag + the 3-byte start code 9D 01 2A, then
       two 16-bit little-endian values whose top two bits are the scale. */
    if (!(head[23] === 0x9D && head[24] === 0x01 && head[25] === 0x2A)) {
      throw new Error(`${file}: no VP8 key-frame start code where one was expected`);
    }
    return {
      w: head.readUInt16LE(26) & 0x3FFF,
      h: head.readUInt16LE(28) & 0x3FFF,
    };
  } finally {
    closeSync(fd);
  }
}

/** A escada que a família dos cartões usa, e as que EXISTEM para uma foto.
 *
 * A página prometia [200, 400, 600, 1000] a toda a gente. Cinco fotografias do
 * estúdio são pequenas e scripts/renditions.py recusa-se, com razão, a escrever
 * uma rendition maior do que o master -- para a coruja (540px) o `-1000` nunca
 * chegou a existir, e o `srcset` apontava-lhe. Funcionava porque um ficheiro de
 * uma geração anterior ainda estava no disco; apagar a pasta e voltar a gerar
 * mostrou o buraco.
 *
 * Lê-se o DISCO e não os masters, porque photos/_cards é derivado e não entra
 * no repositório: em CI não existe, e public/media existe. */
export const CARD_WIDTHS = [200, 400, 600, 1000];

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function cardWidths(dir, name) {
  const tem = CARD_WIDTHS.filter((w) =>
    existsSync(join(RAIZ, 'public', 'media', dir, `${name}-${w}.webp`)));
  /* Nunca vazio: um srcset sem candidatos é uma imagem sem endereço nenhum, e
     é melhor prometer o degrau mais pequeno e falhar alto do que servir nada. */
  return tem.length ? tem : [CARD_WIDTHS[0]];
}

/* ONDE A FOTOGRAFIA FICA DENTRO DA MOLDURA DO CARTÃO.
 *
 * A ficha do produto mostra o ficheiro INTEIRO -- é o que a lupa abre e é o que
 * resolveu o Pai Natal decapitado -- mas a moldura é a do cartão, 3:4, para a
 * fotografia não mudar de forma entre a montra e a ficha. Com `object-fit:
 * cover` isso corta, e cortar pelo MEIO é o que este projecto já pagou para
 * deixar de fazer.
 *
 * Então devolve-se aqui o `object-position` que reproduz exactamente o corte
 * que scripts/cards.py faz ao master: mesma janela, mesmo foco. O ficheiro de
 * focos é o mesmo, escrito à mão, e não há segunda fonte de verdade.
 *
 * A aritmética: a janela visível, em pixels do original, é `larg / R` (ou
 * `alt * R` quando a fotografia é mais larga do que a moldura). cards.py
 * coloca-a com o topo em `foco*alt - janela/2`, preso às bordas. E uma
 * percentagem de object-position é a fracção do que TRANSBORDA que fica antes
 * da janela -- ou seja `topo / (alt - janela)`.
 */
const FOCOS = (() => {
  const f = join(RAIZ, 'photos', 'focus.json');
  try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; } catch { return {}; }
})();

export function cardFocus(key, shape) {
  const foco = typeof FOCOS[key] === 'number' ? FOCOS[key] : 0.5;
  const R = CARD_RATIO[0] / CARD_RATIO[1];
  const { w, h } = shape;
  const pct = (topo, sobra) => (sobra <= 0 ? 50 : Math.max(0, Math.min(100, (topo / sobra) * 100)));
  if (w / h <= R) {                       // mais alta do que a moldura: corta em altura
    const janela = Math.round(w / R);
    const sobra = h - janela;
    const topo = Math.max(0, Math.min(sobra, Math.round(foco * h - janela / 2)));
    return `50% ${pct(topo, sobra).toFixed(1)}%`;
  }
  const janela = Math.round(h * R);       // mais larga: corta nos lados
  const sobra = w - janela;
  const esq = Math.max(0, Math.min(sobra, Math.round(foco * w - janela / 2)));
  return `${pct(esq, sobra).toFixed(1)}% 50%`;
}
