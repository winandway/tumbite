import { mensajeTelefono } from '@tumbite/compartido';
import { esCorreoDeNegocio } from './cuentaUnica';
import { enviarCorreo } from './correo';
import { nuevoId, nuevoToken, sha256 } from './cripto';
import { TelefonoInvalido, paisParaTelefono, telefonoParaGuardar } from './cuentaPais';
import type { Env } from './env';
import { enviarSms, telefonoE164 } from './sms';
import { canalesPara } from './telefonoVuelta';
import { ErrorDatos } from './validar';
import { enviarCodigoWhatsapp } from './whatsapp';

/**
 * C-RECUPERAR-WHATSAPP (27 nov 2026, orden de Richard por Gerencia) — todos los países.
 *
 * «¿Olvidaste tu contraseña?» con un código de 6 números por WhatsApp (recomendado) o por correo, y el
 * SMS de respaldo cuando WhatsApp no llega. La persona escribe su celular o su correo; el servidor:
 *  - NUNCA dice si la cuenta existe: pedir el código responde siempre lo mismo, y los topes cuentan lo
 *    escrito (no la cuenta), así que una cuenta que no existe se frena igual que una que sí;
 *  - manda el código solo a un medio VERIFICADO de la cuenta (el celular confirmado; el correo
 *    confirmado, o el correo de una cuenta sin celular confirmado, como siempre funcionó el enlace);
 *  - el código vence a los 5 minutos, sirve UNA vez y acepta 5 intentos; 3 envíos por hora por lo
 *    escrito y 3 por destino (aunque se pida con otro dato de la misma cuenta);
 *  - el código bueno entrega un pase de un solo uso por cuenta (tabla `recuperaciones`, la misma del
 *    enlace del correo): con él se crea la contraseña nueva, se cierran las sesiones viejas y se avisa
 *    por el otro canal;
 *  - cada paso queda en `auditoria_recuperacion`.
 *
 * Qué NO tocar: la respuesta igual exista o no la cuenta, los topes por lo escrito, el código de un solo
 * uso (la marca de usado se pone con una escritura que mira que siga sin usar), y que las pruebas nunca
 * le hablen a Meta (usan el adaptador simulado).
 */
export const MINUTOS_CODIGO_RECUPERAR = 5;
export const MAX_INTENTOS_RECUPERAR = 5;
export const MAX_ENVIOS_HORA_RECUPERAR = 3;
/** Minutos que vale el pase para crear la contraseña después de escribir el código bueno. */
export const MINUTOS_PASE_RECUPERAR = 15;

export type CanalRecuperar = 'whatsapp' | 'sms' | 'correo';

export const MENSAJE_SI_EXISTE = {
  es: 'Si la cuenta existe, te enviamos un código.',
  en: 'If the account exists, we sent you a code.',
} as const;
const MENSAJE_CODIGO_MALO = {
  es: 'El código no coincide o ya venció. Revísalo o pide uno nuevo.',
  en: 'The code doesn’t match or has expired. Check it or ask for a new one.',
} as const;

type Cuenta = {
  id: string;
  nombre: string;
  idioma: string;
  rol: string;
  correo: string | null;
  telefono: string | null;
  correo_ok: number;
  telefono_ok: number;
};

type Identificado = { huella: string; tipo: 'correo' | 'telefono'; cuentas: Cuenta[] };

const COLUMNAS = `id, nombre, idioma, rol, correo, telefono,
  correo_confirmado_en IS NOT NULL AS correo_ok, telefono_verificado_en IS NOT NULL AS telefono_ok`;

