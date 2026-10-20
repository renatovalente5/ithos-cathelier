#!/usr/bin/env node
/* O VÍDEO DO CARTÃO: uma cópia pequena de cada vídeo, só para o rato por cima
 * do cartão (shop.js, videosDosCartoes).
 *
 *     node scripts/videos-cartao.mjs            faz as que faltam, tira as que sobram
 *     node scripts/videos-cartao.mjs --falta    só diz quantas faltam (o CI instala o ffmpeg se for preciso)
 *
 * Os vídeos que a dona junta no painel têm 6 a 13 MB (720×1280, 60 imagens
 * por segundo, meio minuto). O cartão mostra-os a uns 280 px de largura e
 * durante os segundos em que o rato lá está: pedido inteiro, o vídeo chegava
 * aos bocados e começava tarde, e com os dos cartões à vista a carregar ao
 * mesmo tempo, mais tarde ainda (a dona, 20 out 2026: «está a demorar mais
 * tempo do que antes, não é instantâneo»). Aqui sai de cada um uma cópia com
 * os primeiros 8 segundos, recortada a 3:4 (o que o cartão mostra), a 540 px,
 * sem som: uns 300 KB, que chegam antes de o rato lá chegar.
 *
 * public/media/video/<marca>/<pasta>/<nome>.mp4|webm
 *   → public/media/video-cartao/<marca>/<pasta>/<nome>.mp4
 *
 * As cópias não vão para o git (.gitignore): o CI fá-las e guarda-as numa
 * cache entre corridas, como as versões web das fotografias do painel. Assim
 * um vídeo tirado no painel leva a cópia com ele, sem o Worker saber dela. A
 * construção usa a cópia quando existe, e o vídeo inteiro quando não
 * (src/lib/videos.mjs): sem ffmpeg o site publica na mesma. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const ORIGEM = join(RAIZ, 'public/media/video');
const DESTINO = join(RAIZ, 'public/media/video-cartao');
const NOME = /^v[a-z0-9]{4,40}\.(mp4|webm)$/;

const ficheiros = (pasta) => (existsSync(pasta)
  ? readdirSync(pasta, { recursive: true }).map((r) => join(pasta, String(r))).filter((f) => statSync(f).isFile())
  : []);
const copiaDe = (f) => join(DESTINO, relative(ORIGEM, f)).replace(/\.(mp4|webm)$/, '.mp4');

const videos = ficheiros(ORIGEM).filter((f) => NOME.test(f.split('/').pop()));
const faltam = videos.filter((f) => !existsSync(copiaDe(f)));

if (process.argv.includes('--falta')) {
  console.log(faltam.length);
  process.exit(0);
}

/* As que sobram: o vídeo saiu (tirado no painel, ou o produto apagado). */
const queFicam = new Set(videos.map(copiaDe));
let tiradas = 0;
for (const f of ficheiros(DESTINO)) if (!queFicam.has(f)) { rmSync(f); tiradas++; }

let feitas = 0;
let falhadas = 0;
for (const f of faltam) {
  const saida = copiaDe(f);
  mkdirSync(dirname(saida), { recursive: true });
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-t', '8', '-an',
      '-vf', "crop='min(iw,ih*3/4)':'min(ih,iw*4/3)',scale=540:-2,fps=30",
      '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', saida], { stdio: ['ignore', 'ignore', 'pipe'] });
    feitas++;
  } catch (e) {
    rmSync(saida, { force: true });
    falhadas++;
    console.log(`  sem cópia para o cartão: ${relative(RAIZ, f)} (${String(e.code === 'ENOENT' ? 'não há ffmpeg' : e.stderr ?? e.message).trim().split('\n')[0]}); o cartão usa o vídeo inteiro`);
  }
}
console.log(`${videos.length} vídeos: ${feitas} cópias para os cartões feitas, ${videos.length - faltam.length} já estavam, ${tiradas} tiradas${falhadas ? `, ${falhadas} por fazer` : ''}`);
