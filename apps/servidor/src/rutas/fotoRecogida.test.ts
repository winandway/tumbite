import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { crearAlmacenPruebas } from '../pruebas/r2';

/**
 * C-FOTO-RECOGIDA (21 nov 2026, orden de Richard) — todos los países. Las «Fotos de la entrada» de
 * una dirección guardada también sirven cuando se pide un mototaxi o un viaje: el conductor ASIGNADO
 * ve la foto de la entrada mientras va a recoger. Deja de verla al recoger al pasajero o si el viaje
 * se cancela. Nunca un conductor no asignado ni antes de aceptar. Solo el punto de recogida, nunca el
 * destino. Un punto suelto en el mapa no lleva foto. Mirar no escribe.
 */
const CASA = { lat: 25.7617, lng: -80.1918 };
/** A unos 12 metros de la casa: el GPS del pasajero parado en su puerta. */
const EN_LA_PUERTA = { lat: 25.76178, lng: -80.19172, direccion: 'Calle de Ejemplo 100' };
/** A unos 350 metros: una esquina, un punto suelto. */
const ESQUINA = { lat: 25.7648, lng: -80.1918, direccion: 'Esquina de ejemplo' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };

async function preparar() {
  const almacen = crearAlmacenPruebas();
  const m = mundo({ BUCKET: almacen.bucket }, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Pasajera');
  for (const ruta of [
    '/datos/admin/servicios/moto',
    '/datos/admin/servicios/moto/zonas/US-FL-MIAMI',
  ])
    expect((await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token)).estado).toBe(200);
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    { servicio: 'moto', zona: 'US-FL-MIAMI', tarifa: TARIFA, motivo: 'Tarifa de prueba' },
    admin.token,
  );
  // Sin código para empezar: aquí se prueba la foto, no el PIN.
  expect(
    (
      await m.llamar(
        'PUT',
        '/datos/admin/viajes/ajustes',
        { zona: 'US-FL-MIAMI', servicio: 'moto', pin: 'nunca', selfieCasco: false },
        admin.token,
      )
    ).estado,
  ).toBe(200);
  const cond = await conductorDeMoto(m, CASA);
  const guardar = async (conFoto: boolean, donde = CASA, etiqueta = 'Casa') => {
    const d = (
      await m.llamar(
        'POST',
        '/datos/mis-direcciones',
        {
          etiqueta,
          direccion: 'Calle de Ejemplo 100',
          ...donde,
          instrucciones: 'Portón verde, toca dos veces',
        },
        cliente.token,
      )
    ).datos.direccion as { id: string };
    if (conFoto) await m.foto(`/datos/mis-direcciones/${d.id}/fotos/1`, cliente.token);
    return d;
  };
  const cotizar = async (origen: object, destino: object = DESTINO) =>
    (
      await m.llamar(
        'POST',
        '/datos/viajes/cotizar',
        { servicio: 'moto', origen, destino },
        cliente.token,
      )
    ).datos.cotizacion as { id: string; recogida: { guardada: boolean; conFotos: boolean } };
  const pedir = async (cotizacionId: string) =>
    (
      await m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId, metodoPago: 'efectivo' },
        cliente.token,
      )
    ).datos.viaje.id as string;
  const ver = (ruta: string, token: string) => m.llamar('GET', ruta, undefined, token);
  return { m, admin, cliente, cond, guardar, cotizar, pedir, ver };
}

