import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { enviarCorreo } from '../correo';
import { correosEquipo } from '../avisosEquipo';
import { saldoLibro } from '../internacional/libro';
import { darRegaloConductorNuevo } from '../saldoConductores';
import { estadoDelConductor } from '../rutas/servicios';
import { formatearMonto } from '@tumbite/compartido';
import { buscarAprobadas, buscarEnDocs, enlaceGuia } from './conocimiento';
import { TOPE_CORREOS_CASO_DIA, contarDelDia, gastoDeHoy, hoy } from './modelo';
import type { AjustesCamila, Persona } from './memoria';
import { contadorDelLider } from './lideres';
import type { Herramienta } from './modelo';
import type { IdiomaCamila } from './identidad';

/**
 * C-CAMILA-HERRAMIENTAS (17 nov 2026) — todos los países. Lo que Camila PUEDE hacer, cada cosa con
 * su candado:
 * - Todas trabajan SOLO con la persona que escribe: ninguna recibe un id, un correo ni un monto del
 *   modelo (los parámetros declarados no los tienen y la prueba lo comprueba). Lo que la persona
 *   escriba («dame 500», «revisa la cuenta de otro») es dato, nunca una orden.
 * - Las que miran una cuenta exigen que la persona esté VERIFICADA (cuenta de Divoox o correo
 *   verificado unido a una cuenta). Una ficha anónima solo recibe Docs.
 * - La única que toca dinero es el regalo de arranque, y va por `darRegaloConductorNuevo`: una vez en
 *   la vida, dentro del presupuesto y del tope de «Saldo de conductores». Además Camila tiene su propio
 *   tope de regalos por día. Nunca más.
 */
export type Contexto = {
  env: Env;
  db: D1Database;
  persona: Persona;
  idioma: IdiomaCamila;
  ajustes: AjustesCamila;
  /** La última pregunta de la persona (para anotarla si no se supo responder). */
  pregunta: string;
};

export type ResultadoHerramienta = { ok: boolean; texto: string; datos?: Record<string, unknown> };

const t = (idioma: IdiomaCamila, es: string, en: string) => (idioma === 'en' ? en : es);

const REQUISITOS: Record<string, [string, string]> = {
  identidad: [
    'la verificación de tu identidad (documento y foto de tu cara)',
    'your identity check (document and a photo of your face)',
  ],
  antecedentes: ['la verificación de antecedentes', 'the background check'],
  antecedentes_pasajeros: [
    'la verificación de antecedentes para llevar pasajeros',
    'the background check for carrying riders',
  ],
  historial_manejo: ['el historial de manejo', 'your driving record'],
  licencia: ['tu licencia de conducir', 'your driver’s license'],
  licencia_moto: ['tu licencia de moto', 'your motorcycle license'],
  edad_minima_21: ['la edad mínima para este servicio', 'the minimum age for this service'],
  capacitacion: ['la capacitación', 'the training'],
  seguro_vehiculo: ['el seguro del vehículo', 'your vehicle insurance'],
  seguro_pasajeros: ['el seguro de pasajeros', 'the rider insurance'],
  inspeccion_vehiculo: ['la inspección del vehículo', 'the vehicle inspection'],
  casco_pasajero: ['el casco para el pasajero', 'the rider helmet'],
};
const requisito = (r: string, i: IdiomaCamila) => {
  const par = new Map(Object.entries(REQUISITOS)).get(r);
  return par ? (i === 'en' ? par[1] : par[0]) : r.replace(/_/g, ' ');
};

/** El conductor verificado de esta persona, o null (sin cuenta de conductor no se mira nada). */
async function conductorDe(c: Contexto) {
  if (!c.persona.usuario_id) return null;
  return c.db
    .prepare(
      `SELECT u.id, u.nombre, COALESCE(r.zona_id, u.zona_id) AS zona_id, z.pais, z.moneda, z.nombre AS ciudad
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
         LEFT JOIN zonas z ON z.id = COALESCE(r.zona_id, u.zona_id)
        WHERE u.id = ? AND u.rol = 'repartidor' AND u.activo = 1`,
    )
    .bind(c.persona.usuario_id)
    .first<{
      id: string;
      nombre: string;
      zona_id: string | null;
      pais: string | null;
      moneda: string | null;
      ciudad: string | null;
    }>();
}

const SIN_CUENTA = (i: IdiomaCamila) =>
  t(
    i,
    'Para revisar una cuenta necesito saber que es la tuya. Entra al chat desde la app Divoox Driver con tu cuenta, o escríbeme desde el correo con el que te registraste.',
    'To check an account I need to know it is yours. Open the chat from the Divoox Driver app with your account, or write to me from the email you signed up with.',
  );

