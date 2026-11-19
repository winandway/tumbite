#!/usr/bin/env node
// C-REGALO-VIAJE-REAL: el regalo de un viaje solo se acredita si el viaje fue real, de PUNTA A PUNTA
// en el SITIO DE PRUEBAS, por la API, como lo hacen las apps.
//   1. Viaje con regalo terminado sin moverse: se termina, el pasajero paga solo su parte, pero el
//      regalo queda en revisión (nada a ganancias). El equipo lo aprueba una sola vez y recién
//      entonces entra a ganancias.
//   2. Viaje con regalo hecho de verdad (el servidor suma el recorrido con las ubicaciones del
//      conductor y el teléfono del pasajero va con él): se acredita sin revisión.
// Usa el pasajero y el conductor temporales del guion de Moto («zz-mt-…») y dos cupones propios
// («ZZR…»), y al final borra todo. Nunca escribe en producción: se niega a correr si la dirección no
// es la del sitio de pruebas.
// Uso: URL_PRUEBAS=https://staging.tumbite.com RELOJ_SECRETO=… node scripts/staging/probar-regalo-viaje-real.mjs
import { createHash, randomBytes } from 'node:crypto';

const URL_PRUEBAS = (process.env.URL_PRUEBAS ?? '').replace(/\/$/, '');
if (!/^https:\/\/staging\./.test(URL_PRUEBAS)) {
  console.error('PARADA: esto solo corre contra el sitio de pruebas (staging).');
  process.exit(1);
}
const SECRETO = process.env.RELOJ_SECRETO ?? '';
if (!SECRETO) {
  console.error('Falta RELOJ_SECRETO.');
  process.exit(1);
}

async function pedir(metodo, ruta, cuerpo, cabeceras = {}) {
  const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-idioma': 'es', ...cabeceras },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  return { estado: r.status, d };
}
const exigir = (cond, texto) => {
  if (!cond) throw new Error(texto);
};
const interno = (ruta, cuerpo) => pedir('POST', ruta, cuerpo, { 'x-reloj-secreto': SECRETO });
async function sql(consulta) {
  const r = await interno('/datos/interno/diagnostico/sql', { sql: consulta });
  exigir(r.estado === 200, `sql: ${r.estado} ${r.d.error ?? ''} · ${consulta.slice(0, 80)}`);
  return r.d.results ?? [];
}

