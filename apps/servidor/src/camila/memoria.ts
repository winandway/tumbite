import { correoCanonico } from '@tumbite/compartido';
import { nuevoId } from '../cripto';
import { TOPE_DIARIO_CENTAVOS, TOPE_MAXIMO_CENTAVOS } from './modelo';
import type { IdiomaCamila } from './identidad';

/**
 * C-CAMILA-MEMORIA (17 nov 2026) — todos los países. UNA persona, UNA memoria, venga por donde venga.
 *
 * La persona se encuentra por (en este orden) su cuenta de Divoox, su correo verificado, su teléfono
 * verificado o, en el chat de la web sin cuenta, la ficha anónima del navegador. Cuando el chat
 * anónimo verifica su correo con el código, las dos fichas se UNEN (los mensajes pasan a la del
 * correo). El historial vive en la base; al modelo solo le llegan los últimos mensajes y un resumen.
 *
 * Presupuesto de filas por mensaje (C-CAMILA-PRESUPUESTO): leer la persona, sus últimos
 * HISTORIAL_AL_MODELO mensajes y lo aprobado; escribir el mensaje, la respuesta, la persona y el
 * gasto. La prueba lo mide.
 */
export const HISTORIAL_AL_MODELO = 12;
export const PRESUPUESTO_MENSAJE = { leidas: 400, escritas: 16 } as const;

export type Canal = 'web' | 'app' | 'correo' | 'sms' | 'whatsapp';
export type Persona = {
  id: string;
  usuario_id: string | null;
  correo: string | null;
  telefono: string | null;
  nombre: string;
  idioma: IdiomaCamila;
  pais: string;
  zona_id: string | null;
  resumen: string;
  canal_ultimo: Canal;
  mensajes: number;
  humano_hasta: string | null;
  humano_id: string | null;
  aviso_ia_dado: number;
  /** C-PERMISO-IA-CHAT: null = no ha contestado; 1 = dio su permiso; 0 = dijo que no. */
  permiso_ia?: number | null;
  /** El contacto que la persona DIJO en el chat para que le avisen (sin verificar). */
  contacto_correo: string | null;
  contacto_telefono: string | null;
};

const COLUMNAS =
  'id, usuario_id, correo, telefono, nombre, idioma, pais, zona_id, resumen, canal_ultimo, mensajes, humano_hasta, humano_id, aviso_ia_dado, contacto_correo, contacto_telefono, ' +
  // C-AVISO-IA-UNICO: el conductor contesta el aviso de IA una vez (fotos y chat). Si su persona del
  // chat todavía no tiene respuesta propia, vale la del aviso.
  'COALESCE(permiso_ia, (SELECT v.acepto FROM verificacion_permiso_ia v WHERE v.conductor_id = camila_personas.usuario_id)) AS permiso_ia';

export async function personaPorId(db: D1Database, id: string) {
  return db
    .prepare(`SELECT ${COLUMNAS} FROM camila_personas WHERE id = ?`)
    .bind(id)
    .first<Persona>();
}

