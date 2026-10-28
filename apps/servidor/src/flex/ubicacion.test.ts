import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, confirmar, llamar, vincular, type M } from '../pruebas/flex';

/**
 * Divoox Flex · Fase 5 (C-FLEX-UBICACION). País: Venezuela (y EE. UU. para comprobar que allá
 * sigue igual). La ubicación exacta del destinatario: por su app de Divoox, por el enlace
 * «confirma dónde recibes» o marcada por la empresa; en Venezuela sin ella la ruta no sale.
 */
const CARACAS = { lat: 10.4806, lng: -66.9036 };

async function empresaEn(m: M, pais: 'VE' | 'US') {
  const dueno = await m.cuenta('cliente', `Dueña ${pais}`);
  await confirmar(m, dueno.id);
  const e = await llamar(
    m,
    'POST',
    `${B}/empresas`,
    { nombre: `Envíos ${pais}`, pais, moneda: 'USD' },
    dueno.token,
  );
  expect(e.estado).toBe(201);
  const id = e.datos.empresa.id as string;
  const centro = await llamar(
    m,
    'POST',
    `${B}/empresas/${id}/centros`,
    {
      nombre: 'Centro',
      direccion: 'Centro de acopio',
      pais,
      ciudad: pais === 'VE' ? 'Caracas' : 'Miami',
      lat: CARACAS.lat,
      lng: CARACAS.lng,
    },
    dueno.token,
  );
  return { dueno, id, centroId: centro.datos.centro.id as string };
}

