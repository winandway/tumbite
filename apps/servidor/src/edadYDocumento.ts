import {
  CONFIANZA_NACIMIENTO,
  confianzaDe,
  edadEnAnios,
  edadMinimaRepartidor,
  fechaNacimientoValida,
  nacimientoDeLecturas,
  perfilPasajeros,
} from '@tumbite/compartido';
import { ZONA_CONDUCTOR_SQL } from './cuentaPais';
import { guardarError } from './errores';

/**
 * C-EDAD-POR-PAIS y C-FECHA-GUARDADA (Richard, 25 nov 2026: a un conductor de Venezuela nacido en 1974
 * «Habilitar para Moto» le decía «Le falta: Tener 21 años o más») — todos los países.
 *
 * Cómo funciona:
 * 1. La edad mínima va POR PAÍS y POR SERVICIO. Sale de la configuración del equipo
 *    (`config.edad_minima_por_pais`, editable en Sistema y configuración → Países y servicios) y, si el
 *    equipo no la cambió, de un valor por defecto del país: Moto y Carro, el del perfil de pasajeros del
 *    país (Venezuela 18; EE. UU. y Perú 21, como hoy); el reparto (Comida, Envíos…), la regla de siempre
 *    del reparto (18; en EE. UU. 19 en Florida, Texas, moto o carro y 21 en California).
 * 2. La edad se calcula SIEMPRE de la fecha guardada en la cuenta (`usuarios.fecha_nacimiento`). Lo
 *    que la IA lee del documento (nombre, número, vencimiento, fecha de nacimiento y sus confianzas)
 *    queda en `datos_documento` al momento de leerlo, como «propuesta»; con la confianza de la fecha en
 *    verde, la fecha pasa a la cuenta si no tenía. Al aprobar la identidad queda «confirmado».
 * 3. El requisito de edad (`edad_minima_21`, nombre viejo de la tabla) lo lleva el SISTEMA: con la fecha
 *    guardada y la edad del servicio cumplida queda aprobado solo (fuente «sistema»). La regla de cada
 *    servicio se mira en el código (lista de lo que falta y «Habilitar»); el disparador de la base solo
 *    ve que el requisito existe.
 */
export const REQUISITO_EDAD = 'edad_minima_21';
export const CLAVE_EDADES = 'edad_minima_por_pais';
/** Los servicios a los que se les puede fijar una edad en el panel. */
export const SERVICIOS_CON_EDAD = ['moto', 'carro', 'comida', 'envios'] as const;
export const PAISES_CON_EDAD = ['US', 'VE', 'PE', 'CO'] as const;
export const EDAD_MINIMA_PERMITIDA = 16;
export const EDAD_MAXIMA_PERMITIDA = 30;

type Db = D1Database;
export type EdadesPais = Record<string, Record<string, number>>;

/** La edad por defecto de un servicio en un país (sin configuración del equipo). Pura. */
export function edadPorDefecto(d: {
  pais: string;
  servicio: string;
  zonaId?: string | null;
  vehiculo?: string | null;
}): number {
  if (d.servicio === 'moto' || d.servicio === 'carro') return perfilPasajeros(d.pais).edadMinima;
  return edadMinimaRepartidor({
    zonaId: d.zonaId ?? `${d.pais}-`,
    vehiculo: d.vehiculo ?? null,
  });
}

/** Lo que el equipo fijó (solo números sensatos; lo demás se ignora). */
export function leerEdadesConfig(valor: string | null | undefined): EdadesPais {
  try {
    const crudo = JSON.parse(valor ?? '{}') as unknown;
    if (!crudo || typeof crudo !== 'object') return {};
    const paises: [string, Record<string, number>][] = [];
    for (const [pais, servicios] of Object.entries(crudo as Record<string, unknown>)) {
      if (!/^[A-Z]{2}$/.test(pais) || !servicios || typeof servicios !== 'object') continue;
      const fila = Object.entries(servicios as Record<string, unknown>).filter(
        (x): x is [string, number] =>
          /^[a-z_]{2,20}$/.test(x[0]) &&
          typeof x[1] === 'number' &&
          Number.isInteger(x[1]) &&
          x[1] >= EDAD_MINIMA_PERMITIDA &&
          x[1] <= EDAD_MAXIMA_PERMITIDA,
      );
      paises.push([pais, Object.fromEntries(fila)]);
    }
    return Object.fromEntries(paises);
  } catch {
    return {};
  }
}

