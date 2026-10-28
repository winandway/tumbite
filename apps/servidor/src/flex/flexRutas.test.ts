import { beforeEach, describe, expect, it } from 'vitest';
import { FOTO_PRUEBA, mundo } from '../pruebas/ayuda';
import { reiniciarLimiteClaves } from './autorizacion';

/**
 * Divoox Flex · Fase 2 (C-FLEX-OCUPACION, C-FLEX-RUTAS, C-FLEX-ESCANEO, C-FLEX-ENTREGA,
 * C-FLEX-DEVOLUCIONES). Rutas operativas de punta a punta con SQLite en memoria y el almacén de
 * fotos de mentira. Sin dinero.
 */
type M = ReturnType<typeof mundo>;
const B = '/datos/v1/flex';
let n = 0;
const k = () => `k-${Date.now()}-${n++}`;

async function llamar(
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
async function subir(m: M, ruta: string, token: string, tipo = 'foto', clave = k()) {
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
const confirmar = (m: M, id: string) =>
  m.DB.prepare("UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
const correoDe = async (m: M, id: string) =>
  (await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
    .bind(id)
    .first<{ correo: string }>())!.correo;

async function empresa(m: M, nombre = 'Paquetes Sur') {
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
async function vincular(
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
async function envios(
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
async function ruta(
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
const ocupaciones = async (m: M, conductorId: string) =>
  (
    await m.DB.prepare('SELECT tipo, ruta_id FROM conductor_ocupacion WHERE conductor_id = ?')
      .bind(conductorId)
      .all()
  ).results;
const etiquetasDe = async (m: M, rutaId: string) =>
  (
    await m.DB.prepare(
      'SELECT p.codigo_etiqueta AS c FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id WHERE rq.ruta_id = ? AND rq.activo = 1',
    )
      .bind(rutaId)
      .all<{ c: string }>()
  ).results.map((x) => x.c);

/** Una ruta asignada, aceptada, cargada y en curso. */
async function rutaEnCurso(m: M, cuantos = 2, paquetes = 1) {
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

beforeEach(() => reiniciarLimiteClaves());

describe('Flex · asignación y ocupación (C-FLEX-OCUPACION)', () => {
  it('asignar a un conductor propio lo ocupa con UNA sola fila y pasa los paquetes a «asignado»', async () => {
    const m = mundo();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'propio');
    const rutaId = await ruta(m, e, await envios(m, e, 5, 2));
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
      { conductorId: cond.id },
      e.dueno.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.ruta.estado).toBe('asignada');
    expect(r.datos.ruta.progreso.total).toBe(10);
    expect(await ocupaciones(m, cond.id)).toEqual([{ tipo: 'ruta_flex', ruta_id: rutaId }]);
    const est = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM paquetes WHERE empresa_id = ? AND estado = 'asignado'",
    )
      .bind(e.id)
      .first<{ n: number }>();
    expect(est!.n).toBe(10);
    // Retirar la asignación libera al conductor y devuelve los paquetes.
    expect(
      (await llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${rutaId}/retirar`, {}, e.dueno.token))
        .estado,
    ).toBe(200);
    expect(await ocupaciones(m, cond.id)).toEqual([]);
    const prep = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM paquetes WHERE empresa_id = ? AND estado = 'preparado'",
    )
      .bind(e.id)
      .first<{ n: number }>();
    expect(prep!.n).toBe(10);
  });

  it('no se asigna un conductor de otra empresa, uno de la red (se le ofrece) ni una ruta sin coordenadas', async () => {
    const m = mundo();
    const e = await empresa(m);
    const otra = await empresa(m, 'Otra');
    const ajeno = await m.cuenta('repartidor');
    await vincular(m, otra, ajeno.id, 'propio');
    const rutaId = await ruta(m, e, await envios(m, e, 2));
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
          { conductorId: ajeno.id },
          e.dueno.token,
        )
      ).estado,
    ).toBe(404);
    const red = await m.cuenta('repartidor');
    await vincular(m, e, red.id, 'red');
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
          { conductorId: red.id },
          e.dueno.token,
        )
      ).estado,
    ).toBe(409);
    // Una parada sin coordenadas verificadas: no sale hasta corregirla (sin inventar nada).
    const sinCoord = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios`,
      {
        centroId: e.centroId,
        referenciaExterna: 'SC-1',
        destinatarioNombre: 'Sin',
        direccion: 'Calle sin mapa',
      },
      e.dueno.token,
    );
    const r2 = await ruta(m, e, [sinCoord.datos.envio.id]);
    const propio = await m.cuenta('repartidor');
    await vincular(m, e, propio.id, 'propio');
    const falla = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${r2}/asignar`,
      { conductorId: propio.id },
      e.dueno.token,
    );
    expect(falla.estado).toBe(409);
    expect(falla.datos.error).toMatch(/coordenadas|coordinates/);
    expect(
      (
        await llamar(
          m,
          'PATCH',
          `${B}/empresas/${e.id}/envios/${sinCoord.datos.envio.id}`,
          { lat: 25.8, lng: -80.2 },
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${e.id}/rutas/${r2}/asignar`,
          { conductorId: propio.id },
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
  });

  it('dos empresas asignan al mismo conductor a la vez: solo una gana; y no puede tomar un pedido de comida', async () => {
    const m = mundo();
    const a = await empresa(m, 'A');
    const b = await empresa(m, 'B');
    const cond = await m.cuenta('repartidor');
    await vincular(m, a, cond.id, 'propio');
    await vincular(m, b, cond.id, 'propio');
    const ra = await ruta(m, a, await envios(m, a, 2, 1, 'A'));
    const rb = await ruta(m, b, await envios(m, b, 2, 1, 'B'));
    const [x, y] = await Promise.all([
      llamar(
        m,
        'POST',
        `${B}/empresas/${a.id}/rutas/${ra}/asignar`,
        { conductorId: cond.id },
        a.dueno.token,
      ),
      llamar(
        m,
        'POST',
        `${B}/empresas/${b.id}/rutas/${rb}/asignar`,
        { conductorId: cond.id },
        b.dueno.token,
      ),
    ]);
    expect([x.estado, y.estado].sort()).toEqual([200, 409]);
    expect((x.estado === 409 ? x : y).datos.error).toMatch(/ocupado|busy/);
    expect(await ocupaciones(m, cond.id)).toHaveLength(1);
    // La ruta perdedora no quedó a medias: sigue en borrador, sin paquetes reservados ni movidos.
    const perdedora = x.estado === 409 ? ra : rb;
    const fila = await m.DB.prepare('SELECT estado, conductor_id FROM rutas_flex WHERE id = ?')
      .bind(perdedora)
      .first();
    expect(fila).toEqual({ estado: 'borrador', conductor_id: null });
    expect(
      (await m.DB.prepare('SELECT COUNT(*) AS n FROM ruta_paquetes WHERE ruta_id = ?')
        .bind(perdedora)
        .first<{ n: number }>())!.n,
    ).toBe(0);
    // Con la ruta activa, la base no le deja tomar un pedido de comida.
    await expect(
      m.DB.prepare(
        "INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos) VALUES (?, 'comida', 1)",
      )
        .bind(cond.id)
        .run(),
    ).rejects.toThrow();
  });

  it('ofertas de la red: vencen, la aceptación es única y dos aceptaciones simultáneas de rutas distintas no ocupan dos veces', async () => {
    const m = mundo();
    const a = await empresa(m, 'A');
    const b = await empresa(m, 'B');
    const cond = await m.cuenta('repartidor');
    await vincular(m, a, cond.id, 'red');
    await vincular(m, b, cond.id, 'hibrido');
    const ra = await ruta(m, a, await envios(m, a, 2, 1, 'A'));
    const rb = await ruta(m, b, await envios(m, b, 2, 1, 'B'));
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${a.id}/rutas/${ra}/ofrecer`,
          { conductorId: cond.id, minutos: 30 },
          a.dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${b.id}/rutas/${rb}/ofrecer`,
          { conductorId: cond.id, minutos: 30 },
          b.dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(await ocupaciones(m, cond.id)).toEqual([]); // ofrecer no ocupa
    const mias = await llamar(m, 'GET', `${B}/conductor/rutas`, undefined, cond.token);
    expect(mias.datos.rutas.map((r: any) => r.estado)).toEqual(['ofrecida', 'ofrecida']);
    const [x, y] = await Promise.all([
      llamar(m, 'POST', `${B}/conductor/rutas/${ra}/aceptar`, {}, cond.token),
      llamar(m, 'POST', `${B}/conductor/rutas/${rb}/aceptar`, {}, cond.token),
    ]);
    expect([x.estado, y.estado].sort()).toEqual([200, 409]);
    expect(await ocupaciones(m, cond.id)).toHaveLength(1);
    // Aceptar otra vez la misma (otra clave): idempotente, sin otra ocupación.
    const ganadora = x.estado === 200 ? ra : rb;
    expect(
      (await llamar(m, 'POST', `${B}/conductor/rutas/${ganadora}/aceptar`, {}, cond.token)).estado,
    ).toBe(200);
    expect(await ocupaciones(m, cond.id)).toHaveLength(1);
    // Una oferta vencida no se acepta.
    const c2 = await m.cuenta('repartidor');
    await vincular(m, a, c2.id, 'red');
    const r3 = await ruta(m, a, await envios(m, a, 1, 1, 'V'));
    await llamar(
      m,
      'POST',
      `${B}/empresas/${a.id}/rutas/${r3}/ofrecer`,
      { conductorId: c2.id, minutos: 5 },
      a.dueno.token,
    );
    await m.DB.prepare(
      "UPDATE rutas_flex SET oferta_vence_en = datetime('now', '-1 minute') WHERE id = ?",
    )
      .bind(r3)
      .run();
    expect(
      (await llamar(m, 'POST', `${B}/conductor/rutas/${r3}/aceptar`, {}, c2.token)).estado,
    ).toBe(410);
    expect(await ocupaciones(m, c2.id)).toEqual([]);
  });

  it('el conductor rechaza: la ruta vuelve a borrador y él queda libre', async () => {
    const m = mundo();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'propio');
    const rutaId = await ruta(m, e, await envios(m, e, 2));
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
      { conductorId: cond.id },
      e.dueno.token,
    );
    expect(
      (await llamar(m, 'POST', `${B}/conductor/rutas/${rutaId}/rechazar`, {}, cond.token)).estado,
    ).toBe(200);
    expect(await ocupaciones(m, cond.id)).toEqual([]);
    expect(
      (await m.DB.prepare('SELECT estado FROM rutas_flex WHERE id = ?')
        .bind(rutaId)
        .first<{ estado: string }>())!.estado,
    ).toBe('borrador');
  });
});

describe('Flex · carga por escaneo (C-FLEX-ESCANEO)', () => {
  it('escaneo repetido no duplica; un paquete ajeno, de otra ruta o inexistente no se carga; sin carga completa no se sale', async () => {
    const m = mundo();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'propio');
    const ids = await envios(m, e, 3);
    const rutaId = await ruta(m, e, ids.slice(0, 2));
    const otraRuta = await ruta(m, e, ids.slice(2));
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
      { conductorId: cond.id },
      e.dueno.token,
    );
    const C = `${B}/conductor/rutas/${rutaId}`;
    // Antes de llegar al centro no se escanea (paso equivocado).
    const [primera, segunda] = await etiquetasDe(m, rutaId);
    expect((await llamar(m, 'POST', `${C}/escanear`, { codigo: primera }, cond.token)).estado).toBe(
      409,
    );
    await llamar(m, 'POST', `${C}/aceptar`, {}, cond.token);
    await llamar(m, 'POST', `${C}/llegada-centro`, {}, cond.token);
    const a = await llamar(m, 'POST', `${C}/escanear`, { codigo: `dvx:${primera}` }, cond.token);
    expect(a.datos.yaCargado).toBe(false);
    const b = await llamar(m, 'POST', `${C}/escanear`, { codigo: primera }, cond.token); // Code 128 (sin «dvx:»), otra clave
    expect(b.datos.yaCargado).toBe(true);
    const cargas = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM paquete_eventos WHERE paquete_id = ? AND tipo = 'cargado'",
    )
      .bind(a.datos.paqueteId)
      .first<{ n: number }>();
    expect(cargas!.n).toBe(1);
    // Salir sin escanear todo: no.
    expect((await llamar(m, 'POST', `${C}/iniciar`, {}, cond.token)).estado).toBe(409);
    // Paquete de otra ruta de la misma empresa (en borrador): no es de esta ruta.
    const ajeno = (await m.DB.prepare(
      'SELECT codigo_etiqueta AS c FROM paquetes WHERE envio_id = ?',
    )
      .bind(ids[2])
      .first<{ c: string }>())!.c;
    expect((await llamar(m, 'POST', `${C}/escanear`, { codigo: ajeno }, cond.token)).estado).toBe(
      404,
    );
    expect(otraRuta).toBeTruthy();
    // Paquete de otra empresa: tampoco (misma respuesta, no se revela nada).
    const otra = await empresa(m, 'Otra');
    const env = await envios(m, otra, 1, 1, 'O');
    const deOtra = (await m.DB.prepare(
      'SELECT codigo_etiqueta AS c FROM paquetes WHERE envio_id = ?',
    )
      .bind(env[0])
      .first<{ c: string }>())!.c;
    expect((await llamar(m, 'POST', `${C}/escanear`, { codigo: deOtra }, cond.token)).estado).toBe(
      404,
    );
    expect(
      (await llamar(m, 'POST', `${C}/escanear`, { codigo: 'ZZZZZZZZZZZZ' }, cond.token)).estado,
    ).toBe(404);
    expect(
      (await llamar(m, 'POST', `${C}/escanear`, { codigo: 'texto cualquiera' }, cond.token)).estado,
    ).toBe(404);
    // El que no está en el centro sale como faltante (con su incidencia) y entonces sí se puede salir.
    const faltante = (await m.DB.prepare('SELECT p.id FROM paquetes p WHERE p.codigo_etiqueta = ?')
      .bind(segunda)
      .first<{ id: string }>())!.id;
    expect(
      (
        await llamar(
          m,
          'POST',
          `${C}/faltante`,
          { paqueteId: faltante, observaciones: 'No estaba en la estantería' },
          cond.token,
        )
      ).estado,
    ).toBe(200);
    const ini = await llamar(m, 'POST', `${C}/iniciar`, {}, cond.token);
    expect(ini.estado).toBe(200);
    expect(ini.datos.ruta.estado).toBe('en_curso');
    expect(ini.datos.ruta.progreso).toMatchObject({ total: 1, excluidos: 1 });
    // Ahora el conductor ve los datos del destinatario (antes de salir no los veía).
    expect(
      ini.datos.ruta.paradas.find((p: any) => p.estado !== 'omitida').destinatarioNombre,
    ).toMatch(/Cliente/);
    const inc = await m.DB.prepare(
      'SELECT motivo, proxima_accion FROM flex_incidencias WHERE paquete_id = ?',
    )
      .bind(faltante)
      .first();
    expect(inc).toEqual({ motivo: 'no_encontrado_centro', proxima_accion: 'reprogramar' });
  });

  it('el conductor no ve los datos personales antes de salir y una clave de API no puede actuar como conductor', async () => {
    const m = mundo();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'propio');
    const rutaId = await ruta(m, e, await envios(m, e, 1));
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
      { conductorId: cond.id },
      e.dueno.token,
    );
    const det = await llamar(m, 'GET', `${B}/conductor/rutas/${rutaId}`, undefined, cond.token);
    expect(det.datos.ruta.paradas[0].destinatarioNombre).toBeNull();
    expect(det.datos.ruta.paradas[0].destinatarioTelefono).toBeNull();
    expect(det.datos.ruta.paradas[0].direccion).toMatch(/Main St/);
    const clave = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/claves`,
      { nombre: 'ERP', permisos: ['envios.ver', 'lotes.gestionar'] },
      e.dueno.token,
    );
    const conClave = await llamar(
      m,
      'POST',
      `${B}/conductor/rutas/${rutaId}/aceptar`,
      {},
      cond.token,
      { 'x-api-key': clave.datos.clave.secreto },
    );
    expect(conClave.estado).toBe(403);
    // Otro conductor no ve ni toca la ruta.
    const otro = await m.cuenta('repartidor');
    expect(
      (await llamar(m, 'GET', `${B}/conductor/rutas/${rutaId}`, undefined, otro.token)).estado,
    ).toBe(404);
    expect(
      (await llamar(m, 'POST', `${B}/conductor/rutas/${rutaId}/aceptar`, {}, otro.token)).estado,
    ).toBe(404);
    // Un cliente cualquiera tampoco.
    const cli = await m.cuenta('cliente');
    expect((await llamar(m, 'GET', `${B}/conductor/rutas`, undefined, cli.token)).estado).toBe(403);
  });
});

describe('Flex · prueba de entrega (C-FLEX-ENTREGA)', () => {
  it('sin la foto exigida no se entrega; con ella sí; repetir no duplica', async () => {
    const m = mundo();
    const { cond, C, paradas, rutaId } = await rutaEnCurso(m, 1, 2);
    const p = paradas[0];
    const sinFoto = await llamar(m, 'POST', `${C}/paradas/${p.id}/entregar`, {}, cond.token);
    expect(sinFoto.estado).toBe(422);
    expect(sinFoto.datos.campo).toBe('foto');
    const foto = await subir(m, `${C}/paradas/${p.id}/prueba`, cond.token);
    expect(foto.estado).toBe(201);
    const clave = k();
    const ok = await llamar(
      m,
      'POST',
      `${C}/paradas/${p.id}/entregar`,
      { fotoId: foto.datos.pruebaId, recibio: 'Portero' },
      cond.token,
      { 'idempotency-key': clave },
    );
    expect(ok.estado).toBe(200);
    expect(ok.datos.entregados).toHaveLength(2);
    const otra = await llamar(
      m,
      'POST',
      `${C}/paradas/${p.id}/entregar`,
      { fotoId: foto.datos.pruebaId, recibio: 'Portero' },
      cond.token,
      { 'idempotency-key': clave },
    );
    expect(otra.datos.entregados).toHaveLength(2);
    const otraClave = await llamar(
      m,
      'POST',
      `${C}/paradas/${p.id}/entregar`,
      { fotoId: foto.datos.pruebaId },
      cond.token,
    );
    expect(otraClave.datos.yaEntregado).toBe(true);
    const ev = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM paquete_eventos WHERE tipo = 'entregado' AND operacion_ref = ?",
    )
      .bind(rutaId)
      .first<{ n: number }>();
    expect(ev!.n).toBe(2);
    const meta = await m.DB.prepare(
      "SELECT metadatos_json FROM paquete_eventos WHERE tipo = 'entregado' LIMIT 1",
    ).first<{ metadatos_json: string }>();
    expect(JSON.parse(meta!.metadatos_json)).toMatchObject({
      fotoId: foto.datos.pruebaId,
      recibio: 'Portero',
    });
    // La foto se guardó en el almacén privado (solo la referencia en la base).
    const pr = await m.DB.prepare('SELECT clave FROM flex_pruebas WHERE id = ?')
      .bind(foto.datos.pruebaId)
      .first<{ clave: string }>();
    expect(pr!.clave).toMatch(/^flex\//);
  });

  it('PIN: se guarda solo el hash, el incorrecto no entrega y cinco errores lo bloquean; la firma se exige si la pide el envío', async () => {
    const m = mundo();
    const { e, cond, C, paradas } = await rutaEnCurso(m, 2, 1);
    // La empresa exige foto y PIN.
    expect(
      (
        await llamar(
          m,
          'PUT',
          `${B}/empresas/${e.id}/config-entrega`,
          { foto: true, pin: true, firma: false, sinContacto: false, reintentoEnRuta: true },
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
    const [p1, p2] = paradas;
    const pinR = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios/${p1.envioId}/pin`,
      {},
      e.dueno.token,
    );
    expect(pinR.estado).toBe(201);
    const pin = pinR.datos.pin as string;
    const guardado = await m.DB.prepare('SELECT pin_hash FROM flex_pines WHERE envio_id = ?')
      .bind(p1.envioId)
      .first<{ pin_hash: string }>();
    expect(guardado!.pin_hash).not.toContain(pin);
    const foto = (await subir(m, `${C}/paradas/${p1.id}/prueba`, cond.token)).datos.pruebaId;
    const malo = pin === '0000' ? '1111' : '0000';
    const mal = await llamar(
      m,
      'POST',
      `${C}/paradas/${p1.id}/entregar`,
      { fotoId: foto, pin: malo },
      cond.token,
    );
    expect(mal.estado).toBe(422);
    expect(
      (await llamar(m, 'POST', `${C}/paradas/${p1.id}/entregar`, { fotoId: foto }, cond.token))
        .datos.campo,
    ).toBe('pin');
    expect(
      (await llamar(m, 'POST', `${C}/paradas/${p1.id}/entregar`, { fotoId: foto, pin }, cond.token))
        .estado,
    ).toBe(200);
    // Bloqueo a los cinco errores.
    await llamar(m, 'POST', `${B}/empresas/${e.id}/envios/${p2.envioId}/pin`, {}, e.dueno.token);
    const f2 = (await subir(m, `${C}/paradas/${p2.id}/prueba`, cond.token)).datos.pruebaId;
    for (let i = 0; i < 5; i++)
      await llamar(
        m,
        'POST',
        `${C}/paradas/${p2.id}/entregar`,
        { fotoId: f2, pin: '9999' },
        cond.token,
      );
    const bloqueado = await llamar(
      m,
      'POST',
      `${C}/paradas/${p2.id}/entregar`,
      { fotoId: f2, pin: '9999' },
      cond.token,
    );
    expect(bloqueado.datos.error).toMatch(/bloque|locked/i);
    // Una foto de OTRA parada no sirve como prueba.
    const deOtra = await llamar(
      m,
      'POST',
      `${C}/paradas/${p2.id}/entregar`,
      { fotoId: foto, pin: '1234' },
      cond.token,
    );
    expect(deOtra.estado).toBe(404);
  });

  it('firma exigida por el envío y entrega sin contacto cuando la empresa la permite', async () => {
    const m = mundo();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'propio');
    const ids = await envios(m, e, 2);
    await llamar(
      m,
      'PATCH',
      `${B}/empresas/${e.id}/envios/${ids[0]}`,
      { configEntrega: { firma: true } },
      e.dueno.token,
    );
    await llamar(
      m,
      'PUT',
      `${B}/empresas/${e.id}/config-entrega`,
      { foto: true, pin: true, firma: false, sinContacto: true, reintentoEnRuta: true },
      e.dueno.token,
    );
    const rutaId = await ruta(m, e, ids);
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
      { conductorId: cond.id },
      e.dueno.token,
    );
    const C = `${B}/conductor/rutas/${rutaId}`;
    await llamar(m, 'POST', `${C}/aceptar`, {}, cond.token);
    await llamar(m, 'POST', `${C}/llegada-centro`, {}, cond.token);
    for (const c of await etiquetasDe(m, rutaId))
      await llamar(m, 'POST', `${C}/escanear`, { codigo: c }, cond.token);
    const ini = await llamar(m, 'POST', `${C}/iniciar`, {}, cond.token);
    const [p1, p2] = ini.datos.ruta.paradas;
    expect(p1.pruebas).toMatchObject({ firma: true, pin: true });
    const foto = (await subir(m, `${C}/paradas/${p1.id}/prueba`, cond.token)).datos.pruebaId;
    const sinFirma = await llamar(
      m,
      'POST',
      `${C}/paradas/${p1.id}/entregar`,
      { fotoId: foto, pin: '0000' },
      cond.token,
    );
    expect(sinFirma.estado).toBe(422);
    expect(sinFirma.datos.error).toMatch(/firma|signature/);
    // Sin contacto: reemplaza PIN y firma, pero con foto.
    expect(
      (await llamar(m, 'POST', `${C}/paradas/${p1.id}/entregar`, { sinContacto: true }, cond.token))
        .datos.campo,
    ).toBe('foto');
    expect(
      (
        await llamar(
          m,
          'POST',
          `${C}/paradas/${p1.id}/entregar`,
          { fotoId: foto, sinContacto: true },
          cond.token,
        )
      ).estado,
    ).toBe(200);
    // La firma es una imagen (PNG del lienzo) y se acepta como prueba.
    const firma = await subir(m, `${C}/paradas/${p2.id}/prueba`, cond.token, 'firma');
    expect(firma.estado).toBe(201);
    expect(firma.datos.tipo).toBe('firma');
  });
});

