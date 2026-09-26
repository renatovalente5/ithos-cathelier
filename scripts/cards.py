#!/usr/bin/env python3
"""
Turns the portrait photographs into the 3:4 frames the shop's cards are built on.

WHY THIS EXISTS, AND WHY IT IS THE FIRST TOOL IN THE PROJECT.

The reference shop the client chose shows every product in a 1:1 frame. Our
photographs are not 1:1 — of the 58 studio files, 45 are 1024x1536 and 13 are
full resolution up to 4000x6000, and two thirds of them are 2:3. Going to 1:1
therefore throws away a third of every picture. Which third is the whole
question: crop from the middle and a lamp standing tall in the frame loses its
head, and nobody notices until the client does.

So the crop is not centred. For each photograph we look for the subject and
centre the square on it:

  * the picture is reduced to a thumbnail, so this costs milliseconds;
  * each row gets an "energy" score — how much the pixels along it differ from
    their neighbours. Flat backdrop paper scores near zero; a carved, painted,
    lit lamp scores high;
  * the square window that captures the most energy wins, with a small pull
    back towards the centre so an otherwise tied frame doesn't drift to an edge.

It is a guess, and a guess is not good enough for 120 photographs that a
customer decides on. So every result is written to a contact sheet, reviewed by
eye, and any frame that guessed wrong gets its answer written down by hand in
photos/focus.json — a single number per photograph, 0 is the top edge and 1 the
bottom. Handwritten values always win over the guess, and focus.json holds NOTHING ELSE.
The first version of this script saved the guesses to that same file. From the
second run on, every frame counted as "reviewed" and the contact sheet drew its
hand-checked border around all 120 of them — the sheet stopped being able to
tell me what I had actually looked at. A record of decisions must not be
polished with things nobody decided.

One thing the guess gets wrong often enough to name: the woven straw mat the
lamps stand on has more edge energy than the lamps do, so the window slides to
the bottom of the frame and takes the head off anything tall. Sixteen of the
first 120 needed that undone by hand.

    python3 scripts/cards.py --contact    build the review sheets
    python3 scripts/cards.py              write the square masters
"""
import json
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter, ImageDraw
except ImportError:
    sys.exit("Pillow is missing:  python3 -m pip install Pillow")

RAIZ = Path(__file__).resolve().parent.parent
FOTOS = RAIZ / 'photos'
FOCOS = FOTOS / 'focus.json'
SAIDA = FOTOS / '_cards'
FOLHAS = FOTOS / '_contact'

# The master is generous on purpose: every web size is derived from it later,
# and the product page gallery on the reference shop serves 893px.
# A FORMA DO CARTÃO, ESCRITA AQUI E LIDA NOS OUTROS SÍTIOS.
#
# Era 1:1. Dois terços dos originais são 2:3, e um quadrado deita fora um terço
# da fotografia -- medido, e visível: o foguetão ficava decapitado, a girafa
# perdia os pés, o ouriço era um fragmento. A 3:4 sobrevive 89% do original e
# nada fica cortado, sem os cartões crescerem tanto que o produto encolha
# dentro deles (um 2:3 mostraria 100% mas com fundo vazio a mais).
#
# O mesmo número existe em src/lib/photo.mjs (a proporção intrínseca que o HTML
# declara) e em src/styles/base.css (a caixa que o desenha). scripts/guards.mjs
# compara os três E mede os ficheiros no disco -- se discordarem, o browser
# reserva uma caixa da altura errada e a página salta quando as fotografias
# chegam.
PROPORCAO = 3 / 4          # largura / altura
LADO = 1600
ALTO = round(LADO / PROPORCAO)


def focos() -> dict:
    return json.loads(FOCOS.read_text()) if FOCOS.exists() else {}


