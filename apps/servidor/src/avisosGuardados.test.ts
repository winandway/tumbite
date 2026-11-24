import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { mundo } from './pruebas/ayuda';
import { notificar } from './notificaciones';
import { historialParaRepartidor } from './avisosGuardados';

/**
 * C-AVISOS-GUARDADOS (24 nov 2026, primera carrera real; todos los países). Richard: después de una
 * carrera completa, la campana de Driver decía «No tienes avisos por ahora». Todo aviso que sale al
 * teléfono (oferta, cliente fijo, mensaje, recarga, papeles, viaje cancelado) queda guardado con su
 * hora para su campana: UNA fila por aviso y persona (no por aparato) y nada por mirar. La campana que
 * se vacía al leerla («visto hasta») es la de C-CAMPANA-SE-VACIA y marca también lo guardado.
 */
afterEach(() => vi.unstubAllGlobals());

function sinExpo() {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('exp.host')) {
      const n = (JSON.parse(String(init?.body)) as unknown[]).length;
      return new Response(
        JSON.stringify({ data: Array.from({ length: n }, () => ({ status: 'ok' })) }),
        {
          status: 200,
        },
      );
    }
    return new Response('{}', { status: 200 });
  });
}

const AVISO = (i: 'es' | 'en') =>
  i === 'en'
    ? { titulo: 'Ride canceled', cuerpo: 'The rider canceled.', datos: { tipo: 'viaje_cancelado' } }
    : {
        titulo: 'Viaje cancelado',
        cuerpo: 'El pasajero canceló.',
        datos: { tipo: 'viaje_cancelado' },
      };

const filas = async (m: ReturnType<typeof mundo>, id: string) =>
  Number(
    (
      await m.DB.prepare('SELECT COUNT(*) AS n FROM avisos_enviados WHERE usuario_id = ?')
        .bind(id)
        .first<{ n: number }>()
    )?.n ?? 0,
  );