export async function edadesConfiguradas(db: Db): Promise<EdadesPais> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_EDADES)
    .first<{ valor: string }>();
  return leerEdadesConfig(f?.valor);
}

/** La edad mínima de un servicio en un país: la del equipo o la de por defecto. Pura. */
export function edadMinimaDe(
  config: EdadesPais,
  d: { pais: string; servicio: string; zonaId?: string | null; vehiculo?: string | null },
): number {
  const fija = new Map(Object.entries(new Map(Object.entries(config)).get(d.pais) ?? {})).get(
    d.servicio,
  );
  return fija ?? edadPorDefecto(d);
}

/** Lo que el panel enseña: cada país con la edad de cada servicio y si la fijó el equipo. */
export function tablaEdades(config: EdadesPais) {
  return PAISES_CON_EDAD.map((pais) => ({
    pais,
    servicios: SERVICIOS_CON_EDAD.map((servicio) => {
      const fija = new Map(Object.entries(new Map(Object.entries(config)).get(pais) ?? {})).get(
        servicio,
      );
      return {
        servicio,
        edad: fija ?? edadPorDefecto({ pais, servicio }),
        porDefecto: edadPorDefecto({ pais, servicio }),
        fijada: fija !== undefined,
      };
    }),
  }));
}

type Persona = {
  fecha: string | null;
  pais: string;
  zonaId: string;
  vehiculo: string | null;
  /** Sin fecha, la edad que ya aprobó una persona antes de este cambio se respeta (nunca se pierde). */
  edadAprobada: boolean;
};

async function persona(db: Db, id: string): Promise<Persona | null> {
  const f = await db
    .prepare(
      `SELECT u.fecha_nacimiento AS fecha, z.pais, z.id AS zona_id,
              (SELECT v.tipo FROM vehiculos v WHERE v.id = r.vehiculo_activo_id) AS vehiculo,
              EXISTS (SELECT 1 FROM cumplimientos c WHERE c.conductor_id = u.id AND c.vehiculo_id = ''
                        AND c.requisito = '${REQUISITO_EDAD}' AND c.estado = 'aprobado'
                        AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))) AS aprobada
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
         LEFT JOIN zonas z ON z.id = ${ZONA_CONDUCTOR_SQL}
        WHERE u.id = ?`,
    )
    .bind(id)
    .first<{
      fecha: string | null;
      pais: string | null;
      zona_id: string | null;
      vehiculo: string | null;
      aprobada: number;
    }>();
  if (!f) return null;
  return {
    fecha: f.fecha || null,
    pais: (f.pais ?? 'US').toUpperCase(),
    zonaId: f.zona_id ?? 'US-FL-MIAMI',
    vehiculo: f.vehiculo,
    edadAprobada: Number(f.aprobada) === 1,
  };
}

export type EdadServicio = {
  servicio: string;
  minima: number;
  edad: number | null;
  /** «sin_fecha», «menor» o null si la cumple. */
  falta: 'sin_fecha' | 'menor' | null;
};

/** Para cada servicio: la edad mínima y si la persona la cumple con la fecha guardada. */
export async function edadPorServicio(
  db: Db,
  conductorId: string,
  servicios: readonly string[],
  config?: EdadesPais,
): Promise<Map<string, EdadServicio>> {
  const p = await persona(db, conductorId);
  const cfg = config ?? (await edadesConfiguradas(db));
  const edad = edadEnAnios(p?.fecha ?? null);
  return new Map(
    servicios.map((servicio) => {
      const minima = edadMinimaDe(cfg, {
        pais: p?.pais ?? 'US',
        servicio,
        zonaId: p?.zonaId,
        vehiculo: p?.vehiculo,
      });
      return [
        servicio,
        {
          servicio,
          minima,
          edad,
          // Sin fecha: falta, salvo que una persona ya la hubiera aprobado antes (se respeta).
          falta:
            edad == null ? (p?.edadAprobada ? null : 'sin_fecha') : edad < minima ? 'menor' : null,
        },
      ];
    }),
  );
}

