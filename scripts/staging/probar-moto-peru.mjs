#!/usr/bin/env node
// Divoox en Ica, Perú (C-PERFIL-PERU, C-PAGO-A-CELULAR, C-RECARGA-TARJETA-ALOJADA; 19 nov 2026).
// Hermano de probar-moto-venezuela.mjs: hace por la API, como las apps y el panel, todo el camino
// del mototaxi en Ica, en soles:
//   el equipo abre Ica (Moto y Carro, si no están abiertas) y enciende las recargas del país → el
//   conductor elige Ica, registra su mototaxi y sube sus papeles y su identidad → el equipo lo
//   aprueba → recarga con TARJETA en soles (Stripe en modo prueba: cobro directo confirmado con la
//   tarjeta de prueba, y además la página de pago alojada) → el líder vende un código en su punto de
//   venta en soles y el conductor lo canjea → el conductor carga su Yape y el equipo lo confirma →
//   viaje en EFECTIVO con la comisión del 8 % del saldo (un conductor SIN saldo no recibe la oferta)
//   → viaje con YAPE y «sí me llegó» → viaje con PLIN a un conductor con Yape y «no me llegó», que
//   abre un caso en soles para soporte.
// Cuentas FIJAS que se reutilizan (zz-mtpe-…): el saldo y el libro no se borran nunca. La comisión
// de Perú se aprueba SOLO en la base de pruebas (lo hace «armar»); en producción la aprueba Richard.
// Nunca escribe en producción ni cobra dinero real.
// Uso:
//   URL_PRUEBAS=https://staging.tumbite.com RELOJ_SECRETO=… node scripts/staging/probar-moto-peru.mjs
//   URL_PRUEBAS=http://localhost:8791 RELOJ_SECRETO=… node scripts/staging/probar-moto-peru.mjs (local)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const URL_PRUEBAS = (process.env.URL_PRUEBAS ?? '').replace(/\/$/, '');
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(URL_PRUEBAS);
if (
  !/^https:\/\/(staging\.tumbite\.com|tumbite-pruebas\.sitios\.dev)$/.test(URL_PRUEBAS) &&
  !LOCAL
) {
  console.error(
    'PARADA: esto solo corre contra el sitio de pruebas (staging) o un servidor local.',
  );
  process.exit(1);
}
const SECRETO = process.env.RELOJ_SECRETO ?? '';
if (!SECRETO) {
  console.error('Falta RELOJ_SECRETO.');
  process.exit(1);
}
const VUELTA = process.env.VUELTA_PRUEBAS ?? `moto-pe-${Date.now().toString(36)}`;
const FOTO = readFileSync(
  join(import.meta.dirname, '..', '..', 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'),
);
// Los mismos datos de CIUDAD_ICA (packages/compartido/src/perfilPeru.ts).
const CIUDAD = {
  id: 'PE-ICA-ICA',
  nombre: 'Ica',
  lat: -14.0648,
  lng: -75.7296,
  radioKm: 12,
  zonaHoraria: 'America/Lima',
};
const ORIGEN = { lat: -14.0648, lng: -75.7296, direccion: 'Plaza de Armas de Ica' };
const DESTINO = { lat: -14.0875, lng: -75.7633, direccion: 'Laguna de Huacachina' };
const RECARGA_TARJETA = 3000; // céntimos de sol: 30 soles, el mínimo con tarjeta
const RECARGA_CODIGO = 500; // 5 soles en el punto de venta del líder
const COMISION_PB = 800; // 8 %
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const casos = [];
let n = 0;
async function pedir(metodo, ruta, cuerpo, token, cabeceras = {}) {
  const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      'x-vuelta-pruebas': VUELTA,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...cabeceras,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 429 && String(d.error ?? '').startsWith('presupuesto'))
    throw new Error(`PRESUPUESTO: ${d.error}`);
  return { estado: r.status, d };
}
async function subir(ruta, token) {
  const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'image/jpeg',
      'x-vuelta-pruebas': VUELTA,
    },
    body: FOTO,
  });
  return { estado: r.status, d: await r.json().catch(() => ({})) };
}
const exigir = (cond, texto) => {
  if (!cond) throw new Error(texto);
};
const ok = (r, que) => {
  exigir(r.estado >= 200 && r.estado < 300, `${que}: ${r.estado} ${r.d.error ?? ''}`);
  return r.d;
};
const interno = (ruta, cuerpo = {}) =>
  pedir('POST', `/datos/interno/diagnostico/moto-pe/${ruta}`, cuerpo, undefined, {
    'x-reloj-secreto': SECRETO,
  });

