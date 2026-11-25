import { afterEach, describe, expect, it } from 'vitest';
import {
  CIUDAD_PRUEBAS_VENEZUELA as CCS,
  faltaParaAprobarSinEnviar,
  nacimientoDeLecturas,
  nacimientoSeGuardaSolo,
} from '@tumbite/compartido';
import { abrirCaracas, subirA } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';
import {
  type LlamadaIa,
  MODELO_VERIFICACION,
  asegurarModeloVerificacion,
  comprobarFoto,
  usarModeloVerificacion,
} from './verificacionIa';

/**
 * Encargo de Richard en la ficha de un conductor de Verificaciones (25 nov 2026) — todos los países.
 * C-FICHA-VEHICULO-SIN-ENVIAR: el vehículo registrado y sin enviar se aprueba desde la ficha SOLO con sus
 * fotos y su placa completas (nunca sin ellas), con quién y cuándo en la auditoría.
 * C-NACIMIENTO-DEL-DOCUMENTO: la fecha de nacimiento leída en el documento (la misma lectura) queda
 * guardada al aprobar la identidad si la confianza está en verde, y la edad se aprueba sola si cuadra.
 * C-FICHA-HABILITACION-VERDAD: la ficha recibe la habilitación que guardó el equipo y lo ya aprobado.
 */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  expect((await abrirCaracas(e)).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  const rep = await m.cuenta('repartidor', 'Conductor Ficha');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  const v = await yo('POST', '/datos/conductor/vehiculos', {
    tipo: 'moto',
    marca: 'Motos Ejemplo',
    modelo: 'M150',
    anio: 2023,
    color: 'Negro',
    placa: 'AB123CD',
    placaEstado: 'FL',
  });
  return { m, e, admin, rep, equipo, yo, vehiculo: v.datos.id as string };
}

describe('C-FICHA-VEHICULO-SIN-ENVIAR: aprobar un vehículo sin enviar', () => {
  it('la pieza pide placa y las fotos de frente y de la placa (el carro, también el interior)', () => {
    expect(faltaParaAprobarSinEnviar({ tipo: 'moto', placa: '', placa_estado: '' }, [])).toEqual([
      'placa',
      'placa_estado',
      'foto_frente',
      'foto_placa',
      'registro',
      'seguro',
    ]);
    expect(
      faltaParaAprobarSinEnviar(
        { tipo: 'moto', placa: 'AB1', placa_estado: 'FL' },
        [
          { tipo: 'foto_frente', estado: 'pendiente' },
          { tipo: 'foto_placa', estado: 'rechazado' },
          { tipo: 'registro', estado: 'pendiente' },
        ],
        ['registro'],
      ),
    ).toEqual(['foto_placa']);
    expect(
      faltaParaAprobarSinEnviar({ tipo: 'carro', placa: 'AB1', placa_estado: 'FL' }, [
        { tipo: 'foto_frente', estado: 'pendiente' },
        { tipo: 'foto_placa', estado: 'aprobado' },
        { tipo: 'registro', estado: 'aprobado' },
        { tipo: 'seguro', estado: 'aprobado' },
      ]),
    ).toEqual(['foto_interior']);
  });

  it('sin fotos no se aprueba; con fotos y placa sí, sale en la ficha y queda en la auditoría', async () => {
    const s = await escenario();
    // Sin fotos: la lista lo dice y la ruta de siempre se niega.
    const antes = await s.equipo(
      'GET',
      `/datos/admin/vehiculos?estado=registrado&conductor=${s.rep.id}`,
    );
    const fila = antes.datos.vehiculos.find((v: { id: string }) => v.id === s.vehiculo);
    expect(fila.faltaParaAprobar).toEqual(
      expect.arrayContaining(['foto_frente', 'foto_placa', 'registro']),
    );
    const sinFotos = await s.equipo('PUT', `/datos/admin/vehiculos/${s.vehiculo}`, {
      estado: 'aprobado',
    });
    expect(sinFotos.estado).toBe(422);
    expect(sinFotos.datos.faltaParaAprobar).toEqual(expect.arrayContaining(['foto_frente']));
    // Sube las dos fotos (sin el registro: sigue «registrado», no se envía solo, y todavía no se
    // aprueba: la base exige el registro de todo vehículo motorizado).
    for (const tipo of ['foto_frente', 'foto_placa'])
      await subirA(
        s.e,
        `/datos/conductor/vehiculos/${s.vehiculo}/documentos?tipo=${tipo}`,
        s.rep.token,
      );
    const conFotos = await s.equipo(
      'GET',
      `/datos/admin/vehiculos?estado=registrado&conductor=${s.rep.id}`,
    );
    const f2 = conFotos.datos.vehiculos.find((v: { id: string }) => v.id === s.vehiculo);
    expect(f2.faltaParaAprobar).not.toContain('foto_frente');
    expect(f2.faltaParaAprobar).toContain('registro');
    expect(
      (await s.equipo('PUT', `/datos/admin/vehiculos/${s.vehiculo}`, { estado: 'aprobado' }))
        .estado,
    ).toBe(422);
    // Un sin enviar que ya tenía sus papeles (subidos antes de que el envío fuera solo).
    for (const tipo of ['registro', 'seguro'])
      await s.m.DB.prepare(
        "INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave) VALUES (?, ?, ?, 'veh/doc')",
      )
        .bind(`doc-${tipo}-${s.vehiculo}`, s.vehiculo, tipo)
        .run();
    const ahora = await s.equipo(
      'GET',
      `/datos/admin/vehiculos?estado=registrado&conductor=${s.rep.id}`,
    );
    const lista = ahora.datos.vehiculos.find((v: { id: string }) => v.id === s.vehiculo);
    expect(lista.faltaParaAprobar).toEqual([]);
    // Como el botón del panel: lo mirado queda aprobado y después el vehículo.
    for (const d of lista.documentos)
      await s.equipo('PUT', `/datos/admin/vehiculos/${s.vehiculo}/documentos/${d.id}`, {
        estado: 'aprobado',
        venceEn: '2030-01-01',
      });
    const ok = await s.equipo('PUT', `/datos/admin/vehiculos/${s.vehiculo}`, {
      estado: 'aprobado',
    });
    expect(ok.estado).toBe(200);
    const fila2 = await s.m.DB.prepare('SELECT estado, aprobado_por FROM vehiculos WHERE id = ?')
      .bind(s.vehiculo)
      .first<{ estado: string; aprobado_por: string }>();
    expect(fila2).toEqual({ estado: 'aprobado', aprobado_por: s.admin.id });
    const audit = await s.m.DB.prepare(
      "SELECT actor_id, despues_json, creado_en FROM auditoria_admin WHERE accion = 'vehiculo.revision' AND objeto = ?",
    )
      .bind(`vehiculo:${s.vehiculo}`)
      .first<{ actor_id: string; despues_json: string; creado_en: string }>();
    expect(audit?.actor_id).toBe(s.admin.id);
    expect(audit?.creado_en).toBeTruthy();
    expect(JSON.parse(audit?.despues_json ?? '{}')).toMatchObject({
      estado: 'aprobado',
      sinEnviar: true,
    });
  });

  it('la ficha recibe la habilitación que guardó el equipo y lo ya aprobado', async () => {
    const s = await escenario();
    const r = await s.equipo('GET', `/datos/admin/conductores/${s.rep.id}/pasajeros`);
    expect(r.estado).toBe(200);
    const moto = r.datos.servicios.find((x: { servicioId: string }) => x.servicioId === 'moto');
    expect(moto).toBeTruthy();
    expect(moto.habilitacionGuardada ?? null).toBeNull();
    expect(Array.isArray(r.datos.cumplidos)).toBe(true);
  });
});

