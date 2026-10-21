"""PDF de los cuatro nombres finalistas (Beru, Dono, Drover y Domi, cada uno con «driver»), para el
equipo de marketing. Uso: python3 docs/pdf/nombres-finalistas.py
Luego: node docs/pdf/a-pdf.mjs docs/pdf/nombres-finalistas.html docs/Nombres-finalistas-2026-10-21.pdf
"""
import os

AQUI = os.path.dirname(os.path.abspath(__file__))

# Cada nombre: su paleta, su tipografía y su ícono (SVG propio, sin copiar ninguna marca).
N = [
    dict(clave='beru', nombre='Beru', dominio='berudriver.com', fuente='Fredoka', peso=700,
         c1='#0f6b5a', c2='#c8f169', fondo='#eef7f2', oscuro='#0b2f29',
         dice='«BE-ru», en inglés y en español igual', idea='Corto, redondo y simpático. No significa nada en inglés ni en español, y eso permite llenarlo de marca.',
         icono='<circle cx="32" cy="32" r="30" fill="{c1}"/><path d="M22 16v32h12a9 9 0 0 0 2-17.8A8 8 0 0 0 30 16z" fill="{c2}"/><circle cx="31" cy="39" r="4" fill="{c1}"/><circle cx="29" cy="25" r="3.4" fill="{c1}"/>',
         pros=['Muy corto: dos sílabas, cuatro letras.', 'Se pronuncia igual en inglés y en español.', 'berudriver.com está libre (revisado el 21 oct 2026).', 'Fácil de dibujar y de recordar.'],
         contras=['En la App Store de EE. UU. ya hay dos apps de taxi llamadas «Beru» («Beru taxi» y «beru - заказ такси»): misma categoría que nosotros. Es la pega más grave de los cuatro.', 'Beru fue la tienda en línea de Yandex en Rusia hasta 2020.', 'Existe la marca BERU de Beru AG (repuestos de autos, Alemania) en la oficina de marcas de EE. UU.; su estado no está claro.', 'En inglés suena a «Beru», la tía de Luke Skywalker en Star Wars.'],
         marcas='BERU de Beru AG (Alemania, repuestos de autos): solicitud internacional en EE. UU., con un rechazo en 2009; estado actual sin confirmar.',
         tiendas='Dos apps de taxi llamadas Beru en la App Store de EE. UU.',
         nota=2),
    dict(clave='dono', nombre='Dono', dominio='donodriver.com', fuente='Outfit', peso=800,
         c1='#ff7a1a', c2='#1d1d1f', fondo='#fff4ea', oscuro='#1d1d1f',
         dice='«DO-no» en español; en inglés se lee «DOU-nou»', idea='Cálido y directo. En portugués e italiano «dono» es «dueño» y «regalo».',
         icono='<rect x="2" y="2" width="60" height="60" rx="18" fill="{c1}"/><path d="M20 26h24l-2.5 22h-19z" fill="#fff"/><path d="M26 26v-3a6 6 0 0 1 12 0v3" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="38" r="4" fill="{c1}"/>',
         pros=['Corto y fácil de escribir.', 'donodriver.com está libre (revisado el 21 oct 2026).', 'En portugués e italiano tiene un sentido positivo (dueño, regalo).'],
         contras=['DONO LLC, de Irvine, California, tiene registrada la marca DONO en EE. UU. desde 2022 para software (clase 9) y finanzas: la misma clase que una app. Es un riesgo legal serio.', 'En inglés suena parecido a «dunno» («no sé»), que se usa mucho en la calle.', 'Ya hay una app de pizzas llamada «Dono» en la App Store (de Ucrania).'],
         marcas='DONO de DONO LLC (Irvine, California): registrada en 2022, clases 9 (software) y 36 (finanzas).',
         tiendas='«Dono pizza» (Eatery Club) en la App Store.',
         nota=1),
    dict(clave='drover', nombre='Drover', dominio='droverdriver.com', fuente='Archivo Black', peso=400,
         c1='#111111', c2='#ffd400', fondo='#f5f5f0', oscuro='#111111',
         dice='«DROU-ver», muy natural en inglés', idea='Es una palabra del inglés: el arriero, quien conduce el ganado de un lugar a otro. Suena a camino y a movimiento.',
         icono='<rect x="2" y="2" width="60" height="60" rx="14" fill="{c1}"/><path d="M14 46 L32 16 L50 46" fill="none" stroke="{c2}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M32 28v6M32 38v4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
         pros=['Suena fuerte y natural en inglés, el idioma principal del mercado.', 'Su significado habla de conducir y de llevar algo de un lugar a otro.', 'droverdriver.com está libre (revisado el 21 oct 2026).'],
         contras=['La marca DROVER está registrada en EE. UU. desde 2020 para software de coordinación de grupos en viajes y eventos (clase 9): cercano a nuestra categoría. Hay que verlo con abogado.', '«Drover driver» repite la idea: las dos palabras significan conductor.', 'Drover fue una empresa de suscripción de autos en el Reino Unido (cerró en 2022) y hoy hay una app de envíos en Nigeria llamada DroverDispatch.', 'En español no se entiende y cuesta pronunciarlo.'],
         marcas='DROVER: registrada en EE. UU. en julio de 2020 (serie 88435056), software para coordinar grupos en viajes y eventos.',
         tiendas='DroverDispatch (envíos, Nigeria) en la App Store.',
         nota=3),
    dict(clave='domi', nombre='Domi', dominio='domidriver.com', fuente='Baloo 2', peso=800,
         c1='#e8452c', c2='#ffe8c7', fondo='#fff3ef', oscuro='#2a1410',
         dice='«DO-mi», igual en inglés y en español', idea='En Colombia y en buena parte de Latinoamérica «domi» es como se le dice al domicilio. Dice lo que hacemos sin explicarlo.',
         icono='<circle cx="32" cy="32" r="30" fill="{c1}"/><path d="M32 13 13 29h5v20h28V29h5z" fill="{c2}"/><path d="M27 49V37a5 5 0 0 1 10 0v12" fill="{c1}"/>',
         pros=['Para el público latino dice exactamente lo que hacemos: el domicilio.', 'Muy corto, dos sílabas, y se pronuncia igual en los dos idiomas.', 'domidriver.com está libre (revisado el 21 oct 2026).', 'La única marca DOMI registrada en EE. UU. que encontramos es de muebles (clase 20): otra categoría.'],
         contras=['Ya hay una app de comida en Colombia llamada «Domii» (Domii SAS) en la App Store: si algún día vamos a Colombia, se confunde.', 'Se parece un poco a Domino’s, también de comida a domicilio.', 'Para quien no habla español, «domi» no significa nada (igual que Beru o Dono).'],
         marcas='DOMI de Domi Outdoor Living (Países Bajos): registrada en 2017 para muebles (clase 20). No encontramos otra DOMI viva.',
         tiendas='«Domii» (Domii SAS, comida, Colombia) en la App Store.',
         nota=4),
]


