import { expect } from 'vitest';
import { FOTO_PRUEBA, type mundo } from './ayuda';

/**
 * Divoox Flex · Fase 2 (C-FLEX-OCUPACION, C-FLEX-RUTAS, C-FLEX-ESCANEO, C-FLEX-ENTREGA,
 * C-FLEX-DEVOLUCIONES). Rutas operativas de punta a punta con SQLite en memoria y el almacén de
 * fotos de mentira. Sin dinero.
 */
export type M = ReturnType<typeof mundo>;
export const B = '/datos/v1/flex';
let n = 0;
export const k = () => `k-${Date.now()}-${n++}`;

export async function llamar(
  m: M,
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
  token?: string,
  extra: Record<string, string> = {},
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'cf-connecting-ip': `10.8.${n % 250}.${(n * 13) % 250}`,
    'idempotency-key': k(),
    ...extra,
  };
  n++;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await m.crudo(ruta, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { estado: res.status, datos: (await res.json().catch(() => ({}))) as any };
}
export async function subir(m: M, ruta: string, token: string, tipo = 'foto', clave = k()) {
  n++;
  const res = await m.crudo(`${ruta}?tipo=${tipo}&lat=25.77&lng=-80.19`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'image/webp',
      'idempotency-key': clave,
      'cf-connecting-ip': `10.7.${n % 250}.${(n * 7) % 250}`,
    },
    body: FOTO_PRUEBA as BodyInit,
  });
  return { estado: res.status, datos: (await res.json().catch(() => ({}))) as any };
}
export const confirmar = (m: M, id: string) =>
  m.DB.prepare("UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
export const correoDe = async (m: M, id: string) =>
  (await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
    .bind(id)
    .first<{ correo: string }>())!.correo;

export async function empresa(m: M, nombre = 'Paquetes Sur') {
  const dueno = await m.cuenta('cliente', `Dueña ${nombre}`);
  await confirmar(m, dueno.id);
  const e = await llamar(
    m,
    'POST',
    `${B}/empresas`,
    { nombre, pais: 'US', moneda: 'USD' },
    dueno.token,
  );
  const id = e.datos.empresa.id as string;
  const centro = await llamar(
    m,
    'POST',
    `${B}/empresas/${id}/centros`,
    {
      nombre: 'Bodega',
      direccion: '1 NW 1st',
      pais: 'US',
      ciudad: 'Miami',
      lat: 25.77,
      lng: -80.19,
    },
    dueno.token,
  );
  return { dueno, id, centroId: centro.datos.centro.id as string };
}
export async function vincular(
  m: M,
  e: { dueno: { token: string }; id: string },
  conductorId: string,
  vinculo: 'propio' | 'red' | 'hibrido',
) {
  const r = await llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/conductores`,
    { correo: await correoDe(m, conductorId), vinculo },
    e.dueno.token,
  );
  expect(r.estado).toBe(201);
}
export async function envios(
  m: M,
  e: { dueno: { token: string }; id: string; centroId: string },
  cuantos: number,
  paquetes = 1,
  prefijo = 'R',
) {
  const ids: string[] = [];
  for (let i = 0; i < cuantos; i += 25) {
    const lote = Array.from({ length: Math.min(25, cuantos - i) }, (_, j) => ({
      centroId: e.centroId,
      referenciaExterna: `${prefijo}-${i + j + 1}`,
      destinatarioNombre: `Cliente ${i + j + 1}`,
      destinatarioTelefono: '3050000000',
      direccion: `${100 + i + j} Main St, Miami`,
      lat: 25.7 + (i + j) / 1000,
      lng: -80.2,
      paquetes: Array.from({ length: paquetes }, () => ({ descripcion: 'Caja' })),
    }));
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios/lote`,
      { envios: lote },
      e.dueno.token,
    );
    expect(r.estado).toBe(201);
    ids.push(...r.datos.envios.map((x: any) => x.id));
  }
  return ids;
}
export async function ruta(
  m: M,
  e: { dueno: { token: string }; id: string; centroId: string },
  envioIds: string[],
) {
  const r = await llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/rutas`,
    { nombre: 'Ruta', centroId: e.centroId, envioIds },
    e.dueno.token,
  );
  expect(r.estado).toBe(201);
  return r.datos.ruta.id as string;
}
export const ocupaciones = async (m: M, conductorId: string) =>
  (
    await m.DB.prepare('SELECT tipo, ruta_id FROM conductor_ocupacion WHERE conductor_id = ?')
      .bind(conductorId)
      .all()
  ).results;
export const etiquetasDe = async (m: M, rutaId: string) =>
  (
    await m.DB.prepare(
      'SELECT p.codigo_etiqueta AS c FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id WHERE rq.ruta_id = ? AND rq.activo = 1',
    )
      .bind(rutaId)
      .all<{ c: string }>()
  ).results.map((x) => x.c);

/** Una ruta asignada, aceptada, cargada y en curso. */
export async function rutaEnCurso(m: M, cuantos = 2, paquetes = 1) {
  const e = await empresa(m);
  const cond = await m.cuenta('repartidor', 'Conductor Uno');
  await vincular(m, e, cond.id, 'propio');
  const ids = await envios(m, e, cuantos, paquetes);
  const rutaId = await ruta(m, e, ids);
  expect(
    (
      await llamar(
        m,
        'POST',
        `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
        { conductorId: cond.id },
        e.dueno.token,
      )
    ).estado,
  ).toBe(200);
  const C = `${B}/conductor/rutas/${rutaId}`;
  expect((await llamar(m, 'POST', `${C}/aceptar`, {}, cond.token)).estado).toBe(200);
  expect(
    (await llamar(m, 'POST', `${C}/llegada-centro`, { lat: 25.77, lng: -80.19 }, cond.token))
      .estado,
  ).toBe(200);
  for (const c of await etiquetasDe(m, rutaId))
    expect(
      (await llamar(m, 'POST', `${C}/escanear`, { codigo: `dvx:${c}` }, cond.token)).estado,
    ).toBe(200);
  expect(
    (await llamar(m, 'POST', `${C}/iniciar`, { lat: 25.77, lng: -80.19 }, cond.token)).estado,
  ).toBe(200);
  const det = await llamar(m, 'GET', C, undefined, cond.token);
  return { e, cond, rutaId, C, paradas: det.datos.ruta.paradas as any[] };
}
