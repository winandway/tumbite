// Recorre el borrador del registro nuevo (progreso/borrador-registro) como lo haría una persona, en
// español y en inglés, y guarda una captura PNG de cada pantalla. De paso prueba que el borrador
// funcione de punta a punta: si un paso no avanza, el guion falla.
// Uso: node scripts/progreso/capturas-borrador-registro.mjs [carpeta de salida]
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local con rutas y llaves fijas */
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const salida = resolve(
  process.argv[2] ?? join(homedir(), 'Documents/Entregas/Divoox/borrador-registro-nuevo'),
);
const pagina = pathToFileURL(resolve('progreso/borrador-registro/index.html')).href;

// Ejemplos neutros: nombres comunes, números 555 y códigos imposibles.
const DATOS = {
  es: {
    region: 'es-VE',
    correo: 'correo@ejemplo.com',
    nombre: 'Ana Rivas',
    negocio: 'Pizzería La Esquina',
    celular: '4125550123',
    fecha: '15031995',
    placa: 'AB123CD',
    plato: 'Pizza margarita',
    precio: '8,50',
    codigo: 'EJEMPLO01',
  },
  en: {
    region: 'en-US',
    correo: 'name@example.com',
    nombre: 'Alex Morgan',
    negocio: 'Corner Pizza',
    celular: '2485550123',
    fecha: '03151995',
    placa: 'ABC1234',
    plato: 'Margherita pizza',
    precio: '8.50',
    codigo: 'EXAMPLE01',
  },
};
const APPS = ['cliente', 'driver', 'restaurante'];

