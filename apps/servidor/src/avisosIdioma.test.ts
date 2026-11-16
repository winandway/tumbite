import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AVISOS, avisoPara, idiomaAviso, notificar, usarTransporteAvisos } from './notificaciones';
import { mundo } from './pruebas/ayuda';

/**
 * C-AVISOS-IDIOMA (16 nov 2026, todos los países). A Richard los avisos le llegaban en inglés en su
 * iPhone aunque usa la app en español: el aviso se armaba con el idioma de la cuenta (el del registro),
 * no con el de la app de ese teléfono. Ahora cada aviso se pide como función del idioma y sale en el
 * de cada aparato. Este candado recorre TODO el servidor: un `notificar(` con un texto fijo (objeto)
 * se pone en rojo.
 */
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.ts$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

/** El cuarto argumento de cada `notificar(`: tiene que empezar por `(i) =>` (o `(idioma) =>`). */
export function avisosConTextoFijo(fuente: string): string[] {
  const malos: string[] = [];
  const re = /\bnotificar\(/g;
  for (let m = re.exec(fuente); m; m = re.exec(fuente)) {
    // Salta la definición y las importaciones.
    const antes = fuente.slice(Math.max(0, m.index - 30), m.index);
    if (/function\s+$/.test(antes) || (/async\s+$/.test(antes) && /function/.test(antes))) continue;
    let i = m.index + m[0].length;
    let nivel = 0;
    let comas = 0;
    let inicio = -1;
    for (; i < fuente.length; i++) {
      const ch = fuente[i];
      if (ch === '(' || ch === '{' || ch === '[') nivel++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        if (nivel === 0) break;
        nivel--;
      } else if (ch === ',' && nivel === 0) {
        comas++;
        if (comas === 3) inicio = i + 1;
      }
    }
    if (inicio < 0) continue;
    const cuarto = fuente.slice(inicio, i).trim();
    const cabeza = cuarto.replace(/\s+/g, '').split('=>')[0] ?? '';
    if (!['(i)', '(idioma)', '(i:Idioma)', '(idioma:Idioma)'].includes(cabeza))
      malos.push(cuarto.slice(0, 80).replace(/\s+/g, ' '));
  }
  return malos;
}

describe('C-AVISOS-IDIOMA: cada aviso sale en el idioma de cada aparato (candado)', () => {
  it('ningún notificar( del servidor manda un texto fijo', () => {
    const raiz = join(__dirname);
    const fallos: string[] = [];
    for (const f of archivos(raiz)) {
      if (f.endsWith('notificaciones.ts')) continue;
      for (const m of avisosConTextoFijo(readFileSync(f, 'utf8')))
        fallos.push(`${f.slice(raiz.length + 1)}: ${m}`);
    }
    expect(fallos).toEqual([]);
  });

  it('el detector ve un texto fijo y deja pasar una función del idioma', () => {
    expect(
      avisosConTextoFijo("notificar(env, db, u, { titulo: 'Hola', cuerpo: 'x' })"),
    ).toHaveLength(1);
    expect(avisosConTextoFijo('notificar(env, db, u, AVISOS.algo(f.idioma))')).toHaveLength(1);
    expect(avisosConTextoFijo('notificar(env, db, u, (i) => AVISOS.algo(i))')).toEqual([]);
  });

  it('el idioma del aparato manda; si no lo dijo, el de la cuenta; si nada, inglés', () => {
    expect(idiomaAviso('es', 'en')).toBe('es');
    expect(idiomaAviso(null, 'es')).toBe('es');
    expect(idiomaAviso(null, null)).toBe('en');
    expect(idiomaAviso('xx', undefined)).toBe('en');
  });

  it('el aviso se arma una vez por idioma', () => {
    let veces = 0;
    const f = avisoPara((i) => {
      veces++;
      return { titulo: i, cuerpo: i };
    });
    f('es');
    f('es');
    f('en');
    expect(veces).toBe(2);
  });
});