/** Los servicios que piden la edad (tabla de requisitos de cada servicio). */
export async function serviciosQuePidenEdad(db: Db): Promise<string[]> {
  const { results } = await db
    .prepare(
      'SELECT servicio_id AS s FROM servicio_requisitos WHERE requisito = ? AND obligatorio = 1',
    )
    .bind(REQUISITO_EDAD)
    .all<{ s: string }>();
  return results.map((r) => r.s);
}

/**
 * El requisito de edad lo lleva el sistema: con la fecha guardada y la edad de al menos un servicio
 * que la pide cumplida, queda aprobado (fuente «sistema»); la regla de CADA servicio la vuelve a mirar
 * el código antes de habilitar. Si la fecha dice que no llega a ninguno, el que puso el sistema se
 * revoca. No escribe si ya está al día. Devuelve si escribió.
 */
export async function sincronizarEdad(db: Db, conductorId: string): Promise<boolean> {
  const servicios = await serviciosQuePidenEdad(db);
  if (!servicios.length) return false;
  const porServicio = await edadPorServicio(db, conductorId, servicios);
  const cumpleAlguno = [...porServicio.values()].some((x) => x.falta === null);
  const sinFecha = [...porServicio.values()].every((x) => x.falta === 'sin_fecha');
  const actual = await db
    .prepare(
      "SELECT estado, fuente FROM cumplimientos WHERE conductor_id = ? AND vehiculo_id = '' AND requisito = ?",
    )
    .bind(conductorId, REQUISITO_EDAD)
    .first<{ estado: string; fuente: string }>();
  if (cumpleAlguno) {
    if (actual?.estado === 'aprobado') return false;
    await db
      .prepare(
        `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, fuente_id)
         VALUES (?, '', ?, 'aprobado', 'sistema', 'fecha_nacimiento')
         ON CONFLICT(conductor_id, vehiculo_id, requisito) DO UPDATE SET estado = 'aprobado',
           fuente = 'sistema', fuente_id = 'fecha_nacimiento', aprobado_por = NULL, actualizado_en = datetime('now')`,
      )
      .bind(conductorId, REQUISITO_EDAD)
      .run();
    return true;
  }
  // Con la fecha guardada y menor que todas: lo que puso el sistema se revoca (lo de una persona, no).
  if (!sinFecha && actual?.estado === 'aprobado' && actual.fuente === 'sistema') {
    await db
      .prepare(
        "UPDATE cumplimientos SET estado = 'revocado', actualizado_en = datetime('now') WHERE conductor_id = ? AND vehiculo_id = '' AND requisito = ?",
      )
      .bind(conductorId, REQUISITO_EDAD)
      .run();
    return true;
  }
  return false;
}

// ───────────────────────── Lo leído del documento ─────────────────────────

const PASOS_DOCUMENTO = ['doc_frente', 'doc_reverso'] as const;
const PASOS_LICENCIA = ['licencia_frente', 'licencia_reverso'] as const;

export type DatosLeidos = {
  nombre: string;
  numero: string;
  vence: string;
  nacimiento: string;
  confianzaNacimiento: number | null;
  confianza: number | null;
  licenciaNumero: string;
};

type Lectura = { paso: string; lectura: Record<string, unknown> | null };

const texto = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const numero = confianzaDe;