const navegador = await chromium.launch();
let total = 0;
for (const idioma of ['es', 'en']) {
  const d = DATOS[idioma];
  mkdirSync(join(salida, idioma), { recursive: true });
  const contexto = await navegador.newContext({
    viewport: { width: 390, height: 853 },
    deviceScaleFactor: 2,
    locale: d.region,
    hasTouch: true,
    isMobile: true,
  });
  const p = await contexto.newPage();
  p.on('pageerror', (e) => {
    throw e;
  });
  for (const app of APPS) {
    let n = 0;
    const foto = async (nombre) => {
      n++;
      total++;
      await p.waitForTimeout(350);
      await p.locator('.tel').screenshot({
        path: join(salida, idioma, `${app}-${String(n).padStart(2, '0')}-${nombre}.png`),
      });
    };
    const pantalla = async () => new URL(p.url()).hash.split('/')[1];
    const texto = (llave) =>
      /correo/.test(llave)
        ? d.correo
        : /negocio/.test(llave)
          ? d.negocio
          : /vehiculo/.test(llave)
            ? d.placa
            : /menu-1/.test(llave)
              ? d.plato
              : /menu-2/.test(llave)
                ? d.precio
                : /invitacion|linea/.test(llave)
                  ? d.codigo
                  : d.nombre;
    /** Llena la pantalla que esté a la vista y toca «Siguiente»; devuelve a cuál llegó. */
    const avanzar = async (nombre) => {
      const antes = await pantalla();
      const c = p.locator('#c');
      if (await p.locator('[data-fecha]').count()) await c.pressSequentially(d.fecha);
      else if (await p.locator('[data-dir]').count()) {
        await c.pressSequentially(idioma === 'es' ? 'Calle' : 'Main');
        await foto(`${nombre}-sugerencias`);
        await p.locator('.sugerencias button').first().click();
      } else if (await p.locator('#c[type=password]').count()) await c.fill('ejemplo-1234');
      else if (await p.locator('#c[type=tel]').count()) await c.fill(d.celular);
      else if (await c.count())
        await c.fill(texto(await p.locator('.cuerpo').getAttribute('data-llave')));
      else if (await p.locator('.chips').count()) {
        await p.locator('.chips button').nth(0).click();
        await p.locator('.chips button').nth(2).click();
      } else if (await p.locator('.foto').count()) await p.locator('.dos button').first().click();
      else if (await p.locator('[data-id=acepto]').count())
        await p.locator('[data-id=acepto]').click();
      await foto(nombre);
      await p.locator('[data-a=siguiente]').click();
      const despues = await pantalla();
      if (despues === antes) throw new Error(`${idioma}/${app}: «${antes}» no avanzó`);
      return despues;
    };

    await p.goto(`${pagina}#${app}/inicio/${idioma}`);
    await p.evaluate(() => localStorage.clear());
    await p.reload();
    await foto('portada');
    // El selector de idioma estilo Amazon, abierto.
    await p.locator('.idioma > button').click();
    await foto('idioma');
    await p.keyboard.press('Escape');
    await p.locator('#p [data-p=entrar]').click();
    await foto('entrar');
    await p.locator('[data-a=atras]').click();
    await p.locator('#p [data-p=paso-1]').click();
    // Un error a la vista: «Siguiente» sin escribir nada.
    await p.locator('[data-a=siguiente]').click();
    await foto('paso-1-error');
    let donde = await pantalla();
    while (/^paso-/.test(donde)) {
      if (donde === 'paso-2') {
        // La ayuda a la vista, abierta una vez.
        await p.locator('[data-a=ayuda]').click();
        await foto('ayuda');
        await p.keyboard.press('Escape');
      }
      if (donde === 'paso-1') {
        // Un dominio mal escrito: sale la sugerencia y, al tocarla, se corrige.
        await p.locator('#c').fill(d.correo.replace(/@.*/, '@gmial.com'));
        await p.locator('#c').dispatchEvent('input');
        await foto('correo-sugerencia');
        await p.locator('.sugiere').click();
        if (!(await p.locator('#c').inputValue()).endsWith('@gmail.com'))
          throw new Error(`${idioma}/${app}: la sugerencia del correo no corrigió`);
      }
      if (await p.locator('[data-id=acepto]').count()) {
        // «Editar» el correo vuelve a su casilla y regresa a revisar sin perder lo demás.
        await p.locator('.correo-grande .editar').click();
        await p.locator('#c').fill(d.correo);
        await p.locator('[data-a=siguiente]').click();
        if ((await p.locator('[data-correo]').innerText()) !== d.correo)
          throw new Error(`${idioma}/${app}: editar el correo no volvió a revisar`);
        // El nombre no acepta números.
        await p.locator('.resumen .editar').first().click();
        await p.locator('#c').pressSequentially('7');
        if (/\d/.test(await p.locator('#c').inputValue()))
          throw new Error(`${idioma}/${app}: el nombre aceptó un número`);
        await p.locator('[data-a=siguiente]').click();

        // Sin marcar la casilla no se crea la cuenta, y se dice por qué.
        await p.locator('[data-a=siguiente]').click();
        await foto('acepta-sin-marcar');
      }
      donde = await avanzar(donde);
    }
    if (donde !== 'dentro') throw new Error(`${idioma}/${app}: no llegó adentro (${donde})`);
    await foto('adentro-al-llegar');
    const tareas = await p.locator('.tarea[data-p]').evaluateAll((l) => l.map((b) => b.dataset.p));
    for (const [i, tarea] of tareas.entries()) {
      await p.locator(`.tarea[data-p="${tarea}"]`).click();
      donde = await pantalla();
      while (/^tarea-/.test(donde)) donde = await avanzar(donde);
      if (i === 1) await foto('adentro-a-medias');
    }
    await foto('adentro-completo');
    // El borrador no se pierde: se recarga a mitad de un paso y lo escrito vuelve.
    if (app === 'cliente') {
      await p.locator('#b-reiniciar').click();
      await p.locator('#p [data-p=paso-1]').click();
      await p.locator('#c').fill(d.correo);
      await p.locator('[data-a=siguiente]').click();
      await p.locator('#c').fill(d.nombre);
      await p.waitForTimeout(700);
      await p.reload();
      if ((await p.locator('#c').inputValue()) !== d.nombre)
        throw new Error(`${idioma}: lo escrito no volvió al recargar`);
      await foto('recuperado');
    }
  }
  await contexto.close();
  // La página entera, como se ve en una computadora.
  const ancho = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: d.region,
  });
  const g = await ancho.newPage();
  await g.goto(`${pagina}#driver/dentro/${idioma}`);
  await g.waitForTimeout(600);
  await g.screenshot({ path: join(salida, idioma, 'pagina-completa.png'), fullPage: true });
  total++;
  await ancho.close();
}
await navegador.close();
console.log(`✓ ${total} capturas en ${salida}`);
