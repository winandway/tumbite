"""Plan del lanzamiento de Divoox en Miami, para imprimir y tachar a mano (23 oct 2026).

Genera docs/pdf/plan-lanzamiento.html; el PDF sale con:
  node docs/pdf/a-pdf.mjs docs/pdf/plan-lanzamiento.html docs/Plan-lanzamiento-Divoox-2026-10-23.pdf
Horizontal, en blanco y negro (gasta poca tinta), con una casilla por tarea: a la izquierda lo de
Richard, a la derecha lo de la IA. Fuente: ROADMAP-LANZAMIENTO-MIAMI, SOLICITUD-AUTORIZACIONES,
PENDIENTES y AUDITORIA-MARCA-DIVOOX.
"""
import html
import os

AQUI = os.path.dirname(os.path.abspath(__file__))

# Cada página: (número, título, frase, [tareas de Richard], [tareas de la IA]).
# Cada tarea: (título, detalle, destranca)
PAGINAS = [
    (
        '1',
        'La compra real',
        'Lo primero y lo más importante: demostrar que el cobro con dinero real funciona.',
        [
            ('Comprar un plato de 1 dólar en divoox.com con tu tarjeta',
             'La tarjeta autoriza 4,99 con el envío. Sigue el guion PRUEBA-REAL-1-DOLAR.',
             'Poder anunciar y vender'),
            ('Hacer una segunda compra igual y cancelarla antes de que la acepten',
             'La autorización se anula sola: no se cobra.',
             'Probar la anulación real'),
            ('Mirar en tu banco que solo quedó el cobro correcto',
             'Neto: 3,99 dólares, de los que unos 0,44 son comisión de Stripe.',
             'Cerrar la prueba de dinero'),
        ],
        [
            ('Preparar el restaurante y el plato de 1 dólar', 'En producción, listo para tu compra.'),
            ('Seguir tu pedido en vivo y aceptarlo, prepararlo y entregarlo', 'Con el panel.'),
            ('Devolverte 1,00 dólar (devolución parcial)', 'Desde el panel de soporte.'),
            ('Comprobar en Stripe el cobro, la anulación y la devolución', 'Modo real.'),
            ('Anotarlo como PROBADO en VERIFICAR-PAGOS', 'Con fecha y número de pedido.'),
        ],
    ),
    (
        '2',
        'Las cuentas',
        'Sin estas cuentas las apps no llegan a los teléfonos. Tú pones identidad y tarjeta; lo técnico es mío.',
        [
            ('Apple Developer a nombre de Windoce LLC', '99 dólares al año. Pide el número D-U-N-S de la empresa.', 'App Store, TestFlight y Apple Pay'),
            ('Google Play Console a nombre de Windoce LLC', '25 dólares, una sola vez.', 'Google Play'),
            ('Cuenta de Expo de la empresa', 'Gratis. Y cambiar la clave de Expo que estuvo expuesta.', 'Compilar las apps'),
            ('Google Cloud con facturación (un proyecto «Divoox»)', 'Con la sesión de Google de Windoce.', 'Firebase y la llave del mapa'),
            ('Darme acceso a cada cuenta', 'Como administrador o desarrollador; yo te digo dónde.', 'Que yo haga todo lo demás'),
        ],
        [
            ('Crear los tres proyectos de Expo', 'Cliente, repartidor y restaurante.'),
            ('Crear Firebase solo para avisos y conectarlo a Expo', 'Avisos al celular en Android.'),
            ('Registrar las tres apps en Apple y Google', 'Nombres, íconos e identificadores.'),
            ('Pasarte el plano casilla por casilla si un paso pide algo tuyo', 'Sin listas de comandos.'),
        ],
    ),
    (
        '3',
        'El mapa',
        'Se queda el mapa que ya tenemos. Falta solo una llave, la de Google para Android, y es gratis.',
        [
            ('Nada más que el paso 2 (Google Cloud y Expo)', 'La llave sale de ahí.', 'El mapa en Android'),
        ],
        [
            ('Activar «Maps SDK for Android» en Google Cloud', 'Uso ilimitado sin cobro, según la página de precios de Google.'),
            ('Crear UNA llave restringida a las tres apps de Android', 'Con la huella de firma que da Expo.'),
            ('Ponerla en la configuración de compilación, nunca en el código', 'Hoy dice «PON_AQUI_LA_LLAVE».'),
            ('NO encender buscar direcciones, rutas ni autocompletado', 'Esos sí cobran; si algún día, con tope escrito.'),
            ('Comprobar en un Android real que el mapa sale con calles', 'Sin llave se ve gris.'),
        ],
    ),
    (
        '4',
        'Compilar y probar en teléfonos reales',
        'Lo que en el navegador no se puede probar, se prueba aquí.',
        [
            ('Instalar las apps de prueba en tu iPhone y en un Android', 'Te mando el enlace de TestFlight y el de prueba interna.', 'Probar como usuario'),
        ],
        [
            ('Compilar las tres apps para iPhone y Android', 'Con Expo.'),
            ('Cambiar la dirección del servidor de las apps a divoox.com', 'Auditoría de marca.'),
            ('Cambiar los avisos «tumbite.com/panel» a divoox.com/panel', 'App del restaurante y pantalla de entrar.'),
            ('Probar GPS del repartidor con la app en segundo plano', 'Teléfono real.'),
            ('Probar avisos al celular, cámara, fotos y PIN', 'Teléfono real.'),
            ('Recorrido completo de un pedido en dos teléfonos', 'iPhone y Android.'),
        ],
    ),
    (
        '5',
        'La prueba en la calle',
        'Tres personas reales, pocos pedidos chicos, dinero de verdad.',
        [
            ('Elegir un cliente, un restaurante de Miami y un repartidor', 'Gente de confianza.', 'Arrancar la prueba'),
            ('Hacer tres pedidos completos con ellos', 'Guion: PLAN-DE-PRUEBA-EN-CALLE.', 'Saber que funciona sin ayuda'),
            ('Contarme todo lo que no les gustó', 'Por WhatsApp, con capturas.', 'Arreglar antes de lanzar'),
        ],
        [
            ('Dar de alta y aprobar al restaurante y al repartidor', 'Con verificación.'),
            ('Vigilar cada pedido en el panel en vivo', 'Y responder en soporte.'),
            ('Arreglar lo que aparezca, con su prueba', 'Pasa por el sitio de pruebas.'),
        ],
    ),
    (
        '6',
        'Fichas de las tiendas y lanzamiento cerrado',
        'Se prepara mientras tanto; se sube cuando las pantallas estén cerradas.',
        [
            ('Aprobar los textos y las capturas de las fichas', 'Inglés y español.', 'Subir a las tiendas'),
            ('Elegir los primeros restaurantes del lanzamiento', 'Pocos al principio.', 'Lanzamiento cerrado'),
            ('Decidir si hay promoción de lanzamiento', 'Envío gratis o comisión 0 % por un tiempo.', 'Marketing del lanzamiento'),
        ],
        [
            ('Textos de las fichas en inglés y español', 'App Store y Google Play.'),
            ('Capturas reales al tamaño de cada tienda', 'Salen solas del recorrido.'),
            ('Enlaces de privacidad, términos, soporte y borrar cuenta', 'Ya existen en divoox.com.'),
            ('Subir las apps a revisión de Apple y Google', 'Y responder lo que pidan.'),
            ('Borrar los datos de prueba antes del lanzamiento abierto', 'Ciudades y cuentas de prueba.'),
        ],
    ),
    (
        '7',
        'Configuraciones que solo necesitan tu «sí»',
        'Sin costo. Yo las hago; tú solo autorizas.',
        [
            ('Sí al aviso de cuentas conectadas de Stripe (prueba y real)', 'Alta de restaurantes.', 'Que los restaurantes cobren'),
            ('Sí al escudo anti-robots (Turnstile)', 'Entrar y registrarse.', 'Seguridad contra robots'),
            ('Sí a Apple Pay y Google Pay en Stripe', 'Dos interruptores; Apple depende del paso 2.', 'Pagar con el teléfono'),
            ('Terminar la activación de Connect en Stripe modo prueba', 'Es un formulario tuyo en Stripe.', 'Alta de restaurantes en pruebas'),
            ('Sí a verificar divoox.com como remitente de correos', 'Hoy salen desde la dirección vieja.', 'Correos con la marca nueva'),
        ],
        [
            ('Hacer cada configuración en cuanto digas «sí»', 'Con el canario vigilando cada pieza.'),
            ('Comprobar que el aviso de Stripe llega y queda en verde', 'En la salud del sistema.'),
            ('Cambiar el remitente solo después de verificar el dominio', 'Si no, los correos dejan de llegar.'),
        ],
    ),
    (
        '8',
        'Seguridad (urgente si no está hecho)',
        'Claves que pasaron por donde no debían.',
        [
            ('Cambiar la clave de Expo que estuvo expuesta', 'Va junto con el paso 2.', 'Cuentas seguras'),
            ('Cambiar las contraseñas de las cuentas de prueba expuestas', 'Cliente, repartidor y restaurante.', 'Cuentas seguras'),
            ('Revocar y crear otra llave del sitio de pruebas', 'Pasó por el chat.', 'Sitio de pruebas seguro'),
        ],
        [
            ('Guardar las claves nuevas solo en esta computadora', 'Nunca en el repositorio ni en el chat.'),
            ('Comprobar que nada usa las claves viejas', 'Y avisarte si algo falla.'),
        ],
    ),
    (
        '9',
        'Servicios con costo (cada uno con tope antes de encender)',
        'Ninguno frena el lanzamiento cerrado; se encienden cuando digas, con su límite de gasto.',
        [
            ('Copia de seguridad separada de la base y las fotos', 'Hoy 0 dólares; alerta a los 5 al mes.', 'No perder datos nunca'),
            ('Twilio: llamada con número oculto y SMS de respaldo', 'Prepago.', 'Llamar sin mostrar el número'),
            ('Checkr: antecedentes de repartidores', 'De 30 a 50 dólares por repartidor.', 'Repartidores verificados'),
            ('Autocompletar la dirección (Google Places)', 'Unas 10 000 gratis al mes; con cuota diaria.', 'Escribir menos'),
            ('Tope mensual de la IA del Manager', 'Propuesto: 20 dólares prepago.', 'El Manager con IA'),
            ('Reloj exacto y tiempo real en producción (Cloudflare)', 'Fichas B1 y B2.', 'Avisos al segundo'),
        ],
        [
            ('Montar cada servicio con su tope y su alerta escritos', 'Antes de encender nada.'),
            ('Agregarlo al canario de salud', 'Para que no falle en silencio.'),
            ('Anotar cuenta, tarjeta y dónde se recarga', 'Registro privado de proveedores.'),
        ],
    ),
    (
        '10',
        'Decisiones de negocio',
        'Solo tú las puedes tomar. Yo recomiendo; tú decides.',
        [
            ('Número de WhatsApp de soporte', 'El botón ya está listo en la web y las apps.', 'Soporte por WhatsApp'),
            ('Nombre del negocio que sale en el cobro de la tarjeta', 'Hoy sale «Windoce, LLC».', 'Que el cliente reconozca el cobro'),
            ('Retiro mínimo de restaurantes y repartidores', 'Hoy 1 dólar; recomendado 10.', 'Encender retiros'),
            ('Cuándo la verificación de identidad es obligatoria', 'Interruptor listo.', 'Repartidores verificados'),
            ('Regalo que cubre todo el plato: ¿se perdona el cargo por pedido pequeño?', 'Hoy se cobra igual.', 'Regalos sin sorpresas'),
            ('Nombres de los planes y de los niveles', 'Hoy: Inicial, Crece, Élite; Bronce a Diamante.', 'Textos finales'),
        ],
        [
            ('Aplicar cada decisión en cuanto la tomes', 'Con su prueba y su guía en Docs.'),
            ('Mostrarte el efecto en la calculadora antes de encender', 'Números en dólares.'),
        ],
    ),
    (
        '11',
        'Decisiones de franquicias y otros países',
        'Para crecer después de Miami. No frenan el lanzamiento cerrado.',
        [
            ('Condiciones de las franquicias', 'Cuota, porcentaje, plazo y territorio.', 'Vender franquicias'),
            ('Comida comprada y no entregada; transferencia sin confirmar; recarga disputada', 'Decisiones 7.1 a 7.3.', 'Cobro en mano'),
            ('Venezuela y Colombia: tasa, tarifas y socios', 'Decisiones 7.4 a 7.6.', 'Otros países'),
        ],
        [
            ('Aplicar cada decisión en cuanto la tomes', 'Con su prueba y su guía en Docs.'),
            ('Mostrarte el efecto en la calculadora antes de encender', 'Números en dólares.'),
        ],
    ),
    (
        '12',
        'Marca y legal',
        'La marca nueva necesita protección y los textos legales, una revisión profesional.',
        [
            ('Abogado: registrar la marca Divoox en EE. UU.', 'Oficina de marcas (USPTO).', 'Que nadie la use'),
            ('Abogado: revisar términos, privacidad y textos legales', 'Ya publicados en inglés y español.', 'Textos sin riesgo'),
            ('Contador: impuesto de ventas en Florida y tipo de repartidor', 'Empleado o independiente.', 'Cobrar bien los impuestos'),
            ('Marketing: corregir el banner «a un clic» y hacerlo en inglés', 'Tiene restos de la marca vieja.', 'Usarlo en la web'),
            ('Search Console: borrar la fila del mapa con «www» (opcional)', 'No quita nada.', 'Informe limpio'),
        ],
        [
            ('Pasar los cambios del abogado a la web y las apps', 'En los dos idiomas.'),
            ('Publicar el banner corregido', 'Cuando llegue.'),
        ],
    ),
]

