// Tutorial en PDF para probar Divoox con teléfonos (31 oct 2026, pedido de Richard): paso a paso, con
// capturas reales del recorrido, horizontal. Las cuentas se leen en el momento de archivos locales que
// no están en git; el PDF sale a la carpeta privado/ (ignorada por git: el repositorio es público).
// Uso: CLAVE_DEMO=… node scripts/pruebas/guia-pruebas-pdf.mjs
import fs from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const CLAVE_DEMO = process.env.CLAVE_DEMO;
if (!CLAVE_DEMO) {
  console.error('Falta CLAVE_DEMO (la clave de las cuentas demo del sitio de pruebas).');
  process.exit(2);
}
const revisores = fs
  .readFileSync(join(os.homedir(), '.config', 'tumbite', 'revisores-tiendas'), 'utf8')
  .split('\n')
  .filter((l) => l.includes('\t'))
  .map((l) => l.split('\t'));
const rev = (rol) => revisores.find((r) => r[2] === rol) ?? ['', '', rol];

const CAP = resolve('docs/capturas/recorrido');
const img = (n) => pathToFileURL(join(CAP, `${n}-es.png`)).href;
const PRUEBAS = 'https://staging.tumbite.com';

const cuenta = (titulo, correo, clave, donde) => `
  <div class="cuenta"><div class="ct">${titulo}</div>
  <div class="cl">Dónde</div><div class="cv">${donde}</div>
  <div class="cl">Correo</div><div class="cv mono">${correo}</div>
  <div class="cl">Contraseña</div><div class="cv mono">${clave}</div></div>`;

const paso = (n, quien, titulo, texto, captura, ancho = false) => `
  <div class="paso">
    <div class="pn">${n}</div>
    <div class="pc">
      <div class="quien ${quien.clase}">${quien.texto}</div>
      <h3>${titulo}</h3>
      <p>${texto}</p>
    </div>
    ${captura ? `<img class="${ancho ? 'cap ancha' : 'cap'}" src="${img(captura)}">` : ''}
  </div>`;

const PC = { clase: 'pc-r', texto: 'Computadora · restaurante' };
const T1 = { clase: 't1', texto: 'iPhone 1 · cliente' };
const T2 = { clase: 't2', texto: 'iPhone · repartidor' };

