import { beforeEach, describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { usarTransporteCorreo } from '../correo';
import { reiniciarLimiteClaves } from './autorizacion';

/**
 * Divoox Flex · Fase 1 (C-FLEX-EMPRESAS, C-FLEX-INVITACIONES, C-FLEX-PAQUETES, C-FLEX-API,
 * C-FLEX-IMPORTACION). Todo con SQLite en memoria y correo simulado. Nada de dinero.
 */

type M = ReturnType<typeof mundo>;
const BASE = '/datos/v1/flex';
const ENV = { YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x') };
let n = 0;
const clave = () => `k-${Date.now()}-${n++}`;
const correos: { para: string; texto: string }[] = [];
/** El token del último correo de invitación (los de confirmación de cuenta llegan sin esperar). */
function ultimoToken() {
  const c = [...correos].reverse().find((x) => x.texto.includes('/invite/'));
  return /invite\/([A-Za-z0-9_-]+)/.exec(c?.texto ?? '')?.[1] ?? '';
}

async function confirmar(m: M, id: string) {
  await m.DB.prepare("UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
}
async function correoDe(m: M, id: string) {
  return (await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
    .bind(id)
    .first<{ correo: string }>())!.correo;
}
/** Llamada con cabeceras extra (Idempotency-Key, x-api-key). */
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
    'cf-connecting-ip': `10.9.${n % 250}.${(n * 7) % 250}`,
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
const crear = (
  m: M,
  ruta: string,
  cuerpo: unknown,
  token?: string,
  extra: Record<string, string> = {},
) => llamar(m, 'POST', ruta, cuerpo, token, { 'idempotency-key': clave(), ...extra });

async function empresaLista(m: M) {
  const dueno = await m.cuenta('cliente', 'Dora Dueña');
  await confirmar(m, dueno.id);
  const r = await crear(
    m,
    `${BASE}/empresas`,
    { nombre: 'Paquetes Sur', pais: 'US', moneda: 'USD' },
    dueno.token,
  );
  expect(r.estado).toBe(201);
  return { dueno, id: r.datos.empresa.id as string };
}
const envioBase = (ref: string) => ({
  referenciaExterna: ref,
  destinatarioNombre: 'Ana Receptora',
  direccion: '100 Main St, Miami',
  lat: 25.77,
  lng: -80.19,
  paquetes: [{ descripcion: 'Caja 1' }, { descripcion: 'Caja 2' }],
});

beforeEach(() => {
  correos.length = 0;
  reiniciarLimiteClaves();
  usarTransporteCorreo(async (_url, init) => {
    const b = JSON.parse(String(init?.body ?? '{}'));
    correos.push({ para: b.to?.[0]?.address, texto: String(b.text ?? '') });
    return new Response(JSON.stringify({ ok: true, id: 'c1' }), { status: 200 });
  });
});

describe('Flex · empresas y permisos', () => {
  it('crear una empresa exige correo confirmado y deja al creador como dueño; la misma clave no la duplica', async () => {
    const m = mundo(ENV);
    const u = await m.cuenta('cliente');
    const sinConfirmar = await crear(
      m,
      `${BASE}/empresas`,
      { nombre: 'X', pais: 'US', moneda: 'USD' },
      u.token,
    );
    expect(sinConfirmar.estado).toBe(403);
    await confirmar(m, u.id);
    const k = clave();
    const a = await llamar(
      m,
      'POST',
      `${BASE}/empresas`,
      { nombre: 'X', pais: 'US', moneda: 'USD' },
      u.token,
      { 'idempotency-key': k },
    );
    const b = await llamar(
      m,
      'POST',
      `${BASE}/empresas`,
      { nombre: 'X', pais: 'US', moneda: 'USD' },
      u.token,
      { 'idempotency-key': k },
    );
    expect(a.estado).toBe(201);
    expect(b.datos.empresa.id).toBe(a.datos.empresa.id);
    const mias = await llamar(m, 'GET', `${BASE}/empresas`, undefined, u.token);
    expect(mias.datos.empresas).toHaveLength(1);
    expect(mias.datos.empresas[0].rol).toBe('dueno');
    const sinClave = await llamar(
      m,
      'POST',
      `${BASE}/empresas`,
      { nombre: 'Y', pais: 'US', moneda: 'USD' },
      u.token,
    );
    expect(sinClave.estado).toBe(400);
  });

  it('una cuenta ajena no ve la empresa (404) ni por adivinar el id; un operador no gestiona miembros (403)', async () => {
    const m = mundo(ENV);
    const { dueno, id } = await empresaLista(m);
    const otro = await m.cuenta('cliente');
    expect((await llamar(m, 'GET', `${BASE}/empresas/${id}`, undefined, otro.token)).estado).toBe(
      404,
    );
    expect(
      (await llamar(m, 'GET', `${BASE}/empresas/${id}/miembros`, undefined, otro.token)).estado,
    ).toBe(404);
    // Operador por invitación aceptada.
    const op = await m.cuenta('cliente', 'Olga Operadora');
    await confirmar(m, op.id);
    const inv = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/invitaciones`,
      { correo: await correoDe(m, op.id), rol: 'operador' },
      dueno.token,
    );
    expect(inv.estado).toBe(201);
    const token = ultimoToken();
    expect(
      (await llamar(m, 'POST', `${BASE}/invitaciones/${token}/aceptar`, {}, op.token)).estado,
    ).toBe(200);
    expect((await llamar(m, 'GET', `${BASE}/empresas/${id}`, undefined, op.token)).datos.rol).toBe(
      'operador',
    );
    expect(
      (await llamar(m, 'GET', `${BASE}/empresas/${id}/miembros`, undefined, op.token)).estado,
    ).toBe(403);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${BASE}/empresas/${id}/invitaciones`,
          { correo: 'z@ejemplo.com', rol: 'operador' },
          op.token,
        )
      ).estado,
    ).toBe(403);
  });
});

