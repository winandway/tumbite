// Capturas REALES del chat de ayuda de la web sin muro (C-CHAT-WEB-SIN-MURO, 23 nov 2026) — todos los
// países. Con la web pública real contra el servidor LOCAL del recorrido (.recorrido; antes:
// node scripts/recorrido/preparar.mjs). Enciende el servidor, toma las capturas y lo apaga. No toca el
// sitio de pruebas ni producción. Datos neutros. En el navegador NO hay muro: se comprueba y se fotografía.
//   chat-web-celular     el chat de la web a ancho de celular, listo para escribir, con la línea
//   chat-web-computadora el mismo chat a ancho de computadora
//   chat-web-enviado     el primer mensaje enviado de una vez (sin contestar ningún aviso)
//   → docs/capturas/permiso-ia/<nombre>-<es|en>.png
// Uso: node scripts/recorrido/capturas-permiso-ia.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'permiso-ia');
mkdirSync(SALIDA, { recursive: true });
const servidor = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '-c',
    '.recorrido/wrangler.jsonc',
    '--port',
    new globalThis.URL(URL).port,
    '--persist-to',
    '.recorrido/estado',
  ],
  { cwd: RAIZ, stdio: 'ignore', detached: true },
);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const interno = async (ruta, cuerpo = {}) => {
  const r = await fetch(`${URL}/datos/interno/diagnostico/${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-reloj-secreto': DATOS.relojSecreto },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
};
const sql = (q) => interno('sql', { sql: q });

let navegador;
try {
  for (let i = 0; ; i++) {
    if (
      await fetch(`${URL}/datos/salud`).then(
        () => true,
        () => false,
      )
    )
      break;
    if (i > 90) throw new Error('el servidor local no encendió');
    await espera(2_000);
  }
  navegador = await chromium.launch();
  for (const idioma of ['es', 'en']) {
    const en = idioma === 'en';
    const contexto = async (sesion, ancho) => {
      const movil = ancho < 700;
      const ctx = await navegador.newContext({
        viewport: { width: ancho, height: movil ? 844 : 900 },
        deviceScaleFactor: movil ? 3 : 2,
        isMobile: movil,
        hasTouch: movil,
        baseURL: URL,
        locale: en ? 'en-US' : 'es-US',
      });
      await ctx.addInitScript(
        ([pase, u, i]) => {
          localStorage.setItem('tumbite.idioma', i);
          if (pase) {
            localStorage.setItem('tumbite.sesion', pase);
            localStorage.setItem(`divoox.permisos.${u}`, '1');
          }
        },
        [sesion?.token ?? null, sesion?.id ?? null, idioma],
      );
      return ctx;
    };
    const captura = async (p, nombre) => {
      await p.screenshot({ path: join(SALIDA, `${nombre}-${idioma}.png`) });
      console.log(`✓ ${nombre}-${idioma}.png`);
    };
    const sinMuro = async (p) => {
      if ((await p.getByTestId('chat-permiso-ia').count()) !== 0)
        throw new Error('el chat del navegador todavía muestra el muro del permiso');
    };

    // ───────── Web: la burbuja del chat, a ancho de celular y de computadora
    for (const [nombre, ancho] of [
      ['chat-web-celular', 390],
      ['chat-web-computadora', 1366],
    ]) {
      const ctxW = await contexto(null, ancho);
      const w = await ctxW.newPage();
      await w.goto(en ? '/' : '/es');
      await w
        .getByRole('button', { name: en ? /support/i : /soporte/i })
        .first()
        .click({ timeout: 60_000 });
      await w.getByTestId('chat-linea-ia').waitFor({ timeout: 30_000 });
      await w.getByTestId('chat-soporte').locator('textarea').waitFor({ timeout: 10_000 });
      await sinMuro(w);
      await espera(600);
      await captura(w, nombre);
      if (nombre === 'chat-web-celular') {
        // Se escribe de una vez: sin contestar nada antes.
        await w
          .getByTestId('chat-soporte')
          .locator('textarea')
          .fill(
            en ? 'How do I change my delivery address?' : '¿Cómo cambio mi dirección de entrega?',
          );
        await w
          .getByTestId('chat-soporte')
          .getByRole('button', { name: en ? 'Send' : 'Enviar', exact: true })
          .click();
        await w
          .getByText(
            en ? 'How do I change my delivery address?' : '¿Cómo cambio mi dirección de entrega?',
          )
          .first()
          .waitFor({ timeout: 30_000 });
        await espera(5_000);
        await captura(w, 'chat-web-enviado');
        const fila = await sql(
          'SELECT permiso_ia, permiso_ia_version FROM camila_personas WHERE visitante_hash IS NOT NULL ORDER BY creado_en DESC LIMIT 1',
        );
        console.log('  registro del servidor:', JSON.stringify(fila.filas ?? fila.results ?? fila));
      }
      await ctxW.close();
    }
  }
} finally {
  await navegador?.close();
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ya estaba apagado */
  }
}