describe('C-AVISOS-GUARDADOS', () => {
  it('cada aviso queda guardado UNA vez aunque la persona tenga dos teléfonos', async () => {
    sinExpo();
    const m = mundo();
    const c = await m.cuenta('repartidor', 'Conductor Uno');
    await m.DB.prepare(
      "INSERT INTO dispositivos (token, usuario_id, plataforma) VALUES ('ExponentPushToken[a]', ?1, 'android'), ('ExponentPushToken[b]', ?1, 'ios')",
    )
      .bind(c.id)
      .run();
    const antes = await filas(m, c.id);
    await notificar(m.extra as unknown as Env, m.DB, c.id, AVISO);
    expect(await filas(m, c.id)).toBe(antes + 1);
  });

  it('también sin teléfono registrado (la campana lo tiene igual)', async () => {
    sinExpo();
    const m = mundo();
    const c = await m.cuenta('repartidor', 'Conductor Dos');
    const antes = await filas(m, c.id);
    await notificar(m.extra as unknown as Env, m.DB, c.id, AVISO);
    expect(await filas(m, c.id)).toBe(antes + 1);
  });

  it('la campana de Driver lo trae con su hora, en su idioma, y mirarla no escribe', async () => {
    sinExpo();
    const m = mundo();
    const c = await m.cuenta('repartidor', 'Conductor Tres');
    await notificar(m.extra as unknown as Env, m.DB, c.id, AVISO);
    const guardadas = await filas(m, c.id);
    const es = await m.llamar('GET', '/datos/repartidor/avisos', undefined, c.token, {
      'x-idioma': 'es',
    });
    const a = (es.datos.avisos as Record<string, unknown>[]).find(
      (x) => x.guardado === true && x.tipoAviso === 'viaje_cancelado',
    );
    // Forma que ya pinta Driver 0.1.69 de la tienda: el título en «tipo», el texto debajo.
    expect(a).toMatchObject({
      tipo: 'Viaje cancelado',
      restaurante: 'El pasajero canceló.',
      titulo: 'Viaje cancelado',
      cuerpo: 'El pasajero canceló.',
      codigo: null,
    });
    expect(String(a?.en)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const en = await m.llamar('GET', '/datos/repartidor/avisos', undefined, c.token, {
      'x-idioma': 'en',
    });
    expect(
      (en.datos.avisos as Record<string, unknown>[]).find(
        (x) => x.guardado === true && x.tipoAviso === 'viaje_cancelado',
      ),
    ).toMatchObject({ titulo: 'Ride canceled' });
    expect(await filas(m, c.id)).toBe(guardadas);
  });

  it('la app de clientes de la tienda no recibe lo guardado (lo pintaría mal); la nueva lo pide', async () => {
    sinExpo();
    const m = mundo();
    const c = await m.cuenta('cliente', 'Cliente Uno');
    await notificar(m.extra as unknown as Env, m.DB, c.id, AVISO);
    const vieja = await m.llamar('GET', '/datos/mis-avisos', undefined, c.token);
    expect((vieja.datos.avisos as { tipo: string }[]).some((x) => x.tipo === 'aviso')).toBe(false);
    const nueva = await m.llamar('GET', '/datos/mis-avisos?historial=1', undefined, c.token, {
      'x-idioma': 'es',
    });
    expect(
      (nueva.datos.avisos as Record<string, unknown>[]).find((x) => x.tipo === 'aviso'),
    ).toMatchObject({ titulo: 'Viaje cancelado', cuerpo: 'El pasajero canceló.' });
  });

  it('abrir la campana marca leído también lo guardado (C-CAMPANA-SE-VACIA), en Driver y en clientes', async () => {
    sinExpo();
    const m = mundo();
    for (const [rol, ruta, campana] of [
      ['repartidor', '/datos/repartidor/avisos', 'repartidor'],
      ['cliente', '/datos/mis-avisos?historial=1', 'cliente'],
    ] as const) {
      const c = await m.cuenta(rol, `Persona ${rol}`);
      await notificar(m.extra as unknown as Env, m.DB, c.id, AVISO);
      const guardado = (d: Record<string, unknown>) =>
        (d.avisos as Record<string, unknown>[]).find(
          (x) => x.guardado === true || x.tipo === 'aviso',
        );
      const antes = (await m.llamar('GET', ruta, undefined, c.token)).datos;
      expect(guardado(antes)).toMatchObject({ leido: false });
      expect(Number(antes.sinLeer)).toBeGreaterThan(0);
      const r = await m.llamar(
        'POST',
        '/datos/campana/visto',
        { campana, hasta: String(guardado(antes)?.en) },
        c.token,
      );
      expect(r.estado).toBe(200);
      const despues = (await m.llamar('GET', ruta, undefined, c.token)).datos;
      expect(guardado(despues)).toMatchObject({ leido: true });
      expect(despues.sinLeer).toBe(0);
    }
  });

  it('en Driver no se repite lo que la campana ya calcula de un pedido de comida', () => {
    const filasDb = [
      {
        titulo_es: 'Pedido listo para recoger',
        cuerpo_es: 'x',
        titulo_en: 'Order ready',
        cuerpo_en: 'x',
        tipo: '',
        datos_json: JSON.stringify({ pedidoId: 'p1' }),
        creado_en: '2026-11-24 01:00:00',
      },
      {
        titulo_es: 'Cliente fijo: Marta',
        cuerpo_es: 'y',
        titulo_en: 'Regular rider: Marta',
        cuerpo_en: 'y',
        tipo: 'oferta_operacion',
        datos_json: '{}',
        creado_en: '2026-11-24 01:01:00',
      },
    ];
    const r = historialParaRepartidor(filasDb, new Set(['p1']), 'es');
    expect(r.map((x) => x.titulo)).toEqual(['Cliente fijo: Marta']);
  });
});