/** Lo que dicen las lecturas de sus fotos vigentes, en un solo registro. Pura. */
export function datosDeLecturas(
  lecturas: readonly Lectura[],
  hoy = new Date(),
): DatosLeidos | null {
  const de = (pasos: readonly string[]) =>
    pasos.flatMap((p) => lecturas.filter((l) => l.paso === p && l.lectura));
  const doc = de(PASOS_DOCUMENTO);
  const lic = de(PASOS_LICENCIA);
  if (!doc.length && !lic.length) return null;
  const primero = (ls: Lectura[], campo: string, max: number) =>
    ls.map((l) => texto(new Map(Object.entries(l.lectura ?? {})).get(campo), max)).find(Boolean) ??
    '';
  const nac = nacimientoDeLecturas(lecturas, hoy);
  const base = doc[0]?.lectura ?? lic[0]?.lectura ?? null;
  return {
    nombre: primero(doc, 'nombre', 120) || primero(lic, 'nombre', 120),
    numero: primero(doc, 'numero', 40),
    vence: primero(doc, 'vence', 12),
    nacimiento: nac?.fecha ?? '',
    confianzaNacimiento: nac ? nac.confianza : null,
    confianza: numero(base?.confianza),
    licenciaNumero: primero(lic, 'numero', 40),
  };
}

async function lecturasDe(db: Db, id: string): Promise<Lectura[]> {
  const { results } = await db
    .prepare(
      "SELECT paso, ia_json FROM verificacion_fotos WHERE conductor_id = ? AND estado = 'vigente' AND ia_json != '' ORDER BY creado_en DESC LIMIT 12",
    )
    .bind(id)
    .all<{ paso: string; ia_json: string }>();
  return results.map((r) => {
    try {
      return { paso: r.paso, lectura: JSON.parse(r.ia_json) as Record<string, unknown> };
    } catch {
      return { paso: r.paso, lectura: null };
    }
  });
}

const igual = (
  a: DatosLeidos,
  b: {
    nombre: string;
    numero: string;
    vence: string;
    nacimiento: string;
    confianza_nacimiento: number | null;
    confianza: number | null;
    licencia_numero: string;
  },
) =>
  a.nombre === b.nombre &&
  a.numero === b.numero &&
  a.vence === b.vence &&
  a.nacimiento === b.nacimiento &&
  a.confianzaNacimiento === b.confianza_nacimiento &&
  a.confianza === b.confianza &&
  a.licenciaNumero === b.licencia_numero;

/**
 * Guarda en la cuenta lo leído de sus documentos (como propuesta), pasa la fecha de nacimiento a la
 * cuenta si no tenía y su confianza está en verde, y pone al día el requisito de edad. No escribe nada
 * si ya está al día. Lo llama cada lectura de la IA, la aprobación de la identidad y el relleno.
 */
export async function guardarDatosLeidos(
  db: Db,
  id: string,
): Promise<{ escribio: boolean; fecha: boolean; leidos: boolean }> {
  const datos = datosDeLecturas(await lecturasDe(db, id));
  if (!datos) return { escribio: false, fecha: false, leidos: false };
  const antes = await db
    .prepare('SELECT * FROM datos_documento WHERE usuario_id = ?')
    .bind(id)
    .first<{
      nombre: string;
      numero: string;
      vence: string;
      nacimiento: string;
      confianza_nacimiento: number | null;
      confianza: number | null;
      licencia_numero: string;
    }>();
  let escribio = false;
  if (!antes || !igual(datos, antes)) {
    await db
      .prepare(
        `INSERT INTO datos_documento (usuario_id, nombre, numero, vence, nacimiento, confianza_nacimiento, confianza, licencia_numero)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(usuario_id) DO UPDATE SET nombre = excluded.nombre, numero = excluded.numero,
           vence = excluded.vence, nacimiento = excluded.nacimiento,
           confianza_nacimiento = excluded.confianza_nacimiento, confianza = excluded.confianza,
           licencia_numero = excluded.licencia_numero, actualizado_en = datetime('now')`,
      )
      .bind(
        id,
        datos.nombre,
        datos.numero,
        datos.vence,
        datos.nacimiento,
        datos.confianzaNacimiento,
        datos.confianza,
        datos.licenciaNumero,
      )
      .run();
    escribio = true;
  }
  let fecha = false;
  if (
    fechaNacimientoValida(datos.nacimiento) &&
    (datos.confianzaNacimiento ?? 0) >= CONFIANZA_NACIMIENTO
  ) {
    const r = await db
      .prepare(
        "UPDATE usuarios SET fecha_nacimiento = ? WHERE id = ? AND (fecha_nacimiento IS NULL OR fecha_nacimiento = '')",
      )
      .bind(datos.nacimiento, id)
      .run();
    fecha = Number(r.meta?.changes ?? 0) > 0;
    // Queda en el registro, a nombre de la persona dueña del documento (lo leyó el sistema).
    if (fecha)
      await db
        .prepare(
          'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          'sistema.fecha_nacimiento_leida',
          `usuario:${id}`,
          JSON.stringify({ fecha_nacimiento: null }),
          JSON.stringify({
            fecha_nacimiento: datos.nacimiento,
            confianza: datos.confianzaNacimiento,
            fuente: 'documento_identidad',
          }),
        )
        .run();
  }
  const edad = await sincronizarEdad(db, id);
  return { escribio: escribio || fecha || edad, fecha, leidos: true };
}

