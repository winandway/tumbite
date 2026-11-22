import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { alcanceEsTotal } from '@tumbite/compartido';
import type { Env } from '../env';
import { accesoDe } from '../accesoInterno';
import { limiteIntentos } from '../seguridad';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { smsConfigurado } from '../sms';
import { smsMasivoEncendido } from '../smsMasivo';
import {
  AJUSTES_REZAGADOS_DE_FABRICA,
  LIMITES_REZAGADOS,
  PASOS_REZAGADO,
  PLANTILLAS_DE_FABRICA,
  candidatos,
  darDeBaja,
  enviarMensajeRegistro,
  envioDePlantilla,
  esquemaAjustesRezagados,
  guardarAjustesRezagados,
  leerAjustesRezagados,
  smsDeRegistroEncendido,
} from '../rezagados';

/**
 * C-REZAGADOS (22 nov 2026) — las rutas: lo que el equipo ve y cambia en «Recordatorios de registro»,
 * el «Enviar mensaje» de la ficha de una cuenta y la baja pública del enlace del correo.
 */
export const rezagadosRutas = new Hono<{ Bindings: Env; Variables: Variables }>();
type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

function exigirAlcanceTotal(c: Ctx) {
  const a = accesoDe(c);
  if (a && !alcanceEsTotal(a.alcance))
    throw new ErrorDatos(
      'Esto es de toda la empresa: lo cambia alguien con alcance total.',
      'permiso',
      403,
    );
}

rezagadosRutas.get('/admin/camila/recordatorios', async (c) => {
  exigir(c, 'admin');
  exigirAlcanceTotal(c);
  const db = base(c);
  const ajustes = await leerAjustesRezagados(db);
  const { results: zonas } = await db
    .prepare('SELECT id, nombre, pais FROM zonas WHERE activa = 1 ORDER BY pais, nombre LIMIT 300')
    .all<{ id: string; nombre: string; pais: string }>();
  const activas = Object.entries(ajustes.zonas)
    .filter(([, m]) => m !== 'apagado')
    .map(([z]) => z);
  // La lista «a quiénes les escribiría»: solo lee; es la misma cuenta que hace la vuelta del reloj.
  const lista = await candidatos(c.env, db, ajustes, activas);
  const { results: recientes } = await db
    .prepare(
      `SELECT m.creado_en, m.usuario_id, u.nombre, u.rol, m.paso, m.canal, m.origen, m.numero, m.estado, m.detalle
         FROM rezagados_mensajes m LEFT JOIN usuarios u ON u.id = m.usuario_id
        ORDER BY m.creado_en DESC LIMIT 50`,
    )
    .all();
  return c.json({
    ajustes,
    fabrica: { ajustes: AJUSTES_REZAGADOS_DE_FABRICA, plantillas: PLANTILLAS_DE_FABRICA },
    limites: LIMITES_REZAGADOS,
    pasos: PASOS_REZAGADO,
    zonas,
    lista: lista.map((p) => ({
      id: p.id,
      rol: p.rol,
      nombre: p.nombre,
      zona: p.zona,
      zonaNombre: p.zonaNombre,
      modo: ajustes.zonas[p.zona] ?? 'apagado',
      autorizado: ajustes.autorizados.includes(p.id),
      creadoEn: p.creadoEn,
      paso: p.paso,
      horasQuieto: p.horasQuieto,
      delPaso: p.delPaso,
      toca: p.toca,
      motivo: p.motivo,
      canales: p.canales,
    })),
    recientes,
    // Qué proveedor de SMS puede entregar hoy (solo configuración; no manda nada).
    sms: {
      venezuela: smsDeRegistroEncendido(c.env) && smsMasivoEncendido(c.env),
      general: smsDeRegistroEncendido(c.env) && smsConfigurado(c.env),
    },
  });
});

rezagadosRutas.put('/admin/camila/recordatorios', async (c) => {
  const yo = exigir(c, 'admin');
  exigirAlcanceTotal(c);
  const d = await leerCuerpo(c, esquemaAjustesRezagados);
  if (!(d.plazosHoras[0] < d.plazosHoras[1] && d.plazosHoras[1] < d.plazosHoras[2]))
    throw new ErrorDatos(
      'Cada recordatorio va después del anterior: revisa las horas.',
      'plazosHoras',
      400,
    );
  if (d.horaDesde >= d.horaHasta)
    throw new ErrorDatos('La hora de inicio va antes que la de fin.', 'horaDesde', 400);
  const db = base(c);
  const antes = await leerAjustesRezagados(db);
  await guardarAjustesRezagados(db, d);
  await db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      yo.id,
      'rezagados_ajustes',
      'config:rezagados',
      JSON.stringify(antes.zonas),
      JSON.stringify(d.zonas),
    )
    .run();
  return c.json({ ajustes: d });
});

const cuerpoMensaje = z.object({
  canales: z
    .array(z.enum(['correo', 'sms', 'aviso']))
    .min(1)
    .max(3),
  plantilla: z.enum(PASOS_REZAGADO).optional(),
  asunto: z.string().trim().max(120).optional(),
  texto: z.string().trim().max(1500).optional(),
  /** Solo arma el mensaje y lo devuelve; no envía ni escribe. */
  soloVista: z.boolean().optional(),
});