const armado = await interno('/datos/interno/diagnostico/moto/armar', {});
exigir(armado.estado === 200, `armar: ${armado.estado} ${armado.d.error ?? ''}`);
const { tokens, punto, sufijo, ids } = armado.d;
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const CUPONES = [`ZZR${sufijo}A`.toUpperCase(), `ZZR${sufijo}B`.toUpperCase()];
const enLista = CUPONES.map((c) => `'${c}'`).join(', ');
const tokenEquipo = randomBytes(24).toString('hex');
const comoCliente = {
  authorization: `Bearer ${tokens.cliente}`,
  'x-aparato': `zz-aparato-${sufijo}`,
};
const comoConductor = { authorization: `Bearer ${tokens.conductor}` };
const comoEquipo = { authorization: `Bearer ${tokenEquipo}` };
const casos = [];
let n = 0;
const paso = (id, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${id}/${nombre}`, cuerpo, {
    ...comoConductor,
    'idempotency-key': `rvr-${nombre}-${++n}-${sufijo}`,
  });
const regalosEnGanancias = async () =>
  Number(
    (
      await sql(
        `SELECT COUNT(*) AS n FROM movimientos WHERE usuario_id = '${ids.conductor}' AND concepto = 'regalo'`,
      )
    )[0]?.n ?? 0,
  );

/** Pide un viaje con el cupón dado y lo lleva hasta «en curso». */
async function hastaEnCurso(cupon) {
  const g = await pedir('POST', '/datos/regalos-divoox/guardar', { codigo: cupon }, comoCliente);
  exigir(g.estado === 201, `agregar el código: ${g.estado} ${g.d.error ?? ''}`);
  const cot = await pedir(
    'POST',
    '/datos/viajes/cotizar',
    { servicio: 'moto', origen: { ...punto, direccion: 'Punto de recogida' }, destino: DESTINO },
    comoCliente,
  );
  exigir(cot.estado === 201, `cotizar: ${cot.estado} ${cot.d.error ?? ''}`);
  const c = cot.d.cotizacion;
  exigir(c.regalo?.codigo === cupon, `la cotización no trae el regalo ${cupon}`);
  const v = await pedir(
    'POST',
    '/datos/viajes',
    { cotizacionId: c.id, metodoPago: 'efectivo', regalo: cupon },
    { ...comoCliente, 'idempotency-key': `rvr-pedir-${cupon}` },
  );
  exigir(v.estado === 201, `pedir: ${v.estado} ${v.d.error ?? ''}`);
  const id = v.d.viaje.id;
  exigir((await paso(id, 'aceptar')).estado === 200, 'aceptar');
  exigir((await paso(id, 'llegue')).estado === 200, 'llegué');
  const pin = (await pedir('GET', '/datos/viajes/actual', undefined, comoCliente)).d.viaje?.pin;
  exigir(/^\d{4}$/.test(pin ?? ''), 'el viaje con regalo no muestra su código de inicio');
  exigir((await paso(id, 'iniciar')).estado !== 200, 'un viaje con regalo empezó sin código');
  exigir((await paso(id, 'iniciar', { pin })).estado === 200, 'iniciar con el código');
  return { id, total: c.total, regalo: c.regalo.monto };
}

try {
  // El pasajero necesita su celular (llave del antifraude), el equipo su sesión y los dos cupones.
  const huella = createHash('sha256').update(tokenEquipo).digest('hex');
  const tel = `+1305555${String(1000 + (Date.now() % 9000))}`;
  await sql(
    `UPDATE usuarios SET telefono = '${tel}', telefono_canonico = '${tel.replace(/\D/g, '')}' WHERE id = '${ids.cliente}'`,
  );
  await sql(
    `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${huella}', '${ids.admin}', datetime('now', '+30 minutes'))`,
  );
  for (const c of CUPONES)
    await sql(
      `INSERT INTO cupones_divoox (codigo, nombre_es, nombre_en, tipo, valor, moneda, servicios, zonas, presupuesto, activo, creado_por)
       VALUES ('${c}', 'Regalo de prueba', 'Test gift', 'monto', 100, 'USD', '["moto"]', '["US-FL-MIAMI"]', 500, 1, 'zz-guion')`,
    );

  // 1. Sin moverse: el viaje se termina, el regalo queda en revisión.
  const a = await hastaEnCurso(CUPONES[0]);
  const finA = await paso(a.id, 'terminar');
  exigir(finA.estado === 200, `terminar: ${finA.estado} ${JSON.stringify(finA.d)}`);
  exigir(
    finA.d.regaloEnRevision === true,
    'HUECO: terminar sin moverse no mandó el regalo a revisión',
  );
  exigir(
    finA.d.cobrarEnMano === finA.d.totalFinal - a.regalo,
    'el pasajero no paga solo su parte con el regalo en revisión',
  );
  exigir((await regalosEnGanancias()) === 0, 'HUECO: el regalo sin recorrido entró a ganancias');
  casos.push(
    'terminar sin moverse: el viaje se cierra y el regalo queda en revisión, nada a ganancias',
  );
  const saldo = await pedir('GET', '/datos/repartidor/saldo-prepago', undefined, comoConductor);
  exigir(
    saldo.d.regalosEnRevision?.monto === a.regalo && saldo.d.regalosPorCobrar === 0,
    `el conductor no lo ve en revisión: ${JSON.stringify(saldo.d.regalosEnRevision)}`,
  );
  casos.push('el conductor lo ve como «en revisión», no como dinero por cobrar');
  const lista = await pedir('GET', '/datos/admin/regalos-divoox', undefined, comoEquipo);
  exigir(lista.estado === 200, `reporte del equipo: ${lista.estado} ${lista.d.error ?? ''}`);
  const rev = lista.d.revisiones?.find((x) => x.codigo === CUPONES[0] && x.estado === 'pendiente');
  exigir(rev?.motivos?.includes('sin_moverse'), 'la revisión no sale con su motivo en el reporte');
  const resolver = (cuerpo, quien = comoEquipo) =>
    pedir('POST', `/datos/admin/regalos-divoox/revisiones/${rev.id}`, cuerpo, quien);
  exigir(
    (await resolver({ aprobar: true }, comoConductor)).estado === 403,
    'PERMISOS: un conductor pudo aprobar su propio regalo',
  );
  exigir((await resolver({ aprobar: false })).estado === 422, 'rechazar sin motivo debe fallar');
  const ok = await resolver({ aprobar: true, nota: 'Guion: viaje confirmado' });
  exigir(
    ok.estado === 200 && ok.d.pagado === a.regalo,
    `aprobar: ${ok.estado} ${JSON.stringify(ok.d)}`,
  );
  exigir((await resolver({ aprobar: true })).estado === 409, 'DOBLE USO: se aprobó dos veces');
  exigir((await regalosEnGanancias()) === 1, 'aprobado, pero no entró una sola vez a ganancias');
  casos.push('el equipo lo aprueba una sola vez y recién entonces entra a ganancias');

  // 2. Viaje de verdad: el servidor suma el recorrido y el regalo se acredita sin revisión.
  await sql(
    `UPDATE repartidores SET lat = ${punto.lat}, lng = ${punto.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${ids.conductor}'`,
  );
  const b = await hastaEnCurso(CUPONES[1]);
  for (const parte of [0.25, 0.5, 0.75, 1]) {
    // Cada lectura llega tres minutos después de la anterior (no es un salto imposible).
    await sql(
      `UPDATE ubicaciones_recientes SET creado_en = datetime(creado_en, '-180 seconds') WHERE usuario_id = '${ids.conductor}'`,
    );
    await sql(
      `UPDATE repartidores SET ubicacion_en = datetime(ubicacion_en, '-180 seconds') WHERE usuario_id = '${ids.conductor}'`,
    );
    const u = await pedir(
      'POST',
      '/datos/repartidor/ubicacion',
      {
        lat: punto.lat + (DESTINO.lat - punto.lat) * parte,
        lng: punto.lng + (DESTINO.lng - punto.lng) * parte,
        precision: 10,
      },
      comoConductor,
    );
    exigir(u.estado === 200, `ubicación del conductor: ${u.estado} ${u.d.error ?? ''}`);
  }
  const mio = await pedir(
    'POST',
    `/datos/viajes/${b.id}/mi-ubicacion`,
    { lat: DESTINO.lat, lng: DESTINO.lng, precision: 15 },
    comoCliente,
  );
  exigir(mio.estado === 200, `ubicación del pasajero: ${mio.estado}`);
  await sql(
    `UPDATE viajes SET iniciado_en = datetime('now', '-25 minutes') WHERE operacion_id = '${b.id}'`,
  );
  const medido = (
    await sql(
      `SELECT distancia_m_real AS m, pasajero_cerca AS cerca, pasajero_lejos AS lejos FROM viajes WHERE operacion_id = '${b.id}'`,
    )
  )[0];
  exigir(Number(medido?.m) > 5_000, `el servidor no sumó el recorrido: ${JSON.stringify(medido)}`);
  exigir(
    Number(medido?.cerca) === 1 && Number(medido?.lejos) === 0,
    `la lectura del pasajero no quedó «cerca»: ${JSON.stringify(medido)}`,
  );
  casos.push(`el servidor midió ${medido.m} m de recorrido y al pasajero junto al conductor`);
  const finB = await paso(b.id, 'terminar');
  exigir(finB.estado === 200, `terminar el viaje real: ${finB.estado} ${JSON.stringify(finB.d)}`);
  exigir(
    finB.d.regaloEnRevision === false && finB.d.regaloDivoox === b.regalo,
    `el viaje real quedó en revisión: ${JSON.stringify(finB.d)}`,
  );
  exigir((await regalosEnGanancias()) === 2, 'el regalo del viaje real no entró a ganancias');
  casos.push('un viaje hecho de verdad acredita el regalo al terminar, sin revisión');
  const salud = await pedir('GET', '/datos/salud');
  exigir(salud.d.piezas?.regalos === 'ok', `salud de regalos: ${salud.d.piezas?.regalos}`);
  casos.push('la salud de los regalos sigue en verde');
} finally {
  // Todo lo del guion se borra: cupones, usos, revisiones, alertas, lo acreditado y la sesión.
  const usos = `SELECT id FROM usos_cupon_divoox WHERE codigo IN (${enLista})`;
  const limpieza = [
    `DELETE FROM alertas_regalo WHERE codigo IN (${enLista})`,
    `DELETE FROM regalos_en_revision WHERE codigo IN (${enLista})`,
    `DELETE FROM movimientos WHERE usuario_id = '${ids.conductor}'`,
    `DELETE FROM libro WHERE referencia IN (SELECT 'regalo-divoox:' || id || ':divoox' FROM usos_cupon_divoox WHERE codigo IN (${enLista}))`,
    `DELETE FROM usos_cupon_divoox WHERE id IN (${usos})`,
    `DELETE FROM cupones_divoox_guardados WHERE codigo IN (${enLista})`,
    `DELETE FROM cupones_divoox WHERE codigo IN (${enLista})`,
    `DELETE FROM auditoria_admin WHERE actor_id = '${ids.admin}'`,
  ];
  let limpio = true;
  for (const q of limpieza)
    await sql(q).catch((e) => {
      limpio = false;
      console.error(`limpieza: ${e.message}`);
    });
  const l = await interno('/datos/interno/diagnostico/moto/limpiar', { sufijo });
  casos.push(l.d.ok && limpio ? 'la limpieza no dejó nada temporal' : 'LA LIMPIEZA FALLÓ');
}
console.log(JSON.stringify({ ok: true, casos }, null, 2));
