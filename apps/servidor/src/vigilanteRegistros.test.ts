import { afterEach, describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas, subirA } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';
import { usarTransporteCorreo } from './correo';
import type { Env } from './env';
import { esPrimeraDeLaMediaHora } from './reloj';
import {
  AJUSTES_REZAGADOS_DE_FABRICA,
  PLANTILLAS_DE_FABRICA,
  type AjustesRezagados,
  candidatos,
  correrRezagados,
  guardarAjustesRezagados,
  lecturaDeBarra,
} from './rezagados';

/**
 * C-VIGILANTE-REGISTROS (24 nov 2026, orden de Richard por Gerencia) — todos los países, encendido por
 * zona. El vigilante recorre cada media hora las altas de los últimos 30 días que no están activas, con
 * la MISMA barra de activación del panel y del reparto: si el paso le toca al conductor, Camila le
 * escribe (uno por paso cada vez, como mucho uno cada 24 horas y tres por paso, y se detiene al
 * completarlo); si le toca al equipo, va a la campana y nunca al conductor. A un correo sin confirmar no
 * se le escribe.
 */
type Correo = { para: string; asunto: string; texto: string };
function correos() {
  const lista: Correo[] = [];
  usarTransporteCorreo(async (_e, init) => {
    const c = JSON.parse(String(init.body)) as {
      to: { address: string }[];
      subject: string;
      text: string;
    };
    lista.push({ para: c.to[0]!.address, asunto: c.subject, texto: c.text });
    return new Response('{"success":true,"message_id":"m-ejemplo"}', { status: 200 });
  });
  return lista;
}
afterEach(() => usarTransporteCorreo(null));

const dentroDe = (horas: number) => new Date(Date.now() + horas * 3_600_000);