# Lo que la IA hace en paralelo, sin depender de nadie.
PARALELO = [
    'Terminar la marca Divoox en las apps (avisos y dirección del servidor).',
    'Página «Cómo funciona» y las de restaurantes y repartidores con el estilo de la portada.',
    'Fichas de las tiendas con capturas reales, listas para el día de las cuentas.',
    'Mantener Docs y la web al día con capturas originales en cada cambio.',
    'Pruebas automáticas, sitio de pruebas y verificación de producción en cada publicación.',
    'Seguridad: actualizar las librerías cuando salga un aviso nuevo.',
]


def e(t):
    return html.escape(t)


def tarea_richard(t):
    titulo, detalle, destranca = t
    return f'''<li class="t">
  <span class="caja"></span>
  <div><strong>{e(titulo)}</strong><small>{e(detalle)}</small>
  <em>Destranca: {e(destranca)}</em></div>
</li>'''


def tarea_ia(t):
    titulo, detalle = t
    return f'''<li class="t ia">
  <span class="caja"></span>
  <div><strong>{e(titulo)}</strong><small>{e(detalle)}</small></div>
</li>'''


def pagina(num, titulo, frase, tuyas, mias, total):
    return f'''<section class="hoja">
  <header><span class="n">Paso {num}</span><h2>{e(titulo)}</h2><span class="pag">{num} / {total}</span></header>
  <p class="frase">{e(frase)}</p>
  <div class="cols">
    <div class="col tu"><h3>Tu parte · Richard</h3><ul>{''.join(tarea_richard(t) for t in tuyas)}</ul></div>
    <div class="col yo"><h3>Mi parte · IA</h3><ul>{''.join(tarea_ia(t) for t in mias)}</ul></div>
  </div>
  <footer>Divoox · Plan del lanzamiento en Miami · 23 oct 2026 · Marca cada casilla cuando esté hecha</footer>
</section>'''


