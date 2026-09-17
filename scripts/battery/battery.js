// Bateria injectável: mede o que só o browser sabe.
window.__bateria = function () {
  const R = [];
  const nota = (ok, o, detalhe = '') => R.push({ ok: !!ok, o, detalhe: String(detalhe).slice(0, 180) });

  // --- abrir o acordeão do rodapé ANTES de medir seja o que for ------------
  // Três medições desta bateria descartam o que não está pintado: alvos de
  // toque e contraste por `offsetParent !== null`, e o corpo de letra por
  // altura zero. Com os grupos do rodapé fechados no telemóvel, as ligações
  // legais deixavam de ser medidas — e as três imprimiam ✓ sobre conteúdo em
  // que nunca tinham tocado. Abre-se tudo, mede-se, e repõe-se no fim.
  const closedGroups = [...document.querySelectorAll('.foot__group:not([open])')];
  for (const g of closedGroups) g.open = true;

  // --- e a drawer, pela mesmíssima razão ------------------------------------
  // A drawer era aberta no FIM, só para se lhe medir a altura. Resultado: o
  // contraste, os alvos de toque e o corpo de letra corriam com ela fechada —
  // e um <dialog> fechado não tem geometria nenhuma. O menu de telemóvel, que
  // é a navegação mais usada do site, atravessou o projecto inteiro sem nunca
  // ser medido: 306 verificações e zero sobre ele.
  //
  // `show()` e não `showModal()`: o modal põe `inert` em todo o resto e a
  // página por trás deixava de se medir. Assim medem-se as duas, de uma vez.
  //
  // A ORDEM importa, e custou uma verificação que nunca correu. A pergunta
  // «a drawer está visível?» era feita ANTES de a abrir — e o nosso próprio
  // CSS tem `.drawer:not([open]) { display: none }`. Com a drawer fechada a
  // resposta era sempre «não», a condição era insatisfazível, e o teste que
  // mede se o menu cabe no ecrã nunca chegou a existir. Uma condição que
  // nunca é verdade não imprime ✗ nenhum: desaparece. Abre-se primeiro, e só
  // depois se pergunta se esta largura tem drawer (a partir de 60 rem não tem).
  const drawer = document.querySelector('.drawer');
  const drawerWasOpen = drawer?.open;
  if (drawer && !drawerWasOpen) drawer.show();
  const drawerIsShown = drawer && getComputedStyle(drawer).display !== 'none';
  if (drawer && !drawerIsShown && !drawerWasOpen) drawer.close();

  // --- transbordo lateral --------------------------------------------------
  const de = document.documentElement;
  nota(de.scrollWidth <= de.clientWidth + 1, 'não rola de lado',
    `scrollWidth ${de.scrollWidth} > clientWidth ${de.clientWidth}`);
  // Um filho de um rolador HORIZONTAL passa da margem por desenho — é para isso
  // que o rolador existe. O que não pode passar é a página, e isso mede-se
  // acima, no `scrollWidth`. Sem esta excepção, a fila de filtros do catálogo
  // acusava quatro transbordos que são o funcionamento correcto.
  const dentroDeRolador = (e) => {
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      // `hidden` and `clip` count too, and leaving them out cost two false
      // failures. A carousel track is six slides at 100% each inside a box
      // that clips: the slides are SUPPOSED to sit past the edge, and the
      // clipping is what makes that correct. What may never pass the edge is
      // the page, and that is measured above on scrollWidth.
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
    }
    return false;
  };
  const transbordam = [...document.querySelectorAll('body *')]
    .filter((e) => e.getBoundingClientRect().right > de.clientWidth + 1
      && getComputedStyle(e).position !== 'fixed'
      && !dentroDeRolador(e))
    .slice(0, 4).map((e) => `${e.tagName}.${(e.className || '').toString().split(' ')[0]}`);
  nota(transbordam.length === 0, 'nada passa da margem direita', transbordam.join(', '));

  // --- drawer lateral ------------------------------------------------------
  // Mede-se o CONTEÚDO, não o contentor: o contentor é largo de propósito e o
  // respiro vive no seu `padding`. Medir a caixa dava sempre «0 px de respiro»
  // em todas as páginas — catorze falhas seguidas, nenhuma verdadeira.
  const conteudo = document.querySelector('main h1, main p, main .peca__nome');
  if (conteudo) {
    const r = conteudo.getBoundingClientRect();
    nota(r.left >= 15 && de.clientWidth - r.right >= 15, 'há pelo menos 16 px de respiro dos lados',
      `esquerda ${Math.round(r.left)} direita ${Math.round(de.clientWidth - r.right)}`);
  }

  // --- contraste -----------------------------------------------------------
  // A cor tem de ser normalizada pelo BROWSER, não lida com uma expressão
  // regular. Um `color-mix()` computado sai como `color(srgb 0.98 0.96 0.94)` —
  // números entre 0 e 1 — e tratá-los como 0-255 dá um fundo quase preto. Foi
  // isso que fez esta bateria acusar 31 falhas de contraste que não existiam:
  // o contraste real era 7:1 e ela dizia 2,7:1.
  // A cor é PINTADA e lida de volta, em vez de analisada com uma expressão
  // regular. É a única forma que funciona para todas as sintaxes: `rgb()`,
  // `#rrggbb`, `color(srgb …)` (o que um `color-mix()` computado devolve, com
  // números de 0 a 1) e `oklch()`. Sobre branco, para resolver a transparência.
  const tela = document.createElement('canvas');
  tela.width = tela.height = 1;
  const ctx2 = tela.getContext('2d', { willReadFrequently: true });
  const rgbDe = (c, porBaixo = 'rgb(255,255,255)') => {
    ctx2.clearRect(0, 0, 1, 1);
    ctx2.fillStyle = porBaixo; ctx2.fillRect(0, 0, 1, 1);
    ctx2.fillStyle = c; ctx2.fillRect(0, 0, 1, 1);
    const d = ctx2.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lum = (c, porBaixo) => {
    const [r, g, b] = rgbDe(c, porBaixo).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const opaco = (c) => {
    if (!c || c === 'transparent') return false;
    const n = c.match(/[\d.]+/g);
    // O quarto número é a opacidade quando existe: um fundo a 0 não é fundo.
    return !(n && n.length === 4 && Number(n[3]) === 0);
  };
  const fundoDe = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (opaco(c)) return c;
      e = e.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
  };
  const corDoBody = getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
  const razao = (a, b) => {
    // O fundo pode ser translúcido (o cabeçalho é): compõe-se sobre o fundo do
    // corpo antes de medir. O texto compõe-se sobre o fundo já resolvido.
    const fundoResolvido = rgbDe(b, corDoBody);
    const fundoCss = `rgb(${fundoResolvido.join(',')})`;
    const [x, y] = [lum(a, fundoCss), lum(fundoCss)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const maus = [];
  const textos = [...document.querySelectorAll('p, a, li, h1, h2, h3, h4, span, button, label, td, th, summary, dt, dd')]
    .filter((e) => e.offsetParent !== null && e.textContent.trim().length > 1
      && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  for (const e of textos) {
    const s = getComputedStyle(e);
    const tam = parseFloat(s.fontSize);
    const grande = tam >= 24 || (tam >= 18.66 && Number(s.fontWeight) >= 700);
    const r = razao(s.color, fundoDe(e));
    const minimo = grande ? 3 : 4.5;
    if (r < minimo) {
      maus.push(`${e.tagName}.${(e.className || '').toString().split(' ')[0]} «${e.textContent.trim().slice(0, 26)}» ${r.toFixed(2)}:1 (min ${minimo})`);
    }
  }
  nota(maus.length === 0, `contraste de ${textos.length} textos`, maus.slice(0, 5).join(' · '));

  // --- contraste POR CIMA DA FOTOGRAFIA DA CAPA ----------------------------
  /* O teste de cima não serve para a capa, e não é um pormenor.
     Ele resolve o fundo subindo pelos antepassados até encontrar um opaco, e
     para as palavras da capa esse fundo é o painel translúcido composto sobre
     o BRANCO do corpo — o caso mais favorável que existe. O fundo verdadeiro é
     a fotografia, que muda de pixel para pixel e muda outra vez no dia em que a
     dona trocar o ficheiro.
     Por isso aqui a fotografia é DESENHADA numa tela, lê-se a região que fica
     debaixo do painel, compõe-se o painel com a sua opacidade por cima de cada
     amostra e mede-se o pior caso. É a única forma de a medição continuar
     verdadeira quando a fotografia deixar de ser esta. */
  const capaImg = document.querySelector('.cover__img');
  const capaPainel = document.querySelector('.cover__panel');
  if (capaImg && capaPainel) {
    /* A fonte dos pixels é a cópia que o condutor descodificou, quando existe:
       a `<img>` da página passa segundos com `naturalWidth` a zero dentro de
       uma moldura escondida. A geometria continua a sair da `<img>`, que é o
       que está mesmo desenhado no ecrã. */
    const fonte = window.__capaFoto && window.__capaFoto.naturalWidth
      ? window.__capaFoto : capaImg;
    if (!fonte.naturalWidth) {
      nota(false, 'contraste da capa sobre a fotografia', 'a fotografia não chegou a carregar');
    } else {
      const cx = capaImg.getBoundingClientRect();
      const px = capaPainel.getBoundingClientRect();
      const [iw, ih] = [fonte.naturalWidth, fonte.naturalHeight];
      // object-fit: cover — a escala é a MAIOR das duas, e o resto sai da caixa.
      const k = Math.max(cx.width / iw, cx.height / ih);
      const [dw, dh] = [iw * k, ih * k];
      const pos = getComputedStyle(capaImg).objectPosition.match(/[\d.]+/g) || ['50', '50'];
      const ox = (cx.width - dw) * (parseFloat(pos[0]) / 100);
      const oy = (cx.height - dh) * (parseFloat(pos[1]) / 100);
      // o rectângulo do painel, em coordenadas da fotografia original
      const sx = (px.left - cx.left - ox) / k;
      const sy = (px.top - cx.top - oy) / k;
      const sw = px.width / k;
      const sh = px.height / k;

      const N = 24;
      const t = document.createElement('canvas');
      t.width = N; t.height = N;
      const c = t.getContext('2d', { willReadFrequently: true });
      let pior = Infinity, onde = '';
      try {
        c.drawImage(fonte, sx, sy, sw, sh, 0, 0, N, N);
        const dados = c.getImageData(0, 0, N, N).data;
        const painel = getComputedStyle(capaPainel).backgroundColor;
        const tinta = getComputedStyle(capaPainel).color;
        for (let n = 0; n < N * N; n++) {
          const foto = `rgb(${dados[n * 4]},${dados[n * 4 + 1]},${dados[n * 4 + 2]})`;
          // o painel, com a sua opacidade, COMPOSTO SOBRE ESTE pixel da foto
          const fundo = `rgb(${rgbDe(painel, foto).join(',')})`;
          const [a, b] = [lum(tinta, fundo), lum(fundo)].sort((q, w) => w - q);
          const r = (a + 0.05) / (b + 0.05);
          if (r < pior) { pior = r; onde = foto; }
        }
      } catch (e) {
        pior = NaN; onde = String(e.message || e);
      }
      // O título da capa é grande (3:1 basta pela norma), mas a frase por baixo
      // não é: mede-se pelo mínimo dos dois, que é o do texto pequeno.
      nota(pior >= 4.5, 'contraste da capa sobre a fotografia',
        Number.isFinite(pior) ? `pior pixel ${pior.toFixed(2)}:1 sobre ${onde} (min 4.5)` : onde);
    }
  }

  /* E QUANDO O FUNDO É UM FILME
     A medição de cima amostra a fotografia. Numa capa com filme a fotografia
     continua lá por baixo, mas não é ela que se vê: o chão do painel muda 25
     vezes por segundo, e medir um quadro não diz nada sobre o seguinte. Medir
     o quadro actual seria pior do que não medir, porque daria um ✓ sobre uma
     pergunta que não foi feita.
     O que se mede é o limite: o painel composto sobre PRETO. Nenhum quadro de
     nenhum filme pode ser mais escuro do que preto, portanto se este número
     passa, passam todos — e passa a ser verdade para o filme que a dona lá
     puser amanhã, sem ninguém ter de vir cá medir outra vez. */
  if (document.querySelector('.cover__film') && capaPainel) {
    const painel = getComputedStyle(capaPainel).backgroundColor;
    const tinta = getComputedStyle(capaPainel).color;
    const fundo = `rgb(${rgbDe(painel, 'rgb(0,0,0)').join(',')})`;
    const [a, b] = [lum(tinta, fundo), lum(fundo)].sort((q, w) => w - q);
    const r = (a + 0.05) / (b + 0.05);
    nota(r >= 4.5, 'contraste da capa sobre o quadro mais escuro que um filme pode ter',
      `${r.toFixed(2)}:1 com o painel sobre preto (min 4.5)`);
  }


  // --- alvos de toque ------------------------------------------------------
  /* Duas isenções, e as duas são da própria norma (WCAG 2.5.8):
     · um campo dentro de uma <label> tem como alvo A ETIQUETA INTEIRA, que é
       grande — medir a caixa de 20 px dá um falso positivo;
     · uma ligação no meio de uma frase está expressamente isenta.
     Sem elas, a bateria acusava dez alvos que não têm problema nenhum, e o
     ruído escondia os três que tinham. */
  const dentroDeEtiqueta = (e) => {
    const lab = e.closest('label');
    return !!lab && lab.getBoundingClientRect().height >= 23.5;
  };
  const noMeioDeUmaFrase = (e) => {
    if (e.tagName !== 'A') return false;
    const pai = e.parentElement;
    if (!pai) return false;
    const texto = pai.textContent.trim();
    return texto.length > e.textContent.trim().length + 3;
  };
  const pequenos = [...document.querySelectorAll('a, button, input[type=checkbox], input[type=radio], select')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ e, r }) => (r.height < 23.5 || r.width < 23.5)
      && !dentroDeEtiqueta(e) && !noMeioDeUmaFrase(e)
      && !e.closest('.migalhas, .rodape__legal, .prosa, .linha__opcoes'))
    .slice(0, 5)
    .map(({ e, r }) => `${e.tagName}«${e.textContent.trim().slice(0, 18)}» ${Math.round(r.width)}×${Math.round(r.height)}`);
  nota(pequenos.length === 0, 'alvos de toque com pelo menos 24 px', pequenos.join(' · '));

  // --- imagens -------------------------------------------------------------
  // A prova de que uma imagem falhou é o ESTADO DA RESPOSTA, não o
  // `naturalWidth`: numa moldura fora do ecrã o browser troca de candidato a
  // meio e há um instante em que `complete` é verdade com `naturalWidth` a
  // zero. A primeira versão desta bateria acusou três imagens que carregam
  // perfeitamente numa página normal.
  const respostas = new Map(performance.getEntriesByType('resource')
    .map((r) => [r.name, r.responseStatus]));
  /* E DIZER SOBRE QUANTAS É QUE FALA.
     Esta verificação só conhece uma imagem depois de alguma coisa a ter ido
     buscar. A tira de miniaturas fez a página de catálogo passar de 28 para 95
     imagens, todas em `loading="lazy"` — e o condutor nunca rola. Sem o
     denominador, a cobertura caía para um terço e o ✓ continuava igual: a
     forma exacta de guarda que este projecto trata como defeito. */
  const enderecos = [...document.images].map((i) => i.currentSrc || i.src).filter(Boolean);
  const medidas = enderecos.filter((u) => respostas.has(u));
  const partidas = medidas.filter((u) => respostas.get(u) >= 400).slice(0, 4);
  nota(partidas.length === 0,
    `nenhuma imagem partida (${medidas.length} de ${document.images.length} medidas)`,
    partidas.join(', '));

  /* A pergunta é sobre o ATRIBUTO. A propriedade responde a outra: `i.alt`
     reflecte o atributo e devolve '' quando ele não existe, por isso nunca é
     null nem undefined — a versão anterior contava zero em todas as páginas
     desde que foi escrita e não podia fazer outra coisa. */
  const semAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).length;
  nota(semAlt === 0, 'todas as imagens têm atributo alt', String(semAlt));

  // --- estrutura -----------------------------------------------------------
  nota(document.querySelectorAll('h1').length === 1, 'há exactamente um h1',
    String(document.querySelectorAll('h1').length));
  nota(!!document.querySelector('main#main'), 'há um <main> com âncora');
  nota(document.documentElement.lang === 'en', 'a língua está declarada', document.documentElement.lang);
  const marca = document.documentElement.dataset.brand;
  nota(['ithos', 'cathelier'].includes(marca), 'the brand is in the HTML as served', marca);

  // --- tipografia carregada ------------------------------------------------
  // Só se exige o que a página REALMENTE usa. O serifado da ithos existe
  // apenas na linha do herói, por isso numa ficha de produto nunca é pedido —
  // e exigi-lo ali seria exigir um descarregamento que não serve ninguém.
  // A pergunta certa é: alguma coisa nesta página pede esta letra e ela não
  // chegou?
  const emUso = new Set();
  for (const e of document.querySelectorAll('body *')) {
    if (!e.textContent.trim() || !e.getBoundingClientRect().width) continue;
    emUso.add(getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim());
  }
  const carregadas = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  const esperadas = { ithos: ['Montserrat', 'Cormorant Garamond'], cathelier: ['Klee One', 'Grandstander'] }[marca] ?? [];
  for (const f of esperadas) {
    if (!emUso.has(f)) continue;
    nota(carregadas.includes(f), `tipo «${f}» carregado`, carregadas.join(', '));
  }

  // --- corpo de letra mínimo ------------------------------------------------
  // Não há mínimo na WCAG, mas há na prática: abaixo de 12 px um texto no
  // telemóvel deixa de se ler sem aproximar os dedos, e o iOS passa a oferecer
  // zoom automático nos campos. Mede-se o TEXTO VISÍVEL, não a folha de
  // estilo — o que interessa é o que chega ao ecrã depois dos `clamp()`.
  const miudos = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!e.firstChild || e.firstChild.nodeType !== 3 || !e.textContent.trim()) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const px = parseFloat(getComputedStyle(e).fontSize);
    if (px < 12) miudos.push(`${e.tagName}.${(e.className || '').toString().split(' ')[0]} ${px.toFixed(1)}px`);
  }
  nota(miudos.length === 0, 'nenhum texto abaixo de 12 px', miudos.slice(0, 5).join(' · '));

  // --- o menu cabe no ecrã --------------------------------------------------
  // A drawer é `100dvh` e não rola. Se o conteúdo crescer (mais uma entrada,
  // uma contagem mais larga), a última linha sai por baixo sem aviso — e a
  // última linha é o telefone.
  if (drawerIsShown) {
    // A pergunta mudou de forma, e de propósito. O meio da gaveta rola, e «a
    // soma dos filhos cabe no ecrã» passaria a ser verdade por construção —
    // que é exactamente como a guarda anterior ficou cega.
    //
    // A que ainda pode ser FALSA é esta: é preciso rolar para ver o menu
    // todo? Se for, há entradas escondidas sem que nada o diga. (Havia dois
    // acordeões aqui dentro; saíram a pedido da dona, e a pergunta continua a
    // valer — agora sobre a lista inteira, que é um caso mais exigente.)
    const corpo = drawer.querySelector('.drawer__body');
    if (corpo) {
      const precisaDeRolar = corpo.scrollHeight > corpo.clientHeight + 1;
      nota(!precisaDeRolar, 'o menu inteiro cabe sem rolar',
        `conteúdo ${corpo.scrollHeight}px em ${corpo.clientHeight}px`);
    }
    const contentHeight = [...drawer.children].reduce((t, e) => t + e.getBoundingClientRect().height, 0);
    nota(contentHeight <= innerHeight + 1, 'o menu de telemóvel cabe no ecrã sem rolar',
      `conteúdo ${Math.round(contentHeight)}px, ecrã ${innerHeight}px`);
    nota(drawer.querySelectorAll('.drawer__nav a').length >= 3,
      'a drawer foi medida com as entradas lá dentro',
      `${drawer.querySelectorAll('.drawer__nav a').length} entradas`);

    // Não rola de lado DENTRO do painel. As duas guardas de transbordo que já
    // existem são ambas cegas a isto: a da página mede `documentElement
    // .scrollWidth`, que um contentor de rolamento nunca alcança, e a dos
    // elementos isenta de propósito tudo o que desce de um rolador. Um nome
    // comprido rolaria de lado no painel com dois ✓ impressos por cima.
    const corpoLateral = drawer.querySelector('.drawer__body');
    if (corpoLateral) {
      nota(corpoLateral.scrollWidth <= corpoLateral.clientWidth + 1,
        'o menu não rola de lado por dentro',
        `${corpoLateral.scrollWidth}px em ${corpoLateral.clientWidth}px`);
    }
  }

  /* --- o painel, medido COMO PAINEL ----------------------------------------
   * Tudo acima foi medido com a gaveta aberta por `show()`, que é deliberado:
   * `showModal()` põe o resto da página inerte e a página deixa de se poder
   * medir. Só que uma gaveta não-modal é `position: absolute` e assenta na sua
   * posição estática, lá para baixo ao pé do rodapé — medi y=2940 numa página
   * de 3457px. Ou seja: a largura do painel, o encosto à esquerda, a altura
   * cheia e o véu por trás são exactamente as coisas que a bateria NÃO via.
   *
   * Esta passagem abre-o a sério, mede só o que a modalidade cria, e fecha.
   * A pergunta do meio é a frase da dona escrita de forma a poder falhar: num
   * ecrã grande o menu ocupa só um bocado. Tem limite dos dois lados — um
   * painel de 80px passaria num teste que só perguntasse «menos de metade». */
  if (drawer) {
    const estavaAberto = drawer.open;
    if (drawer.open) drawer.close();
    try {
      drawer.showModal();
      // Aterrar a animação de entrada antes de medir: o painel entra a
      // deslizar e uma medição no primeiro quadro apanha-o a meio caminho.
      // `finish()` é síncrono e põe-no no estado final — mede-se geometria,
      // não movimento.
      for (const a of (drawer.getAnimations ? drawer.getAnimations() : [])) {
        try { a.finish(); } catch (e) { /* já terminada */ }
      }
      const r = drawer.getBoundingClientRect();
      /* Contra a área de LAYOUT e não contra `innerWidth`. `innerWidth` conta
         a barra de rolamento clássica junto, e com ela um painel que ocupa o
         ecrã todo mede 305 de 320 — a guarda acusava 20 falhas que eram da
         própria guarda. A largura que o CSS vê é `clientWidth`. */
      const vw = de.clientWidth, vh = de.clientHeight;
      nota(Math.abs(r.x) <= 1 && Math.round(r.height) >= vh - 1,
        'o menu está encostado à esquerda e ocupa o ecrã todo em altura',
        `x=${Math.round(r.x)} altura=${Math.round(r.height)} de ${vh}`);

      /* «Largo» decide-se COM A MESMA PERGUNTA QUE O CSS FAZ, e não com um
         número à parte. Uma media query mede a área de visualização COM a
         barra de rolamento; o `clientWidth` mede-a sem. No pixel exacto do
         limite as duas discordam em 15px — com 768 por fora, o CSS já dá o
         painel e o `clientWidth` diz 753, e a guarda acusava 63 falhas a
         perguntar pelo caso do telemóvel a um painel. O 48rem tem de
         acompanhar o de shop.css. */
      const largo = matchMedia('(width >= 48rem)').matches;
      // Limite dos DOIS lados: um painel de 80px passaria num teste que só
      // perguntasse «menos de metade», e não seria um menu.
      nota(largo ? (r.width < vw * 0.5 && r.width > 300) : (r.width >= vw - 1),
        largo ? 'num ecrã grande o menu ocupa só um bocado' : 'num telemóvel o menu ocupa o ecrã',
        `${Math.round(r.width)}px de ${vw}px (${(r.width / vw * 100).toFixed(1)}%)`);

      // O véu tem de DEIXAR VER a página. Era `var(--bg)`, opaco, porque a
      // gaveta tapava o ecrã e ninguém o via. E um `var()` que não resolva no
      // ::backdrop não cai no cinzento do browser: cai em transparente.
      const veu = getComputedStyle(drawer, '::backdrop').backgroundColor;
      const n = (veu.match(/[\d.]+/g) || []).map(Number);
      const alfa = n.length === 4 ? n[3] : 1;
      nota(!largo || (alfa > 0.05 && alfa < 0.95),
        'o véu por trás do menu deixa ver a loja', `${veu} (alfa ${alfa})`);
    } catch (e) {
      nota(false, 'o menu abre como modal', String(e.message || e));
    }
    try { drawer.close(); } catch (e) { /* já fechada */ }
    if (estavaAberto) { try { drawer.show(); } catch (e) { /* nada */ } }
  }


  // --- nada no cabeçalho pisa a marca ---------------------------------------
  //
  // Esta verificação existe porque a caixa do <nav> MENTIU. O logótipo estava
  // centrado, o <nav> tinha `min-width: 0`, e os links transbordavam a sua
  // faixa em vez de a alargarem: medir o <nav> dava 43 px de folga enquanto o
  // último <a> imprimia dois pixels dentro da palavra. O dono viu-o numa
  // fotografia do telemóvel antes de qualquer medição minha o apanhar.
  //
  // Mede-se cada elemento FILHO, nunca o contentor.
  const marcaNoTopo = document.querySelector('.head__mark img');
  if (marcaNoTopo) {
    const m = marcaNoTopo.getBoundingClientRect();
    // Antes de perguntar se alguém a pisa, perguntar se ela EXISTE. Um SVG com
    // viewBox e sem altura declarada colapsa para zero: o ficheiro resolve, o
    // link está lá, e a marca não se vê. Nenhuma outra guarda apanha isso.
    nota(m.width >= 24 && m.height >= 24, 'a marca do cabeçalho tem tamanho',
      `${Math.round(m.width)}x${Math.round(m.height)}`);
    const vizinhos = [...document.querySelectorAll('.head__nav a, .head__right a, .head__left button')];
    const pisam = vizinhos
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      // Nos DOIS eixos. O cabeçalho da ithos tem duas linhas: a navegação
      // partilha a faixa horizontal da marca e passa por baixo dela, o que
      // só é sobreposição se também se cruzarem na vertical.
      .filter(({ r }) => r.width && r.height
        && r.right > m.left + 1 && r.left < m.right - 1
        && r.bottom > m.top + 1 && r.top < m.bottom - 1)
      .map(({ e }) => `«${e.textContent.trim().slice(0, 18) || e.getAttribute('aria-label')}»`);
    nota(pisam.length === 0, 'nada no cabeçalho se sobrepõe à marca', pisam.join(', '));
  }

  /* --- e a gaveta: fechar à esquerda, marca ao meio, cesto à direita -------
   * A partir de 48rem a gaveta é um painel COM O CABEÇALHO AO LADO, e o
   * cabeçalho já tem a marca e o cesto — repeti-los a 40px de distância era o
   * género de duplicado que a dona fotografa. Por isso lá estão escondidos de
   * propósito, e as duas perguntas de baixo deixam de se poder fazer.
   *
   * O que NÃO se faz é saltá-las em silêncio: uma pergunta que desaparece é
   * como esta bateria ficou cega à gaveta durante o projecto inteiro. Fazem-se
   * as perguntas do outro lado — que a marca está mesmo escondida, e que a do
   * cabeçalho está visível para tomar o lugar dela. Ambas podem falhar. */
  if (drawerIsShown) {
    const fechar = drawer.querySelector('.close-menu')?.getBoundingClientRect();
    const marca = drawer.querySelector('.drawer__mark');
    const dm = marca?.getBoundingClientRect();
    const eEstreito = !matchMedia('(width >= 48rem)').matches;   // como em shop.css

    if (eEstreito) {
      if (dm) nota(dm.width >= 24 && dm.height >= 24, 'a marca da gaveta tem tamanho',
        `${Math.round(dm.width)}x${Math.round(dm.height)}`);
      if (fechar && dm) {
        nota(fechar.right < dm.left - 8, 'o botão de fechar não está colado à marca',
          `fechar acaba em ${Math.round(fechar.right)}, a marca comeca em ${Math.round(dm.left)}`);
      }
    } else {
      nota(!dm || (dm.width === 0 && dm.height === 0),
        'no painel, a marca de dentro está escondida (a do cabeçalho serve)',
        dm ? `${Math.round(dm.width)}x${Math.round(dm.height)}` : 'não existe');
      const hm = document.querySelector('.head__mark img')?.getBoundingClientRect();
      nota(hm && hm.width >= 24 && hm.height >= 24,
        'e a marca do cabeçalho está visível ao lado do painel',
        hm ? `${Math.round(hm.width)}x${Math.round(hm.height)}` : 'não existe');
      const cestos = [...document.querySelectorAll('[data-cart-count]')]
        .filter((e) => e.getClientRects().length).length;
      nota(cestos === 1, 'só há um cesto no ecrã', `${cestos} visíveis`);
    }
  }

  // O `summary` é um alvo de toque por direito próprio — mas SÓ enquanto for
  // clicável. A partir de 60 rem o acordeão desaparece: o CSS põe-lhe
  // `pointer-events: none` e ele volta a ser um cabeçalho de coluna, que não
  // se mede como alvo. Medir os dois casos com a mesma régua dava 64 falsos.
  for (const sm of document.querySelectorAll('.foot__group > summary')) {
    if (getComputedStyle(sm).pointerEvents === 'none') continue;
    const r = sm.getBoundingClientRect();
    nota(r.height >= 24 && r.width >= 24, 'o título do grupo do rodapé é um alvo de toque',
      `${Math.round(r.width)}×${Math.round(r.height)}`);
  }

  for (const g of closedGroups) g.open = false;
  if (drawerIsShown && !drawerWasOpen) drawer.close();

  return { total: R.length, falhas: R.filter((x) => !x.ok), tudo: R };
};
'bateria pronta';
