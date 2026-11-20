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
// Las carpetas de compilación (ignoradas por git) se saltan: un compilado viejo en una Mac no es código vivo.
const SALTAR = new Set([
  'node_modules',
  'dist',
  'dist-web',
  '.dist-worker',
  'build',
  'coverage',
  'ios',
  'android',
  '.expo',
]);
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

  it('la única excepción: la dirección de una conversación de Camila, que sí recibe (C-CAMILA-CORREO-HILO)', async () => {
    const cuerpos: { reply_to?: { address: string }; headers?: Record<string, string> }[] = [];
    usarTransporteCorreo((_e, init) => {
      cuerpos.push(JSON.parse(String(init.body)));
      return Promise.resolve(new Response(JSON.stringify({ success: true, message_id: 'm' })));
    });
    const env = { YAD_TOKEN: 'x'.repeat(40) } as never;
    const hilo = `support+c${'0123456789abcdef0123'}@${'divoox'}.com`;
    await enviarCorreo(env, {
      de: 'soporte',
      para: 'cliente@ejemplo.com',
      asunto: 'a',
      texto: 'b',
      responderA: hilo,
      // Solo viajan las dos cabeceras de hilo, y solo si son identificadores de correo.
      cabeceras: {
        'In-Reply-To': '<abc@buzon.test>',
        References: '<uno@buzon.test>\r\nBcc: otro@ejemplo.com',
        Bcc: 'espia@ejemplo.com',
      },
    });
    expect(cuerpos[0]?.reply_to).toEqual({ address: hilo });
    expect(cuerpos[0]?.headers).toEqual({ 'In-Reply-To': '<abc@buzon.test>' });
    // Un identificador mal formado, o sin el «+c…», no pasa.
    for (const mala of [`support+c123@${'divoox'}.com`, `support+cualquiera@${'divoox'}.com`]) {
      await enviarCorreo(env, {
        de: 'soporte',
        para: 'cliente@ejemplo.com',
        asunto: 'a',
        texto: 'b',
        responderA: mala,
      });
      expect(cuerpos[cuerpos.length - 1]?.reply_to).toEqual({ address: CORREOS_SOPORTE.divoox });
    }
  });

  it('si el servicio no acepta las cabeceras de hilo, el correo sale igual, una vez más y sin ellas', async () => {
    const cuerpos: { headers?: Record<string, string> }[] = [];
    usarTransporteCorreo((_e, init) => {
      const c = JSON.parse(String(init.body)) as { headers?: Record<string, string> };
      cuerpos.push(c);
      return Promise.resolve(
        c.headers
          ? new Response(JSON.stringify({ success: false, error: 'invalid_request_schema' }), {
              status: 400,
            })
          : new Response(JSON.stringify({ success: true, message_id: 'm' })),
      );
    });
    const r = await enviarCorreo({ YAD_TOKEN: 'x'.repeat(40) } as never, {
      de: 'soporte',
      para: 'cliente@ejemplo.com',
      asunto: 'a',
      texto: 'b',
      cabeceras: { 'In-Reply-To': '<abc@buzon.test>' },
    });
    expect(r.ok).toBe(true);
    expect(cuerpos.map((c) => Boolean(c.headers))).toEqual([true, false]);
  });
});
