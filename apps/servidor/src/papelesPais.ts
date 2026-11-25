import {
  type DondePapel,
  type ListaPapelesPais,
  type ServicioPasajeros,
  TIPOS_PAPEL_CONDUCTOR,
  TIPOS_PAPEL_VEHICULO,
  listaPapelesDeFabrica,
  normalizarLista,
  papelesDelServicio,
  perfilPasajeros,
} from '@tumbite/compartido';
import { z } from 'zod';
import { ZONA_CONDUCTOR_SQL } from './cuentaPais';
import { politicaDesdeConfig } from './plazoPapeles';

/**
 * C-PAPELES-POR-PAIS, segunda parte (24 nov 2026) — todos los países por configuración; Venezuela
 * lista para encender; Estados Unidos sin cambios.
 *
 * La lista de papeles de cada país vive en su configuración (`config`, clave `pais:XX`, campo
 * `papelesPais`), igual que el plazo de papeles. Esta pieza la LEE (nunca escribe por mirar) y dice,
 * de un conductor, qué papeles de su país «solo se piden» le faltan. Los que frenan ya los nombra la
 * barra con sus pasos de siempre (vehículo, requisitos): aquí no se repiten ni se toca el reparto.
 */

const SERVICIO = z.enum(['moto', 'carro']);
export const esquemaPapelDeLista = z
  .object({
    tipo: z.string().regex(/^[a-z_]{2,40}$/),
    donde: z.enum(['conductor', 'vehiculo']),
    servicios: z.array(SERVICIO).min(1).max(2),
    es: z.string().trim().min(2).max(120),
    en: z.string().trim().min(2).max(120),
    vence: z.boolean(),
    foto: z.boolean(),
    frena: z.boolean(),
    // Lo que no sea un papel del vehículo lo quita `normalizarLista`.
    tambien: z
      .array(z.string().regex(/^[a-z_]{2,40}$/))
      .max(3)
      .optional(),
  })
  .refine(
    (p) =>
      p.donde === 'vehiculo'
        ? (TIPOS_PAPEL_VEHICULO as readonly string[]).includes(p.tipo)
        : (TIPOS_PAPEL_CONDUCTOR as readonly string[]).includes(p.tipo),
    { error: 'Ese papel no está en la lista de papeles que se pueden pedir.' },
  );
export const esquemaListaPapeles = z.object({
  activa: z.boolean(),
  papeles: z.array(esquemaPapelDeLista).max(24),
});

/** La lista del país: la guardada (con la verdad del reparto puesta) o la de fábrica. Pieza pura. */
export function listaDesdeConfig(pais: string, valor: string | null): ListaPapelesPais {
  const perfil = perfilPasajeros(pais);
  const exentos = politicaDesdeConfig(pais, valor).exentos;
  let lista = listaPapelesDeFabrica(perfil);
  if (valor) {
    try {
      const r = z
        .object({ papelesPais: esquemaListaPapeles.optional() })
        .passthrough()
        .safeParse(JSON.parse(valor));
      if (r.success && r.data.papelesPais) lista = r.data.papelesPais;
      else if (!r.success) console.error('papeles del país: configuración dañada', pais);
    } catch {
      console.error('papeles del país: configuración ilegible', pais);
    }
  }
  return normalizarLista(lista, perfil, exentos);
}

export async function listaPapeles(db: D1Database, pais: string): Promise<ListaPapelesPais> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(`pais:${pais.toUpperCase()}`)
    .first<{ valor: string }>();
  return listaDesdeConfig(pais.toUpperCase(), f?.valor ?? null);
}

/** La lista ENCENDIDA del país del conductor, o null (apagada: todo como siempre). */
export async function listaEncendidaDelConductor(
  db: D1Database,
  conductorId: string,
): Promise<{ pais: string; lista: ListaPapelesPais } | null> {
  const f = await db
    .prepare(
      `SELECT z.pais, (SELECT valor FROM config WHERE clave = 'pais:' || z.pais) AS cfg
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
         JOIN zonas z ON z.id = ${ZONA_CONDUCTOR_SQL} WHERE u.id = ?`,
    )
    .bind(conductorId)
    .first<{ pais: string | null; cfg: string | null }>();
  const pais = (f?.pais ?? 'US').toUpperCase();
  // Sin nada guardado no hay lista encendida (la de fábrica nace apagada): ni se calcula.
  if (!f?.cfg) return null;
  const lista = listaDesdeConfig(pais, f.cfg);
  return lista.activa ? { pais, lista } : null;
}

