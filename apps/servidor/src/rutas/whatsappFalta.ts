import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { alcanceEsTotal } from '@tumbite/compartido';
import type { Env } from '../env';
import { accesoDe } from '../accesoInterno';
import { zonaRealSql } from '../cuentaPais';
import { ZONA_REVISION_TIENDAS } from '../panicoZona';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { proveedorWhatsapp, whatsappConfigurado } from '../whatsapp';
import {
  AJUSTES_WHATSAPP_FALTA_DE_FABRICA,
  ESTADOS_PLANTILLA,
  HORAS_ENTRE_MENSAJES,
  LOTE_ZONA,
  MAX_POR_PASO,
  type Evaluacion,
  type Persona,
  SQL_CUENTA_INTERNA,
  conductoresDeZona,
  enviarUno,
  esquemaAjustesWhatsappFalta,
  estadoCanal,
  estadosCanal,
  evaluarUno,
  evaluarVarios,
  gastoDelDia,
  guardarAjustesWhatsappFalta,
  guardarEstadoPlantilla,
} from '../whatsappFalta';
import { PLANTILLAS_FALTA, PLANTILLA_FALTA_CATEGORIA } from '../whatsappPlantillaFalta';

/**
 * C-WHATSAPP-FALTA (25 nov 2026) — las rutas del panel:
 * - GET/PUT /admin/camila/whatsapp: el estado del canal (credenciales, plantilla, países, presupuesto y
 *   gasto del día) y sus ajustes. Cambiar algo exige alcance total y queda en auditoria_admin.
 * - POST /admin/camila/whatsapp/:id: «Mandarle por WhatsApp lo que le falta» de la ficha y de
 *   Verificaciones. `soloVista` arma el texto exacto sin enviar ni escribir; enviar exige `confirmar`.
 *   Las 24 horas entre mensajes y el consentimiento nunca se saltan, tampoco a mano.
 * - GET/POST /admin/camila/whatsapp/zona/:zona: «a todos los trabados de esta zona», con vista previa
 *   y confirmación. Nunca se manda con un guion a mano contra producción: se manda desde aquí.
 */
export const whatsappFaltaRutas = new Hono<{ Bindings: Env; Variables: Variables }>();
type Ctx = Context<{ Bindings: Env; Variables: Variables }>;

function exigirAlcanceTotal(c: Ctx) {
  const a = accesoDe(c);
  if (a && !alcanceEsTotal(a.alcance))
    throw new ErrorDatos(
      'Esto es de toda la empresa: lo hace alguien con alcance total.',
      'permiso',
      403,
    );
}

const auditar = (
  db: D1Database,
  actor: string,
  accion: string,
  objeto: string,
  antes: unknown,
  despues: unknown,
) =>
  db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      actor,
      accion,
      objeto,
      antes === null ? null : JSON.stringify(antes),
      JSON.stringify(despues),
    );

/** Lo que el panel necesita de una evaluación (sin el teléfono: el panel no lo pide). */
const vistaDe = (e: Evaluacion) => ({
  id: e.persona.id,
  nombre: e.persona.nombre,
  falta: e.falta,
  texto: e.texto,
  puede: e.puede,
  motivo: e.motivo,
  delPaso: e.delPaso,
  ultimoEn: e.ultimoEn,
  // C-WHATSAPP-FALTA-IDIOMAS: en qué idioma sale, el de su cuenta y cuáles se pueden mandar hoy.
  idioma: e.persona.idioma,
  idiomaCuenta: e.persona.idiomaCuenta ?? e.persona.idioma,
  idiomas: e.idiomas,
});

whatsappFaltaRutas.get('/admin/camila/whatsapp', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const canales = await estadosCanal(c.env, db);
  const canal = canales.es;
  const gasto = await gastoDelDia(db, canal.ajustes);
  const { results: zonas } = await db
    .prepare('SELECT id, nombre, pais FROM zonas WHERE activa = 1 ORDER BY pais, nombre LIMIT 300')
    .all<{ id: string; nombre: string; pais: string }>();
  const def = PLANTILLAS_FALTA.es!;
  return c.json({
    listo: canal.listo,
    motivo: canal.motivo,
    credenciales: whatsappConfigurado(c.env),
    proveedor: proveedorWhatsapp(c.env),
    plantilla: {
      nombre: def.nombre,
      idioma: def.idioma,
      categoriaPedida: PLANTILLA_FALTA_CATEGORIA,
      cuerpo: def.cuerpo,
      ...canal.plantilla,
    },
    // C-WHATSAPP-FALTA-IDIOMAS: la traducción en inglés de EE. UU., con su propio estado en Meta.
    plantillaEn: {
      nombre: PLANTILLAS_FALTA.en!.nombre,
      idioma: PLANTILLAS_FALTA.en!.idioma,
      categoriaPedida: PLANTILLA_FALTA_CATEGORIA,
      cuerpo: PLANTILLAS_FALTA.en!.cuerpo,
      listo: canales.en.listo,
      ...canales.en.plantilla,
    },
    ajustes: canal.ajustes,
    fabrica: AJUSTES_WHATSAPP_FALTA_DE_FABRICA,
    gasto,
    topes: { porPaso: MAX_POR_PASO, horas: HORAS_ENTRE_MENSAJES, loteZona: LOTE_ZONA },
    zonas,
  });
});

