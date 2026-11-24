import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mundo } from '../pruebas/ayuda';
import {
  MAX_FALLOS_CUENTA,
  MAX_SIN_CUENTA_RED,
  TOPE_INTENTOS_DIA,
  anotarIntento,
  reiniciarTopeIntentos,
} from '../accesoIntentos';

/**
 * C-MENSAJES-ACCESO y C-INTENTOS-ACCESO (24 nov 2026, Richard) — todos los países. Un gerente de zona
 * creyó haber creado cuentas de conductores que nunca existieron: al entrar le decían «El correo o la
 * contraseña no coinciden» y al recuperar «ya te llegó el enlace». Nada le dijo «no hay cuenta», y el
 * servidor no guardaba ningún intento fallido. Ahora cada caso tiene su mensaje y su código, los
 * escudos siguen delante (Turnstile, límite por red, pausa por cuenta) y todo intento fallido queda
 * anotado para el panel.
 */
const CLAVE = 'clave-segura-1';
const ES = { 'x-idioma': 'es', 'x-tumbite-app': 'repartidor/0.1.69 android' };

async function preparar(env: Record<string, unknown> = {}) {
  const m = mundo(env);
  const correo = `conductor-${Math.random().toString(36).slice(2)}@ejemplo.com`;
  const r = await m.llamar(
    'POST',
    '/datos/cuentas/registro',
    { nombre: 'Persona Prueba', correo, clave: CLAVE, rol: 'repartidor' },
    undefined,
    ES,
  );
  expect(r.estado).toBe(201);
  const entrar = (c: string, clave: string, cab: Record<string, string> = ES) =>
    m.llamar('POST', '/datos/cuentas/entrar', { correo: c, clave }, undefined, cab);
  const intentos = async () =>
    (
      await m.DB.prepare(
        'SELECT accion, paso, correo, codigo, app, version FROM intentos_acceso ORDER BY id',
      ).all<{
        accion: string;
        paso: string;
        correo: string;
        codigo: string;
        app: string;
        version: string;
      }>()
    ).results;
  return { m, correo, entrar, intentos };
}

afterEach(() => {
  reiniciarTopeIntentos();
  vi.unstubAllGlobals();
});

describe('C-MENSAJES-ACCESO: entrar dice qué pasó', () => {
  it('correo sin cuenta: «No hay ninguna cuenta con ese correo», con su código y su casilla', async () => {
    const p = await preparar();
    const r = await p.entrar('nadie-aqui@ejemplo.com', CLAVE);
    expect(r.estado).toBe(401);
    expect(r.datos).toMatchObject({
      error: 'No hay ninguna cuenta con ese correo.',
      codigo: 'correo_sin_cuenta',
      campo: 'correo',
    });
    const en = await p.entrar('nadie-aqui@ejemplo.com', CLAVE, { 'x-idioma': 'en' });
    expect(en.datos.error).toBe('There’s no account with that email.');
  });

  it('correo con cuenta y contraseña mala: «La contraseña no es correcta», con su código y su casilla', async () => {
    const p = await preparar();
    const r = await p.entrar(p.correo, 'otra-clave-9');
    expect(r.estado).toBe(401);
    expect(r.datos).toMatchObject({
      error: 'La contraseña no es correcta.',
      codigo: 'clave_incorrecta',
      campo: 'clave',
    });
    const en = await p.entrar(p.correo, 'otra-clave-9', { 'x-idioma': 'en' });
    expect(en.datos.error).toBe('That password isn’t correct.');
    // La buena sigue entrando (con mayúsculas y espacios en el correo, como lo escribe la gente).
    const bien = await p.entrar(`  ${p.correo.toUpperCase()} `, CLAVE);
    expect(bien.estado).toBe(200);
  });

  it('el texto viejo que servía para los dos casos ya no existe en el servidor', () => {
    const cuentas = readFileSync(resolve(__dirname, 'cuentas.ts'), 'utf8');
    expect(cuentas).not.toContain('El correo o la contraseña no coinciden');
    expect(cuentas).not.toContain('Recarga la página');
  });
});

