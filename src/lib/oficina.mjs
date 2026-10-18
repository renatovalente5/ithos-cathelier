/* AS FOTOGRAFIAS DA DONA: a do bloco «Olá» da página inicial da ithos e a da
 * página Sobre. Vivem em photos/ithos/oficina, fora de qualquer peça, e
 * passam pelos mesmos cards.py e renditions.py.
 *
 * Quais são diz-o content/settings/oficina.json, que o painel escreve (Loja →
 * As tuas fotografias): photos[0] é a da página inicial, photos[1] a da
 * página Sobre. A forma é a de um produto (photoFolder + photos) de
 * propósito: é a lista que o Worker lê para saber que uma fotografia nova tem
 * dono, e que uma tirada já não é usada (src/admin/fotos.js da API).
 * O guards.mjs confere que o ficheiro existe e que as duas fotografias estão
 * lá; aqui, um nome que não seja de ficheiro volta ao de origem. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOME = /^[A-Za-z0-9._-]{1,80}$/;

let lidas = [];
try {
  const s = JSON.parse(readFileSync(join(ROOT, 'content/settings/oficina.json'), 'utf8'));
  if (Array.isArray(s.photos)) lidas = s.photos;
} catch { /* sem ficheiro: as de origem (o guards.mjs já o disse) */ }

export const fotosDaDona = {
  inicio: NOME.test(String(lidas[0] ?? '')) ? lidas[0] : '01',
  sobre: NOME.test(String(lidas[1] ?? '')) ? lidas[1] : '02',
};
