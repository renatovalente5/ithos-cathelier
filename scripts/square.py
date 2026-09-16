#!/usr/bin/env python3
"""
Turns the portrait photographs into the square frames the shop is built on.

WHY THIS EXISTS, AND WHY IT IS THE FIRST TOOL IN THE PROJECT.

The reference shop the client chose shows every product in a 1:1 frame. Our
photographs are not 1:1 — of the 58 studio files, 45 are 1024x1536 and 13 are
full resolution up to 4000x6000, and NOT ONE of them is square. Going to 1:1
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

    python3 scripts/square.py --contact    build the review sheets
    python3 scripts/square.py              write the square masters
"""
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter, ImageDraw
except ImportError:
    sys.exit("Pillow is missing:  python3 -m pip install Pillow")

RAIZ = Path(__file__).resolve().parent.parent
FOTOS = RAIZ / 'photos'
FOCOS = FOTOS / 'focus.json'
SAIDA = FOTOS / '_square'
FOLHAS = FOTOS / '_contact'

# The master is generous on purpose: every web size is derived from it later,
# and the product page gallery on the reference shop serves 893px.
LADO = 1600


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

    # The crop is as tall as the picture is wide.
    janela = max(1, round(pw * larg / larg))          # = pw, in thumbnail terms
    janela = max(1, round(ph * larg / alt))
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
    larg, alt = im.size
    lado = min(larg, alt)
    if alt > larg:
        topo = round(foco * alt - lado / 2)
        topo = max(0, min(alt - lado, topo))
        caixa = (0, topo, larg, topo + lado)
    else:
        esq = round(foco * larg - lado / 2)
        esq = max(0, min(larg - lado, esq))
        caixa = (esq, 0, esq + lado, alt)
    return im.crop(caixa)


def originais():
    for pasta in sorted((FOTOS / 'ithos').iterdir()):
        if pasta.is_dir():
            for f in sorted(pasta.glob('*.jpg')):
                yield f'ithos/{pasta.name}/{f.stem}', f


def main():
    modo_folha = '--contact' in sys.argv
    guardados = focos()
    por_produto = {}
    feitos = 0

    for chave, caminho in originais():
        with Image.open(caminho) as im:
            im = im.convert('RGB')
            manual = guardados.get(chave)
            foco = manual if manual is not None else encontrar_foco(im)
            q = cortar(im, foco)
            if q.size[0] > LADO:
                q = q.resize((LADO, LADO), Image.LANCZOS)

            produto = chave.split('/')[1]
            if modo_folha:
                por_produto.setdefault(produto, []).append(
                    (chave.split('/')[-1], q.copy().resize((300, 300), Image.LANCZOS), manual is not None))
            else:
                destino = SAIDA / f'{chave}.jpg'
                destino.parent.mkdir(parents=True, exist_ok=True)
                q.save(destino, 'JPEG', quality=92, optimize=True)
                feitos += 1

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
        print(f'{feitos} square masters in {SAIDA.relative_to(RAIZ)}, '
              f'{len(guardados)} of them framed by hand')



if __name__ == '__main__':
    main()
