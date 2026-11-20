import { Hono } from 'hono';
import { z } from 'zod';
import {
  IDIOMAS_PERFIL,
  MAX_DATO_PERFIL,
  type PerfilConductorPublico,
  idiomasValidos,
  leerIdiomasGuardados,
  limpiarDato,
  trayectoriaPublica,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { tieneOfensivas } from '../filtroPalabras';
import { estrellasQueCuentan } from './repartidorGrandes';

/**
 * C-PERFIL-CONDUCTOR (20 nov 2026, todos los países): «Así te ven los pasajeros», como la tarjeta
 * del conductor de Uber y DiDi. Lo que se muestra lo decide `vistaPerfilConductor` del paquete
 * compartido; aquí solo se arma lo público.
 *
 * - El conductor ve y edita el suyo (idiomas y un dato corto, que pasa por el filtro de palabras).
 * - El pasajero ve SOLO el del conductor de SU viaje activo (asignado, llegó o en curso).
 * - Hacia el pasajero nunca sale el apellido, el teléfono, el correo ni el documento.
 * - Leer no escribe nada. Tres consultas acotadas por índice (usuario, vehículo, últimas 100
 *   estrellas); el conteo de viajes usa pedidos_repartidor_estado y operaciones_conductor.
 */
export const perfilConductor = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaPerfil = {
  nombre: string | null;
  desde: string | null;
  idiomas_perfil: string | null;
  dato_perfil: string | null;
  vehiculo_activo_id: string | null;
  identidad: number | null;
  foto: number | null;
  linea: string | null;
  pedidos: number | null;
  operaciones: number | null;
};

/** El perfil público de un conductor. `vehiculoId` = el del viaje (pasajero) o el activo (propio). */
export async function perfilPublicoConductor(
  db: D1Database,
  conductorId: string,
  vehiculoId?: string | null,
): Promise<PerfilConductorPublico | null> {
  const f = await db
    .prepare(
      `SELECT u.nombre, COALESCE(r.creado_en, u.creado_en) AS desde, r.idiomas_perfil, r.dato_perfil,
              r.vehiculo_activo_id,
              (SELECT 1 FROM kyc ky WHERE ky.usuario_id = u.id AND ky.estado = 'aprobado') AS identidad,
              (SELECT 1 FROM kyc ky WHERE ky.usuario_id = u.id AND ky.estado = 'aprobado'
                 AND ky.selfie_miniatura IS NOT NULL) AS foto,
              COALESCE(
                (SELECT e.nombre FROM miembros_equipo m JOIN lineas l ON l.equipo_id = m.equipo_id
                   JOIN equipos e ON e.id = m.equipo_id WHERE m.usuario_id = u.id AND e.activo = 1 LIMIT 1),
                (SELECT e.nombre FROM equipos e JOIN lineas l ON l.equipo_id = e.id
                  WHERE e.lider_id = u.id AND e.activo = 1 LIMIT 1)) AS linea,
              (SELECT COUNT(*) FROM pedidos p WHERE p.repartidor_id = u.id AND p.estado = 'entregado') AS pedidos,
              (SELECT COUNT(*) FROM operaciones o WHERE o.conductor_id = u.id
                 AND o.estado_general = 'terminada') AS operaciones
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?`,
    )
    .bind(conductorId)
    .first<FilaPerfil>();
  if (!f) return null;
  const vid = vehiculoId ?? f.vehiculo_activo_id;
  const v = vid
    ? await db
        .prepare(
          'SELECT marca, modelo, color, placa, estado FROM vehiculos WHERE id = ? AND conductor_id = ?',
        )
        .bind(vid, conductorId)
        .first<{
          marca: string | null;
          modelo: string | null;
          color: string | null;
          placa: string | null;
          estado: string;
        }>()
    : null;
  const { cuentan, promedio } = await estrellasQueCuentan(db, conductorId);
  const viajes = Number(f.pedidos ?? 0) + Number(f.operaciones ?? 0);
  return {
    // Solo el nombre de pila: el apellido nunca sale hacia el pasajero.
    nombre: (f.nombre ?? '').trim().split(/\s+/)[0] ?? '',
    vehiculo: v ? { marca: v.marca, modelo: v.modelo, color: v.color } : null,
    placa: v?.placa?.trim() || null,
    trayectoria: trayectoriaPublica(viajes, promedio, cuentan.length, f.desde),
    identidadVerificada: f.identidad === 1,
    vehiculoVerificado: v?.estado === 'aprobado',
    foto: f.foto === 1,
    linea: f.linea?.trim() || null,
    idiomas: leerIdiomasGuardados(f.idiomas_perfil),
    dato: limpiarDato(f.dato_perfil) || null,
  };
}

/** El conductor: su propio perfil, tal como lo ven los pasajeros, y lo que puede editar. */
perfilConductor.get('/repartidor/perfil', async (c) => {
  const u = exigir(c, 'repartidor');
  const perfil = await perfilPublicoConductor(base(c), u.id);
  if (!perfil) throw new ErrorDatos('No encontramos tu cuenta.', undefined, 404);
  return c.json({ perfil });
});

/** Idiomas que habla y un dato corto. El dato con palabras ofensivas no se guarda. */
perfilConductor.put('/repartidor/perfil', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(
    c,
    z.object({
      idiomas: z.array(z.enum(IDIOMAS_PERFIL)).max(IDIOMAS_PERFIL.length),
      dato: z
        .string()
        .max(MAX_DATO_PERFIL * 2)
        .default(''),
    }),
  );
  const dato = limpiarDato(d.dato);
  if (d.dato.replace(/\s+/g, ' ').trim().length > MAX_DATO_PERFIL)
    throw new ErrorDatos('Escribe algo más corto: hasta 120 letras.', 'dato', 422);
  if (dato && tieneOfensivas(dato))
    throw new ErrorDatos(
      'Tu dato tiene palabras que no se permiten. Escríbelo de otra forma.',
      'dato',
      422,
    );
  const idiomas = idiomasValidos(d.idiomas).join(',');
  const db = base(c);
  await db
    .prepare(
      `INSERT INTO repartidores (usuario_id, idiomas_perfil, dato_perfil) VALUES (?1, ?2, ?3)
       ON CONFLICT(usuario_id) DO UPDATE SET idiomas_perfil = ?2, dato_perfil = ?3`,
    )
    .bind(u.id, idiomas, dato)
    .run();
  return c.json({ ok: true, perfil: await perfilPublicoConductor(db, u.id) });
});

