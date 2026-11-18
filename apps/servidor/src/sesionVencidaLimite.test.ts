import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-SESION-TERMINADA (18 nov 2026, defensa en el servidor): un Driver de la versión vieja con la
 * sesión vencida preguntaba sin pausa. Tras varios 401 seguidos desde la misma IP con una llave que
 * no sirve, las rutas del conductor responden 429 (sin tocar la base ni la ruta). Quien tiene sesión
 * buena, aunque comparta IP, nunca se frena.
 */
const IP = '10.77.1.9';
const pedir = (m: ReturnType<typeof mundo>, token: string) =>
  m.crudo('/datos/repartidor/estado', {
    headers: { authorization: `Bearer ${token}`, 'cf-connecting-ip': IP },
  });

describe('las llaves vencidas no martillan las rutas del conductor', () => {
  it('tras 20 respuestas 401 seguidas desde la misma IP, 429 con Retry-After', async () => {
    const m = mundo();
    const estados: number[] = [];
    for (let i = 0; i < 25; i++) estados.push((await pedir(m, 'llave-vencida')).status);
    expect(estados.slice(0, 20).every((e) => e === 401)).toBe(true);
    expect(estados.slice(20).every((e) => e === 429)).toBe(true);
    const r = await pedir(m, 'llave-vencida');
    expect(r.headers.get('retry-after')).toBeTruthy();
  });
  it('quien tiene sesión buena desde la misma IP sigue entrando', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor');
    for (let i = 0; i < 25; i++) await pedir(m, 'llave-vencida');
    expect((await pedir(m, rep.token)).status).toBe(200);
  });
});

/**
 * C-SESION-TERMINADA (revisor, 18 nov 2026): las apps solo cierran la sesión cuando el servidor lo
 * marca sin dudas. «Contraseña actual equivocada» ya no es 401 (la sesión sigue buena).
 */
describe('el servidor dice sin dudas cuándo terminó la sesión', () => {
  it('sesión vencida: 401 con código y cabecera de sesión terminada', async () => {
    const m = mundo();
    const r = await m.crudo('/datos/repartidor/estado', {
      headers: { authorization: 'Bearer llave-vencida', 'cf-connecting-ip': '10.77.2.1' },
    });
    expect(r.status).toBe(401);
    expect(r.headers.get('x-sesion')).toBe('terminada');
    expect(((await r.json()) as { codigo?: string }).codigo).toBe('sesion_terminada');
  });
  it('contraseña actual equivocada: 403, sin código, y la sesión sigue buena', async () => {
    const m = mundo();
    const u = await m.cuenta('cliente');
    const clave = await m.llamar(
      'POST',
      '/datos/cuentas/clave',
      { actual: 'Equivocada99!', nueva: 'OtraClave2026!' },
      u.token,
    );
    expect(clave.estado).toBe(403);
    expect(clave.datos.codigo).toBeUndefined();
    const correo = await m.llamar(
      'POST',
      '/datos/cuentas/correo',
      { correo: 'nuevo@ejemplo.com', clave: 'Equivocada99!' },
      u.token,
    );
    expect(correo.estado).toBe(403);
    expect((await m.llamar('GET', '/datos/cuentas/yo', undefined, u.token)).estado).toBe(200);
  });
});

describe('el freno 429 lleva la marca de sesión terminada (revisor, 18 nov)', () => {
  it('así la app nueva sale enseguida aunque su IP esté frenada', async () => {
    const m = mundo();
    let r = await pedir(m, 'llave-vencida');
    for (let i = 0; i < 25; i++) r = await pedir(m, 'llave-vencida');
    expect(r.status).toBe(429);
    expect(r.headers.get('x-sesion')).toBe('terminada');
    expect(((await r.json()) as { codigo?: string }).codigo).toBe('sesion_terminada');
  });
  it('el 401 de equipo interno y del segundo factor usan el mismo mensaje marcado', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    for (const f of ['rutas/equipoInterno.ts', 'segundoFactor.ts']) {
      const s = readFileSync(join(__dirname, f), 'utf8');
      expect(s, f).toContain('SESION_TERMINADA');
      expect(s, f).not.toContain("'Tu sesión terminó. Vuelve a entrar.'");
    }
  });
});
