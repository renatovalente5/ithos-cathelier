/* OS VÍDEOS DOS PRODUTOS, das duas marcas. O painel junta-os em
 * public/media/video/<marca>/<pasta do produto>/<nome>.mp4 (ou .webm), com a
 * capa <nome>.jpg ao lado, e o produto lista os nomes em `videos`. Aqui só se
 * aceitam nomes do painel: vão para um src. O guards.mjs confere os ficheiros. */
export const NOME_VIDEO = /^v[a-z0-9]{4,40}\.(mp4|webm)$/;
export const videosDe = (p) => (Array.isArray(p.videos) ? p.videos.filter((n) => NOME_VIDEO.test(String(n))) : []);
export const enderecoDoVideo = (marca, p, n) => `/media/video/${marca}/${p.photoFolder}/${n}`;
export const capaDoVideo = (marca, p, n) => enderecoDoVideo(marca, p, n).replace(/\.(mp4|webm)$/, '.jpg');
