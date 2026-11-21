// Capturas REALES del permiso de IA del chat de ayuda (C-PERMISO-IA-CHAT, 21 nov 2026) — todos los
// países. Con Driver web (/driver/) y la web pública reales contra el servidor LOCAL del recorrido
// (.recorrido, puerto 8790; antes: node scripts/recorrido/preparar.mjs). Enciende el servidor, toma las
// capturas y lo apaga. No toca el sitio de pruebas ni producción. Datos neutros.
//   permiso-ia-chat-driver   el aviso «Antes de escribirnos: tu permiso» en el chat de Driver
//   permiso-ia-chat-web      el mismo aviso en el chat de la web
//   permiso-ia-ajuste-driver «Ayuda con inteligencia artificial» en el Perfil de Driver
//   → docs/capturas/permiso-ia-chat/<nombre>-<es|en>.png
// Uso: node scripts/recorrido/capturas-permiso-ia-chat.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'permiso-ia-chat');
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
    const m = await interno('moto/armar');
    const conductor = { id: m.ids.conductor, token: m.tokens.conductor };
    await sql(
      `UPDATE usuarios SET nombre = '${en ? 'Sam Carter' : 'José Rojas'}', idioma = '${idioma}' WHERE id = '${conductor.id}'`,
    );
    const telefono = async (sesion) => {
      const ctx = await navegador.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
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

    // ───────── Driver: Ayuda → «Habla con soporte» → el aviso, antes de poder escribir
    const ctxD = await telefono(conductor);
    const d = await ctxD.newPage();
    await d.goto('/driver/');
    await d
      .getByLabel(en ? 'Profile' : 'Perfil')
      .first()
      .waitFor({ timeout: 60_000 });
    await d
      .getByLabel(en ? 'Menu' : 'Menú')
      .first()
      .click({ timeout: 20_000 });
    await d
      .getByText(en ? 'Help' : 'Ayuda', { exact: true })
      .first()
      .click({ timeout: 20_000 });
    await d.getByTestId('ayuda-hablar').click({ timeout: 20_000 });
    await d.getByTestId('chat-permiso-ia').waitFor({ timeout: 30_000 });
    if ((await d.getByTestId('chat-soporte-casilla').count()) !== 0)
      throw new Error('Driver deja escribir antes de contestar el permiso');
    await d.getByTestId('chat-permiso-ia-no').evaluate((e) => e.scrollIntoView({ block: 'end' }));
    await espera(600);
    await captura(d, 'permiso-ia-chat-driver');
    await d.getByTestId('chat-permiso-ia-no').click();
    await d.getByTestId('chat-soporte-casilla').waitFor({ timeout: 20_000 });
    // ───────── Driver: Perfil → «Ayuda con inteligencia artificial» (dice «No permitido»)
    await d.goto('/driver/');
    await d
      .getByLabel(en ? 'Profile' : 'Perfil')
      .first()
      .click({ timeout: 60_000 });
    const ajuste = d.getByTestId('ajuste-ia-chat');
    await ajuste.waitFor({ timeout: 30_000 });
    await ajuste.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await espera(600);
    await captura(d, 'permiso-ia-ajuste-driver');
    await ctxD.close();

    // ───────── Web: la burbuja del chat → el mismo aviso
    const ctxW = await telefono(null);
    const w = await ctxW.newPage();
    await w.goto(en ? '/' : '/es');
    await w
      .getByRole('button', { name: en ? /support/i : /soporte/i })
      .first()
      .click({ timeout: 60_000 });
    await w.getByTestId('chat-permiso-ia').waitFor({ timeout: 30_000 });
    await espera(600);
    await captura(w, 'permiso-ia-chat-web');
    await ctxW.close();
  }
} finally {
  await navegador?.close();
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ya estaba apagado */
  }
}