describe('Flex · invitaciones seguras (C-FLEX-INVITACIONES)', () => {
  it('solo el hash queda en la base; el token sirve una vez, para el mismo correo y confirmado', async () => {
    const m = mundo(ENV);
    const { dueno, id } = await empresaLista(m);
    const invitada = await m.cuenta('cliente', 'Inés Invitada');
    const correo = await correoDe(m, invitada.id);
    const r = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/invitaciones`,
      { correo, rol: 'finanzas' },
      dueno.token,
    );
    expect(r.estado).toBe(201);
    const token = ultimoToken();
    const fila = await m.DB.prepare('SELECT token_hash FROM empresa_invitaciones WHERE id = ?')
      .bind(r.datos.invitacion.id)
      .first<{ token_hash: string }>();
    expect(fila!.token_hash).not.toBe(token);
    expect(fila!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    // Correo sin confirmar: no entra.
    const sinConfirmar = await llamar(
      m,
      'POST',
      `${BASE}/invitaciones/${token}/aceptar`,
      {},
      invitada.token,
    );
    expect(sinConfirmar.estado).toBe(403);
    expect(sinConfirmar.datos.error).toMatch(/Confirm your email|Confirma tu correo/);
    // Otra cuenta (otro correo), aunque esté confirmada: no entra.
    const intrusa = await m.cuenta('cliente');
    await confirmar(m, intrusa.id);
    expect(
      (await llamar(m, 'POST', `${BASE}/invitaciones/${token}/aceptar`, {}, intrusa.token)).estado,
    ).toBe(403);
    // Registrar una cuenta con el correo invitado NO da acceso por sí solo.
    expect(
      (await llamar(m, 'GET', `${BASE}/empresas/${id}`, undefined, invitada.token)).estado,
    ).toBe(404);
    await confirmar(m, invitada.id);
    const vista = await llamar(
      m,
      'GET',
      `${BASE}/invitaciones/${token}`,
      undefined,
      invitada.token,
    );
    expect(vista.datos.invitacion).toMatchObject({
      empresa: 'Paquetes Sur',
      rol: 'finanzas',
      correoCoincide: true,
      correoConfirmado: true,
    });
    expect(
      (await llamar(m, 'POST', `${BASE}/invitaciones/${token}/aceptar`, {}, invitada.token)).estado,
    ).toBe(200);
    expect(
      (await llamar(m, 'GET', `${BASE}/empresas/${id}`, undefined, invitada.token)).datos.rol,
    ).toBe('finanzas');
    // Reutilizar el token: 410.
    expect(
      (await llamar(m, 'POST', `${BASE}/invitaciones/${token}/aceptar`, {}, invitada.token)).estado,
    ).toBe(410);
    // Token inventado: 404.
    expect(
      (await llamar(m, 'POST', `${BASE}/invitaciones/no-existe/aceptar`, {}, invitada.token))
        .estado,
    ).toBe(404);
    const aud = await llamar(m, 'GET', `${BASE}/empresas/${id}/auditoria`, undefined, dueno.token);
    expect(aud.datos.eventos.map((e: any) => e.accion)).toEqual(
      expect.arrayContaining(['invitacion.crear', 'invitacion.aceptar', 'empresa.crear']),
    );
  });

  it('una invitación vencida o revocada no se acepta', async () => {
    const m = mundo(ENV);
    const { dueno, id } = await empresaLista(m);
    const a = await m.cuenta('cliente');
    await confirmar(m, a.id);
    await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/invitaciones`,
      { correo: await correoDe(m, a.id), rol: 'operador' },
      dueno.token,
    );
    const tokenA = ultimoToken();
    await m.DB.prepare(
      "UPDATE empresa_invitaciones SET expira_en = datetime('now', '-1 minute')",
    ).run();
    const vencida = await llamar(m, 'POST', `${BASE}/invitaciones/${tokenA}/aceptar`, {}, a.token);
    expect(vencida.estado).toBe(410);
    expect(vencida.datos.error).toMatch(/expired|venci/);
    const b = await m.cuenta('cliente');
    await confirmar(m, b.id);
    const inv = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/invitaciones`,
      { correo: await correoDe(m, b.id), rol: 'operador' },
      dueno.token,
    );
    const tokenB = ultimoToken();
    expect(
      (
        await llamar(
          m,
          'DELETE',
          `${BASE}/empresas/${id}/invitaciones/${inv.datos.invitacion.id}`,
          undefined,
          dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (await llamar(m, 'POST', `${BASE}/invitaciones/${tokenB}/aceptar`, {}, b.token)).estado,
    ).toBe(410);
    const lista = await llamar(m, 'GET', `${BASE}/empresas/${id}/miembros`, undefined, dueno.token);
    expect(lista.datos.invitaciones.map((i: any) => i.estado).sort()).toEqual([
      'revocada',
      'vencida',
    ]);
  });
});

describe('Flex · centros, envíos, paquetes y custodia (C-FLEX-PAQUETES)', () => {
  it('crea un envío con varios paquetes de forma atómica, con códigos opacos y el evento inicial', async () => {
    const m = mundo(ENV);
    const { dueno, id } = await empresaLista(m);
    const centro = await crear(
      m,
      `${BASE}/empresas/${id}/centros`,
      { nombre: 'Bodega Doral', direccion: '1 NW 1st', pais: 'US', ciudad: 'Miami' },
      dueno.token,
    );
    expect(centro.estado).toBe(201);
    const r = await crear(
      m,
      `${BASE}/empresas/${id}/envios`,
      { ...envioBase('ORD-1'), centroId: centro.datos.centro.id },
      dueno.token,
    );
    expect(r.estado).toBe(201);
    const envio = r.datos.envio;
    expect(envio.paquetes).toHaveLength(2);
    for (const p of envio.paquetes) {
      expect(p.codigoSeguimiento).toMatch(/^DVX[A-HJ-NP-Z2-9]{10}$/);
      expect(p.codigoEtiqueta).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
      expect(p.estado).toBe('creado');
    }
    const det = await llamar(
      m,
      'GET',
      `${BASE}/empresas/${id}/envios/${envio.id}`,
      undefined,
      dueno.token,
    );
    expect(det.datos.eventos.filter((e: any) => e.tipo === 'creado')).toHaveLength(2);
    // Referencia duplicada: 409 y nada a medias.
    const dup = await crear(m, `${BASE}/empresas/${id}/envios`, envioBase('ORD-1'), dueno.token);
    expect(dup.estado).toBe(409);
    expect(dup.datos.campo).toBe('referenciaExterna');
    const cuenta = await m.DB.prepare('SELECT COUNT(*) AS n FROM paquetes WHERE empresa_id = ?')
      .bind(id)
      .first<{ n: number }>();
    expect(cuenta!.n).toBe(2);
    // Centro de otra empresa: no existe.
    const { dueno: d2, id: id2 } = await empresaLista(m);
    const ajeno = await crear(
      m,
      `${BASE}/empresas/${id2}/envios`,
      { ...envioBase('ORD-9'), centroId: centro.datos.centro.id },
      d2.token,
    );
    expect(ajeno.estado).toBe(404);
    // Etiqueta y resolución del QR, solo en la empresa dueña.
    const et = await llamar(
      m,
      'GET',
      `${BASE}/empresas/${id}/paquetes/${envio.paquetes[0].id}/etiqueta`,
      undefined,
      dueno.token,
    );
    expect(et.datos.etiqueta).toMatchObject({
      pieza: 1,
      total: 2,
      referenciaExterna: 'ORD-1',
      qr: `dvx:${envio.paquetes[0].codigoEtiqueta}`,
    });
    expect(JSON.stringify(et.datos.etiqueta)).not.toContain('telefono');
    expect(
      (
        await llamar(
          m,
          'GET',
          `${BASE}/empresas/${id}/etiquetas/dvx:${envio.paquetes[0].codigoEtiqueta}`,
          undefined,
          dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (
        await llamar(
          m,
          'GET',
          `${BASE}/empresas/${id2}/etiquetas/${envio.paquetes[0].codigoEtiqueta}`,
          undefined,
          d2.token,
        )
      ).estado,
    ).toBe(404);
    // Seguimiento público: estado y fechas, sin datos personales.
    const seg = await llamar(
      m,
      'GET',
      `${BASE}/seguimiento/${envio.paquetes[0].codigoSeguimiento}`,
    );
    expect(seg.estado).toBe(200);
    expect(seg.datos.seguimiento.estado).toBe('creado');
    expect(JSON.stringify(seg.datos)).not.toContain('Ana Receptora');
    expect((await llamar(m, 'GET', `${BASE}/seguimiento/DVXAAAAAAAAAA`)).estado).toBe(404);
  });

  it('la custodia sigue la máquina de estados; los eventos son únicos e inmutables; otra empresa no toca el paquete', async () => {
    const m = mundo(ENV);
    const { dueno, id } = await empresaLista(m);
    const r = await crear(m, `${BASE}/empresas/${id}/envios`, envioBase('ORD-2'), dueno.token);
    const paquete = r.datos.envio.paquetes[0];
    const ev = (tipo: string, extra: Record<string, string> = {}) =>
      crear(
        m,
        `${BASE}/empresas/${id}/paquetes/${paquete.id}/eventos`,
        { tipo, lat: 25.7, lng: -80.1 },
        dueno.token,
        extra,
      );
    expect((await ev('entregado')).estado).toBe(409); // salto no permitido
    expect((await ev('registrado_centro')).estado).toBe(201);
    expect((await ev('preparado')).estado).toBe(201);
    // Misma Idempotency-Key = misma respuesta, sin segundo evento.
    const k = clave();
    const a = await ev('asignado', { 'idempotency-key': k });
    const b = await ev('asignado', { 'idempotency-key': k });
    expect(a.estado).toBe(201);
    expect(b.estado).toBe(201);
    expect(b.datos.paquete.estado).toBe('asignado');
    const eventos = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM paquete_eventos WHERE paquete_id = ?',
    )
      .bind(paquete.id)
      .first<{ n: number }>();
    expect(eventos!.n).toBe(4); // creado + 3
    // Misma clave con otro cuerpo: 409.
    const c = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/paquetes/${paquete.id}/eventos`,
      { tipo: 'cargado' },
      dueno.token,
      { 'idempotency-key': k },
    );
    expect(c.estado).toBe(409);
    // La base también lo impide a mano (disparador): saltar a entregado desde asignado.
    await expect(
      m.DB.prepare("UPDATE paquetes SET estado = 'entregado' WHERE id = ?").bind(paquete.id).run(),
    ).rejects.toThrow(/transicion_de_paquete_no_permitida/);
    await expect(
      m.DB.prepare('DELETE FROM paquete_eventos WHERE paquete_id = ?').bind(paquete.id).run(),
    ).rejects.toThrow(/evento_inmutable/);
    await expect(
      m.DB.prepare("UPDATE paquete_eventos SET tipo = 'x' WHERE paquete_id = ?")
        .bind(paquete.id)
        .run(),
    ).rejects.toThrow(/evento_inmutable/);
    // Otra empresa (con su propio dueño) no puede tocar este paquete: 404.
    const { dueno: d2, id: id2 } = await empresaLista(m);
    expect(
      (
        await crear(
          m,
          `${BASE}/empresas/${id2}/paquetes/${paquete.id}/eventos`,
          { tipo: 'cargado' },
          d2.token,
        )
      ).estado,
    ).toBe(404);
    // El envío refleja el avance y la entrega.
    expect((await ev('cargado')).estado).toBe(201);
    expect((await ev('en_transito')).estado).toBe(201);
    expect((await ev('entregado')).estado).toBe(201);
    const det = await llamar(
      m,
      'GET',
      `${BASE}/empresas/${id}/envios/${r.datos.envio.id}`,
      undefined,
      dueno.token,
    );
    expect(det.datos.envio.estado).toBe('en_proceso'); // el otro paquete sigue «creado»
    expect((await ev('en_transito')).estado).toBe(409); // final
  });
});