def icono(x, tam='18mm'):
    return f'<svg viewBox="0 0 64 64" width="{tam}" height="{tam}">' + x['icono'].replace('{c1}', x['c1']).replace('{c2}', x['c2']) + '</svg>'


def logo(x, claro=True, alto='22mm'):
    color = x['oscuro'] if claro else '#ffffff'
    sec = x['c1'] if claro else x['c2']
    return (f'<div class="logo" style="height:{alto}">{icono(x, alto)}'
            f'<div class="marca"><span class="grande" style="font-family:\'{x["fuente"]}\';font-weight:{x["peso"]};color:{color}">{x["nombre"]}</span>'
            f'<span class="chica" style="color:{sec}">driver</span></div></div>')


def lista(items, clase):
    return '<ul class="' + clase + '">' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'


def pagina(x, i):
    estrellas = '●' * x['nota'] + '○' * (4 - x['nota'])
    return f'''
<section class="hoja" style="--c1:{x['c1']};--c2:{x['c2']};--fondo:{x['fondo']}">
  <div class="cabeza"><span class="num">Nombre {i} de 4</span><span class="puesto">Nuestra opinión: {estrellas}</span></div>
  <div class="dos">
    <div>
      <div class="nombre-grande" style="font-family:'{x['fuente']}';font-weight:{x['peso']};color:{x['oscuro']}">{x['nombre']}<span style="color:{x['c1']}">driver</span></div>
      <div class="dominio"><span>Dominio</span><b>{x['dominio']}</b><em>libre el 21 oct 2026</em></div>
      <p class="idea">{x['idea']}</p>
      <p class="dice"><b>Cómo se dice:</b> {x['dice']}.</p>
      <div class="lienzos">
        <div class="lienzo claro">{logo(x, True)}</div>
        <div class="lienzo" style="background:{x['oscuro']}">{logo(x, False)}</div>
        <div class="app"><div class="icono-app" style="background:{x['fondo']}">{icono(x, '15mm')}</div><span>{x['nombre']}</span></div>
      </div>
    </div>
    <div>
      <h3>A favor</h3>{lista(x['pros'], 'pro')}
      <h3 style="margin-top:4mm">En contra</h3>{lista(x['contras'], 'contra')}
      <div class="dato"><b>Marcas registradas en EE. UU.</b><span>{x['marcas']}</span></div>
      <div class="dato"><b>Apps con nombre parecido</b><span>{x['tiendas']}</span></div>
    </div>
  </div>
  <div class="pie"><span>Propuesta de nombre · para el equipo de marketing</span><span>{i + 2}</span></div>
</section>'''