export type PapelQueFalta = {
  tipo: string;
  donde: DondePapel;
  es: string;
  en: string;
  /** `falta` = no lo subió (le toca al conductor); `revision` = lo subió y lo revisa el equipo. */
  estado: 'falta' | 'revision';
};

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Los papeles de su país que «solo se piden» y todavía no tiene aprobados (vigentes si vencen).
 * null = la lista de su país está apagada. Solo lee: la lista, sus vehículos y sus papeles.
 */
export async function papelesPaisQueFaltan(
  db: D1Database,
  conductorId: string,
): Promise<PapelQueFalta[] | null> {
  const enc = await listaEncendidaDelConductor(db, conductorId);
  if (!enc) return null;
  const [{ results: vehiculos }, { results: mios }] = await Promise.all([
    db
      .prepare(
        `SELECT id, tipo FROM vehiculos WHERE conductor_id = ?
          AND estado NOT IN ('retirado', 'rechazado') AND tipo IN ('moto', 'carro')
          ORDER BY estado = 'aprobado' DESC, creado_en DESC LIMIT 4`,
      )
      .bind(conductorId)
      .all<{ id: string; tipo: string }>(),
    db
      .prepare(
        `SELECT tipo, estado, vence_en FROM conductor_documentos
          WHERE conductor_id = ? AND estado IN ('pendiente', 'aprobado')`,
      )
      .bind(conductorId)
      .all<{ tipo: string; estado: string; vence_en: string | null }>(),
  ]);
  // Los servicios de pasajeros que hace: los de sus vehículos (sin vehículo de pasajeros, ninguno).
  const porServicio = new Map<ServicioPasajeros, string>();
  for (const v of vehiculos) {
    const s: ServicioPasajeros = v.tipo === 'carro' ? 'carro' : 'moto';
    if (!porServicio.has(s)) porServicio.set(s, v.id);
  }
  if (!porServicio.size) return [];
  const idsVeh = [...porServicio.values()];
  const { results: delVehiculo } = await db
    .prepare(
      `SELECT vehiculo_id, tipo, estado, vence_en FROM vehiculo_documentos
        WHERE vehiculo_id IN (${idsVeh.map(() => '?').join(',')}) AND estado IN ('pendiente', 'aprobado')`,
    )
    .bind(...idsVeh)
    .all<{ vehiculo_id: string; tipo: string; estado: string; vence_en: string | null }>();
  const dia = hoy();
  const vigente = (d: { estado: string; vence_en: string | null }, vence: boolean) =>
    d.estado === 'aprobado' ? !vence || !d.vence_en || d.vence_en >= dia : null;
  const faltan = new Map<string, PapelQueFalta>();
  for (const [servicio, vehiculoId] of porServicio) {
    for (const p of papelesDelServicio(enc.lista, servicio)) {
      if (p.frena) continue;
      const filas =
        p.donde === 'conductor'
          ? mios.filter((d) => d.tipo === p.tipo)
          : delVehiculo.filter((d) => d.vehiculo_id === vehiculoId && d.tipo === p.tipo);
      if (filas.some((d) => vigente(d, p.vence) === true)) continue;
      const enRevision = filas.some((d) => d.estado === 'pendiente');
      const clave = `${p.donde}:${p.tipo}`;
      const antes = faltan.get(clave);
      // Si en un servicio falta y en otro está en revisión, manda «falta» (le toca a él).
      if (antes && antes.estado === 'falta') continue;
      faltan.set(clave, {
        tipo: p.tipo,
        donde: p.donde,
        es: p.es,
        en: p.en,
        estado: enRevision ? 'revision' : 'falta',
      });
    }
  }
  return [...faltan.values()];
}
