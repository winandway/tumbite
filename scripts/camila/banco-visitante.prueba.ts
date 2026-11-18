/* eslint-disable security/detect-non-literal-fs-filename -- guion manual: las rutas salen del propio repositorio y de la variable SALIDA */
// Copia manual (ver banco-visitante.md). No corre en la verificación automática.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { usarTransporteCorreo } from '../correo';
import { mundo } from '../pruebas/ayuda';

const PREGUNTAS = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'scripts', 'camila', 'banco-visitante.txt'),
  'utf8',
)
  .split('\n')
  .filter(Boolean);

it('banco de visitante contra el modelo real', { timeout: 900_000 }, async () => {
  usarTransporteCorreo(
    async () => new Response(JSON.stringify({ success: true, message_id: 'm' })),
    { omitirDePrueba: false },
  );
  const m = mundo({
    YAD_TOKEN: 'tok',
    ADMIN_CORREOS: 'equipo@windoce.com',
    GEMINI_API_KEY: readFileSync(join(homedir(), '.config/tumbite/gemini-api-key'), 'utf8').trim(),
  });
  const filas: string[] = [];
  let n = 0;
  for (const pregunta of PREGUNTAS) {
    n += 1;
    const idioma = n > 30 ? 'en' : 'es';
    const r = await m.llamar('POST', '/datos/camila/mensaje', { texto: pregunta }, undefined, {
      'x-camila-visita': `banco-${n}`.padEnd(40, 'b'),
      'x-idioma': idioma,
      'cf-ipcountry': idioma === 'en' ? 'US' : 'VE',
    });
    filas.push(`## ${n}. ${pregunta}\n\n${String(r.datos.respuesta)}\n`);
  }
  const g = await m.DB.prepare('SELECT microdolares, llamadas FROM camila_gasto').first();
  writeFileSync(process.env.SALIDA!, `${filas.join('\n')}\n\nGasto: ${JSON.stringify(g)}\n`);
});