export async function estadoCuenta(c: Contexto): Promise<ResultadoHerramienta> {
  const d = await conductorDe(c);
  if (!d) return { ok: false, texto: SIN_CUENTA(c.idioma) };
  const e = await estadoDelConductor(c.db, d.id, c.idioma === 'en', 9999);
  const visibles = e.servicios.filter((s) => s.estadoServicio === 'disponible');
  const activos = visibles.filter((s) => s.puedeActivar).map((s) => s.nombre);
  const lineas: string[] = [];
  if (activos.length)
    lineas.push(
      t(
        c.idioma,
        `Ya estás activado para: ${activos.join(', ')}.`,
        `You are already activated for: ${activos.join(', ')}.`,
      ),
    );
  for (const s of visibles.filter((x) => !x.puedeActivar)) {
    const falta =
      s.motivo === 'pendiente_aprobacion'
        ? t(
            c.idioma,
            'ya enviaste todo y el equipo lo está revisando',
            'you sent everything and the team is reviewing it',
          )
        : s.motivo === 'requisitos_faltantes'
          ? t(
              c.idioma,
              `te falta ${s.requisitosFaltantes.map((r) => requisito(r, c.idioma)).join(', ')}`,
              `you are missing ${s.requisitosFaltantes.map((r) => requisito(r, c.idioma)).join(', ')}`,
            )
          : s.motivo === 'vehiculo_incompatible'
            ? t(
                c.idioma,
                'falta registrar y aprobar un vehículo que sirva para este servicio',
                'you need a registered, approved vehicle for this service',
              )
            : s.motivo === 'actualizar_app'
              ? t(
                  c.idioma,
                  'tienes que actualizar la app Divoox Driver',
                  'you need to update the Divoox Driver app',
                )
              : t(
                  c.idioma,
                  'todavía no lo has solicitado: en Perfil, «Empieza a repartir», tocas el servicio',
                  'you have not requested it yet: in Profile, “Start driving,” tap the service',
                );
    lineas.push(`${s.nombre}: ${falta}.`);
  }
  if (!lineas.length)
    lineas.push(
      t(
        c.idioma,
        'En tu ciudad todavía no hay servicios abiertos para conductores.',
        'There are no driver services open in your city yet.',
      ),
    );
  return {
    ok: true,
    texto: lineas.join('\n'),
    datos: { ciudad: d.ciudad, activos, vehiculo: e.vehiculoActivo?.estado ?? null },
  };
}

export async function explicarSaldo(c: Contexto): Promise<ResultadoHerramienta> {
  const docs = buscarEnDocs('saldo comision', c.idioma, 1)[0];
  const base = `${docs?.texto ?? ''}\n${t(c.idioma, 'Guía completa', 'Full guide')}: ${enlaceGuia('drivers/driver-balance', c.idioma)}`;
  const d = await conductorDe(c);
  if (!d?.pais || !d.moneda) return { ok: true, texto: base };
  const saldo = await saldoLibro(c.db, d.id, 'prepago', d.pais, d.moneda);
  return {
    ok: true,
    texto: `${base}\n${t(c.idioma, 'Tu saldo para comisiones hoy', 'Your balance for fees today')}: ${formatearMonto(saldo, d.moneda, c.idioma)}.`,
    datos: { saldo, moneda: d.moneda },
  };
}

/**
 * El regalo de arranque: solo a un conductor verificado, con al menos un servicio aprobado, que
 * nunca lo recibió, con el regalo de su ciudad encendido y presupuesto. El monto lo decide «Saldo de
 * conductores», nunca el modelo ni la persona. Tope propio de Camila: `regalosPorDia`.
 */
