import { describe, expect, it } from 'vitest';
import { FOTO_PRUEBA, mundo } from '../pruebas/ayuda';

/**
 * Multiservicio, Fase 1: catálogo, vehículos, habilitaciones y preferencias. Candados
 * C-SERVICIOS-IMPLEMENTADOS (Moto y Carro no se encienden) y C-COMIDA-INTACTA (Comida sigue
 * igual para quien ya reparte, sin filas nuevas).
 */
async function escenario() {
  const m = mundo();
  const admin = await m.cuenta('admin', 'Soporte Tumbite');
  const rep = await m.cuenta('repartidor', 'Rep Uno');
  return { m, admin, rep };
}
const MIAMI = { lat: 25.7617, lng: -80.1918 };

/** Sube un documento (bytes crudos) como lo haría la app. */
async function subirDoc(
  m: ReturnType<typeof mundo>,
  token: string,
  vehiculo: string,
  tipo: string,
) {
  const res = await m.crudo(`/datos/conductor/vehiculos/${vehiculo}/documentos?tipo=${tipo}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'cf-connecting-ip': '10.9.9.9' },
    body: FOTO_PRUEBA,
  });
  return { estado: res.status, datos: (await res.json()) as { id: string } };
}

/** Un vehículo motorizado aprobado de punta a punta por el panel. */
async function vehiculoAprobado(
  e: Awaited<ReturnType<typeof escenario>>,
  tipo = 'carro',
  placa = 'ABC123',
) {
  const { m, admin, rep } = e;
  const v = await m.llamar(
    'POST',
    '/datos/conductor/vehiculos',
    {
      tipo,
      marca: 'Toyota',
      modelo: 'Corolla',
      anio: 2020,
      color: 'Gris',
      placa,
      placaEstado: 'FL',
    },
    rep.token,
  );
  expect(v.estado).toBe(201);
  const id = v.datos.id as string;
  const docs = [];
  for (const t of ['registro', 'seguro']) docs.push((await subirDoc(m, rep.token, id, t)).datos.id);
  expect(
    (await m.llamar('POST', `/datos/conductor/vehiculos/${id}/enviar`, {}, rep.token)).estado,
  ).toBe(200);
  for (const d of docs)
    expect(
      (
        await m.llamar(
          'PUT',
          `/datos/admin/vehiculos/${id}/documentos/${d}`,
          { estado: 'aprobado', venceEn: '2099-01-01' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
  expect(
    (await m.llamar('PUT', `/datos/admin/vehiculos/${id}`, { estado: 'aprobado' }, admin.token))
      .estado,
  ).toBe(200);
  return id;
}

describe('catálogo de servicios (GET /datos/servicios)', () => {
  it('Comida se abre en Miami; Moto, Carro y los demás salen «muy pronto»', async () => {
    const { m } = await escenario();
    const r = await m.llamar('GET', `/datos/servicios?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
    expect(r.estado).toBe(200);
    expect(r.datos.zona.id).toBe('US-FL-MIAMI');
    const por = new Map<string, { accion: string; estado: string }>(
      r.datos.servicios.map((s: { id: string }) => [s.id, s]),
    );
    expect(por.get('comida')).toMatchObject({ estado: 'disponible', accion: 'abrir' });
    for (const id of ['moto', 'carro', 'mercado', 'envios', 'farmacia'])
      expect(por.get(id)?.accion).toBe('muy_pronto');
  });

  it('fuera de una zona activa nada se abre', async () => {
    const { m } = await escenario();
    const r = await m.llamar('GET', '/datos/servicios?lat=48.85&lng=2.35');
    expect(r.datos.zona).toBeNull();
    expect(r.datos.servicios.find((s: { id: string }) => s.id === 'comida').accion).toBe(
      'no_disponible_zona',
    );
  });

  it('una app más vieja que la mínima del servicio recibe «actualizar_app»', async () => {
    const { m, admin } = await escenario();
    await m.llamar(
      'PUT',
      '/datos/admin/servicios/comida',
      { versionMinCliente: '2.0.0' },
      admin.token,
    );
    const res = await m.crudo(`/datos/servicios?lat=${MIAMI.lat}&lng=${MIAMI.lng}`, {
      headers: { 'x-tumbite-app': 'cliente@1.9.9' },
    });
    const datos = (await res.json()) as { servicios: { id: string; accion: string }[] };
    expect(datos.servicios.find((s) => s.id === 'comida')?.accion).toBe('actualizar_app');
    const nueva = await m.crudo(`/datos/servicios?lat=${MIAMI.lat}&lng=${MIAMI.lng}`, {
      headers: { 'x-tumbite-app': 'cliente@2.0.0' },
    });
    const d2 = (await nueva.json()) as { servicios: { id: string; accion: string }[] };
    expect(d2.servicios.find((s) => s.id === 'comida')?.accion).toBe('abrir');
  });
});