describe('C-MENSAJES-ACCESO: los escudos siguen delante', () => {
  it(`tras ${MAX_FALLOS_CUENTA} contraseñas malas la cuenta se pausa 15 minutos, con aviso claro, aunque la próxima sea la buena`, async () => {
    const p = await preparar();
    for (let i = 0; i < MAX_FALLOS_CUENTA; i++)
      expect((await p.entrar(p.correo, `mala-${i}-clave`)).datos.codigo).toBe('clave_incorrecta');
    const r = await p.entrar(p.correo, CLAVE);
    expect(r.estado).toBe(429);
    expect(r.datos.codigo).toBe('cuenta_bloqueada');
    expect(r.datos.error).toContain('15 minutos');
    expect(r.datos.token).toBeUndefined();
    // Pasados los 15 minutos vuelve a entrar.
    await p.m.DB.prepare(
      "UPDATE intentos_limite SET desde = datetime('now', '-16 minutes') WHERE llave LIKE 'cuenta:entrar:%'",
    ).run();
    expect((await p.entrar(p.correo, CLAVE)).estado).toBe(200);
  });

  it('entrar bien pone el contador en cero (los fallos sueltos de días distintos no la bloquean)', async () => {
    const p = await preparar();
    for (let i = 0; i < MAX_FALLOS_CUENTA - 1; i++) await p.entrar(p.correo, `mala-${i}-clave`);
    expect((await p.entrar(p.correo, CLAVE)).estado).toBe(200);
    for (let i = 0; i < MAX_FALLOS_CUENTA - 1; i++) await p.entrar(p.correo, `mala-${i}-clave`);
    expect((await p.entrar(p.correo, CLAVE)).estado).toBe(200);
  });

  it('límite por red: muchas pruebas seguidas desde la misma red se frenan (429)', async () => {
    const p = await preparar();
    const red = { ...ES, 'cf-connecting-ip': '10.250.1.1' };
    const estados: number[] = [];
    for (let i = 0; i < 12; i++)
      estados.push((await p.entrar(`otro-${i}@ejemplo.com`, CLAVE, red)).estado);
    expect(estados.slice(0, 10).every((e) => e === 401)).toBe(true);
    expect(estados.at(-1)).toBe(429);
  });

  it('con Turnstile encendido, entrar, crear cuenta y recuperar sin pase se rechazan con el código «escudo»', async () => {
    const p = await preparar();
    const env = { TURNSTILE_SECRET_KEY: '0x4AAAAAAAsecreto' };
    const m = mundo(env);
    const sinPase = [
      await m.llamar(
        'POST',
        '/datos/cuentas/entrar',
        { correo: p.correo, clave: CLAVE },
        undefined,
        ES,
      ),
      await m.llamar(
        'POST',
        '/datos/cuentas/registro',
        { nombre: 'Persona', correo: 'nueva@ejemplo.com', clave: CLAVE, rol: 'repartidor' },
        undefined,
        ES,
      ),
      await m.llamar('POST', '/datos/cuentas/recuperar', { correo: p.correo }, undefined, ES),
    ];
    for (const r of sinPase) {
      expect(r.estado).toBe(403);
      expect(r.datos.codigo).toBe('escudo');
      expect(r.datos.error).not.toContain('Recarga la página');
    }
    // Con un pase que Cloudflare da por bueno, pasa a la regla de siempre (aquí: no hay cuenta).
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    );
    const conPase = await m.llamar(
      'POST',
      '/datos/cuentas/entrar',
      { correo: 'nadie@ejemplo.com', clave: CLAVE },
      undefined,
      { ...ES, 'cf-turnstile-response': 'pase-bueno' },
    );
    expect(conPase.datos.codigo).toBe('correo_sin_cuenta');
  });
});

describe('C-MENSAJES-ACCESO: recuperar dice si no hay cuenta (nunca un «ya te llegó» falso)', () => {
  it('correo sin cuenta: 404 con «No hay ninguna cuenta con ese correo»; con cuenta, el enlace sale', async () => {
    const p = await preparar();
    const sin = await p.m.llamar(
      'POST',
      '/datos/cuentas/recuperar',
      { correo: 'nadie-aqui@ejemplo.com' },
      undefined,
      ES,
    );
    expect(sin.estado).toBe(404);
    expect(sin.datos).toMatchObject({
      error: 'No hay ninguna cuenta con ese correo.',
      codigo: 'correo_sin_cuenta',
      campo: 'correo',
    });
    const con = await p.m.llamar(
      'POST',
      '/datos/cuentas/recuperar',
      { correo: p.correo },
      undefined,
      ES,
    );
    expect(con.estado).toBe(200);
    expect(con.datos.ok).toBe(true);
  });
});

