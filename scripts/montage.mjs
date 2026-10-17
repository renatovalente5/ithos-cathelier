#!/usr/bin/env node
/* A MONTAGEM DOS FILMES DE CAPA.
 *
 *     node scripts/montage.mjs ithos-capa
 *     bash scripts/film.sh ithos-capa
 *
 * O primeiro filme da capa era um só plano de telemóvel, tocado para a frente e
 * para trás (o film.sh explica porquê). Os vídeos da fotógrafa são outra coisa:
 * dezenas de planos curtos de estúdio, cada um com um candeeiro ou uma peça, e
 * a capa pode mostrar cinco em vez de um. Este script junta-os segundo
 * scripts/filmes.json e escreve dois masters em _materiais-ithos-cathelier/filmes/:
 *
 *   <nome>.mp4       o largo, 1920x1080, para o computador
 *   <nome>-tall.mp4  o alto, 720x1080 (2:3), para o telemóvel
 *
 * DOIS MASTERS E NÃO UM RECORTADO. Um terço dos planos foi filmado com a câmara
 * deitada (de pé, mas gravado ao alto sem dizer ao ficheiro que está rodado).
 * Esses são os planos certos para um ecrã ao alto, inteiros e sem recorte; os
 * deitados servem o computador. Recortar o largo para o telemóvel deitava fora
 * dois terços de cada plano, e os candeeiros ficam muitas vezes perto da borda.
 * Um plano largo também pode entrar no alto como recorte 2:3 (`focus`).
 *
 * O CICLO NÃO TEM EMENDA. Um filme de fundo repete-se enquanto a pessoa está
 * na página, e o salto do fim para o princípio vê-se mais do que qualquer outro
 * momento. Por isso o último plano dissolve-se outra vez no primeiro, e o
 * ficheiro começa e acaba no mesmo ponto desse primeiro plano: o último
 * fotograma e o primeiro são vizinhos. Tocar ao contrário, como no filme
 * antigo, não serve aqui -- uma dissolvência ao contrário vê-se.
 *
 * A COR. Os planos de estúdio são claros (brilho médio 110 a 154) e a capa
 * põe-lhes por cima o véu castanho a 58% de que o texto precisa: madeira clara
 * sobre kraft fica um castanho baço. `cor` na receita (um filtro eq do ffmpeg)
 * dá-lhes o contraste e a saturação que o véu come. Escolhido sobre o
 * composto simulado com o véu, e não sobre o plano solto.
 *
 * O master leva `comment=seamless-loop` nos metadados, e é por aí que o
 * film.sh sabe que não o deve tocar para a frente e para trás.
 */
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MATERIAIS = join(RAIZ, '..', '_materiais-ithos-cathelier');
const SAIDA = join(MATERIAIS, 'filmes');
const FPS = 25;

const nome = process.argv[2];
const receitas = JSON.parse(readFileSync(join(RAIZ, 'scripts', 'filmes.json'), 'utf8'));
const r = receitas[nome];
if (!nome || !r || nome.startsWith('_')) {
  console.error(`uso: node scripts/montage.mjs <nome>   (${Object.keys(receitas).filter((k) => !k.startsWith('_')).join(', ')})`);
  process.exit(1);
}
mkdirSync(SAIDA, { recursive: true });

const D = r.segundos;
const F = r.fundido;
if (!(D > 2 * F)) throw new Error(`${nome}: cada plano tem de durar mais do que duas dissolvências`);

/* Cada forma, o filtro que leva um plano até ela. */
function forma(plano, alto) {
  if (!alto) return 'scale=1920:1080:flags=lanczos,setsar=1';
  if (plano.rodar === 'esquerda') {
    // 1080x1920 depois de rodar; 2:3 da altura do meio, e 720 de largura.
    return 'transpose=2,crop=1080:1620:0:(ih-1620)/2,scale=720:1080:flags=lanczos,setsar=1';
  }
  const focus = plano.focus ?? 0.5;
  return `crop=720:1080:max(0\\,min(iw-720\\,iw*${focus}-360)):0,setsar=1`;
}

function montar(planos, alto, destino) {
  for (const p of planos) {
    const f = join(MATERIAIS, p.clip);
    if (!existsSync(f)) throw new Error(`falta ${p.clip}`);
  }
  const lista = [...planos, planos[0]];               // o primeiro outra vez, para fechar o ciclo
  const args = ['-v', 'error', '-y'];
  lista.forEach((p, i) => {
    const dur = i === planos.length ? F + 0.2 : D;
    args.push('-ss', String(p.de), '-t', String(dur), '-i', join(MATERIAIS, p.clip));
  });
  const partes = lista.map((p, i) =>
    `[${i}:v]${forma(p, alto)}${r.cor ? ',' + r.cor : ''},fps=${FPS},format=yuv420p,setpts=PTS-STARTPTS[v${i}]`);
  let atual = 'v0';
  for (let k = 1; k < lista.length; k++) {
    const saida = k === lista.length - 1 ? 'fim' : `x${k}`;
    partes.push(`[${atual}][v${k}]xfade=transition=fade:duration=${F}:offset=${(k * (D - F)).toFixed(3)}[${saida}]`);
    atual = saida;
  }
  // Começa em F (o primeiro plano já sem dissolvência) e acaba um fotograma
  // antes do mesmo ponto na cópia: o fim e o princípio são vizinhos.
  const n = planos.length;
  const fimT = n * (D - F) + F - 1 / FPS;
  partes.push(`[fim]trim=start=${F}:end=${fimT.toFixed(3)},setpts=PTS-STARTPTS[v]`);
  args.push('-filter_complex', partes.join(';'), '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
    '-metadata', 'comment=seamless-loop', '-movflags', '+faststart', destino);
  const c = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (c.status !== 0) throw new Error(`ffmpeg falhou em ${destino}`);
  const info = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height:format=duration', '-of', 'csv=p=0', destino], { encoding: 'utf8' }).stdout.trim().replace(/\n/g, ' ');
  console.log(`  ${destino.replace(MATERIAIS + '/', '')}  ${info}`);
}

console.log(`${nome}: ${r.largo.length} planos largos, ${r.alto.length} altos, ${D}s cada, dissolvência ${F}s`);
montar(r.largo, false, join(SAIDA, `${nome}.mp4`));
montar(r.alto, true, join(SAIDA, `${nome}-tall.mp4`));
console.log(`agora:  bash scripts/film.sh ${nome}`);