describe('C-SERVICIOS-IMPLEMENTADOS: Moto y Carro no se pueden encender', () => {
  it('el panel lo rechaza (servicio y zona)', async () => {
    const { m, admin } = await escenario();
    for (const id of ['moto', 'carro']) {
      expect(
        (
          await m.llamar(
            'PUT',
            `/datos/admin/servicios/${id}`,
            { estado: 'disponible' },
            admin.token,
          )
        ).estado,
      ).toBe(409);
      expect(
        (
          await m.llamar(
            'PUT',
            `/datos/admin/servicios/${id}/zonas/US-FL-MIAMI`,
            { estado: 'disponible' },
            admin.token,
          )
        ).estado,
      ).toBe(409);
    }
  });

  it('y la base también, aunque alguien escriba directo (no están implementados)', async () => {
    const { m } = await escenario();
    for (const sql of [
      "UPDATE servicios SET estado = 'disponible' WHERE id = 'moto'",
      "UPDATE servicios SET estado = 'disponible' WHERE id = 'carro'",
      "UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'moto'",
      "UPDATE servicios SET estado = 'disponible' WHERE id = 'mercado'",
    ])
      await expect(m.DB.prepare(sql).run()).rejects.toThrow(/servicio_no_implementado/);
    const implementados = await m.DB.prepare(
      'SELECT servicio_id FROM servicios_implementados',
    ).all<{
      servicio_id: string;
    }>();
    expect(implementados.results.map((r) => r.servicio_id)).toEqual(['comida']);
  });

  it('el panel sí puede pausar y volver a abrir Comida, y queda en la auditoría', async () => {
    const { m, admin } = await escenario();
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/servicios/comida',
          { estado: 'suspendido' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    const r = await m.llamar('GET', `/datos/servicios?lat=${MIAMI.lat}&lng=${MIAMI.lng}`);
    expect(r.datos.servicios.find((s: { id: string }) => s.id === 'comida').accion).toBe(
      'en_pausa',
    );
    await m.llamar('PUT', '/datos/admin/servicios/comida', { estado: 'disponible' }, admin.token);
    const aud = await m.llamar(
      'GET',
      '/datos/admin/auditoria?objeto=servicio:comida',
      undefined,
      admin.token,
    );
    expect(aud.datos.auditoria.length).toBe(2);
    expect(aud.datos.auditoria[0].actor_id).toBe(admin.id);
  });

  it('solo el admin entra al panel de servicios', async () => {
    const { m, rep } = await escenario();
    expect((await m.llamar('GET', '/datos/admin/servicios', undefined, rep.token)).estado).toBe(
      403,
    );
    expect(
      (await m.llamar('PUT', '/datos/admin/servicios/comida', { estado: 'suspendido' }, rep.token))
        .estado,
    ).toBe(403);
  });
});

describe('C-COMIDA-INTACTA: quien ya reparte sigue igual', () => {
  it('sin filas nuevas, Comida aparece habilitada y activa; lo demás, próximamente', async () => {
    const { m, rep } = await escenario();
    const r = await m.llamar('GET', '/datos/conductor/servicios', undefined, rep.token);
    expect(r.estado).toBe(200);
    const comida = r.datos.servicios.find((s: { servicioId: string }) => s.servicioId === 'comida');
    expect(comida).toMatchObject({
      habilitacion: 'aprobada',
      puedeActivar: true,
      preferencia: true,
      motivo: 'habilitado',
    });
    const moto = r.datos.servicios.find((s: { servicioId: string }) => s.servicioId === 'moto');
    expect(moto).toMatchObject({ puedeActivar: false, motivo: 'proximamente' });
  });

  it('no puede activar un servicio que no está disponible para él', async () => {
    const { m, rep } = await escenario();
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/conductor/preferencias',
          { servicioId: 'moto', activa: true },
          rep.token,
        )
      ).estado,
    ).toBe(409);
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/conductor/preferencias',
          { servicioId: 'comida', activa: false },
          rep.token,
        )
      ).estado,
    ).toBe(200);
    const r = await m.llamar('GET', '/datos/conductor/servicios', undefined, rep.token);
    expect(
      r.datos.servicios.find((s: { servicioId: string }) => s.servicioId === 'comida').preferencia,
    ).toBe(false);
  });
});

