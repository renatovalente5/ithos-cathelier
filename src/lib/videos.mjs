/* OS VÍDEOS DOS PRODUTOS, das duas marcas. O painel junta-os em
 * public/media/video/<marca>/<pasta do produto>/<nome>.mp4 (ou .webm), com a
 * capa <nome>.jpg ao lado, e o produto lista os nomes em `videos`. Aqui só se
 * aceitam nomes do painel: vão para um src. O guards.mjs confere os ficheiros. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NOME_VIDEO = /^v[a-z0-9]{4,40}\.(mp4|webm)$/;
export const videosDe = (p) => (Array.isArray(p.videos) ? p.videos.filter((n) => NOME_VIDEO.test(String(n))) : []);
export const enderecoDoVideo = (marca, p, n) => `/media/video/${marca}/${p.photoFolder}/${n}`;
export const capaDoVideo = (marca, p, n) => enderecoDoVideo(marca, p, n).replace(/\.(mp4|webm)$/, '.jpg');
/* O do cartão (o rato por cima): a cópia pequena que scripts/videos-cartao.mjs
   faz antes da construção, ou o vídeo inteiro se ela não estiver lá (sem
   ffmpeg, o site publica na mesma, só mais lento a começar). */
const PUBLICO = fileURLToPath(new URL('../../public', import.meta.url));
export const videoDoCartao = (marca, p, n) => {
  const copia = `/media/video-cartao/${marca}/${p.photoFolder}/${n.replace(/\.(mp4|webm)$/, '.mp4')}`;
  return existsSync(join(PUBLICO, copia)) ? copia : enderecoDoVideo(marca, p, n);
};
