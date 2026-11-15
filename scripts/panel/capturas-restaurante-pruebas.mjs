// Capturas REALES del panel del restaurante para las guías «pedido de prueba», «modo tableta» y
// «descargar tus pedidos». Contra el sitio de pruebas, con la cuenta de demostración del
// restaurante. El pedido de prueba no cobra ni llama a un repartidor, y se termina al final.
// Uso: CLAVE_DEMO=… node scripts/panel/capturas-restaurante-pruebas.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

// SITIO deja apuntar al panel en desarrollo (con los datos del sitio de pruebas) para una captura suelta.
const SITIO = process.env.SITIO ?? 'https://staging.tumbite.com';
const ORIGINALES = join(process.cwd(), 'docs', 'capturas', 'funciones');
const WEB = join(process.cwd(), 'apps', 'panel', 'public', 'docs');
mkdirSync(ORIGINALES, { recursive: true });
const navegador = await chromium.launch();
const T = {
  es: {
    prueba: 'Enviar un pedido de prueba',
    listo: '¡Listo!',
    terminar: 'Terminar la prueba',
    tableta: 'Modo tableta',
    salir: 'Salir del modo tableta',
    aceptar: /^Aceptar/,
  },
  en: {
    prueba: 'Send a test order',
    listo: 'Ready!',
    terminar: 'Finish the test',
    tableta: 'Tablet mode',
    salir: 'Exit tablet mode',
    aceptar: /^Accept/,
  },
};
for (const idioma of ['es', 'en']) {
  // eslint-disable-next-line security/detect-object-injection -- idioma fijo de la lista de arriba
  const t = T[idioma];
  const ctx = await navegador.newContext({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
  const p = await ctx.newPage();
  const r = await p.request.post(`${SITIO}/datos/cuentas/entrar`, {
    data: { correo: 'demo.restaurante@ejemplo.com', clave: process.env.CLAVE_DEMO },
  });
  if (!r.ok()) throw new Error(`no entra: ${r.status()}`);
  const foto = async (nombre, opciones = {}) => {
    await p.waitForTimeout(1200);
    const png = join(ORIGINALES, `${nombre}-${idioma}.png`);
    await (opciones.elemento ?? p).screenshot({ path: png });
    execFileSync('cwebp', ['-quiet', '-q', '82', png, '-o', join(WEB, `${nombre}-${idioma}.webp`)]);
    console.log('foto', nombre, idioma);
  };
  // El pedido de prueba, al centro de la pantalla (la insignia «PRUEBA» lo señala).
  const centrar = () =>
    p
      .locator('.insignia-programado')
      .first()
      .evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await p.goto(`${SITIO}/panel/orders`, { waitUntil: 'networkidle' });
  await foto('restaurante-pedido-prueba-boton');
  await p.getByRole('button', { name: t.prueba }).click();
  await p.getByRole('button', { name: t.aceptar }).first().waitFor();
  await centrar();
  await foto('restaurante-pedido-prueba-nuevo');
  await p.getByRole('button', { name: t.aceptar }).first().click();
  await p.getByRole('button', { name: t.listo }).first().click();
  await p.getByRole('button', { name: t.terminar }).waitFor();
  await centrar();
  await foto('restaurante-pedido-prueba-listo');
  await p.getByRole('button', { name: t.terminar }).click();
  await p.waitForTimeout(800);
  // Modo tableta: solo quedan los pedidos, sin menú ni cabecera.
  await p.evaluate('window.scrollTo(0, 0)');
  await p.getByRole('button', { name: t.tableta }).click();
  await foto('restaurante-modo-tableta');
  await p.getByRole('button', { name: t.salir }).click();
  // «Descargar tus pedidos», al final del tablero.
  await p.goto(`${SITIO}/panel`, { waitUntil: 'networkidle' });
  const planilla = p.locator('.tablero .tarjeta-form').last();
  await planilla.scrollIntoViewIfNeeded();
  await foto('restaurante-planilla-pedidos', { elemento: planilla });
  await ctx.close();
}
await navegador.close();
