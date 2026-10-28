import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, empresa, k, llamar, rutaEnCurso, subir, type M } from '../pruebas/flex';

/**
 * Divoox Flex · Fase 6 (C-FLEX-COBRO). País: Venezuela; EE. UU. para comprobar que allá no existe.
 * El conductor no entrega un envío con cobro sin registrarlo (método, monto, referencia y la cédula
 * de quien paga), y la empresa recibe el efectivo al cerrar la caja de la ruta.
 */

/** Ruta en curso de una empresa que pasa a Venezuela, con el primer envío cobrando 25,00 USD. */
async function rutaConCobro(m: M) {
  const r = await rutaEnCurso(m, 2);
  await m.DB.prepare("UPDATE empresas SET pais = 'VE' WHERE id = ?").bind(r.e.id).run();
  const p = r.paradas[0];
  await m.DB.prepare(
    "UPDATE envios SET cobro_monto = 2500, cobro_moneda = 'USD', cobro_estado = 'pendiente' WHERE id = ?",
  )
    .bind(p.envioId)
    .run();
  const foto = await subir(m, `${r.C}/paradas/${p.id}/prueba`, r.cond.token);
  expect(foto.estado).toBe(201);
  const entregar = (cuerpo: Record<string, unknown>, clave = k()) =>
    llamar(
      m,
      'POST',
      `${r.C}/paradas/${p.id}/entregar`,
      { fotoId: foto.datos.pruebaId, recibio: 'María Pérez', ...cuerpo },
      r.cond.token,
      { 'idempotency-key': clave },
    );
  return { ...r, p, entregar };
}

const cobroOk = { metodo: 'efectivo_usd', monto: 2500, moneda: 'USD' };