describe('vehículos', () => {
  it('registro, documentos, revisión y aprobación con su historial', async () => {
    const e = await escenario();
    const id = await vehiculoAprobado(e);
    const hist = await e.m.DB.prepare(
      'SELECT estado_anterior, estado_nuevo FROM vehiculo_revisiones WHERE vehiculo_id = ? ORDER BY id',
    )
      .bind(id)
      .all<{ estado_anterior: string; estado_nuevo: string }>();
    expect(hist.results).toEqual([
      { estado_anterior: 'registrado', estado_nuevo: 'en_revision' },
      { estado_anterior: 'en_revision', estado_nuevo: 'aprobado' },
    ]);
    // El seguro aprobado cuenta como requisito cumplido del vehículo.
    const c = await e.m.DB.prepare(
      "SELECT estado FROM cumplimientos WHERE vehiculo_id = ? AND requisito = 'seguro_vehiculo'",
    )
      .bind(id)
      .first<{ estado: string }>();
    expect(c?.estado).toBe('aprobado');
  });

  it('no se aprueba sin registro y seguro aprobados', async () => {
    const { m, admin, rep } = await escenario();
    const v = await m.llamar(
      'POST',
      '/datos/conductor/vehiculos',
      { tipo: 'moto', placa: 'MOT1', placaEstado: 'FL' },
      rep.token,
    );
    const id = v.datos.id as string;
    expect(
      (await m.llamar('POST', `/datos/conductor/vehiculos/${id}/enviar`, {}, rep.token)).estado,
    ).toBe(422);
    await subirDoc(m, rep.token, id, 'registro');
    await subirDoc(m, rep.token, id, 'seguro');
    expect(
      (await m.llamar('POST', `/datos/conductor/vehiculos/${id}/enviar`, {}, rep.token)).estado,
    ).toBe(200);
    // Documentos todavía pendientes: la base no deja aprobar.
    expect(
      (await m.llamar('PUT', `/datos/admin/vehiculos/${id}`, { estado: 'aprobado' }, admin.token))
        .estado,
    ).toBe(409);
  });

  it('una placa no puede estar viva en dos cuentas', async () => {
    const { m, rep } = await escenario();
    const otro = await m.cuenta('repartidor', 'Rep Dos');
    const datos = { tipo: 'carro', placa: 'xyz789', placaEstado: 'fl' };
    expect((await m.llamar('POST', '/datos/conductor/vehiculos', datos, rep.token)).estado).toBe(
      201,
    );
    expect((await m.llamar('POST', '/datos/conductor/vehiculos', datos, otro.token)).estado).toBe(
      409,
    );
  });

  it('el vehículo activo tiene que estar aprobado y ser suyo', async () => {
    const e = await escenario();
    const { m, rep } = e;
    const sinAprobar = await m.llamar(
      'POST',
      '/datos/conductor/vehiculos',
      { tipo: 'bicicleta' },
      rep.token,
    );
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/conductor/vehiculo-activo',
          { vehiculoId: sinAprobar.datos.id },
          rep.token,
        )
      ).estado,
    ).toBe(409);
    const id = await vehiculoAprobado(e);
    const otro = await m.cuenta('repartidor', 'Rep Tres');
    expect(
      (await m.llamar('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: id }, otro.token))
        .estado,
    ).toBe(404);
    expect(
      (await m.llamar('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: id }, rep.token))
        .estado,
    ).toBe(200);
    const r = await m.llamar('GET', '/datos/conductor/servicios', undefined, rep.token);
    expect(r.datos.vehiculoActivo).toMatchObject({ id, tipo: 'carro', estado: 'aprobado' });
    // Suspenderlo lo quita como activo.
    await m.llamar(
      'PUT',
      `/datos/admin/vehiculos/${id}`,
      { estado: 'suspendido', motivo: 'Seguro vencido' },
      e.admin.token,
    );
    const r2 = await m.llamar('GET', '/datos/conductor/vehiculos', undefined, rep.token);
    expect(r2.datos.vehiculoActivoId).toBeNull();
  });

  it('los documentos son privados: solo el admin los abre', async () => {
    const { m, admin, rep } = await escenario();
    const v = await m.llamar(
      'POST',
      '/datos/conductor/vehiculos',
      { tipo: 'carro', placa: 'P1', placaEstado: 'FL' },
      rep.token,
    );
    const doc = await subirDoc(m, rep.token, v.datos.id, 'seguro');
    const ruta = `/datos/admin/vehiculos/${v.datos.id}/documentos/${doc.datos.id}/archivo`;
    expect((await m.llamar('GET', ruta, undefined, rep.token)).estado).toBe(403);
    const r = await m.crudo(ruta, { headers: { authorization: `Bearer ${admin.token}` } });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toContain('no-store');
  });
});

describe('habilitaciones', () => {
  it('Moto no se habilita sin sus requisitos; con ellos sí, con historial', async () => {
    const { m, admin, rep } = await escenario();
    const sin = await m.llamar(
      'PUT',
      `/datos/admin/habilitaciones/${rep.id}/moto`,
      { estado: 'aprobada' },
      admin.token,
    );
    expect(sin.estado).toBe(409);
    expect(sin.datos.requisitosFaltantes).toEqual(
      expect.arrayContaining(['identidad', 'antecedentes_pasajeros', 'licencia_moto']),
    );
    // Los que revisa una persona se aprueban en el panel; identidad y antecedentes, no.
    expect(
      (
        await m.llamar(
          'PUT',
          `/datos/admin/cumplimientos/${rep.id}/identidad`,
          { estado: 'aprobado' },
          admin.token,
        )
      ).estado,
    ).toBe(409);
    for (const r of ['licencia_moto', 'edad_minima_21'])
      expect(
        (
          await m.llamar(
            'PUT',
            `/datos/admin/cumplimientos/${rep.id}/${r}`,
            { estado: 'aprobado' },
            admin.token,
          )
        ).estado,
      ).toBe(200);
    // La identidad viene de una verificación real revisada por el equipo (kyc con evidencia).
    await m.DB.prepare(
      "INSERT INTO kyc (usuario_id, estado, doc_frente, selfie, revisado_en, revisado_por) VALUES (?, 'aprobado', 'kyc/d.jpg', 'kyc/s.jpg', datetime('now'), ?)",
    )
      .bind(rep.id, admin.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO cumplimientos (conductor_id, requisito, estado, fuente) VALUES (?, 'identidad', 'aprobado', 'kyc')",
    )
      .bind(rep.id)
      .run();
    // Antecedentes e historial vienen de su proveedor (aquí, simulados como «sistema»).
    for (const r of ['antecedentes_pasajeros', 'historial_manejo'])
      await m.DB.prepare(
        "INSERT INTO cumplimientos (conductor_id, requisito, estado, fuente) VALUES (?, ?, 'aprobado', 'sistema')",
      )
        .bind(rep.id, r)
        .run();
    const con = await m.llamar(
      'PUT',
      `/datos/admin/habilitaciones/${rep.id}/moto`,
      { estado: 'aprobada' },
      admin.token,
    );
    expect(con.estado).toBe(200);
    const h = await m.DB.prepare(
      "SELECT estado_anterior, estado_nuevo, actor_id FROM habilitaciones_historial WHERE conductor_id = ? AND servicio_id = 'moto'",
    )
      .bind(rep.id)
      .all();
    expect(h.results).toEqual([
      { estado_anterior: '', estado_nuevo: 'aprobada', actor_id: admin.id },
    ]);
    // Habilitado, pero el servicio sigue apagado al público: no lo puede activar.
    const r = await m.llamar('GET', '/datos/conductor/servicios', undefined, rep.token);
    expect(
      r.datos.servicios.find((s: { servicioId: string }) => s.servicioId === 'moto'),
    ).toMatchObject({
      habilitacion: 'aprobada',
      puedeActivar: false,
      motivo: 'proximamente',
    });
  });

  it('nadie aprueba una habilitación de pasajeros escribiendo directo en la base', async () => {
    const { m, rep } = await escenario();
    await expect(
      m.DB.prepare(
        "INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por) VALUES (?, 'carro', 'aprobada', ?)",
      )
        .bind(rep.id, rep.id)
        .run(),
    ).rejects.toThrow(/habilitacion_con_requisitos_faltantes/);
  });
});

describe('salud del catálogo (canario)', () => {
  it('dice ok con Moto y Carro apagados y error si alguien enciende uno a la fuerza', async () => {
    const { m } = await escenario();
    const pieza = async () =>
      (await m.llamar('GET', '/datos/salud')).datos.piezas.servicios as string;
    expect(await pieza()).toBe('ok');
    // A la fuerza: se quita el disparador y se enciende Moto escribiendo directo en la base.
    await m.DB.prepare('DROP TRIGGER servicios_exige_implementado').run();
    await m.DB.prepare("UPDATE servicios SET estado = 'disponible' WHERE id = 'moto'").run();
    expect(await pieza()).toBe('error');
  });
});

describe('ciudades nuevas', () => {
  it('una ciudad activa nueva abre Comida sola; Moto y Carro quedan próximamente', async () => {
    const { m, admin } = await escenario();
    const zona = {
      id: 'US-FL-ORLANDO',
      nombre: 'Orlando',
      pais: 'US',
      moneda: 'USD',
      zonaHoraria: 'America/New_York',
      lat: 28.5384,
      lng: -81.3789,
      radioKm: 30,
      activa: false,
    };
    expect((await m.llamar('PUT', '/datos/admin/zonas', zona, admin.token)).estado).toBe(200);
    const estado = async (s: string) =>
      (
        await m.DB.prepare(
          'SELECT estado FROM servicios_zona WHERE servicio_id = ? AND zona_id = ?',
        )
          .bind(s, zona.id)
          .first<{ estado: string }>()
      )?.estado;
    expect(await estado('comida')).toBe('proximamente');
    expect(
      (await m.llamar('PATCH', `/datos/admin/zonas/${zona.id}`, { activa: true }, admin.token))
        .estado,
    ).toBe(200);
    expect(await estado('comida')).toBe('disponible');
    expect(await estado('moto')).toBe('proximamente');
    const r = await m.llamar('GET', `/datos/servicios?lat=${zona.lat}&lng=${zona.lng}`);
    expect(r.datos.servicios.find((s: { id: string }) => s.id === 'comida').accion).toBe('abrir');
  });

  it('si el equipo pausó Comida en una ciudad, volver a prenderla no la abre sola', async () => {
    const { m, admin } = await escenario();
    await m.llamar(
      'PUT',
      '/datos/admin/servicios/comida/zonas/US-FL-MIAMI',
      { estado: 'suspendido', motivo: 'Huracán' },
      admin.token,
    );
    await m.llamar('PATCH', '/datos/admin/zonas/US-FL-MIAMI', { activa: false }, admin.token);
    await m.llamar('PATCH', '/datos/admin/zonas/US-FL-MIAMI', { activa: true }, admin.token);
    const f = await m.DB.prepare(
      "SELECT estado FROM servicios_zona WHERE servicio_id = 'comida' AND zona_id = 'US-FL-MIAMI'",
    ).first<{ estado: string }>();
    expect(f?.estado).toBe('suspendido');
  });
});