const armado = await interno('armar');
exigir(armado.estado === 200, `armar: ${armado.estado} ${armado.d.error ?? ''}`);
const { tokens, ids, clave, versionTerminos } = armado.d;
const equipo = (m, r, c) => pedir(m, r, c, tokens.equipo);
const pasajero = (m, r, c) => pedir(m, r, c, tokens.cliente);
const yo = (m, r, c) => pedir(m, r, c, tokens.conductor);
const sinSaldo = (m, r, c) => pedir(m, r, c, tokens.sinSaldo);
const paso = (op, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, tokens.conductor, {
    'idempotency-key': `mtpe-${nombre}-${++n}-${VUELTA}`.slice(0, 80),
  });
const saldo = async () => ok(await yo('GET', '/datos/repartidor/saldo-prepago'), 'saldo');

/** Lo que haya quedado colgado de una vuelta anterior se cierra por la API (nunca a mano). */
async function cerrarColgados() {
  const actual = await pasajero('GET', '/datos/viajes/actual');
  const v = actual.d.viaje;
  if (!v) return;
  if (v.estado === 'en_curso') await paso(v.id, 'terminar');
  else
    await pedir('POST', `/datos/viajes/${v.id}/cancelar`, {}, tokens.cliente, {
      'idempotency-key': `mtpe-cancelar-${VUELTA}`.slice(0, 80),
    });
}

async function cotizarYPedir(metodoPago) {
  const cot = ok(
    await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN,
      destino: DESTINO,
    }),
    `cotizar en ${CIUDAD.nombre}`,
  ).cotizacion;
  exigir(cot.moneda === 'PEN', `la cotización debería ir en soles (${cot.moneda})`);
  exigir(
    cot.metodosPago.join(',') === 'efectivo,yape,plin',
    `Ica debería ofrecer efectivo, Yape y Plin (${cot.metodosPago})`,
  );
  exigir(cot.total % 10 === 0, `el precio debería redondear a 10 céntimos (${cot.total})`);
  const v = ok(
    await pasajero('POST', '/datos/viajes', { cotizacionId: cot.id, metodoPago }),
    `pedir en ${metodoPago}`,
  ).viaje;
  return { id: v.id, total: cot.total };
}