def encontrar_foco(im: Image.Image) -> float:
    """Where the subject sits, as a fraction of the height. 0 top, 1 bottom."""
    larg, alt = im.size
    if alt <= larg:
        return 0.5

    # A thumbnail is enough to find a lamp, and keeps this honest about cost.
    p = im.convert('L').resize((96, max(1, round(96 * alt / larg))), Image.BILINEAR)
    p = p.filter(ImageFilter.FIND_EDGES)
    px = p.load()
    pw, ph = p.size

    energia = [sum(px[x, y] for x in range(pw)) for y in range(ph)]

    # A janela tem a altura do corte, não a largura da fotografia: com 1:1 eram
    # a mesma coisa e a linha podia mentir sem se notar; com 3:4 já não são.
    corte = larg / PROPORCAO                          # altura do corte, no original
    janela = max(1, round(ph * corte / alt))
    if janela >= ph:
        return 0.5

    acumulado = [0]
    for e in energia:
        acumulado.append(acumulado[-1] + e)

    centro_ideal = ph / 2
    melhor, melhor_nota = 0, -1.0
    for topo in range(0, ph - janela + 1):
        soma = acumulado[topo + janela] - acumulado[topo]
        centro = topo + janela / 2
        # A gentle pull to the middle: it only decides otherwise-equal frames,
        # and stops a bright corner from dragging the crop off the subject.
        castigo = abs(centro - centro_ideal) / ph * 0.18 * (acumulado[-1] / ph * janela)
        nota = soma - castigo
        if nota > melhor_nota:
            melhor, melhor_nota = topo, nota

    return (melhor + janela / 2) / ph


def cortar(im: Image.Image, foco: float) -> Image.Image:
    """A janela mais larga possível com a proporção do cartão, colocada pelo foco.

    Uma fotografia mais ALTA do que a proporção é cortada em altura (é o caso
    dos dois terços que são 2:3, e é aí que o foco decide); uma mais LARGA é
    cortada nos lados, e aí o foco é horizontal."""
    larg, alt = im.size
    if larg / alt <= PROPORCAO:          # mais alta do que o cartão
        janela = min(alt, round(larg / PROPORCAO))
        topo = round(foco * alt - janela / 2)
        topo = max(0, min(alt - janela, topo))
        caixa = (0, topo, larg, topo + janela)
    else:                                 # mais larga do que o cartão
        janela = min(larg, round(alt * PROPORCAO))
        esq = round(foco * larg - janela / 2)
        esq = max(0, min(larg - janela, esq))
        caixa = (esq, 0, esq + janela, alt)
    return im.crop(caixa)


def originais():
    """Both brands. The ithos side is one folder per lamp; the cathelier side is
    a flat pool of photographs that several pieces share, because there are 41
    pieces and ten photographs and the owner will replace them one at a time in
    the back office."""
    for pasta in sorted((FOTOS / 'ithos').iterdir()):
        if pasta.is_dir():
            for f in sorted(pasta.glob('*.jpg')):
                yield f'ithos/{pasta.name}/{f.stem}', f
    pool = FOTOS / 'cathelier' / '_raw'
    if pool.is_dir():
        for f in sorted(pool.glob('*.jpg')):
            yield f'cathelier/pool/{f.stem}', f
    # As pastas próprias de uma peça (as fotografias que a dona junta no
    # painel): photos/cathelier/<pasta>/, ao lado da `_raw` partilhada.
    for pasta in sorted((FOTOS / 'cathelier').iterdir()) if (FOTOS / 'cathelier').is_dir() else []:
        if pasta.is_dir() and not pasta.name.startswith('_'):
            for f in sorted(pasta.glob('*.jpg')):
                yield f'cathelier/{pasta.name}/{f.stem}', f


# UM ORIGINAL QUE NÃO ABRE NÃO PÁRA A LOJA.
# Os originais já não vêm só do estúdio: a dona junta-os no painel, e um
# ficheiro que o Pillow não abre (um JPEG partido, ou um texto com nome de
# fotografia) rebentava aqui -- e, com o passo do CI em `bash -e`, as guardas,
# o build e a publicação ficavam por correr, nesta publicação e em todas as
# seguintes, por causa de uma fotografia que nenhuma página talvez use.
# Agora avisa e segue. QUEM DECIDE SÃO AS GUARDAS: se um produto publicado
# mostra essa fotografia, scripts/guards.mjs não encontra as versões dela e
# pára com o nome; se nenhum a mostra, a loja publica.
ILEGIVEL = (OSError, SyntaxError, ValueError, Image.DecompressionBombError)