describe('C-INTENTOS-ACCESO: todo intento fallido queda anotado para el panel', () => {
  it('entrar sin cuenta, clave mala, recuperar sin cuenta y un alta rechazada dejan UNA fila cada uno; lo que sale bien, ninguna', async () => {
    const p = await preparar();
    expect(await p.intentos()).toEqual([]);
    await p.entrar('nadie-aqui@ejemplo.com', CLAVE);
    await p.entrar(p.correo, 'otra-clave-9');
    await p.m.llamar(
      'POST',
      '/datos/cuentas/recuperar',
      { correo: 'NADIE-AQUI@ejemplo.com' },
      undefined,
      ES,
    );
    await p.m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: 'Otra Persona', correo: p.correo, clave: CLAVE, rol: 'repartidor' },
      undefined,
      ES,
    );
    await p.entrar(p.correo, CLAVE);
    await p.m.llamar('POST', '/datos/cuentas/recuperar', { correo: p.correo }, undefined, ES);
    const filas = await p.intentos();
    expect(filas.map((f) => [f.accion, f.codigo, f.correo])).toEqual([
      ['entrar', 'correo_sin_cuenta', 'nadie-aqui@ejemplo.com'],
      ['entrar', 'clave_incorrecta', p.correo],
      ['recuperar', 'correo_sin_cuenta', 'nadie-aqui@ejemplo.com'],
      ['registro', 'correo_con_cuenta', p.correo],
    ]);
    expect(filas[0]).toMatchObject({ paso: 'servidor', app: 'repartidor', version: '0.1.69' });
  });

  it('un alta con el celular mal o sin datos también queda, con la casilla que falló', async () => {
    const p = await preparar();
    await p.m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: 'Persona', correo: 'nueva@ejemplo.com', clave: 'corta', rol: 'repartidor' },
      undefined,
      ES,
    );
    const [fila] = await p.intentos();
    expect(fila).toMatchObject({
      accion: 'registro',
      codigo: 'datos:clave',
      correo: 'nueva@ejemplo.com',
    });
  });

  it('presupuesto: nunca más de una fila por intento y un tope por día', async () => {
    const p = await preparar();
    for (let i = 0; i < 3; i++) await p.entrar(`x${i}@ejemplo.com`, CLAVE);
    expect((await p.intentos()).length).toBe(3);
    reiniciarTopeIntentos();
    let escritas = 0;
    for (let i = 0; i < TOPE_INTENTOS_DIA + 5; i++)
      if (await anotarIntento(p.m.DB, { accion: 'entrar', codigo: 'x' }, {})) escritas++;
    expect(escritas).toBe(TOPE_INTENTOS_DIA);
  });
});

describe('C-INTENTOS-ACCESO: el panel los muestra (quién, cuándo, en qué paso, qué error)', () => {
  it('el equipo ve los fallidos y los que salieron bien; una cuenta normal no entra', async () => {
    const p = await preparar();
    const admin = await p.m.cuenta('admin', 'Soporte Divoox');
    await p.entrar('nadie-aqui@ejemplo.com', CLAVE);
    await p.entrar(p.correo, CLAVE);
    const normal = await p.m.cuenta('repartidor');
    expect((await p.m.llamar('GET', '/datos/admin/accesos', undefined, normal.token)).estado).toBe(
      403,
    );
    const r = await p.m.llamar('GET', '/datos/admin/accesos', undefined, admin.token);
    expect(r.estado).toBe(200);
    expect(r.datos.conFallos).toBe(true);
    const de = (codigo: string) =>
      (r.datos.intentos as { codigo: string; correo: string; resultado: string }[]).filter(
        (f) => f.codigo === codigo,
      );
    // El correo sale tapado como todo dato personal del panel («Ver dato» lo muestra entero).
    expect(de('correo_sin_cuenta')[0]).toMatchObject({ resultado: 'fallo' });
    expect(de('correo_sin_cuenta')[0]?.correo).toMatch(/^n.*@ejemplo\.com$/);
    expect(de('entro').length).toBeGreaterThan(0);
    expect(de('cuenta_creada').length).toBeGreaterThan(0);
    expect(r.datos.resumen).toContainEqual({
      accion: 'entrar',
      codigo: 'correo_sin_cuenta',
      veces: 1,
    });
    // Buscar por correo.
    const solo = await p.m.llamar(
      'GET',
      '/datos/admin/accesos?correo=nadie-aqui',
      undefined,
      admin.token,
    );
    expect(solo.datos.intentos).toHaveLength(1);
    expect(solo.datos.intentos[0].codigo).toBe('correo_sin_cuenta');
  });
});

describe('C-INTENTOS-ACCESO: lo que falla en el teléfono también se ve', () => {
  it('la app avisa casillas mal, términos sin marcar o falta de señal; lo desconocido se rechaza', async () => {
    const p = await preparar();
    const r = await p.m.llamar(
      'POST',
      '/datos/cuentas/intento',
      {
        accion: 'registro',
        paso: 'formulario',
        codigo: 'validacion',
        detalle: 'telefono,clave',
        correo: 'Alguien@Ejemplo.com',
      },
      undefined,
      ES,
    );
    expect(r.datos.ok).toBe(true);
    const [fila] = await p.intentos();
    expect(fila).toMatchObject({
      accion: 'registro',
      paso: 'formulario',
      codigo: 'validacion',
      correo: 'alguien@ejemplo.com',
      app: 'repartidor',
    });
    const malo = await p.m.llamar(
      'POST',
      '/datos/cuentas/intento',
      { accion: 'borrar', paso: 'x', codigo: 'y' },
      undefined,
      ES,
    );
    expect(malo.estado).toBe(400);
    expect((await p.intentos()).length).toBe(1);
  });
});

