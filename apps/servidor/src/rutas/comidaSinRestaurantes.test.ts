import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { serviciosPublicosEnZona } from './servicios';

/**
 * C-SERVICIO-SIN-OFERTA, lado del cliente, Comida y tiendas (24 nov 2026, ensayo general en Tucaní) —
 * todos los países. La app de clientes ofrecía Comida en una zona sin un solo restaurante y, al
 * entrar, decía «No restaurants in your area yet. Coming soon!» (prohibido: C-SOLO-LO-TERMINADO).
 * Comida, Mercado, Farmacia y Licores se ofrecen al cliente solo donde hay un comercio aprobado de
 * ese tipo; si no, «no disponible en tu zona» (la app de la tienda abre la hoja «aún no hay»).
 */
const MIAMI = { lat: 25.7617, lng: -80.1918 };
const estado = async (m: ReturnType<typeof mundo>, id: string) =>
  (
    (await m.llamar('GET', `/datos/servicios?lat=${MIAMI.lat}&lng=${MIAMI.lng}`)).datos
      .servicios as { id: string; estado: string; accion: string }[]
  ).find((s) => s.id === id);

async function restaurante(m: ReturnType<typeof mundo>, tipo?: string) {
  const dueno = await m.cuenta('restaurante', 'Dueña de ejemplo');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const id = r.datos.restaurante.id as string;
  if (tipo) await m.llamar('PUT', '/datos/mi-restaurante/tipo', { tipo }, dueno.token);
  return id;
}
const aprobar = (m: ReturnType<typeof mundo>, id: string) =>
  m.DB.prepare("UPDATE restaurantes SET estado = 'aprobado', zona_id = 'US-FL-MIAMI' WHERE id = ?")
    .bind(id)
    .run();

describe('C-SERVICIO-SIN-OFERTA: Comida y tiendas al cliente solo donde hay comercios', () => {
  it('Comida abierta en la zona pero sin restaurantes aprobados: «no disponible en tu zona»', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    await m.DB.prepare(
      "UPDATE restaurantes SET estado = 'pausado' WHERE zona_id = 'US-FL-MIAMI'",
    ).run();
    expect(await estado(m, 'comida')).toMatchObject({
      estado: 'no_disponible_zona',
      accion: 'no_disponible_zona',
    });
    expect((await serviciosPublicosEnZona(m.DB, 'US-FL-MIAMI')).has('comida')).toBe(false);
  });

  it('con un restaurante aprobado vuelve a ofrecerse (y uno pendiente no cuenta)', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    await m.DB.prepare(
      "UPDATE restaurantes SET estado = 'pausado' WHERE zona_id = 'US-FL-MIAMI'",
    ).run();
    const id = await restaurante(m);
    await m.DB.prepare("UPDATE restaurantes SET zona_id = 'US-FL-MIAMI' WHERE id = ?")
      .bind(id)
      .run();
    expect(await estado(m, 'comida')).toMatchObject({ estado: 'no_disponible_zona' });
    await aprobar(m, id);
    expect(await estado(m, 'comida')).toMatchObject({ estado: 'disponible', accion: 'abrir' });
  });

  it('una tienda (mercado) no cuenta como restaurante para Comida', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    await m.DB.prepare(
      "UPDATE restaurantes SET estado = 'pausado' WHERE zona_id = 'US-FL-MIAMI'",
    ).run();
    const id = await restaurante(m, 'mercado');
    await aprobar(m, id);
    expect(await estado(m, 'comida')).toMatchObject({ estado: 'no_disponible_zona' });
  });
});