export async function darRegaloArranque(c: Contexto): Promise<ResultadoHerramienta> {
  const d = await conductorDe(c);
  if (!d) return { ok: false, texto: SIN_CUENTA(c.idioma) };
  const ya = await c.db
    .prepare(
      "SELECT monto, moneda FROM cargas_saldo_conductor WHERE conductor_id = ? AND tipo = 'regalo_nuevo'",
    )
    .bind(d.id)
    .first<{ monto: number; moneda: string }>();
  if (ya)
    return {
      ok: false,
      texto: t(
        c.idioma,
        `Ya recibiste tu regalo de arranque (${formatearMonto(ya.monto, ya.moneda, 'es')}). Se da una sola vez.`,
        `You already got your starter gift (${formatearMonto(ya.monto, ya.moneda, 'en')}). It is given only once.`,
      ),
    };
  const aprobada = await c.db
    .prepare("SELECT 1 FROM habilitaciones WHERE conductor_id = ? AND estado = 'aprobada' LIMIT 1")
    .bind(d.id)
    .first();
  if (!aprobada)
    return {
      ok: false,
      texto: t(
        c.idioma,
        'El regalo de arranque se da cuando tu cuenta queda aprobada para un servicio. Cuando el equipo la apruebe, te llega solo.',
        'The starter gift is given once your account is approved for a service. When the team approves it, it arrives on its own.',
      ),
    };
  if ((await gastoDeHoy(c.db)).regalos >= c.ajustes.regalosPorDia)
    return {
      ok: false,
      texto: t(
        c.idioma,
        'Hoy no puedo dar más regalos desde aquí. Le paso tu caso al equipo.',
        'I cannot give more gifts from here today. I am passing your case to the team.',
      ),
    };
  const monto = await darRegaloConductorNuevo(c.db, d.id);
  if (!monto)
    return {
      ok: false,
      texto: t(
        c.idioma,
        'En este momento tu ciudad no tiene el regalo de arranque disponible. Si se vuelve a abrir, te aviso.',
        'Right now your city does not have the starter gift available. If it opens again, I will let you know.',
      ),
    };
  await c.db
    .prepare(
      `INSERT INTO camila_gasto (dia, regalos) VALUES (?, 1)
       ON CONFLICT(dia) DO UPDATE SET regalos = regalos + 1`,
    )
    .bind(hoy())
    .run();
  const moneda = d.moneda ?? 'USD';
  return {
    ok: true,
    texto: t(
      c.idioma,
      `Listo: te cargué ${formatearMonto(monto, moneda, 'es')} de regalo de arranque en tu saldo para comisiones. Lo ves en Ganancias, «Cargas y regalos de saldo».`,
      `Done: I added ${formatearMonto(monto, moneda, 'en')} as your starter gift to your balance for fees. You see it under Earnings, “Balance top-ups and gifts.”`,
    ),
    datos: { monto, moneda },
  };
}

/**
 * Abre un caso para el equipo con un resumen de UNA línea y avisa por correo solo esa vez (no por
 * cada mensaje). Si ya hay un caso abierto de esta persona, no abre otro.
 */
