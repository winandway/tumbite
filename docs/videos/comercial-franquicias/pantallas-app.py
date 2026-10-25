"""Pantallas reales de la app para el comercial de franquicias (25 oct 2026).

Toma las capturas originales del recorrido (docs/capturas/recorrido), tapa el logo de la marca con
un letrero «SU MARCA» (el inversionista pone la suya) y mete cada pantalla en un marco de teléfono,
en PNG con fondo transparente para ponerla encima del video en chroma.
Uso: python3 docs/videos/comercial-franquicias/pantallas-app.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..'))
ORIGEN = os.path.join(RAIZ, 'docs', 'capturas', 'recorrido')
SALIDA = os.path.join(AQUI, 'pantallas')
FUENTE = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'

# (archivo de salida, captura original, caja del logo a tapar o None)
PANTALLAS = [
    ('15-1-app-cliente-inicio', 'cliente-inicio-es', (36, 30, 440, 136)),
    ('15-2-app-cliente-menu', 'cliente-menu-es', None),
    ('15-3-app-cliente-carrito', 'cliente-carrito-es', None),
    ('15-4-app-cliente-seguimiento', 'cliente-en-camino-es', None),
    ('16-1-app-restaurante-pedido-nuevo', 'restapp-nuevo-es', (36, 26, 395, 170)),
    ('16-2-app-repartidor-oferta', 'repartidor-oferta-es', (250, 22, 605, 160)),
    ('16-3-app-repartidor-en-camino', 'repartidor-en-camino-es', (250, 22, 605, 160)),
    ('16-4-app-repartidor-ganancias', 'repartidor-ganancias-es', (250, 22, 605, 160)),
]


def tapar_logo(im, caja):
    """Pinta encima del logo el color del fondo y un letrero «SU MARCA»."""
    x0, y0, x1, y1 = caja
    fondo = im.getpixel((x0 - 8 if x0 > 8 else x1 + 8, y0 + 4))[:3]
    d = ImageDraw.Draw(im)
    d.rectangle(caja, fill=fondo)
    alto = y1 - y0
    oscuro = sum(fondo) < 400  # pantalla atenuada por la ventana de la oferta
    relleno = (60, 60, 60) if oscuro else (16, 16, 16)
    texto = (150, 150, 150) if oscuro else (255, 255, 255)
    px0, py0, px1, py1 = x0 + 4, y0 + alto * 0.18, x1 - 4, y1 - alto * 0.18
    d.rounded_rectangle((px0, py0, px1, py1), radius=(py1 - py0) / 2, fill=relleno)
    f = ImageFont.truetype(FUENTE, int((py1 - py0) * 0.48))
    t = 'SU MARCA'
    ancho = d.textlength(t, font=f)
    d.text(((px0 + px1 - ancho) / 2, (py0 + py1) / 2), t, font=f, fill=texto, anchor='lm')
    return im


def en_telefono(pantalla):
    """Marco de teléfono negro con esquinas redondeadas, sobre fondo transparente."""
    w, h = pantalla.size
    borde = 34
    radio = 120
    lienzo = Image.new('RGBA', (w + borde * 2, h + borde * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(lienzo)
    d.rounded_rectangle((0, 0, w + borde * 2 - 1, h + borde * 2 - 1), radius=radio + borde, fill=(16, 16, 16, 255))
    d.rounded_rectangle((6, 6, w + borde * 2 - 7, h + borde * 2 - 7), radius=radio + borde - 6, outline=(70, 70, 76, 255), width=4)
    mascara = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, w - 1, h - 1), radius=radio, fill=255)
    lienzo.paste(pantalla, (borde, borde), mascara)
    return lienzo


os.makedirs(SALIDA, exist_ok=True)
telefonos = []
for salida, origen, caja in PANTALLAS:
    im = Image.open(os.path.join(ORIGEN, origen + '.png')).convert('RGB')
    if caja:
        im = tapar_logo(im, caja)
    tel = en_telefono(im)
    tel.save(os.path.join(SALIDA, salida + '.png'))
    telefonos.append(tel)

# Las tres apps juntas: cliente, restaurante y repartidor.
tres = [telefonos[0], telefonos[4], telefonos[5]]
escala = 0.62
peque = [t.resize((int(t.width * escala), int(t.height * escala)), Image.LANCZOS) for t in tres]
sep = 40
ancho = sum(p.width for p in peque) + sep * 2
alto = max(p.height for p in peque) + 120
grupo = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
x = 0
for i, p in enumerate(peque):
    grupo.paste(p, (x, 0 if i == 1 else 120), p)
    x += p.width + sep
grupo.save(os.path.join(SALIDA, '15-0-las-tres-apps.png'))
print(f'listo: {len(PANTALLAS) + 1} pantallas de la app')
