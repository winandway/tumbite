#!/usr/bin/env node
// Divoox Carro de punta a punta (C-CARRO-GUION, 14 nov 2026) — Venezuela y EE. UU. Hermano de
// probar-moto-venezuela.mjs: pide por la API, como las apps y el panel,
//   El Vigía (VE-MER-ELVIGIA): el equipo abre Carro si hace falta → el taxista con saldo recarga en
//   el punto de venta del equipo → Carro en EFECTIVO y Carro por PAGO MÓVIL («sí me llegó»), con la
//   comisión del 10 % apartada al aceptar y descontada del saldo al terminar → una reserva para dentro
//   de dos horas (C-VIAJE-PROGRAMADO) que se cancela gratis;
//   Detroit (US-MI-DETROIT): Carro con TARJETA DE PRUEBA de Stripe (pm_card_visa, clave pública de
//   PRUEBA), el aviso firmado de Stripe lo pasa a buscar conductor, se cobra al terminar y propina.
// Cuentas FIJAS que se reutilizan (zz-car-…): el saldo y el libro no se borran nunca. Cuenta sus
// filas con la vuelta de pruebas (x-vuelta-pruebas) y respeta su presupuesto. Nunca escribe en
// producción. Sin clave pública de PRUEBA (local sin Stripe), la parte de Detroit se salta y se dice.
// Uso:
//   URL_PRUEBAS=https://staging.tumbite.com RELOJ_SECRETO=… node scripts/staging/probar-carro.mjs
//   URL_PRUEBAS=http://localhost:8791 RELOJ_SECRETO=… node scripts/staging/probar-carro.mjs (local)

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
const VUELTA = process.env.VUELTA_PRUEBAS ?? `carro-${Date.now().toString(36)}`;
const RECARGA = 500; // centavos de dólar
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
const exigir = (cond, texto) => {
  if (!cond) throw new Error(texto);
};
const ok = (r, que) => {
  exigir(r.estado >= 200 && r.estado < 300, `${que}: ${r.estado} ${r.d.error ?? ''}`);
  return r.d;
};
const interno = (ruta, cuerpo = {}) =>
  pedir('POST', `/datos/interno/diagnostico/carro/${ruta}`, cuerpo, undefined, {
    'x-reloj-secreto': SECRETO,
  });
const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

const armado = await interno('armar');
exigir(armado.estado === 200, `armar: ${armado.estado} ${armado.d.error ?? ''}`);
const { tokens, ids, clave, versionTerminos, elVigia, detroit } = armado.d;
const equipo = (m, r, c) => pedir(m, r, c, tokens.equipo);
const pasajero = (m, r, c, cab) => pedir(m, r, c, tokens.cliente, cab);
const taxistaVe = (m, r, c) => pedir(m, r, c, tokens.conductorVe);
const taxistaUs = (m, r, c) => pedir(m, r, c, tokens.conductorUs);
const paso = (token, op, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, token, {
    'idempotency-key': `car-${nombre}-${++n}-${VUELTA}`.slice(0, 80),
  });
const ORIGEN_VE = { lat: elVigia.lat, lng: elVigia.lng, direccion: 'Plaza Bolívar de El Vigía' };
const DESTINO_VE = { lat: 8.624, lng: -71.672, direccion: 'Aeropuerto de El Vigía' };
const ORIGEN_US = { lat: detroit.lat, lng: detroit.lng, direccion: 'Campus Martius' };
const DESTINO_US = { lat: 42.36, lng: -83.07, direccion: 'Midtown Detroit' };
const saldo = async () => ok(await taxistaVe('GET', '/datos/repartidor/saldo-prepago'), 'saldo');

/** Lo que haya quedado colgado de una vuelta anterior se cierra por la API (nunca a mano). */
async function cerrarColgados() {
  const v = (await pasajero('GET', '/datos/viajes/actual')).d.viaje;
  if (!v) return;
  const token = v.moneda === 'USD' && v.pais === 'US' ? tokens.conductorUs : tokens.conductorVe;
  if (v.estado === 'en_curso') await paso(token, v.id, 'terminar');
  else
    await pasajero(
      'POST',
      `/datos/viajes/${v.id}/cancelar`,
      {},
      {
        'idempotency-key': `car-cancelar-${VUELTA}`.slice(0, 80),
      },
    );
}

