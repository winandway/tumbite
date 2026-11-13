import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import {
  type EscenarioVe,
  abrirCaracas,
  cargarPagoMovilVe,
  conductorListoVe,
  escenarioVe,
  pedirMotoVe,
  subirA,
} from '../pruebas/motoVe';

/**
 * Observaciones del revisor sobre Moto en Venezuela (13 nov 2026). Cada una con su prueba vista en
 * rojo antes del arreglo.
 */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

async function base() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const subir = async (ruta: string, token: string) =>
    (
      await m.crudo(ruta, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
        body: JPEG,
      })
    ).status;
  return { m, admin, subir };
}

describe('C-KYC-ATOMICO: aprobar la identidad no deja medio estado', () => {
  it('si la base rechaza el requisito de identidad, el KYC sigue pendiente y la respuesta es clara', async () => {
    const { m, admin, subir } = await base();
    const rep = await m.cuenta('repartidor', 'Conductor');
    for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
      expect(await subir(`/datos/kyc/foto/${p}`, rep.token)).toBe(201);
    expect(
      (await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'identificacion' }, rep.token))
        .estado,
    ).toBe(200);
    // La selfie desapareció (por ejemplo, la borró soporte): el disparador va a rechazar el requisito.
    await m.DB.prepare('UPDATE kyc SET selfie = NULL WHERE usuario_id = ?').bind(rep.id).run();
    const r = await m.llamar(
      'PATCH',
      `/datos/admin/kyc/${rep.id}`,
      { estado: 'aprobado' },
      admin.token,
    );
    expect(r.estado).toBe(409);
    const k = await m.DB.prepare('SELECT estado FROM kyc WHERE usuario_id = ?')
      .bind(rep.id)
      .first<{ estado: string }>();
    expect(k?.estado).toBe('pendiente');
    const c = await m.DB.prepare(
      "SELECT 1 FROM cumplimientos WHERE conductor_id = ? AND requisito = 'identidad'",
    )
      .bind(rep.id)
      .first();
    expect(c).toBeNull();
  });
});

