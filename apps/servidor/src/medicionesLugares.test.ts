import { beforeEach, describe, expect, it } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG, CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import { sembrarTabuladorVigia } from './semillaTabuladorVigia';
import { sembrarLugaresVigia } from './semillaLugaresVigia';
import { vaciarCacheLugares } from './lugaresPropios';

/**
 * C-ESTOY-AQUI (27 nov 2026, Gerencia con luz verde de Richard) — todas las ciudades, con El Vigía
 * (Venezuela) de ejemplo. Los cuatro candados: sin aprobación no cambia nada; se respeta la
 * precisión mínima; un lugar de una ciudad nunca se mueve a otra; solo los asignados ven la tarea.
 */

type Sug = { id: string; principal: string; lat?: number; lng?: number };

async function preparar() {
  vaciarCacheLugares();
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  for (const c of [EVG, CCS]) {
    const r = await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      {
        servicio: 'moto',
        zona: {
          id: c.id,
          nombre: c.nombre,
          lat: c.lat,
          lng: c.lng,
          radioKm: c.radioKm,
          zonaHoraria: c.zonaHoraria,
        },
        motivo: 'ciudad para la prueba de mediciones',
      },
      admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  }
  expect(await sembrarTabuladorVigia(m.DB)).not.toBeNull();
  await sembrarLugaresVigia(m.DB);
  const lista = await m.llamar(
    'GET',
    `/datos/admin/lugares-propios?zona=${EVG.id}`,
    undefined,
    admin.token,
  );
  const lugares = lista.datos.lugares as {
    id: string;
    nombre: string;
    lat: number;
    lng: number;
    rutaId: string | null;
  }[];
  const km9 = lugares.find((l) => l.nombre === 'KM 9')!;
  const pedeca = lugares.find((l) => l.nombre === 'Pedeca')!;
  const conductor = await m.cuenta('repartidor', 'Carlos Conductor');
  const otro = await m.cuenta('repartidor', 'Otro Conductor');
  const crear = (cuerpo: Record<string, unknown>) =>
    m.llamar(
      'POST',
      '/datos/admin/mediciones',
      { zona: EVG.id, titulo: 'Medir El Vigía', ...cuerpo },
      admin.token,
    );
  const t = await crear({ lugares: [km9.id, pedeca.id], conductores: [conductor.id] });
  expect(t.estado, JSON.stringify(t.datos)).toBe(201);
  const tareaId = t.datos.tarea.id as string;
  // 60 m al norte del punto guardado.
  const cerca = (l: { lat: number; lng: number }) => ({ lat: l.lat + 0.00054, lng: l.lng });
  const medir = (
    quien: { token: string },
    lugarId: string,
    punto: { lat: number; lng: number },
    precisionM = 6,
    tarea = tareaId,
  ) =>
    m.llamar(
      'POST',
      `/datos/conductor/mediciones/${tarea}/lugares/${lugarId}`,
      { ...punto, precisionM, tomadaEn: Date.now() },
      quien.token,
    );
  const buscar = (q: string) =>
    m.llamar(
      'GET',
      `/datos/lugares/sugerencias?q=${encodeURIComponent(q)}&lat=${EVG.lat}&lng=${EVG.lng}`,
    );
  const leerLugar = (id: string) =>
    m.DB.prepare('SELECT lat, lng, zona_id FROM lugares_propios WHERE id = ?')
      .bind(id)
      .first<{ lat: number; lng: number; zona_id: string }>();
  return {
    m,
    admin,
    km9,
    pedeca,
    conductor,
    otro,
    tareaId,
    crear,
    cerca,
    medir,
    buscar,
    leerLugar,
  };
}

