// Capturas de Docs que muestran los rótulos de Divoox Driver que pasaron de «repartidor» a
// «conductor» (C-DRIVER-DICE-CONDUCTOR, 22 nov 2026) — todos los países. Contra el servidor LOCAL
// del recorrido (node scripts/recorrido/preparar.mjs y el servidor en PUERTO_RECORRIDO), con el
// Driver web real y una cuenta de ejemplo. No toca el sitio de pruebas ni producción.
//   instalar-driver-navegador  la pantalla «Entrar» con la etiqueta «Para conductores»
//   → docs/capturas/recorrido/<nombre>-<es|en>.png y apps/panel/public/docs/recorrido-*.webp
// El bloque «Conductor destacado» de «Mis calificaciones» necesita una cuenta con entregas de comida:
// lo toma scripts/docs/capturas-guias-faltantes.mjs (solo=driver) contra el sitio de pruebas.
// Uso: node scripts/recorrido/capturas-driver-conductor.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const PUBLICA = join(RAIZ, 'apps', 'panel', 'public', 'docs');
const webp = (png, destino) =>
  execFileSync('cwebp', ['-quiet', '-q', '82', '-resize', '540', '0', png, '-o', destino]);

const navegador = await chromium.launch();
try {
  for (const idioma of ['es', 'en']) {
    const en = idioma === 'en';
    const telefono = async (sesion) => {
      const ctx = await navegador.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
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

    // ───────── la pantalla de entrar, sin sesión
    const ctxE = await telefono(null);
    const e = await ctxE.newPage();
    await e.goto('/driver/', { waitUntil: 'networkidle' });
    await e
      .getByText(en ? 'For drivers' : 'Para conductores')
      .first()
      .waitFor({ timeout: 60_000 });
    await e.waitForTimeout(1500);
    const entrar = join(
      RAIZ,
      'docs',
      'capturas',
      'recorrido',
      `instalar-driver-navegador-${idioma}.png`,
    );
    await e.screenshot({ path: entrar });
    webp(entrar, join(PUBLICA, `recorrido-instalar-driver-navegador-${idioma}.webp`));
    await ctxE.close();

    console.log(`✓ ${idioma}`);
  }
} finally {
  await navegador.close();
}