describe('C-PAPELES-SOLO-PASAJEROS: el papel venezolano cumple solo lo de pasajeros', () => {
  it('el certificado de antecedentes no cumple el requisito «antecedentes» de Envíos, Mercado y Farmacia', async () => {
    const e = await escenarioVe();
    expect((await abrirCaracas(e)).estado).toBe(201);
    const rep = await e.m.cuenta('repartidor', 'Conductor Caracas');
    await e.m.llamar('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id }, rep.token);
    const doc = await subirA(e, '/datos/conductor/papeles?tipo=antecedentes_penales', rep.token);
    const ok = await e.m.llamar(
      'PUT',
      `/datos/admin/papeles-conductor/${doc.datos.id}`,
      { estado: 'aprobado' },
      e.admin.token,
    );
    expect(ok.estado).toBe(200);
    expect(ok.datos.requisitos).toEqual(['antecedentes_pasajeros']);
    const otros = await e.m.DB.prepare(
      "SELECT 1 FROM cumplimientos WHERE conductor_id = ? AND requisito = 'antecedentes'",
    )
      .bind(rep.id)
      .first();
    expect(otros).toBeNull();
  });

  it('un perfil de país que lo diga explícito sí puede cumplir otros servicios', async () => {
    const { requisitosQueCumple } = await import('@tumbite/compartido');
    const perfil = {
      ...(await import('@tumbite/compartido')).perfilPasajeros('VE'),
      requisitosOtrosServicios: { antecedentes_penales: ['antecedentes'] },
    };
    expect(requisitosQueCumple(perfil, 'antecedentes_penales')).toEqual([
      'antecedentes_pasajeros',
      'antecedentes',
    ]);
    // Uno de otros servicios metido por error en la lista de pasajeros no pasa.
    const mal = {
      ...perfil,
      requisitosOtrosServicios: {},
      requisitosDeDocumento: { antecedentes_penales: ['antecedentes_pasajeros', 'antecedentes'] },
    };
    expect(requisitosQueCumple(mal, 'antecedentes_penales')).toEqual(['antecedentes_pasajeros']);
  });
});

describe('C-CIUDAD-CONDUCTOR: cambiar de ciudad como en el mercado', () => {
  it('la primera vez elige cualquiera; después solo de su país, una vez cada 24 horas y desconectado', async () => {
    const e = await escenarioVe();
    expect((await abrirCaracas(e)).estado).toBe(201);
    await e.m.DB.prepare(
      "INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('VE-MCB-PRUEBAS', 'Maracaibo (pruebas)', 'VE', 'USD', 'America/Caracas', 10.65, -71.64, 25, 1)",
    ).run();
    const rep = await e.m.cuenta('repartidor', 'Conductor');
    const ciudad = (zonaId: string) =>
      e.m.llamar('PUT', '/datos/conductor/ciudad', { zonaId }, rep.token);
    expect((await ciudad(CCS.id)).estado).toBe(200);
    // Ya es de Venezuela: la lista solo trae ciudades de su país.
    const papeles = await e.m.llamar('GET', '/datos/conductor/papeles', undefined, rep.token);
    expect(papeles.datos.ciudades.every((z: { pais: string }) => z.pais === 'VE')).toBe(true);
    expect(papeles.datos.cambioCiudad.puedeCambiar).toBe(false);
    // Otro país: no (eso lo cambia el equipo).
    const miami = await ciudad('US-FL-MIAMI');
    expect(miami.estado).toBe(409);
    expect(miami.datos.campo).toBe('zonaId');
    // Mismo país pero antes de 24 horas: no.
    expect((await ciudad('VE-MCB-PRUEBAS')).estado).toBe(429);
    await e.m.DB.prepare(
      "UPDATE repartidores SET ciudad_elegida_en = datetime('now', '-25 hours') WHERE usuario_id = ?",
    )
      .bind(rep.id)
      .run();
    // Conectado: no.
    await e.m.DB.prepare('UPDATE repartidores SET conectado = 1 WHERE usuario_id = ?')
      .bind(rep.id)
      .run();
    expect((await ciudad('VE-MCB-PRUEBAS')).estado).toBe(409);
    await e.m.DB.prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?')
      .bind(rep.id)
      .run();
    expect((await ciudad('VE-MCB-PRUEBAS')).estado).toBe(200);
    // El equipo sí puede cambiarla a cualquier ciudad, con motivo, y queda en la auditoría.
    const sinMotivo = await e.m.llamar(
      'PUT',
      `/datos/admin/conductores/${rep.id}/ciudad`,
      { zonaId: 'US-FL-MIAMI' },
      e.admin.token,
    );
    expect(sinMotivo.estado).toBe(400);
    const equipo = await e.m.llamar(
      'PUT',
      `/datos/admin/conductores/${rep.id}/ciudad`,
      { zonaId: 'US-FL-MIAMI', motivo: 'Se mudó a Miami' },
      e.admin.token,
    );
    expect(equipo.estado).toBe(200);
    const fila = await e.m.DB.prepare(
      'SELECT r.zona_id AS r, u.zona_id AS u FROM repartidores r JOIN usuarios u ON u.id = r.usuario_id WHERE r.usuario_id = ?',
    )
      .bind(rep.id)
      .first<{ r: string; u: string }>();
    expect(fila).toEqual({ r: 'US-FL-MIAMI', u: 'US-FL-MIAMI' });
    const audit = await e.m.DB.prepare(
      "SELECT 1 FROM auditoria_admin WHERE accion = 'conductor.ciudad' AND objeto = ?",
    )
      .bind(`conductor:${rep.id}`)
      .first();
    expect(audit).not.toBeNull();
  });

  it('a un repartidor de Comida que no la usa no le cambia nada', async () => {
    const e = await escenarioVe();
    const rep = await e.m.cuenta('repartidor', 'Repartidor de Comida');
    await e.m.DB.prepare(
      "INSERT INTO repartidores (usuario_id, conectado, zona_id) VALUES (?, 0, 'US-FL-MIAMI')",
    )
      .bind(rep.id)
      .run();
    const antes = await e.m.DB.prepare('SELECT * FROM repartidores WHERE usuario_id = ?')
      .bind(rep.id)
      .first();
    await e.m.llamar('GET', '/datos/conductor/papeles', undefined, rep.token);
    const despues = await e.m.DB.prepare('SELECT * FROM repartidores WHERE usuario_id = ?')
      .bind(rep.id)
      .first();
    expect(despues).toEqual(antes);
  });
});

describe('C-PAGO-MOVIL-CORREGIR: «no me llegó» por error se corrige una vez', () => {
  async function viajeNoRecibido() {
    const e = await escenarioVe();
    await abrirCaracas(e);
    const c = await conductorListoVe(e, 500);
    await cargarPagoMovilVe(c);
    const v = await pedirMotoVe(e, 'pago_movil');
    expect((await c.paso(v.id, 'aceptar')).estado).toBe(200);
    expect((await c.paso(v.id, 'llegue')).estado).toBe(200);
    const pin = (await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token)).datos
      .viaje.pin;
    expect((await c.paso(v.id, 'iniciar', { pin })).estado).toBe(200);
    expect((await c.paso(v.id, 'pago-movil', { recibido: false })).estado).toBe(200);
    return { e, c, v };
  }
  const incidencia = (e: EscenarioVe, id: string) =>
    e.m.DB.prepare(
      "SELECT estado, detalle FROM incidencias_dinero WHERE referencia = 'pago-movil-viaje:' || ?",
    )
      .bind(id)
      .first<{ estado: string; detalle: string }>();

  it('dentro de 30 minutos pasa a «sí me llegó» y el caso de soporte se cierra solo con nota', async () => {
    const { e, c, v } = await viajeNoRecibido();
    expect((await incidencia(e, v.id))?.estado).toBe('abierta');
    const r = await c.paso(v.id, 'pago-movil', { recibido: true, referencia: '123456' });
    expect(r.estado).toBe(200);
    expect(r.datos.estado).toBe('recibido');
    expect(r.datos.corregido).toBe(true);
    const caso = await incidencia(e, v.id);
    expect(caso?.estado).toBe('resuelta');
    expect(caso?.detalle).toMatch(/corrigió/);
    const vista = await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token);
    expect(vista.datos.viaje.pagoMovil.confirmado).toBe('recibido');
    // Una sola vez: volver a «no me llegó» ya es cosa de soporte.
    const otra = await c.paso(v.id, 'pago-movil', { recibido: false });
    expect(otra.estado).toBe(409);
    // Repetir lo mismo (doble toque) no es un error.
    expect((await c.paso(v.id, 'pago-movil', { recibido: true })).estado).toBe(200);
  });

  it('pasados los 30 minutos ya no se corrige desde la app', async () => {
    const { e, c, v } = await viajeNoRecibido();
    await e.m.DB.prepare(
      "UPDATE viajes_pago_movil SET creado_en = datetime('now', '-31 minutes') WHERE operacion_id = ?",
    )
      .bind(v.id)
      .run();
    const r = await c.paso(v.id, 'pago-movil', { recibido: true });
    expect(r.estado).toBe(409);
    expect((await incidencia(e, v.id))?.estado).toBe('abierta');
  });
});