async function cotizar(origen, destino) {
  return ok(
    await pasajero('POST', '/datos/viajes/cotizar', { servicio: 'carro', origen, destino }),
    'cotizar Carro',
  ).cotizacion;
}

/** Acepta, llega, el pasajero da su código, empieza y termina; devuelve lo que cobró. */
async function hacerViaje(token, id, total, origen) {
  const ofertas = ok(
    await pedir('GET', '/datos/conductor/operaciones/ofertas', undefined, token),
    'ofertas',
  ).ofertas;
  exigir(
    ofertas.some((o) => o.operacionId === id),
    'la oferta no le llegó al taxista',
  );
  ok(await paso(token, id, 'aceptar'), 'aceptar');
  ok(
    await pedir('POST', '/datos/repartidor/ubicacion', { lat: origen.lat, lng: origen.lng }, token),
    'ubicación en la recogida',
  );
  ok(await paso(token, id, 'llegue'), 'llegué');
  const vista = ok(await pasajero('GET', `/datos/viajes/${id}`), 'el pasajero ve su viaje').viaje;
  if (vista.pin) ok(await paso(token, id, 'iniciar', { pin: vista.pin }), 'iniciar con el código');
  else ok(await paso(token, id, 'iniciar'), 'iniciar');
  const fin = ok(await paso(token, id, 'terminar'), 'terminar');
  exigir(fin.totalFinal === total, `se cobra ${fin.totalFinal} y la cotización era ${total}`);
  return vista;
}

