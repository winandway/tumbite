import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { sha256 } from './cripto';

/**
 * C-SESION-SE-RENUEVA (18 nov 2026): la sesión de clientes, conductores y restaurantes no vence
 * mientras se usa (30 días desde el último uso, una escritura al día como mucho, tope de 180 días
 * desde que se abrió, rescate de las vencidas hace menos de 7 días). El equipo interno no se alarga.
 * Lo que cierra una sesión (salir, cambio de clave, suspensión) sigue cerrándola al instante.
 */

type M = ReturnType<typeof mundo>;

async function fila(m: M, token: string) {
  return m.DB.prepare(
    `SELECT expira_en,
            ROUND((julianday(expira_en) - julianday('now')) * 24) AS horas,
            creada_en
       FROM sesiones WHERE id = ?`,
  )
    .bind(await sha256(token))
    .first<{ expira_en: string; horas: number; creada_en: string }>();
}

async function fijar(m: M, token: string, expira: string, creada?: string) {
  await m.DB.prepare(
    `UPDATE sesiones SET expira_en = datetime('now', ?), creada_en = COALESCE(datetime('now', ?), creada_en) WHERE id = ?`,
  )
    .bind(expira, creada ?? null, await sha256(token))
    .run();
}

const perfil = (m: M, token: string) => m.llamar('GET', '/datos/cuentas/perfil', undefined, token);