describe('Flex · incidencias, devoluciones y cierre (C-FLEX-DEVOLUCIONES)', () => {
  it('fallida → reintento autorizado → entrega; fallida → devolución que solo se completa con la recepción del centro; cierre y liberación', async () => {
    const m = mundo();
    const { e, cond, C, paradas, rutaId } = await rutaEnCurso(m, 3, 1);
    const [p1, p2, p3] = paradas;
    // Parada 1: ausente, reintentar (la empresa lo permite por defecto) y luego entregar.
    const inc = await llamar(
      m,
      'POST',
      `${C}/paradas/${p1.id}/incidencia`,
      { motivo: 'ausente', proximaAccion: 'reintentar' },
      cond.token,
    );
    expect(inc.estado).toBe(200);
    const paq1 = p1.paquetes[0].id;
    expect(
      (await m.DB.prepare('SELECT estado FROM paquetes WHERE id = ?')
        .bind(paq1)
        .first<{ estado: string }>())!.estado,
    ).toBe('entrega_fallida');
    // Una incidencia nunca marca entregado; y «otro» sin explicación no se acepta.
    expect(
      (
        await llamar(
          m,
          'POST',
          `${C}/paradas/${p2.id}/incidencia`,
          { motivo: 'otro', proximaAccion: 'devolver' },
          cond.token,
        )
      ).estado,
    ).toBe(400);
    expect(
      (await llamar(m, 'POST', `${C}/paquetes/${paq1}/reintentar`, {}, cond.token)).estado,
    ).toBe(200);
    const foto = (await subir(m, `${C}/paradas/${p1.id}/prueba`, cond.token)).datos.pruebaId;
    expect(
      (await llamar(m, 'POST', `${C}/paradas/${p1.id}/entregar`, { fotoId: foto }, cond.token))
        .estado,
    ).toBe(200);
    // Parada 2: dirección incorrecta → devolver. Parada 3: sin intentar.
    expect(
      (
        await llamar(
          m,
          'POST',
          `${C}/paradas/${p2.id}/incidencia`,
          {
            motivo: 'direccion_incorrecta',
            proximaAccion: 'devolver',
            observaciones: 'No existe el número',
          },
          cond.token,
        )
      ).estado,
    ).toBe(200);
    // Sin reintento autorizado (próxima acción «devolver»), no se reintenta.
    expect(
      (await llamar(m, 'POST', `${C}/paquetes/${p2.paquetes[0].id}/reintentar`, {}, cond.token))
        .estado,
    ).toBe(409);
    // Cerrar con paquetes pendientes: no.
    const pronto = await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token);
    expect(pronto.estado).toBe(409);
    expect(pronto.datos.error).toMatch(/sin cerrar|not closed|unclosed/i);
    // Devolución: lista con lo no entregado (parada 2 y 3).
    const dev = await llamar(m, 'POST', `${C}/devolucion`, {}, cond.token);
    expect(dev.datos.devoluciones).toHaveLength(2);
    // Aún sin entregarlos en el centro, no se cierra.
    expect((await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token)).estado).toBe(409);
    for (const d of dev.datos.devoluciones)
      expect(
        (
          await llamar(
            m,
            'POST',
            `${C}/devolucion/entregar`,
            { codigo: d.codigoEtiqueta },
            cond.token,
          )
        ).estado,
      ).toBe(200);
    // La empresa todavía no confirmó: la devolución NO está completa (siguen «en devolución»).
    const pend = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/devoluciones`,
      undefined,
      e.dueno.token,
    );
    expect(pend.datos.devoluciones.map((x: any) => x.entregadoAlCentro)).toEqual([true, true]);
    // Cerrar ahora sí (traspaso registrado): con incidencias, y el conductor queda libre.
    const cierre = await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token);
    expect(cierre.estado).toBe(200);
    expect(cierre.datos.estado).toBe('con_incidencias');
    expect(cierre.datos.resumen).toMatchObject({
      total: 3,
      entregados: 1,
      pendientesJustificados: 2,
      fallidos: 2,
    });
    expect(await ocupaciones(m, cond.id)).toEqual([]);
    // Cerrar otra vez: misma respuesta, nada se repite.
    const otra = await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token);
    expect(otra.datos.estado).toBe('con_incidencias');
    // Recepción en el centro por una persona (una clave de API no puede).
    const clave = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/claves`,
      { nombre: 'ERP', permisos: ['envios.ver'] },
      e.dueno.token,
    );
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${e.id}/devoluciones/recibir`,
          { codigo: dev.datos.devoluciones[0].codigoEtiqueta },
          undefined,
          { 'x-api-key': clave.datos.clave.secreto },
        )
      ).estado,
    ).toBe(403);
    const r1 = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/devoluciones/recibir`,
      { codigo: dev.datos.devoluciones[0].codigoEtiqueta, destino: 'centro' },
      e.dueno.token,
    );
    expect(r1.datos.estado).toBe('registrado_centro');
    const r2 = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/devoluciones/recibir`,
      { codigo: dev.datos.devoluciones[1].codigoEtiqueta, destino: 'remitente' },
      e.dueno.token,
    );
    expect(r2.datos.estado).toBe('devuelto');
    expect(
      (await llamar(m, 'GET', `${B}/empresas/${e.id}/devoluciones`, undefined, e.dueno.token)).datos
        .devoluciones,
    ).toEqual([]);
    const det = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/rutas/${rutaId}/detalle`,
      undefined,
      e.dueno.token,
    );
    expect(det.datos.ruta.resumen).toMatchObject({ devueltos: 2, pendientesJustificados: 0 });
    expect(det.datos.incidencias.map((i: any) => i.estado).sort()).toEqual([
      'resuelta',
      'resuelta',
    ]); // la parada 3 volvió sin intentarse: sin incidencia
    // El paquete recibido «en el centro» puede salir en otra ruta.
    expect(p3).toBeTruthy();
  });

  it('una empresa no ve ni toca rutas, incidencias, devoluciones ni pruebas de otra', async () => {
    const m = mundo();
    const { e, rutaId, C, cond, paradas } = await rutaEnCurso(m, 1, 1);
    const foto = (await subir(m, `${C}/paradas/${paradas[0].id}/prueba`, cond.token)).datos
      .pruebaId;
    const otra = await empresa(m, 'Otra');
    expect(
      (
        await llamar(
          m,
          'GET',
          `${B}/empresas/${otra.id}/rutas/${rutaId}/detalle`,
          undefined,
          otra.dueno.token,
        )
      ).estado,
    ).toBe(404);
    expect(
      (
        await llamar(
          m,
          'GET',
          `${B}/empresas/${e.id}/rutas/${rutaId}/detalle`,
          undefined,
          otra.dueno.token,
        )
      ).estado,
    ).toBe(404);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${otra.id}/rutas/${rutaId}/cancelar`,
          {},
          otra.dueno.token,
        )
      ).estado,
    ).toBe(404);
    expect(
      (
        await llamar(
          m,
          'GET',
          `${B}/empresas/${otra.id}/pruebas/${foto}`,
          undefined,
          otra.dueno.token,
        )
      ).estado,
    ).toBe(404);
    expect(
      (await llamar(m, 'GET', `${B}/empresas/${otra.id}/incidencias`, undefined, otra.dueno.token))
        .datos.incidencias,
    ).toEqual([]);
    // La dueña sí ve la foto, sin caché pública.
    const res = await m.crudo(`${B}/empresas/${e.id}/pruebas/${foto}`, {
      headers: { authorization: `Bearer ${e.dueno.token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    // Una ruta en la calle no se cancela.
    expect(
      (await llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${rutaId}/cancelar`, {}, e.dueno.token))
        .estado,
    ).toBe(409);
    // Transición inválida a mano: la base la rechaza.
    await expect(
      m.DB.prepare("UPDATE rutas_flex SET estado = 'borrador' WHERE id = ?").bind(rutaId).run(),
    ).rejects.toThrow(/transicion_de_ruta_no_permitida/);
    // El seguimiento público no muestra la ubicación del conductor.
    const seg = await llamar(
      m,
      'GET',
      `${B}/seguimiento/${paradas[0].paquetes[0].codigoSeguimiento}`,
    );
    expect(JSON.stringify(seg.datos)).not.toMatch(/lat|lng/);
  });
});

describe('Flex · ruta de 40 paquetes de punta a punta', () => {
  it('se completa sin duplicar eventos, sin perder paquetes y con una sola ocupación', async () => {
    const m = mundo();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'propio');
    const ids = await envios(m, e, 20, 2); // 20 paradas × 2 = 40 paquetes
    const rutaId = await ruta(m, e, ids);
    // La empresa reordena antes de salir (al revés).
    const antes = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/rutas/${rutaId}/detalle`,
      undefined,
      e.dueno.token,
    );
    const alReves = [...antes.datos.ruta.paradas].reverse().map((p: any) => p.id);
    expect(
      (
        await llamar(
          m,
          'PUT',
          `${B}/empresas/${e.id}/rutas/${rutaId}/orden`,
          { paradaIds: alReves },
          e.dueno.token,
        )
      ).datos.ruta.paradas[0].id,
    ).toBe(alReves[0]);
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
      { conductorId: cond.id },
      e.dueno.token,
    );
    const C = `${B}/conductor/rutas/${rutaId}`;
    await llamar(m, 'POST', `${C}/aceptar`, {}, cond.token);
    await llamar(m, 'POST', `${C}/llegada-centro`, {}, cond.token);
    const codigos = await etiquetasDe(m, rutaId);
    expect(codigos).toHaveLength(40);
    for (const c of codigos)
      await llamar(m, 'POST', `${C}/escanear`, { codigo: `dvx:${c}` }, cond.token);
    for (const c of codigos.slice(0, 5))
      await llamar(m, 'POST', `${C}/escanear`, { codigo: c }, cond.token); // repetidos
    expect(await ocupaciones(m, cond.id)).toHaveLength(1);
    const ini = await llamar(m, 'POST', `${C}/iniciar`, {}, cond.token);
    expect(ini.estado).toBe(200);
    for (const p of ini.datos.ruta.paradas) {
      await llamar(
        m,
        'POST',
        `${C}/paradas/${p.id}/llegada`,
        { lat: p.lat, lng: p.lng },
        cond.token,
      );
      const foto = (await subir(m, `${C}/paradas/${p.id}/prueba`, cond.token)).datos.pruebaId;
      expect(
        (
          await llamar(
            m,
            'POST',
            `${C}/paradas/${p.id}/entregar`,
            { fotoId: foto, lat: p.lat, lng: p.lng },
            cond.token,
          )
        ).estado,
      ).toBe(200);
    }
    const cierre = await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token);
    expect(cierre.datos.estado).toBe('completada');
    expect(cierre.datos.resumen).toMatchObject({
      total: 40,
      entregados: 40,
      fallidos: 0,
      devueltos: 0,
    });
    expect(await ocupaciones(m, cond.id)).toEqual([]);
    // Cada paquete: creado, asignado, cargado, en tránsito, entregado. Ni uno más.
    const porPaquete = await m.DB.prepare(
      `SELECT COUNT(*) AS n FROM paquete_eventos WHERE empresa_id = ? GROUP BY paquete_id`,
    )
      .bind(e.id)
      .all<{ n: number }>();
    expect(porPaquete.results).toHaveLength(40);
    expect(new Set(porPaquete.results.map((x) => x.n))).toEqual(new Set([5]));
    const entregados = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM paquetes WHERE empresa_id = ? AND estado = 'entregado'",
    )
      .bind(e.id)
      .first<{ n: number }>();
    expect(entregados!.n).toBe(40);
    const envEnt = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM envios WHERE empresa_id = ? AND estado = 'entregado'",
    )
      .bind(e.id)
      .first<{ n: number }>();
    expect(envEnt!.n).toBe(20);
    // El conductor queda libre para otra ruta o un pedido de comida.
    const r2 = await ruta(m, e, await envios(m, e, 1, 1, 'X'));
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${e.id}/rutas/${r2}/asignar`,
          { conductorId: cond.id },
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
  });
});

describe('Flex · etiqueta con ruta y parada', () => {
  it('sin ruta devuelve ruta null; en una ruta devuelve nombre, parada y total, sin teléfono', async () => {
    const m = mundo();
    const e = await empresa(m, 'Etiquetas Norte');
    const ids = await envios(m, e, 3, 1, 'ET');
    const lista = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/paquetes?centro=${e.centroId}`,
      undefined,
      e.dueno.token,
    );
    expect(lista.estado).toBe(200);
    expect(lista.datos.paquetes).toHaveLength(3);
    expect(lista.datos.paquetes[0].centroId).toBe(e.centroId);
    const otroCentro = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/paquetes?centro=no-existe`,
      undefined,
      e.dueno.token,
    );
    expect(otroCentro.datos.paquetes).toHaveLength(0);
    const paqueteDe = async (envioId: string) =>
      (await m.DB.prepare('SELECT id FROM paquetes WHERE envio_id = ?')
        .bind(envioId)
        .first<{ id: string }>())!.id;
    const etiqueta = async (paqueteId: string) =>
      (
        await llamar(
          m,
          'GET',
          `${B}/empresas/${e.id}/paquetes/${paqueteId}/etiqueta`,
          undefined,
          e.dueno.token,
        )
      ).datos.etiqueta;
    const p2 = await paqueteDe(ids[1]!);
    expect((await etiqueta(p2)).ruta).toBeNull();
    await ruta(m, e, ids);
    const et = await etiqueta(p2);
    expect(et.ruta).toMatchObject({ nombre: 'Ruta', paradas: 3 });
    expect(et.ruta.parada).toBeGreaterThanOrEqual(1);
    expect(et.ruta.parada).toBeLessThanOrEqual(3);
    expect(et).toHaveProperty('largoCm');
    expect(JSON.stringify(et)).not.toContain('3050000000');
    expect(JSON.stringify(et)).not.toContain('telefono');
  });
});