describe('C-ESTOY-AQUI: medir lugares propios en la calle', () => {
  beforeEach(() => vaciarCacheLugares());

  it('sin aprobación no cambia nada; al aprobar se mueve el lugar, su ruta y el buscador', async () => {
    const p = await preparar();
    const nuevo = p.cerca(p.km9);
    const r = await p.medir(p.conductor, p.km9.id, nuevo);
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    expect(r.datos.medicion.estado).toBe('pendiente');
    expect(r.datos.medicion.distanciaM).toBeGreaterThan(50);
    // Pendiente: el lugar, su ruta y el buscador siguen igual.
    expect(await p.leerLugar(p.km9.id)).toMatchObject({ lat: p.km9.lat, lng: p.km9.lng });
    const ruta0 = await p.m.DB.prepare('SELECT hasta_lat FROM rutas_precio_zona WHERE id = ?')
      .bind(p.km9.rutaId)
      .first<{ hasta_lat: number }>();
    expect(ruta0?.hasta_lat).toBe(p.km9.lat);
    // El panel la muestra con cuánto se movería.
    const panel = await p.m.llamar(
      'GET',
      `/datos/admin/mediciones?zona=${EVG.id}`,
      undefined,
      p.admin.token,
    );
    const med = panel.datos.tareas[0].mediciones[0];
    expect(med).toMatchObject({
      lugar: 'KM 9',
      estado: 'pendiente',
      conductor: 'Carlos Conductor',
    });
    // Aprobar.
    const ap = await p.m.llamar(
      'POST',
      `/datos/admin/mediciones/medicion/${med.id}/aprobar`,
      {},
      p.admin.token,
    );
    expect(ap.estado, JSON.stringify(ap.datos)).toBe(200);
    expect(await p.leerLugar(p.km9.id)).toMatchObject(nuevo);
    const ruta = await p.m.DB.prepare(
      'SELECT hasta_lat, hasta_lng FROM rutas_precio_zona WHERE id = ?',
    )
      .bind(p.km9.rutaId)
      .first();
    expect(ruta).toEqual({ hasta_lat: nuevo.lat, hasta_lng: nuevo.lng });
    const s = ((await p.buscar('km 9')).datos.sugerencias as Sug[])[0]!;
    expect(s.principal).toBe('KM 9');
    // Dos veces no se aprueba.
    const otra = await p.m.llamar(
      'POST',
      `/datos/admin/mediciones/medicion/${med.id}/aprobar`,
      {},
      p.admin.token,
    );
    expect(otra.estado).toBe(409);
  });

  it('rechazar no toca el lugar; si el lugar cambió a mano después de medir, no se aprueba', async () => {
    const p = await preparar();
    const a = await p.medir(p.conductor, p.km9.id, p.cerca(p.km9));
    const rech = await p.m.llamar(
      'POST',
      `/datos/admin/mediciones/medicion/${a.datos.medicion.id}/rechazar`,
      { motivo: 'Es el otro lado de la vía' },
      p.admin.token,
    );
    expect(rech.estado).toBe(200);
    expect(await p.leerLugar(p.km9.id)).toMatchObject({ lat: p.km9.lat, lng: p.km9.lng });
    const b = await p.medir(p.conductor, p.pedeca.id, p.cerca(p.pedeca));
    await p.m.DB.prepare('UPDATE lugares_propios SET lat = lat + 0.001 WHERE id = ?')
      .bind(p.pedeca.id)
      .run();
    const ap = await p.m.llamar(
      'POST',
      `/datos/admin/mediciones/medicion/${b.datos.medicion.id}/aprobar`,
      {},
      p.admin.token,
    );
    expect(ap.estado).toBe(409);
  });

  it('se respeta la precisión mínima (en el servidor y en la base)', async () => {
    const p = await preparar();
    for (const malo of [16, 40, 0, -3, Number.NaN]) {
      const r = await p.medir(p.conductor, p.km9.id, p.cerca(p.km9), malo);
      expect(r.estado, `precisión ${malo}`).not.toBe(201);
    }
    expect((await p.medir(p.conductor, p.km9.id, p.cerca(p.km9), 15)).estado).toBe(201);
    // Ni escribiendo directo en la base entra una medición peor que 15 m.
    await expect(
      p.m.DB.prepare(
        `INSERT INTO mediciones_lugar (id, tarea_id, lugar_id, zona_id, conductor_id, lat, lng, precision_m,
           tomada_en, antes_lat, antes_lng, distancia_m) VALUES ('x', ?, ?, ?, ?, 8.6, -71.6, 20, '2026-11-27', 8.6, -71.6, 0)`,
      )
        .bind(p.tareaId, p.km9.id, EVG.id, p.conductor.id)
        .run(),
    ).rejects.toThrow();
  });

  it('un lugar de una ciudad nunca se mueve a otra', async () => {
    const p = await preparar();
    // Un lugar de Caracas no entra en una tarea de El Vigía.
    const ccs = await p.m.llamar(
      'POST',
      '/datos/admin/lugares-propios',
      {
        zona: CCS.id,
        nombre: 'Plaza de prueba',
        otrosNombres: [],
        lat: CCS.lat,
        lng: CCS.lng,
        rutaId: null,
      },
      p.admin.token,
    );
    expect(ccs.estado, JSON.stringify(ccs.datos)).toBe(201);
    const mezcla = await p.crear({ lugares: [p.km9.id, ccs.datos.lugar.id] });
    expect(mezcla.estado).toBe(400);
    // Medir desde Caracas (o a más de 5 km) no se guarda.
    const lejos = await p.medir(p.conductor, p.km9.id, { lat: CCS.lat, lng: CCS.lng });
    expect(lejos.estado).toBe(422);
    const seis = await p.medir(p.conductor, p.km9.id, { lat: p.km9.lat + 0.055, lng: p.km9.lng });
    expect(seis.estado).toBe(422);
    const { n } = (await p.m.DB.prepare('SELECT COUNT(*) AS n FROM mediciones_lugar').first<{
      n: number;
    }>())!;
    expect(n).toBe(0);
    // Y si alguien la escribe en la base, aprobarla no la deja salir de la ciudad.
    await p.m.DB.prepare(
      `INSERT INTO mediciones_lugar (id, tarea_id, lugar_id, zona_id, conductor_id, lat, lng, precision_m,
         tomada_en, antes_lat, antes_lng, distancia_m) VALUES ('mala', ?, ?, ?, ?, ?, ?, 5, '2026-11-27', ?, ?, 0)`,
    )
      .bind(p.tareaId, p.km9.id, EVG.id, p.conductor.id, CCS.lat, CCS.lng, p.km9.lat, p.km9.lng)
      .run();
    const ap = await p.m.llamar(
      'POST',
      '/datos/admin/mediciones/medicion/mala/aprobar',
      {},
      p.admin.token,
    );
    expect(ap.estado).toBe(409);
    expect(await p.leerLugar(p.km9.id)).toMatchObject({ zona_id: EVG.id, lat: p.km9.lat });
  });

  it('solo los asignados ven y miden la tarea', async () => {
    const p = await preparar();
    const ve = (q: { token: string }) =>
      p.m.llamar('GET', '/datos/conductor/mediciones', undefined, q.token);
    const mia = await ve(p.conductor);
    expect(mia.datos.tareas).toHaveLength(1);
    expect(mia.datos.tareas[0].lugares.map((l: { nombre: string }) => l.nombre)).toEqual([
      'KM 9',
      'Pedeca',
    ]);
    expect((await ve(p.otro)).datos.tareas).toEqual([]);
    expect((await p.medir(p.otro, p.km9.id, p.cerca(p.km9))).estado).toBe(404);
    // Un cliente no entra.
    const cliente = await p.m.cuenta('cliente', 'Luis Pasajero');
    expect((await ve(cliente)).estado).toBe(403);
    // Se reasigna: el de antes deja de verla y el nuevo la ve.
    const re = await p.m.llamar(
      'PUT',
      `/datos/admin/mediciones/${p.tareaId}/asignados`,
      { conductores: [p.otro.id] },
      p.admin.token,
    );
    expect(re.estado).toBe(200);
    expect((await ve(p.conductor)).datos.tareas).toEqual([]);
    expect((await ve(p.otro)).datos.tareas).toHaveLength(1);
    expect((await p.medir(p.conductor, p.km9.id, p.cerca(p.km9))).estado).toBe(404);
    // Cerrada, nadie la ve.
    await p.m.llamar('POST', `/datos/admin/mediciones/${p.tareaId}/cerrar`, {}, p.admin.token);
    expect((await ve(p.otro)).datos.tareas).toEqual([]);
    // Una tarea sin asignar no la ve ningún conductor.
    const sin = await p.crear({ lugares: [p.km9.id] });
    expect(sin.estado).toBe(201);
    expect((await ve(p.conductor)).datos.tareas).toEqual([]);
    expect((await ve(p.otro)).datos.tareas).toEqual([]);
  });

  it('la foto opcional queda privada: solo el que midió la sube y solo el equipo la ve', async () => {
    const p = await preparar();
    const a = await p.medir(p.conductor, p.km9.id, p.cerca(p.km9));
    const id = a.datos.medicion.id as string;
    const ruta = `/datos/conductor/mediciones/medicion/${id}/foto`;
    expect((await p.m.foto(ruta, p.otro.token)).estado).toBe(404);
    const ok = await p.m.foto(ruta, p.conductor.token);
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(200);
    const ver = await p.m.llamar(
      'GET',
      `/datos/admin/mediciones?zona=${EVG.id}`,
      undefined,
      p.admin.token,
    );
    expect(ver.datos.tareas[0].mediciones[0].conFoto).toBe(true);
    const foto = await p.m.llamar(
      'GET',
      `/datos/admin/mediciones/medicion/${id}/foto`,
      undefined,
      p.conductor.token,
    );
    expect(foto.estado).toBe(403);
  });
});