async function hacerViaje(v) {
  const antes = await saldo();
  const ofertas = ok(await yo('GET', '/datos/conductor/operaciones/ofertas'), 'ofertas').ofertas;
  exigir(
    ofertas.some((o) => o.operacionId === v.id),
    'la oferta no le llegó al conductor con saldo',
  );
  ok(await paso(v.id, 'aceptar'), 'aceptar');
  const comision = Math.round((v.total * COMISION_PB) / 10_000);
  const reservado = (await saldo()).reservado;
  exigir(reservado === comision, `al aceptar se apartan ${reservado} y debían ser ${comision}`);
  ok(
    await yo('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng }),
    'ubicación',
  );
  ok(await paso(v.id, 'llegue'), 'llegué');
  const vista = ok(await pasajero('GET', `/datos/viajes/${v.id}`), 'el pasajero ve su viaje').viaje;
  exigir(/^\d{4}$/.test(vista.pin ?? ''), 'el pasajero no ve su código');
  ok(await paso(v.id, 'iniciar', { pin: vista.pin }), 'iniciar con el código');
  return { antes, comision, vista };
}

async function terminarYComprobar(v, antes, comision) {
  const fin = ok(await paso(v.id, 'terminar'), 'terminar');
  exigir(fin.totalFinal === v.total, `se cobra ${fin.totalFinal} y la cotización era ${v.total}`);
  const despues = await saldo();
  exigir(
    despues.disponible === antes.disponible - comision && despues.reservado === 0,
    `la comisión no salió bien del saldo: antes ${antes.disponible}, después ${despues.disponible}, comisión ${comision}`,
  );
  return despues;
}

/** Abre un servicio en Ica con el paso del panel, solo si todavía no cotiza ahí. */
async function abrirSiHaceFalta(servicio) {
  const prueba = await pasajero('POST', '/datos/viajes/cotizar', {
    servicio,
    origen: ORIGEN,
    destino: DESTINO,
  });
  if (prueba.estado === 201) {
    exigir(prueba.d.cotizacion.moneda === 'PEN', `${servicio} en Ica no cotiza en soles`);
    return false;
  }
  const abrir = () =>
    equipo('POST', '/datos/admin/viajes/ciudades', {
      servicio,
      zona: CIUDAD,
      motivo: 'Ica en el sitio de pruebas (guion de punta a punta de Perú)',
    });
  let r = await abrir();
  // En local los servicios de pasajeros están cerrados como en producción: se abre la compuerta
  // del país (base local).
  if (r.estado === 409 && LOCAL) {
    ok(
      await equipo('PUT', `/datos/admin/pasajeros-pais/PE/${servicio}`, {
        clave,
        abierto: true,
        solicitudMarca: 'LOCAL-0000',
        confirmo: true,
      }),
      `abrir ${servicio} en Perú (solo local)`,
    );
    r = await abrir();
  }
  ok(r, `abrir ${servicio} en ${CIUDAD.nombre}`);
  return true;
}

try {
  await cerrarColgados();
  exigir((await interno('reiniciar')).estado === 200, 'reiniciar el alta del conductor');

  // 1. El equipo abre Ica (Moto y Carro) y enciende las recargas de Perú.
  const abiertos = [];
  for (const servicio of ['moto', 'carro'])
    if (await abrirSiHaceFalta(servicio)) abiertos.push(servicio);
  casos.push(
    abiertos.length
      ? `el equipo abrió ${abiertos.join(' y ')} en Ica con un paso del panel`
      : 'Ica ya estaba abierta para Moto y Carro',
  );
  const carro = ok(
    await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'carro',
      origen: ORIGEN,
      destino: DESTINO,
    }),
    'cotizar Carro en Ica',
  ).cotizacion;
  exigir(carro.moneda === 'PEN', 'Carro en Ica debería cotizar en soles');
  casos.push(`Carro en Ica cotiza ${carro.total} céntimos de sol de la plaza a Huacachina`);
  const pais = ok(
    await equipo('PUT', '/datos/admin/paises/PE', {
      recargasStripeActivas: true,
      recargaStripeMin: RECARGA_TARJETA,
      recargasPuntoVentaActivas: true,
      // El guion recarga tres veces por vuelta con las mismas cuentas: tope de pruebas, no de la calle.
      recargasSemanaMax: 200,
    }),
    'encender las recargas de Perú',
  ).config;
  exigir(pais.moneda === 'PEN', `Perú debería estar en soles (${pais.moneda})`);

  // 2. El conductor se registra con la app.
  ok(await yo('PUT', '/datos/conductor/ciudad', { zonaId: CIUDAD.id }), `elegir ${CIUDAD.nombre}`);
  const papeles = ok(await yo('GET', '/datos/conductor/papeles'), 'qué papeles pide');
  exigir(papeles.ciudad.pais === 'PE', 'la ciudad del conductor no es de Perú');
  exigir(
    papeles.perfil.documentos.join(',') === 'licencia_moto,antecedentes_penales',
    `Perú debería pedir licencia y antecedentes (${papeles.perfil.documentos})`,
  );
  const moto = ok(
    await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Bajaj',
      modelo: 'RE',
      anio: 2023,
      color: 'Rojo',
      placa: `ZZ${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`,
    }),
    'registrar el mototaxi',
  ).id;
  for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente'])
    ok(
      await subir(`/datos/conductor/vehiculos/${moto}/documentos?tipo=${t}`, tokens.conductor),
      `subir ${t}`,
    );
  ok(
    await yo('POST', `/datos/conductor/vehiculos/${moto}/enviar`),
    'enviar el mototaxi a revisión',
  );
  const docs = [];
  for (const t of ['licencia_moto', 'antecedentes_penales'])
    docs.push(
      ok(await subir(`/datos/conductor/papeles?tipo=${t}&vence=2030-01-01`, tokens.conductor), t)
        .id,
    );
  for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
    ok(await subir(`/datos/kyc/foto/${p}`, tokens.conductor), `identidad: ${p}`);
  ok(await yo('POST', '/datos/kyc/enviar', { docTipo: 'identificacion' }), 'enviar la identidad');
  casos.push('el conductor eligió Ica, registró su mototaxi y subió sus papeles y su identidad');

  // 3. El equipo lo aprueba desde el panel.
  const cola = ok(await equipo('GET', '/datos/admin/papeles-conductor'), 'cola de papeles');
  exigir(
    docs.every((id) => cola.documentos.some((d) => d.id === id && d.pais === 'PE')),
    'los papeles no aparecen en la cola del equipo como de Perú',
  );
  for (const id of docs)
    ok(
      await equipo('PUT', `/datos/admin/papeles-conductor/${id}`, { estado: 'aprobado' }),
      'aprobar papel',
    );
  ok(
    await equipo('PATCH', `/datos/admin/kyc/${ids.conductor}`, { estado: 'aprobado' }),
    'aprobar identidad',
  );
  ok(
    await equipo('PUT', `/datos/admin/cumplimientos/${ids.conductor}/edad_minima_21`, {
      estado: 'aprobado',
    }),
    'aprobar edad',
  );
  const veh = ok(
    await equipo('GET', '/datos/admin/vehiculos?estado=en_revision'),
    'vehículos por revisar',
  );
  const fila = veh.vehiculos.find((x) => x.id === moto);
  exigir(fila, 'el mototaxi no aparece por revisar');
  for (const d of fila.documentos)
    ok(
      await equipo('PUT', `/datos/admin/vehiculos/${moto}/documentos/${d.id}`, {
        estado: 'aprobado',
        venceEn: '2030-01-01',
      }),
      'aprobar papel del mototaxi',
    );
  ok(
    await equipo('PUT', `/datos/admin/vehiculos/${moto}`, { estado: 'aprobado' }),
    'aprobar el mototaxi',
  );
  ok(
    await equipo('PUT', `/datos/admin/cumplimientos/${ids.conductor}/casco_pasajero`, {
      estado: 'aprobado',
      vehiculoId: moto,
    }),
    'aprobar el casco',
  );
  ok(
    await equipo('PUT', `/datos/admin/habilitaciones/${ids.conductor}/moto`, {
      estado: 'aprobada',
    }),
    'habilitar Moto',
  );
  await yo('POST', '/datos/repartidor/conectar', { conectado: false });
  ok(await yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: moto }), 'usar el mototaxi');
  const servicios = ok(await yo('GET', '/datos/conductor/servicios'), 'servicios del conductor');
  const sMoto = servicios.servicios.find((s) => s.servicioId === 'moto');
  exigir(sMoto?.puedeActivar, `Moto no quedó lista: falta ${sMoto?.requisitosFaltantes}`);
  casos.push('el equipo aprobó papeles, identidad, edad, mototaxi y casco: quedó habilitado');

  // 4. Recarga con tarjeta en soles (Stripe en modo prueba).
  const s0 = await saldo();
  exigir(s0.moneda === 'PEN', `el saldo debería estar en soles (${s0.moneda})`);
  exigir(
    (await yo('POST', '/datos/repartidor/recargas/stripe', { monto: RECARGA_TARJETA - 100 }))
      .estado === 409,
    'una recarga con tarjeta por debajo del mínimo debería rechazarse',
  );
  const directa = await yo('POST', '/datos/repartidor/recargas/stripe', { monto: RECARGA_TARJETA });
  if (LOCAL) {
    // En local Stripe es simulado: se comprueba que el servidor abre el cobro y nada más.
    exigir(
      directa.estado === 201 || directa.estado === 409,
      `pedir la recarga con tarjeta (local): ${directa.estado} ${directa.d.error ?? ''}`,
    );
    casos.push('local con Stripe simulado: el cobro con tarjeta no se confirma aquí');
  } else {
    const pago = ok(directa, 'pedir la recarga con tarjeta');
    exigir(
      String(pago.clavePublica ?? '').startsWith('pk_test_'),
      'PARADA: la clave pública de Stripe no es de PRUEBA.',
    );
    const pi = String(pago.clientSecret).split('_secret_')[0];
    const conf = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: pago.clavePublica,
        client_secret: pago.clientSecret,
        payment_method: 'pm_card_visa',
        return_url: `${URL_PRUEBAS}/top-up/done`,
      }),
    });
    const cj = await conf.json();
    exigir(
      conf.ok &&
        cj.status === 'succeeded' &&
        cj.currency === 'pen' &&
        cj.amount === RECARGA_TARJETA,
      `Stripe (prueba) no cobró los 30 soles: ${conf.status} ${cj.error?.message ?? `${cj.status} ${cj.amount} ${cj.currency}`}`,
    );
    let ahora = s0.disponible;
    for (let i = 0; i < 20 && ahora !== s0.disponible + RECARGA_TARJETA; i++) {
      await esperar(3000);
      ahora = (await saldo()).disponible;
    }
    exigir(
      ahora === s0.disponible + RECARGA_TARJETA,
      `el aviso de Stripe no acreditó la recarga (saldo ${ahora}, antes ${s0.disponible})`,
    );
    casos.push(
      'recarga con tarjeta de prueba: Stripe cobró 30 soles (PEN) y el aviso firmado los acreditó en el saldo',
    );
    // La página de pago alojada, que es la que abre la app de conductores.
    const alojada = ok(
      await yo('POST', '/datos/repartidor/recargas/stripe', {
        monto: RECARGA_TARJETA,
        alojada: true,
      }),
      'pedir la página de pago alojada',
    );
    exigir(
      String(alojada.url ?? '').startsWith('https://checkout.stripe.com/'),
      `la página de pago no es de Stripe (${alojada.url})`,
    );
    const pagina = await fetch(alojada.url, { redirect: 'manual' });
    exigir(pagina.status < 400, `la página de pago de Stripe responde ${pagina.status}`);
    exigir((await saldo()).disponible === ahora, 'pedir la página de pago no debe acreditar nada');
    casos.push('la página de pago alojada de Stripe abre y, sin pagar, no acredita nada');
  }

  // 5. El líder de la ciudad vende saldo en soles en su punto de venta.
  const puntos = ok(await equipo('GET', '/datos/admin/puntos-venta'), 'puntos de venta').puntos;
  let punto = puntos.find(
    (p) => p.usuarioId === ids.equipo && p.pais === 'PE' && p.moneda === 'PEN',
  );
  if (!punto)
    punto = ok(
      await equipo('POST', '/datos/admin/puntos-venta', {
        nombre: 'Equipo Divoox Ica (pruebas)',
        pais: 'PE',
        moneda: 'PEN',
        usuarioId: ids.equipo,
      }),
      'crear el punto de venta de Ica',
    ).punto;
  if (!(Number(punto.fondo ?? 0) >= RECARGA_CODIGO))
    ok(
      await equipo('POST', `/datos/admin/puntos-venta/${punto.id}/fondo`, {
        monto: RECARGA_CODIGO * 10,
        comprobante: `pruebas-${VUELTA}`.slice(0, 60),
      }),
      'fondo del punto',
    );
  const previo = (await saldo()).disponible;
  const codigo = ok(
    await equipo('POST', '/datos/punto-venta/codigos', { monto: RECARGA_CODIGO }),
    'código',
  ).codigo;
  ok(await yo('POST', '/datos/repartidor/recargar', { codigo }), 'canjear la recarga');
  const recargado = await saldo();
  exigir(recargado.moneda === 'PEN', `el saldo debería estar en soles (${recargado.moneda})`);
  exigir(
    recargado.disponible === previo + RECARGA_CODIGO,
    'la recarga del punto de venta no llegó completa al saldo',
  );
  exigir(
    recargado.carrerasAlcanzan === Math.floor(recargado.disponible / recargado.comisionTipica),
    '«te alcanza para N carreras» no cuadra',
  );
  casos.push(
    `el punto de venta vendió 5 soles y el conductor los canjeó; le alcanza para unas ${recargado.carrerasAlcanzan} carreras`,
  );

  // 6. Su Yape (se carga una vez y queda) y se conecta en la recogida.
  exigir(
    (recargado.cuentasACelular ?? []).join(',') === 'yape,plin',
    `la app del conductor debería ofrecer Yape y Plin (${recargado.cuentasACelular})`,
  );
  const cuentas = ok(
    await yo('GET', '/datos/repartidor/cuentas-cobro'),
    'cuentas de cobro',
  ).cuentas;
  if (!cuentas.some((x) => x.tipo === 'yape' && x.vigente)) {
    const mala = await yo('POST', '/datos/repartidor/cuentas-cobro', {
      clave,
      tipo: 'yape',
      titular: 'Titular de ejemplo',
      identificador: '0412-0000000',
    });
    exigir(mala.estado === 422, 'un celular que no es de Perú no debería servir para Yape');
    const nueva = ok(
      await yo('POST', '/datos/repartidor/cuentas-cobro', {
        clave,
        tipo: 'yape',
        titular: 'Titular de ejemplo',
        identificador: '900 000 000',
      }),
      'cargar el Yape',
    ).cuenta;
    ok(await equipo('PATCH', `/datos/admin/cuentas-cobro/${nueva.id}`), 'confirmar el Yape');
    casos.push('el conductor cargó su Yape con un celular de Perú y el equipo lo confirmó');
  } else casos.push('el Yape del conductor ya estaba cargado y confirmado');
  ok(await yo('POST', '/datos/repartidor/terminos', { version: versionTerminos }), 'términos');
  ok(
    await yo('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true }),
    'recibir Moto',
  );
  ok(await yo('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN }), 'conectarse');
  ok(
    await yo('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng }),
    'ubicación',
  );
  exigir(
    (await interno('sin-saldo', { zonaId: CIUDAD.id })).estado === 200,
    'preparar el conductor sin saldo',
  );

  // 7. Viaje en efectivo: el conductor sin saldo no recibe la oferta.
  const v1 = await cotizarYPedir('efectivo');
  const otro = ok(await sinSaldo('GET', '/datos/repartidor/saldo-prepago'), 'saldo del otro');
  exigir(
    otro.sinSaldo === true && otro.carrerasAlcanzan === 0,
    'el conductor sin saldo debería verse sin saldo',
  );
  const delOtro = ok(
    await sinSaldo('GET', '/datos/conductor/operaciones/ofertas'),
    'ofertas del otro',
  );
  exigir(
    !delOtro.ofertas.some((o) => o.operacionId === v1.id),
    'al conductor SIN saldo le llegó la oferta',
  );
  casos.push('el conductor sin saldo no recibió la oferta y su app le dice que recargue');
  const e1 = await hacerViaje(v1);
  await terminarYComprobar(v1, e1.antes, e1.comision);
  casos.push(
    `viaje en efectivo de ${v1.total} céntimos de sol terminado; la comisión del 8 % (${e1.comision}) salió del saldo`,
  );

  // 8. Viaje con Yape: el pasajero ve el número del conductor y él confirma «sí me llegó».
  const v2 = await cotizarYPedir('yape');
  const e2 = await hacerViaje(v2);
  exigir(
    e2.vista.metodoPago === 'yape' && e2.vista.pagoMovil?.datos?.tipo === 'yape',
    'el pasajero no ve el Yape del conductor',
  );
  exigir(
    e2.vista.pagoMovil.datos.identificador === '900 000 000',
    'el pasajero no ve el número de Yape del conductor',
  );
  const llego = ok(
    await paso(v2.id, 'pago-movil', { recibido: true, referencia: '000000' }),
    'sí me llegó',
  );
  exigir(llego.estado === 'recibido', 'el Yape no quedó confirmado');
  await terminarYComprobar(v2, e2.antes, e2.comision);
  const fin2 = ok(await pasajero('GET', `/datos/viajes/${v2.id}`), 'el viaje con Yape').viaje;
  exigir(fin2.pagoMovil?.confirmado === 'recibido', 'el pasajero no ve el pago confirmado');
  casos.push(
    `viaje con Yape de ${v2.total} céntimos de sol: «sí me llegó» y la comisión de ${e2.comision} salió del saldo`,
  );

  // 9. Viaje con Plin a un conductor con Yape (se reciben entre sí) y «no me llegó»: caso de soporte.
  const v3 = await cotizarYPedir('plin');
  const e3 = await hacerViaje(v3);
  exigir(
    e3.vista.metodoPago === 'plin' && e3.vista.pagoMovil?.datos?.tipo === 'yape',
    'el pasajero que paga con Plin debería ver que el número del conductor es de Yape',
  );
  const noLlego = ok(await paso(v3.id, 'pago-movil', { recibido: false }), 'no me llegó');
  exigir(noLlego.estado === 'no_recibido', 'el «no me llegó» no quedó anotado');
  ok(await paso(v3.id, 'terminar'), 'terminar el viaje con Plin');
  const bandeja = ok(
    await equipo('GET', '/datos/admin/bandeja-dinero?tipo=pago_movil_viaje'),
    'bandeja de soporte del dinero',
  );
  exigir(
    JSON.stringify(bandeja).includes(v3.id),
    'el «no me llegó» no abrió un caso en la bandeja de soporte',
  );
  casos.push(
    `viaje con Plin de ${v3.total} céntimos a un conductor con Yape: «no me llegó» abrió un caso para soporte`,
  );

  const salud = ok(await pedir('GET', '/datos/salud'), 'salud');
  exigir(salud.piezas?.servicios === 'ok', `salud servicios: ${salud.piezas?.servicios}`);
  exigir(salud.piezas?.viajes === 'ok', `salud viajes: ${salud.piezas?.viajes}`);
  casos.push('la salud de servicios y viajes sigue en verde');
} finally {
  await cerrarColgados().catch(() => null);
  const l = await interno('limpiar');
  casos.push(l.d.ok ? 'nadie quedó conectado ni con sesión' : 'LA LIMPIEZA FALLÓ');
}
const cuenta = await pedir('POST', '/datos/interno/diagnostico/vuelta', { id: VUELTA }, undefined, {
  'x-reloj-secreto': SECRETO,
});
console.log(JSON.stringify({ ok: true, vuelta: VUELTA, filas: cuenta.d, casos }, null, 2));
