import { avisarSiQuedoActivo } from '../activacion';
import {
  CLAVE_PAISES,
  canalesPara,
  gastoHoy,
  paisesApagados,
  presupuestoSmsDia,
  topeCodigosDia,
} from '../telefonoVuelta';
import { presupuestoWhatsappDia, whatsappEncendido } from '../whatsapp';
import { ZONA_CONDUCTOR_SQL } from '../cuentaPais';
import { guardarFoto } from '../fotoLimpia';
import { ALTA_REPARTIDOR } from '../zonaConductor';
import { avisarVerificacionLista } from '../avisoVerificacion';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  distanciaKm,
  edadEnAnios,
  estadoEeuuDeZona,
  perfilPasajeros,
  pideReversoDocumento,
  TAMANOS_FOTO,
  medidasWebp,
  nacimientoDeLecturas,
  nacimientoSeGuardaSolo,
  type CruceDocumento,
  crucesDocumento,
} from '@tumbite/compartido';
import { paisDelConductor } from '../paisConductor';
import {
  REQUISITO_EDAD,
  confirmarDatosLeidos,
  edadMinimaDe as edadMinimaPais,
  edadesConfiguradas,
  sincronizarEdad,
} from '../edadYDocumento';
import { graciaDe } from '../plazoPapeles';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { enviarCorreo } from '../correo';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';
import {
  anotarDecisionHumana,
  enviarSoloTrasSubir,
  revisarFotoKycConIa,
} from './verificacionConductor';
import { asegurarCodigoRepartidor } from './superadmin';
import {
  checkrConfigurado,
  firmaCheckrValida,
  pedirAntecedentes,
  procesarAvisoCheckr,
} from '../antecedentes';
import { guardarDecision, motorEncendido, pedirDecision, textoMotivos } from '../verificacionAuto';
import { accesoDe, alcanceObjetoSql, tienePermiso } from '../accesoInterno';
import {
  type FilaBandeja,
  type FilaSinEnviar,
  POR_PAGINA_BANDEJA,
  consultaPagina,
  consultaTotalSinEnviar,
  consultaTotales,
  consultasSinEnviar,
  filaDeBandeja,
  filaSinEnviar,
  juntarSinEnviar,
  leerEstadoBandeja,
  resumenCara,
  resumenComprobacion,
  ZONA_BANDEJA_SQL,
} from './kycBandeja';

/**
 * KYC: verificación de identidad de repartidores y dueños de restaurante, hecha por Divoox.
 * - La persona toma con la app la foto del documento (frente y reverso) y una foto de su cara.
 * - El restaurante además una foto del local con la ubicación del celular: si está lejos de la
 *   dirección registrada, el superadmin lo ve marcado (restaurantes falsos o mudados).
 * - Las fotos van a kyc/<usuario>/… y NUNCA se sirven al público: solo al admin, por su ruta.
 * - Con KYC_OBLIGATORIO=1, sin KYC aprobado el repartidor no se conecta y el restaurante no se
 *   aprueba. La revisión con IA llega después, con el tope de gasto aprobado. Candado C-KYC.
 */
export const kyc = new Hono<{ Bindings: Env; Variables: Variables }>();

export const PIEZAS = ['doc_frente', 'doc_reverso', 'selfie', 'local', 'giro_1', 'giro_2'] as const;
type Pieza = (typeof PIEZAS)[number];
const esPieza = (x: string): x is Pieza => (PIEZAS as readonly string[]).includes(x);
/** A más de esto, la foto del local no coincide con la dirección del restaurante. */
export const DISTANCIA_MAXIMA_M = 300;