/** Al aprobar la identidad: lo leído queda confirmado por esa persona del equipo. */
export async function confirmarDatosLeidos(db: Db, id: string, adminId: string) {
  await guardarDatosLeidos(db, id);
  await db
    .prepare(
      "UPDATE datos_documento SET estado = 'confirmado', confirmado_por = ?, confirmado_en = datetime('now') WHERE usuario_id = ? AND estado != 'confirmado'",
    )
    .bind(adminId, id)
    .run();
}

// ───────────────────────── Relleno de los que ya existen ─────────────────────────

/** Cuántas cuentas mira una vuelta y cuántas cédulas vuelve a leer (con IA) como mucho. */
export const VENTANA_RELLENO = 100;
export const TOPE_RELEER_POR_VUELTA = 3;
export const CLAVE_CURSOR_RELLENO = 'relleno_documento_cursor';
/** C-CONFIANZA-LEIDA: la segunda pasada, una sola vez, para las fechas leídas sin su confianza. */
export const CLAVE_CURSOR_CONFIANZA = 'relleno_confianza_cursor';

export type CedulaPorLeer = {
  conductorId: string;
  /** La fila de la foto ya guardada, o null si solo está en la verificación vieja (`kyc`). */
  fotoId: string | null;
  clave: string;
};

type FilaRelleno = {
  rid: number;
  id: string;
  rol: string;
  fecha: string | null;
  conDatos: number;
  edadAlDia: number;
  conLectura: number;
  fotoId: string | null;
  claveFoto: string | null;
  conFecha: number | null;
  claveKyc: string | null;
};

/**
 * C-FECHA-GUARDADA, relleno de los conductores que ya existían, en cada vuelta del reloj. Recorre las
 * cuentas UNA sola vez, por tramos de `VENTANA_RELLENO`, con un cursor guardado en `config`, y al
 * llegar al final se apaga solo («fin»: desde ahí cada vuelta lee una fila y no escribe nada). Lo
 * nuevo ya entra por la subida de cada foto, la aprobación y la fecha a mano. A cada conductor:
 *   1. si tiene lecturas guardadas y no su fila de `datos_documento`, las pasa a su cuenta SIN IA; una
 *      lectura ilegible deja su fila vacía (vista) y UNA línea en el registro de errores;
 *   2. si tiene fecha y el requisito de edad sin poner al día, lo pone al día (si no cumple ningún
 *      servicio no escribe nada: el cursor ya lo dejó atrás);
 *   3. solo si sigue sin fecha y su cédula nunca se leyó con la fecha, la vuelve a leer con `releer`
 *      (el modelo barato, con su permiso y el presupuesto diario), como mucho
 *      `TOPE_RELEER_POR_VUELTA` por vuelta: con el tope lleno, el cursor se queda ahí para la próxima.
 */
