import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/**
 * C-MENU-RAPIDO (4 nov 2026, Richard: «tarda 3, 4, a veces 5 segundos… imagínate cuando tenga 50.000»).
 * La ficha del restaurante hacía unas diez consultas a la base, una detrás de otra (cada viaje a la base
 * en la nube cuesta entre 50 y 150 ms). Las que no dependen entre sí van a la vez: el tiempo es el de
 * pocas tandas, no el de la suma. Se mide con cada consulta demorada a propósito. Todos los países.
 */
const DEMORA_MS = 40;

describe('la ficha del restaurante responde rápido', () => {
  it('con cada consulta demorada, la ficha tarda pocas tandas y no la suma de todas', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    for (const nombreEs of ['Pizza', 'Ensalada', 'Refresco'])
      await m.llamar(
        'POST',
        '/datos/mi-restaurante/platos',
        { nombreEs, precioCentavos: 900 },
        dueno.token,
      );

    // Cada consulta tarda DEMORA_MS, como en la nube.
    const original = m.DB.prepare.bind(m.DB);
    let consultas = 0;
    m.DB.prepare = ((sql: string) => {
      const s = original(sql);
      const demorar =
        <T>(f: () => Promise<T>) =>
        async () => {
          consultas++;
          await new Promise((res) => setTimeout(res, DEMORA_MS));
          return f();
        };
      const envolver = (st: D1PreparedStatement): D1PreparedStatement =>
        new Proxy(st, {
          get(obj, k) {
            if (k === 'bind') return (...v: unknown[]) => envolver(obj.bind(...v));
            if (k === 'first' || k === 'all' || k === 'run' || k === 'raw') {
              const fn = (obj[k] as (...a: unknown[]) => Promise<unknown>).bind(obj);
              return (...a: unknown[]) => demorar(() => fn(...a))();
            }
            return Reflect.get(obj, k);
          },
        });
      return envolver(s);
    }) as typeof m.DB.prepare;

    const inicio = Date.now();
    const f = await m.llamar('GET', `/datos/restaurantes/${rid}`);
    const tardo = Date.now() - inicio;
    expect(f.estado).toBe(200);
    expect(f.datos.platos).toHaveLength(3);
    // Antes: más de diez tandas seguidas. Ahora: como mucho seis, aunque haya más consultas.
    expect(consultas).toBeGreaterThan(6);
    expect(tardo, `tardó ${tardo} ms con ${consultas} consultas`).toBeLessThan(DEMORA_MS * 6.5);
    // Y la guarda el borde de la red un rato corto: las visitas siguientes ni llegan a la base.
    expect(f.res.headers.get('cache-control')).toMatch(
      /public.*s-maxage=30.*stale-while-revalidate/,
    );
  });
});

describe('la app abre el menú al instante (C-MENU-RAPIDO)', () => {
  it('pide cada ficha una sola vez, la guarda y no guarda un error', async () => {
    const { pedirFicha, fichaGuardada, olvidarFichas } =
      await import('../../../cliente/src/comida/fichaRestaurante');
    olvidarFichas();
    let llamadas = 0;
    let fallar = false;
    const api = {
      pedir: async () => {
        llamadas++;
        if (fallar) throw new Error('sin conexión');
        return { restaurante: { id: 'r1' }, platos: [] };
      },
    } as never;
    await Promise.all([pedirFicha(api, 'r1'), pedirFicha(api, 'r1')]);
    expect(llamadas).toBe(1);
    expect(fichaGuardada<{ restaurante: { id: string } }>('r1')?.restaurante.id).toBe('r1');
    fallar = true;
    await expect(pedirFicha(api, 'r2')).rejects.toThrow();
    fallar = false;
    await pedirFicha(api, 'r2');
    expect(llamadas).toBe(3);
  });

  it('la ficha sale de lo guardado, muestra renglones de espera y la portada la pide antes', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const ruta = (...p: string[]) => join(__dirname, '..', '..', '..', 'cliente', 'src', ...p);
    const ficha = readFileSync(ruta('app', 'restaurant', '[id].tsx'), 'utf8');
    expect(ficha).toMatch(/useState<[\s\S]*?>\(\(\) => fichaGuardada\(id\)\)/);
    expect(ficha).toMatch(/!datos && !error \? <MenuEsperando \/>/);
    expect(readFileSync(ruta('Inicio.tsx'), 'utf8')).toMatch(/adelantarFichas\(\s*api,/);
  });
});
