import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { ORIGEN_CCS, abrirCaracas, subirA } from '../pruebas/motoVe';
import { mundo } from '../pruebas/ayuda';
import { contarFilas } from '../presupuestoFilas';

/**
 * C-FOTO-CARA-A-LA-VISTA (23 nov 2026) — todos los países (la prueba usa Venezuela, donde la cara es lo
 * único que se pide para empezar). Conductores nuevos se registraban y nunca tomaban la foto de la cara,
 * y la base no guardaba qué vieron. Ahora el servidor anota los hitos (una fila por cuenta, hito y
 * motivo, la primera vez), aunque la app sea la publicada (Driver 0.1.69): el rechazo al conectarse, el
 * rechazo de una foto y que «Tus papeles» le pidió la cara. La app nueva suma lo que solo ella ve.
 */
async function conductorVe() {
  let conteo!: ReturnType<typeof contarFilas>;
  const m = mundo(
    {},
    { host: 'staging.tumbite.com', envolver: (db) => (conteo = contarFilas(db)).db },
  );
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  expect((await abrirCaracas(e)).estado).toBe(201);
  const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  const hitos = async () =>
    (
      await m.DB.prepare(
        'SELECT hito, motivo FROM hitos_cuenta WHERE usuario_id = ? ORDER BY hito, motivo',
      )
        .bind(rep.id)
        .all<{ hito: string; motivo: string }>()
    ).results.map((h) => (h.motivo ? `${h.hito}:${h.motivo}` : h.hito));
  return { m, e, admin, rep, yo, hitos, escritas: () => conteo.cuenta.escritas };
}

describe('C-FOTO-CARA-A-LA-VISTA · el embudo de la cara lo anota el servidor solo', () => {
  it('conectarse sin la cara deja «conectar_rechazado:cara» UNA vez, por mucho que lo intente', async () => {
    const c = await conductorVe();
    for (let i = 0; i < 3; i++) {
      const r = await c.yo('POST', '/datos/repartidor/conectar', {
        conectado: true,
        ...ORIGEN_CCS,
      });
      expect(r.estado).toBe(403);
      expect(r.datos.campo).toBe('cara');
    }
    expect(await c.hitos()).toContain('conectar_rechazado:cara');
    const antes = c.escritas();
    await c.yo('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN_CCS });
    const filas = await c.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM hitos_cuenta WHERE usuario_id = ? AND hito = 'conectar_rechazado'",
    )
      .bind(c.rep.id)
      .first<{ n: number }>();
    expect(filas?.n).toBe(1);
    // El rechazo repetido no suma filas al rastro (sí las que la puerta ya escribía antes, como el plazo).
    expect(c.escritas() - antes).toBeLessThanOrEqual(2);
  });

  it('«Tus papeles» con la cara pendiente anota «cara_pedida» una vez; con la cara ya tomada, no', async () => {
    const c = await conductorVe();
    await c.yo('GET', '/datos/conductor/verificacion');
    await c.yo('GET', '/datos/conductor/verificacion');
    expect((await c.hitos()).filter((h) => h === 'cara_pedida')).toHaveLength(1);
  });

  it('una foto rechazada por el servidor deja su motivo (sin consentimiento, sin cámara)', async () => {
    const c = await conductorVe();
    // Sin aceptar el uso de la foto de la cara.
    const sin = await subirA(
      c.e,
      '/datos/conductor/verificacion/foto/cara?origen=camara',
      c.rep.token,
    );
    expect(sin.estado).toBe(409);
    // Desde los archivos, no desde la cámara.
    expect((await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true })).estado).toBe(200);
    const archivo = await subirA(c.e, '/datos/conductor/verificacion/foto/cara', c.rep.token);
    expect(archivo.estado).toBe(422);
    expect(await c.hitos()).toEqual(
      expect.arrayContaining(['subida_rechazada:consentimiento', 'subida_rechazada:en_vivo']),
    );
  });

  it('la app nueva manda sus hitos: solo los conocidos, solo el conductor, una fila la primera vez', async () => {
    const c = await conductorVe();
    const hito = (h: string, motivo = '', token: string | null = c.rep.token) =>
      c.m.llamar('POST', '/datos/rastro/hito', { hito: h, motivo }, token ?? undefined);
    expect((await hito('tarjeta_cara_vista', '', null)).estado).toBe(401);
    expect((await hito('tarjeta_cara_vista', '', c.admin.token)).estado).toBe(403);
    expect((await hito('conectar_rechazado')).estado).toBe(400); // ese lo pone el servidor
    expect((await hito('subida_fallida', 'cualquier cosa')).estado).toBe(400);
    const antes = c.escritas();
    for (const h of ['tarjeta_cara_vista', 'asistente_abierto', 'camara_abierta', 'foto_tomada'])
      for (let i = 0; i < 3; i++) expect((await hito(h)).estado).toBe(200);
    expect((await hito('subida_fallida', 'tiempo')).estado).toBe(200);
    expect((await hito('subida_fallida', 'tiempo')).estado).toBe(200);
    expect((await hito('camara_fallo', 'no_arranca')).estado).toBe(200);
    // Presupuesto: seis hitos distintos = seis filas, aunque se mandaron catorce.
    expect(c.escritas() - antes).toBe(6);
    expect(await c.hitos()).toEqual([
      'asistente_abierto',
      'camara_abierta',
      'camara_fallo:no_arranca',
      'foto_tomada',
      'subida_fallida:tiempo',
      'tarjeta_cara_vista',
    ]);
  });

  it('la ficha del equipo muestra los hitos en la actividad y el embudo los cuenta; al borrar la cuenta se van', async () => {
    const c = await conductorVe();
    await c.yo('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN_CCS });
    await c.m.llamar('POST', '/datos/rastro/hito', { hito: 'camara_abierta' }, c.rep.token);
    const a = await c.m.llamar(
      'GET',
      `/datos/admin/repartidores/${c.rep.id}/actividad`,
      undefined,
      c.admin.token,
    );
    expect(a.estado).toBe(200);
    const linea = a.datos.actividad.linea as { tipo: string; evento: string; detalle: string }[];
    expect(linea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo: 'hito',
          evento: 'hito:conectar_rechazado',
          detalle: 'cara',
        }),
        expect.objectContaining({ tipo: 'hito', evento: 'hito:camara_abierta' }),
      ]),
    );
    const hoy = new Date().toISOString().slice(0, 10);
    const emb = await c.m.llamar(
      'GET',
      `/datos/admin/embudo?app=repartidor&desde=${hoy}&hasta=${hoy}`,
      undefined,
      c.admin.token,
    );
    expect(emb.estado).toBe(200);
    expect(emb.datos.hitos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hito: 'conectar_rechazado', motivo: 'cara', personas: 1 }),
      ]),
    );
    // Mirar la ficha y el embudo no escribe nada.
    await c.m.sesionLista(c.admin.token);
    const antes = c.escritas();
    await c.m.llamar(
      'GET',
      `/datos/admin/repartidores/${c.rep.id}/actividad`,
      undefined,
      c.admin.token,
    );
    expect(c.escritas() - antes).toBe(0);
    const borrar = await c.yo('DELETE', '/datos/cuentas/yo', { clave: 'clave-segura-1' });
    expect(borrar.estado).toBe(200);
    expect(await c.hitos()).toEqual([]);
  });
});
