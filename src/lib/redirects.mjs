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
 * Não têm prazo: ficam enquanto a dona os quiser. Um stub custa um ficheiro e
 * uma excepção no verificador, e a única coisa que tira dali alguém é ela
 * dizer que se apaguem.
 *
 * O que vai dentro de cada stub está em redirectStub(), em src/build.mjs, e é
 * verificado em scripts/check-output.mjs e conduzido pela bateria.
 *
 * O `from` NUNCA MUDA; o `to` segue a arrumação da loja. A 25 set 2026 a dona
 * trocou os dez separadores pelos da lista dela. Cinco slugs sobreviveram com o
 * mesmo sentido e ficaram como estavam. Os outros cinco deixaram de existir, e
 * a morada antiga de cada um aponta agora para o separador onde as peças dele
 * foram parar -- nunca para a lista inteira, que para quem vinha à procura do
 * Dia do Pai é uma parede. */
export const REDIRECTS = [
  { from: '/cathelier/christmas/', to: '/cathelier/pieces/#christmas' },
  { from: '/cathelier/mothers-day/', to: '/cathelier/pieces/#special-days' },
  { from: '/cathelier/fathers-day/', to: '/cathelier/pieces/#special-days' },
  // O Dia da Criança não tem sucessor: as peças dele eram quase todas nomes.
  { from: '/cathelier/childrens-day/', to: '/cathelier/pieces/#names' },
  { from: '/cathelier/keepsakes/', to: '/cathelier/pieces/#keepsakes' },
  { from: '/cathelier/new-baby/', to: '/cathelier/pieces/#new-baby' },
  { from: '/cathelier/names/', to: '/cathelier/pieces/#names' },
  { from: '/cathelier/home/', to: '/cathelier/pieces/#wall-decor' },
  { from: '/cathelier/hanging/', to: '/cathelier/pieces/#hanging' },
  // Os troféus e as placas foram para os pedidos especiais.
  { from: '/cathelier/awards/', to: '/cathelier/pieces/#custom' },
];