describe('C-FOTO-RECOGIDA: el conductor ve la entrada mientras va a recoger', () => {
  it('solo el asignado, desde que acepta hasta que recoge al pasajero', async () => {
    const v = await preparar();
    await v.guardar(true);
    const cot = await v.cotizar(EN_LA_PUERTA);
    expect(cot.recogida).toMatchObject({ guardada: true, conFotos: true });
    const id = await v.pedir(cot.id);
    const lista = `/datos/conductor/operaciones/${id}/recogida`;
    // Antes de aceptar, nadie: ni quien recibe la oferta.
    expect((await v.ver(lista, v.cond.token)).estado).toBe(404);
    expect((await v.ver(`${lista}/1`, v.cond.token)).estado).toBe(404);
    expect(await v.cond.paso(id, 'aceptar')).toBe(200);
    const camino = await v.ver(lista, v.cond.token);
    expect(camino.datos).toEqual({
      fotos: [{ orden: 1, rol: 'frente' }],
      nombre: 'Casa',
      indicaciones: 'Portón verde, toca dos veces',
    });
    expect(camino.res.headers.get('cache-control')).toBe('private, no-store');
    const foto = await v.ver(`${lista}/1?tam=mini`, v.cond.token);
    expect(foto.estado).toBe(200);
    expect(foto.res.headers.get('cache-control')).toBe('private, no-store');
    // Otro conductor, el pasajero por esta ruta y nadie sin sesión: no.
    const otro = await conductorDeMoto(v.m, CASA);
    expect((await v.ver(lista, otro.token)).estado).toBe(404);
    expect((await v.ver(`${lista}/1`, otro.token)).estado).toBe(404);
    expect((await v.ver(lista, v.cliente.token)).estado).toBe(403);
    expect((await v.m.llamar('GET', `${lista}/1`)).estado).toBe(401);
    // Llegó y espera en la puerta: la sigue viendo (todavía busca la casa).
    expect(await v.cond.paso(id, 'llegue')).toBe(200);
    expect((await v.ver(lista, v.cond.token)).datos.fotos).toHaveLength(1);
    // Recogió al pasajero: se acabó, aunque el viaje siga.
    expect(await v.cond.paso(id, 'iniciar', {})).toBe(200);
    expect((await v.ver(lista, v.cond.token)).datos).toEqual({
      fotos: [],
      nombre: '',
      indicaciones: '',
    });
    expect((await v.ver(`${lista}/1`, v.cond.token)).estado).toBe(404);
  });

  it('si el viaje se cancela, el conductor deja de verla', async () => {
    const v = await preparar();
    await v.guardar(true);
    const id = await v.pedir((await v.cotizar(EN_LA_PUERTA)).id);
    expect(await v.cond.paso(id, 'aceptar')).toBe(200);
    const lista = `/datos/conductor/operaciones/${id}/recogida`;
    expect((await v.ver(lista, v.cond.token)).datos.fotos).toHaveLength(1);
    const r = await v.m.crudo(`/datos/viajes/${id}/cancelar`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${v.cliente.token}`,
        'content-type': 'application/json',
        'idempotency-key': 'cancelar-foto-1',
      },
      body: '{}',
    });
    expect(r.status).toBe(200);
    expect((await v.ver(lista, v.cond.token)).datos?.fotos ?? []).toEqual([]);
    expect((await v.ver(`${lista}/1`, v.cond.token)).estado).toBe(404);
  });

  it('un punto suelto en el mapa no lleva foto, aunque la persona tenga una casa guardada con fotos', async () => {
    const v = await preparar();
    await v.guardar(true);
    const cot = await v.cotizar(ESQUINA);
    expect(cot.recogida).toEqual({ guardada: false, conFotos: false, direccionId: null });
    const id = await v.pedir(cot.id);
    expect(await v.cond.paso(id, 'aceptar')).toBe(200);
    const lista = `/datos/conductor/operaciones/${id}/recogida`;
    expect((await v.ver(lista, v.cond.token)).datos.fotos).toEqual([]);
    expect((await v.ver(`${lista}/1`, v.cond.token)).estado).toBe(404);
  });

  it('la foto del DESTINO nunca se le muestra al conductor', async () => {
    const v = await preparar();
    // La casa con fotos es a donde va, no de donde sale.
    await v.guardar(true, { lat: DESTINO.lat, lng: DESTINO.lng });
    const cot = await v.cotizar(ESQUINA, DESTINO);
    expect(cot.recogida).toEqual({ guardada: false, conFotos: false, direccionId: null });
    const id = await v.pedir(cot.id);
    expect(await v.cond.paso(id, 'aceptar')).toBe(200);
    const lista = `/datos/conductor/operaciones/${id}/recogida`;
    expect((await v.ver(lista, v.cond.token)).datos.fotos).toEqual([]);
    expect((await v.ver(`${lista}/1`, v.cond.token)).estado).toBe(404);
  });

  it('desde una dirección guardada SIN fotos: se invita al pasajero y el conductor no ve nada', async () => {
    const v = await preparar();
    const casa = await v.guardar(false);
    const cot = await v.cotizar(EN_LA_PUERTA);
    expect(cot.recogida).toEqual({ guardada: true, conFotos: false, direccionId: casa.id });
    const id = await v.pedir(cot.id);
    expect(await v.cond.paso(id, 'aceptar')).toBe(200);
    expect(
      (await v.ver(`/datos/conductor/operaciones/${id}/recogida`, v.cond.token)).datos.fotos,
    ).toEqual([]);
    // El pasajero sabe, al terminar, si salió de un punto suelto (para ofrecerle guardarlo).
    expect((await v.ver(`/datos/viajes/${id}`, v.cliente.token)).datos.viaje.recogidaGuardada).toBe(
      true,
    );
  });

  it('si el pasajero borra la foto o la dirección en pleno viaje, el conductor deja de verla', async () => {
    const v = await preparar();
    const d = await v.guardar(true);
    const id = await v.pedir((await v.cotizar(EN_LA_PUERTA)).id);
    expect(await v.cond.paso(id, 'aceptar')).toBe(200);
    const lista = `/datos/conductor/operaciones/${id}/recogida`;
    expect((await v.ver(`${lista}/1`, v.cond.token)).estado).toBe(200);
    expect(
      (
        await v.m.llamar(
          'DELETE',
          `/datos/mis-direcciones/${d.id}/fotos/1`,
          undefined,
          v.cliente.token,
        )
      ).estado,
    ).toBe(200);
    expect((await v.ver(lista, v.cond.token)).datos.fotos).toEqual([]);
    expect((await v.ver(`${lista}/1`, v.cond.token)).estado).toBe(404);
  });

  it('mirar no escribe: ni la lista ni la foto tocan la base', async () => {
    const v = await preparar();
    await v.guardar(true);
    const id = await v.pedir((await v.cotizar(EN_LA_PUERTA)).id);
    expect(await v.cond.paso(id, 'aceptar')).toBe(200);
    const escritas: string[] = [];
    const preparado = v.m.DB.prepare.bind(v.m.DB);
    v.m.DB.prepare = (sql: string) => {
      if (
        /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql) &&
        !/sesiones|limites|intentos/i.test(sql)
      )
        escritas.push(sql);
      return preparado(sql);
    };
    const lista = `/datos/conductor/operaciones/${id}/recogida`;
    await v.ver(lista, v.cond.token);
    await v.ver(`${lista}/1`, v.cond.token);
    await v.ver(`${lista}/1?tam=mini`, v.cond.token);
    v.m.DB.prepare = preparado;
    expect(escritas).toEqual([]);
  });
});

describe('C-FOTO-RECOGIDA: candados del código', () => {
  const leer = (ruta: string) =>
    readFileSync(join(__dirname, '..', '..', '..', '..', ruta), 'utf8');
  it('Driver solo la pide mientras va a recoger o espera en la puerta, y la pantalla del viaje la muestra', () => {
    const pieza = leer('apps/repartidor/src/piezas/FotosPuerta.tsx');
    expect(pieza).toMatch(/activa: estado === 'asignado' \|\| estado === 'conductor_llego'/);
    expect(leer('apps/repartidor/src/viajes/ViajeActivo.tsx')).toContain('<TarjetaRecogida');
  });
  it('el servidor nunca lee la dirección del destino para el conductor', () => {
    const rutas = leer('apps/servidor/src/rutas/fotoPuerta.ts');
    expect(rutas).toContain('d.id = v.origen_direccion_id AND d.usuario_id = o.cliente_id');
    expect(rutas).not.toMatch(/destino_direccion_id/);
    expect(rutas).toContain("BUSCANDO_LA_ENTRADA = ['asignado', 'conductor_llego']");
  });
  it('el pasajero ve la invitación al pedir y la oferta de guardar el punto al terminar', () => {
    expect(leer('apps/cliente/src/viajes/PedirMoto.tsx')).toContain('<InvitacionFotoEntrada');
    expect(leer('apps/cliente/src/viajes/ViajeEnCurso.tsx')).toContain('<GuardarPuntoDeRecogida');
    const pieza = leer('apps/cliente/src/viajes/FotoEntradaViaje.tsx');
    expect(pieza).toContain('Solo la ve tu conductor, y solo mientras va hacia ti.');
    expect(pieza).toContain('Only your driver sees it, and only while on the way to you.');
  });
});
