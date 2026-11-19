import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
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

/**
 * Tope de filas nuevas por día, en todo el sistema. Sin cuenta, el aparato es una cabecera que se
 * puede inventar: sin tope, un robot llenaría la tabla (regla del presupuesto de escrituras).
 */
export const TOPE_AVISAME_DIA = 2000;

const redondear = (x: number) => Math.round(x * 100) / 100;

export const avisameServicio = new Hono<{ Bindings: Env; Variables: Variables }>();

avisameServicio.post('/servicios/avisame', async (c) => {
  const db = base(c);
  const d = await leerCuerpo(c, Cuerpo);
  const u = c.get('usuario');
  // Solo con la cuenta iniciada (decisión de Gerencia, 18 nov 2026): de quien no tiene cuenta no
  // se guarda nada, ni una huella del aparato. La app le ofrece crear la cuenta.
  if (!u) throw new ErrorDatos('Entra a tu cuenta para que te avisemos.', undefined, 401);
  const dueno = u.id;
  const punto = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
  const zona = punto ? await zonaPara(db, punto.lat, punto.lng) : null;
  const lat = punto ? redondear(punto.lat) : null;
  const lng = punto ? redondear(punto.lng) : null;
  const zonaClave = zona ? zona.id : punto ? `~${lat},${lng}` : '';
  const hoy = await db
    .prepare("SELECT COUNT(*) AS n FROM avisos_servicio WHERE creado_en >= date('now')")
    .first<{ n: number }>();
  if ((hoy?.n ?? 0) >= TOPE_AVISAME_DIA) {
    // Visible en los registros de error: es señal de abuso o de que hay que subir el tope.
    console.error('[avisame] tope diario alcanzado: no se guardan más avisos hoy');
    throw new ErrorDatos(
      'Ahora mismo no podemos guardarlo. Vuelve a intentarlo más tarde.',
      undefined,
      429,
    );
  }
  await db
    .prepare(
      `INSERT INTO avisos_servicio (dueno, servicio, zona_clave, usuario_id, aparato, zona_id, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (dueno, servicio, zona_clave) DO NOTHING`,
    )
    .bind(dueno, d.servicio, zonaClave, u.id, null, zona?.id ?? null, lat, lng)
    .run();
  return c.json({ ok: true });
});
