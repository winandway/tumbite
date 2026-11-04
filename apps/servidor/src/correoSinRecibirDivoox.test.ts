import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CORREOS_SOPORTE } from '@tumbite/compartido';
import { enviarCorreo, usarTransporteCorreo } from './correo';

/**
 * C-CORREO-SIN-RECIBIR-DIVOOX (4 nov 2026, meta de Gerencia autorizada por Richard): divoox.com
 * nunca recibe correo (no tiene MX); desde ahí solo se ENVÍAN avisos. Todo lo que pueda recibir
 * (responder a, contacto público, el user-agent que dejamos a terceros) va a windoce.com.
 * Este candado se pone en rojo si una dirección de divoox.com distinta de no-reply aparece escrita
 * en el código vivo, o si un correo sale con «responder a» en divoox.com. Todos los países.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const CARPETAS = ['apps', 'packages'];
const SALTAR = new Set(['node_modules', 'dist', 'build', 'ios', 'android', '.expo']);
const EXTENSIONES = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.html']);
const DIRECCION = /[\w.%+-]+@[\w.-]+/g;
const deDivoox = (d: string) => /(^|[.@])divoox\.com$/i.test(d.replace(/\.+$/, ''));

function archivos(dir: string, fuera: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (SALTAR.has(nombre)) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivos(ruta, fuera);
    else if (EXTENSIONES.has(extname(nombre)) && !/\.test\.tsx?$/.test(nombre)) fuera.push(ruta);
  }
  return fuera;
}

describe('divoox.com no recibe correo', () => {
  afterEach(() => usarTransporteCorreo(null));

  it('ninguna dirección de divoox.com que pueda recibir aparece en el código vivo', () => {
    const halladas: string[] = [];
    for (const c of CARPETAS)
      for (const ruta of archivos(join(RAIZ, c)))
        for (const d of readFileSync(ruta, 'utf8').match(DIRECCION) ?? [])
          if (deDivoox(d) && !d.toLowerCase().startsWith('no-reply@'))
            halladas.push(`${relative(RAIZ, ruta)}: ${d}`);
    expect(halladas).toEqual([]);
  });

  it('los buzones de soporte y el contacto público reciben en windoce.com', () => {
    for (const correo of Object.values(CORREOS_SOPORTE)) expect(correo).toMatch(/@windoce\.com$/);
  });

  it('un «responder a» en divoox.com se cambia por el buzón de soporte que recibe', async () => {
    const cuerpos: { reply_to?: { address: string } }[] = [];
    usarTransporteCorreo((_e, init) => {
      cuerpos.push(JSON.parse(String(init.body)));
      return Promise.resolve(new Response(JSON.stringify({ success: true, message_id: 'm' })));
    });
    const env = { YAD_TOKEN: 'x'.repeat(40) } as never;
    await enviarCorreo(env, {
      de: 'soporte',
      para: 'cliente@ejemplo.com',
      asunto: 'a',
      texto: 'b',
      responderA: 'Support@Divoox.com',
    });
    expect(cuerpos[0]?.reply_to).toEqual({ address: CORREOS_SOPORTE.divoox });
  });
});