/**
 * C-LIMITES-SIN-ESCUDO (24 nov 2026, Gerencia): producción no tiene Turnstile. Con los mensajes
 * específicos, los frenos son los límites. Todo aquí corre SIN la llave del escudo.
 */
describe('C-LIMITES-SIN-ESCUDO: sin Turnstile, los límites frenan entrar, crear cuenta y recuperar', () => {
  const misma = (ip: string) => ({ ...ES, 'cf-connecting-ip': ip });

  it('por red y por minuto: crear cuenta (10) y recuperar (5)', async () => {
    const p = await preparar();
    const registros: number[] = [];
    for (let i = 0; i < 11; i++)
      registros.push(
        (
          await p.m.llamar(
            'POST',
            '/datos/cuentas/registro',
            { nombre: 'Persona', correo: `n${i}@ejemplo.com`, clave: 'corta', rol: 'repartidor' },
            undefined,
            misma('10.251.1.1'),
          )
        ).estado,
      );
    expect(registros.at(-1)).toBe(429);
    const recuperar: number[] = [];
    for (let i = 0; i < 6; i++)
      recuperar.push(
        (
          await p.m.llamar(
            'POST',
            '/datos/cuentas/recuperar',
            { correo: p.correo },
            undefined,
            misma('10.251.1.2'),
          )
        ).estado,
      );
    expect(recuperar.slice(0, 5).every((e) => e === 200)).toBe(true);
    expect(recuperar.at(-1)).toBe(429);
  });

  it('por correo: crear cuenta y recuperar con el mismo correo una y otra vez se pausa, con aviso claro', async () => {
    const p = await preparar();
    let ultimo = { estado: 0, datos: {} as Record<string, unknown> };
    for (let i = 0; i < 6; i++)
      ultimo = await p.m.llamar(
        'POST',
        '/datos/cuentas/recuperar',
        { correo: p.correo },
        undefined,
        ES,
      );
    expect(ultimo.estado).toBe(429);
    expect(ultimo.datos).toMatchObject({
      codigo: 'demasiados_intentos',
      error: 'Hiciste muchos intentos con este correo. Espera 15 minutos y vuelve a intentarlo.',
    });
    for (let i = 0; i < 11; i++)
      ultimo = await p.m.llamar(
        'POST',
        '/datos/cuentas/registro',
        { nombre: 'Otra Persona', correo: p.correo, clave: CLAVE, rol: 'repartidor' },
        undefined,
        ES,
      );
    expect(ultimo.estado).toBe(429);
    expect(ultimo.datos.codigo).toBe('demasiados_intentos');
    const en = await p.m.llamar(
      'POST',
      '/datos/cuentas/recuperar',
      { correo: p.correo },
      undefined,
      {
        'x-idioma': 'en',
      },
    );
    expect(en.datos.error).toBe('Too many tries with this email. Wait 15 minutes and try again.');
  });

  it('por red: quien prueba muchos correos sin cuenta queda pausado una hora en entrar y en recuperar, aunque después use uno que existe', async () => {
    const p = await preparar();
    const ip = '10.252.1.1';
    await p.m.DB.prepare(
      "INSERT INTO intentos_limite (llave, cuenta, desde) VALUES (?, ?, datetime('now'))",
    )
      .bind(`red:sin_cuenta:${ip}`, MAX_SIN_CUENTA_RED - 1)
      .run();
    expect((await p.entrar('nadie-ultimo@ejemplo.com', CLAVE, misma(ip))).datos.codigo).toBe(
      'correo_sin_cuenta',
    );
    const r = await p.entrar(p.correo, CLAVE, misma(ip));
    expect(r.estado).toBe(429);
    expect(r.datos.codigo).toBe('red_pausada');
    expect(r.datos.error).toContain('Espera una hora');
    const rec = await p.m.llamar(
      'POST',
      '/datos/cuentas/recuperar',
      { correo: p.correo },
      undefined,
      misma(ip),
    );
    expect(rec.datos.codigo).toBe('red_pausada');
    // Desde otra red, la misma cuenta entra sin problema.
    expect((await p.entrar(p.correo, CLAVE)).estado).toBe(200);
  });
});