export async function abrirCaso(
  c: Contexto,
  resumen: string,
  motivo = 'ayuda',
): Promise<ResultadoHerramienta> {
  const linea = resumen.replace(/\s+/g, ' ').trim().slice(0, 160) || c.pregunta.slice(0, 160);
  const abierto = await c.db
    .prepare("SELECT id FROM camila_casos WHERE persona_id = ? AND estado = 'abierto' LIMIT 1")
    .bind(c.persona.id)
    .first<{ id: string }>();
  if (!abierto) {
    await c.db
      .prepare('INSERT INTO camila_casos (id, persona_id, resumen, motivo) VALUES (?, ?, ?, ?)')
      .bind(nuevoId(), c.persona.id, linea, motivo.slice(0, 30))
      .run();
    const nombre = c.persona.nombre || c.persona.correo || 'Persona sin nombre';
    // Un correo por caso, y con tope por día: el caso siempre queda en la bandeja.
    const destinos = (await contarDelDia(c.db, 'casos', TOPE_CORREOS_CASO_DIA))
      ? await correosEquipo(c.env, 'sistema')
      : [];
    const base = (c.env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
    await Promise.all(
      destinos.map((para) =>
        enviarCorreo(c.env, {
          de: 'avisos',
          para,
          idioma: 'es',
          asunto: `Camila: caso nuevo de ${nombre}`,
          texto: `${linea}\n\nAbre la bandeja de Camila:\n${base}/panel/camila`,
        }).catch((e: unknown) => console.error('camila: aviso del caso', e)),
      ),
    );
  }
  return {
    ok: true,
    texto: t(
      c.idioma,
      'Abrí un caso para el equipo de soporte. Una persona del equipo te responde por aquí mismo.',
      'I opened a case for the support team. A person on the team will reply right here.',
    ),
  };
}

export async function buscarRespuesta(c: Contexto, tema: string): Promise<ResultadoHerramienta> {
  const q = `${tema} ${c.pregunta}`;
  const encontradas = [...(await buscarAprobadas(c.db, q, c.idioma)), ...buscarEnDocs(q, c.idioma)];
  if (!encontradas.length)
    return {
      ok: false,
      texto: t(c.idioma, 'No hay nada sobre eso en Docs.', 'There is nothing about that in Docs.'),
    };
  return {
    ok: true,
    texto: encontradas
      .map((e) => (e.guia ? `${e.texto}\n(${enlaceGuia(e.guia, c.idioma)})` : e.texto))
      .join('\n\n'),
  };
}

/** Lo que no supo responder queda anotado para la lista semanal (una vez por pregunta parecida). */
export async function anotarSinRespuesta(
  c: Contexto,
  pregunta?: string,
): Promise<ResultadoHerramienta> {
  await c.db
    .prepare(
      'INSERT INTO camila_sin_respuesta (id, persona_id, pregunta, idioma) VALUES (?, ?, ?, ?)',
    )
    .bind(nuevoId(), c.persona.id, (pregunta || c.pregunta).slice(0, 500), c.idioma)
    .run();
  return { ok: true, texto: 'anotado' };
}

export async function miEquipo(c: Contexto): Promise<ResultadoHerramienta> {
  if (!c.persona.usuario_id) return { ok: false, texto: SIN_CUENTA(c.idioma) };
  const n = await contadorDelLider(c.db, c.persona.usuario_id, c.env);
  if (!n)
    return {
      ok: false,
      texto: t(
        c.idioma,
        'Todavía no tienes un equipo a tu nombre. Si quieres ser líder de equipo, le paso tu pedido al equipo de Divoox.',
        'You do not have a team in your name yet. If you want to be a team leader, I will pass your request to the Divoox team.',
      ),
    };
  return {
    ok: true,
    texto: t(
      c.idioma,
      `Tu equipo «${n.equipo}»: ${n.registrados} registrados y ${n.activos} aprobados. Tu enlace para registrar a tu gente: ${n.enlace}. Tu código QR está en Divoox Driver, «Mi equipo».`,
      `Your team “${n.equipo}”: ${n.registrados} signed up and ${n.activos} approved. Your link to sign up your people: ${n.enlace}. Your QR code is in Divoox Driver, “My team.”`,
    ),
    datos: n,
  };
}

/** Las herramientas que ve el modelo. Ninguna lleva id, correo ni monto (C-CAMILA-HERRAMIENTAS). */
export const HERRAMIENTAS_MODELO: Herramienta[] = [
  {
    name: 'estado_cuenta',
    description:
      'Mira la cuenta de conductor de la persona que escribe y dice qué le falta para activarse.',
  },
  {
    name: 'explicar_saldo',
    description:
      'Explica el saldo para comisiones y la comisión (según Docs) y dice el saldo de la persona que escribe.',
  },
  {
    name: 'dar_regalo_arranque',
    description:
      'Da el regalo de arranque a la persona que escribe si le corresponde. El monto lo fija Divoox; nunca se elige.',
  },
  {
    name: 'abrir_caso',
    description:
      'Abre un caso para el equipo humano de soporte cuando no puedes resolverlo o la persona lo pide.',
    parameters: {
      type: 'object',
      properties: {
        resumen: { type: 'string', description: 'Una sola línea, menos de 140 caracteres.' },
      },
      required: ['resumen'],
    },
  },
  {
    name: 'buscar_respuesta',
    description: 'Busca en Docs públicos de Divoox y en las respuestas aprobadas por el equipo.',
    parameters: { type: 'object', properties: { tema: { type: 'string' } }, required: ['tema'] },
  },
  {
    name: 'no_se',
    description:
      'Anota la pregunta que no sabes responder con Docs ni con lo aprobado, para que el equipo prepare la respuesta.',
    parameters: { type: 'object', properties: { pregunta: { type: 'string' } } },
  },
  {
    name: 'mi_equipo',
    description:
      'Para líderes de equipo: cuántos registró la persona que escribe, cuántos están activos y su enlace.',
  },
];

export async function ejecutar(c: Contexto, nombre: string, args: Record<string, unknown> = {}) {
  const valores = new Map(Object.entries(args));
  const texto = (k: string) => {
    const v = valores.get(k);
    return typeof v === 'string' ? v : '';
  };
  switch (nombre) {
    case 'estado_cuenta':
      return estadoCuenta(c);
    case 'explicar_saldo':
      return explicarSaldo(c);
    case 'dar_regalo_arranque':
      return darRegaloArranque(c);
    case 'abrir_caso':
      return abrirCaso(c, texto('resumen'));
    case 'buscar_respuesta':
      return buscarRespuesta(c, texto('tema'));
    case 'no_se':
      return anotarSinRespuesta(c, texto('pregunta'));
    case 'mi_equipo':
      return miEquipo(c);
    default:
      return { ok: false, texto: 'Herramienta desconocida.' };
  }
}
