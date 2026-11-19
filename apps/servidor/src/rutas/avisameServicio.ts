import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { huellaAparato } from '../regalosDivoox';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { zonaPara } from './zonas';

/**
 * C-OCHO-ICONOS-SIEMPRE (18 nov 2026, orden de Richard) — todos los países. El inicio del cliente
 * pinta siempre los ocho servicios; tocar uno cerrado en la zona abre la hoja «En esta zona aún no
 * hay…» con «Avísame cuando llegue». Esta ruta guarda ese interés SOLO cuando se toca el botón (mirar
 * el inicio no escribe nada, regla del presupuesto de escrituras): una sola fila por persona (o
 * aparato, sin cuenta), servicio y zona, sin índices de más (la llave primaria es la clave única).
 * Si la zona no se conoce, se guarda con las coordenadas redondeadas (unos 1,1 km) o sin zona.
 */
export const SERVICIOS_AVISAME = [
  'comida',
  'mercado',
  'farmacia',
  'licores',
  'carro',
  'moto',
  'envios',
] as const;

const coord = (min: number, max: number) => z.number().finite().min(min).max(max).optional();
const Cuerpo = z
  .object({
    servicio: z.enum(SERVICIOS_AVISAME, { message: 'Servicio desconocido.' }),
    lat: coord(-90, 90),
    lng: coord(-180, 180),
  })
  .strict();

const redondear = (x: number) => Math.round(x * 100) / 100;

export const avisameServicio = new Hono<{ Bindings: Env; Variables: Variables }>();

avisameServicio.post('/servicios/avisame', async (c) => {
  const db = base(c);
  const d = await leerCuerpo(c, Cuerpo);
  const u = c.get('usuario');
  const aparato = await huellaAparato(c.req.header('x-aparato'));
  const dueno = u?.id ?? aparato;
  if (!dueno)
    throw new ErrorDatos(
      'No pudimos reconocer este teléfono. Actualiza la app y vuelve a intentarlo.',
    );
  const punto = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
  const zona = punto ? await zonaPara(db, punto.lat, punto.lng) : null;
  const lat = punto ? redondear(punto.lat) : null;
  const lng = punto ? redondear(punto.lng) : null;
  const zonaClave = zona ? zona.id : punto ? `~${lat},${lng}` : '';
  await db
    .prepare(
      `INSERT INTO avisos_servicio (dueno, servicio, zona_clave, usuario_id, aparato, zona_id, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (dueno, servicio, zona_clave) DO NOTHING`,
    )
    .bind(dueno, d.servicio, zonaClave, u?.id ?? null, aparato, zona?.id ?? null, lat, lng)
    .run();
  return c.json({ ok: true });
});