describe('C-NACIMIENTO-DEL-DOCUMENTO: la fecha de nacimiento sale del documento', () => {
  const hoy = new Date('2026-11-25T00:00:00Z');

  it('la pieza elige la cédula primero, con su confianza, y descarta fechas imposibles', () => {
    const p = nacimientoDeLecturas(
      [
        { paso: 'licencia_frente', lectura: { nacimiento: '1990-01-01', confianzaNacimiento: 95 } },
        { paso: 'doc_frente', lectura: { nacimiento: '1994-05-10', confianzaNacimiento: 88 } },
      ],
      hoy,
    );
    expect(p).toEqual({ fecha: '1994-05-10', confianza: 88, paso: 'doc_frente' });
    expect(nacimientoSeGuardaSolo(p)).toBe(true);
    expect(
      nacimientoDeLecturas([{ paso: 'doc_frente', lectura: { nacimiento: '2024-02-30' } }], hoy),
    ).toBeNull();
    expect(
      nacimientoSeGuardaSolo(
        nacimientoDeLecturas(
          [{ paso: 'doc_frente', lectura: { nacimiento: '1994-05-10', confianzaNacimiento: 40 } }],
          hoy,
        ),
      ),
    ).toBe(false);
    // Sin confianza propia de la fecha (aunque el documento entero se leyó con 95), nunca se guarda sola.
    expect(
      nacimientoSeGuardaSolo(
        nacimientoDeLecturas(
          [{ paso: 'doc_frente', lectura: { nacimiento: '1994-05-10', confianza: 95 } }],
          hoy,
        ),
      ),
    ).toBe(false);
  });

  async function conIdentidadPendiente(confianza: number) {
    const s = await escenario();
    const subir = (pieza: string) =>
      s.m.crudo(`/datos/kyc/foto/${pieza}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${s.rep.token}`, 'content-type': 'image/png' },
        body: PNG as BodyInit,
      });
    expect((await subir('doc_frente')).status).toBe(201);
    expect((await subir('selfie')).status).toBe(201);
    await s.yo('POST', '/datos/kyc/enviar', { docTipo: 'pasaporte' });
    await s.m.DB.prepare('UPDATE usuarios SET fecha_nacimiento = NULL WHERE id = ?')
      .bind(s.rep.id)
      .run();
    await s.m.DB.prepare(
      `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, estado, ia_color, ia_json)
       VALUES (?, ?, 'doc_frente', 'verif/doc', 'vigente', 'verde', ?)`,
    )
      .bind(
        `vf-${s.rep.id}`,
        s.rep.id,
        JSON.stringify({
          clase: 'identidad_frente',
          nombre: 'Conductor Ficha',
          numero: 'V12345678',
          nacimiento: '1994-05-10',
          confianzaNacimiento: confianza,
          confianza: 90,
        }),
      )
      .run();
    return s;
  }

  it('al aprobar la identidad, la fecha leída con confianza en verde queda guardada y la edad aprobada', async () => {
    const s = await conIdentidadPendiente(92);
    const r = await s.equipo('PATCH', `/datos/admin/kyc/${s.rep.id}`, { estado: 'aprobado' });
    expect(r.estado).toBe(200);
    expect(r.datos.nacimiento).toEqual({ fecha: true, edad: true });
    const u = await s.m.DB.prepare('SELECT fecha_nacimiento FROM usuarios WHERE id = ?')
      .bind(s.rep.id)
      .first<{ fecha_nacimiento: string }>();
    expect(u?.fecha_nacimiento).toBe('1994-05-10');
    // C-EDAD-POR-PAIS: la edad la pone al día el sistema con la fecha guardada.
    const edad = await s.m.DB.prepare(
      "SELECT estado, fuente FROM cumplimientos WHERE conductor_id = ? AND requisito = 'edad_minima_21'",
    )
      .bind(s.rep.id)
      .first<{ estado: string; fuente: string }>();
    expect(edad).toEqual({ estado: 'aprobado', fuente: 'sistema' });
    const audit = await s.m.DB.prepare(
      "SELECT actor_id FROM auditoria_admin WHERE accion = 'conductor.fecha_nacimiento' AND objeto = ?",
    )
      .bind(`usuario:${s.rep.id}`)
      .first<{ actor_id: string }>();
    expect(audit?.actor_id).toBe(s.admin.id);
    // La ficha ya la trae, y la edad figura como aprobada.
    const ficha = await s.equipo('GET', `/datos/admin/conductores/${s.rep.id}/pasajeros`);
    expect(ficha.datos.fechaNacimiento).toBe('1994-05-10');
    expect(ficha.datos.cumplidos).toContain('edad_minima_21');
  });

  it('con confianza baja no se guarda sola ni pisa una fecha ya escrita', async () => {
    const s = await conIdentidadPendiente(40);
    const r = await s.equipo('PATCH', `/datos/admin/kyc/${s.rep.id}`, { estado: 'aprobado' });
    expect(r.estado).toBe(200);
    expect(r.datos.nacimiento).toEqual({ fecha: false, edad: false });
    const u = await s.m.DB.prepare('SELECT fecha_nacimiento FROM usuarios WHERE id = ?')
      .bind(s.rep.id)
      .first<{ fecha_nacimiento: string | null }>();
    expect(u?.fecha_nacimiento ?? null).toBeNull();
  });
});