def main():
    modo_folha = '--contact' in sys.argv
    guardados = focos()
    por_produto = {}
    feitos = 0
    ilegiveis = []
    chaves = set()

    for chave, caminho in originais():
        chaves.add(chave)
        destino = SAIDA / f'{chave}.jpg'
        try:
            with Image.open(caminho) as im:
                im = im.convert('RGB')
                manual = guardados.get(chave)
                foco = manual if manual is not None else encontrar_foco(im)
                q = cortar(im, foco)
                if q.size[0] > LADO:
                    q = q.resize((LADO, ALTO), Image.LANCZOS)
        except ILEGIVEL as e:
            ilegiveis.append(chave)
            print(f'  warning: {caminho.relative_to(RAIZ)} cannot be opened ({type(e).__name__}: {e}) '
                  '— skipped; the guards decide whether a page needs it', file=sys.stderr)
            # Um master antigo com o mesmo nome já não corresponde a nada.
            if not modo_folha and destino.exists():
                destino.unlink()
            continue

        produto = chave.split('/')[1]
        if modo_folha:
            por_produto.setdefault(produto, []).append(
                (chave.split('/')[-1], q.copy().resize((300, round(300 / PROPORCAO)), Image.LANCZOS), manual is not None))
        else:
            destino.parent.mkdir(parents=True, exist_ok=True)
            # Escrito ao lado e trocado de uma vez: um master a meio (a corrida
            # interrompida) nunca fica com o nome do verdadeiro.
            meio = destino.with_name(destino.name + '.tmp')
            q.save(meio, 'JPEG', quality=92, optimize=True)
            os.replace(meio, destino)
            feitos += 1

    # OS MASTERS DE UMA FOTOGRAFIA QUE SAIU saem também: o renditions.py gera
    # versões de tudo o que está em photos/_cards, e um master sem original
    # voltava a pôr no site uma fotografia que a dona tirou.
    tirados = 0
    if not modo_folha and chaves:
        for marca in ('ithos', 'cathelier'):
            raiz = SAIDA / marca
            if not raiz.is_dir():
                continue
            for f in sorted(raiz.rglob('*')):
                if f.is_file() and (f.suffix == '.tmp' or f.relative_to(SAIDA).with_suffix('').as_posix() not in chaves):
                    f.unlink()
                    tirados += 1

    if modo_folha:
        FOLHAS.mkdir(parents=True, exist_ok=True)
        nomes = sorted(por_produto)
        # Six products to a sheet: any more and the frames are too small to
        # judge a crop by, which would defeat the point of looking.
        for n in range(0, len(nomes), 6):
            lote = nomes[n:n + 6]
            colunas = max(len(por_produto[p]) for p in lote)
            larg, alt = colunas * 310 + 150, len(lote) * 330 + 20
            folha = Image.new('RGB', (larg, alt), '#F4F1EC')
            d = ImageDraw.Draw(folha)
            for i, p in enumerate(lote):
                y = 20 + i * 330
                d.text((10, y + 140), p, fill='#231F20')
                for j, (nome, mini, manual) in enumerate(por_produto[p]):
                    x = 150 + j * 310
                    folha.paste(mini, (x, y))
                    d.rectangle([x, y, x + 299, y + 299],
                                outline='#C46A3F' if manual else '#B9B0A4', width=3 if manual else 1)
                    d.text((x + 6, y + 6), nome, fill='#fff')
            folha.save(FOLHAS / f'sheet-{n // 6 + 1:02d}.jpg', 'JPEG', quality=88)
        print(f'{len(nomes)} products over {(len(nomes) + 5) // 6} sheets in {FOLHAS.relative_to(RAIZ)}')
    else:
        print(f'{feitos} card masters in {SAIDA.relative_to(RAIZ)}, '
              f'{len(guardados)} of them framed by hand'
              + (f', {tirados} removed (their photograph is gone)' if tirados else '')
              + (f', {len(ilegiveis)} original(s) could not be opened: {", ".join(ilegiveis)}' if ilegiveis else ''))



if __name__ == '__main__':
    main()