describe('Flex · claves de API (C-FLEX-API)', () => {
  it('la clave se muestra una vez, solo con permisos acotados, respeta la empresa y se revoca', async () => {
    const m = mundo(ENV);
    const { dueno, id } = await empresaLista(m);
    const r = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/claves`,
      { nombre: 'ERP', permisos: ['envios.crear', 'envios.ver', 'miembros.gestionar'] },
      dueno.token,
    );
    expect(r.estado).toBe(201);
    const secreto = r.datos.clave.secreto as string;
    expect(secreto).toMatch(/^dvxk_/);
    expect(r.datos.clave.permisos).toEqual(['envios.crear', 'envios.ver']); // el de miembros se descarta
    const guardada = await m.DB.prepare(
      'SELECT clave_hash, prefijo FROM empresa_claves WHERE id = ?',
    )
      .bind(r.datos.clave.id)
      .first<{ clave_hash: string; prefijo: string }>();
    expect(guardada!.clave_hash).not.toContain(secreto.slice(12));
    expect(secreto.startsWith(guardada!.prefijo)).toBe(true);
    const lista = await llamar(m, 'GET', `${BASE}/empresas/${id}/claves`, undefined, dueno.token);
    expect(JSON.stringify(lista.datos)).not.toContain(secreto);
    // Con la clave: crear y ver envíos, pero nunca miembros ni claves.
    const porApi = await crear(m, `${BASE}/empresas/${id}/envios`, envioBase('API-1'), undefined, {
      'x-api-key': secreto,
    });
    expect(porApi.estado).toBe(201);
    expect(
      (
        await llamar(m, 'GET', `${BASE}/empresas/${id}/envios`, undefined, undefined, {
          'x-api-key': secreto,
        })
      ).datos.envios,
    ).toHaveLength(1);
    expect(
      (
        await llamar(m, 'GET', `${BASE}/empresas/${id}/miembros`, undefined, undefined, {
          'x-api-key': secreto,
        })
      ).estado,
    ).toBe(403);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${BASE}/empresas/${id}/claves`,
          { nombre: 'x', permisos: ['envios.ver'] },
          undefined,
          { 'x-api-key': secreto },
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${BASE}/empresas/${id}/invitaciones`,
          { correo: 'a@b.co', rol: 'operador' },
          undefined,
          { 'x-api-key': secreto },
        )
      ).estado,
    ).toBe(403);
    // Con la clave de esta empresa contra OTRA empresa: 401, sin pistas.
    const { id: id2 } = await empresaLista(m);
    expect(
      (
        await llamar(m, 'GET', `${BASE}/empresas/${id2}/envios`, undefined, undefined, {
          'x-api-key': secreto,
        })
      ).estado,
    ).toBe(401);
    // Uso contado, sin secretos.
    const uso = await m.DB.prepare('SELECT usos FROM empresa_claves WHERE id = ?')
      .bind(r.datos.clave.id)
      .first<{ usos: number }>();
    expect(uso!.usos).toBeGreaterThanOrEqual(5);
    // Revocar: deja de servir.
    expect(
      (
        await llamar(
          m,
          'DELETE',
          `${BASE}/empresas/${id}/claves/${r.datos.clave.id}`,
          undefined,
          dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(
      (
        await llamar(m, 'GET', `${BASE}/empresas/${id}/envios`, undefined, undefined, {
          'x-api-key': secreto,
        })
      ).estado,
    ).toBe(401);
    expect(
      (
        await llamar(m, 'GET', `${BASE}/empresas/${id}/envios`, undefined, undefined, {
          'x-api-key': 'dvxk_inventada',
        })
      ).estado,
    ).toBe(401);
  });

  it('una clave tiene límite de peticiones por minuto (429)', async () => {
    const m = mundo(ENV);
    const { dueno, id } = await empresaLista(m);
    const r = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/claves`,
      { nombre: 'ERP', permisos: ['envios.ver'] },
      dueno.token,
    );
    let ultimo = 200;
    for (let i = 0; i < 61; i++)
      ultimo = (
        await llamar(m, 'GET', `${BASE}/empresas/${id}/envios`, undefined, undefined, {
          'x-api-key': r.datos.clave.secreto,
        })
      ).estado;
    expect(ultimo).toBe(429);
  });
});

