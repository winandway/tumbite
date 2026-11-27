import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS, type ListaPapelesPais } from '@tumbite/compartido';
import { abrirCaracas, escenarioVe, subirA } from './pruebas/motoVe';
import { barraActivacion } from './activacion';
import { lecturaDeBarra } from './rezagados';
import { recordarPlazos } from './plazoPapeles';
import { rehacerConductorDocumentos } from './esquemaPapeles';

/**
 * C-PAPELES-POR-PAIS, segunda parte (24 nov 2026) — Venezuela lista para encender; Estados Unidos sin
 * cambios. Apagada, el conductor ve exactamente lo de hoy. Encendida, Driver, la barra de activación,
 * el vigilante de registros y el plazo de papeles usan la lista del país. El reparto no se toca.
 */
async function escenario() {
  const e = await escenarioVe();
  expect((await abrirCaracas(e)).estado).toBe(201);
  const rep = await e.m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, ruta, cuerpo, rep.token);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, ruta, cuerpo, e.admin.token);
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  const v = await yo('POST', '/datos/conductor/vehiculos', {
    tipo: 'moto',
    marca: 'Motos Divoox',
    modelo: 'M150',
    anio: 2023,
    color: 'Negro',
    placa: `AB${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
    placaEstado: 'VE',
  });
  const vehiculo = v.datos.id as string;
  const lista = async () =>
    (await equipo('GET', '/datos/admin/paises/VE')).datos.config.papelesPais as ListaPapelesPais;
  const encender = async (cambio: (l: ListaPapelesPais) => ListaPapelesPais = (l) => l) =>
    equipo('PUT', '/datos/admin/paises/VE', {
      papelesPais: cambio({ ...(await lista()), activa: true }),
    });
  return { e, rep, yo, equipo, vehiculo, lista, encender };
}

describe('C-PAPELES-POR-PAIS: la lista de papeles por país', () => {
  it('apagada (de fábrica), Driver recibe exactamente lo de hoy y la barra no cambia', async () => {
    const s = await escenario();
    const antes = (await s.yo('GET', '/datos/conductor/papeles')).datos;
    expect(antes.perfil.documentos).toEqual(['licencia_moto']);
    expect(antes.perfil.documentosVehiculo.moto).toEqual([
      'registro',
      'seguro',
      'seguro_pasajeros',
      'foto_frente',
      'foto_placa',
    ]);
    expect(antes.perfil.nombres).toBeUndefined();
    expect(antes.perfil.papelesPais).toBeUndefined();
    // Guardar la lista apagada (con otros nombres) tampoco cambia nada para el conductor.
    const l = await s.lista();
    expect(l.activa).toBe(false);
    expect(
      (
        await s.equipo('PUT', '/datos/admin/paises/VE', {
          papelesPais: { ...l, papeles: l.papeles.map((p) => ({ ...p, es: `${p.es} (otro)` })) },
        })
      ).estado,
    ).toBe(200);
    expect((await s.yo('GET', '/datos/conductor/papeles')).datos).toEqual(antes);
    const b = await barraActivacion(s.e.m.DB, s.rep.id);
    expect(b.pasos.some((p) => p.clave === 'papeles_pais')).toBe(false);
    // El certificado médico no se acepta donde la lista no lo pide.
    expect(
      (await subirA(s.e, '/datos/conductor/papeles?tipo=certificado_medico', s.rep.token)).estado,
    ).toBe(400);
  });

  it('encendida, Driver recibe la lista de Venezuela con sus nombres y acepta el certificado médico', async () => {
    const s = await escenario();
    expect((await s.encender()).estado).toBe(200);
    const d = (await s.yo('GET', '/datos/conductor/papeles')).datos;
    expect(d.perfil.documentosPorServicio.moto).toEqual(['licencia_moto', 'certificado_medico']);
    expect(d.perfil.documentos).toEqual(['licencia_moto', 'certificado_medico']);
    expect(d.perfil.documentosVehiculo.moto).toEqual(['registro', 'seguro', 'foto_placa']);
    expect(d.perfil.nombres.moto.seguro).toEqual({
      es: 'Póliza RCV',
      en: 'RCV liability insurance policy',
    });
    expect(d.perfil.nombres.moto.foto_placa.es).toBe('Foto de la moto con la placa visible');
    expect(
      (await subirA(s.e, '/datos/conductor/papeles?tipo=certificado_medico', s.rep.token)).estado,
    ).toBe(201);
  });

  it('encendida, la póliza RCV se guarda también como póliza de pasajeros (el reparto la sigue pidiendo)', async () => {
    const s = await escenario();
    await s.encender();
    await subirA(
      s.e,
      `/datos/conductor/vehiculos/${s.vehiculo}/documentos?tipo=seguro`,
      s.rep.token,
    );
    const { results } = await s.e.m.DB.prepare(
      "SELECT tipo, clave FROM vehiculo_documentos WHERE vehiculo_id = ? AND estado = 'pendiente' ORDER BY tipo",
    )
      .bind(s.vehiculo)
      .all<{ tipo: string; clave: string }>();
    expect(results.map((r) => r.tipo)).toEqual(['seguro', 'seguro_pasajeros']);
    expect(results[0]?.clave).toBe(results[1]?.clave);
  });

  it('«frena» lo pone el servidor, y no se enciende una lista que deja fuera lo que el reparto exige', async () => {
    const s = await escenario();
    const torcida = await s.encender((l) => ({
      ...l,
      papeles: l.papeles.map((p) => ({ ...p, frena: !p.frena })),
    }));
    expect(torcida.estado).toBe(200);
    const guardada = torcida.datos.config.papelesPais as ListaPapelesPais;
    expect(guardada.papeles.find((p) => p.tipo === 'certificado_medico')?.frena).toBe(false);
    expect(guardada.papeles.find((p) => p.tipo === 'registro')?.frena).toBe(true);
    const sinPoliza = await s.encender((l) => ({
      ...l,
      papeles: l.papeles.filter((p) => p.tipo !== 'seguro'),
    }));
    expect(sinPoliza.estado).toBe(409);
    expect(sinPoliza.datos.campo).toBe('papelesPais');
  });

  it('encendida, la barra suma «papeles del país» sin frenar, y el vigilante se lo recuerda', async () => {
    const s = await escenario();
    const antes = await barraActivacion(s.e.m.DB, s.rep.id);
    await s.encender();
    const b = await barraActivacion(s.e.m.DB, s.rep.id);
    const paso = b.pasos.find((p) => p.clave === 'papeles_pais');
    expect(paso).toMatchObject({ estado: 'pendiente', quien: 'conductor', opcional: true });
    expect(paso?.papelesPais?.map((p) => p.tipo).sort()).toEqual([
      'certificado_medico',
      'foto_placa',
    ]);
    // El reparto no se tocó: lo mismo listo, lo mismo lo que lo frena.
    expect(b.listo).toBe(antes.listo);
    expect(b.siguiente?.clave).toBe(antes.siguiente?.clave);
    // C-VEHICULO-SIN-ENVIAR: su moto sigue sin enviar a revisión: eso se le recuerda primero; con la
    // moto ya enviada, lo que queda son los papeles de su país.
    expect(lecturaDeBarra({ ...b, listo: true, siguiente: null }).paso).toBe('vehiculo_enviar');
    const conMotoEnviada = b.pasos.filter((p) => p.falta !== 'vehiculo_sin_enviar');
    expect(lecturaDeBarra({ ...b, listo: true, siguiente: null, pasos: conMotoEnviada }).paso).toBe(
      'papeles',
    );
    // Subidos los dos, ya no le toca a él: los revisa el equipo en Verificaciones.
    await subirA(s.e, '/datos/conductor/papeles?tipo=certificado_medico', s.rep.token);
    await subirA(
      s.e,
      `/datos/conductor/vehiculos/${s.vehiculo}/documentos?tipo=foto_placa`,
      s.rep.token,
    );
    const b2 = await barraActivacion(s.e.m.DB, s.rep.id);
    expect(b2.pasos.find((p) => p.clave === 'papeles_pais')).toMatchObject({ quien: 'equipo' });
    const pasos2 = b2.pasos.filter((p) => p.falta !== 'vehiculo_sin_enviar');
    expect(lecturaDeBarra({ ...b2, listo: true, siguiente: null, pasos: pasos2 }).paso).toBe(null);
  });

  it('el plazo con papeles «solo se piden» por subir: se recuerda y al vencer se cierra sin pausar', async () => {
    const s = await escenario();
    await s.e.m.DB.prepare(
      `INSERT INTO plazo_papeles (conductor_id, pais, vence_en, origen) VALUES (?, 'VE', datetime('now', '+5 days'), 'equipo')
       ON CONFLICT(conductor_id) DO UPDATE SET estado = 'en_plazo', vence_en = excluded.vence_en, ultimo_aviso = NULL`,
    )
      .bind(s.rep.id)
      .run();
    const env = { DB: s.e.m.DB } as never;
    expect((await recordarPlazos(env, s.e.m.DB, async () => 'faltan_pedidos')).avisados).toBe(1);
    await s.e.m.DB.prepare(
      "UPDATE plazo_papeles SET vence_en = datetime('now', '-1 hour') WHERE conductor_id = ?",
    )
      .bind(s.rep.id)
      .run();
    const v = await recordarPlazos(env, s.e.m.DB, async () => 'faltan_pedidos');
    expect(v).toMatchObject({ vencidos: 0, completos: 1 });
    const f = await s.e.m.DB.prepare('SELECT estado FROM plazo_papeles WHERE conductor_id = ?')
      .bind(s.rep.id)
      .first<{ estado: string }>();
    expect(f?.estado).toBe('completo');
  });

  it('la tabla de papeles que todavía no acepta el certificado médico se rehace sin perder filas', async () => {
    const s = await escenario();
    const db = s.e.m.DB;
    await db.prepare('DROP TABLE conductor_documentos').run();
    await db
      .prepare(
        `CREATE TABLE conductor_documentos (id TEXT PRIMARY KEY, conductor_id TEXT NOT NULL REFERENCES usuarios(id),
        tipo TEXT NOT NULL CHECK (tipo IN ('licencia_moto', 'antecedentes_penales', 'licencia_conducir')), clave TEXT NOT NULL, vence_en TEXT,
        estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'reemplazado')),
        motivo TEXT NOT NULL DEFAULT '', revisado_por TEXT REFERENCES usuarios(id), revisado_en TEXT,
        creado_en TEXT NOT NULL DEFAULT (datetime('now')))`,
      )
      .run();
    await db
      .prepare(
        "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave, estado) VALUES ('d1', ?, 'licencia_conducir', 'k', 'aprobado')",
      )
      .bind(s.rep.id)
      .run();
    expect(await rehacerConductorDocumentos(db)).toBe(true);
    expect(await rehacerConductorDocumentos(db)).toBe(false);
    expect(
      await db.prepare("SELECT tipo FROM conductor_documentos WHERE id = 'd1'").first(),
    ).toEqual({ tipo: 'licencia_conducir' });
    await db
      .prepare(
        "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave) VALUES ('d2', ?, 'certificado_medico', 'k2')",
      )
      .bind(s.rep.id)
      .run();
  });
});