rezagadosRutas.post('/admin/camila/recordatorios/:id/mensaje', async (c) => {
  const yo = exigir(c, 'admin');
  const d = await leerCuerpo(c, cuerpoMensaje);
  const db = base(c);
  const u = await db
    .prepare(
      `SELECT u.id, u.rol, u.nombre, u.telefono, u.idioma, u.activo, COALESCE(r.zona_id, u.zona_id) AS zona,
              (SELECT pp.vence_en FROM plazo_papeles pp WHERE pp.conductor_id = u.id AND pp.estado = 'en_plazo' AND pp.vence_en > datetime('now')) AS plazo_vence
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?`,
    )
    .bind(c.req.param('id'))
    .first<{
      id: string;
      rol: string;
      nombre: string;
      telefono: string | null;
      idioma: string;
      activo: number;
      zona: string | null;
      plazo_vence: string | null;
    }>();
  if (!u || !u.activo) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  const idioma = u.idioma === 'en' ? 'en' : 'es';
  const ajustes = await leerAjustesRezagados(db);
  const persona = {
    id: u.id,
    rol: u.rol,
    nombre: u.nombre,
    telefono: u.telefono,
    idioma,
    zona: u.zona ?? '',
    plazoVence: u.plazo_vence,
  } as const;
  const deFabrica = d.plantilla ? envioDePlantilla(c.env, ajustes, persona, d.plantilla) : null;
  const texto = d.texto || deFabrica?.texto || '';
  if (texto.length < 10)
    throw new ErrorDatos('Escribe el mensaje o elige una plantilla.', 'texto', 400);
  const asunto =
    d.asunto ||
    deFabrica?.asunto ||
    (idioma === 'en' ? 'A message from Divoox' : 'Un mensaje de Divoox');
  // El SMS de un texto libre es el mismo texto, recortado a un SMS.
  const sms = d.texto ? texto.slice(0, 160) : (deFabrica?.sms ?? texto.slice(0, 160));
  const fijo = { titulo: asunto.slice(0, 60), cuerpo: texto.slice(0, 140) };
  // Un texto libre se manda tal como lo escribió el equipo; una plantilla, en el idioma de cada aparato.
  const aviso = d.texto || !deFabrica ? () => fijo : deFabrica.aviso;
  if (d.soloVista) return c.json({ vista: { asunto, texto, sms, aviso: aviso(idioma), idioma } });
  const resultados = await enviarMensajeRegistro(c.env, db, {
    usuarioId: u.id,
    rol: u.rol,
    nombre: u.nombre,
    telefono: u.telefono,
    idioma,
    paso: d.plantilla ?? 'libre',
    canales: [...new Set(d.canales)],
    origen: 'manual',
    numero: 0,
    asunto,
    texto,
    sms,
    aviso,
    actorId: yo.id,
  });
  return c.json({ resultados });
});

// ───────────────────────── La baja (pública) ─────────────────────────

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const pagina = (en: boolean, titulo: string, cuerpo: string, boton?: string) =>
  `<!doctype html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Divoox</title></head><body style="margin:0;background:#F4F4F4;font-family:Arial,Helvetica,sans-serif;color:#101010"><main style="max-width:480px;margin:48px auto;padding:0 16px"><img src="/marca/divoox-logo-correo.png" width="160" height="39" alt="Divoox" style="display:block;margin:0 0 20px"><div style="background:#fff;border:1px solid #E6E6E6;border-radius:12px;padding:28px"><h1 style="font-size:20px;margin:0 0 12px">${titulo}</h1><p style="font-size:16px;line-height:1.6;margin:0 0 8px">${cuerpo}</p>${boton ? `<form method="post" style="margin:20px 0 0"><button type="submit" style="background:#101010;color:#fff;border:0;border-radius:10px;padding:14px 24px;font-size:16px;font-weight:700;cursor:pointer">${boton}</button></form>` : ''}</div><p style="font-size:12px;color:#666B73;text-align:center;margin:20px 0 0">© ${new Date().getUTCFullYear()} divoox.com | All rights reserved. Developed by <a href="https://windoce.com" target="_blank" rel="noopener noreferrer" style="color:#666B73">Windoce LLC</a></p></main></body></html>`;
const enIngles = (c: Ctx) => /^en\b/i.test(c.req.header('accept-language') ?? '');

rezagadosRutas.use('/reminders/off', limiteIntentos(20, 60_000));
// Abrir el enlace no da de baja (los filtros de correo abren los enlaces solos): hay que tocar el botón.
rezagadosRutas.get('/reminders/off', (c) => {
  const en = enIngles(c);
  return c.html(
    pagina(
      en,
      en ? 'Stop sign-up reminders' : 'Dejar de recibir recordatorios',
      en
        ? 'We will stop sending you reminders about finishing your sign-up. Messages about your trips and your account are not affected.'
        : 'Dejaremos de enviarte recordatorios para terminar tu registro. Los mensajes de tus viajes y de tu cuenta no cambian.',
      en ? 'Stop the reminders' : 'No enviarme más recordatorios',
    ),
  );
});
rezagadosRutas.post('/reminders/off', async (c) => {
  const en = enIngles(c);
  const m = c.req.query('m') ?? '';
  const ok = ID.test(m) && (await darDeBaja(base(c), m));
  return c.html(
    ok
      ? pagina(
          en,
          en ? 'Done' : 'Listo',
          en
            ? 'You will not get more sign-up reminders. You can finish your sign-up in the app whenever you want.'
            : 'No recibirás más recordatorios de registro. Puedes terminar tu registro en la app cuando quieras.',
        )
      : pagina(
          en,
          en ? 'This link is no longer valid' : 'Este enlace ya no sirve',
          en
            ? 'If you still get reminders, reply to the email and we will stop them.'
            : 'Si te siguen llegando recordatorios, responde ese correo y los detenemos.',
        ),
    ok ? 200 : 404,
  );
});