export async function rellenarDatosDocumento(
  db: Db,
  releer: (c: CedulaPorLeer) => Promise<boolean>,
): Promise<{ sinIa: number; releidas: number; fin: boolean }> {
  const cursor = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_CURSOR_RELLENO)
    .first<{ valor: string }>();
  if (cursor?.valor === 'fin') return releerSinConfianza(db, releer);
  const desde = Number(cursor?.valor ?? 0) || 0;
  const vigente = (campo: string) =>
    `(SELECT ${campo} FROM verificacion_fotos f WHERE f.conductor_id = u.id
        AND f.paso = 'doc_frente' AND f.estado = 'vigente' LIMIT 1)`;
  const { results: tramo } = await db
    .prepare(
      `SELECT u.rowid AS rid, u.id, u.rol, u.fecha_nacimiento AS fecha,
              EXISTS (SELECT 1 FROM datos_documento d WHERE d.usuario_id = u.id) AS conDatos,
              EXISTS (SELECT 1 FROM cumplimientos c WHERE c.conductor_id = u.id AND c.vehiculo_id = ''
                        AND c.requisito = '${REQUISITO_EDAD}' AND c.estado IN ('aprobado', 'revocado')) AS edadAlDia,
              EXISTS (SELECT 1 FROM verificacion_fotos f WHERE f.conductor_id = u.id AND f.estado = 'vigente'
                        AND f.ia_json != '' AND f.paso IN ('doc_frente', 'doc_reverso', 'licencia_frente')) AS conLectura,
              ${vigente('f.id')} AS fotoId, ${vigente('f.clave')} AS claveFoto,
              ${vigente(`instr(f.ia_json, '"nacimiento"')`)} AS conFecha,
              (SELECT k.doc_frente FROM kyc k WHERE k.usuario_id = u.id) AS claveKyc
         FROM usuarios u WHERE u.rowid > ? ORDER BY u.rowid LIMIT ?`,
    )
    .bind(desde, VENTANA_RELLENO)
    .all<FilaRelleno>();
  let sinIa = 0;
  let releidas = 0;
  let hasta = tramo.at(-1)?.rid ?? desde;
  let lleno = false;
  for (const f of tramo) {
    if (f.rol !== 'repartidor') continue;
    let fecha = f.fecha || null;
    if (Number(f.conLectura) && !Number(f.conDatos)) {
      const r = await guardarDatosLeidos(db, f.id);
      if (r.escribio) sinIa++;
      if (r.fecha) fecha = 'guardada';
      if (!r.leidos) {
        // Ilegible: queda vista (fila vacía) y el fallo, una sola vez, en el registro de errores.
        await db
          .prepare('INSERT OR IGNORE INTO datos_documento (usuario_id) VALUES (?)')
          .bind(f.id)
          .run();
        await guardarError(
          db,
          'RELOJ',
          '/reloj/datos_documento',
          new Error('relleno: la lectura guardada de su documento no se puede leer'),
          f.id,
        ).catch((e: unknown) => console.error('relleno: no se pudo anotar el error', e));
        sinIa++;
      }
    } else if (fecha && !Number(f.edadAlDia)) {
      if (await sincronizarEdad(db, f.id)) sinIa++;
    }
    if (fecha) continue;
    const porLeer: CedulaPorLeer | null =
      f.fotoId && f.claveFoto && !Number(f.conFecha)
        ? { conductorId: f.id, fotoId: f.fotoId, clave: f.claveFoto }
        : !f.fotoId && f.claveKyc
          ? { conductorId: f.id, fotoId: null, clave: f.claveKyc }
          : null;
    if (!porLeer) continue;
    if (releidas >= TOPE_RELEER_POR_VUELTA) {
      hasta = f.rid - 1;
      lleno = true;
      break;
    }
    await db
      .prepare(
        `INSERT INTO datos_documento (usuario_id, releida_en) VALUES (?, datetime('now'))
         ON CONFLICT(usuario_id) DO UPDATE SET releida_en = datetime('now')`,
      )
      .bind(f.id)
      .run();
    if (await releer(porLeer)) await guardarDatosLeidos(db, f.id);
    releidas++;
  }
  const fin = !lleno && tramo.length < VENTANA_RELLENO;
  const valor = fin ? 'fin' : String(hasta);
  if (valor !== cursor?.valor)
    await db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(CLAVE_CURSOR_RELLENO, valor)
      .run();
  // C-CONFIANZA-LEIDA: «fin» solo con las dos pasadas. Si la primera terminó en esta vuelta y queda tope,
  // la segunda arranca ya (así una base sin nada que hacer deja su estado en una sola vuelta).
  if (!fin || releidas >= TOPE_RELEER_POR_VUELTA) return { sinIa, releidas, fin: false };
  const segunda = await releerSinConfianza(db, releer, TOPE_RELEER_POR_VUELTA - releidas);
  return { sinIa, releidas: releidas + segunda.releidas, fin: segunda.fin };
}

