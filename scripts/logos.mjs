#!/usr/bin/env node
/**
 * Os logótipos em PNG para os cartões de partilha (scripts/share.py).
 *
 * O Pillow não lê SVG, e os cartões fazem-se com o Pillow porque é o único
 * motor de imagem que o CI tem (as fichas que a dona junta no painel precisam
 * do cartão delas feito lá). Por isso a obra-de-arte da cliente passa a PNG
 * AQUI, num browser, e o PNG vai para o git.
 *
 * O que isto faz e o que NÃO faz:
 * · desenha os SVG verdadeiros de assets/brand/ tal como estão -- sem tocar num
 *   caminho nem numa cor. Abertos como <img>, os `var(--ithos-tinta, #231F20)`
 *   do ithos-wordmark.svg caem no valor de recurso, que é a cor da marca;
 * · deixa uma margem transparente à volta (a tinta toca nas bordas do viewBox,
 *   e um pixel de antialias cortado é um pixel da letra a menos) -- o share.py
 *   corta pela tinta, não pela caixa;
 * · confere as cores no fim: cada pixel opaco tem de ser uma das tintas que o
 *   SVG declara. Uma cor que lá não está é um motor a inventar, e pára;
 * · escreve dentro do PNG (um bloco tEXt, «svg-sha256») o resumo do SVG de onde
 *   saiu. O share.py passa-o para dentro de cada cartão, e scripts/guards.mjs
 *   compara-o com o SVG de hoje: um logótipo trocado em assets/brand/ sem
 *   voltar a correr isto e o share.py pára a publicação, em vez de ir para o
 *   WhatsApp o desenho antigo.
 *
 * Só se volta a correr quando um logótipo mudar:
 *     node scripts/logos.mjs
 * Precisa do Playwright com o Chromium instalado. Este repositório não tem
 * dependências; aponte-se para uma instalação que exista:
 *     PLAYWRIGHT=/caminho/para/node_modules/playwright node scripts/logos.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scripts', 'share');

/* A altura do desenho. Os cartões usam no máximo uns 400 px de altura de
   logótipo; o dobro dá folga para reduzir sem nunca ampliar. */
const ALTURA = 800;
const MARGEM = 16;

/* Os dois que os cartões usam. O ithos é o do cabeçalho, SEM «handmade in
   Portugal» -- foi o que a dona pediu (ithos.svg tem a legenda e não serve). */
const LOGOS = ['ithos-wordmark', 'cathelier'];

/** O resumo que identifica um SVG (o mesmo que scripts/guards.mjs calcula). */
export const resumoDoSvg = (svg) => createHash('sha256').update(svg).digest('hex').slice(0, 16);

/** Um bloco tEXt metido logo a seguir ao IHDR (8 de assinatura + 25 do IHDR):
 *  antes dos dados da imagem, onde qualquer leitor o encontra sem a descodificar. */
function comTexto(png, chave, valor) {
  const dados = Buffer.from(`${chave}\0${valor}`, 'latin1');
  const tipo = Buffer.from('tEXt', 'latin1');
  const bloco = Buffer.alloc(12 + dados.length);
  bloco.writeUInt32BE(dados.length, 0);
  tipo.copy(bloco, 4);
  dados.copy(bloco, 8);
  bloco.writeUInt32BE(crc32(Buffer.concat([tipo, dados])) >>> 0, 8 + dados.length);
  if (png.toString('latin1', 12, 16) !== 'IHDR') throw new Error('o PNG não começa pelo IHDR');
  return Buffer.concat([png.subarray(0, 33), bloco, png.subarray(33)]);
}

async function playwright() {
  const tentativas = [process.env.PLAYWRIGHT, 'playwright',
    join(homedir(), 'Websites/carimbo/node_modules/playwright')].filter(Boolean);
  for (const t of tentativas) {
    try {
      const m = await import(t.startsWith('/') ? pathToFileURL(join(t, 'index.mjs')).href : t);
      return m.chromium ? m : m.default;
    } catch { /* a seguinte */ }
  }
  throw new Error('Playwright não encontrado. PLAYWRIGHT=/caminho/para/node_modules/playwright node scripts/logos.mjs');
}

/* As cores que o próprio SVG declara, em hexadecimal. Aceita #RRGGBB, o valor
   de recurso de um var() e o rgb(…%) que o exportador escreveu. */
function tintasDe(svg) {
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const out = new Set();
  for (const m of svg.matchAll(/#([0-9a-f]{6})\b/gi)) out.add(`#${m[1].toUpperCase()}`);
  for (const m of svg.matchAll(/rgb\(\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/g)) {
    out.add(hex(m[1] * 2.55, m[2] * 2.55, m[3] * 2.55));
  }
  return [...out];
}

const { chromium } = await playwright();
const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
try {
  for (const nome of LOGOS) {
    const svg = readFileSync(join(ROOT, 'assets', 'brand', `${nome}.svg`), 'utf8');
    const vb = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
    const h = ALTURA;
    const w = Math.round(h * vb[2] / vb[3]);
    const page = await browser.newPage({ viewport: { width: w + 2 * MARGEM, height: h + 2 * MARGEM }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
      <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"
           style="display:block;margin:${MARGEM}px;width:${w}px;height:${h}px"></body></html>`);
    await page.waitForFunction(() => { const i = document.images[0]; return i.complete && i.naturalWidth > 0; });

    /* A conferência das cores, no mesmo browser: lê os pixels do PNG que vai
       ser gravado e procura, para cada pixel quase opaco, a tinta declarada
       mais próxima. Longe de todas (mais de 6 níveis num canal) é um motor a
       inventar uma cor -- ou um var() que não caiu no recurso e ficou preto. */
    const png = await page.screenshot({ omitBackground: true, type: 'png' });
    const tintas = tintasDe(svg);
    const relatorio = await page.evaluate(async ({ b64, tintas }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const rgb = tintas.map((t) => [1, 3, 5].map((i) => parseInt(t.slice(i, i + 2), 16)));
      const contas = tintas.map(() => 0);
      let fora = 0; let opacos = 0; const exemplo = [];
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 250) continue;
        opacos++;
        let melhor = -1; let dist = 1e9;
        rgb.forEach((t, k) => {
          const m = Math.max(Math.abs(t[0] - d[i]), Math.abs(t[1] - d[i + 1]), Math.abs(t[2] - d[i + 2]));
          if (m < dist) { dist = m; melhor = k; }
        });
        if (dist > 6) { fora++; if (exemplo.length < 3) exemplo.push([d[i], d[i + 1], d[i + 2]]); } else contas[melhor]++;
      }
      return { opacos, fora, exemplo, contas };
    }, { b64: png.toString('base64'), tintas });
    await page.close();

    if (!relatorio.opacos) throw new Error(`${nome}: o desenho saiu vazio`);
    if (relatorio.fora) {
      throw new Error(`${nome}: ${relatorio.fora} pixels opacos numa cor que o SVG não declara `
        + `(${relatorio.exemplo.map((p) => `rgb(${p})`).join(', ')}) — não se grava um logótipo recolorido`);
    }
    const dest = join(OUT, `${nome}.png`);
    writeFileSync(dest, comTexto(png, 'svg-sha256', resumoDoSvg(svg)));
    const partes = tintas.map((t, k) => `${t} ${(100 * relatorio.contas[k] / relatorio.opacos).toFixed(0)}%`).join(', ');
    console.log(`scripts/share/${nome}.png: ${w + 2 * MARGEM}x${h + 2 * MARGEM}, ${Math.round(png.length / 1024)} KB — ${partes}`);
  }
} finally {
  await browser.close();
}