describe('C-FLEX-COBRO · Venezuela: cobro contra entrega', () => {
  it('solo un país con cobro contra entrega lo acepta al crear el envío', async () => {
    const m = mundo();
    const us = await empresa(m, 'Miami Express');
    const base = {
      centroId: us.centroId,
      destinatarioNombre: 'Cliente',
      direccion: '100 Main St, Miami',
      cobro: { monto: 2500, moneda: 'USD' },
    };
    const enUs = await llamar(m, 'POST', `${B}/empresas/${us.id}/envios`, base, us.dueno.token);
    expect(enUs.estado).toBe(422);
    expect(enUs.datos.campo).toBe('cobro');
    await m.DB.prepare("UPDATE empresas SET pais = 'VE' WHERE id = ?").bind(us.id).run();
    const enVe = await llamar(m, 'POST', `${B}/empresas/${us.id}/envios`, base, us.dueno.token);
    expect(enVe.estado).toBe(201);
    expect(enVe.datos.envio.cobro).toMatchObject({
      monto: 2500,
      moneda: 'USD',
      estado: 'pendiente',
    });
    // En una moneda que no es del país, no.
    const eur = await llamar(
      m,
      'POST',
      `${B}/empresas/${us.id}/envios`,
      { ...base, cobro: { monto: 2500, moneda: 'EUR' } },
      us.dueno.token,
    );
    expect(eur.estado).toBe(400);
  });

  it('sin registrar el cobro no hay entrega; con él, queda en la misma transacción', async () => {
    const m = mundo();
    const r = await rutaConCobro(m);
    const sinCobro = await r.entregar({ recibioDocumento: 'V-12345678' });
    expect(sinCobro.estado).toBe(422);
    expect(sinCobro.datos.campo).toBe('cobro');
    const corto = await r.entregar({
      cobro: { ...cobroOk, monto: 2000 },
      recibioDocumento: 'V-12345678',
    });
    expect(corto.estado).toBe(422);
    const sinCedula = await r.entregar({ cobro: cobroOk });
    expect(sinCedula.estado).toBe(422);
    expect(sinCedula.datos.campo).toBe('recibioDocumento');
    const pmSinRef = await r.entregar({
      cobro: { metodo: 'pago_movil', monto: 90_000, moneda: 'VES' },
      recibioDocumento: 'V-12345678',
    });
    expect(pmSinRef.estado).toBe(422);
    // Nada quedó a medias: el paquete sigue en camino y el cobro pendiente.
    const antes = await m.DB.prepare('SELECT cobro_estado FROM envios WHERE id = ?')
      .bind(r.p.envioId)
      .first();
    expect(antes).toEqual({ cobro_estado: 'pendiente' });

    const clave = k();
    const ok = await r.entregar(
      { cobro: cobroOk, recibioDocumento: 'V-12345678', recibioRelacion: 'titular' },
      clave,
    );
    expect(ok.estado).toBe(200);
    // Repetir con la misma clave no cobra dos veces.
    expect(
      (
        await r.entregar(
          { cobro: cobroOk, recibioDocumento: 'V-12345678', recibioRelacion: 'titular' },
          clave,
        )
      ).estado,
    ).toBe(200);
    const fila = await m.DB.prepare(
      'SELECT cobro_estado, cobro_metodo, cobro_monto_recibido, cobro_conductor_id, recibio_documento FROM envios WHERE id = ?',
    )
      .bind(r.p.envioId)
      .first();
    expect(fila).toEqual({
      cobro_estado: 'cobrado',
      cobro_metodo: 'efectivo_usd',
      cobro_monto_recibido: 2500,
      cobro_conductor_id: r.cond.id,
      recibio_documento: 'V-12345678',
    });
  });

  it('nunca «sin contacto» si hay que cobrar', async () => {
    const m = mundo();
    const r = await rutaConCobro(m);
    await m.DB.prepare(
      `UPDATE empresas SET config_entrega_json = '{"foto":false,"sinContacto":true}' WHERE id = ?`,
    )
      .bind(r.e.id)
      .run();
    const sc = await r.entregar({ sinContacto: true });
    expect(sc.estado).toBe(409);
    expect(sc.datos.campo).toBe('sinContacto');
  });

  it('el conductor ve el efectivo en la mano y la empresa lo recibe una sola vez', async () => {
    const m = mundo();
    const r = await rutaConCobro(m);
    expect((await r.entregar({ cobro: cobroOk, recibioDocumento: 'V-12345678' })).estado).toBe(200);
    const mano = await llamar(m, 'GET', `${B}/conductor/cobros`, undefined, r.cond.token);
    expect(mano.estado).toBe(200);
    expect(mano.datos.totales.efectivoEnMano).toEqual({ USD: 2500 });
    // La parada de la ruta muestra el cobro hecho.
    const det = await llamar(m, 'GET', r.C, undefined, r.cond.token);
    expect(det.datos.ruta.paradas[0].cobro).toMatchObject({
      estado: 'cobrado',
      metodo: 'efectivo_usd',
    });

    const lista = await llamar(
      m,
      'GET',
      `${B}/empresas/${r.e.id}/cobros?rutaId=${r.rutaId}`,
      undefined,
      r.e.dueno.token,
    );
    expect(lista.datos.totales).toMatchObject({
      efectivoEnMano: { USD: 2500 },
      cobrado: { USD: 2500 },
    });
    const recibir = () =>
      llamar(
        m,
        'POST',
        `${B}/empresas/${r.e.id}/rutas/${r.rutaId}/cobros/recibir`,
        {},
        r.e.dueno.token,
        {
          'idempotency-key': k(),
        },
      );
    const rec = await recibir();
    expect(rec.estado).toBe(200);
    expect(rec.datos).toMatchObject({ recibidos: 1, efectivo: { USD: 2500 } });
    expect((await recibir()).estado).toBe(409);
    const despues = await llamar(m, 'GET', `${B}/conductor/cobros`, undefined, r.cond.token);
    expect(despues.datos.totales.efectivoEnMano).toEqual({});
  });

  it('una ruta ajena no se recibe', async () => {
    const m = mundo();
    const r = await rutaConCobro(m);
    const otra = await empresa(m, 'Otra');
    const ajena = await llamar(
      m,
      'POST',
      `${B}/empresas/${otra.id}/rutas/${r.rutaId}/cobros/recibir`,
      {},
      otra.dueno.token,
      { 'idempotency-key': k() },
    );
    expect(ajena.estado).toBe(404);
  });
});