describe('C-NACIMIENTO-DEL-DOCUMENTO: va en la MISMA lectura (ninguna llamada más)', () => {
  afterEach(() => usarModeloVerificacion(null));

  it('una sola llamada al modelo aprobado, con la fecha pedida en el JSON, y la lectura la trae', async () => {
    const pedidos: { json: unknown; sistema: string }[] = [];
    const f: LlamadaIa = async (_env, p) => {
      pedidos.push({ json: p.json, sistema: p.sistema });
      return {
        texto: JSON.stringify({
          clase: 'identidad_frente',
          legible: true,
          vencido: 'no',
          nombre: 'Conductor Ficha',
          numero: 'V12345678',
          vence: '2030-01-01',
          nacimiento: '1994-05-10',
          confianzaNacimiento: 91,
          confianza: 95,
        }),
        entrada: 1300,
        salida: 150,
      };
    };
    usarModeloVerificacion(f);
    const m = mundo();
    const env = { DB: m.DB, GEMINI_API_KEY: 'llave-de-mentira-para-pruebas-000000' };
    const r = await comprobarFoto(env as never, m.DB, {
      paso: 'doc_frente',
      pais: 'VE',
      ingles: false,
      imagen: { bytes: PNG, mime: 'image/png' },
      intentos: 0,
    });
    expect(pedidos).toHaveLength(1);
    expect(JSON.stringify(pedidos[0]?.json)).toContain('nacimiento');
    expect(pedidos[0]?.sistema).toContain('nacimiento');
    expect(r.lectura?.nacimiento).toBe('1994-05-10');
    expect(r.lectura?.confianzaNacimiento).toBe(91);
    expect(() => asegurarModeloVerificacion(MODELO_VERIFICACION.id)).not.toThrow();
  });
});
