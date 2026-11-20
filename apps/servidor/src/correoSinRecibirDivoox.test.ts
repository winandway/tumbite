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
    const cuerpos: { reply_to?: { address: string }; headers?: unknown }[] = [];
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
      cabeceras: { 'In-Reply-To': '<abc@buzon.test>' },
    });
    expect(cuerpos[0]?.reply_to).toEqual({ address: hilo });
    // El servicio de correo del sitio no admite cabeceras: nunca se le mandan.
    expect(cuerpos[0]?.headers).toBeUndefined();
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

  describe('la respuesta en hilo sale por el Worker que sí pone las cabeceras', () => {
    const HILO = 'https://hilo.ejemplo.com';
    const env = {
      YAD_TOKEN: 'x'.repeat(40),
      CORREO_HILO_URL: HILO,
      GERENTE_SECRETO: 'g'.repeat(48),
    } as never;
    const correo = {
      de: 'soporte' as const,
      para: 'cliente@ejemplo.com',
      asunto: 'Re: a',
      texto: 'b',
      // Solo viajan las dos cabeceras de hilo, y solo si son identificadores de correo.
      cabeceras: {
        'In-Reply-To': '<abc@buzon.test>',
        References: '<uno@buzon.test>\r\nBcc: otro@ejemplo.com',
        Bcc: 'espia@ejemplo.com',
      },
    };

    it('va al Worker con el secreto y solo las cabeceras válidas, y no pasa por el otro servicio', async () => {
      const llamadas: { url: string; permiso: string | null; cuerpo: Record<string, unknown> }[] =
        [];
      usarTransporteCorreo((u, init) => {
        llamadas.push({
          url: u,
          permiso: new Headers(init.headers).get('authorization'),
          cuerpo: JSON.parse(String(init.body)),
        });
        return Promise.resolve(new Response(JSON.stringify({ ok: true, id: 'h1' })));
      });
      const r = await enviarCorreo(env, correo);
      expect(r).toMatchObject({ ok: true, id: 'h1' });
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0]?.url).toBe(`${HILO}/enviar`);
      expect(llamadas[0]?.permiso).toBe(`Bearer ${'g'.repeat(48)}`);
      expect(llamadas[0]?.cuerpo).toMatchObject({
        para: 'cliente@ejemplo.com',
        asunto: 'Re: a',
        cabeceras: { 'In-Reply-To': '<abc@buzon.test>' },
      });
    });

    it('si el Worker falla o no contesta, el correo sale igual por el camino de siempre', async () => {
      for (const falla of ['estado', 'red'] as const) {
        const urls: string[] = [];
        usarTransporteCorreo((u) => {
          urls.push(u);
          if (u.startsWith(HILO))
            return falla === 'red'
              ? Promise.reject(new Error('sin red'))
              : Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 502 }));
          return Promise.resolve(new Response(JSON.stringify({ success: true, message_id: 'm' })));
        });
        const r = await enviarCorreo(env, correo);
        expect(r).toMatchObject({ ok: true, id: 'm' });
        expect(urls).toHaveLength(2);
      }
    });

    it('un correo sin hilo nunca pasa por el Worker', async () => {
      const urls: string[] = [];
      usarTransporteCorreo((u) => {
        urls.push(u);
        return Promise.resolve(new Response(JSON.stringify({ success: true, message_id: 'm' })));
      });
      await enviarCorreo(env, {
        de: 'soporte',
        para: 'cliente@ejemplo.com',
        asunto: 'a',
        texto: 'b',
      });
      expect(urls).toHaveLength(1);
      expect(urls[0]).not.toContain(HILO);
    });
  });
});