const cuerpoAjustes = esquemaAjustesWhatsappFalta.extend({
  /** Marcar a mano el estado de la plantilla (lo que se ve en el administrador de WhatsApp de Meta). */
  plantilla: z
    .object({
      estado: z.enum(ESTADOS_PLANTILLA),
      /** La categoría que dice Meta. Sin ella, no se supone utilidad: no se envía. */
      categoria: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).nullable().optional(),
      /** C-WHATSAPP-FALTA-IDIOMAS: cuál de las dos traducciones (sin decirlo, la española). */
      idioma: z.enum(['es', 'en']).optional(),
    })
    .optional(),
});

whatsappFaltaRutas.put('/admin/camila/whatsapp', async (c) => {
  const yo = exigir(c, 'admin');
  exigirAlcanceTotal(c);
  const d = await leerCuerpo(c, cuerpoAjustes);
  const db = base(c);
  const idiomaPlantilla = d.plantilla?.idioma ?? 'es';
  const antes = await estadoCanal(c.env, db, idiomaPlantilla);
  const { plantilla, ...ajustes } = d;
  const lotes = [];
  await guardarAjustesWhatsappFalta(db, ajustes);
  lotes.push(
    auditar(db, yo.id, 'whatsapp_falta_ajustes', 'config:whatsapp_falta', antes.ajustes, ajustes),
  );
  const categoria =
    plantilla?.categoria === undefined ? antes.plantilla.categoria : plantilla.categoria;
  if (
    plantilla &&
    (plantilla.estado !== antes.plantilla.estado || categoria !== antes.plantilla.categoria)
  ) {
    const def = (idiomaPlantilla === 'en' ? PLANTILLAS_FALTA.en : PLANTILLAS_FALTA.es)!;
    await guardarEstadoPlantilla(db, def.nombre, def.idioma, {
      estado: plantilla.estado,
      categoria,
      motivo: null,
      fuente: 'equipo',
    });
    lotes.push(
      auditar(
        db,
        yo.id,
        'whatsapp_plantilla_estado',
        `plantilla:${def.nombre}:${def.idioma}`,
        { estado: antes.plantilla.estado, categoria: antes.plantilla.categoria },
        { estado: plantilla.estado, categoria },
      ),
    );
  }
  await db.batch(lotes);
  const despues = await estadoCanal(c.env, db);
  return c.json({
    listo: despues.listo,
    motivo: despues.motivo,
    ajustes: despues.ajustes,
    plantilla: despues.plantilla,
  });
});

/** La persona tal como la necesita la evaluación. */
async function personaDe(db: D1Database, id: string): Promise<Persona> {
  const u = await db
    .prepare(
      `SELECT u.id, u.nombre, u.idioma, u.rol, u.activo, z.pais
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
         LEFT JOIN zonas z ON z.id = ${zonaRealSql('r', 'u')}
        WHERE u.id = ?`,
    )
    .bind(id)
    .first<{
      id: string;
      nombre: string;
      idioma: string;
      rol: string;
      activo: number;
      pais: string | null;
    }>();
  if (!u || !Number(u.activo)) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  return {
    id: u.id,
    nombre: u.nombre,
    idioma: u.idioma === 'en' ? 'en' : 'es',
    pais: u.pais,
    rol: u.rol,
  };
}

const cuerpoUno = z.object({
  soloVista: z.boolean().optional(),
  confirmar: z.boolean().optional(),
  /** C-WHATSAPP-FALTA-IDIOMAS: el idioma que eligió el equipo (sin decirlo, el de su cuenta). */
  idioma: z.enum(['es', 'en']).optional(),
});