describe('C-SESION-SE-RENUEVA', () => {
  it('la sesión de un conductor usada a diario no vence: cada uso la deja en 30 días', async () => {
    const m = mundo();
    const r = await m.cuenta('repartidor');
    // Pasaron 29 días y medio desde que entró: le queda medio día.
    await fijar(m, r.token, '+12 hours', '-29 days');
    expect((await perfil(m, r.token)).estado).toBe(200);
    expect((await fila(m, r.token))!.horas).toBe(30 * 24);
    // Y así cada día: nunca le llega el vencimiento.
    for (let dia = 0; dia < 3; dia++) {
      await fijar(m, r.token, '+1 day');
      expect((await perfil(m, r.token)).estado).toBe(200);
      expect((await fila(m, r.token))!.horas).toBe(30 * 24);
    }
  });

  it('clientes y restaurantes también se renuevan', async () => {
    const m = mundo();
    for (const rol of ['cliente', 'restaurante'] as const) {
      const c = await m.cuenta(rol);
      await fijar(m, c.token, '+2 days', '-28 days');
      expect((await perfil(m, c.token)).estado).toBe(200);
      expect((await fila(m, c.token))!.horas).toBe(30 * 24);
    }
  });

  it('en la web la cookie también se alarga al renovar (y no se reenvía si no hubo renovación)', async () => {
    const m = mundo();
    const c = await m.cuenta('cliente');
    await fijar(m, c.token, '+2 days', '-28 days');
    const r = await m.llamar('GET', '/datos/cuentas/perfil', undefined, undefined, {
      cookie: `tumbite_sesion=${c.token}`,
    });
    expect(r.estado).toBe(200);
    expect(r.res.headers.get('set-cookie')).toContain('Max-Age=2592000');
    const otra = await m.llamar('GET', '/datos/cuentas/perfil', undefined, undefined, {
      cookie: `tumbite_sesion=${c.token}`,
    });
    expect(otra.res.headers.get('set-cookie')).toBeNull();
  });

  it('no escribe más de una vez al día por sesión', async () => {
    const m = mundo();
    const r = await m.cuenta('repartidor');
    // Recién renovada (le quedan más de 29 días): mirar diez veces no toca la fila.
    await fijar(m, r.token, '+29 days', '-1 day');
    await m.DB.prepare('UPDATE sesiones SET expira_en = datetime(expira_en, ?) WHERE id = ?')
      .bind('+6 hours', await sha256(r.token))
      .run();
    const antes = (await fila(m, r.token))!.expira_en;
    for (let i = 0; i < 10; i++) expect((await perfil(m, r.token)).estado).toBe(200);
    expect((await fila(m, r.token))!.expira_en).toBe(antes);
    // Con la base medida: cero escrituras en diez peticiones.
    let escrituras = 0;
    const medida = mundo(
      {},
      {
        envolver: (db) =>
          new Proxy(db, {
            get(t, p) {
              if (p === 'prepare')
                return (sql: string) => {
                  const st = t.prepare(sql);
                  if (/UPDATE sesiones/i.test(sql)) {
                    const run = st.bind.bind(st);
                    return {
                      bind: (...a: unknown[]) => {
                        const b = run(...a);
                        return {
                          ...b,
                          run: async () => {
                            const x = await b.run();
                            escrituras += Number(x.meta.changes ?? 0);
                            return x;
                          },
                          first: b.first.bind(b),
                          all: b.all.bind(b),
                        };
                      },
                    };
                  }
                  return st;
                };
              const v = Reflect.get(t, p);
              return typeof v === 'function' ? v.bind(t) : v;
            },
          }) as D1Database,
      },
    );
    const otro = await medida.cuenta('repartidor');
    await fijar(medida, otro.token, '+3 days', '-27 days');
    for (let i = 0; i < 10; i++) expect((await perfil(medida, otro.token)).estado).toBe(200);
    expect(escrituras).toBe(1);
  });

  it('una sesión del equipo interno no se alarga ni se rescata', async () => {
    const m = mundo({ ADMIN_CORREOS: 'dueno@ejemplo.com' });
    const a = await m.cuenta('admin', 'Soporte Dueño');
    await m.DB.prepare('UPDATE usuarios SET correo = ? WHERE id = ?')
      .bind('dueno@ejemplo.com', a.id)
      .run();
    await m.sesionLista(a.token);
    await fijar(m, a.token, '+2 days', '-28 days');
    const antes = (await fila(m, a.token))!.expira_en;
    expect((await perfil(m, a.token)).estado).toBe(200);
    expect((await fila(m, a.token))!.expira_en).toBe(antes);
    // Vencida hace un día: no se rescata.
    await fijar(m, a.token, '-1 day');
    expect((await perfil(m, a.token)).estado).toBe(401);
  });

  it('rescata la sesión vencida hace menos de 7 días; la de más, no', async () => {
    const m = mundo();
    const r = await m.cuenta('repartidor');
    await fijar(m, r.token, '-3 days', '-33 days');
    expect((await perfil(m, r.token)).estado).toBe(200);
    expect((await fila(m, r.token))!.horas).toBe(30 * 24);
    const viejo = await m.cuenta('repartidor');
    await fijar(m, viejo.token, '-8 days', '-38 days');
    expect((await perfil(m, viejo.token)).estado).toBe(401);
  });

  it('tope absoluto: 180 días desde que se abrió, aunque se use', async () => {
    const m = mundo();
    const r = await m.cuenta('repartidor');
    // Abierta hace 179 días: se renueva solo hasta el día 180.
    await fijar(m, r.token, '+12 hours', '-179 days');
    expect((await perfil(m, r.token)).estado).toBe(200);
    expect((await fila(m, r.token))!.horas).toBe(24);
    // Abierta hace 181 días y vencida ayer: no se rescata.
    await fijar(m, r.token, '-1 day', '-181 days');
    expect((await perfil(m, r.token)).estado).toBe(401);
  });

  it('salir, cambiar la clave y la suspensión siguen cerrando la sesión al instante', async () => {
    const m = mundo();
    // Salir.
    const a = await m.cuenta('repartidor');
    expect((await m.llamar('POST', '/datos/cuentas/salir', undefined, a.token)).estado).toBe(200);
    expect((await perfil(m, a.token)).estado).toBe(401);
    // Cambio de clave: la otra sesión del cliente queda fuera aunque esté «recién vencida».
    const c = await m.cuenta('cliente');
    const correo = (await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(c.id)
      .first<{ correo: string }>())!.correo;
    const otra = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo,
      clave: 'clave-segura-1',
    });
    const tokenOtra = otra.datos.token as string;
    await fijar(m, tokenOtra, '-1 day');
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/clave',
          { actual: 'clave-segura-1', nueva: 'clave-segura-2' },
          c.token,
        )
      ).estado,
    ).toBe(200);
    expect((await perfil(m, tokenOtra)).estado).toBe(401);
    expect((await perfil(m, c.token)).estado).toBe(200);
    // Suspensión (cuenta inactiva): ni vigente ni recién vencida entra.
    const s = await m.cuenta('repartidor');
    await fijar(m, s.token, '-1 day');
    await m.DB.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').bind(s.id).run();
    expect((await perfil(m, s.token)).estado).toBe(401);
    await fijar(m, s.token, '+10 days');
    expect((await perfil(m, s.token)).estado).toBe(401);
  });
});
