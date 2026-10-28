import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, empresa, k, llamar, type M } from '../pruebas/flex';

/**
 * C-FLEX-RETIRO · Venezuela (y EE. UU. para ver que allá no se pide cédula): retiro en un punto con
 * plazo, como la agencia de MRW. Disponible → aviso → retiro con cédula y número de seguimiento (o
 * tercero autorizado), cobro si lo hay; vencido → devuelto.
 */
async function envioAPunto(m: M, pais: 'VE' | 'US', extra: Record<string, unknown> = {}) {
  const e = await empresa(m, `Tienda ${pais}`);
  await m.DB.prepare('UPDATE empresas SET pais = ? WHERE id = ?').bind(pais, e.id).run();
  const r = await llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/envios`,
    {
      centroId: e.centroId,
      entrega: 'punto',
      destinatarioNombre: 'María Pérez',
      destinatarioTelefono: '0414-1234567',
      destinatarioDocumento: pais === 'VE' ? 'V-12345678' : '',
      direccion: 'Retiro en el centro',
      ...extra,
    },
    e.dueno.token,
  );
  expect(r.estado).toBe(201);
  const envio = r.datos.envio as { id: string; paquetes: { codigoSeguimiento: string }[] };
  const R = `${B}/empresas/${e.id}/envios/${envio.id}/retiro`;
  const accion = (sub: string, cuerpo: unknown = {}) =>
    llamar(m, 'POST', `${R}/${sub}`, cuerpo, e.dueno.token, { 'idempotency-key': k() });
  return { e, envio, codigo: envio.paquetes[0]!.codigoSeguimiento, accion };
}

describe('C-FLEX-RETIRO · retiro en un punto con plazo', () => {
  it('queda disponible con 5 días hábiles y el aviso listo para WhatsApp', async () => {
    const m = mundo();
    const x = await envioAPunto(m, 'VE');
    const d = await x.accion('disponible');
    expect(d.estado).toBe(200);
    expect(d.datos.vence).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.datos.mensaje).toContain(x.codigo);
    expect(d.datos.whatsapp).toMatch(/^https:\/\/wa\.me\/584141234567\?text=/);
    // Lo que se retira en un punto no sale en una ruta a domicilio.
    const ruta = await llamar(
      m,
      'POST',
      `${B}/empresas/${x.e.id}/rutas`,
      { nombre: 'Ruta', centroId: x.e.centroId, envioIds: [x.envio.id] },
      x.e.dueno.token,
    );
    expect(ruta.estado).toBe(409);
  });

  it('en Venezuela se retira con la cédula del destinatario o un tercero autorizado', async () => {
    const m = mundo();
    const x = await envioAPunto(m, 'VE');
    expect((await x.accion('entregar', { codigo: x.codigo, documento: 'V-12345678' })).estado).toBe(
      409,
    ); // todavía no está disponible
    await x.accion('disponible');
    expect(
      (await x.accion('entregar', { codigo: 'DVXNOESESTE', documento: 'V-12345678' })).estado,
    ).toBe(422);
    const otra = await x.accion('entregar', { codigo: x.codigo, documento: 'V-99999999' });
    expect(otra.estado).toBe(422);
    expect(otra.datos.campo).toBe('documento');
    const tercero = await x.accion('entregar', {
      codigo: x.codigo.toLowerCase(),
      tercero: { nombre: 'Luis Pérez', documento: 'V-99999999' },
    });
    expect(tercero.estado).toBe(200);
    const f = await m.DB.prepare(
      'SELECT e.estado, e.recibio_relacion, (SELECT estado FROM paquetes WHERE envio_id = e.id) AS paquete FROM envios e WHERE e.id = ?',
    )
      .bind(x.envio.id)
      .first();
    expect(f).toEqual({
      estado: 'entregado',
      recibio_relacion: 'tercero_autorizado',
      paquete: 'entregado',
    });
  });

  it('si se cobra, el cobro queda recibido en la caja de la empresa', async () => {
    const m = mundo();
    const x = await envioAPunto(m, 'VE', { cobro: { monto: 2500, moneda: 'USD' } });
    await x.accion('disponible');
    const sin = await x.accion('entregar', { codigo: x.codigo, documento: 'V-12345678' });
    expect(sin.estado).toBe(422);
    expect(sin.datos.campo).toBe('cobro');
    const ok = await x.accion('entregar', {
      codigo: x.codigo,
      documento: 'V-12.345.678',
      cobro: { metodo: 'efectivo_usd', monto: 2500, moneda: 'USD' },
    });
    expect(ok.estado).toBe(200);
    const f = await m.DB.prepare(
      'SELECT cobro_estado, cobro_monto_recibido FROM envios WHERE id = ?',
    )
      .bind(x.envio.id)
      .first();
    expect(f).toEqual({ cobro_estado: 'liquidado', cobro_monto_recibido: 2500 });
  });

  it('vencido el plazo vuelve al remitente; antes, no', async () => {
    const m = mundo();
    const x = await envioAPunto(m, 'VE');
    await x.accion('disponible');
    expect((await x.accion('devolver')).estado).toBe(409);
    await m.DB.prepare("UPDATE envios SET retiro_vence = '2026-01-01' WHERE id = ?")
      .bind(x.envio.id)
      .run();
    expect((await x.accion('devolver')).estado).toBe(200);
    const f = await m.DB.prepare('SELECT estado FROM envios WHERE id = ?').bind(x.envio.id).first();
    expect(f).toEqual({ estado: 'devuelto' });
  });

  it('en EE. UU. basta el número de seguimiento', async () => {
    const m = mundo();
    const x = await envioAPunto(m, 'US');
    await x.accion('disponible');
    expect((await x.accion('entregar', { codigo: x.codigo })).estado).toBe(200);
  });
});