async function envio(
  m: M,
  e: Awaited<ReturnType<typeof empresaEn>>,
  extra: Record<string, unknown> = {},
) {
  const r = await llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/envios`,
    {
      centroId: e.centroId,
      destinatarioNombre: 'María Pérez',
      destinatarioTelefono: '0414-123.45.67',
      direccion: 'Calle 3, Los Palos Grandes, Caracas',
      paquetes: [{ descripcion: 'Repuestos' }],
      ...extra,
    },
    e.dueno.token,
  );
  expect(r.estado).toBe(201);
  return r.datos.envio as { id: string; ubicacionEstado: string; paquetes: { id: string }[] };
}

describe('C-FLEX-UBICACION · Venezuela: ubicación exacta antes de salir', () => {
  it('un envío sin punto nace «pendiente» y la ruta no se asigna hasta confirmarlo', async () => {
    const m = mundo();
    const e = await empresaEn(m, 'VE');
    const x = await envio(m, e);
    expect(x.ubicacionEstado).toBe('pendiente');
    const cond = await m.cuenta('repartidor', 'Conductor Caracas');
    await vincular(m, e, cond.id, 'propio');
    // La empresa marca el punto con el pin: queda confirmado por ella.
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas`,
      { nombre: 'Ruta', centroId: e.centroId, envioIds: [x.id] },
      e.dueno.token,
    );
    const rutaId = r.datos.ruta.id as string;
    const asignar = () =>
      llamar(
        m,
        'POST',
        `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
        { conductorId: cond.id },
        e.dueno.token,
      );
    const bloqueada = await asignar();
    expect(bloqueada.estado).toBe(409);
    // Con coordenadas puestas a mano pero SIN confirmar, también se bloquea (la regla de Venezuela).
    await m.DB.prepare('UPDATE envios SET lat = ?, lng = ? WHERE id = ?')
      .bind(CARACAS.lat, CARACAS.lng, x.id)
      .run();
    const sinConfirmar = await asignar();
    expect(sinConfirmar.estado).toBe(409);
    expect(sinConfirmar.datos.error).toMatch(
      /sin ubicación confirmada|without a confirmed location/i,
    );
    expect(bloqueada.datos.error).toMatch(/coordenadas|ubicaci|location|coordinates/i);
    expect(
      (
        await llamar(
          m,
          'PATCH',
          `${B}/empresas/${e.id}/envios/${x.id}`,
          { lat: CARACAS.lat, lng: CARACAS.lng },
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
    const fila = await m.DB.prepare(
      'SELECT ubicacion_estado, ubicacion_fuente FROM envios WHERE id = ?',
    )
      .bind(x.id)
      .first();
    expect(fila).toEqual({ ubicacion_estado: 'confirmada', ubicacion_fuente: 'empresa' });
    expect((await asignar()).estado).toBe(200);
  });

  it('el enlace «confirma dónde recibes»: sin cuenta, con pin y punto de referencia obligatorio', async () => {
    const m = mundo();
    const e = await empresaEn(m, 'VE');
    const x = await envio(m, e);
    const en = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios/${x.id}/enlace-ubicacion`,
      {},
      e.dueno.token,
    );
    expect(en.estado).toBe(200);
    expect(en.datos.whatsapp).toMatch(/^https:\/\/wa\.me\/584141234567\?text=/);
    expect(en.datos.mensaje).toMatch(/Hola María/);
    const codigo = String(en.datos.url).split('/deliver/')[1] ?? '';
    // Solo se guarda la huella.
    expect(
      await m.DB.prepare('SELECT 1 AS x FROM envios WHERE enlace_ubicacion_huella = ?')
        .bind(codigo)
        .first(),
    ).toBeNull();
    const ver = await llamar(m, 'GET', `${B}/publico/ubicacion/${codigo}`);
    expect(ver.datos.envio).toMatchObject({
      empresa: 'Envíos VE',
      destinatario: 'María',
      confirmada: false,
      referenciasObligatorias: true,
      abierto: true,
    });
    expect(ver.datos.envio.destinatarioTelefono).toBeUndefined();
    const sinReferencia = await llamar(m, 'POST', `${B}/publico/ubicacion/${codigo}`, {
      ...CARACAS,
      referencias: '',
    });
    expect(sinReferencia.estado).toBe(422);
    const ok = await llamar(m, 'POST', `${B}/publico/ubicacion/${codigo}`, {
      ...CARACAS,
      referencias: 'Casa azul frente a la panadería',
    });
    expect(ok.estado).toBe(200);
    const fila = await m.DB.prepare(
      'SELECT ubicacion_estado, ubicacion_fuente, referencias, lat FROM envios WHERE id = ?',
    )
      .bind(x.id)
      .first();
    expect(fila).toEqual({
      ubicacion_estado: 'confirmada',
      ubicacion_fuente: 'enlace_destinatario',
      referencias: 'Casa azul frente a la panadería',
      lat: CARACAS.lat,
    });
    // La etiqueta ya trae el código plus del punto exacto.
    const et = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/paquetes/${x.paquetes[0]!.id}/etiqueta`,
      undefined,
      e.dueno.token,
    );
    expect(et.datos.etiqueta).toMatchObject({
      referencias: 'Casa azul frente a la panadería',
      ubicacionConfirmada: true,
    });
    expect(et.datos.etiqueta.codigoPlus).toMatch(
      /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/,
    );
    // Un código inventado no muestra nada; uno vencido tampoco.
    expect((await llamar(m, 'GET', `${B}/publico/ubicacion/${'a'.repeat(43)}`)).estado).toBe(404);
    await m.DB.prepare(
      "UPDATE envios SET enlace_ubicacion_vence = datetime('now', '-1 minute') WHERE id = ?",
    )
      .bind(x.id)
      .run();
    expect((await llamar(m, 'GET', `${B}/publico/ubicacion/${codigo}`)).estado).toBe(404);
  });

  it('si el destinatario tiene la app con su casa marcada, el envío llega ya ubicado y aparece en «Mis paquetes»', async () => {
    const m = mundo();
    const cli = await m.cuenta('cliente', 'María Pérez');
    await m.DB.prepare("UPDATE usuarios SET telefono = '+58 414 1234567' WHERE id = ?")
      .bind(cli.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO direcciones_cliente (id, usuario_id, etiqueta, direccion, lat, lng, instrucciones) VALUES ('d1', ?, 'Casa', 'Los Palos Grandes', ?, ?, 'Edificio rojo, piso 3')",
    )
      .bind(cli.id, CARACAS.lat, CARACAS.lng)
      .run();
    const e = await empresaEn(m, 'VE');
    const x = await envio(m, e);
    const fila = await m.DB.prepare(
      'SELECT ubicacion_estado, ubicacion_fuente, destinatario_usuario_id, referencias FROM envios WHERE id = ?',
    )
      .bind(x.id)
      .first();
    expect(fila).toEqual({
      ubicacion_estado: 'confirmada',
      ubicacion_fuente: 'app_cliente',
      destinatario_usuario_id: cli.id,
      referencias: 'Edificio rojo, piso 3',
    });
    const mios = await llamar(m, 'GET', `${B}/mis-paquetes`, undefined, cli.token);
    expect(mios.datos.paquetes).toHaveLength(1);
    expect(mios.datos.paquetes[0]).toMatchObject({
      envioId: x.id,
      empresa: 'Envíos VE',
      ubicacion: 'confirmada',
      puedeCambiar: true,
    });
    expect(mios.datos.paquetes[0].codigo).toMatch(/^DVX/);
    // Otra persona no lo ve ni lo cambia.
    const otro = await m.cuenta('cliente', 'Otra');
    expect(
      (await llamar(m, 'GET', `${B}/mis-paquetes`, undefined, otro.token)).datos.paquetes,
    ).toHaveLength(0);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/mis-paquetes/${x.id}/ubicacion`,
          { ...CARACAS, referencias: 'Otra casa aquí' },
          otro.token,
        )
      ).estado,
    ).toBe(404);
  });

  it('si la cuenta llega después, el envío se vincula al abrir «Mis paquetes» y ahí confirma su punto', async () => {
    const m = mundo();
    const e = await empresaEn(m, 'VE');
    const x = await envio(m, e, {
      destinatarioCorreo: 'maria@ejemplo.com',
      destinatarioTelefono: '',
    });
    const cli = await m.cuenta('cliente', 'María Pérez');
    await m.DB.prepare("UPDATE usuarios SET correo = 'maria@ejemplo.com' WHERE id = ?")
      .bind(cli.id)
      .run();
    const mios = await llamar(m, 'GET', `${B}/mis-paquetes`, undefined, cli.token);
    expect(mios.datos.paquetes[0]).toMatchObject({ envioId: x.id, ubicacion: 'pendiente' });
    const r = await llamar(
      m,
      'POST',
      `${B}/mis-paquetes/${x.id}/ubicacion`,
      { ...CARACAS, referencias: 'Frente a la plaza' },
      cli.token,
    );
    expect(r.estado).toBe(200);
    expect(
      await m.DB.prepare('SELECT ubicacion_fuente FROM envios WHERE id = ?').bind(x.id).first(),
    ).toEqual({ ubicacion_fuente: 'app_cliente' });
  });
});

