import { afterEach, describe, expect, it } from 'vitest';
import { type LlamadaIa, usarModeloVerificacion } from './verificacionIa';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS, crucesDocumento } from '@tumbite/compartido';
import { abrirCaracas } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';
import {
  REQUISITO_EDAD,
  edadMinimaDe,
  edadPorDefecto,
  guardarDatosLeidos,
  rellenarDatosDocumento,
} from './edadYDocumento';

/**
 * Caso real (Richard, 25 nov 2026): a un conductor de Venezuela nacido en 1974 «Habilitar para Moto»
 * le decía «Le falta: Tener 21 años o más». C-EDAD-POR-PAIS, C-FECHA-GUARDADA y C-CRUCES-DOCUMENTO —
 * todos los países.
 */
async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  expect((await abrirCaracas({ m, admin, cliente })).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  const conductor = async (nombre: string, fecha: string | null) => {
    const rep = await m.cuenta('repartidor', nombre);
    expect(
      (await m.llamar('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id }, rep.token)).estado,
    ).toBe(200);
    await m.DB.prepare('UPDATE usuarios SET fecha_nacimiento = ? WHERE id = ?')
      .bind(fecha, rep.id)
      .run();
    return rep;
  };
  const lectura = async (id: string, json: Record<string, unknown>, paso = 'doc_frente') => {
    // Toda foto subida deja su fila en `kyc` (así la recorre el relleno).
    await m.DB.prepare('INSERT OR IGNORE INTO kyc (usuario_id) VALUES (?)').bind(id).run();
    await m.DB.prepare(
      `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, estado, ia_color, ia_json)
       VALUES (?, ?, ?, 'verif/doc', 'vigente', 'verde', ?)`,
    )
      .bind(`vf-${paso}-${id}`, id, paso, JSON.stringify(json))
      .run();
  };
  const edadCumplida = async (id: string) =>
    m.DB.prepare(
      "SELECT estado, fuente FROM cumplimientos WHERE conductor_id = ? AND vehiculo_id = '' AND requisito = ?",
    )
      .bind(id, REQUISITO_EDAD)
      .first<{ estado: string; fuente: string }>();
  return { m, admin, equipo, conductor, lectura, edadCumplida };
}
const motoDe = (r: { datos: { servicios: { servicioId: string }[] } }) =>
  r.datos.servicios.find((x) => x.servicioId === 'moto') as unknown as {
    requisitosFaltantes: string[];
  };

describe('C-EDAD-POR-PAIS: la edad mínima va por país y por servicio', () => {
  it('por defecto: Venezuela Moto 18; EE. UU. Moto 21 y el reparto con su regla de siempre', () => {
    expect(edadPorDefecto({ pais: 'VE', servicio: 'moto' })).toBe(18);
    expect(edadPorDefecto({ pais: 'US', servicio: 'moto' })).toBe(21);
    expect(edadPorDefecto({ pais: 'US', servicio: 'comida', zonaId: 'US-CA-LA' })).toBe(21);
    expect(edadPorDefecto({ pais: 'US', servicio: 'comida', zonaId: 'US-FL-MIAMI' })).toBe(19);
    expect(edadPorDefecto({ pais: 'VE', servicio: 'comida' })).toBe(18);
    expect(edadMinimaDe({ VE: { moto: 20 } }, { pais: 'VE', servicio: 'moto' })).toBe(20);
  });

  it('el caso real: nacido en 1974 en Venezuela, a Moto no le falta la edad y la habilitación no la pide', async () => {
    const s = await escenario();
    const rep = await s.conductor('Conductor De Mil Novecientos', '1974-03-10');
    const ficha = await s.equipo('GET', `/datos/admin/conductores/${rep.id}/pasajeros`);
    expect(motoDe(ficha).requisitosFaltantes).not.toContain(REQUISITO_EDAD);
    expect(ficha.datos.edades.find((x: { servicio: string }) => x.servicio === 'moto')).toEqual({
      servicio: 'moto',
      minima: 18,
      edad: expect.any(Number),
      falta: null,
    });
    const r = await s.equipo('PUT', `/datos/admin/habilitaciones/${rep.id}/moto`, {
      estado: 'aprobada',
    });
    // Le pueden faltar otros papeles, pero nunca la edad.
    expect(r.datos.requisitosFaltantes ?? []).not.toContain(REQUISITO_EDAD);
    expect(await s.edadCumplida(rep.id)).toEqual({ estado: 'aprobado', fuente: 'sistema' });
  });

  it('sin fecha falta la edad; menor que la de su país, también; el equipo la cambia por país', async () => {
    const s = await escenario();
    const sinFecha = await s.conductor('Conductor Sin Fecha', null);
    const r1 = await s.equipo('PUT', `/datos/admin/habilitaciones/${sinFecha.id}/moto`, {
      estado: 'aprobada',
    });
    expect(r1.estado).toBe(409);
    expect(r1.datos.requisitosFaltantes).toContain(REQUISITO_EDAD);
    const hoy = new Date();
    const diecinueve = `${hoy.getUTCFullYear() - 19}-01-01`;
    const joven = await s.conductor('Conductor Joven', diecinueve);
    let ficha = await s.equipo('GET', `/datos/admin/conductores/${joven.id}/pasajeros`);
    expect(motoDe(ficha).requisitosFaltantes).not.toContain(REQUISITO_EDAD);
    // El equipo sube Moto en Venezuela a 21: al de 19 ahora le falta.
    const put = await s.equipo('PUT', '/datos/admin/edades-pais', {
      pais: 'VE',
      servicio: 'moto',
      edad: 21,
      motivo: 'Prueba de la edad por país',
    });
    expect(put.estado).toBe(200);
    const tabla = await s.equipo('GET', '/datos/admin/edades-pais');
    const ve = tabla.datos.paises.find((p: { pais: string }) => p.pais === 'VE');
    expect(ve.servicios.find((x: { servicio: string }) => x.servicio === 'moto')).toMatchObject({
      edad: 21,
      fijada: true,
      porDefecto: 18,
    });
    ficha = await s.equipo('GET', `/datos/admin/conductores/${joven.id}/pasajeros`);
    expect(
      ficha.datos.edades.find((x: { servicio: string }) => x.servicio === 'moto'),
    ).toMatchObject({ minima: 21, edad: 19, falta: 'menor' });
    const r2 = await s.equipo('PUT', `/datos/admin/habilitaciones/${joven.id}/moto`, {
      estado: 'aprobada',
    });
    expect(r2.estado).toBe(409);
    expect(r2.datos.requisitosFaltantes).toContain(REQUISITO_EDAD);
    const audit = await s.m.DB.prepare(
      "SELECT actor_id FROM auditoria_admin WHERE accion = 'config.edad_minima'",
    ).first<{ actor_id: string }>();
    expect(audit?.actor_id).toBe(s.admin.id);
  });
});

describe('C-FECHA-GUARDADA: lo leído se guarda al leerlo y la edad sale de la fecha guardada', () => {
  it('con la confianza en verde la fecha pasa a la cuenta; repetir no escribe; con confianza baja, no', async () => {
    const s = await escenario();
    const a = await s.conductor('Conductor Leido', null);
    await s.lectura(a.id, {
      nombre: 'Conductor Leido',
      numero: 'V12345678',
      vence: '2031-01-01',
      nacimiento: '1974-03-10',
      confianzaNacimiento: 93,
      confianza: 95,
    });
    expect(await guardarDatosLeidos(s.m.DB, a.id)).toEqual({ escribio: true, fecha: true });
    const u = await s.m.DB.prepare('SELECT fecha_nacimiento FROM usuarios WHERE id = ?')
      .bind(a.id)
      .first<{ fecha_nacimiento: string }>();
    expect(u?.fecha_nacimiento).toBe('1974-03-10');
    const dd = await s.m.DB.prepare(
      'SELECT numero, nacimiento, estado FROM datos_documento WHERE usuario_id = ?',
    )
      .bind(a.id)
      .first();
    expect(dd).toEqual({ numero: 'V12345678', nacimiento: '1974-03-10', estado: 'propuesta' });
    expect(await s.edadCumplida(a.id)).toEqual({ estado: 'aprobado', fuente: 'sistema' });
    // Al día: no escribe nada.
    expect(await guardarDatosLeidos(s.m.DB, a.id)).toEqual({ escribio: false, fecha: false });
    const b = await s.conductor('Conductor Dudoso', null);
    await s.lectura(b.id, { nacimiento: '1974-03-10', confianzaNacimiento: 40, confianza: 90 });
    expect((await guardarDatosLeidos(s.m.DB, b.id)).fecha).toBe(false);
  });

  it('sin fecha, el equipo la escribe a mano con su motivo y queda en la auditoría', async () => {
    const s = await escenario();
    const c = await s.conductor('Conductor A Mano', null);
    const r = await s.equipo('PUT', `/datos/admin/conductores/${c.id}/fecha-nacimiento`, {
      fecha: '1980-06-01',
      motivo: 'Leída de la foto de su cédula',
    });
    expect(r.estado).toBe(200);
    const audit = await s.m.DB.prepare(
      "SELECT actor_id, despues_json FROM auditoria_admin WHERE accion = 'conductor.fecha_nacimiento' AND objeto = ?",
    )
      .bind(`usuario:${c.id}`)
      .first<{ actor_id: string; despues_json: string }>();
    expect(audit?.actor_id).toBe(s.admin.id);
    expect(JSON.parse(audit?.despues_json ?? '{}')).toMatchObject({ fuente: 'a_mano' });
    expect(await s.edadCumplida(c.id)).toEqual({ estado: 'aprobado', fuente: 'sistema' });
  });

  it('el relleno: primero lo ya leído sin IA; solo sin fecha leída se relee, con tope; al día no hace nada', async () => {
    const s = await escenario();
    const conFecha = await s.conductor('Conductor Ya Leido', null);
    await s.lectura(conFecha.id, {
      nacimiento: '1974-03-10',
      confianzaNacimiento: 90,
      confianza: 90,
    });
    const viejo = await s.conductor('Conductor Lectura Vieja', null);
    await s.lectura(viejo.id, { nombre: 'Conductor Lectura Vieja', numero: 'V1', confianza: 90 });
    const releidas: string[] = [];
    const releer = async (c: { conductorId: string; fotoId: string | null }) => {
      releidas.push(c.conductorId);
      await s.m.DB.prepare('UPDATE verificacion_fotos SET ia_json = ? WHERE id = ?')
        .bind(
          JSON.stringify({ nacimiento: '1975-01-02', confianzaNacimiento: 90, confianza: 90 }),
          c.fotoId,
        )
        .run();
      return true;
    };
    const r = await rellenarDatosDocumento(s.m.DB, releer);
    expect(r.releidas).toBe(1);
    expect(releidas).toEqual([viejo.id]);
    const fechas = await s.m.DB.prepare(
      'SELECT id, fecha_nacimiento AS f FROM usuarios WHERE id IN (?, ?) ORDER BY nombre',
    )
      .bind(conFecha.id, viejo.id)
      .all<{ id: string; f: string }>();
    expect(Object.fromEntries(fechas.results.map((x) => [x.id, x.f]))).toEqual({
      [conFecha.id]: '1974-03-10',
      [viejo.id]: '1975-01-02',
    });
    // Segunda vuelta: todo al día, nada que releer.
    releidas.length = 0;
    expect(await rellenarDatosDocumento(s.m.DB, releer)).toEqual({ sinIa: 0, releidas: 0 });
    expect(releidas).toEqual([]);
  });
});

describe('C-CRUCES-DOCUMENTO: lo que no cuadra sale con su motivo', () => {
  it('nombre, número contra licencia, vencimiento, edad y falta de fecha', () => {
    const base = {
      nombreEscrito: 'José Pérez',
      nombreLeido: 'PEREZ JOSE',
      numeroDocumento: 'V-12.345.678',
      numeroLicencia: '12345678',
      venceDocumento: '2031-01-01',
      fechaNacimiento: '1974-03-10',
      edad: 52,
      edadMinima: 18,
      hoy: '2026-11-25',
    };
    expect(crucesDocumento(base)).toEqual([]);
    expect(
      crucesDocumento({
        ...base,
        nombreLeido: 'Ana Gómez',
        numeroLicencia: '99999999',
        venceDocumento: '2020-01-01',
        edad: 17,
      }).map((c) => c.clave),
    ).toEqual(['nombre', 'numero', 'vencido', 'edad']);
    expect(crucesDocumento({ ...base, fechaNacimiento: null }).map((c) => c.clave)).toEqual([
      'sin_fecha',
    ]);
  });

  it('la bandeja de Verificaciones trae los cruces de cada conductor', async () => {
    const s = await escenario();
    const c = await s.conductor('Conductor Cruce', null);
    await s.m.DB.prepare(
      "INSERT INTO kyc (usuario_id, estado, doc_frente, selfie, enviado_en) VALUES (?, 'pendiente', 'kyc/doc', 'kyc/cara', datetime('now'))",
    )
      .bind(c.id)
      .run();
    await s.lectura(c.id, { nombre: 'Otra Persona Distinta', confianza: 90 });
    await guardarDatosLeidos(s.m.DB, c.id);
    const r = await s.equipo('GET', '/datos/admin/kyc?estado=pendiente&cuentas=todas');
    const fila = r.datos.solicitudes.find((x: { id: string }) => x.id === c.id);
    expect(fila.cruces.map((x: { clave: string }) => x.clave)).toEqual(['nombre', 'sin_fecha']);
  });
});

describe('C-FECHA-GUARDADA: al leer la cédula, lo leído pasa a la cuenta en ese momento', () => {
  afterEach(() => usarModeloVerificacion(null));

  it('la foto del documento que mira la IA deja la fecha en la cuenta y la edad al día, en la misma subida', async () => {
    const f: LlamadaIa = async () => ({
      texto: JSON.stringify({
        clase: 'identidad_frente',
        legible: true,
        vencido: 'no',
        nombre: 'Conductor Ejemplo',
        numero: 'V12345678',
        vence: '2031-01-01',
        nacimiento: '1974-03-10',
        confianzaNacimiento: 95,
        confianza: 95,
      }),
      entrada: 1300,
      salida: 150,
    });
    usarModeloVerificacion(f);
    const m = mundo(
      { GEMINI_API_KEY: 'llave-de-mentira-para-pruebas-000000' },
      { host: 'staging.tumbite.com' },
    );
    const c = await m.cuenta('repartidor', 'Conductor Ejemplo');
    await m.DB.prepare('UPDATE usuarios SET fecha_nacimiento = NULL WHERE id = ?').bind(c.id).run();
    await m.llamar('POST', '/datos/conductor/verificacion/permiso-ia', { acepto: true }, c.token);
    const r = await m.crudo('/datos/kyc/foto/doc_frente', {
      method: 'POST',
      headers: { authorization: `Bearer ${c.token}`, 'content-type': 'image/jpeg' },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]),
    });
    expect(r.status).toBe(201);
    const u = await m.DB.prepare('SELECT fecha_nacimiento FROM usuarios WHERE id = ?')
      .bind(c.id)
      .first<{ fecha_nacimiento: string }>();
    expect(u?.fecha_nacimiento).toBe('1974-03-10');
    const dd = await m.DB.prepare('SELECT numero, estado FROM datos_documento WHERE usuario_id = ?')
      .bind(c.id)
      .first();
    expect(dd).toEqual({ numero: 'V12345678', estado: 'propuesta' });
  });
});