/** Lee lo que la persona escribió (celular o correo) y busca la cuenta. La huella nunca guarda el dato. */
export async function identificar(
  db: D1Database,
  d: { identificador: string; paisTelefono?: string | undefined },
  ipPais: string | null | undefined,
  idioma: 'es' | 'en' = 'es',
): Promise<Identificado> {
  const texto = d.identificador.trim();
  if (texto.includes('@')) {
    const correo = texto.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo))
      throw new ErrorDatos(
        idioma === 'en' ? 'Enter a valid email.' : 'Escribe un correo válido.',
        'identificador',
        422,
      );
    const { results } = await db
      .prepare(`SELECT ${COLUMNAS} FROM usuarios WHERE correo = ? AND activo = 1`)
      .bind(correo)
      .all<Cuenta>();
    return { huella: await sha256(`recuperar:correo:${correo}`), tipo: 'correo', cuentas: results };
  }
  const pais = paisParaTelefono(texto, d.paisTelefono ?? null, ipPais);
  let canonico: string | null;
  try {
    canonico = telefonoParaGuardar(texto, pais).canonico;
  } catch (e) {
    if (e instanceof TelefonoInvalido)
      throw new ErrorDatos(mensajeTelefono(e.motivo, idioma), 'identificador', 422);
    throw e;
  }
  if (!canonico || canonico.length < 7)
    throw new ErrorDatos(
      idioma === 'en'
        ? 'Enter your cell phone number or your email.'
        : 'Escribe tu número de celular o tu correo.',
      'identificador',
      422,
    );
  // Solo las cuentas que CONFIRMARON ese celular: un número sin confirmar no recupera nada.
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNAS} FROM usuarios
        WHERE telefono_canonico = ? AND telefono_verificado_en IS NOT NULL AND activo = 1`,
    )
    .bind(canonico)
    .all<Cuenta>();
  return { huella: await sha256(`recuperar:tel:${canonico}`), tipo: 'telefono', cuentas: results };
}

function codigoNuevo() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0]! % 1_000_000).padStart(6, '0');
}

/** El SMS: un solo mensaje, empieza con «Divoox:», sin acentos (C-SMS-VENEZUELA-TEXTOS). */
export function textoSmsRecuperar(codigo: string, idioma: 'es' | 'en') {
  return idioma === 'en'
    ? `Divoox: your code to recover your account is ${codigo}. It expires in ${MINUTOS_CODIGO_RECUPERAR} minutes. Do not share it.`
    : `Divoox: tu codigo para recuperar tu cuenta es ${codigo}. Vence en ${MINUTOS_CODIGO_RECUPERAR} minutos. No lo compartas.`;
}

const CORREO_CODIGO = {
  es: {
    asunto: 'Tu código para recuperar tu cuenta de Divoox',
    cuerpo: (nombre: string, codigo: string) => `Hola ${nombre}:

Alguien pidió recuperar tu cuenta de Divoox. Si fuiste tú, escribe este código en la pantalla:

${codigo}

Vence en ${MINUTOS_CODIGO_RECUPERAR} minutos y sirve una sola vez. No se lo des a nadie: nadie de Divoox te lo va a pedir.

Si no fuiste tú, no hagas nada: tu contraseña sigue igual.

El equipo de Divoox`,
  },
  en: {
    asunto: 'Your code to recover your Divoox account',
    cuerpo: (nombre: string, codigo: string) => `Hi ${nombre},

Someone asked to recover your Divoox account. If it was you, enter this code on the screen:

${codigo}

It expires in ${MINUTOS_CODIGO_RECUPERAR} minutes and works only once. Don't share it: no one from Divoox will ever ask for it.

If it wasn't you, do nothing: your password stays the same.

The Divoox team`,
  },
};

export const AVISO_CLAVE_CAMBIADA = {
  es: {
    asunto: 'Se cambió la contraseña de tu cuenta',
    cuerpo: (nombre: string) => `Hola ${nombre}:

Se cambió la contraseña de tu cuenta de Divoox y cerramos las sesiones que estaban abiertas.

Si fuiste tú, no tienes que hacer nada.

Si no fuiste tú, escríbenos ya a soporte@divoox.com para proteger tu cuenta.

El equipo de Divoox`,
    sms: 'Divoox: se cambio la contrasena de tu cuenta. Si no fuiste tu, escribe ya a soporte@divoox.com',
  },
  en: {
    asunto: 'Your account password was changed',
    cuerpo: (nombre: string) => `Hi ${nombre},