/** Su propia foto (la miniatura de su selfie aprobada), para verse como lo ve el pasajero. */
perfilConductor.get('/repartidor/perfil/foto', async (c) => {
  const u = exigir(c, 'repartidor');
  const f = await base(c)
    .prepare("SELECT selfie_miniatura FROM kyc WHERE usuario_id = ? AND estado = 'aprobado'")
    .bind(u.id)
    .first<{ selfie_miniatura: string | null }>();
  const obj =
    f?.selfie_miniatura && c.env.BUCKET ? await c.env.BUCKET.get(f.selfie_miniatura) : null;
  if (!obj) throw new ErrorDatos('No hay foto para mostrar.', undefined, 404);
  return new Response(obj.body, {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});

/**
 * El pasajero: el perfil del conductor de SU viaje, solo mientras viene o lo lleva. De otro viaje,
 * de otro pasajero o de un viaje ya terminado: 404 (no se dice si existe).
 */
perfilConductor.get('/viajes/:id/conductor/perfil', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const f = await db
    .prepare(
      `SELECT o.conductor_id, o.vehiculo_id FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
        WHERE o.id = ? AND o.cliente_id = ? AND o.conductor_id IS NOT NULL
          AND v.estado IN ('asignado', 'conductor_llego', 'en_curso')`,
    )
    .bind(c.req.param('id'), u.id)
    .first<{ conductor_id: string; vehiculo_id: string | null }>();
  const perfil = f ? await perfilPublicoConductor(db, f.conductor_id, f.vehiculo_id) : null;
  if (!perfil) throw new ErrorDatos('Ese viaje no existe.', undefined, 404);
  return c.json({ perfil });
});