const paginas = [
  // 1. Portada
  `<section class="portada">
    <div class="marca">DIVOOX</div>
    <h1>Guía de pruebas<br>con teléfonos</h1>
    <p class="sub">Paso a paso para probar Divoox completo en Michigan: el cliente pide, el restaurante
    prepara, el repartidor entrega y el dinero llega a cada uno.</p>
    <div class="tres">
      <div><b>1</b>Lee las páginas 2 y 3 una sola vez: qué se actualiza solo y los dos mundos de prueba.</div>
      <div><b>2</b>Haz la preparación de la página 4 antes de salir.</div>
      <div><b>3</b>Sigue la Prueba A (un iPhone) o la Prueba B (dos iPhone), paso por paso.</div>
    </div>
    <div class="pie">Versión del 31 de octubre de 2026 · Windoce LLC · Uso interno. Contiene cuentas de prueba: no se comparte.</div>
  </section>`,

  // 2. Actualizaciones
  `<section><h2>Antes de empezar: qué se arregla al momento y qué necesita una versión nueva</h2>
    <div class="dos">
      <div class="caja verde"><h3>Se arregla al momento, sin tiendas</h3>
        <p>Todo lo que vive en el servidor de Divoox: precios, tarifas, restaurantes, menús, zonas, reglas
        del pedido, ofertas al repartidor, la web y los paneles.</p>
        <p><b>Lo publicamos y la app que ya tienes instalada lo usa enseguida.</b> No hay que esperar a
        Apple ni a Google.</p></div>
      <div class="caja gris"><h3>Necesita una versión nueva de la app</h3>
        <p>Lo que está dibujado dentro de la app: una pantalla, un botón, un título, el mapa.</p>
        <p><b>Esos arreglos se juntan</b> y salen en la siguiente versión, todos a la vez.</p></div>
    </div>
    <div class="dos">
      <div class="caja"><h3>Apple (iPhone)</h3>
        <p>Subir una versión nueva a TestFlight <b>no cancela</b> la revisión de la tienda. La versión 1.0
        que Apple revisa no se toca. Los arreglos de pantalla se prueban en TestFlight y, cuando Apple
        apruebe la 1.0, se manda la 1.0.1 con todo junto.</p></div>
      <div class="caja"><h3>Google Play (Android)</h3>
        <p>Subir una versión nueva <b>sí cancela</b> la revisión en curso. Por eso no se sube nada mientras
        Google revisa: hay un candado que lo impide. Cuando aprueba, se sube todo lo acumulado en una sola
        versión.</p></div>
    </div></section>`,

  // 3. Los dos mundos
  `<section><h2>Los dos mundos donde se prueba</h2>
    <table><tr><th></th><th>Sitio de pruebas</th><th>Divoox real (TestFlight)</th></tr>
    <tr><td>Qué es</td><td>Una copia completa de Divoox para probar. Se abre en Safari.</td><td>Las tres apps que instalaste desde TestFlight.</td></tr>
    <tr><td>Dinero</td><td><b>Gratis.</b> Se paga con la tarjeta de prueba 4242 4242 4242 4242, cualquier fecha futura y cualquier código.</td><td><b>Dinero real. No se paga nada</b>, salvo la compra real de un dólar cuando la autorices.</td></tr>
    <tr><td>Restaurante en Michigan</td><td>Pizzería Demo Novi, a 6 km de Walled Lake, abierta todo el día.</td><td>Cinco restaurantes de prueba en Novi.</td></tr>
    <tr><td>Para qué sirve</td><td>El circuito completo: pedir, pagar, aceptar, repartir, entregar y ver el dinero.</td><td>Ver que las apps funcionan bien en el iPhone: entrar, mapa, ubicación, avisos, cámara y menús.</td></tr>
    <tr><td>Cuándo usarlo</td><td>Pruebas A y B de esta guía.</td><td>Prueba C de esta guía.</td></tr></table>
    <p class="nota">Las cuentas de la Divoox real son las de los revisores de Apple y Google. No se les cambia nada mientras revisan: están armadas en Miami a propósito.</p></section>`,

  // 4. Preparación
  `<section><h2>Preparación (antes de salir)</h2>
    <div class="dos">
      <div><h3>Qué hace falta</h3><ul class="check">
        <li>La computadora, cargada, con internet. Hace de <b>restaurante</b>.</li>
        <li>Un iPhone (Prueba A) o dos iPhone (Prueba B), con batería llena.</li>
        <li>En cada iPhone: ubicación encendida y permitida para Safari «Mientras se usa».</li>
        <li>En cada iPhone: avisos permitidos para Safari.</li>
        <li>Tu dirección real de entrega en Michigan. Si quieres ver el recorrido, una a pocas cuadras.</li>
        <li>Para la Prueba B: alguien que maneje o camine con el iPhone del repartidor.</li>
        <li>Esta guía abierta en la computadora o impresa.</li></ul></div>
      <div><h3>Quién hace qué</h3>
        <div class="roles">
          <div class="rol pc-r">Computadora<br><b>Restaurante</b><span>Recibe el pedido, lo acepta y lo marca listo</span></div>
          <div class="rol t1">iPhone 1<br><b>Cliente</b><span>Pide, paga y sigue el pedido</span></div>
          <div class="rol t2">iPhone 2<br><b>Repartidor</b><span>Acepta, recoge y entrega</span></div>
        </div>
        <p class="nota">Con un solo iPhone, el cliente y el repartidor van en dos pestañas de Safari del mismo teléfono.</p></div>
    </div></section>`,

  // 5. Cuentas
  `<section><h2>Cuentas y direcciones del sitio de pruebas</h2>
    <div class="tresc">
      ${cuenta('Restaurante · Pizzería Demo Novi', 'demo.restaurante.novi@ejemplo.com', CLAVE_DEMO, `${PRUEBAS}/panel/`)}
      ${cuenta('Cliente', 'demo.cliente@ejemplo.com', CLAVE_DEMO, `${PRUEBAS}/app/`)}
      ${cuenta('Repartidor', 'demo.repartidor@ejemplo.com', CLAVE_DEMO, `${PRUEBAS}/driver/`)}
    </div>
    <div class="caja tarjeta"><h3>Tarjeta de prueba (solo en el sitio de pruebas)</h3>
      <p class="mono grande">4242 4242 4242 4242</p><p>Fecha: cualquiera en el futuro (por ejemplo 12/30). Código: cualquiera de tres números (por ejemplo 123). Código postal: cualquiera.</p></div>
    <p class="nota">Son cuentas de demostración: los correos no existen y no llega ningún correo. Si una no entra, me avisas y la rearmo.</p></section>`,

  // 6-7. Prueba A
  `<section><h2>Prueba A · Un iPhone y la computadora · El restaurante abre</h2>
    <div class="pasos">
      ${paso(1, PC, 'Abre el panel del restaurante', `En la computadora entra a <span class="mono">${PRUEBAS}/panel/</span> con la cuenta de Pizzería Demo Novi. Deja abierta la pantalla de pedidos y sube el volumen: así el restaurante «está escuchando» y suena cuando entra un pedido. Si cierras el panel, el restaurante aparece cerrado para el cliente.`, 'restaurante-tablero', true)}
    </div></section>`,
  `<section><h2>Prueba A · El cliente pide (1 de 2)</h2>
    <div class="pasos">
      ${paso(2, T1, 'Entra como cliente', `En Safari del iPhone abre <span class="mono">${PRUEBAS}/app/</span> y entra con la cuenta de cliente. Cuando pregunte por la ubicación, toca «Permitir».`, 'cliente-inicio')}
      ${paso(3, T1, 'Elige Pizzería Demo Novi', 'En Comida aparecen los restaurantes cerca de ti. Toca Pizzería Demo Novi.', 'cliente-restaurantes')}
      ${paso(4, T1, 'Arma el pedido', 'Agrega una porción de pizza y un refresco. Toca el carrito.', 'cliente-menu')}
    </div></section>`,
  `<section><h2>Prueba A · El cliente pide (2 de 2)</h2>
    <div class="pasos">
      ${paso(5, T1, 'Dirección y propina', 'Escribe tu dirección real en «Calle y número» y elige la sugerencia correcta: el pin se mueve a tu puerta. Elige la propina.', 'cliente-carrito')}
      ${paso(6, T1, 'Paga con la tarjeta de prueba', 'Toca «Continuar al pago» y escribe la tarjeta 4242 4242 4242 4242. Queda en pantalla tu pedido con su estado.', 'cliente-pagado')}
    </div></section>`,
  `<section><h2>Prueba A · El restaurante prepara</h2>
    <div class="pasos">
      ${paso(7, PC, 'Suena el pedido nuevo', 'En la computadora suena la alarma y aparece el pedido. Acéptalo y elige el tiempo de preparación.', 'restaurante-pedido-nuevo', true)}
      ${paso(8, PC, 'Márcalo listo', 'Cuando quieras simular que la comida está lista, toca «Listo». En ese momento Divoox busca repartidor.', 'restaurante-pedido-aceptado', true)}
    </div></section>`,
  `<section><h2>Prueba A · El repartidor entrega (1 de 2)</h2>
    <div class="pasos">
      ${paso(9, T2, 'Conéctate como repartidor', `En el iPhone abre una pestaña nueva de Safari con <span class="mono">${PRUEBAS}/driver/</span> y entra con la cuenta de repartidor. Toma la foto de control que pide y toca «Conectarme».`, 'repartidor-conectado')}
      ${paso(10, T2, 'Acepta la oferta', 'Llega la oferta con lo que ganas y la distancia. Tócala para aceptarla.', 'repartidor-oferta')}
      ${paso(11, T2, 'Recoge en el restaurante', 'Toca «Llegué», toma la foto del pedido y confirma la recogida.', 'repartidor-foto-recogida')}
    </div></section>`,
  `<section><h2>Prueba A · El repartidor entrega (2 de 2)</h2>
    <div class="pasos">
      ${paso(12, T2, 'Entrega en la puerta', 'Ve a la dirección del cliente. Al llegar, toma la foto de entrega y confirma.', 'repartidor-llegada')}
      ${paso(13, T1, 'El cliente califica', 'Vuelve a la pestaña del cliente: el pedido dice entregado. Califica al restaurante y al repartidor.', 'cliente-calificar')}
      ${paso(14, T2, 'Mira el dinero', 'En la app del repartidor, Ganancias muestra lo que ganó con este pedido, propina incluida. El restaurante lo ve en su panel.', 'repartidor-ganancias')}
    </div></section>`,

  // Prueba B
  `<section><h2>Prueba B · Dos iPhone y la computadora</h2>
    <p>Es la misma Prueba A, pero el repartidor va en su propio teléfono y se mueve de verdad. Así se ve lo que con un solo teléfono no se puede ver.</p>
    <div class="dos">
      <div><h3>Cómo se reparte</h3><ul class="check">
        <li><b>iPhone 1 (cliente):</b> pasos 2 a 6 y 13. Se queda en tu casa.</li>
        <li><b>iPhone 2 (repartidor):</b> pasos 9 a 12 y 14. Sale en el carro o caminando.</li>
        <li><b>Computadora (restaurante):</b> pasos 1, 7 y 8.</li>
        <li>Conecta al repartidor (paso 9) <b>antes</b> de que el restaurante marque listo.</li></ul></div>
      <div><h3>Qué mirar de más</h3><ul class="check">
        <li>La oferta suena en el iPhone 2 aunque la pantalla esté apagada.</li>
        <li>En el iPhone 1 el repartidor se mueve en el mapa mientras viene.</li>
        <li>El tiempo estimado baja a medida que se acerca.</li>
        <li>Al entregar, al cliente le llega el aviso y ve la foto de entrega.</li></ul></div>
    </div>
    <img class="cap centro" src="${img('cliente-en-camino')}"></section>`,

  // Prueba C
  `<section><h2>Prueba C · Las apps reales de TestFlight (sin pagar)</h2>
    <p>Sirve para ver que las apps del iPhone funcionan bien. <b>No se paga nada.</b> Son las cuentas de los revisores de Apple y Google.</p>
    <div class="tresc">
      ${cuenta('App Divoox · cliente', rev('cliente')[0], rev('cliente')[1], 'App Divoox')}
      ${cuenta('App Divoox Driver', rev('repartidor')[0], rev('repartidor')[1], 'App Divoox Driver')}
      ${cuenta('App Divoox Restaurants', rev('restaurante')[0], rev('restaurante')[1], 'App Divoox Restaurants')}
    </div>
    <div class="tresc chico">
      <ul class="check"><li>Ver los restaurantes de Novi.</li><li>Entrar a un menú y armar un carrito.</li><li>Dirección, mapa y propina. <b>No pagar.</b></li></ul>
      <ul class="check"><li>Entrar y ver Inicio, Ganancias y la verificación.</li><li>Con esta cuenta no llegan ofertas en Michigan (está en Miami a propósito).</li></ul>
      <ul class="check"><li>Entrar y ver Pedidos y el menú de la cocina de revisión.</li><li>No cambiar el menú ni los datos: lo usan los revisores.</li></ul>
    </div></section>`,

  // Qué hacer si algo falla
  `<section><h2>Si algo sale raro</h2>
    <div class="dos">
      <div><h3>Qué me mandas</h3><ul class="check">
        <li>Una captura de la pantalla.</li>
        <li>En cuál teléfono pasó (cliente, repartidor o restaurante) y en qué paso de esta guía.</li>
        <li>La hora aproximada: con eso busco el pedido en el sistema.</li>
        <li>Qué esperabas que pasara.</li></ul></div>
      <div><h3>Qué pasa después</h3><ul class="check">
        <li>Si es del servidor, lo arreglo y queda bien al momento, sin tocar las apps.</li>
        <li>Si es de la pantalla, lo arreglo y sale en la próxima versión: lo pruebas en TestFlight.</li>
        <li>Cada arreglo deja su prueba automática para que no vuelva a pasar.</li></ul></div>
    </div>
    <div class="caja verde"><h3>Al terminar la prueba completa</h3><p>Dime «terminé la prueba» y te paso el resumen de lo que pasó en el sistema: pedido, pago de prueba, tiempos y el dinero de cada uno.</p></div></section>`,
];