The password of your Divoox account was changed and we signed out the sessions that were open.

If it was you, you don't need to do anything.

If it wasn't you, write to us right away at support@divoox.com to protect your account.

The Divoox team`,
    sms: 'Divoox: your account password was changed. If it was not you, write to support@divoox.com now',
  },
};

const lengua = (x: string | null | undefined): 'es' | 'en' => (x === 'en' ? 'en' : 'es');
const primerNombre = (n: string) => n.trim().split(/\s+/)[0] ?? '';

/** Un renglón de la auditoría. Nunca frena la recuperación. */
export async function auditar(
  db: D1Database,
  a: {
    usuarioId: string | null;
    huella: string | null;
    canal: string | null;
    evento: string;
    ip: string | null | undefined;
  },
) {
  await db
    .prepare(
      `INSERT INTO auditoria_recuperacion (id, usuario_id, identificador_hash, canal, evento, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(nuevoId(), a.usuarioId, a.huella, a.canal, a.evento, a.ip ?? null)
    .run()
    .catch((e: unknown) => console.error('recuperar: no se pudo auditar', String(e)));
}

/** WhatsApp con la plantilla de recuperar (si hay una propia), o la de siempre. */
const envDeRecuperar = (env: Env): Env =>
  env.META_WHATSAPP_PLANTILLA_RECUPERAR
    ? { ...env, META_WHATSAPP_PLANTILLA: env.META_WHATSAPP_PLANTILLA_RECUPERAR }
    : env;

type Destino = { canal: 'telefono' | 'correo'; para: string; cuentas: Cuenta[] };

/** A dónde puede ir el código, según el canal pedido. Solo medios verificados. */
function destinosDe(cuentas: Cuenta[], canal: CanalRecuperar): Destino[] {
  const porPara = new Map<string, Destino>();
  for (const k of cuentas) {
    if (canal === 'correo') {
      // El correo confirmado, o el de una cuenta sin celular confirmado (C-RECUPERAR-POR-CELULAR:
      // con el celular confirmado y el correo sin confirmar, el correo no recibe nada).
      if (!k.correo || esCorreoDeNegocio(k.correo)) continue;
      if (!Number(k.correo_ok) && Number(k.telefono_ok)) continue;
      const d = porPara.get(k.correo) ?? { canal: 'correo', para: k.correo, cuentas: [] };
      d.cuentas.push(k);
      porPara.set(k.correo, d);
    } else {
      const e164 = Number(k.telefono_ok) ? telefonoE164(k.telefono) : null;
      if (!e164) continue;
      const d = porPara.get(e164) ?? { canal: 'telefono', para: e164, cuentas: [] };
      d.cuentas.push(k);
      porPara.set(e164, d);
    }
  }
  return [...porPara.values()];
}

/**
 * Pide el código. Quien llama responde siempre lo mismo, exista o no la cuenta. Solo lanza por lo que
 * no depende de la cuenta: el dato mal escrito o el tope de lo escrito.
 */
