/* Endereços que existiram e deixaram de existir.
 *
 * Em 17 de Setembro de 2026 as dez páginas de ocasião da cathelier foram
 * apagadas: cada uma listava as peças filtradas pelo seu slug, que é
 * exactamente o que os chips de /cathelier/pieces/ fazem no browser. Uma
 * ocasião passou a ser um filtro, e a morada de um filtro é um fragmento.
 *
 * ESTA LISTA É HISTÓRIA, NÃO É CONTEÚDO.
 * Seria tentador gerá-la a partir de content/cathelier/_occasions.json, já que
 * hoje as dez ocasiões publicadas coincidem com os dez endereços apagados. Mas
 * uma ocasião publicada amanhã NUNCA teve página em /cathelier/<slug>/, e um
 * reencaminhamento a partir de uma morada que nunca existiu é uma mentira que
 * se instala sozinha e cresce para sempre. O que aqui está é o que esteve no
 * ar, e mais nada; a lista só encolhe.
 *
 * `until` é a data a partir da qual as guardas começam a pedir que se apaguem.
 * Um stub é dívida: ocupa um ficheiro, obriga a uma excepção no verificador e
 * inflaciona todas as contagens do projecto. E como este site não tem
 * analítica nenhuma — o robots.txt da pré-visualização é `Disallow: /` — nunca
 * haverá um sinal de tráfego a dizer que já ninguém usa um destes endereços.
 * Uma dívida cujo fim depende de uma prova que não pode existir é permanente
 * por construção, por isso o fim é uma data escrita aqui: seis meses, que é
 * mais ou menos a vida de um favorito de browser, e os favoritos são a única
 * população que estes ficheiros servem.
 *
 * O que vai dentro de cada stub está em redirectStub(), em src/build.mjs, e é
 * verificado em scripts/check-output.mjs e conduzido pela bateria. */
export const REDIRECTS = [
  { from: '/cathelier/christmas/', to: '/cathelier/pieces/#christmas', until: '2027-03-17' },
  { from: '/cathelier/mothers-day/', to: '/cathelier/pieces/#mothers-day', until: '2027-03-17' },
  { from: '/cathelier/fathers-day/', to: '/cathelier/pieces/#fathers-day', until: '2027-03-17' },
  { from: '/cathelier/childrens-day/', to: '/cathelier/pieces/#childrens-day', until: '2027-03-17' },
  { from: '/cathelier/keepsakes/', to: '/cathelier/pieces/#keepsakes', until: '2027-03-17' },
  { from: '/cathelier/new-baby/', to: '/cathelier/pieces/#new-baby', until: '2027-03-17' },
  { from: '/cathelier/names/', to: '/cathelier/pieces/#names', until: '2027-03-17' },
  { from: '/cathelier/home/', to: '/cathelier/pieces/#home', until: '2027-03-17' },
  { from: '/cathelier/hanging/', to: '/cathelier/pieces/#hanging', until: '2027-03-17' },
  { from: '/cathelier/awards/', to: '/cathelier/pieces/#awards', until: '2027-03-17' },
];