describe('Flex · importación por CSV (C-FLEX-IMPORTACION)', () => {
  const csv = [
    'reference,recipient,address,phone,packages,lat,lng',
    'A-1,Ana López,100 Main St,3051112222,2,25.77,-80.19',
    'A-2,Luis Pérez,200 Main St,,1,25.78,-80.20',
    'A-1,Repetida,300 Main St,,1,,',
    ',Sin dirección,,,1,,',
    'A-4,Mal paquetes,400 Main St,,0,,',
  ].join('\n');

  it('previsualiza con errores por fila, no duplica la misma hoja, y confirma solo las válidas de forma reanudable', async () => {
    const m = mundo(ENV);
    const { dueno, id } = await empresaLista(m);
    await crear(m, `${BASE}/empresas/${id}/envios`, envioBase('A-2'), dueno.token); // ya existe en la base
    const p = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/importaciones/previsualizar`,
      { csv, nombreArchivo: 'lunes.csv' },
      dueno.token,
    );
    expect(p.estado).toBe(201);
    expect(p.datos.importacion).toMatchObject({
      estado: 'previsualizada',
      total: 5,
      validas: 1,
      procesadas: 0,
    });
    const errores = p.datos.errores.map((e: any) => [e.fila, e.error]);
    expect(errores).toEqual([
      [2, expect.stringMatching(/Ya existe un envío con la referencia «A-2»/)],
      [3, expect.stringMatching(/repetida en la hoja \(fila 1\)/)],
      [4, expect.stringMatching(/direccion/)],
      [5, expect.stringMatching(/entre 1 y 50/)],
    ]);
    // La misma hoja otra vez: devuelve la misma importación.
    const p2 = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/importaciones/previsualizar`,
      { csv, nombreArchivo: 'lunes.csv' },
      dueno.token,
    );
    expect(p2.datos.importacion.id).toBe(p.datos.importacion.id);
    // Confirmar: crea 1 envío con 2 paquetes; confirmar otra vez no crea nada más.
    const c1 = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/importaciones/${p.datos.importacion.id}/confirmar`,
      {},
      dueno.token,
    );
    expect(c1.estado).toBe(200);
    expect(c1.datos.importacion).toMatchObject({ estado: 'terminada', procesadas: 1 });
    expect(c1.datos.creadasAhora).toBe(1);
    const c2 = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/importaciones/${p.datos.importacion.id}/confirmar`,
      {},
      dueno.token,
    );
    expect(c2.datos.importacion.procesadas).toBe(1);
    const envios = await llamar(m, 'GET', `${BASE}/empresas/${id}/envios`, undefined, dueno.token);
    expect(envios.datos.envios).toHaveLength(2);
    const nuevo = envios.datos.envios.find((e: any) => e.referenciaExterna === 'A-1');
    expect(nuevo.paquetes).toBe(2);
    expect(nuevo.destinatarioNombre).toBe('Ana López');
    // Otra empresa no ve ni confirma esta importación.
    const { dueno: d2, id: id2 } = await empresaLista(m);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${BASE}/empresas/${id2}/importaciones/${p.datos.importacion.id}/confirmar`,
          {},
          d2.token,
        )
      ).estado,
    ).toBe(404);
  });

  it('rechaza una hoja sin las columnas obligatorias y una que pase el límite', async () => {
    const m = mundo({ ...ENV, FLEX_IMPORTACION_MAX: '3' });
    const { dueno, id } = await empresaLista(m);
    const sinColumna = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/importaciones/previsualizar`,
      { csv: 'name,phone\nAna,1' },
      dueno.token,
    );
    expect(sinColumna.estado).toBe(400);
    expect(sinColumna.datos.error).toMatch(/direccion/);
    const larga = [
      'recipient,address',
      ...Array.from({ length: 4 }, (_, i) => `P${i},Calle ${i}`),
    ].join('\n');
    const r = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/importaciones/previsualizar`,
      { csv: larga },
      dueno.token,
    );
    expect(r.estado).toBe(413);
  });
});

describe('Flex · lotes y rutas (solo estructura)', () => {
  it('agrupa paquetes en un lote y arma una ruta en borrador con paradas ordenadas, sin tocar al conductor', async () => {
    const m = mundo(ENV);
    const { dueno, id } = await empresaLista(m);
    const e1 = (await crear(m, `${BASE}/empresas/${id}/envios`, envioBase('L-1'), dueno.token))
      .datos.envio;
    const e2 = (await crear(m, `${BASE}/empresas/${id}/envios`, envioBase('L-2'), dueno.token))
      .datos.envio;
    const lote = await crear(
      m,
      `${BASE}/empresas/${id}/lotes`,
      { nombre: 'Martes AM' },
      dueno.token,
    );
    expect(lote.estado).toBe(201);
    const ag = await llamar(
      m,
      'POST',
      `${BASE}/empresas/${id}/lotes/${lote.datos.lote.id}/paquetes`,
      { paqueteIds: [e1.paquetes[0].id, e2.paquetes[0].id, crypto.randomUUID()] },
      dueno.token,
    );
    expect(ag.datos.agregados).toBe(2);
    expect(ag.datos.rechazados).toHaveLength(1);
    const ruta = await crear(
      m,
      `${BASE}/empresas/${id}/rutas`,
      { nombre: 'Ruta 1', loteId: lote.datos.lote.id, envioIds: [e2.id, e1.id] },
      dueno.token,
    );
    expect(ruta.estado).toBe(201);
    expect(ruta.datos.ruta.estado).toBe('borrador');
    expect(ruta.datos.ruta.conductorId).toBeNull();
    expect(ruta.datos.ruta.paradas.map((p: any) => [p.orden, p.referenciaExterna])).toEqual([
      [1, 'L-2'],
      [2, 'L-1'],
    ]);
    const re = await llamar(
      m,
      'PATCH',
      `${BASE}/empresas/${id}/rutas/${ruta.datos.ruta.id}`,
      { envioIds: [e1.id, e2.id] },
      dueno.token,
    );
    expect(re.datos.ruta.paradas.map((p: any) => p.referenciaExterna)).toEqual(['L-1', 'L-2']);
    // La ocupación del conductor (Comida y operaciones) sigue intacta: no hay filas nuevas.
    const oc = await m.DB.prepare('SELECT COUNT(*) AS n FROM conductor_ocupacion').first<{
      n: number;
    }>();
    expect(oc!.n).toBe(0);
    // Envíos de otra empresa no entran en la ruta.
    const { dueno: d2, id: id2 } = await empresaLista(m);
    expect(
      (await crear(m, `${BASE}/empresas/${id2}/rutas`, { envioIds: [e1.id] }, d2.token)).estado,
    ).toBe(404);
  });
});
