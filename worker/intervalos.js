/* O VÍDEO DA CAPA PRECISA DE PEDIDOS POR INTERVALOS.
   Os ficheiros estáticos de um Worker ignoram o cabeçalho Range: a um
   «bytes=0-1» respondem 200 com o ficheiro inteiro. O Safari do iOS abre um
   vídeo exactamente com esse pedido e a Apple manda os servidores de media
   responderem por intervalos («HTTP servers hosting media files for iOS must
   support byte-range requests» — Safari Web Content Guide); sem isso o vídeo
   pode não tocar no iPhone (o shop.js só o mostra quando toca, por isso o pior
   caso é ficar a imagem parada).
   Este script só corre em /media/film/* (run_worker_first em wrangler.jsonc):
   tudo o resto continua a ser servido directamente como ficheiro. Lê o
   ficheiro pelo ASSETS (com os cabeçalhos do _headers) e corta o intervalo
   pedido. Um só intervalo por pedido; vários, ou um mal escrito, recebem o
   ficheiro inteiro, que a norma permite (RFC 9110, 14.2). */
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const metodo = request.method;
    if (res.status !== 200 || (metodo !== 'GET' && metodo !== 'HEAD')) return res;
    if (!new URL(request.url).pathname.startsWith('/media/film/')) return res;
    const h = new Headers(res.headers);
    h.set('accept-ranges', 'bytes');
    const pedido = request.headers.get('range');
    const m = pedido ? /^bytes=(\d*)-(\d*)$/.exec(pedido.trim()) : null;
    if (!m || (m[1] === '' && m[2] === '')) return new Response(metodo === 'HEAD' ? null : res.body, { status: 200, headers: h });
    /* Um HEAD não traz corpo para medir: pede-se o ficheiro. */
    const cheio = metodo === 'HEAD' ? await env.ASSETS.fetch(new Request(request.url, { headers: request.headers })) : res;
    const corpo = await cheio.arrayBuffer();
    const total = corpo.byteLength;
    let ini; let fim;
    if (m[1] === '') { ini = Math.max(0, total - Number(m[2])); fim = total - 1; } else {
      ini = Number(m[1]);
      fim = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
    }
    if (ini > fim || ini >= total) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${total}`, 'accept-ranges': 'bytes' } });
    h.set('content-range', `bytes ${ini}-${fim}/${total}`);
    h.set('content-length', String(fim - ini + 1));
    return new Response(metodo === 'HEAD' ? null : corpo.slice(ini, fim + 1), { status: 206, headers: h });
  },
};