describe('Venezuela: cédula o RIF del destinatario', () => {
  it('se acepta con su forma y se rechaza mal escrita', async () => {
    const m = mundo();
    const e = await empresaEn(m, 'VE');
    await envio(m, e, { destinatarioDocumento: 'V-12345678' });
    const mal = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios`,
      {
        centroId: e.centroId,
        destinatarioNombre: 'X',
        direccion: 'Calle 1',
        destinatarioDocumento: '123',
      },
      e.dueno.token,
    );
    expect(mal.estado).toBe(422);
  });
});

describe('C-FLEX-UBICACION · EE. UU. sigue con la dirección escrita', () => {
  it('sin punto nace «sin_coordenadas» y el punto de referencia no es obligatorio', async () => {
    const m = mundo();
    const e = await empresaEn(m, 'US');
    const x = await envio(m, e, {
      destinatarioTelefono: '(305) 555-0100',
      direccion: '100 Main St, Miami',
    });
    expect(x.ubicacionEstado).toBe('sin_coordenadas');
    const en = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios/${x.id}/enlace-ubicacion`,
      {},
      e.dueno.token,
    );
    expect(en.datos.mensaje).toMatch(/^Hi María/);
    const codigo = String(en.datos.url).split('/deliver/')[1] ?? '';
    expect(
      (await llamar(m, 'POST', `${B}/publico/ubicacion/${codigo}`, { lat: 25.77, lng: -80.19 }))
        .estado,
    ).toBe(200);
  });
});