total = len(PAGINAS) + 1
portada_pasos = ''.join(
    f'<li><span class="caja"></span><b>{num}</b> {e(t)}</li>' for num, t, *_ in PAGINAS
)
paralelo = ''.join(f'<li><span class="caja"></span>{e(x)}</li>' for x in PARALELO)

HTML = f'''<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Plan del lanzamiento de Divoox</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;800&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">
<style>
@page {{ size: A4 landscape; margin: 0; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: Montserrat, sans-serif; color: #101010; background: #fff; }}
.hoja {{ width: 297mm; height: 210mm; padding: 13mm 15mm 11mm; position: relative; page-break-after: always; overflow: hidden; }}
header {{ display: flex; align-items: baseline; gap: 12px; border-bottom: 2.5px solid #101010; padding-bottom: 6px; }}
header .n {{ font-family: Poppins; font-weight: 800; font-size: 13px; color: #fff; background: #101010; padding: 3px 10px; border-radius: 4px; }}
header h2 {{ font-family: Poppins; font-weight: 800; font-size: 30px; margin: 0; flex: 1; }}
header .pag {{ font-size: 11px; color: #666B73; }}
.frase {{ font-size: 15px; margin: 10px 0 12px; color: #333; }}
.cols {{ display: grid; grid-template-columns: 1.15fr 1fr; gap: 12mm; }}
h3 {{ font-family: Poppins; font-size: 16px; margin: 0 0 6px; padding: 4px 8px; border-radius: 4px; }}
.tu h3 {{ background: #101010; color: #fff; }}
.yo h3 {{ border: 1.5px solid #101010; }}
ul {{ list-style: none; margin: 0; padding: 0; }}
.t {{ display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px dashed #c9cbd0; }}
.caja {{ flex: 0 0 auto; width: 20px; height: 20px; border: 2px solid #101010; border-radius: 3px; margin-top: 2px; }}
.t.ia .caja {{ border-width: 1.5px; border-color: #666B73; }}
.t strong {{ display: block; font-size: 15px; font-weight: 600; }}
.t small {{ display: block; font-size: 12.5px; color: #444; margin-top: 1px; }}
.t em {{ display: block; font-size: 12px; font-style: normal; color: #C20A1A; margin-top: 2px; font-weight: 600; }}
.t.ia strong {{ font-weight: 500; }}
footer {{ position: absolute; left: 15mm; right: 15mm; bottom: 7mm; font-size: 9px; color: #666B73; border-top: 1px solid #ddd; padding-top: 4px; }}
.portada h1 {{ font-family: Poppins; font-weight: 800; font-size: 36px; margin: 3mm 0 1mm; }}
.portada .sub {{ font-size: 14px; margin: 0 0 5mm; }}
.portada .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; }}
.portada ol, .portada ul {{ list-style: none; padding: 0; margin: 0; }}
.portada li {{ display: flex; gap: 10px; align-items: center; font-size: 13.5px; padding: 4px 0; border-bottom: 1px dashed #c9cbd0; }}
.portada li b {{ font-family: Poppins; width: 22px; }}
.leyenda {{ font-size: 12px; position: absolute; left: 15mm; bottom: 16mm; display: flex; gap: 18px; align-items: center; }}
.leyenda span.caja {{ display: inline-block; vertical-align: middle; margin-right: 6px; }}
.marca {{ font-family: Poppins; font-weight: 800; font-size: 22px; }}
.marca i {{ color: #F20D20; font-style: normal; }}
</style></head><body>
<section class="hoja portada">
  <div class="marca">Divoo<i>x</i></div>
  <h1>Plan del lanzamiento en Miami</h1>
  <p class="sub">Todo lo que falta para tener las apps en los teléfonos y cobrando de verdad. Una casilla por tarea: márcala cuando esté hecha.</p>
  <div class="grid">
    <div><h3 style="background:#101010;color:#fff">Los pasos, en orden</h3><ol>{portada_pasos}</ol></div>
    <div>
      <h3 style="border:1.5px solid #101010">Dónde estamos hoy</h3>
      <ul>
        <li><span class="caja" style="background:#101010"></span>Web, panel y tres apps construidos</li>
        <li><span class="caja" style="background:#101010"></span>Marca Divoox y dominio divoox.com publicados</li>
        <li><span class="caja" style="background:#101010"></span>Cobro probado con dinero de prueba</li>
        <li><span class="caja"></span>Cobro con dinero real (paso 1)</li>
        <li><span class="caja"></span>Apps en las tiendas (pasos 2 a 6)</li>
        <li><span class="caja"></span>Prueba en la calle (paso 5)</li>
      </ul>
      <h3 style="border:1.5px solid #101010;margin-top:4mm">Lo que hago yo en paralelo</h3>
      <ul>{paralelo}</ul>
    </div>
  </div>
  <div class="leyenda"><span><span class="caja"></span>Casilla gruesa: la haces tú</span><span><span class="caja" style="border-width:1.5px;border-color:#666B73"></span>Casilla fina: la hago yo</span><span style="color:#C20A1A;font-weight:600">En rojo: lo que se destranca cuando la haces</span></div>
  <footer>Divoox · Plan del lanzamiento en Miami · 23 oct 2026 · Detalle en el documento ROADMAP-LANZAMIENTO-MIAMI</footer>
</section>
{''.join(pagina(n, t, f, tu, yo, total) for n, t, f, tu, yo in PAGINAS)}
</body></html>'''

with open(os.path.join(AQUI, 'plan-lanzamiento.html'), 'w') as f:
    f.write(HTML)
print('listo')