export async function pedirCodigoRecuperar(
  env: Env,
  db: D1Database,
  d: {
    identificador: string;
    paisTelefono?: string | undefined;
    canal: CanalRecuperar;
    idioma: 'es' | 'en';
  },
  red: { ip: string | null | undefined; ipPais: string | null | undefined },
  segundoPlano?: (p: Promise<unknown>) => void,
): Promise<void> {
  const id = await identificar(db, d, red.ipPais, d.idioma);
  // 1. El tope por lo escrito, reservado en UNA escritura (dos peticiones a la vez no pasan las dos).
  const envioId = nuevoId();
  const reserva = await db
    .prepare(
      `INSERT INTO envios_recuperacion (id, identificador_hash, ip, canal)
       SELECT ?1, ?2, ?3, ?4
        WHERE (SELECT COUNT(*) FROM envios_recuperacion
                WHERE identificador_hash = ?2 AND creado_en > datetime('now', '-1 hour')) < ?5`,
    )
    .bind(envioId, id.huella, red.ip ?? null, d.canal, MAX_ENVIOS_HORA_RECUPERAR)
    .run();
  if (!reserva.meta.changes) {
    await auditar(db, {
      usuarioId: id.cuentas[0]?.id ?? null,
      huella: id.huella,
      canal: d.canal,
      evento: 'tope',
      ip: red.ip,
    });
    throw new ErrorDatos(
      d.idioma === 'en'
        ? `You already asked for ${MAX_ENVIOS_HORA_RECUPERAR} codes in the last hour. Wait a while and try again.`
        : `Ya pediste ${MAX_ENVIOS_HORA_RECUPERAR} códigos en la última hora. Espera un rato e inténtalo otra vez.`,
      'identificador',
      429,
    );
  }
  // El código anterior de lo mismo deja de servir: vale solo el último.
  await db
    .prepare(
      `UPDATE codigos_recuperacion SET codigo_hash = '-'
        WHERE identificador_hash = ? AND usado_en IS NULL AND codigo_hash != '-'`,
    )
    .bind(id.huella)
    .run();
  const destinos = destinosDe(id.cuentas, d.canal);
  if (!destinos.length) {
    await auditar(db, {
      usuarioId: id.cuentas[0]?.id ?? null,
      huella: id.huella,
      canal: d.canal,
      evento: id.cuentas.length ? 'sin_medio' : 'sin_cuenta',
      ip: red.ip,
    });
    return;
  }
  const trabajo = (async () => {
    for (const destino of destinos) await mandarA(env, db, id, destino, d, envioId, red.ip);
  })().catch((e: unknown) =>
    console.error('recuperar: el código no salió', e instanceof Error ? e.message : String(e)),
  );
  // Mandarlo en segundo plano iguala el tiempo de respuesta exista o no la cuenta.
  if (segundoPlano) segundoPlano(trabajo);
  else await trabajo;
}

async function mandarA(
  env: Env,
  db: D1Database,
  id: Identificado,
  destino: Destino,
  d: { canal: CanalRecuperar; idioma: 'es' | 'en' },
  envioId: string,
  ip: string | null | undefined,
) {
  const titular = destino.cuentas[0]!;
  const huellaDestino = await sha256(`recuperar:destino:${destino.para}`);
  // 2. El tope por destino: el mismo celular o buzón, aunque se pida con otro dato de la cuenta.
  const porDestino = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM envios_recuperacion
        WHERE destino_hash = ? AND creado_en > datetime('now', '-1 hour')`,
    )
    .bind(huellaDestino)
    .first<{ n: number }>();
  if (Number(porDestino?.n ?? 0) >= MAX_ENVIOS_HORA_RECUPERAR) {
    await auditar(db, {
      usuarioId: titular.id,
      huella: id.huella,
      canal: d.canal,
      evento: 'tope_destino',
      ip,
    });
    return;
  }
  await db
    .prepare('UPDATE envios_recuperacion SET destino_hash = ? WHERE id = ?')
    .bind(huellaDestino, envioId)
    .run();
  const codigo = codigoNuevo();
  const filaId = nuevoId();
  await db
    .prepare(
      `INSERT INTO codigos_recuperacion (id, identificador_hash, canal, usuarios, codigo_hash)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      filaId,
      id.huella,
      d.canal,
      JSON.stringify(destino.cuentas.map((k) => k.id)),
      await sha256(`${filaId}:${codigo}`),
    )
    .run();
  const idioma = d.idioma;
  let salio: CanalRecuperar | null = null;
  if (destino.canal === 'correo') {
    const t = idioma === 'en' ? CORREO_CODIGO.en : CORREO_CODIGO.es;
    const r = await enviarCorreo(env, {
      de: 'avisos',
      para: destino.para,
      asunto: t.asunto,
      texto: t.cuerpo(primerNombre(titular.nombre), codigo),
    });
    if (r.ok) salio = 'correo';
  } else {
    const canales = await canalesPara(env, db, destino.para);
    // WhatsApp primero (si lo pidió); si no sale, el SMS de respaldo. Pidió SMS: solo SMS.
    if (d.canal === 'whatsapp' && canales.includes('whatsapp')) {
      const ref = await enviarCodigoWhatsapp(envDeRecuperar(env), db, {
        usuarioId: titular.id,
        para: destino.para,
        codigo,
        idioma,
      });
      if (ref) salio = 'whatsapp';
    }
    if (!salio && canales.includes('sms')) {
      const ok = await enviarSms(env, db, {
        usuarioId: titular.id,
        pedidoId: null,
        tipo: 'codigo_recuperar',
        telefono: destino.para,
        texto: textoSmsRecuperar(codigo, idioma),
      });
      if (ok) salio = 'sms';
    }
  }
  if (salio)
    await db
      .prepare('UPDATE codigos_recuperacion SET canal = ? WHERE id = ?')
      .bind(salio, filaId)
      .run();
  for (const k of destino.cuentas)
    await auditar(db, {
      usuarioId: k.id,
      huella: id.huella,
      canal: salio ?? d.canal,
      evento: salio ? 'codigo_enviado' : 'codigo_no_salio',
      ip,
    });
}