try {
  await cerrarColgados();

  // ---------------------------------------------------------------- 1. El Vigía (Venezuela)
  const prueba = await pasajero('POST', '/datos/viajes/cotizar', {
    servicio: 'carro',
    origen: ORIGEN_VE,
    destino: DESTINO_VE,
  });
  if (prueba.estado !== 201) {
    const abrir = () =>
      equipo('POST', '/datos/admin/viajes/ciudades', {
        servicio: 'carro',
        zona: {
          id: elVigia.id,
          nombre: elVigia.nombre,
          lat: elVigia.lat,
          lng: elVigia.lng,
          radioKm: elVigia.radioKm,
          zonaHoraria: elVigia.zonaHoraria,
        },
        motivo: 'Carro de pruebas en El Vigía (guion de punta a punta)',
      });
    let r = await abrir();
    if (r.estado === 409 && LOCAL) {
      ok(
        await equipo('PUT', '/datos/admin/pasajeros-pais/VE/carro', {
          clave,
          abierto: true,
          solicitudMarca: 'LOCAL-0000',
          confirmo: true,
        }),
        'abrir Carro en Venezuela (solo local)',
      );
      r = await abrir();
    }
    ok(r, 'abrir Carro en El Vigía');
    casos.push('el equipo abrió Carro en El Vigía con un paso del panel');
  } else casos.push('Carro ya estaba abierto en El Vigía');
  ok(await interno('conductor', { quien: 've' }), 'taxista de El Vigía listo');
  ok(
    await taxistaVe('POST', '/datos/repartidor/terminos', { version: versionTerminos }),
    'términos',
  );

  // Recarga en el punto de venta del equipo (en dólares).
  const pais = ok(await equipo('GET', '/datos/admin/paises/VE'), 'configuración de Venezuela');
  if (!pais.config?.recargasPuntoVentaActivas)
    ok(
      await equipo('PUT', '/datos/admin/paises/VE', { recargasPuntoVentaActivas: true }),
      'encender las recargas en puntos de venta',
    );
  const puntos = ok(await equipo('GET', '/datos/admin/puntos-venta'), 'puntos de venta').puntos;
  let punto = puntos.find(
    (p) => p.usuarioId === ids.equipo && p.pais === 'VE' && p.moneda === 'USD',
  );
  if (!punto)
    punto = ok(
      await equipo('POST', '/datos/admin/puntos-venta', {
        nombre: 'Equipo Divoox Venezuela (guion de Carro)',
        pais: 'VE',
        moneda: 'USD',
        usuarioId: ids.equipo,
      }),
      'crear el punto del equipo',
    ).punto;
  if (!(Number(punto.fondo ?? 0) >= RECARGA))
    ok(
      await equipo('POST', `/datos/admin/puntos-venta/${punto.id}/fondo`, {
        monto: RECARGA * 5,
        comprobante: `carro-${VUELTA}`.slice(0, 60),
      }),
      'fondo del punto',
    );
  const previo = (await saldo()).disponible;
  const codigo = ok(
    await equipo('POST', '/datos/punto-venta/codigos', { monto: RECARGA }),
    'código de recarga',
  ).codigo;
  ok(await taxistaVe('POST', '/datos/repartidor/recargar', { codigo }), 'canjear la recarga');
  exigir((await saldo()).disponible === previo + RECARGA, 'la recarga no llegó completa');
  casos.push(`el taxista de El Vigía recargó ${RECARGA} centavos de dólar`);

  // Su pago móvil (se carga una vez y queda).
  const cuentas = ok(await taxistaVe('GET', '/datos/repartidor/cuentas-cobro'), 'cuentas').cuentas;
  if (!cuentas.some((x) => x.tipo === 'pago_movil' && x.vigente)) {
    const nueva = ok(
      await taxistaVe('POST', '/datos/repartidor/cuentas-cobro', {
        clave,
        tipo: 'pago_movil',
        banco: 'Banco de pruebas',
        titular: 'Taxista de prueba',
        identificador: '0412-0000000 · V-00000000',
      }),
      'cargar el pago móvil',
    ).cuenta;
    ok(await equipo('PATCH', `/datos/admin/cuentas-cobro/${nueva.id}`), 'confirmar el pago móvil');
  }

  for (const metodoPago of ['efectivo', 'pago_movil']) {
    const cot = await cotizar(ORIGEN_VE, DESTINO_VE);
    exigir(cot.moneda === 'USD', `El Vigía cotiza en dólares (${cot.moneda})`);
    exigir(cot.metodosPago.includes(metodoPago), `${metodoPago} no está entre los métodos`);
    const v = ok(
      await pasajero('POST', '/datos/viajes', { cotizacionId: cot.id, metodoPago }),
      `pedir Carro en ${metodoPago}`,
    ).viaje;
    const antes = await saldo();
    const comision = Math.round(cot.total / 10);
    const ofertas = ok(
      await taxistaVe('GET', '/datos/conductor/operaciones/ofertas'),
      'ofertas',
    ).ofertas;
    exigir(
      ofertas.some((o) => o.operacionId === v.id),
      'la oferta no le llegó al taxista',
    );
    ok(await paso(tokens.conductorVe, v.id, 'aceptar'), 'aceptar');
    exigir(
      (await saldo()).reservado === comision,
      `al aceptar se debían apartar ${comision} de comisión`,
    );
    ok(
      await taxistaVe('POST', '/datos/repartidor/ubicacion', {
        lat: ORIGEN_VE.lat,
        lng: ORIGEN_VE.lng,
      }),
      'ubicación',
    );
    ok(await paso(tokens.conductorVe, v.id, 'llegue'), 'llegué');
    const vista = ok(
      await pasajero('GET', `/datos/viajes/${v.id}`),
      'el pasajero ve su viaje',
    ).viaje;
    ok(
      await paso(tokens.conductorVe, v.id, 'iniciar', vista.pin ? { pin: vista.pin } : {}),
      'iniciar',
    );
    if (metodoPago === 'pago_movil') {
      exigir(vista.pagoMovil?.datos?.titular === 'Taxista de prueba', 'no se ve el pago móvil');
      const pm = ok(
        await paso(tokens.conductorVe, v.id, 'pago-movil', {
          recibido: true,
          referencia: '000000',
        }),
        'sí me llegó',
      );
      exigir(pm.estado === 'recibido', 'el pago móvil no quedó confirmado');
    }
    const fin = ok(await paso(tokens.conductorVe, v.id, 'terminar'), 'terminar');
    exigir(
      fin.totalFinal === cot.total,
      `se cobró ${fin.totalFinal} y la cotización era ${cot.total}`,
    );
    const despues = await saldo();
    exigir(
      despues.disponible === antes.disponible - comision && despues.reservado === 0,
      `la comisión no salió bien del saldo (${antes.disponible} → ${despues.disponible}, comisión ${comision})`,
    );
    casos.push(
      `Carro en ${metodoPago} de ${cot.total} centavos de dólar; la comisión de ${comision} salió del saldo`,
    );
  }

  // Una reserva para dentro de dos horas y su cancelación gratis (C-VIAJE-PROGRAMADO).
  const cotR = await cotizar(ORIGEN_VE, DESTINO_VE);
  const reserva = ok(
    await pasajero('POST', '/datos/viajes', {
      cotizacionId: cotR.id,
      metodoPago: 'efectivo',
      programadoPara: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    }),
    'reservar Carro para dentro de dos horas',
  );
  exigir(reserva.programado === true, 'la reserva no quedó programada');
  const lista = ok(await pasajero('GET', '/datos/viajes/programados'), 'mis viajes programados');
  exigir(
    lista.programados.some((p) => p.id === reserva.viaje.id && p.total === cotR.total),
    'la reserva no aparece con su precio fijo',
  );
  const cancelada = ok(
    await pasajero('POST', `/datos/viajes/programados/${reserva.viaje.id}/cancelar`, {}),
    'cancelar la reserva',
  );
  exigir(cancelada.cargo === 0, 'cancelar con dos horas de anticipo debía ser gratis');
  casos.push('reserva de Carro para dentro de dos horas con precio fijo, cancelada gratis');

  // ---------------------------------------------------------------- 2. Detroit (EE. UU.)
  ok(await interno('conductor', { quien: 'us' }), 'taxista de Detroit listo');
  ok(
    await taxistaUs('POST', '/datos/repartidor/terminos', { version: versionTerminos }),
    'términos',
  );
  const cotUs = await cotizar(ORIGEN_US, DESTINO_US);
  exigir(cotUs.moneda === 'USD', 'Detroit cotiza en dólares');
  if (!cotUs.metodosPago.includes('tarjeta')) {
    casos.push('Detroit sin tarjeta en este sitio: se salta la parte con tarjeta');
  } else {
    const pedido = ok(
      await pasajero('POST', '/datos/viajes', { cotizacionId: cotUs.id, metodoPago: 'tarjeta' }),
      'pedir Carro con tarjeta',
    );
    const id = pedido.viaje.id;
    const pago = pedido.pago ?? {};
    if (LOCAL || !String(pago.clavePublica ?? '').startsWith('pk_test_')) {
      await pasajero(
        'POST',
        `/datos/viajes/${id}/cancelar`,
        {},
        {
          'idempotency-key': `car-cancelar-us-${VUELTA}`.slice(0, 80),
        },
      );
      exigir(LOCAL, 'PARADA: la clave pública no es de PRUEBA.');
      casos.push('local sin Stripe de prueba: la parte con tarjeta se salta');
    } else {
      const pi = String(pago.clientSecret).split('_secret_')[0];
      const conf = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          key: pago.clavePublica,
          client_secret: pago.clientSecret,
          payment_method: 'pm_card_visa',
          return_url: `${URL_PRUEBAS}/ride`,
        }),
      });
      const cj = await conf.json();
      exigir(
        conf.ok && cj.status === 'requires_capture',
        `Stripe (prueba) no autorizó: ${conf.status} ${cj.error?.message ?? cj.status}`,
      );
      let estado = '';
      for (let i = 0; i < 20 && estado !== 'buscando'; i++) {
        await esperar(3000);
        estado = (await pasajero('GET', `/datos/viajes/${id}`)).d.viaje?.estado ?? '';
      }
      exigir(estado === 'buscando', `el aviso de Stripe no pasó el viaje a buscar (${estado})`);
      casos.push('la tarjeta de prueba quedó autorizada y el aviso firmado lo pasó a buscar');
      await hacerViaje(tokens.conductorUs, id, cotUs.total, ORIGEN_US);
      casos.push(`Carro en Detroit con tarjeta: se cobró ${cotUs.total} centavos al terminar`);
      const propina = await pasajero('POST', `/datos/viajes/${id}/propina`, { centavos: 200 });
      exigir(propina.estado === 200 || propina.estado === 201, `propina: ${propina.estado}`);
      casos.push('propina de 2 dólares cobrada con la tarjeta guardada');
    }
  }

  const salud = (await pedir('GET', '/datos/salud')).d;
  exigir(salud.piezas?.viajes === 'ok', `salud viajes: ${salud.piezas?.viajes}`);
  casos.push('la salud de viajes sigue en verde');
} finally {
  await cerrarColgados().catch(() => null);
  const l = await interno('limpiar');
  casos.push(l.d.ok ? 'nadie quedó conectado ni con sesión' : 'LA LIMPIEZA FALLÓ');
}
const cuenta = await pedir('POST', '/datos/interno/diagnostico/vuelta', { id: VUELTA }, undefined, {
  'x-reloj-secreto': SECRETO,
});
console.log(JSON.stringify({ ok: true, vuelta: VUELTA, filas: cuenta.d, casos }, null, 2));