describe('C-AVISOS-IDIOMA: el caso de Richard, de punta a punta', () => {
  afterEach(() => usarTransporteAvisos(null));
  function expoFalso() {
    const mandados: { to: string; title: string }[] = [];
    usarTransporteAvisos(async (_u, init) => {
      const lote = JSON.parse(String(init.body)) as { to: string; title: string }[];
      mandados.push(...lote);
      return new Response(JSON.stringify({ data: lote.map(() => ({ status: 'ok' })) }), {
        status: 200,
      });
    });
    return mandados;
  }

  it('cuenta registrada en inglés, app del iPhone en español: el aviso llega en español', async () => {
    const mandados = expoFalso();
    const m = mundo();
    const u = await m.cuenta('cliente', 'Richard Prueba');
    await m.DB.prepare("UPDATE usuarios SET idioma = 'en' WHERE id = ?").bind(u.id).run();
    // La app publicada manda su idioma en la cabecera x-idioma de cada petición.
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: 'ExponentPushToken[iphone-richard]', plataforma: 'ios' },
      u.token,
      { 'x-idioma': 'es' },
    );
    expect(r.estado).toBe(200);
    await notificar({} as never, m.DB, u.id, (i) => AVISOS.pedidoNuevo(i, 'ABC123'));
    expect(mandados.at(-1)?.title).toBe(AVISOS.pedidoNuevo('es', 'ABC123').titulo);
    // La cuenta también queda en español (correos y SMS).
    const c = await m.DB.prepare('SELECT idioma FROM usuarios WHERE id = ?')
      .bind(u.id)
      .first<{ idioma: string }>();
    expect(c?.idioma).toBe('es');
  });

  it('cada teléfono en su idioma, y al cambiar el idioma en la app cambian sus avisos', async () => {
    const mandados = expoFalso();
    const m = mundo();
    const u = await m.cuenta('repartidor', 'Dos Telefonos');
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: 'ExponentPushToken[uno]', plataforma: 'ios', idioma: 'es' },
      u.token,
    );
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: 'ExponentPushToken[dos]', plataforma: 'android', idioma: 'en' },
      u.token,
    );
    await notificar({} as never, m.DB, u.id, (i) => AVISOS.pedidoNuevo(i, 'X1'));
    const porToken = new Map(mandados.map((x) => [x.to, x.title]));
    expect(porToken.get('ExponentPushToken[uno]')).toBe(AVISOS.pedidoNuevo('es', 'X1').titulo);
    expect(porToken.get('ExponentPushToken[dos]')).toBe(AVISOS.pedidoNuevo('en', 'X1').titulo);
    // Cambia el idioma en el selector de la app: todos sus teléfonos lo toman.
    await m.llamar('PUT', '/datos/cuentas/idioma', { idioma: 'en' }, u.token);
    mandados.length = 0;
    await notificar({} as never, m.DB, u.id, (i) => AVISOS.pedidoNuevo(i, 'X2'));
    expect(new Set(mandados.map((x) => x.title))).toEqual(
      new Set([AVISOS.pedidoNuevo('en', 'X2').titulo]),
    );
  });

  it('si el teléfono no dijo su idioma, el de la cuenta', async () => {
    const mandados = expoFalso();
    const m = mundo();
    const u = await m.cuenta('cliente', 'Sin Idioma');
    await m.DB.prepare("UPDATE usuarios SET idioma = 'es' WHERE id = ?").bind(u.id).run();
    await m.DB.prepare(
      "INSERT INTO dispositivos (token, usuario_id, plataforma) VALUES ('ExponentPushToken[viejo]', ?, 'ios')",
    )
      .bind(u.id)
      .run();
    await notificar({} as never, m.DB, u.id, (i) => AVISOS.pedidoNuevo(i, 'Z'));
    expect(mandados.at(-1)?.title).toBe(AVISOS.pedidoNuevo('es', 'Z').titulo);
  });
});