/** Un conductor real de una ciudad con prepago: identidad aprobada y su moto enviada, en revisión. */
async function escenario({ correoConfirmado = true }: { correoConfirmado?: boolean } = {}) {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  expect((await abrirCaracas(e)).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  const rep = await m.cuenta('repartidor', 'Marina Ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  await m.DB.prepare(
    "INSERT INTO kyc (usuario_id, estado, doc_frente, selfie, enviado_en, revisado_en) VALUES (?, 'aprobado', 'kyc/doc', 'kyc/cara', datetime('now', '-2 hours'), datetime('now'))",
  )
    .bind(rep.id)
    .run();
  // El rastro dice que ya mandó sus fotos y su vehículo: lo que falte lo dice la barra.
  for (const p of ['foto_cara', 'foto_documento', 'foto_licencia', 'enviado', 'vehiculo'])
    await m.DB.prepare('INSERT OR IGNORE INTO embudo_cuenta (usuario_id, paso) VALUES (?, ?)')
      .bind(rep.id, p)
      .run();
  await m.DB.prepare("UPDATE usuarios SET idioma = 'es', correo_confirmado_en = ? WHERE id = ?")
    .bind(correoConfirmado ? '2026-11-01 10:00:00' : null, rep.id)
    .run();
  const ajustar = (cambios: Partial<AjustesRezagados> = {}) =>
    guardarAjustesRezagados(m.DB, {
      ...AJUSTES_REZAGADOS_DE_FABRICA,
      horaDesde: 0,
      horaHasta: 24,
      zonas: { [CCS.id]: 'encendido' },
      ...cambios,
    });
  const moto = async () => {
    const v = await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Motos Divoox',
      modelo: 'M150',
      anio: 2023,
      color: 'Negro',
      placa: `AB${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
      placaEstado: 'FL',
    });
    const id = v.datos.id as string;
    await subirA(e, `/datos/conductor/vehiculos/${id}/documentos?tipo=registro`, rep.token);
    return id;
  };
  const aprobarMoto = async (id: string) => {
    const cola = await equipo('GET', '/datos/admin/vehiculos?estado=en_revision');
    const fila = cola.datos.vehiculos.find((x: { id: string }) => x.id === id);
    for (const d of fila.documentos)
      await equipo('PUT', `/datos/admin/vehiculos/${id}/documentos/${d.id}`, {
        estado: 'aprobado',
        venceEn: '2030-01-01',
      });
    expect(
      (await equipo('PUT', `/datos/admin/vehiculos/${id}`, { estado: 'aprobado' })).estado,
    ).toBe(200);
  };
  const filas = async () =>
    (
      await m.DB.prepare(
        'SELECT paso, canal, numero, estado FROM rezagados_mensajes WHERE usuario_id = ? ORDER BY creado_en, rowid',
      )
        .bind(rep.id)
        .all<{ paso: string; canal: string; numero: number; estado: string }>()
    ).results;
  const env = { DB: m.DB, ...m.extra, YAD_TOKEN: 'token-de-prueba' } as unknown as Env;
  return { m, rep, equipo, ajustar, moto, aprobarMoto, filas, env };
}

describe('C-VIGILANTE-REGISTROS: qué dice la barra', () => {
  const s = (clave: string, quien: string, estado = 'pendiente') =>
    ({ clave, quien, estado }) as Parameters<typeof lecturaDeBarra>[0]['siguiente'];
  it('lo del conductor se le recuerda; lo del equipo nunca va al conductor', () => {
    expect(lecturaDeBarra({ listo: false, siguiente: s('vehiculo', 'conductor') })).toEqual({
      paso: 'vehiculo',
      equipo: null,
    });
    expect(lecturaDeBarra({ listo: false, siguiente: s('saldo', 'conductor') }).paso).toBe('saldo');
    expect(
      lecturaDeBarra({ listo: false, siguiente: s('identidad', 'conductor', 'problema') }).paso,
    ).toBe('repetir');
    expect(lecturaDeBarra({ listo: false, siguiente: s('vehiculo_aprobado', 'equipo') })).toEqual({
      paso: null,
      equipo: 'vehiculo_aprobado',
    });
    // Listo para recibir carreras, o lo que hace el sistema solo: nada que decir.
    expect(lecturaDeBarra({ listo: true, siguiente: s('conectado', 'conductor') })).toEqual({
      paso: null,
      equipo: null,
    });
    expect(lecturaDeBarra({ listo: false, siguiente: s('vehiculo_activo', 'sistema') }).paso).toBe(
      null,
    );
  });

  it('los textos nuevos dicen «conductor», van en los dos idiomas, sin montos ni ciudades', () => {
    for (const paso of ['repetir', 'saldo'] as const) {
      const p = PLANTILLAS_DE_FABRICA[paso];
      expect(p.es.texto).toContain('conductor');
      expect(p.en.texto).toContain('driver');
      for (const t of [p.es, p.en]) {
        expect(`${t.asunto} ${t.texto} ${t.sms}`).not.toMatch(/\$|USD|Bs\.?\s|\d+[.,]\d{2}/);
        expect(`${t.texto} ${t.sms}`).not.toMatch(/Caracas|Miami|Tucan|Vig[ií]a|Novi/);
        expect(t.sms.length).toBeLessThanOrEqual(160);
        expect(t.sms.startsWith('Divoox:')).toBe(true);
      }
    }
  });

  it('el reloj lo corre en la primera vuelta de cada media hora', () => {
    expect(esPrimeraDeLaMediaHora('2026-11-24T10:00', undefined)).toBe(true);
    expect(esPrimeraDeLaMediaHora('2026-11-24T10:05', '2026-11-24T10:00')).toBe(false);
    expect(esPrimeraDeLaMediaHora('2026-11-24T10:30', '2026-11-24T10:25')).toBe(true);
    expect(esPrimeraDeLaMediaHora('2026-11-24T11:00', '2026-11-24T10:55')).toBe(true);
  });
});

describe('C-VIGILANTE-REGISTROS: la vuelta', () => {
  it('un conductor parado recibe UNO, no dos, y al completar el paso no recibe más', async () => {
    const s = await escenario();
    const enviados = correos();
    await s.ajustar();
    // Sin vehículo registrado (el rastro creía que sí): la barra dice que le falta, y le toca a él.
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    await correrRezagados(s.env, s.m.DB, dentroDe(4.5));
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.asunto).toBe('Falta registrar tu vehículo en Divoox');
    expect((await s.filas()).filter((f) => f.canal === 'correo')).toHaveLength(1);
    // Registra su moto: ese paso ya no es suyo (ahora espera al equipo) y no le llega nada más.
    await s.moto();
    await correrRezagados(s.env, s.m.DB, dentroDe(80));
    expect(enviados).toHaveLength(1);
  });

  it('como mucho uno cada 24 horas y tres por paso; después se detiene', async () => {
    const s = await escenario();
    const enviados = correos();
    await s.ajustar({ plazosHoras: [1, 2, 3] });
    const horas = [4, 10, 20, 30, 40, 60, 70, 100, 200, 400];
    const cuenta: number[] = [];
    for (const h of horas) {
      await correrRezagados(s.env, s.m.DB, dentroDe(h));
      // Lo que salió en esta vuelta queda con la hora simulada (lo de antes ya está en el futuro).
      await s.m.DB.prepare(
        "UPDATE rezagados_mensajes SET creado_en = ? WHERE usuario_id = ? AND creado_en <= datetime('now')",
      )
        .bind(dentroDe(h).toISOString().slice(0, 19).replace('T', ' '), s.rep.id)
        .run();
      cuenta.push(enviados.length);
    }
    // Uno a las 4 h; a las 10 y 20 no (menos de 24 h); el 2.º a las 30; a las 40 no; el 3.º a las 60;
    // y después nada más por ese paso.
    expect(cuenta).toEqual([1, 1, 1, 2, 2, 3, 3, 3, 3, 3]);
    const delPaso = (await s.filas()).filter((f) => f.canal === 'correo');
    expect(delPaso.map((f) => f.numero)).toEqual([1, 2, 3]);
    const c = await candidatos(
      s.env,
      s.m.DB,
      AJUSTES_REZAGADOS_DE_FABRICA,
      [CCS.id],
      dentroDe(500),
    );
    expect(c.find((x) => x.id === s.rep.id)?.motivo).toBe('tope_paso');
  });

  it('lo que le toca al equipo no se le manda al conductor: va a la campana una vez y se resuelve', async () => {
    const s = await escenario();
    const enviados = correos();
    await s.ajustar();
    const id = await s.moto();
    await correrRezagados(s.env, s.m.DB, dentroDe(80));
    await correrRezagados(s.env, s.m.DB, dentroDe(81));
    expect(enviados).toHaveLength(0);
    const f = await s.filas();
    expect(f).toEqual([
      { paso: 'vehiculo_aprobado', canal: 'equipo', numero: 1, estado: 'enviado' },
    ]);
    const campana = await s.equipo('GET', '/datos/panel/avisos');
    expect(
      (campana.datos.campana.avisos as { tipo: string; id: string; resuelto?: boolean }[]).some(
        (a) => a.tipo === 'registro' && a.id === s.rep.id && !a.resuelto,
      ),
    ).toBe(true);
    // El panel lo muestra con lo que le toca al equipo, sin recordatorio para el conductor.
    const lista = await s.equipo('GET', '/datos/admin/camila/recordatorios');
    const fila = (lista.datos.lista as { id: string; equipo: string; toca: number | null }[]).find(
      (x) => x.id === s.rep.id,
    );
    expect(fila).toMatchObject({ equipo: 'vehiculo_aprobado', toca: null });
    // El equipo aprueba la moto: el aviso queda resuelto (una escritura) y no se repite.
    await s.aprobarMoto(id);
    await correrRezagados(s.env, s.m.DB, dentroDe(82));
    expect((await s.filas()).find((x) => x.canal === 'equipo')?.estado).toBe('resuelto');
  });

  it('un aviso del equipo solo se cierra si su cuenta se miró en esta vuelta; los de otras cuentas no tapan ni se cierran', async () => {
    const s = await escenario();
    correos();
    await s.ajustar();
    const id = await s.moto();
    await correrRezagados(s.env, s.m.DB, dentroDe(80));
    expect((await s.filas()).find((x) => x.canal === 'equipo')?.estado).toBe('enviado');
    // 30 avisos abiertos, más viejos, de cuentas que esta vuelta no mira (fuera de la ventana, otra
    // ciudad o sin barra leída): nunca se cierran por no haberse mirado.
    await s.m.DB.batch(
      Array.from({ length: 30 }, (_, i) =>
        s.m.DB.prepare(
          "INSERT INTO rezagados_mensajes (id, usuario_id, paso, canal, origen, estado, creado_en) VALUES (?, ?, 'identidad', 'equipo', 'auto', 'enviado', datetime('now', '-2 days'))",
        ).bind(`ajeno-${i}`, `cuenta-sin-mirar-${i}`),
      ),
    );
    // Le piden repetir una foto: esta vuelta no lee su barra, así que su aviso sigue abierto.
    await s.m.DB.prepare(
      "INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, estado) VALUES ('vf-repetir', ?, 'cara', 'kyc/cara', 'repetir')",
    )
      .bind(s.rep.id)
      .run();
    await s.aprobarMoto(id);
    await correrRezagados(s.env, s.m.DB, dentroDe(81));
    expect((await s.filas()).find((x) => x.canal === 'equipo')?.estado).toBe('enviado');
    // Su barra se vuelve a leer y ya no lo frena el equipo: se cierra el suyo, aunque haya 30 más viejos.
    await s.m.DB.prepare(
      "UPDATE verificacion_fotos SET estado = 'vigente' WHERE id = 'vf-repetir'",
    ).run();
    await correrRezagados(s.env, s.m.DB, dentroDe(82));
    expect((await s.filas()).find((x) => x.canal === 'equipo')?.estado).toBe('resuelto');
    const ajenos = await s.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM rezagados_mensajes WHERE usuario_id LIKE 'cuenta-sin-mirar-%' AND estado = 'enviado'",
    ).first<{ n: number }>();
    expect(Number(ajenos?.n)).toBe(30);
  });

  it('a un correo sin confirmar no se le escribe: solo el aviso en su app', async () => {
    const s = await escenario({ correoConfirmado: false });
    const enviados = correos();
    await s.ajustar();
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(enviados).toHaveLength(0);
    expect((await s.filas()).map((f) => f.canal)).toEqual(['aviso']);
  });

  it('una foto o un papel pedido de nuevo: se le pide repetirlo', async () => {
    const s = await escenario();
    const enviados = correos();
    await s.ajustar();
    await s.m.DB.prepare(
      "DELETE FROM embudo_cuenta WHERE usuario_id = ? AND paso IN ('enviado', 'vehiculo')",
    )
      .bind(s.rep.id)
      .run();
    await s.m.DB.prepare(
      "INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, estado, motivo) VALUES ('vf-ejemplo', ?, 'cara', 'kyc/cara', 'repetir', 'oscura')",
    )
      .bind(s.rep.id)
      .run();
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.asunto).toBe('Te pedimos repetir una foto de tu registro');
  });

  it('aprobado sin saldo donde rige el prepago: se le recuerda recargar, sin montos', async () => {
    const s = await escenario();
    const enviados = correos();
    await s.ajustar();
    await s.aprobarMoto(await s.moto());
    await s.m.DB.prepare(
      "INSERT OR IGNORE INTO embudo_cuenta (usuario_id, paso) VALUES (?, 'aprobado')",
    )
      .bind(s.rep.id)
      .run();
    await correrRezagados(s.env, s.m.DB, dentroDe(30));
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.asunto).toBe('Recarga tu saldo para recibir viajes');
    expect(enviados[0]!.texto).not.toMatch(/\d+[.,]\d{2}|USD|\$/);
  });

  it('le cuesta entrar: tres fallos de contraseña y sin entrar después → UNO para crear una contraseña nueva; al entrar bien, nada más', async () => {
    const s = await escenario();
    const enviados = correos();
    await s.ajustar({ plazosHoras: [1, 2, 3] });
    const { correo } = (await s.m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(s.rep.id)
      .first<{ correo: string }>())!;
    const fallar = (n: number) =>
      s.m.DB.batch(
        Array.from({ length: n }, () =>
          s.m.DB.prepare(
            "INSERT INTO intentos_acceso (accion, correo, codigo) VALUES ('entrar', ?, 'clave_incorrecta')",
          ).bind(correo.toLowerCase()),
        ),
      );
    // Dos fallos no bastan.
    await fallar(2);
    const ajustes = {
      ...AJUSTES_REZAGADOS_DE_FABRICA,
      plazosHoras: [1, 2, 3] as [number, number, number],
    };
    const antes = await candidatos(s.env, s.m.DB, ajustes, [CCS.id], dentroDe(4));
    expect(antes.find((x) => x.id === s.rep.id)?.paso).not.toBe('clave');
    // Uno más: le llega UNO (no dos en la vuelta siguiente), con el enlace de la contraseña nueva.
    await fallar(1);
    await correrRezagados(s.env, s.m.DB, dentroDe(4.5));
    await correrRezagados(s.env, s.m.DB, dentroDe(5));
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.asunto).toBe('¿Te cuesta entrar a tu cuenta de Divoox?');
    expect(enviados[0]!.texto).toContain('/forgot-password');
    expect(
      (await s.filas()).filter((f) => f.paso === 'clave' && f.canal === 'correo'),
    ).toHaveLength(1);
    // Entra bien: ese paso se cumplió y no le llega nada más por él.
    await s.m.DB.prepare(
      "INSERT INTO rastro_cuenta (usuario_id, tipo, creado_en) VALUES (?, 'entrada', datetime('now', '+1 minute'))",
    )
      .bind(s.rep.id)
      .run();
    await correrRezagados(s.env, s.m.DB, dentroDe(40));
    expect((await s.filas()).filter((f) => f.paso === 'clave')).toHaveLength(2);
    expect(enviados.filter((e) => e.asunto.includes('entrar'))).toHaveLength(1);
  });

  it('los fallos de un correo sin cuenta no le llegan a nadie', async () => {
    const s = await escenario();
    const enviados = correos();
    await s.ajustar();
    await s.m.DB.batch(
      Array.from({ length: 5 }, () =>
        s.m.DB.prepare(
          "INSERT INTO intentos_acceso (accion, correo, codigo) VALUES ('entrar', 'nadie@ejemplo.com', 'correo_sin_cuenta')",
        ),
      ),
    );
    const c = await candidatos(s.env, s.m.DB, AJUSTES_REZAGADOS_DE_FABRICA, [CCS.id], dentroDe(10));
    expect(c.some((x) => x.paso === 'clave')).toBe(false);
    await correrRezagados(s.env, s.m.DB, dentroDe(10));
    expect(enviados.some((e) => e.para === 'nadie@ejemplo.com')).toBe(false);
  });

  it('mirar no escribe: la lista del panel y la vuelta apagada no dejan filas', async () => {
    const s = await escenario();
    correos();
    await s.ajustar({ zonas: { [CCS.id]: 'previa' } });
    await s.moto();
    await s.equipo('GET', '/datos/admin/camila/recordatorios');
    await correrRezagados(s.env, s.m.DB, dentroDe(80));
    expect(await s.filas()).toEqual([]);
  });
});