fuentes = 'family=Poppins:wght@500;600;700;800&family=Montserrat:wght@400;500;600;700&family=Fredoka:wght@600;700&family=Outfit:wght@700;800&family=Archivo+Black&family=Baloo+2:wght@700;800'
orden = sorted(N, key=lambda x: -x['nota'])
fila = ''.join(f'''<tr><td><div style="display:flex;align-items:center;gap:3mm">{icono(x, '9mm')}<b style="font-family:'{x['fuente']}';font-size:14pt;color:{x['oscuro']}">{x['nombre']}<span style="color:{x['c1']};font-size:9pt">driver</span></b></div></td>
<td>{x['dominio']}</td><td>{x['dice'].split(',')[0]}</td><td>{x['marcas'].split(':')[0]}</td><td>{x['tiendas']}</td><td class="nota">{'●' * x['nota']}{'○' * (4 - x['nota'])}</td></tr>''' for x in orden)

html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Nombres finalistas</title>
<link href="https://fonts.googleapis.com/css2?{fuentes}&display=swap" rel="stylesheet">
<style>
@page {{ size: A4 landscape; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: Montserrat, sans-serif; color: #26262b; font-size: 9.6pt; line-height: 1.45; }}
.hoja {{ width: 297mm; height: 210mm; padding: 12mm 15mm; position: relative; page-break-after: always; overflow: hidden; background: var(--fondo, #fafaf7); }}
.hoja:last-child {{ page-break-after: auto; }}
h1, h2, h3 {{ font-family: Poppins, sans-serif; color: #17171a; }}
h2 {{ font-size: 20pt; font-weight: 800; margin-bottom: 2mm; }}
h3 {{ font-size: 11pt; font-weight: 700; margin-bottom: 1.5mm; }}
.sub {{ color: #5d5d66; font-size: 10.5pt; max-width: 235mm; margin-bottom: 6mm; }}
.cabeza {{ display: flex; justify-content: space-between; font-family: Poppins; font-size: 8.5pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--c1); margin-bottom: 3mm; }}
.dos {{ display: grid; grid-template-columns: 1.08fr 1fr; gap: 10mm; }}
.nombre-grande {{ font-size: 54pt; line-height: 1; letter-spacing: -1px; }}
.nombre-grande span {{ font-size: 22pt; letter-spacing: 0; font-family: Poppins; font-weight: 600; margin-left: 1.5mm; }}
.dominio {{ margin-top: 4mm; display: inline-flex; align-items: baseline; gap: 3mm; border: 1px solid #2a2a2a; border-radius: 10px; padding: 2.5mm 4mm; background: #fff; }}
.dominio span {{ font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px; color: #6b6b6b; }}
.dominio b {{ font-family: Poppins; font-size: 15pt; color: #17171a; }}
.dominio em {{ font-style: normal; font-size: 8pt; color: #0f8a4a; font-weight: 700; }}
.idea {{ margin-top: 4mm; font-size: 10.5pt; max-width: 135mm; }}
.dice {{ margin-top: 2mm; font-size: 9pt; color: #45454d; }}
.lienzos {{ margin-top: 6mm; display: grid; grid-template-columns: 1fr 1fr 32mm; gap: 4mm; align-items: stretch; }}
.lienzo {{ border: 1px solid #2a2a2a; border-radius: 12px; padding: 6mm 4mm; display: flex; align-items: center; justify-content: center; }}
.lienzo.claro {{ background: #fff; }}
.logo {{ display: flex; align-items: center; gap: 2.5mm; }}
.marca {{ display: flex; flex-direction: column; line-height: .9; }}
.marca .grande {{ font-size: 26pt; }}
.marca .chica {{ font-family: Poppins; font-weight: 600; font-size: 8.5pt; letter-spacing: 3px; text-transform: uppercase; margin-top: 1mm; }}
.app {{ display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; font-size: 8pt; color: #45454d; }}
.icono-app {{ width: 24mm; height: 24mm; border-radius: 6mm; display: flex; align-items: center; justify-content: center; border: 1px solid #2a2a2a; }}
ul.pro, ul.contra {{ list-style: none; }}
ul.pro li, ul.contra li {{ padding: 1.3mm 0 1.3mm 5mm; position: relative; border-bottom: 1px solid rgba(0,0,0,.07); }}
ul.pro li::before {{ content: "✓"; position: absolute; left: 0; color: #0f8a4a; font-weight: 700; }}
ul.contra li::before {{ content: "!"; position: absolute; left: .8mm; color: #c62828; font-weight: 800; }}
.dato {{ margin-top: 3mm; border: 1px solid #2a2a2a; border-radius: 10px; padding: 2.5mm 3.5mm; background: #fff; font-size: 8.6pt; }}
.dato b {{ display: block; font-family: Poppins; font-size: 8.5pt; margin-bottom: .5mm; }}
table {{ width: 100%; border-collapse: collapse; font-size: 8.8pt; background: #fff; }}
th {{ text-align: left; font-family: Poppins; font-weight: 600; font-size: 8pt; color: #6b6b6b; border-bottom: 1.5px solid #17171a; padding: 2mm; }}
td {{ padding: 2.4mm 2mm; border-bottom: 1px solid #ececec; vertical-align: middle; }}
td.nota {{ font-size: 13pt; letter-spacing: 1px; color: #17171a; white-space: nowrap; }}
.pie {{ position: absolute; left: 15mm; right: 15mm; bottom: 6mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #6b6b6b; }}
.portada {{ background: #17171a; color: #fff; }}
.portada h1 {{ color: #fff; font-size: 38pt; font-weight: 800; line-height: 1.05; letter-spacing: -.8px; }}
.portada p {{ color: #cfcfd4; font-size: 11pt; max-width: 150mm; }}
.rejilla {{ margin-top: 12mm; display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; }}
.rejilla div {{ background: #fff; border-radius: 12px; padding: 6mm 3mm; display: flex; justify-content: center; }}
.caja {{ border: 1px solid #2a2a2a; border-radius: 12px; padding: 5mm; background: #fff; }}
.col2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }}
ol.pasos {{ padding-left: 5mm; }} ol.pasos li {{ margin-bottom: 2mm; }}
</style></head><body>

<section class="hoja portada">
  <div style="font-family:Poppins;font-size:8.5pt;font-weight:700;letter-spacing:1.4px;color:#ffd400;text-transform:uppercase">Para el equipo de marketing · 21 de octubre de 2026</div>
  <h1 style="margin-top:5mm">Cuatro nombres para la app,<br>cada uno con su logo</h1>
  <p style="margin-top:5mm">El primer nombre va en grande: es la marca que la gente va a decir y la que trabajaremos en buscadores. «driver» va pequeño, como apellido: sirve para encontrarnos en Google y en las tiendas de apps y para tener el dominio punto com.</p>
  <div class="rejilla">{''.join(f'<div>{logo(x, True, "17mm")}</div>' for x in N)}</div>
  <p style="margin-top:10mm;font-size:8.5pt;color:#9a9aa2">Los cuatro punto com están libres (registro oficial de los dominios .com, 21 oct 2026). Las marcas y apps se revisaron en fuentes públicas; antes de comprar el nombre, un abogado de marcas tiene que confirmarlo en la oficina de marcas de EE. UU.</p>
  <div class="pie" style="color:#8a8a92"><span>Logos de propuesta, diseñados para este documento</span><span>1</span></div>
</section>

<section class="hoja">
  <h2>Los cuatro, uno al lado del otro</h2>
  <p class="sub">Ordenados de mejor a peor según nuestra revisión. Cuatro puntos es la mejor nota.</p>
  <table><tr><th>Nombre</th><th>Dominio</th><th>Cómo se dice</th><th>Marca registrada que encontramos</th><th>Apps parecidas</th><th>Nota</th></tr>{fila}</table>
  <div class="col2" style="margin-top:7mm">
    <div class="caja"><h3>Nuestra recomendación: Domi</h3><p>Es el único de los cuatro que <b>dice lo que hacemos</b> para el público latino («el domi»), suena igual en inglés y en español, y la marca DOMI que existe en EE. UU. es de muebles, otra categoría. Lo que hay que vigilar: la app colombiana Domii y el parecido con Domino’s.</p></div>
    <div class="caja"><h3>Los que descartaríamos</h3><p><b>Dono:</b> hay una marca DONO registrada para software en California, la misma clase que una app. <b>Beru:</b> ya hay dos apps de taxi llamadas Beru en la App Store de EE. UU. <b>Drover</b> queda en medio: suena muy bien en inglés, pero hay una marca DROVER registrada para software de viajes.</p></div>
  </div>
  <div class="pie"><span>Propuesta de nombre · para el equipo de marketing</span><span>2</span></div>
</section>
{''.join(pagina(x, i + 1) for i, x in enumerate(N))}

<section class="hoja">
  <h2>Antes de elegir: lo que falta revisar</h2>
  <p class="sub">Esta revisión usa fuentes públicas. Antes de comprar el dominio, cambiar las apps y publicar en las tiendas, se hacen estos pasos con el nombre ganador.</p>
  <div class="col2">
    <div class="caja"><h3>Pasos</h3><ol class="pasos">
      <li>Un abogado de marcas busca el nombre en la oficina de marcas de EE. UU. (clases 9, 35, 39 y 43: software, publicidad, transporte y restaurantes) y en Colombia.</li>
      <li>Revisar Google Play (aquí solo se revisó la App Store de EE. UU.).</li>
      <li>Revisar que estén libres los usuarios en Instagram, TikTok, Facebook y X.</li>
      <li>Prueba de oído: decirle el nombre a diez personas (cinco que hablen inglés) y pedirles que lo escriban.</li>
      <li>Comprar el punto com y, si se puede, la versión sin «driver».</li>
      <li>Registrar la marca a nombre de Windoce LLC.</li></ol></div>
    <div class="caja"><h3>Cómo se usa el nombre</h3>
      <p>La marca es el primer nombre: <b>Domi</b>, <b>Beru</b>, <b>Dono</b> o <b>Drover</b>. Es lo que va en el ícono, en la publicidad y en la conversación.</p>
      <p style="margin-top:3mm">«driver» acompaña en pequeño en el logo completo, en el dominio y en el nombre largo de las tiendas (por ejemplo, «Domi Driver: comida y envíos»), para que nos encuentren y para diferenciarnos de otras empresas con el mismo primer nombre.</p>
      <p style="margin-top:3mm">El trabajo en buscadores se hace sobre el primer nombre.</p></div>
  </div>
  <div class="pie"><span>Propuesta de nombre · para el equipo de marketing</span><span>7</span></div>
</section>

<section class="hoja">
  <h2>De dónde salen los datos</h2>
  <ul class="pro" style="max-width:240mm;font-size:8.8pt">
    <li>Dominios: registro oficial de los dominios .com (Verisign), consultado el 21 oct 2026: berudriver.com, donodriver.com, droverdriver.com y domidriver.com, libres. Beru.com, dono.com, drover.com y domi.com están ocupados.</li>
    <li>Apps: buscador oficial de la App Store de EE. UU., 21 oct 2026 (Beru taxi, beru - заказ такси, Dono pizza, Domii, DroverDispatch).</li>
    <li>Marca BERU (Beru AG): Justia Trademarks, serie 79064748; Trademark Directory.</li>
    <li>Marca DONO (DONO LLC, Irvine, California): Trademark Directory.</li>
    <li>Marca DROVER: Justia Trademarks, serie 88435056, registrada en julio de 2020.</li>
    <li>Marca DOMI (Domi Outdoor Living B.V.): TrademarkElite, serie 86876014, registro 5179124.</li>
    <li>Historia de Beru en Rusia: OrderTracker; historia de Drover en el Reino Unido: Wikipedia, Tech.eu y AM Online.</li>
    <li>Son fuentes públicas y de terceros: la oficina de marcas de EE. UU. no se pudo consultar directamente desde aquí. Lo confirma el abogado.</li>
  </ul>
  <div class="pie"><span>© 2026 Windoce LLC</span><span>8</span></div>
</section>
</body></html>'''

open(os.path.join(AQUI, 'nombres-finalistas.html'), 'w').write(html)
print('listo')