/**
 * C-CONFIANZA-LEIDA (25 nov 2026, producción): la primera relectura guardó la fecha de nacimiento sin su
 * confianza (el modelo no la mandaba: no era obligatoria en el JSON), así que nunca pasó sola a la
 * cuenta. Cuando la primera pasada ya terminó, una SEGUNDA pasada, una sola vez y con su propio cursor,
 * vuelve a leer la cédula de quien sigue sin fecha y tiene la fecha leída sin confianza útil (ninguna,
 * o 0), con el mismo tope de 3 por vuelta. Al terminar se apaga («fin»): nadie se relee dos veces más.
 */
async function releerSinConfianza(
  db: Db,
  releer: (c: CedulaPorLeer) => Promise<boolean>,
  tope = TOPE_RELEER_POR_VUELTA,
): Promise<{ sinIa: number; releidas: number; fin: boolean }> {
  const cursor = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_CURSOR_CONFIANZA)
    .first<{ valor: string }>();
  if (cursor?.valor === 'fin') return { sinIa: 0, releidas: 0, fin: true };
  const desde = Number(cursor?.valor ?? 0) || 0;
  const vigente = (campo: string) =>
    `(SELECT ${campo} FROM verificacion_fotos f WHERE f.conductor_id = u.id
        AND f.paso = 'doc_frente' AND f.estado = 'vigente' LIMIT 1)`;
  const { results: tramo } = await db
    .prepare(
      `SELECT u.rowid AS rid, u.id, u.rol, u.fecha_nacimiento AS fecha,
              d.nacimiento, d.confianza_nacimiento AS confianzaNacimiento,
              ${vigente('f.id')} AS fotoId, ${vigente('f.clave')} AS claveFoto,
              (SELECT k.doc_frente FROM kyc k WHERE k.usuario_id = u.id) AS claveKyc
         FROM usuarios u LEFT JOIN datos_documento d ON d.usuario_id = u.id
        WHERE u.rowid > ? ORDER BY u.rowid LIMIT ?`,
    )
    .bind(desde, VENTANA_RELLENO)
    .all<{
      rid: number;
      id: string;
      rol: string;
      fecha: string | null;
      nacimiento: string | null;
      confianzaNacimiento: number | null;
      fotoId: string | null;
      claveFoto: string | null;
      claveKyc: string | null;
    }>();
  let releidas = 0;
  let hasta = tramo.at(-1)?.rid ?? desde;
  let lleno = false;
  for (const f of tramo) {
    const sinConfianza =
      f.rol === 'repartidor' &&
      !f.fecha &&
      Boolean(f.nacimiento) &&
      !(Number(f.confianzaNacimiento) > 0);
    if (!sinConfianza) continue;
    const porLeer: CedulaPorLeer | null =
      f.fotoId && f.claveFoto
        ? { conductorId: f.id, fotoId: f.fotoId, clave: f.claveFoto }
        : f.claveKyc
          ? { conductorId: f.id, fotoId: null, clave: f.claveKyc }
          : null;
    if (!porLeer) continue;
    if (releidas >= tope) {
      hasta = f.rid - 1;
      lleno = true;
      break;
    }
    await db
      .prepare("UPDATE datos_documento SET releida_en = datetime('now') WHERE usuario_id = ?")
      .bind(f.id)
      .run();
    if (await releer(porLeer)) await guardarDatosLeidos(db, f.id);
    releidas++;
  }
  const fin = !lleno && tramo.length < VENTANA_RELLENO;
  const valor = fin ? 'fin' : String(hasta);
  if (valor !== cursor?.valor)
    await db
      .prepare(
        "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
      )
      .bind(CLAVE_CURSOR_CONFIANZA, valor)
      .run();
  return { sinIa: 0, releidas, fin };
}