const css = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Montserrat, -apple-system, Helvetica, Arial, sans-serif; color: #101010; font-size: 13.5px; }
section { width: 297mm; height: 210mm; padding: 14mm 16mm; page-break-after: always; position: relative; overflow: hidden; }
h1, h2, h3 { font-family: Poppins, -apple-system, Helvetica, Arial, sans-serif; margin: 0; }
h2 { font-size: 22px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ddd; }
h3 { font-size: 14px; margin: 4px 0 6px; }
p { line-height: 1.5; margin: 4px 0 8px; }
.portada { background: #101010; color: #fff; display: flex; flex-direction: column; justify-content: center; }
.marca { color: #F20D20; font-weight: 800; letter-spacing: 6px; font-size: 16px; margin-bottom: 18px; }
.portada h1 { font-size: 46px; line-height: 1.1; }
.sub { font-size: 16px; max-width: 160mm; color: #ddd; margin-top: 14px; }
.tres { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 26px; }
.tres div { border: 1px solid #333; border-radius: 10px; padding: 12px; color: #eee; line-height: 1.45; }
.tres b { display: block; color: #F20D20; font-size: 22px; }
.pie { position: absolute; bottom: 12mm; left: 16mm; color: #888; font-size: 10px; }
.dos { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px; }
.tresc { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; }
.caja { border: 1px solid #ddd; border-radius: 10px; padding: 12px 14px; }
.caja.verde { border-color: #1E8E3E; background: #F1FAF3; }
.caja.gris { background: #F6F6F6; }
.caja.tarjeta { background: #F6F6F6; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th, td { border: 1px solid #ddd; padding: 8px 10px; vertical-align: top; line-height: 1.45; text-align: left; }
th { background: #101010; color: #fff; }
td:first-child { font-weight: 700; width: 34mm; background: #F6F6F6; }
.nota { color: #555; font-size: 11.5px; margin-top: 10px; }
ul.check { list-style: none; padding: 0; margin: 0; }
ul.check li { padding: 5px 0 5px 22px; position: relative; line-height: 1.4; }
ul.check li:before { content: ''; position: absolute; left: 0; top: 8px; width: 11px; height: 11px; border: 2px solid #101010; border-radius: 3px; }
.roles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.rol { border-radius: 10px; padding: 12px; color: #fff; text-align: center; line-height: 1.4; }
.rol b { font-size: 16px; }
.rol span { display: block; font-size: 11px; margin-top: 6px; opacity: .9; }
.pc-r { background: #101010; }
.t1 { background: #F20D20; }
.t2 { background: #666B73; }
.cuenta { border: 1px solid #ddd; border-radius: 10px; padding: 10px 12px; display: grid; grid-template-columns: 22mm 1fr; gap: 4px 8px; align-content: start; }
.ct { grid-column: 1 / -1; font-weight: 800; font-family: Poppins, sans-serif; margin-bottom: 4px; }
.cl { color: #666B73; font-size: 11px; }
.cv { font-size: 11.5px; word-break: break-all; }
.mono { font-family: Menlo, Consolas, monospace; }
.grande { font-size: 22px; letter-spacing: 1px; }
.pasos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.pasos:has(.ancha) { grid-template-columns: 1fr 1fr; }
.pasos:has(.ancha):not(:has(.paso + .paso)) { grid-template-columns: 1fr; }
.pasos:has(.ancha):not(:has(.paso + .paso)) .cap.ancha { max-height: 120mm; }
.paso { border: 1px solid #ddd; border-radius: 10px; padding: 10px; display: flex; flex-direction: column; align-items: flex-start; }
.pn { background: #F20D20; color: #fff; font-weight: 800; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-family: Poppins, sans-serif; }
.quien { display: inline-block; color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 10.5px; margin: 6px 0 2px; }
.cap { height: 90mm; border: 1px solid #ddd; border-radius: 8px; align-self: center; margin-top: auto; }
.cap.ancha { height: auto; width: 100%; max-height: 80mm; object-fit: contain; }
.cap.centro { display: block; margin: 6px auto 0; height: 70mm; }
.chico { font-size: 11.5px; }
`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head><body>${paginas.join('')}</body></html>`;
fs.mkdirSync('privado', { recursive: true });
const archivoHtml = resolve('privado', 'guia-pruebas.html');
fs.writeFileSync(archivoHtml, html);
const nav = await chromium.launch();
const pag = await nav.newPage();
await pag.goto(pathToFileURL(archivoHtml).href, { waitUntil: 'load' });
const salida = resolve('privado', 'GUIA-PRUEBAS-CON-TELEFONOS.pdf');
await pag.pdf({ path: salida, landscape: true, printBackground: true, format: 'A4' });
await nav.close();
fs.rmSync(archivoHtml);
console.log(`PDF listo: ${salida}`);