function almacen(env: Env): R2Bucket {
  if (!env.BUCKET)
    throw new ErrorDatos(
      'El almacén no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  return env.BUCKET;
}

type FilaKyc = {
  usuario_id: string;
  estado: 'sin_enviar' | 'pendiente' | 'aprobado' | 'rechazado';
  motivo: string;
  doc_tipo: string;
  doc_frente: string | null;
  doc_reverso: string | null;
  selfie: string | null;
  local: string | null;
  giro_1?: string | null;
  giro_2?: string | null;
  consentimiento_en?: string | null;
  local_lat: number | null;
  local_lng: number | null;
  local_distancia_m: number | null;
  enviado_en: string | null;
  revisado_en: string | null;
  proxima_revision: string | null;
};

const aKyc = (f: FilaKyc | null) => ({
  estado: f?.estado ?? 'sin_enviar',
  motivo: f?.motivo ?? '',
  docTipo: f?.doc_tipo ?? '',
  tiene: {
    doc_frente: Boolean(f?.doc_frente),
    doc_reverso: Boolean(f?.doc_reverso),
    selfie: Boolean(f?.selfie),
    local: Boolean(f?.local),
    giro_1: Boolean(f?.giro_1),
    giro_2: Boolean(f?.giro_2),
  },
  consentimiento: Boolean(f?.consentimiento_en),
  localDistanciaM: f?.local_distancia_m ?? null,
  enviado: f?.enviado_en ?? null,
  revisado: f?.revisado_en ?? null,
  proximaRevision: f?.proxima_revision ?? null,
});

/** ¿Esta cuenta tiene el KYC aprobado y vigente? */
export async function kycAprobado(db: D1Database, usuarioId: string): Promise<boolean> {
  const f = await db
    .prepare('SELECT estado, proxima_revision FROM kyc WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ estado: string; proxima_revision: string | null }>();
  if (f?.estado !== 'aprobado') return false;
  return !f.proxima_revision || f.proxima_revision >= new Date().toISOString().slice(0, 10);
}

// ───────────────────────── La persona ─────────────────────────

/** Antecedentes y selfie de control del repartidor, como los ve su app. */
async function extrasRepartidor(db: D1Database, usuarioId: string) {
  const a = await db
    .prepare('SELECT estado, invitacion_url FROM antecedentes_checkr WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ estado: string; invitacion_url: string }>();
  const d = await db
    .prepare('SELECT antecedentes FROM repartidor_datos WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ antecedentes: string }>();
  const sc = await db
    .prepare(
      'SELECT id, pedida_en FROM selfies_control WHERE usuario_id = ? AND tomada_en IS NULL ORDER BY pedida_en DESC LIMIT 1',
    )
    .bind(usuarioId)
    .first<{ id: string; pedida_en: string }>();
  return {
    antecedentes: {
      estado: d?.antecedentes === 'aprobado' ? 'aprobado' : (a?.estado ?? 'sin_pedir'),
      url: a?.estado === 'invitado' ? a.invitacion_url : '',
    },
    selfieControl: sc
      ? { pendiente: true, pedidaEn: sc.pedida_en }
      : { pendiente: false, pedidaEn: null },
  };
}

kyc.get('/kyc', async (c) => {
  const u = exigir(c, 'repartidor', 'restaurante');
  const db = base(c);
  const f = await db.prepare('SELECT * FROM kyc WHERE usuario_id = ?').bind(u.id).first<FilaKyc>();
  return c.json({
    kyc: aKyc(f),
    pideLocal: u.rol === 'restaurante',
    // Con el motor, la app pide el consentimiento y las dos tomas girando la cabeza.
    motor: u.rol === 'repartidor' && motorEncendido(c.env),
    ...(u.rol === 'repartidor' ? await extrasRepartidor(db, u.id) : {}),
    // C-ANTECEDENTES-POR-PAIS: el bloque del proveedor de antecedentes solo donde el país lo usa
    // (EE. UU.); en Venezuela los antecedentes van con el certificado que revisa el equipo.
    antecedentesPorProveedor:
      u.rol === 'repartidor' &&
      perfilPasajeros((await paisDelConductor(db, u.id)).pais).antecedentes === 'proveedor',
  });
});

/**
 * Antecedentes con Checkr: el repartidor pide la invitación y llena sus datos en la página de
 * Checkr. Sin Checkr configurado se dice claro; nunca se piden datos sensibles aquí.
 */
kyc.post('/kyc/antecedentes/pedir', async (c) => {
  const u = exigir(c, 'repartidor');
  if (!checkrConfigurado(c.env))
    throw new ErrorDatos(
      'La verificación de antecedentes se activa muy pronto. Te avisamos en la app.',
      undefined,
      409,
    );
  const db = base(c);
  const f = await db
    .prepare('SELECT nombre, correo, telefono FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ nombre: string; correo: string; telefono: string | null }>();
  if (!f) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  try {
    return c.json(await pedirAntecedentes(c.env, db, { id: u.id, ...f }));
  } catch (e) {
    console.error('checkr', e);
    throw new ErrorDatos(
      'No pudimos conectar con la verificación de antecedentes. Intenta más tarde.',
      undefined,
      503,
    );
  }
});

/** Aviso de Checkr (firmado con la llave de la API). Sin firma válida no se toca nada. */
kyc.post('/checkr/aviso', async (c) => {
  const llave = c.env.CHECKR_API_KEY;
  const cuerpo = await c.req.text();
  if (!llave || !(await firmaCheckrValida(cuerpo, c.req.header('x-checkr-signature'), llave))) {
    console.error('aviso de checkr con firma inválida o sin llave');
    return c.json({ error: 'firma inválida' }, 400);
  }
  const aviso = JSON.parse(cuerpo) as { type: string; data?: { object?: Record<string, unknown> } };
  return c.json({ ok: true, ...(await procesarAvisoCheckr(c.env, base(c), aviso)) });
});

/**
 * La selfie de control pedida al conectarse: se guarda aparte y el equipo la compara.
 * C-PRUEBA-DE-VIDA (31 oct 2026, como DoorDash): con `?pose=frente` y después `?pose=giro` (mirando
 * a la derecha) se piden dos fotos; una foto de una foto no gira. Queda tomada al llegar el giro.
 * Sin `pose` (apps anteriores) funciona como antes: una sola foto.
 */
kyc.post('/kyc/selfie-control', async (c) => {
  const u = exigir(c, 'repartidor');
  const pose = c.req.query('pose');
  if (pose !== undefined && pose !== 'frente' && pose !== 'giro')
    throw new ErrorDatos('Esa foto no existe.', undefined, 400);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  const db = base(c);
  const sc = await db
    .prepare(
      'SELECT id, clave FROM selfies_control WHERE usuario_id = ? AND tomada_en IS NULL ORDER BY pedida_en DESC LIMIT 1',
    )
    .bind(u.id)
    .first<{ id: string; clave: string }>();
  if (!sc) throw new ErrorDatos('No tienes ninguna foto de control pendiente.', undefined, 409);
  if (pose === 'giro' && !sc.clave)
    throw new ErrorDatos('Primero toma la foto de frente.', 'foto', 409);
  const clave = pose === 'giro' ? `${sc.clave}-giro` : `kyc/${u.id}/control-${sc.id}`;
  // Identidad: es evidencia que se revisa; conserva el original (carpeta privada kyc/).
  await guardarFoto(almacen(c.env), clave, bytes, tipo, {
    cacheControl: 'private, no-store',
    conservarOriginal: 'evidencia',
  });
  if (pose === 'frente') {
    await db.prepare('UPDATE selfies_control SET clave = ? WHERE id = ?').bind(clave, sc.id).run();
    return c.json({ ok: true, falta: 'giro' }, 201);
  }
  if (pose === 'giro')
    await db
      .prepare("UPDATE selfies_control SET tomada_en = datetime('now') WHERE id = ?")
      .bind(sc.id)
      .run();
  else
    await db
      .prepare("UPDATE selfies_control SET clave = ?, tomada_en = datetime('now') WHERE id = ?")
      .bind(clave, sc.id)
      .run();
  return c.json({ ok: true, url: `/datos/kyc/selfie-control` }, 201);
});

/** Sube una pieza (foto) del KYC. Solo imágenes de verdad, máximo 3 MB. Va a la carpeta privada. */
kyc.post('/kyc/foto/:pieza', async (c) => {
  const u = exigir(c, 'repartidor', 'restaurante');
  const pieza = c.req.param('pieza');
  if (
    !esPieza(pieza) ||
    (pieza === 'local' && u.rol !== 'restaurante') ||
    (pieza.startsWith('giro_') && u.rol !== 'repartidor')
  )
    throw new ErrorDatos('Esa foto no corresponde.', 'foto', 400);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  const db = base(c);
  const estado = await db
    .prepare('SELECT estado FROM kyc WHERE usuario_id = ?')
    .bind(u.id)
    .first<{ estado: string }>();
  if (estado?.estado === 'aprobado')
    throw new ErrorDatos('Tu verificación ya está aprobada.', undefined, 409);
  const clave = `kyc/${u.id}/${pieza}-${nuevoId()}`;
  // Identidad: es evidencia que se revisa; conserva el original (carpeta privada kyc/).
  await guardarFoto(almacen(c.env), clave, bytes, tipo, {
    cacheControl: 'private, no-store',
    conservarOriginal: 'evidencia',
  });
  // Coordenadas del celular al tomar la foto del local (para comparar con la dirección).
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  const conUbicacion = pieza === 'local' && Number.isFinite(lat) && Number.isFinite(lng);
  await db.prepare('INSERT OR IGNORE INTO kyc (usuario_id) VALUES (?)').bind(u.id).run();
  if (u.rol === 'repartidor') {
    // El repartidor ya tiene su ID antes de que el equipo lo revise.
    await db.prepare(ALTA_REPARTIDOR).bind(u.id).run();
    await asegurarCodigoRepartidor(db, u.id);
  }
  await db
    .prepare(
      `UPDATE kyc SET ${pieza} = ?, local_lat = CASE WHEN ? THEN ? ELSE local_lat END,
       local_lng = CASE WHEN ? THEN ? ELSE local_lng END WHERE usuario_id = ?`,
    )
    .bind(
      clave,
      conUbicacion ? 1 : 0,
      conUbicacion ? lat : null,
      conUbicacion ? 1 : 0,
      conUbicacion ? lng : null,
      u.id,
    )
    .run();
  // C-IA-TODA-FOTO: con el permiso del conductor, la IA también mira la foto que llega por aquí.
  if (u.rol === 'repartidor')
    await revisarFotoKycConIa(c.env, db, u, pieza, { bytes, mime: tipo }, clave).catch(
      (e: unknown) => console.error('kyc: la comprobación automática de la foto falló', e),
    );
  // C-LLEGA-SOLO-A-REVISION: con la última foto, la identidad va a revisión sola (con el motor
  // automático encendido, espera las dos tomas y el botón, que es lo que lo dispara).
  if (u.rol === 'repartidor')
    await enviarSoloTrasSubir(c.env, db, u, { kycViejo: !motorEncendido(c.env) });
  // C-FOTO-ENTREGA-IPHONE: la referencia de la foto guardada; las apps viejas la exigían.
  return c.json({ ok: true, url: clave }, 201);
});

/**
 * Consentimiento escrito antes de la selfie (datos biométricos): sin él, el motor no mira la cara y la
 * verificación la hace el equipo. Queda la fecha. El texto lo aprueba el abogado (PENDIENTES 👤).
 */
kyc.post('/kyc/consentimiento', async (c) => {
  const u = exigir(c, 'repartidor');
  await leerCuerpo(c, z.object({ acepto: z.literal(true) }));
  const db = base(c);
  await db.prepare('INSERT OR IGNORE INTO kyc (usuario_id) VALUES (?)').bind(u.id).run();
  await db
    .prepare("UPDATE kyc SET consentimiento_en = datetime('now') WHERE usuario_id = ?")
    .bind(u.id)
    .run();
  // C-LLEGA-SOLO-A-REVISION: si el consentimiento era lo único que faltaba, ahora va a revisión.
  await enviarSoloTrasSubir(c.env, db, u, { kycViejo: !motorEncendido(c.env) });
  return c.json({ ok: true });
});

const esquemaEnvio = z.object({ docTipo: z.enum(['licencia', 'pasaporte', 'identificacion']) });

kyc.post('/kyc/enviar', async (c) => {
  const u = exigir(c, 'repartidor', 'restaurante');
  const { docTipo } = await leerCuerpo(c, esquemaEnvio);
  const db = base(c);
  const f = await db.prepare('SELECT * FROM kyc WHERE usuario_id = ?').bind(u.id).first<FilaKyc>();
  const faltan: string[] = [];
  if (!f?.doc_frente) faltan.push('doc_frente');
  // C-DOCUMENTO-SIN-REVERSO: el conductor de un país cuyo documento no trae nada atrás (Venezuela) no
  // necesita el reverso. El restaurante sigue como siempre.
  const pideReverso =
    docTipo !== 'pasaporte' &&
    (u.rol !== 'repartidor' || pideReversoDocumento((await graciaDe(db, u.id)).politica));
  if (pideReverso && !f?.doc_reverso) faltan.push('doc_reverso');
  if (!f?.selfie) faltan.push('selfie');
  if (u.rol === 'restaurante' && !f?.local) faltan.push('local');
  if (faltan.length)
    throw new ErrorDatos('Faltan fotos por tomar antes de enviar.', faltan[0], 422);
  let distancia: number | null = null;
  if (u.rol === 'restaurante' && f?.local_lat != null && f.local_lng != null) {
    const r = await db
      .prepare(
        'SELECT lat, lng FROM restaurantes WHERE (dueno_id = ?1 OR id IN (SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1))',
      )
      .bind(u.id)
      .first<{ lat: number | null; lng: number | null }>();
    if (r?.lat != null && r.lng != null)
      distancia = Math.round(
        distanciaKm({ lat: f.local_lat, lng: f.local_lng }, { lat: r.lat, lng: r.lng }) * 1000,
      );
  }
  await db
    .prepare(
      "UPDATE kyc SET estado = 'pendiente', motivo = '', doc_tipo = ?, local_distancia_m = ?, enviado_en = datetime('now') WHERE usuario_id = ?",
    )
    .bind(docTipo, distancia, u.id)
    .run();
  // C-KYC-AUTO: con el motor, el consentimiento y las dos tomas, la decisión sale al instante.
  if (
    u.rol === 'repartidor' &&
    f?.consentimiento_en &&
    f.giro_1 &&
    f.giro_2 &&
    f.doc_frente &&
    f.selfie &&
    motorEncendido(c.env)
  ) {
    const d = await pedirDecision(c.env, db, u.id, {
      docTipo,
      frente: f.doc_frente,
      reverso: f.doc_reverso,
      selfie: f.selfie,
      giros: [f.giro_1, f.giro_2],
      edadMinima: await edadMinimaDe(db, u.id),
    });
    if (d) {
      await guardarDecision(db, u.id, d);
      const idioma = u.idioma === 'en' ? 'en' : 'es';
      if (d.decision !== 'revision') {
        await db
          .prepare(
            "UPDATE kyc SET estado = ?, motivo = ?, revisado_en = datetime('now'), revisado_por = 'motor' WHERE usuario_id = ? AND estado = 'pendiente'",
          )
          .bind(
            d.decision === 'verificado' ? 'aprobado' : 'rechazado',
            d.decision === 'verificado' ? '' : textoMotivos(d.motivos, idioma),
            u.id,
          )
          .run();
        return c.json({ ok: true, distanciaM: distancia, decision: d.decision });
      }
    }
  }
  // Punto 27 y C-VERIFICACIONES-EN-VIVO: el equipo se entera en el momento, UN correo por persona.
  await avisarVerificacionLista(c.env, u.id).catch((e: unknown) =>
    console.error('kyc: aviso al equipo', e),
  );
  return c.json({ ok: true, distanciaM: distancia });
});

// ───────────────────────── Superadmin ─────────────────────────

/**
 * C-VERIFICACIONES-BANDEJA (22 nov 2026): la bandeja de Verificaciones. UNA consulta por página con la
 * miniatura, el ID, la zona, la espera, si es de prueba y lo que dijo la comprobación automática de
 * cada foto; filtros de pestaña, zona, cuentas reales o de prueba y búsqueda. Los totales de cada
 * pestaña salen con los mismos filtros (solo en la primera página). Mirar no escribe.
 */
/**
 * C-VERIFICACIONES-EN-VIVO (23 nov 2026, Richard): la marca que el panel pide cada pocos segundos con
 * la pestaña a la vista. Lee lo mínimo, por índice: cuántas esperan y la última enviada (kyc_estado),
 * el último registro de conductor o restaurante (usuarios_rol_creado) y la última foto subida (rowid).
 * Solo si la firma cambió el panel vuelve a traer la lista. Mirar no escribe.
 */
kyc.get('/admin/kyc/marca', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  // Siete preguntas chicas en UN viaje, cada una por su índice y con su tope (una fila cada una).
  const [p, u, rc, rr, f, vh, pp] = await db.batch<Record<string, unknown>>([
    db.prepare("SELECT COUNT(*) AS n FROM kyc WHERE estado = 'pendiente'"),
    db.prepare(
      "SELECT enviado_en AS v FROM kyc WHERE estado = 'pendiente' ORDER BY enviado_en DESC LIMIT 1",
    ),
    db.prepare(
      "SELECT creado_en AS v FROM usuarios WHERE rol = 'repartidor' ORDER BY creado_en DESC LIMIT 1",
    ),
    db.prepare(
      "SELECT creado_en AS v FROM usuarios WHERE rol = 'restaurante' ORDER BY creado_en DESC LIMIT 1",
    ),
    db.prepare('SELECT rowid AS v FROM verificacion_fotos ORDER BY rowid DESC LIMIT 1'),
    // C-VERIFICACIONES-EN-VIVO-VEHICULO: el vehículo en revisión y los papeles sueltos también son
    // «por decidir» (C-VERIFICACION-UNICA); sin esto, la moto de quien ya esperaba por su identidad
    // llegaba sin sonido ni lista nueva. Por sus índices (estado, fecha): una fila cada una.
    db.prepare(
      "SELECT COUNT(*) || ':' || COALESCE(MAX(actualizado_en), '') AS v FROM vehiculos WHERE estado = 'en_revision'",
    ),
    db.prepare(
      "SELECT COUNT(*) || ':' || COALESCE(MAX(creado_en), '') AS v FROM conductor_documentos WHERE estado = 'pendiente'",
    ),
  ]);
  const v = (r: D1Result<Record<string, unknown>> | undefined, k = 'v') =>
    (new Map(Object.entries(r?.results[0] ?? {})).get(k) as string | number | null | undefined) ??
    null;
  const pendientes = Number(v(p, 'n') ?? 0);
  const ultima = v(u) as string | null;
  c.header('Cache-Control', 'no-store');
  return c.json({
    pendientes,
    ultimaEnviada: ultima,
    firma: [pendientes, ultima, v(rc), v(rr), v(f), v(vh), v(pp)].join('|'),
  });
});

kyc.get('/admin/kyc', async (c) => {
  exigir(c, 'admin');
  const zona = c.req.query('zona') ?? '';
  const filtros = {
    estado: leerEstadoBandeja(c.req.query('estado')),
    orden: c.req.query('orden') === 'cerca' ? ('cerca' as const) : ('llegada' as const),
    zona: /^[A-Za-z0-9_-]{1,40}$/.test(zona) ? zona : '',
    cuentas: c.req.query('cuentas'),
    q: c.req.query('q') ?? '',
    // C-PERMISOS-FINOS: las verificaciones de las personas de su alcance (también los totales).
    alcance: alcanceObjetoSql(accesoDe(c), 'persona', 'k.usuario_id'),
  };
  const despues = (c.req.query('despues') ?? '').slice(0, 120);
  const db = base(c);
  // C-VERIFICACIONES-SIN-ENVIAR: quien se registró y no mandó sus fotos sale de las cuentas (no de
  // la tabla de verificaciones), con los mismos filtros y el alcance sobre la persona.
  const deCuentas = {
    ...filtros,
    alcance: alcanceObjetoSql(accesoDe(c), 'persona', 'u.id'),
  };
  const totales = despues
    ? null
    : await (async () => {
        const t = consultaTotales(filtros);
        const s = consultaTotalSinEnviar(deCuentas);
        const [porEstado, sinEnviar] = await db.batch<{ estado?: string; n: number }>([
          db.prepare(t.sql).bind(...t.valores),
          db.prepare(s.sql).bind(...s.valores),
        ]);
        return {
          ...Object.fromEntries((porEstado?.results ?? []).map((x) => [x.estado, Number(x.n)])),
          sin_enviar: Number(sinEnviar?.results[0]?.n ?? 0),
        };
      })();
  if (filtros.estado === 'sin_enviar') {
    const listas = await db.batch<FilaSinEnviar>(
      consultasSinEnviar(deCuentas, despues).map((q) => db.prepare(q.sql).bind(...q.valores)),
    );
    const todas = juntarSinEnviar(listas.map((l) => l.results));
    const pagina = todas.slice(0, POR_PAGINA_BANDEJA);
    const ultima = pagina.at(-1);
    const fotos = tienePermiso(c, 'repartidores.documentos');
    return c.json({
      solicitudes: pagina.map(filaSinEnviar).map((f) => (fotos ? f : { ...f, miniatura: null })),
      siguiente:
        todas.length > POR_PAGINA_BANDEJA && ultima ? `${ultima.creado}|${ultima.id}` : null,
      totales,
    });
  }
  const p = consultaPagina(filtros, despues);
  const { results } = await db
    .prepare(p.sql)
    .bind(...p.valores)
    .all<FilaBandeja>();
  const pagina = results.slice(0, POR_PAGINA_BANDEJA);
  const ultima = pagina.at(-1);
  // C-CRUCES-DOCUMENTO: lo que no cuadra de cada conductor de la página (una lectura para todos).
  const cruces = await crucesDePagina(
    db,
    pagina.map((r) => r.id),
  );
  return c.json({
    // C-MINIATURA-SIEMPRE: quien no puede ver documentos ve las iniciales, no la foto.
    solicitudes: pagina
      .map((r) => ({ ...filaDeBandeja(r, DISTANCIA_MAXIMA_M), cruces: cruces.get(r.id) ?? [] }))
      .map((f) => (tienePermiso(c, 'repartidores.documentos') ? f : { ...f, miniatura: null })),
    siguiente:
      results.length > POR_PAGINA_BANDEJA && ultima
        ? `${p.fecha(ultima) ?? ''}|${ultima.id}`
        : null,
    totales,
  });
});

/** C-CRUCES-DOCUMENTO: los cruces de los conductores de una página de la bandeja. */
async function crucesDePagina(db: D1Database, ids: string[]) {
  const salida = new Map<string, CruceDocumento[]>();
  if (!ids.length) return salida;
  const { results } = await db
    .prepare(
      `SELECT u.id, u.rol, u.nombre, u.fecha_nacimiento AS fecha, d.nombre AS leido, d.numero,
              d.licencia_numero AS licencia, d.vence,
              (SELECT z.pais FROM zonas z WHERE z.id = ${ZONA_CONDUCTOR_SQL}) AS pais
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
         LEFT JOIN datos_documento d ON d.usuario_id = u.id
        WHERE u.id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(...ids)
    .all<{
      id: string;
      rol: string;
      nombre: string;
      fecha: string | null;
      leido: string | null;
      numero: string | null;
      licencia: string | null;
      vence: string | null;
      pais: string | null;
    }>();
  const config = await edadesConfiguradas(db);
  for (const f of results.filter((x) => x.rol === 'repartidor')) {
    const edad = edadEnAnios(f.fecha || null);
    salida.set(
      f.id,
      crucesDocumento({
        nombreEscrito: f.nombre,
        nombreLeido: f.leido ?? '',
        numeroDocumento: f.numero ?? '',
        numeroLicencia: f.licencia ?? '',
        venceDocumento: f.vence ?? '',
        fechaNacimiento: f.fecha || null,
        edad,
        edadMinima: edadMinimaPais(config, {
          pais: (f.pais ?? 'US').toUpperCase(),
          servicio: 'moto',
        }),
      }),
    );
  }
  return salida;
}

/**
 * C-FOTO-CONDUCTOR-SE-VE (24 nov 2026) — todos los países. La reparación de la foto que ve el
 * pasajero: las verificaciones APROBADAS con cara y sin miniatura (aprobadas antes de la miniatura, o
 * desde un navegador que no sabe hacer WebP). Un Worker no reduce fotos, así que el panel del equipo
 * pide esta lista al abrir Verificaciones, hace cada miniatura y la sube por
 * `POST /admin/kyc/:id/miniatura`: una escritura por conductor, una sola vez (la lista ya no lo trae).
 * Solo ids, solo de su alcance, como mucho MAX_MINIATURAS_POR_VUELTA por vuelta.
 */
export const MAX_MINIATURAS_POR_VUELTA = 10;
kyc.get('/admin/kyc/miniaturas-faltantes', async (c) => {
  exigir(c, 'admin');
  if (!tienePermiso(c, 'repartidores.documentos')) return c.json({ ids: [] });
  const alcance = alcanceObjetoSql(accesoDe(c), 'persona', 'k.usuario_id');
  const { results } = await base(c)
    .prepare(
      `SELECT k.usuario_id AS id FROM kyc k
        WHERE k.estado = 'aprobado' AND k.selfie IS NOT NULL AND k.selfie_miniatura IS NULL${alcance.sql}
        ORDER BY k.revisado_en DESC LIMIT ${MAX_MINIATURAS_POR_VUELTA}`,
    )
    .bind(...alcance.valores)
    .all<{ id: string }>();
  return c.json({ ids: results.map((r) => r.id) });
});

kyc.get('/admin/kyc/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const leida = await db
    .prepare('SELECT * FROM kyc WHERE usuario_id = ?')
    .bind(id)
    .first<FilaKyc>();
  const u = await db
    .prepare(
      `SELECT u.nombre, u.correo, u.telefono, u.fecha_nacimiento, u.rol, u.idioma, rs.id AS restaurante_id, rs.nombre AS restaurante, rs.direccion,
              COALESCE(u.es_prueba, 0) AS es_prueba, d.codigo, ${ZONA_BANDEJA_SQL} AS zona_id, z.nombre AS zona
         FROM usuarios u LEFT JOIN restaurantes rs ON rs.dueno_id = u.id
         LEFT JOIN repartidores d ON d.usuario_id = u.id
         LEFT JOIN zonas z ON z.id = ${ZONA_BANDEJA_SQL}
        WHERE u.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!u) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  // C-DOCUMENTO-SIN-REVERSO: en el país del conductor que no pide reversos (Venezuela), el equipo no
  // ve un «reverso» sobrante (la foto en blanco que alguien llegó a subir se queda guardada, sin más).
  const noSePide = new Set<string>(
    u.rol === 'repartidor' ? ((await graciaDe(db, id)).politica.sinReverso ?? []) : [],
  );
  const f = leida && noSePide.has('doc_reverso') ? { ...leida, doc_reverso: null } : leida;
  const { results: controles } = await db
    .prepare(
      'SELECT id, pedida_en, tomada_en, revisada_en, resultado, clave FROM selfies_control WHERE usuario_id = ? ORDER BY pedida_en DESC LIMIT 10',
    )
    .bind(id)
    .all<Record<string, unknown>>();
  // C-PRUEBA-DE-VIDA: cuáles traen también la foto mirando a la derecha.
  const giros = new Set<string>();
  for (const x of controles)
    if (x.clave && (await almacen(c.env).head(`${String(x.clave)}-giro`))) giros.add(String(x.id));
  const { results: auto } = await db
    .prepare(
      'SELECT decision, motivos_json, similitud, parecidas_json, creada_en FROM verificaciones_auto WHERE usuario_id = ? ORDER BY creada_en DESC LIMIT 5',
    )
    .bind(id)
    .all<{
      decision: string;
      motivos_json: string;
      similitud: number | null;
      parecidas_json: string;
      creada_en: string;
    }>();
  // C-VERIFICACIONES-BANDEJA: lo que leyó la comprobación automática de cada foto vigente (para
  // compararlo con lo que escribió la persona) y lo que la persona declaró de su vehículo y papeles.
  const { results: fotosIa } = await db
    .prepare(
      `SELECT paso, clave, estado, ia_color AS color, ia_clase AS clase, ia_confianza AS confianza, ia_json AS lectura
         FROM verificacion_fotos WHERE conductor_id = ? AND estado IN ('vigente', 'repetir') ORDER BY creado_en`,
    )
    .bind(id)
    .all<{
      paso: string;
      clave: string;
      estado: string;
      color: string;
      clase: string;
      confianza: number | null;
      lectura: string;
    }>()
    .then((r) => ({ results: r.results.filter((x) => !noSePide.has(x.paso)) }));
  const declarado =
    u.rol === 'repartidor'
      ? await db
          .prepare(
            `SELECT vehiculo_tipo AS vehiculo, marca, modelo, placa, licencia_numero AS licenciaNumero,
                    licencia_vence AS licenciaVence, seguro_poliza AS seguroPoliza, seguro_vence AS seguroVence
               FROM repartidor_datos WHERE usuario_id = ?`,
          )
          .bind(id)
          .first<Record<string, unknown>>()
      : null;
  const lejosLocal = f?.local_distancia_m != null && f.local_distancia_m > DISTANCIA_MAXIMA_M;
  const deClave = (clave: string | null | undefined) =>
    clave ? (fotosIa.find((x) => x.clave === clave) ?? null) : null;
  const leerLectura = (s: string) => {
    try {
      return s ? (JSON.parse(s) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  return c.json({
    persona: u,
    kyc: {
      ...aKyc(f),
      lejos: lejosLocal,
    },
    comprobaciones: (
      [
        ['doc_frente', f?.doc_frente],
        ['doc_reverso', f?.doc_reverso],
        ['selfie', f?.selfie],
        ['local', f?.local],
      ] as const
    )
      .filter(([, clave]) => Boolean(clave))
      .map(([p, clave]) =>
        resumenComprobacion(
          p,
          p === 'local' ? null : deClave(clave),
          p === 'local'
            ? { distanciaM: f?.local_distancia_m ?? null, lejos: lejosLocal }
            : undefined,
        ),
      ),
    lecturas: fotosIa.map((x) => ({
      paso: x.paso,
      color: x.color,
      clase: x.clase,
      confianza: x.confianza,
      lectura: leerLectura(x.lectura),
    })),
    declarado: declarado ?? null,
    // C-KYC-AUTO: lo que decidió el motor y por qué (las caras parecidas, con la cuenta cerrada).
    motor: auto.map((a) => ({
      decision: a.decision,
      motivos: JSON.parse(a.motivos_json) as string[],
      similitud: a.similitud,
      parecidas: JSON.parse(a.parecidas_json) as { id: string; similitud: number }[],
      en: a.creada_en,
    })),
    ...(u.rol === 'repartidor' ? await extrasRepartidor(db, id) : {}),
    cara: resumenCara(
      (
        await db
          .prepare('SELECT resultado FROM verificacion_caras WHERE conductor_id = ?')
          .bind(id)
          .first<{ resultado: string }>()
      )?.resultado,
    ),
    selfiesControl: controles.map((x) => ({
      id: String(x.id),
      pedidaEn: String(x.pedida_en),
      tomadaEn: (x.tomada_en as string | null) ?? null,
      revisadaEn: (x.revisada_en as string | null) ?? null,
      resultado: String(x.resultado ?? ''),
      conFoto: Boolean(x.clave),
      conGiro: giros.has(String(x.id)),
    })),
  });
});

/** Una selfie de control, solo para el admin. */
kyc.get('/admin/kyc/:id/control/:cid', async (c) => {
  exigir(c, 'admin');
  const f = await base(c)
    .prepare('SELECT clave FROM selfies_control WHERE id = ? AND usuario_id = ?')
    .bind(c.req.param('cid'), c.req.param('id'))
    .first<{ clave: string }>();
  if (!f?.clave) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  // C-PRUEBA-DE-VIDA: «?pose=giro» devuelve la segunda foto (mirando a la derecha).
  const obj = await almacen(c.env).get(
    c.req.query('pose') === 'giro' ? `${f.clave}-giro` : f.clave,
  );
  if (!obj) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-robots-tag', 'noindex');
  return new Response(obj.body, { headers });
});

/** El equipo dice si la selfie de control coincide con la del registro. */
kyc.patch('/admin/kyc/:id/control/:cid', async (c) => {
  exigir(c, 'admin');
  const { resultado } = await leerCuerpo(
    c,
    z.object({ resultado: z.enum(['coincide', 'no_coincide']) }),
  );
  const r = await base(c)
    .prepare(
      "UPDATE selfies_control SET resultado = ?, revisada_en = datetime('now') WHERE id = ? AND usuario_id = ? AND tomada_en IS NOT NULL",
    )
    .bind(resultado, c.req.param('cid'), c.req.param('id'))
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa foto de control no existe o no se tomó.', undefined, 409);
  return c.json({ ok: true });
});

/** La foto, solo para el admin: nunca pasa por la carpeta pública ni por el caché. */
kyc.get('/admin/kyc/:id/foto/:pieza', async (c) => {
  exigir(c, 'admin');
  const pieza = c.req.param('pieza');
  if (!esPieza(pieza)) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  // C-VERIFICACIONES-BANDEJA: «?mini=1» en la cara sirve la miniatura (la fila de la bandeja), si existe.
  const mini = pieza === 'selfie' && c.req.query('mini') === '1';
  const f = await base(c)
    .prepare(
      `SELECT ${mini ? 'COALESCE(selfie_miniatura, selfie)' : pieza} AS clave FROM kyc WHERE usuario_id = ?`,
    )
    .bind(c.req.param('id'))
    .first<{ clave: string | null }>();
  if (!f?.clave) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  const obj = await almacen(c.env).get(f.clave);
  if (!obj) throw new ErrorDatos('Esa foto no existe.', undefined, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-robots-tag', 'noindex');
  return new Response(obj.body, { headers });
});

/**
 * C-FOTO-VERIFICADA (29 oct 2026), como Uber: la selfie aprobada contra el documento es la foto de perfil
 * del repartidor. La ven él mismo, el cliente de un pedido que lleva y el equipo; nadie más.
 */
async function servirFoto(
  c: Parameters<typeof base>[0],
  usuarioId: string,
  /** C-FOTO-CONDUCTOR-SE-VE: a un cliente, solo la miniatura (la original es evidencia de identidad). */
  pieza: 'selfie' | 'selfie_miniatura' = 'selfie',
) {
  const f = await base(c)
    .prepare(`SELECT ${pieza} AS clave FROM kyc WHERE usuario_id = ? AND estado = 'aprobado'`)
    .bind(usuarioId)
    .first<{ clave: string | null }>();
  const obj = f?.clave ? await almacen(c.env).get(f.clave) : null;
  if (!obj) return c.text('No encontrado', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers });
}

kyc.get('/kyc/mi-foto', async (c) => servirFoto(c, exigir(c, 'repartidor').id));

kyc.get('/pedidos/:id/repartidor/foto', async (c) => {
  const u = exigir(c);
  const p = await base(c)
    .prepare(
      "SELECT cliente_id, repartidor_id FROM pedidos WHERE id = ? AND repartidor_id IS NOT NULL AND estado IN ('aceptado', 'listo', 'en_camino', 'entregado')",
    )
    .bind(c.req.param('id'))
    .first<{ cliente_id: string; repartidor_id: string }>();
  if (!p || (p.cliente_id !== u.id && u.rol !== 'admin')) return c.text('No encontrado', 404);
  return servirFoto(c, p.repartidor_id, 'selfie_miniatura');
});

/**
 * La foto verificada no se cambia desde la app. Si hace falta una nueva (cambió mucho, la foto quedó
 * mal), soporte la libera con motivo: la verificación vuelve a empezar y queda en el registro.
 */
/**
 * C-FOTO-CONDUCTOR-MINIATURA (14 nov 2026): al aprobar la verificación, el panel reduce la selfie a
 * una miniatura WebP de 200 px (en el navegador del equipo: un Worker no tiene con qué reducir) y la
 * guarda aquí. Es lo único que ve el pasajero en su viaje. Solo WebP, con su lado y peso máximos.
 */
kyc.post('/admin/kyc/:id/miniatura', async (c) => {
  exigir(c, 'admin');
  const id = c.req.param('id');
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  const regla = TAMANOS_FOTO.miniatura;
  const medidas = tipoReal(bytes) === 'image/webp' ? medidasWebp(bytes) : null;
  if (
    !medidas ||
    Math.max(medidas.ancho, medidas.alto) > regla.lado ||
    bytes.byteLength > regla.maxBytes
  )
    throw new ErrorDatos('Esa miniatura no cumple las medidas.', 'foto', 422);
  const db = base(c);
  const k = await db
    .prepare('SELECT estado FROM kyc WHERE usuario_id = ? AND selfie IS NOT NULL')
    .bind(id)
    .first<{ estado: string }>();
  if (k?.estado !== 'aprobado')
    throw new ErrorDatos('Primero aprueba la verificación.', undefined, 409);
  const clave = `kyc/${id}/selfie-s-${nuevoId()}.webp`;
  await guardarFoto(almacen(c.env), clave, bytes, 'image/webp', {
    cacheControl: 'private, no-store',
  });
  await db
    .prepare('UPDATE kyc SET selfie_miniatura = ? WHERE usuario_id = ?')
    .bind(clave, id)
    .run();
  // C-FOTO-ENTREGA-IPHONE: la referencia de la foto guardada; las apps viejas la exigían.
  return c.json({ ok: true, url: clave }, 201);
});

kyc.post('/admin/kyc/:id/liberar-foto', async (c) => {
  const admin = exigir(c, 'admin');
  const { motivo } = await leerCuerpo(
    c,
    z.object({ motivo: z.string().trim().min(5, { error: 'Escribe el motivo.' }).max(300) }),
  );
  const db = base(c);
  const id = c.req.param('id');
  const r = await db
    .prepare(
      "UPDATE kyc SET selfie = NULL, selfie_miniatura = NULL, estado = 'sin_enviar', motivo = ?, revisado_en = datetime('now'), revisado_por = ? WHERE usuario_id = ? AND selfie IS NOT NULL",
    )
    .bind(`Soporte pidió una foto nueva: ${motivo}`, admin.id, id)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa cuenta no tiene foto que liberar.', undefined, 404);
  await db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(admin.id, 'liberar_foto', `kyc:${id}`, null, JSON.stringify({ motivo }))
    .run();
  return c.json({ ok: true });
});

/**
 * G3: si la persona no alcanza la edad mínima de su estado y su vehículo, no se aprueba. Sin fecha de
 * nacimiento no se puede comprobar aquí: la revisa el equipo con el documento, como siempre.
 * Interruptor: config «edad_repartidor_por_estado» = '0' la apaga.
 */
async function datosEdad(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT u.fecha_nacimiento, ${ZONA_CONDUCTOR_SQL} AS zona_id,
              COALESCE(v.tipo, NULLIF(d.vehiculo_tipo, '')) AS vehiculo
         FROM usuarios u
         LEFT JOIN repartidores r ON r.usuario_id = u.id
         LEFT JOIN vehiculos v ON v.id = r.vehiculo_activo_id
         LEFT JOIN repartidor_datos d ON d.usuario_id = u.id
        WHERE u.id = ?`,
    )
    .bind(id)
    .first<{ fecha_nacimiento: string | null; zona_id: string; vehiculo: string | null }>();
}

/** G3: la edad mínima que se le pasa al motor de verificación (18 si el interruptor está apagado). */
async function edadMinimaDe(db: D1Database, id: string): Promise<number> {
  const apagada = await db
    .prepare("SELECT valor FROM config WHERE clave = 'edad_repartidor_por_estado'")
    .first<{ valor: string }>();
  const f = await datosEdad(db, id);
  if (apagada?.valor === '0' || !f) return 18;
  return edadDelReparto(db, f);
}

/** C-EDAD-POR-PAIS: la edad para repartir (Comida) de su país, la del equipo o la de por defecto. */
async function edadDelReparto(
  db: D1Database,
  f: { zona_id: string; vehiculo: string | null },
): Promise<number> {
  const z = await db
    .prepare('SELECT pais FROM zonas WHERE id = ?')
    .bind(f.zona_id)
    .first<{ pais: string }>();
  return edadMinimaPais(await edadesConfiguradas(db), {
    pais: (z?.pais ?? f.zona_id.slice(0, 2)).toUpperCase(),
    servicio: 'comida',
    zonaId: f.zona_id,
    vehiculo: f.vehiculo,
  });
}

async function exigirEdadRepartidor(db: D1Database, id: string, leida: string | null = null) {
  const apagada = await db
    .prepare("SELECT valor FROM config WHERE clave = 'edad_repartidor_por_estado'")
    .first<{ valor: string }>();
  if (apagada?.valor === '0') return;
  const f = await datosEdad(db, id);
  // C-NACIMIENTO-DEL-DOCUMENTO: sin fecha escrita, vale la leída en su documento (la que se guardará).
  const edad = edadEnAnios(f?.fecha_nacimiento || leida);
  if (edad == null || !f) return;
  const minima = await edadDelReparto(db, f);
  if (edad < minima)
    throw new ErrorDatos(
      `Esta persona tiene ${edad} años; para repartir en ${estadoEeuuDeZona(f.zona_id) ?? f.zona_id}${
        f.vehiculo ? ` en ${f.vehiculo}` : ''
      } hacen falta ${minima}.`,
      undefined,
      409,
    );
}

/**
 * C-NACIMIENTO-DEL-DOCUMENTO (Richard, 25 nov 2026): la fecha de nacimiento que la comprobación
 * automática leyó en sus documentos vigentes (la misma lectura de nombre, número y vencimiento).
 */
async function nacimientoLeidoDe(db: D1Database, id: string) {
  const { results } = await db
    .prepare(
      "SELECT paso, ia_json FROM verificacion_fotos WHERE conductor_id = ? AND estado = 'vigente' AND ia_json != '' ORDER BY creado_en DESC LIMIT 12",
    )
    .bind(id)
    .all<{ paso: string; ia_json: string }>();
  return nacimientoDeLecturas(
    results.map((r) => {
      try {
        return { paso: r.paso, lectura: JSON.parse(r.ia_json) as Record<string, unknown> };
      } catch {
        return { paso: r.paso, lectura: null };
      }
    }),
  );
}

/**
 * Al aprobar la identidad: si la cuenta no tiene fecha de nacimiento y la leída tiene la confianza en
 * verde, queda guardada (con quién y cuándo en la auditoría), y si cumple la edad de su país, el
 * requisito de la edad queda aprobado solo. Nunca pisa una fecha ya escrita. Devuelve lo que hizo.
 */
async function guardarNacimientoLeido(
  db: D1Database,
  id: string,
  adminId: string,
  leida: string,
): Promise<{ fecha: boolean; edad: boolean }> {
  const r = await db
    .prepare(
      "UPDATE usuarios SET fecha_nacimiento = ? WHERE id = ? AND (fecha_nacimiento IS NULL OR fecha_nacimiento = '')",
    )
    .bind(leida, id)
    .run();
  const fecha = Number(r.meta?.changes ?? 0) > 0;
  if (fecha)
    await db
      .prepare(
        'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        adminId,
        'conductor.fecha_nacimiento',
        `usuario:${id}`,
        JSON.stringify({ fecha_nacimiento: null }),
        JSON.stringify({ fecha_nacimiento: leida, fuente: 'documento_identidad' }),
      )
      .run();
  // C-EDAD-POR-PAIS: el requisito de edad lo pone al día el sistema con la fecha guardada.
  await sincronizarEdad(db, id);
  const e = await db
    .prepare(
      "SELECT 1 FROM cumplimientos WHERE conductor_id = ? AND vehiculo_id = '' AND requisito = ? AND estado = 'aprobado'",
    )
    .bind(id, REQUISITO_EDAD)
    .first();
  return { fecha, edad: Boolean(e) };
}

/** G3 y G4b: los dos interruptores de repartidores (config). La edad nace encendida; los papeles, apagados. */
kyc.get('/admin/interruptores-repartidor', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      "SELECT clave, valor FROM config WHERE clave IN ('edad_repartidor_por_estado', 'papeles_vehiculo_obligatorios')",
    )
    .all<{ clave: string; valor: string }>();
  const v = new Map(results.map((r) => [r.clave, r.valor]));
  return c.json({
    edadPorEstado: v.get('edad_repartidor_por_estado') !== '0',
    papelesVehiculo: v.get('papeles_vehiculo_obligatorios') === '1',
  });
});

kyc.put('/admin/interruptores-repartidor', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ edadPorEstado: z.boolean(), papelesVehiculo: z.boolean() }),
  );
  const db = base(c);
  await db.batch([
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES ('edad_repartidor_por_estado', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(d.edadPorEstado ? '1' : '0'),
    db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES ('papeles_vehiculo_obligatorios', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(d.papelesVehiculo ? '1' : '0'),
  ]);
  return c.json(d);
});

/**
 * C-TELEFONO-POR-PAIS (22 nov 2026): el código por SMS al registrarse, país por país. Muestra si el SMS
 * sale hoy, si la exigencia está encendida, el gasto del día contra el presupuesto y las últimas cuentas
 * que confirmaron (o que todavía no). El teléfono, solo con sus últimos cuatro números.
 */
const PAISES_CODIGO = [
  { pais: 'VE', prueba: '+584140000000' },
  { pais: 'US', prueba: '+13055550100' },
] as const;

kyc.get('/admin/telefono-codigo', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const apagados = await paisesApagados(db);
  const gasto = await gastoHoy(db);
  // C-CODIGO-CANALES: por qué canales sale hoy el código en cada país (WhatsApp primero).
  const paises = await Promise.all(
    PAISES_CODIGO.map(async ({ pais, prueba }) => {
      const canales = await canalesPara(c.env, db, prueba, gasto);
      return {
        pais,
        exigido: !apagados.has(pais),
        smsSale: canales.length > 0,
        canales,
      };
    }),
  );
  const conteo = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM envios_codigo_telefono WHERE creado_en >= datetime('now','-1 day')) AS codigos,
         (SELECT COUNT(*) FROM usuarios WHERE telefono_exigido_en IS NOT NULL AND telefono_verificado_en IS NULL) AS pendientes,
         (SELECT COUNT(*) FROM usuarios WHERE telefono_verificado_en >= datetime('now','-7 days')) AS verificadas`,
    )
    .first<{ codigos: number; pendientes: number; verificadas: number }>();
  const { results } = await db
    .prepare(
      `SELECT id, nombre, rol, telefono, telefono_exigido_en AS exigido, telefono_verificado_en AS verificado,
              (SELECT canal FROM codigos_telefono k WHERE k.usuario_id = usuarios.id) AS canal
         FROM usuarios
        WHERE telefono_exigido_en IS NOT NULL OR telefono_verificado_en >= datetime('now','-30 days')
        ORDER BY COALESCE(telefono_verificado_en, telefono_exigido_en) DESC LIMIT 50`,
    )
    .all<{
      id: string;
      nombre: string;
      rol: string;
      telefono: string | null;
      exigido: string | null;
      verificado: string | null;
      canal: string | null;
    }>();
  return c.json({
    paises,
    codigosHoy: Number(conteo?.codigos ?? 0),
    topeCodigos: topeCodigosDia(c.env),
    pendientes: Number(conteo?.pendientes ?? 0),
    verificadas7Dias: Number(conteo?.verificadas ?? 0),
    gasto: {
      smsHoy: gasto.sms,
      usdHoy: Math.round(gasto.smsUsd * 100) / 100,
      presupuestoUsd: presupuestoSmsDia(c.env),
      whatsappHoy: gasto.whatsapp,
      whatsappUsd: Math.round(gasto.whatsappUsd * 100) / 100,
      whatsappPresupuestoUsd: presupuestoWhatsappDia(c.env),
      whatsappEncendido: whatsappEncendido(c.env),
    },
    cuentas: results.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      rol: r.rol,
      ultimos:
        String(r.telefono ?? '')
          .replace(/\D/g, '')
          .slice(-4) || null,
      exigido: r.exigido,
      verificado: r.verificado,
      canal: r.canal,
    })),
  });
});

/**
 * C-TELEFONO-AL-REGISTRARSE: la salida de soporte. A quien de verdad no le llega el SMS (fijo, VoIP o una
 * operadora que no entrega), el equipo le confirma el celular a mano después de comprobarlo con la
 * persona (por ejemplo, por WhatsApp a ese mismo número). Queda en el registro de acciones del equipo.
 */
kyc.post('/admin/usuarios/:id/telefono/confirmar', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const f = await db
    .prepare('SELECT telefono_verificado_en AS v FROM usuarios WHERE id = ?')
    .bind(id)
    .first<{ v: string | null }>();
  if (!f) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  if (f.v) throw new ErrorDatos('Esa cuenta ya tiene su celular confirmado.', undefined, 409);
  await db
    .prepare("UPDATE usuarios SET telefono_verificado_en = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ ok: true });
});

kyc.put('/admin/telefono-codigo', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, z.object({ pais: z.enum(['VE', 'US']), exigido: z.boolean() }));
  const db = base(c);
  const apagados = await paisesApagados(db);
  if (d.exigido) apagados.delete(d.pais);
  else apagados.add(d.pais);
  await db
    .prepare(
      "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(CLAVE_PAISES, JSON.stringify(Object.fromEntries([...apagados].map((p) => [p, false]))))
    .run();
  return c.json({ ok: true, pais: d.pais, exigido: d.exigido });
});