async function crear(db: D1Database, campos: Partial<Persona> & { visitante_hash?: string }) {
  const id = nuevoId();
  await db
    .prepare(
      `INSERT INTO camila_personas (id, usuario_id, correo, telefono, visitante_hash, nombre, idioma, pais, zona_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      campos.usuario_id ?? null,
      campos.correo ?? null,
      campos.telefono ?? null,
      campos.visitante_hash ?? null,
      campos.nombre ?? '',
      campos.idioma ?? 'es',
      campos.pais ?? '',
      campos.zona_id ?? null,
    )
    .run();
  return (await personaPorId(db, id)) as Persona;
}

/** La persona de una cuenta de Divoox (y, si ya escribía por correo, se le une esa ficha). */
export async function personaDeUsuario(db: D1Database, usuarioId: string) {
  const ya = await db
    .prepare(`SELECT ${COLUMNAS} FROM camila_personas WHERE usuario_id = ?`)
    .bind(usuarioId)
    .first<Persona>();
  if (ya) return ya;
  const u = await db
    .prepare(
      `SELECT u.nombre, u.correo, u.idioma, u.telefono_canonico, u.correo_confirmado_en, z.pais, z.id AS zona_id
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
         LEFT JOIN zonas z ON z.id = COALESCE(r.zona_id, u.zona_id) WHERE u.id = ?`,
    )
    .bind(usuarioId)
    .first<{
      nombre: string;
      correo: string;
      idioma: string;
      telefono_canonico: string | null;
      correo_confirmado_en: string | null;
      pais: string | null;
      zona_id: string | null;
    }>();
  if (!u) throw new Error('Camila: la cuenta no existe.');
  const correo = correoCanonico(u.correo);
  // Ya escribía por correo (antes de entrar con su cuenta): esa ficha pasa a ser la de su cuenta.
  const porCorreo = await db
    .prepare(`SELECT ${COLUMNAS} FROM camila_personas WHERE correo = ? AND usuario_id IS NULL`)
    .bind(correo)
    .first<Persona>();
  if (porCorreo) {
    await db
      .prepare(
        "UPDATE camila_personas SET usuario_id = ?, nombre = ?, actualizado_en = datetime('now') WHERE id = ?",
      )
      .bind(usuarioId, u.nombre, porCorreo.id)
      .run();
    return { ...porCorreo, usuario_id: usuarioId, nombre: u.nombre };
  }
  const tieneCorreo = await db
    .prepare('SELECT 1 FROM camila_personas WHERE correo = ?')
    .bind(correo)
    .first();
  return crear(db, {
    usuario_id: usuarioId,
    correo: tieneCorreo ? null : correo,
    nombre: u.nombre,
    idioma: u.idioma === 'en' ? 'en' : 'es',
    pais: u.pais ?? '',
    zona_id: u.zona_id,
  });
}

/** La persona de un correo entrante (el correo que llega por el buzón ya viene de su dueño). */
export async function personaDeCorreo(db: D1Database, correoCrudo: string, nombre = '') {
  const correo = correoCanonico(correoCrudo);
  const ya = await db
    .prepare(`SELECT ${COLUMNAS} FROM camila_personas WHERE correo = ?`)
    .bind(correo)
    .first<Persona>();
  if (ya) return ya;
  // Una cuenta de Divoox con ese correo: es esa persona.
  const u = await db
    .prepare('SELECT id FROM usuarios WHERE correo = ? OR correo_canonico = ? LIMIT 1')
    .bind(correoCrudo, correo)
    .first<{ id: string }>();
  if (u) {
    const p = await personaDeUsuario(db, u.id);
    if (!p.correo) {
      await db
        .prepare('UPDATE camila_personas SET correo = ? WHERE id = ?')
        .bind(correo, p.id)
        .run();
      return { ...p, correo };
    }
    return p;
  }
  return crear(db, { correo, nombre: nombre.slice(0, 80) });
}

/** La persona de un teléfono verificado (SMS y WhatsApp, cuando se enciendan). */
export async function personaDeTelefono(db: D1Database, telefono: string) {
  const ya = await db
    .prepare(`SELECT ${COLUMNAS} FROM camila_personas WHERE telefono = ?`)
    .bind(telefono)
    .first<Persona>();
  if (ya) return ya;
  const u = await db
    .prepare("SELECT id FROM usuarios WHERE telefono_canonico = ? AND rol = 'repartidor' LIMIT 1")
    .bind(telefono)
    .first<{ id: string }>();
  if (u) return personaDeUsuario(db, u.id);
  return crear(db, { telefono });
}

/** La ficha anónima del chat de la web (sin cuenta), por la huella de su navegador. */
export async function personaDeVisitante(
  db: D1Database,
  visitanteHash: string,
  idioma: IdiomaCamila,
) {
  const ya = await db
    .prepare(`SELECT ${COLUMNAS} FROM camila_personas WHERE visitante_hash = ?`)
    .bind(visitanteHash)
    .first<Persona>();
  if (ya) return ya;
  return crear(db, { visitante_hash: visitanteHash, idioma });
}

/**
 * El chat anónimo verificó su correo: se une a la persona de ese correo (si existía), con todos sus
 * mensajes. Devuelve la persona que queda.
 */
export async function unirConCorreo(db: D1Database, anonima: Persona, correoCrudo: string) {
  const destino = await personaDeCorreo(db, correoCrudo);
  if (destino.id === anonima.id) return destino;
  const anon = await db
    .prepare('SELECT visitante_hash, mensajes FROM camila_personas WHERE id = ?')
    .bind(anonima.id)
    .first<{ visitante_hash: string | null; mensajes: number }>();
  await db.batch([
    db
      .prepare('UPDATE camila_mensajes SET persona_id = ? WHERE persona_id = ?')
      .bind(destino.id, anonima.id),
    db
      .prepare('UPDATE camila_casos SET persona_id = ? WHERE persona_id = ?')
      .bind(destino.id, anonima.id),
    db
      .prepare('UPDATE camila_sin_respuesta SET persona_id = ? WHERE persona_id = ?')
      .bind(destino.id, anonima.id),
    // C-CAMILA-FALLOS: sus reportes de fallo (y sus capturas) pasan con ella; si las dos fichas tenían
    // uno abierto, el de la ficha anónima se cancela (como mucho uno abierto por persona).
    db
      .prepare(
        `UPDATE camila_reportes_fallo SET estado = 'cancelado' WHERE persona_id = ?2 AND estado IN ('preguntando', 'captura')
           AND EXISTS (SELECT 1 FROM camila_reportes_fallo x WHERE x.persona_id = ?1 AND x.estado IN ('preguntando', 'captura'))`,
      )
      .bind(destino.id, anonima.id),
    db
      .prepare('UPDATE camila_reportes_fallo SET persona_id = ? WHERE persona_id = ?')
      .bind(destino.id, anonima.id),
    db
      .prepare('UPDATE camila_adjuntos SET persona_id = ? WHERE persona_id = ?')
      .bind(destino.id, anonima.id),
    db
      .prepare('UPDATE camila_correos SET persona_id = ? WHERE persona_id = ?')
      .bind(destino.id, anonima.id),
    db.prepare('DELETE FROM camila_personas WHERE id = ?').bind(anonima.id),
    // El navegador queda unido a la persona del correo: la próxima vez entra directo a su hilo.
    db
      .prepare(
        "UPDATE camila_personas SET visitante_hash = ?, mensajes = mensajes + ?, actualizado_en = datetime('now') WHERE id = ?",
      )
      .bind(anon?.visitante_hash ?? null, Number(anon?.mensajes ?? 0), destino.id),
  ]);
  return (await personaPorId(db, destino.id)) as Persona;
}

export type MensajeHilo = {
  id: string;
  canal: Canal;
  autor: 'persona' | 'camila' | 'equipo';
  texto: string;
  creado_en: string;
};

export async function ultimosMensajes(db: D1Database, personaId: string, n = HISTORIAL_AL_MODELO) {
  const { results } = await db
    .prepare(
      `SELECT id, canal, autor, texto, creado_en FROM camila_mensajes
        WHERE persona_id = ? ORDER BY creado_en DESC, rowid DESC LIMIT ?`,
    )
    .bind(personaId, n)
    .all<MensajeHilo>();
  return results.reverse();
}

export function sentenciaMensaje(
  db: D1Database,
  m: {
    personaId: string;
    canal: Canal;
    autor: MensajeHilo['autor'];
    texto: string;
    autorId?: string | null;
    herramienta?: string | null;
    /** El id del mensaje, si quien lo guarda lo necesita (para unirle su imagen adjunta). */
    id?: string;
  },
) {
  return db
    .prepare(
      'INSERT INTO camila_mensajes (id, persona_id, canal, autor, autor_id, texto, herramienta) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      m.id ?? nuevoId(),
      m.personaId,
      m.canal,
      m.autor,
      m.autorId ?? null,
      m.texto.slice(0, 4000),
      m.herramienta ?? null,
    );
}

// ------------------------------------------------------------------ ajustes

export type AjustesCamila = {
  /** Encendida o apagada del todo la IA (sin IA sigue contestando con Docs y lo aprobado). */
  ia: boolean;
  /** Tope diario de gasto de IA, en centavos de dólar (máximo TOPE_MAXIMO_CENTAVOS). */
  topeDiarioCentavos: number;
  /** Cuántos regalos de arranque puede dar Camila al día como mucho (además del presupuesto). */
  regalosPorDia: number;
};

/**
 * C-CAMILA-SIN-AVISO (18 nov 2026, regla de Richard para todo Divoox): Camila NUNCA dice por su cuenta
 * que es una asistente virtual, en ningún país y en ningún canal. No hay aviso de primer mensaje ni
 * interruptor para encenderlo. Si se lo preguntan, dice la verdad (identidad.ts, VERDAD).
 */
export const AJUSTES_CAMILA_INICIALES: AjustesCamila = {
  ia: true,
  topeDiarioCentavos: TOPE_DIARIO_CENTAVOS,
  regalosPorDia: 20,
};

export const REGALOS_POR_DIA_MAXIMO = 50;

export async function leerAjustes(db: D1Database): Promise<AjustesCamila> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'camila'")
    .first<{ valor: string }>()
    .catch(() => null);
  if (!f) return AJUSTES_CAMILA_INICIALES;
  try {
    const v = JSON.parse(f.valor) as Partial<AjustesCamila>;
    return {
      ia: v.ia !== false,
      topeDiarioCentavos: Math.min(
        Math.max(0, Number(v.topeDiarioCentavos ?? TOPE_DIARIO_CENTAVOS)),
        TOPE_MAXIMO_CENTAVOS,
      ),
      regalosPorDia: Math.min(Math.max(0, Number(v.regalosPorDia ?? 20)), REGALOS_POR_DIA_MAXIMO),
    };
  } catch (e) {
    console.error('camila: ajustes ilegibles, van los de fábrica', e);
    return AJUSTES_CAMILA_INICIALES;
  }
}

export async function guardarAjustes(db: D1Database, a: AjustesCamila) {
  await db
    .prepare(
      `INSERT INTO config (clave, valor) VALUES ('camila', ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    )
    .bind(
      JSON.stringify({
        ia: a.ia,
        topeDiarioCentavos: a.topeDiarioCentavos,
        regalosPorDia: a.regalosPorDia,
      }),
    )
    .run();
}

/** ¿Hay una persona del equipo atendiendo este hilo ahora? Camila no le pisa la conversación. */
export const humanoActivo = (p: Persona, ahora = new Date()) =>
  Boolean(p.humano_hasta && new Date(`${p.humano_hasta.replace(' ', 'T')}Z`) > ahora);

/**
 * C-CAMILA-BORRADO: al borrar una cuenta se borra TODO lo de Camila de esa persona (por su cuenta y
 * por su correo): mensajes, casos, preguntas anotadas, códigos, el aviso a su líder y su ficha con
 * nombre, correo y resumen. Van dentro del lote de `borrarCuenta`.
 */
export function sentenciasBorrarDeCamila(
  db: D1Database,
  usuarioId: string,
  correo: string,
  telefono: string | null = null,
) {
  const canonico = correoCanonico(correo);
  // También la ficha que solo tenga su teléfono (SMS y WhatsApp, cuando se enciendan).
  const tel = telefono ?? '-';
  const mias =
    'SELECT id FROM camila_personas WHERE usuario_id = ?1 OR correo = ?2 OR correo = ?3 OR telefono = ?4';
  const de = (tabla: string, columna = 'persona_id') =>
    db
      .prepare(`DELETE FROM ${tabla} WHERE ${columna} IN (${mias})`)
      .bind(usuarioId, correo, canonico, tel);
  return [
    de('camila_mensajes'),
    de('camila_casos'),
    de('camila_sin_respuesta'),
    // C-CAMILA-FALLOS: sus reportes de fallo (las capturas se borran del almacén aparte).
    de('camila_reportes_fallo'),
    de('camila_adjuntos'),
    // C-CAMILA-CORREO-HILO: las cabeceras de sus correos (con su dirección y sus asuntos).
    de('camila_correos'),
    de('camila_codigos'),
    db
      .prepare('DELETE FROM camila_codigos WHERE correo = ?1 OR correo = ?2')
      .bind(correo, canonico),
    db
      .prepare('DELETE FROM camila_codigos_dia WHERE correo = ?1 OR correo = ?2')
      .bind(correo, canonico),
    db.prepare('DELETE FROM camila_avisos_lider WHERE conductor_id = ?').bind(usuarioId),
    de('camila_personas', 'id'),
  ];
}

/** El país de la petición (cabecera de Cloudflare), si la ficha todavía no tiene país. */
export async function anotarPais(db: D1Database, p: Persona, pais: string | undefined) {
  const codigo = (pais ?? '').toUpperCase();
  if (p.pais || !/^[A-Z]{2}$/.test(codigo) || codigo === 'XX' || codigo === 'T1') return p;
  await db
    .prepare("UPDATE camila_personas SET pais = ? WHERE id = ? AND pais = ''")
    .bind(codigo, p.id)
    .run();
  return { ...p, pais: codigo };
}

/** Las capturas de pantalla de los reportes de fallo de una persona, para borrarlas del almacén. */
export async function capturasDeCamila(
  db: D1Database,
  usuarioId: string,
  correo: string,
  telefono: string | null,
) {
  const { results } = await db
    .prepare(
      `SELECT captura_clave FROM camila_reportes_fallo WHERE captura_clave IS NOT NULL AND persona_id IN (
         SELECT id FROM camila_personas WHERE usuario_id = ?1 OR correo = ?2 OR correo = ?3 OR telefono = ?4)
       UNION SELECT clave FROM camila_adjuntos WHERE persona_id IN (
         SELECT id FROM camila_personas WHERE usuario_id = ?1 OR correo = ?2 OR correo = ?3 OR telefono = ?4)`,
    )
    .bind(usuarioId, correo, correoCanonico(correo), telefono ?? '-')
    .all<{ captura_clave: string }>();
  return results.map((r) => r.captura_clave);
}
