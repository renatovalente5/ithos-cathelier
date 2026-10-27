/* AS CAMPANHAS DE PORTES GRÁTIS (content/settings/shipping.json, que a dona
 * gere no painel, em Campanhas).
 *
 * Eram uma só (`campaign`); passaram a uma lista (`campaigns`) para se poder
 * deixar o Natal e a Black Friday marcados com antecedência. Em cada dia vale
 * A PRIMEIRA DA LISTA que estiver ligada, com valor, e com o dia de Lisboa
 * dentro das datas -- a mesma regra no carrinho (shop.js), no Worker
 * (src/catalogue.js da API) e aqui, que escreve a faixa e a janela de cada
 * uma para o shop.js escolher. Um ficheiro antigo, só com `campaign`, lê-se
 * como uma lista de uma. */
export const campanhasDe = (s) => (Array.isArray(s?.campaigns) ? s.campaigns : (s?.campaign ? [s.campaign] : []));
/* O QUE UMA CAMPANHA PODE SER (o Renato, 22 out 2026: «a promoção pode não
   ser 30 € mas sim envio gratuito ou muitas outras coisas»):
   · `tipo: 'portes'` (sem tipo, é esta): portes grátis a partir de `freeOver`
     euros, ou em todas as encomendas (`sempre`);
   · `tipo: 'aviso'`: só a faixa e a janela, com a `frase` da dona -- não mexe
     em preço nenhum.
   A `frase`, se a dona a escrever, substitui a frase automática na faixa e na
   janela; o que se cobra continua a sair dos campos (tipo, valor, sempre,
   zonas, loja). Em condições = ligada e com o que precisa (valor ou sempre;
   a frase, num aviso). A mesma regra no Worker (src/catalogue.js) e no cesto. */
export const tipoDe = (c) => (c?.tipo === 'aviso' ? 'aviso' : 'portes');
export const emCondicoes = (c) => Boolean(c && c.active
  && (tipoDe(c) === 'aviso' ? String(c.frase ?? '').trim() : (c.sempre === true || Number(c.freeOver) > 0)));
export const campanhasLigadas = (s) => campanhasDe(s).filter(emCondicoes);
/* DE QUE LOJA (o Renato, 22 out 2026: «campanhas diferentes para o ithos e
   para o Cathelier»). Uma campanha com `marca` é só dessa loja -- a faixa e a
   janela aparecem só nas páginas dela, e para os portes grátis contam só as
   peças dela --; sem `marca`, é das duas. Em cada loja vale a primeira da
   lista que a cobre (a mesma regra no Worker, src/catalogue.js, e no cesto). */
export const daLoja = (c, brand) => !c?.marca || c.marca === brand;
/* Aos quantos segundos de visita aparece a janela (sem nada, aos 10). */
export const segundosDaJanela = (c) => (Number.isInteger(c?.segundos) && c.segundos >= 0 ? c.segundos : 10);

/* ONDE VALE (o painel, 21 out 2026: «Onde vale» em cada campanha). `countries`
   são os códigos das zonas de «Envios» escolhidas (PT, PT-20, PT-30…); sem
   lista, vale em todo o lado. Para a faixa e a janela dizerem onde, os nomes
   das zonas que a campanha cobre inteiras -- a mesma lista que o carrinho e o
   Worker usam para cobrar. */
export function zonasDaCampanha(c, shipping) {
  const lista = Array.isArray(c?.countries) ? c.countries : [];
  if (!lista.length) return [];
  return (shipping?.zones ?? []).filter((z) => (z.countries ?? []).length && z.countries.every((k) => lista.includes(k))).map((z) => z.name);
}

/* AS DE UMA LOJA, PELA ORDEM DA LISTA. Em cada dia vale a primeira que está
   nas datas, SEJA ELA QUAL FOR -- um aviso, ou uma campanha só das ilhas, à
   frente, tapa as que vêm depois: é o que o Worker cobra (src/catalogue.js,
   campanhaDeHoje) e o cesto mostra. A faixa, a janela e a linha dos portes da
   ficha escrevem uma marca por cada uma, mesmo as que não as mostram, para o
   shop.js escolher a mesma: senão uma campanha sem faixa à frente deixava ver
   a faixa da seguinte, e a página prometia o que a caixa não dá (27 out). */
export const campanhasDaLoja = (s, brand) => campanhasLigadas(s).filter((c) => daLoja(c, brand));
/* Tira os portes a uma encomenda para Portugal continental (a linha da ficha
   fala do envio dentro de Portugal) -- com a condição dela (o valor). */
export const tiraPortesNoContinente = (c) => tipoDe(c) === 'portes' && (!c.countries?.length || c.countries.includes('PT'));
/* O dia de Lisboa dentro das datas -- a mesma conta do shop.js
   (dentroDasDatas) e do Worker (campanhaEmDia). */
export function emDiaDeLisboa(c, agora = new Date()) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  return (!c.from || hoje >= c.from) && (!c.to || hoje <= c.to);
}