const esquemaRevision = z.object({
  estado: z.enum(['aprobado', 'rechazado']),
  motivo: z.string().trim().max(500).default(''),
});

kyc.patch('/admin/kyc/:id', async (c) => {
  const admin = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaRevision);
  if (d.estado === 'rechazado' && !d.motivo)
    throw new ErrorDatos('Escribe el motivo: le llega a la persona para que lo corrija.', 'motivo');
  const db = base(c);
  const id = c.req.param('id');
  const u = await db
    .prepare('SELECT nombre, correo, idioma, rol FROM usuarios WHERE id = ?')
    .bind(id)
    .first<{ nombre: string; correo: string; idioma: 'es' | 'en'; rol: string }>();
  if (!u) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  // G3: edad mínima del repartidor por estado y vehículo (como DoorDash y Uber), con interruptor.
  // C-NACIMIENTO-DEL-DOCUMENTO: la fecha leída en su documento (solo con la confianza en verde).
  const leido =
    d.estado === 'aprobado' && u.rol === 'repartidor' ? await nacimientoLeidoDe(db, id) : null;
  const leida = nacimientoSeGuardaSolo(leido) ? leido.fecha : null;
  if (d.estado === 'aprobado' && u.rol === 'repartidor') await exigirEdadRepartidor(db, id, leida);
  // Los restaurantes se vuelven a verificar cada año (¿sigue el local ahí?).
  const proxima =
    d.estado === 'aprobado' && u.rol === 'restaurante'
      ? new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
      : null;
  // C-IDENTIDAD-CUMPLIMIENTO (13 nov 2026): la identidad aprobada cuenta como requisito cumplido para
  // los servicios que la piden (Moto, Envíos…). El disparador de la base vuelve a exigir la
  // verificación real (documento, selfie y revisión de una persona admin).
  // C-KYC-ATOMICO: la revisión y el requisito van en UN lote. Si el disparador rechaza el requisito,
  // la base deshace también la revisión: el KYC sigue pendiente, nunca «aprobado» a medias.
  const lote = [
    db
      .prepare(
        "UPDATE kyc SET estado = ?, motivo = ?, revisado_en = datetime('now'), revisado_por = ?, proxima_revision = ? WHERE usuario_id = ? AND estado = 'pendiente'",
      )
      .bind(d.estado, d.motivo, admin.id, proxima, id),
  ];
  if (u.rol === 'repartidor')
    lote.push(
      db
        .prepare(
          `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, fuente_id, vence_en, aprobado_por)
           SELECT ?, '', 'identidad', ?, 'kyc', 'kyc:' || ?, datetime('now', '+365 days'), ? WHERE changes() > 0
           ON CONFLICT(conductor_id, vehiculo_id, requisito) DO UPDATE SET estado = excluded.estado, fuente = excluded.fuente,
             fuente_id = excluded.fuente_id, vence_en = excluded.vence_en, aprobado_por = excluded.aprobado_por,
             actualizado_en = datetime('now')`,
        )
        .bind(id, d.estado === 'aprobado' ? 'aprobado' : 'rechazado', id, admin.id),
    );
  let r: D1Result[];
  try {
    r = await db.batch(lote);
  } catch (e) {
    if (!String((e as Error)?.message ?? e).includes('identidad_sin_verificacion')) throw e;
    console.error('kyc: la base rechazó el requisito de identidad; la revisión no se guardó', id);
    throw new ErrorDatos(
      'No se pudo aprobar: a esta verificación le faltan el documento o la selfie. Pídele a la persona que vuelva a tomar las fotos.',
      undefined,
      409,
    );
  }
  if (!r[0]?.meta.changes)
    throw new ErrorDatos('Esa verificación no está pendiente.', undefined, 409);
  const en = u.idioma === 'en';
  await enviarCorreo(c.env, {
    de: 'soporte',
    para: u.correo,
    asunto:
      d.estado === 'aprobado'
        ? en
          ? 'Your identity is verified'
          : 'Tu identidad quedó verificada'
        : en
          ? 'We need new photos to verify you'
          : 'Necesitamos fotos nuevas para verificarte',
    texto:
      d.estado === 'aprobado'
        ? en
          ? `Hi ${u.nombre},\n\nYour verification was approved. Welcome to Divoox!`
          : `Hola, ${u.nombre}.\n\nTu verificación quedó aprobada. ¡Bienvenido a Divoox!`
        : en
          ? `Hi ${u.nombre},\n\nWe couldn’t approve your verification: ${d.motivo}\n\nPlease take the photos again in the app.`
          : `Hola, ${u.nombre}.\n\nNo pudimos aprobar tu verificación: ${d.motivo}\n\nVuelve a tomar las fotos en la app.`,
  });
  // C-VERIFICACION-IA: la decisión de la persona queda al lado de lo que dijo la IA.
  if (u.rol === 'repartidor')
    await anotarDecisionHumana(c.env, db, {
      conductorId: id,
      papel: ['identidad', 'cara'],
      decision: d.estado,
      por: admin.id,
    });
  // C-NACIMIENTO-DEL-DOCUMENTO: la fecha leída queda guardada y la edad se aprueba sola si cuadra.
  const nacimiento =
    leida && u.rol === 'repartidor'
      ? await guardarNacimientoLeido(db, id, admin.id, leida)
      : { fecha: false, edad: false };
  // C-FECHA-GUARDADA: lo leído de su documento queda confirmado por quien aprobó la identidad.
  if (u.rol === 'repartidor' && d.estado === 'aprobado')
    await confirmarDatosLeidos(db, id, admin.id);
  // C-BARRA-ACTIVACION: si esta decisión lo dejó listo para recibir carreras, se le avisa (una vez).
  if (u.rol === 'repartidor' && d.estado === 'aprobado') await avisarSiQuedoActivo(c.env, db, id);
  return c.json({ ok: true, nacimiento });
});