export type CuentaRecuperada = {
  pase: string;
  rol: string;
  nombre: string;
  /** El correo con letras tapadas (r•••@gmail.com): solo para elegir entre varias cuentas. */
  correo: string | null;
};

const tapar = (correo: string | null) => {
  if (!correo) return null;
  const [u = '', dominio = ''] = correo.split('@');
  return `${u.slice(0, 1)}•••@${dominio}`;
};

/**
 * Comprueba el código. Bueno: lo marca usado (una sola vez) y devuelve un pase por cada cuenta que
 * abre. Malo o vencido: suma un intento y responde lo mismo exista o no la cuenta.
 */
export async function verificarCodigoRecuperar(
  db: D1Database,
  d: {
    identificador: string;
    paisTelefono?: string | undefined;
    codigo: string;
    idioma: 'es' | 'en';
  },
  red: { ip: string | null | undefined; ipPais: string | null | undefined },
): Promise<CuentaRecuperada[]> {
  const id = await identificar(db, d, red.ipPais, d.idioma);
  const { results: vivos } = await db
    .prepare(
      `SELECT id, canal, usuarios, codigo_hash FROM codigos_recuperacion
        WHERE identificador_hash = ? AND usado_en IS NULL AND codigo_hash != '-'
          AND intentos < ? AND creado_en > datetime('now', ?)`,
    )
    .bind(id.huella, MAX_INTENTOS_RECUPERAR, `-${MINUTOS_CODIGO_RECUPERAR} minutes`)
    .all<{ id: string; canal: string; usuarios: string; codigo_hash: string }>();
  let bueno: (typeof vivos)[number] | null = null;
  for (const v of vivos) if ((await sha256(`${v.id}:${d.codigo}`)) === v.codigo_hash) bueno = v;
  const mensajeMalo = d.idioma === 'en' ? MENSAJE_CODIGO_MALO.en : MENSAJE_CODIGO_MALO.es;
  if (!bueno) {
    if (vivos.length)
      await db
        .prepare(
          `UPDATE codigos_recuperacion SET intentos = intentos + 1
            WHERE identificador_hash = ? AND usado_en IS NULL`,
        )
        .bind(id.huella)
        .run();
    await auditar(db, {
      usuarioId: id.cuentas[0]?.id ?? null,
      huella: id.huella,
      canal: null,
      evento: 'codigo_malo',
      ip: red.ip,
    });
    throw new ErrorDatos(mensajeMalo, 'codigo', 409);
  }
  // Una sola vez: la marca se pone solo si sigue sin usar (dos a la vez no pasan las dos).
  const marca = await db
    .prepare(
      "UPDATE codigos_recuperacion SET usado_en = datetime('now') WHERE id = ? AND usado_en IS NULL",
    )
    .bind(bueno.id)
    .run();
  if (!marca.meta.changes) throw new ErrorDatos(mensajeMalo, 'codigo', 409);
  // Los demás códigos de lo mismo dejan de servir.
  await db
    .prepare(
      "UPDATE codigos_recuperacion SET codigo_hash = '-' WHERE identificador_hash = ? AND id != ?",
    )
    .bind(id.huella, bueno.id)
    .run();
  const ids = new Set((JSON.parse(bueno.usuarios) as string[]).filter(Boolean));
  const salida: CuentaRecuperada[] = [];
  for (const k of id.cuentas.filter((x) => ids.has(x.id))) {
    const pase = nuevoToken();
    await db
      .prepare(
        `INSERT INTO recuperaciones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', ?))`,
      )
      .bind(await sha256(pase), k.id, `+${MINUTOS_PASE_RECUPERAR} minutes`)
      .run();
    await auditar(db, {
      usuarioId: k.id,
      huella: id.huella,
      canal: bueno.canal,
      evento: 'codigo_bueno',
      ip: red.ip,
    });
    salida.push({ pase, rol: k.rol, nombre: primerNombre(k.nombre), correo: tapar(k.correo) });
  }
  if (!salida.length) throw new ErrorDatos(mensajeMalo, 'codigo', 409);
  return salida;
}

