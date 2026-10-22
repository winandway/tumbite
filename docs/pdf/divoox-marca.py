"""PDF de la marca propuesta Divoox (22 oct 2026): dominio, revisión, logos, escudos, ventajas y pronunciación.
Uso: python3 docs/pdf/divoox-marca.py
Luego: node docs/pdf/a-pdf.mjs docs/pdf/divoox-marca.html docs/Divoox-marca-2026-10-22.pdf
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from goox_logos import ESCUDOS, FAVORITOS, GRUPOS, LOGOS as _LOGOS_GOOX


def a_divoox(t):
    # Mismos dibujos; la palabra pasa de Goox a Divoox (seis letras: un poco más pequeña).
    for a, b in [('>Goox<', '>Divoox<'), ('font-size:30pt', 'font-size:23pt'), ('font-size:36pt', 'font-size:30pt'),
                 ('>Goo</span>', '>Divoo</span>'), ('G<svg viewBox="0 0 52 26"', 'Div<svg viewBox="0 0 52 26"'),
                 ('GO<br><span style="color:#ff6b00">OX</span>', 'DIV<br><span style="color:#ff6b00">OOX</span>'),
                 ('font-size="19" fill="#fff" letter-spacing="1">GO</text>', 'font-size="15" fill="#fff" letter-spacing="1">DIV</text>'),
                 ('font-size="19" fill="#ff6b00" letter-spacing="1">OX</text>', 'font-size="15" fill="#ff6b00" letter-spacing="1">OOX</text>'),
                 ('>G</text>', '>D</text>'), ('height:1.2mm;background:#fff', 'height:.6mm;background:#fff'), ('GO arriba, OX abajo: un cuadrado que se lee de un vistazo y dice «go».', 'DIV arriba, OOX abajo: un bloque que se lee de un vistazo.')]:
        t = t.replace(a, b)
    return t


LOGOS = [tuple(a_divoox(x) if isinstance(x, str) else x for x in l) for l in _LOGOS_GOOX
         if l[0] != 'g' and l[1] != 'Llanta G']

AQUI = os.path.dirname(os.path.abspath(__file__))


def palabra(fuente, peso, color, tam=34, estilo='normal', esp=0, texto='Goox'):
    return f'<span style="font-family:\'{fuente}\';font-weight:{peso};font-style:{estilo};color:{color};font-size:{tam}pt;letter-spacing:{esp}px;line-height:1">{texto}</span>'


def driver(color, fuente='Poppins', abajo=True, tam=8.5):
    return f'<span style="font-family:\'{fuente}\';font-weight:600;color:{color};font-size:{tam}pt;letter-spacing:3px;text-transform:uppercase;{"margin-top:1.2mm" if abajo else "margin-left:1.5mm;align-self:flex-end;margin-bottom:1.5mm"}">driver</span>'


# Diez propuestas: (nombre, idea, fondo, ícono SVG 64x64, html de la marca)
L = [
    ('Dos ruedas', 'Las dos «o» son las ruedas de una moto: movimiento y reparto.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#111"/><circle cx="21" cy="40" r="9" fill="none" stroke="#c6f432" stroke-width="5"/><circle cx="43" cy="40" r="9" fill="none" stroke="#c6f432" stroke-width="5"/><path d="M21 40 30 24h10l3 16" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>',
     palabra('Poppins', 800, '#111') + driver('#5a8a00')),
    ('Carita amable', 'Las «o» son ojos: una marca cercana, que sonríe.', '#fff4e6',
     '<circle cx="32" cy="32" r="30" fill="#ff7a00"/><circle cx="23" cy="28" r="6" fill="#fff"/><circle cx="41" cy="28" r="6" fill="#fff"/><circle cx="24" cy="29" r="2.6" fill="#111"/><circle cx="42" cy="29" r="2.6" fill="#111"/><path d="M22 41q10 8 20 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
     palabra('Fredoka', 700, '#3a1d00') + driver('#ff7a00', 'Fredoka')),
    ('Cruce de caminos', 'La «x» es un cruce: conectamos restaurantes, gente y destinos.', '#fffbe0',
     '<rect width="64" height="64" rx="12" fill="#ffd400"/><path d="M14 14 50 50M50 14 14 50" stroke="#111" stroke-width="9" stroke-linecap="round"/><path d="M14 14 50 50M50 14 14 50" stroke="#ffd400" stroke-width="1.6" stroke-dasharray="4 5"/>',
     palabra('Archivo Black', 400, '#111') + driver('#111')),
    ('Ruta infinita', 'Las «oo» forman un recorrido que no se corta.', '#eaf7f6',
     '<circle cx="32" cy="32" r="30" fill="#0b7a75"/><path d="M14 32c0-7 5-11 10-11 8 0 8 22 16 22 5 0 10-4 10-11s-5-11-10-11c-8 0-8 22-16 22-5 0-10-4-10-11z" fill="none" stroke="#fff" stroke-width="5"/>',
     palabra('Outfit', 800, '#063b39') + driver('#0b7a75', 'Outfit')),
    ('Velocidad', 'Letra inclinada y líneas de viento: llega rápido.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#e8222c"/><path d="M12 24h18M8 32h22M12 40h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M34 18h12l-6 28H28z" fill="#fff"/>',
     palabra('Barlow', 900, '#e8222c', estilo='italic') + driver('#111', 'Barlow')),
    ('La caja', 'Un paquete: comida, mercado y envíos.', '#f6efe6',
     '<rect width="64" height="64" rx="14" fill="#7a4a24"/><path d="M14 24 32 15l18 9v20l-18 9-18-9z" fill="#e8c69a"/><path d="M14 24l18 9 18-9M32 33v20" fill="none" stroke="#7a4a24" stroke-width="3"/>',
     palabra('Montserrat', 800, '#3b2412') + driver('#7a4a24', 'Montserrat')),
    ('Minimalista', 'En minúsculas, limpio, de empresa de tecnología.', '#ffffff',
     '<rect width="64" height="64" rx="32" fill="#1257ff"/><circle cx="25" cy="32" r="7" fill="#fff"/><circle cx="41" cy="32" r="7" fill="none" stroke="#fff" stroke-width="4"/>',
     palabra('Sora', 700, '#0a1a3f', texto='goox') + driver('#1257ff', 'Sora')),
    ('Insignia', 'Un sello redondo, para gorras, cascos y maletas de reparto.', '#eef8ee',
     '<circle cx="32" cy="32" r="30" fill="#1f8a3a"/><circle cx="32" cy="32" r="23" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="3 3"/><text x="32" y="39" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="20" fill="#fff">G</text>',
     palabra('Baloo 2', 800, '#0f4a1f') + driver('#1f8a3a', 'Baloo 2')),
    ('Calle', 'Letra alta y angosta, de cartel de carretera.', '#0e1b2c',
     '<rect width="64" height="64" rx="10" fill="#f2a900"/><path d="M22 54 30 10h4l8 44" fill="#0e1b2c"/><path d="M32 16v6M32 28v6M32 40v6" stroke="#f2a900" stroke-width="2.5"/>',
     palabra('Bebas Neue', 400, '#ffffff', tam=42, esp=2) + driver('#f2a900', 'Poppins', False)),
    ('Flecha', 'La «G» que avanza: siempre en camino.', '#fff1ee',
     '<rect width="64" height="64" rx="18" fill="#ff5a3c"/><path d="M44 22a15 15 0 1 0 3 14H33" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M40 30l8 6-8 6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
     palabra('Space Grotesk', 700, '#2d0f08') + driver('#ff5a3c', 'Space Grotesk')),
]

IDIOMAS = [
    ('Inglés', 'di-VÚKS', 'algunos dirán «dai-VÚKS»: se fija una sola forma en la publicidad'),
    ('Español', 'di-VÚKS', 'la doble o se dice «u», como en Google'),
    ('Portugués', 'dji-VÚKS', 'en Brasil la «di» suena «dji»; natural'),
    ('Francés', 'di-VÚKS', 'se escribe «divouks» al decirlo'),
    ('Italiano', 'di-VÚKS', 'sin cambios'),
    ('Alemán', 'di-FÚKS / di-VÚKS', 'en alemán la v suele sonar f; en marca se enseña «di-VÚKS»'),
    ('Chino mandarín', 'dí wǔ kè sī · 迪武克斯', 'adaptación por sílabas, como se hace con las marcas extranjeras'),
    ('Japonés', 'divūkusu · ディヴークス', 'adaptación al silabario katakana'),
    ('Árabe', 'dīfūks · ديفوكس', 'el árabe no tiene v; se adapta con f'),
    ('Hindi', 'divūks · डिवूक्स', 'fácil, dos sílabas'),
    ('Ruso', 'divuks · Дивукс', 'corto y directo'),
]


def icono(svg, tam='17mm'):
    return f'<svg viewBox="0 0 64 64" width="{tam}" height="{tam}">{svg}</svg>'


def bloque_logo(i, l):
    nombre, idea, fondo, svg, marca = l
    oscuro = fondo in ('#0e1b2c',)
    return f'''<div class="ficha">
  <div class="lienzo" style="background:{fondo}">
    <div class="logo">{icono(svg)}<div class="marca" style="{'flex-direction:row' if 'margin-left' in marca else ''}">{marca}</div></div>
  </div>
  <div class="pie-ficha"><b>{i}. {nombre}</b><span>{idea}</span><div class="mini" style="background:{fondo}">{icono(svg, '9mm')}</div></div>
</div>'''



def tarjeta(n, l, alto='36mm'):
    _g, nombre, idea, fondo, svg, marca = l
    return f'''<div class="ficha">
  <div class="lienzo" style="background:{fondo};height:{alto}"><div class="logo" style="{'transform:scale(1.15)' if alto != '36mm' else ''}">{icono(svg)}<div class="marca">{marca}</div></div></div>
  <div class="pie-ficha"><b>{n}. {nombre}</b><span>{idea}</span><div class="mini" style="background:{fondo}">{icono(svg, '9mm')}</div></div>
</div>'''


numero = 10
def pagina_grupo(claves, cols, alto='36mm'):
    global numero
    partes = ''
    for clave in claves:
        titulo, texto = next((t, d) for c, t, d in GRUPOS if c == clave)
        items = [l for l in LOGOS if l[0] == clave]
        celdas = ''
        for l in items:
            numero += 1
            celdas += tarjeta(numero, l, alto)
        partes += f'<h3 style="margin-top:3mm">{titulo}</h3><p class="chico-g">{texto}</p><div class="rejilla" style="grid-template-columns:repeat({cols},1fr)">{celdas}</div>'
    return f'''<section class="hoja"><div class="etq">Logos para Divoox</div>{partes}
<div class="pie"><span>Divoox · propuesta de marca</span><span>§</span></div></section>'''


def pagina_favoritos():
    filas = ''
    for nom in FAVORITOS:
        l = next(x for x in LOGOS if x[1] == nom)
        _g, nombre, idea, fondo, svg, marca = l
        filas += f'''<div class="fav">
  <div class="lienzo grande" style="background:{fondo}"><div class="logo" style="transform:scale(1.15)">{icono(svg, '20mm')}<div class="marca">{marca}</div></div></div>
  <div class="lienzo grande oscuro" style="background:#121214"><div class="logo" style="transform:scale(1.15)">{icono(svg, '20mm')}<div class="marca">{marca}</div></div></div>
  <div class="tel"><div class="pantalla">{''.join(f'<div class="ap"></div>' for _ in range(3))}<div class="ap yo" style="background:{fondo}">{icono(svg, '11mm')}</div>{''.join(f'<div class="ap"></div>' for _ in range(4))}</div><span>{nombre}</span></div>
</div>'''
    return f'''<section class="hoja"><div class="etq">Nuestros favoritos</div><h2>Tres caminos, en grande</h2>
<p class="sub">Sobre fondo claro, sobre fondo oscuro (de noche, en la app y en las maletas) y como ícono en la pantalla del celular.</p>{filas}
<div class="pie"><span>Divoox · propuesta de marca</span><span>§</span></div></section>'''


def esc(e, tam):
    return f'<svg viewBox="0 0 200 200" width="{tam}" height="{tam}">{e["svg"]}</svg>'


def marca_escudo(e, color, sec, tam_ic='24mm', tam_txt=34):
    return (f'<div style="display:flex;align-items:center;gap:4mm">{esc(e, tam_ic)}<div style="display:flex;flex-direction:column">'
            f'<span style="font-family:\'Archivo Black\';font-size:{tam_txt}pt;line-height:1;color:{color}">Divoox</span>'
            f'<span style="font-family:Poppins;font-weight:600;font-size:{tam_txt*0.24:.1f}pt;letter-spacing:4px;color:{sec};margin-top:1.5mm">DRIVER</span></div></div>')


def paginas_escudos():
    out = f'''<section class="hoja portada" style="grid-template-columns:1fr 1fr">
  <div><div class="etq" style="color:#ff3008">La idea de Richard</div>
    <div class="gigante" style="font-size:64pt">El escudo<span style="color:#ff3008">DIVOOX</span></div>
    <p style="margin-top:8mm">El escudo de pelea de los vikingos: madera, una X roja, el borde de hierro con remaches. Tiene la X de Divoox en el centro, el borde parece una rueda y su significado es uno solo: <b>protección</b>. Lo que le prometemos a quien pide, a quien entrega y a quien cocina.</p>
    <p style="margin-top:4mm">Usa los colores que ya tiene la app: rojo, blanco y gris oscuro. Tres versiones, una hoja para cada una.</p></div>
  <div style="display:flex;gap:6mm;justify-content:center">{''.join(esc(e, '40mm') for e in ESCUDOS)}</div>
  <div class="pie" style="color:#8a8a92"><span>Divoox · propuesta de marca</span><span>§</span></div>
</section>'''
    for i, e in enumerate(ESCUDOS, 1):
        sw = ''.join(f'<div class="sw"><i style="background:{c}"></i><b>{n}</b><span>{c.upper()}</span></div>' for c, n in e['colores'])
        tamanos = ''.join(f'<div class="tm">{esc(e, t)}<span>{t}</span></div>' for t in ('22mm', '14mm', '9mm', '5mm'))
        out += f'''<section class="hoja" style="background:#f4f3ef">
  <div class="etq" style="color:#ff3008">Escudo {i} de 3</div>
  <div class="hojaesc">
    <div class="heroe">{esc(e, '128mm')}</div>
    <div>
      <h2>{e["nombre"]}</h2>
      <p class="sub" style="margin-bottom:4mm">{e["idea"]}</p>
      <div class="lienzo grande" style="background:#fff;height:30mm">{marca_escudo(e, '#191919', '#ff3008')}</div>
      <div class="lienzo grande" style="background:#191919;height:30mm;margin-top:3mm">{marca_escudo(e, '#ffffff', '#ff3008')}</div>
      <div class="filaesc">
        <div class="tel"><div class="pantalla">{''.join('<div class="ap"></div>' for _ in range(4))}<div class="ap yo" style="background:#fff">{esc(e, '8mm')}</div>{''.join('<div class="ap"></div>' for _ in range(3))}</div><span>En el celular</span></div>
        <div><h3>En tamaño pequeño</h3><div class="tms">{tamanos}</div>
          <h3 style="margin-top:3mm">Colores</h3><div class="sws">{sw}</div></div>
      </div>
      <p class="chico-g" style="margin-top:3mm"><b>Dónde se usa:</b> {e["uso"]}</p>
    </div>
  </div>
  <div class="pie"><span>Divoox · propuesta de marca · escudo</span><span>§</span></div>
</section>'''
    return out

fuentes = ('family=Poppins:wght@500;600;700;800&family=Montserrat:wght@400;500;600;700;800&family=Fredoka:wght@600;700'
           '&family=Outfit:wght@700;800&family=Archivo+Black&family=Baloo+2:wght@700;800&family=Barlow:ital,wght@1,900;0,600'
           '&family=Sora:wght@600;700&family=Bebas+Neue&family=Space+Grotesk:wght@600;700&display=swap')

ventajas = [
    ('El punto com, libre', 'divoox.com, el nombre solo y sin apellido, está libre (registro oficial, 22 oct 2026). La marca y el dominio son lo mismo.'),
    ('Único en las tiendas', 'Ninguna app llamada Divoox en la App Store ni en Google Play, y ninguna marca registrada con ese nombre en los registros públicos.'),
    ('D y V de delivery', 'Empieza como «delivery» y termina con la fuerza de la X: dice movimiento y entrega sin explicarlo.'),
    ('Las dos o y la X', 'Se presta para ruedas, ojos, origen y destino, y para la X del escudo: todos los logos funcionan.'),
    ('Dos sílabas', 'Seis letras, fácil de decir y de recordar: «pídelo por Divoox».'),
    ('Un solo nombre para todo', 'Comida, motos, carros y envíos bajo la misma marca. «Driver» queda solo para la app de repartidores.'),
    ('Marca registrable', 'Es una palabra inventada: más fácil de registrar y proteger que una palabra común.'),
    ('Funciona en el mundo', 'Se pronuncia casi igual en los idiomas más hablados y no tiene un significado malo en inglés ni en español.'),
]
tener_en_cuenta = [
    'Existe Divox, con una sola o: software para restaurantes de una empresa de la India, con una app de repartidores («Divox Rider») en la App Store de EE. UU. y de Colombia. Mismo rubro y una letra de diferencia: el abogado lo revisa antes de comprar.',
    'Entre 2007 y 2009 divoox.com fue una página en español para ver películas y series en línea; después se vendió y se dejó vencer. Es contenido de hace más de quince años: riesgo bajo.',
    'En TikTok @divoox ya existe; @divooxdriver está libre. Instagram, Facebook y X se revisan desde un teléfono con sesión.',
    'Hay que fijar una sola pronunciación desde la primera publicidad, «di-VÚKS», y alejar el diseño de marcas parecidas: Divoom (parlantes), DivX (video) y Deliveroo (reparto en Europa).',
]

html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Divoox</title>
<link href="https://fonts.googleapis.com/css2?{fuentes}" rel="stylesheet">
<style>
@page {{ size: A4 landscape; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: Montserrat, sans-serif; color: #1f1f23; font-size: 9.6pt; line-height: 1.45; }}
.hoja {{ width: 297mm; height: 210mm; padding: 12mm 15mm; position: relative; page-break-after: always; overflow: hidden; background: #f7f7f3; }}
.hoja:last-child {{ page-break-after: auto; }}
h1, h2, h3 {{ font-family: Poppins, sans-serif; color: #111; }}
h2 {{ font-size: 21pt; font-weight: 800; margin-bottom: 2mm; letter-spacing: -.3px; }}
h3 {{ font-size: 11pt; font-weight: 700; margin-bottom: 1.5mm; }}
.sub {{ color: #55555c; font-size: 10.5pt; max-width: 235mm; margin-bottom: 6mm; }}
.etq {{ font-family: Poppins; font-size: 8pt; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: #5a8a00; margin-bottom: 2mm; }}
.pie {{ position: absolute; left: 15mm; right: 15mm; bottom: 6mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #6b6b6b; }}
.portada {{ background: #111; color: #fff; display: grid; grid-template-columns: 1.1fr 1fr; gap: 12mm; align-items: center; }}
.portada .gigante {{ font-family: Poppins; font-weight: 800; font-size: 96pt; line-height: .9; letter-spacing: -3px; color: #fff; }}
.portada .gigante span {{ display: block; font-size: 18pt; letter-spacing: 8px; color: #c6f432; font-weight: 600; margin-top: 3mm; }}
.portada p {{ color: #cfcfd4; font-size: 11pt; max-width: 135mm; }}
.dom {{ margin-top: 7mm; display: inline-flex; align-items: baseline; gap: 3mm; background: #fff; color: #111; border-radius: 12px; padding: 3mm 5mm; }}
.dom b {{ font-family: Poppins; font-size: 18pt; }}
.dom em {{ font-style: normal; color: #0f8a4a; font-weight: 800; font-size: 9pt; }}
.captura {{ width: 100%; border-radius: 14px; border: 1px solid #333; }}
.rejilla {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 4mm; }}
.ficha {{ border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; background: #fff; display: flex; flex-direction: column; }}
.lienzo {{ height: 34mm; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #e2e2e2; }}
.logo {{ display: flex; align-items: center; gap: 2.5mm; }}
.lienzo .logo {{ transform: scale(.74); }}
.marca {{ display: flex; flex-direction: column; }}
.pie-ficha {{ padding: 2.5mm 3mm; font-size: 7.8pt; position: relative; min-height: 26mm; }}
.pie-ficha b {{ display: block; font-family: Poppins; font-size: 8.8pt; margin-bottom: .6mm; padding-right: 11mm; }}
.pie-ficha span {{ display: block; color: #55555c; padding-right: 11mm; }}
.mini {{ position: absolute; right: 2.5mm; top: 2.5mm; width: 10mm; height: 10mm; border-radius: 2.6mm; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; }}
.col2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }}
.col4 {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }}
.caja {{ border: 1px solid #2a2a2a; border-radius: 12px; padding: 4.5mm 5mm; background: #fff; }}
.caja h3 {{ color: #111; }}
.caja p {{ font-size: 8.8pt; color: #3d3d44; }}
ul.lista {{ list-style: none; }}
ul.lista li {{ padding: 1.6mm 0 1.6mm 5mm; position: relative; border-bottom: 1px solid #ececec; }}
ul.lista li::before {{ content: "!"; position: absolute; left: .8mm; color: #c47a00; font-weight: 800; }}
table {{ width: 100%; border-collapse: collapse; font-size: 9pt; background: #fff; }}
th {{ text-align: left; font-family: Poppins; font-weight: 600; font-size: 8pt; color: #6b6b6b; border-bottom: 1.5px solid #111; padding: 2mm; }}
td {{ padding: 2.1mm 2mm; border-bottom: 1px solid #ececec; }}
td.dice {{ font-family: Poppins; font-weight: 700; font-size: 11pt; white-space: nowrap; }}
.check {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-top: 5mm; }}
.check div {{ background: #fff; border: 1px solid #2a2a2a; border-radius: 10px; padding: 3mm 4mm; font-size: 8.6pt; }}
.check b {{ display: block; font-family: Poppins; color: #0f8a4a; font-size: 9.5pt; }}
.chico-g {{ font-size: 8.4pt; color: #55555c; margin-bottom: 2.5mm; }}
.fav {{ display: grid; grid-template-columns: 1.3fr 1.3fr .6fr; gap: 4mm; margin-bottom: 4mm; align-items: center; }}
.lienzo.grande {{ height: 40mm; border: 1px solid #2a2a2a; border-radius: 12px; }}
.oscuro .marca span, .oscuro .marca span span {{ color: #fff !important; }} .oscuro .marca svg path {{ stroke: #fff; }} .oscuro .marca svg circle[fill='#111'] {{ fill: #fff; }}
.tel {{ display: flex; flex-direction: column; align-items: center; gap: 1.5mm; font-size: 7.5pt; color: #55555c; }}
.pantalla {{ width: 34mm; height: 40mm; border-radius: 6mm; background: #1c1c22; border: 1.5mm solid #000; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; padding: 4mm 3mm; align-content: start; }}
.ap {{ width: 8mm; height: 8mm; border-radius: 2.2mm; background: #3a3a44; justify-self: center; }}
.ap.yo {{ display: flex; align-items: center; justify-content: center; overflow: hidden; }}
.ap.yo svg {{ width: 8mm; height: 8mm; }}
.hojaesc {{ display: grid; grid-template-columns: 130mm 1fr; gap: 8mm; align-items: start; margin-top: 2mm; }}
.heroe {{ background: #fff; border: 1px solid #2a2a2a; border-radius: 16px; height: 168mm; display: flex; align-items: center; justify-content: center; }}
.filaesc {{ display: grid; grid-template-columns: 38mm 1fr; gap: 5mm; margin-top: 3mm; align-items: start; }}
.tms {{ display: flex; gap: 3.5mm; align-items: flex-end; }}
.tm {{ display: flex; flex-direction: column; align-items: center; gap: 1mm; font-size: 7pt; color: #6b6b6b; }}
.sws {{ display: flex; gap: 2.5mm; }}
.sw {{ display: flex; flex-direction: column; font-size: 7pt; color: #55555c; width: 18mm; }}
.sw i {{ display: block; height: 9mm; border-radius: 6px; border: 1px solid #2a2a2a; margin-bottom: 1mm; }}
.sw b {{ font-family: Poppins; font-size: 7.6pt; color: #111; }}
</style></head><body>

<section class="hoja portada">
  <div>
    <div class="etq" style="color:#ff3008">Propuesta de marca · 22 de octubre de 2026</div>
    <div class="gigante">Divoox<span style="color:#ff3008">COMIDA · VIAJES · ENVÍOS</span></div>
    <p style="margin-top:8mm">Una sola app para comida, motos, carros y envíos. <b>Divoox</b>: la D y la V de delivery, las dos o y la fuerza de la X. Por primera vez, la marca y el dominio son exactamente lo mismo.</p>
    <div class="dom"><b>divoox.com</b><em>DISPONIBLE</em></div>
    <div class="dom" style="margin-left:3mm"><b>App Store y Google Play</b><em>NINGUNA APP DIVOOX</em></div>
  </div>
  <div><img class="captura" style="height:150mm;object-fit:cover;object-position:top" src="img-divoox/dominio-libre.webp" alt="Búsqueda del dominio divoox.com: disponible">
    <p style="margin-top:2mm;font-size:8pt;color:#9a9aa2">Búsqueda del dominio en YaDominios: divoox.com, .net, .org, .co, .io y .me disponibles. Confirmado en el registro oficial de los .com el 22 oct 2026.</p></div>
  <div class="pie" style="color:#8a8a92"><span>Divoox · propuesta de marca</span><span>1</span></div>
</section>

<section class="hoja">
  <div class="etq">Revisión</div>
  <h2>Divoox está libre: lo que revisamos</h2>
  <p class="sub">Antes de enamorarse de un nombre hay que saber si alguien ya lo usa. Esto es lo que encontramos el 22 de octubre de 2026.</p>
  <div class="check">
    <div style="border-color:#0f8a4a;border-width:2px"><b>divoox.com, libre</b>El nombre solo, sin apellido. También divoox.net, divooxdriver.com, divooxapp.com y getdivoox.com.</div>
    <div><b>Sin apps con ese nombre</b>Ninguna app Divoox en la App Store de EE. UU. ni en Google Play.</div>
    <div><b>Sin marcas registradas</b>No encontramos DIVOOX en registros públicos de marcas. Existen DIVX (video) y DEIVVOX (audífonos), otras palabras.</div>
    <div style="border-color:#c47a00;border-width:2px"><b style="color:#c47a00">Ojo: Divox, con una sola o</b>Software para restaurantes de Redspark Technologies (India), con la app de repartidores «Divox Rider» en la App Store de EE. UU. y Colombia. Mismo rubro: lo revisa el abogado.</div>
    <div><b>Historia del dominio</b>De 2007 a 2009 fue un buscador en español de películas y series; después se vendió y se dejó vencer. Riesgo bajo.</div>
    <div><b>Redes</b>TikTok: @divoox existe, @divooxdriver libre. Instagram, Facebook y X: se revisan desde un teléfono.</div>
  </div>
  <div class="caja" style="margin-top:6mm"><h3>Lo que falta antes de comprarlo</h3>
    <p>Comprar divoox.com y divoox.net el mismo día que se decida. Un abogado de marcas lo confirma en la oficina de marcas de EE. UU. (software, transporte, publicidad y restaurantes) y en Colombia, mirando en especial a Divox. Asegurar los usuarios en redes.</p></div>
  <div class="pie"><span>Divoox · propuesta de marca</span><span>2</span></div>
</section>

{pagina_grupo(['x'], 4)}
{pagina_grupo(['o'], 4)}
{pagina_grupo(['w'], 5)}
{pagina_grupo(['s'], 2, '50mm')}
{pagina_favoritos()}
{paginas_escudos()}
<section class="hoja">
  <div class="etq">Ventajas</div>
  <h2>Por qué Divoox</h2>
  <p class="sub">Lo que el nombre le da a la empresa desde el primer día.</p>
  <div class="col4">{''.join(f'<div class="caja"><h3>{t}</h3><p>{d}</p></div>' for t, d in ventajas)}</div>
  <div class="caja" style="margin-top:6mm"><h3>A tener en cuenta</h3><ul class="lista">{''.join(f'<li>{x}</li>' for x in tener_en_cuenta)}</ul></div>
  <div class="pie"><span>Divoox · propuesta de marca</span><span>4</span></div>
</section>

<section class="hoja">
  <div class="etq">Pronunciación</div>
  <h2>Cómo se dice Divoox en los idiomas más hablados</h2>
  <p class="sub">La marca se dice <b>«di-VÚKS»</b>: dos sílabas, la fuerza en la segunda y la doble o como «u», igual que en Google. Así se adapta en cada idioma (aproximado).</p>
  <table><tr><th>Idioma</th><th>Se dice</th><th>Nota</th></tr>
  {''.join(f'<tr><td><b>{a}</b></td><td class="dice">{b}</td><td>{c}</td></tr>' for a, b, c in IDIOMAS)}</table>
  <p style="margin-top:4mm;font-size:8.6pt;color:#55555c">Para la app de repartidores, «Divoox Driver»: «driver» se dice <b>«dráiver»</b> en todos los idiomas.</p>
  <div class="pie"><span>Divoox · propuesta de marca</span><span>5</span></div>
</section>

<section class="hoja">
  <div class="etq">Cómo se usa</div>
  <h2>El nombre en la vida real</h2>
  <div class="col2">
    <div class="caja"><h3>Cómo se escribe</h3><table>
      <tr><td>La marca (ícono, publicidad, conversación)</td><td><b>Divoox</b></td></tr>
      <tr><td>Dominio</td><td><b>divoox.com</b></td></tr>
      <tr><td>Nombre largo en las tiendas</td><td><b>Divoox: Food, Rides & Delivery</b></td></tr>
      <tr><td>Apps</td><td><b>Divoox</b> (cliente), <b>Divoox Driver</b> (repartidor), <b>Divoox for Restaurants</b></td></tr>
      <tr><td>Redes</td><td><b>@divoox</b> donde esté libre; si no, <b>@divooxapp</b> o <b>@divooxdriver</b></td></tr></table></div>
    <div class="caja"><h3>Cómo lo dice la gente</h3>
      <p>«Pídelo por Divoox». «Llegó el Divoox». «¿Vas en Divoox?». Un nombre que se vuelve verbo, como pasó con las grandes.</p>
      <h3 style="margin-top:5mm">Siguientes pasos</h3>
      <p>1. Comprar divoox.com y divoox.net. 2. Abogado de marcas, mirando a Divox. 3. El equipo elige el logo (escudo u otro). 4. Usuarios en redes. 5. Abrir las cuentas de Apple y Google Play con el nombre definitivo. 6. Cambiar la marca en las apps, la web y Docs, pasando por el sitio de pruebas.</p></div>
  </div>
  <div class="pie"><span>© 2026 Windoce LLC</span><span>6</span></div>
</section>
</body></html>'''

contador = iter(range(1, 100))
html = re.sub(r'<span>(\d+|§)</span></div>\s*</section>', lambda m: f'<span>{next(contador)}</span></div></section>', html)
open(os.path.join(AQUI, 'divoox-marca.html'), 'w').write(html)
print('listo')