whatsappFaltaRutas.post('/admin/camila/whatsapp/:id', async (c) => {
  const yo = exigir(c, 'admin');
  const d = await leerCuerpo(c, cuerpoUno);
  const db = base(c);
  const cuenta = await personaDe(db, c.req.param('id'));
  const p: Persona = d.idioma
    ? { ...cuenta, idioma: d.idioma, idiomaCuenta: cuenta.idioma }
    : cuenta;
  if (d.soloVista || !d.confirmar) {
    const { evaluacion, canal, gasto } = await evaluarUno(c.env, db, p);
    return c.json({ vista: vistaDe(evaluacion), listo: canal.listo, motivo: canal.motivo, gasto });
  }
  // C-WHATSAPP-FALTA: a mano tampoco se salta nada (ni las 24 horas). La auditoría se reserva antes
  // de llamar a Meta y se completa después (whatsappFalta.ts, `enviar`).
  const { evaluacion, resultado } = await enviarUno(c.env, db, p, { actorId: yo.id });
  if (!resultado)
    // Nada salió: no se escribe nada. El panel dice por qué en palabras.
    return c.json({ vista: vistaDe(evaluacion), enviado: false, motivo: evaluacion.motivo });
  return c.json({
    vista: vistaDe(evaluacion),
    enviado: resultado.estado === 'enviado',
    estado: resultado.estado,
  });
});

// ───────────────────────── A todos los trabados de una zona ─────────────────────────

const pagina = (c: Ctx) => {
  const n = Number(c.req.query('pagina') ?? '0');
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : 0;
};

async function zonaExiste(db: D1Database, zona: string) {
  const z = await db
    .prepare('SELECT id, nombre, pais FROM zonas WHERE id = ?')
    .bind(zona)
    .first<{ id: string; nombre: string; pais: string }>();
  if (!z) throw new ErrorDatos('Esa zona no existe.', 'zona', 404);
  // C-WHATSAPP-FALTA: la zona de revisión de las tiendas nunca recibe envíos masivos.
  if (z.id === ZONA_REVISION_TIENDAS)
    throw new ErrorDatos(
      'Esa es la zona de revisión de las tiendas: ahí no se manda nada.',
      'zona',
      403,
    );
  return z;
}

whatsappFaltaRutas.get('/admin/camila/whatsapp/zona/:zona', async (c) => {
  exigir(c, 'admin');
  exigirAlcanceTotal(c);
  const db = base(c);
  const zona = await zonaExiste(db, c.req.param('zona'));
  const personas = await conductoresDeZona(db, zona.id, pagina(c));
  const r = await evaluarVarios(c.env, db, personas);
  return c.json({
    zona,
    pagina: pagina(c),
    hayMas: personas.length === LOTE_ZONA,
    listo: r.canal.listo,
    motivo: r.canal.motivo,
    gasto: r.gasto,
    filas: r.filas.map(vistaDe),
  });
});

const cuerpoZona = z.object({
  /** Las cuentas que el equipo vio en la vista previa y confirmó (se vuelve a decidir cada una). */
  ids: z.array(z.string().min(8).max(64)).min(1).max(LOTE_ZONA),
  confirmar: z.literal(true),
});

whatsappFaltaRutas.post('/admin/camila/whatsapp/zona/:zona', async (c) => {
  const yo = exigir(c, 'admin');
  exigirAlcanceTotal(c);
  const d = await leerCuerpo(c, cuerpoZona);
  const db = base(c);
  const zona = await zonaExiste(db, c.req.param('zona'));
  // Solo los de ESA zona (una lista con cuentas de otra zona no manda nada a nadie de afuera).
  const { results } = await db
    .prepare(
      `WITH ids AS MATERIALIZED (SELECT value AS id FROM json_each(?))
       SELECT u.id, u.nombre, u.idioma, z.pais FROM ids JOIN usuarios u ON u.id = ids.id
         JOIN repartidores r ON r.usuario_id = u.id JOIN zonas z ON z.id = ${zonaRealSql('r', 'u')}
        WHERE z.id = ? AND u.rol = 'repartidor' AND u.activo = 1 AND NOT ${SQL_CUENTA_INTERNA('u')}`,
    )
    .bind(JSON.stringify([...new Set(d.ids)]), zona.id)
    .all<{ id: string; nombre: string; idioma: string; pais: string | null }>();
  const personas: Persona[] = results.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    idioma: f.idioma === 'en' ? 'en' : 'es',
    pais: f.pais,
    rol: 'repartidor',
  }));
  // Cada envío reserva su auditoría antes de llamar a Meta y la completa después.
  const r = await evaluarVarios(c.env, db, personas, {
    enviar: { origen: 'manual', actorId: yo.id, auditoria: { zona: zona.id } },
  });
  const salieron = r.filas.filter((f) => f.resultado);
  return c.json({
    enviados: salieron.filter((f) => f.resultado!.estado === 'enviado').length,
    fallidos: salieron.filter((f) => f.resultado!.estado === 'fallido').length,
    filas: r.filas.map((f) => ({ ...vistaDe(f), estado: f.resultado?.estado ?? null })),
  });
});