/**
 * Después de cambiar la contraseña: queda en la auditoría y se avisa por el OTRO canal. Recuperó por
 * WhatsApp o SMS → aviso al correo. Recuperó por correo (código o enlace) → aviso por SMS al celular
 * confirmado; sin el otro canal, por el mismo (la persona siempre se entera). Nunca frena el cambio.
 */
export async function avisarClaveCambiada(
  env: Env,
  db: D1Database,
  usuarioId: string,
  ip: string | null | undefined,
) {
  try {
    const ultimo = await db
      .prepare(
        `SELECT canal FROM auditoria_recuperacion
          WHERE usuario_id = ? AND evento = 'codigo_bueno' AND creado_en > datetime('now', ?)
          ORDER BY creado_en DESC LIMIT 1`,
      )
      .bind(usuarioId, `-${MINUTOS_PASE_RECUPERAR + 5} minutes`)
      .first<{ canal: string | null }>();
    const canal = ultimo?.canal ?? 'enlace';
    await auditar(db, { usuarioId, huella: null, canal, evento: 'clave_cambiada', ip });
    const k = await db
      .prepare(`SELECT ${COLUMNAS} FROM usuarios WHERE id = ?`)
      .bind(usuarioId)
      .first<Cuenta>();
    if (!k) return;
    const t = AVISO_CLAVE_CAMBIADA[lengua(k.idioma)];
    const porCorreo = async () => {
      if (!k.correo || esCorreoDeNegocio(k.correo)) return false;
      return (
        await enviarCorreo(env, {
          de: 'avisos',
          para: k.correo,
          asunto: t.asunto,
          texto: t.cuerpo(primerNombre(k.nombre)),
        })
      ).ok;
    };
    const porSms = async () => {
      const e164 = Number(k.telefono_ok) ? telefonoE164(k.telefono) : null;
      if (!e164 || !(await canalesPara(env, db, e164)).includes('sms')) return false;
      return enviarSms(env, db, {
        usuarioId,
        pedidoId: null,
        tipo: 'aviso_clave_cambiada',
        telefono: e164,
        texto: t.sms,
      });
    };
    const viaTelefono = canal === 'whatsapp' || canal === 'sms';
    const salio = viaTelefono ? await porCorreo() : await porSms();
    if (!salio) await (viaTelefono ? porSms() : porCorreo());
  } catch (e) {
    console.error('recuperar: el aviso de contraseña cambiada no salió', String(e));
  }
}
