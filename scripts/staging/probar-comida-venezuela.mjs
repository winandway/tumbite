#!/usr/bin/env node
// Comida · Venezuela (C-COMIDA-VE-PUNTA-A-PUNTA, 13 nov 2026). Hermano de probar-moto-venezuela.mjs:
// hace por la API, como las apps y el panel, el pedido de comida en El Vigía (estado Mérida) con el
// PAGO DIRECTO AL RESTAURANTE (C-COMIDA-PAGO-RESTAURANTE, 22 nov 2026) y el modelo de «quién paga
// qué» (C-COMIDA-VE-QUIEN-PAGA, 23 nov 2026: el cliente paga la comida al restaurante y el envío al
// conductor, sin tarifa de servicio ni cargo por pedido pequeño; Divoox cobra su comisión al
// RESTAURANTE de su saldo prepago; al conductor no le descuenta nada del envío):
//   el equipo abre Comida en El Vigía y deja la palanca «¿Quién paga qué en la comida?» en el modelo →
//   el restaurante venezolano se registra con su ubicación, el equipo lo aprueba y él carga su menú →
//   un conductor SIN saldo recibe y toma la oferta → el cliente ve la cuenta del restaurante y el
//   monto en bolívares, escribe la referencia, el restaurante dice «Me llegó», listo, recoge SIN pagar
//   en el local, entrega, «cobré» solo el envío; con el restaurante al 0 % no sale comisión de nadie →
//   el equipo sube la comisión del restaurante al 10 % (con la nota de la revisión legal) y le carga
//   saldo de regalo → pedido con el envío por PAGO MÓVIL al conductor con «sí me llegó»: el 10 % de la
//   comida sale UNA vez del saldo del restaurante y CERO del conductor → la comisión vuelve a 0 % →
//   un pedido cancelado no le aparta ni le cobra nada al conductor. Al terminar (siempre), la comisión
//   del restaurante queda otra vez en 0 %.
// Cuentas FIJAS que se reutilizan (zz-cmve-…): el saldo, los pedidos y el libro no se borran nunca.
// Cuenta sus filas con la vuelta de pruebas (x-vuelta-pruebas) y respeta su presupuesto. Nunca
// escribe en producción.
// Uso:
//   URL_PRUEBAS=https://staging.tumbite.com RELOJ_SECRETO=… node scripts/staging/probar-comida-venezuela.mjs
//   URL_PRUEBAS=http://localhost:8791 RELOJ_SECRETO=… node scripts/staging/probar-comida-venezuela.mjs (local)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pedirConReintento } from './pedirConReintento.mjs';

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
const VUELTA = process.env.VUELTA_PRUEBAS ?? `comida-ve-${Date.now().toString(36)}`;
const FOTO = readFileSync(
  join(import.meta.dirname, '..', '..', 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'),
);
const CIUDAD = {
  id: 'VE-MER-ELVIGIA',
  nombre: 'El Vigía',
  lat: 8.6219,
  lng: -71.6506,
  radioKm: 15,
  zonaHoraria: 'America/Caracas',
  moneda: 'USD',
};
const LOCAL_REST = { lat: 8.6225, lng: -71.651 };
const CASA = { lat: 8.6229, lng: -71.6512 }; // a unos 50 m: sin saltos de GPS imposibles

const casos = [];
async function pedir(metodo, ruta, cuerpo, token, cabeceras = {}) {
  const r = await pedirConReintento(`${URL_PRUEBAS}${ruta}`, {
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
async function foto(ruta, token, donde) {
  const r = await pedirConReintento(`${URL_PRUEBAS}${ruta}?lat=${donde.lat}&lng=${donde.lng}`, {
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
const interno = (ruta) =>
  pedir('POST', `/datos/interno/pruebas/comida-ve/${ruta}`, {}, undefined, {
    'x-reloj-secreto': SECRETO,
  });

const armado = await interno('armar');
exigir(armado.estado === 200, `armar: ${armado.estado} ${armado.d.error ?? ''}`);
const { tokens, clave, versionTerminos } = armado.d;
const equipo = (m, r, c) => pedir(m, r, c, tokens.equipo);
const cliente = (m, r, c) => pedir(m, r, c, tokens.cliente);
const resto = (m, r, c) => pedir(m, r, c, tokens.restaurante);
const yo = (m, r, c) => pedir(m, r, c, tokens.repartidor);
const pobre = (m, r, c) => pedir(m, r, c, tokens.sinSaldo);
const saldo = async (quien = yo) =>
  ok(await quien('GET', '/datos/repartidor/saldo-prepago'), 'saldo');

/** Lo que haya quedado abierto de una vuelta anterior se cierra por la API (nunca a mano). */
async function cerrarColgados() {
  const { d } = await cliente('GET', '/datos/mis-pedidos');
  const mios = (d.pedidos ?? []).filter((p) => !['entregado', 'cancelado'].includes(p.estado));
  for (const p of mios)
    await equipo('POST', `/datos/admin/pedidos/${p.id}/cancelar`, {
      motivo: 'Cierre de una vuelta de pruebas anterior',
    });
}

/** Para dejar la comisión del restaurante otra vez en 0 % al terminar, pase lo que pase. */
let palancaTocada = false;
const comisionRestaurante = (comisionPb, revisionLegalNota) =>
  equipo('PUT', '/datos/admin/finanzas/comida-quien-paga', {
    pais: 'VE',
    motivo: `Comisión del restaurante al ${comisionPb / 100} % (guion de pruebas)`,
    restaurante: { comisionPb, ...(revisionLegalNota ? { revisionLegalNota } : {}) },
  });

try {
  await cerrarColgados().catch(() => null);
  // 1. El equipo abre Comida en El Vigía (paso del panel; repetirlo no duplica nada).
  const abierta = ok(
    await equipo('POST', '/datos/admin/comida/ciudades', {
      zona: CIUDAD,
      motivo: 'Comida de pruebas en El Vigía (guion)',
    }),
    'abrir Comida en El Vigía',
  );
  exigir(abierta.zona.moneda === 'USD', 'El Vigía debería cobrar la comida en dólares');
  casos.push(`Comida abierta en El Vigía (${abierta.estado}), en dólares`);
  // C-COMIDA-PAGO-RESTAURANTE: Venezuela usa el pago directo al restaurante (bandera del país).
  const ve = ok(await equipo('GET', '/datos/admin/paises/VE'), 'configuración de Venezuela').config;
  exigir(
    ve.comidaPagoRestaurante === true,
    'Venezuela debería tener el pago directo al restaurante',
  );
  // C-COMIDA-VE-QUIEN-PAGA: la palanca del panel en el modelo aprobado (las tarifas viejas del
  // sitio de pruebas traían tarifa de servicio y cargo por pedido pequeño; abrir Comida no las pisa).
  const modelo = ok(
    await equipo('PUT', '/datos/admin/finanzas/comida-quien-paga', {
      pais: 'VE',
      motivo: 'Modelo aprobado de quién paga qué en la comida (guion de pruebas)',
      cliente: {
        servicioPb: 0,
        servicioMinimo: 0,
        servicioMaximo: 0,
        pedidoMinimo: 0,
        cargoPedidoPequeno: 0,
      },
      conductor: { comisionEnvioPb: 0 },
      restaurante: { comisionPb: 0 },
    }),
    'palanca «¿Quién paga qué en la comida?» en el modelo',
  );
  exigir(
    modelo.cliente.servicioPb === 0 &&
      modelo.cliente.cargoPedidoPequeno === 0 &&
      modelo.restaurante.comisionPb === 0 &&
      modelo.conductor.comisionEnvioPb === 0,
    'la palanca no quedó en el modelo (cliente sin servicio, restaurante y conductor en 0)',
  );
  palancaTocada = true;
  casos.push(
    'palanca en el modelo: el cliente sin servicio ni cargo pequeño, restaurante y conductor al 0 %',
  );
  // C-TASA-CORDURA: el guion ya no escribe ninguna tasa (antes dejaba 250 por dólar en el sitio de
  // pruebas). Usa la oficial que lee el servidor; sin ella, falla y lo dice.
  const tasas = ok(await equipo('GET', '/datos/admin/tasas-referencia'), 'tasas').tasas;
  exigir(
    tasas.find((t) => t.pais === 'VE')?.enUso?.tasa > 0,
    'el sitio de pruebas no tiene la tasa oficial de Venezuela (revisa el canario tasaBcv)',
  );

  // 2. El restaurante venezolano se registra con su ubicación y el equipo lo aprueba.
  const r = ok(
    await resto('PUT', '/datos/mi-restaurante', {
      nombre: 'Arepera de pruebas',
      descripcionEs: 'Arepas y jugos',
      descripcionEn: 'Arepas and juices',
      direccion: 'Avenida Bolívar, El Vigía, Mérida',
      ...LOCAL_REST,
      categoria: 'Venezolana',
      telefono: '+584140000000',
      tiempoPrepMin: 10,
    }),
    'registrar el restaurante',
  ).restaurante;
  ok(
    await equipo('PATCH', `/datos/admin/restaurantes/${r.id}`, { estado: 'aprobado' }),
    'aprobar el restaurante',
  );
  const menu = ok(await resto('GET', '/datos/mi-restaurante'), 'menú').platos ?? [];
  let plato = menu.find((p) => p.nombreEs === 'Arepa reina pepiada');
  if (!plato)
    plato = ok(
      await resto('POST', '/datos/mi-restaurante/platos', {
        nombreEs: 'Arepa reina pepiada',
        nombreEn: 'Reina pepiada arepa',
        precioCentavos: 450,
      }),
      'cargar el plato',
    ).plato;
  ok(
    await resto('PUT', '/datos/mi-restaurante/horarios', {
      turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
    }),
    'horario',
  );
  ok(await resto('PATCH', '/datos/mi-restaurante/abierto', { abierto: true }), 'abrir el local');
  // C-COMIDA-PAGO-RESTAURANTE: el restaurante tiene su cuenta de pago móvil (sin ella no recibe pedidos).
  const cobroRest = ok(
    await resto('GET', '/datos/restaurante/cuenta-cobro'),
    'cuenta del restaurante',
  );
  if (!cobroRest.cuenta)
    ok(
      await resto('POST', '/datos/restaurante/cuenta-cobro', {
        clave,
        banco: 'Banco de ejemplo',
        telefono: '04140000000',
        documento: 'J-000000001',
        titular: 'Restaurante de prueba',
      }),
      'cuenta de cobro del restaurante',
    );
  casos.push('el restaurante de El Vigía quedó aprobado, con su menú y abierto');

  // 3. El conductor SIN saldo es el que reparte (C-COMIDA-VE-QUIEN-PAGA: no se le aparta nada).
  //    El de saldo de las vueltas anteriores se queda desconectado para que la oferta sea del otro.
  await yo('POST', '/datos/repartidor/conectar', { conectado: false, ...LOCAL_REST }).catch(
    () => null,
  );
  ok(await pobre('POST', '/datos/repartidor/terminos', { version: versionTerminos }), 'términos');
  ok(
    await pobre('POST', '/datos/repartidor/conectar', { conectado: true, ...LOCAL_REST }),
    'conectarse',
  );
  const s0 = await saldo(pobre);
  exigir(s0.moneda === 'USD', `el saldo debería estar en dólares (${s0.moneda})`);
  exigir(s0.disponible === 0, `el conductor sin saldo tiene ${s0.disponible}`);
  exigir(
    s0.comisionTipicaComida === 0 && s0.sinSaldoComida === false,
    `con pago directo la comisión típica del conductor debería ser 0 (${s0.comisionTipicaComida})`,
  );
  casos.push('el conductor sin saldo puede repartir comida: comisión típica 0');

  const saldoRest = async () =>
    ok(
      await equipo('GET', `/datos/admin/finanzas/restaurantes/${r.id}/saldo`),
      'saldo del restaurante',
    ).disponible;
  const libro = async (id) =>
    ok(await equipo('GET', `/datos/admin/libro/pedido/${id}`), 'libro del pedido').movimientos ??
    [];
  const sumaDe = (movs, concepto) => {
    const m = movs.filter((x) => x.concepto === concepto && x.bolsillo === 'comisiones');
    return { n: m.length, s: m.reduce((a, x) => a + x.monto, 0) };
  };

  const pedirComida = async (metodoPago) => {
    // C-PAUSA-SIN-SENAL: el restaurante tiene su app abierta escuchando pedidos (la app pregunta
    // sola cada pocos segundos). Sin esto, el local de pruebas, que escuchó por última vez en una
    // vuelta de otro día, quedaba «sin señal» y el servidor rechazaba el pedido (19 nov 2026).
    ok(await resto('GET', '/datos/restaurante/pedidos'), 'el restaurante escucha pedidos');
    return ok(
      await cliente('POST', '/datos/pedidos', {
        restauranteId: r.id,
        lineas: [{ platoId: plato.id, cantidad: 2 }],
        propinaCentavos: 50,
        direccion: 'Calle 5 con avenida 3, El Vigía',
        ...CASA,
        metodoPago,
      }),
      `pedido en ${metodoPago}`,
    );
  };
  const aceptarRestaurante = async (id) =>
    ok(await resto('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }), 'acepta');
  const ofertasDe = async (quien) =>
    (ok(await quien('GET', '/datos/repartidor/ofertas'), 'ofertas').ofertas ?? []).map((o) => o.id);
  const ubicar = async (donde) => {
    for (let i = 0; i < 2; i++)
      ok(
        await pobre('POST', '/datos/repartidor/ubicacion', { ...donde, precision: 8 }),
        'ubicación',
      );
  };
  /** El conductor sin saldo toma el pedido sin que se le aparte nada. */
  async function tomarSinSaldo(id) {
    const antes = await saldo(pobre);
    exigir(
      (await ofertasDe(pobre)).includes(id),
      'el conductor sin saldo no recibió la oferta (con pago directo no se le cobra comisión)',
    );
    ok(await pobre('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}), 'acepta el conductor');
    const tras = await saldo(pobre);
    exigir(
      tras.reservado === antes.reservado && tras.disponible === antes.disponible,
      'PELIGRO: se le apartó comisión al conductor en un pedido de pago directo',
    );
    return antes;
  }
  /** Del «acepto» del conductor hasta la puerta del cliente. */
  async function llevar(id) {
    const antes = await tomarSinSaldo(id);
    // C-COMIDA-PAGO-RESTAURANTE: con el conductor asegurado, el cliente paga la comida al restaurante.
    const pc = ok(
      await cliente('GET', `/datos/pedidos/${id}/pago-comida`),
      'pago de la comida',
    ).pagoComida;
    exigir(
      pc?.estado === 'por_pagar',
      `el pago de la comida debería esperar al cliente (${pc?.estado})`,
    );
    exigir(pc.cuenta?.telefono, 'el cliente no ve la cuenta de pago móvil del restaurante');
    exigir(pc.montoLocal?.moneda === 'VES', 'el cliente no ve el monto en bolívares congelado');
    const sinPago = await resto('POST', `/datos/restaurante/pedidos/${id}/listo`, {});
    exigir(sinPago.estado === 409, 'PELIGRO: se marcó listo sin el pago confirmado');
    ok(
      await cliente('POST', `/datos/pedidos/${id}/pago-comida`, {
        referencia: `${Date.now()}`.slice(-8),
      }),
      'el cliente escribe la referencia',
    );
    ok(
      await resto('POST', `/datos/restaurante/pedidos/${id}/pago-comida`, { llego: true }),
      'el restaurante dice «Me llegó»',
    );
    ok(await resto('POST', `/datos/restaurante/pedidos/${id}/listo`, {}), 'listo');
    await ubicar(LOCAL_REST);
    ok(
      await foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, tokens.sinSaldo, LOCAL_REST),
      'foto de recogida',
    );
    ok(
      await resto('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {}),
      'confirma la recogida',
    );
    await ubicar(CASA);
    // C-DESLIZAR-SIEMPRE: como la app, la foto de la puerta no cierra; se cierra deslizando.
    ok(
      await foto(`/datos/repartidor/pedidos/${id}/foto-entrega`, tokens.sinSaldo, CASA),
      'foto de entrega',
    );
    ok(
      await pobre('POST', `/datos/repartidor/pedidos/${id}/entregado`, { ...CASA, modo: 'puerta' }),
      'desliza para entregar',
    );
    return { antes, comida: pc.comida, envio: pc.envioAlConductor };
  }
  const verPedido = async (id) =>
    ok(await cliente('GET', `/datos/pedidos/${id}`), 'el pedido').pedido;
  /** Lo que paga el cliente: comida + envío + propina, nada más. */
  const soloComidaYEnvio = (v, e) => {
    exigir(
      v.servicio === 0 && v.cargoPedidoPequeno === 0,
      `el cliente pagó tarifa de servicio (${v.servicio}) o cargo pequeño (${v.cargoPedidoPequeno})`,
    );
    exigir(
      v.subtotal === e.comida && v.envio === e.envio,
      `la comida (${v.subtotal}) o el envío (${v.envio}) no cuadran con el pago directo`,
    );
    exigir(
      v.total === v.subtotal + v.envio + v.propina,
      `el total ${v.total} no es comida ${v.subtotal} + envío ${v.envio} + propina ${v.propina}`,
    );
  };

  // 4. Pedido en EFECTIVO con el restaurante al 0 %: nadie paga comisión.
  const rest0 = await saldoRest();
  const p1 = await pedirComida('efectivo');
  await aceptarRestaurante(p1.pedidoId);
  const e1 = await llevar(p1.pedidoId);
  const v1 = await verPedido(p1.pedidoId);
  exigir(v1.moneda === 'USD', 'el pedido debería estar en dólares');
  exigir(v1.referencia?.moneda === 'VES', 'el cliente no ve el equivalente en bolívares');
  soloComidaYEnvio(v1, e1);
  const c1 = ok(
    await pobre('POST', `/datos/repartidor/pedidos/${p1.pedidoId}/cobre`, {
      // El conductor cobra SOLO el envío, entero: la comida ya se la pagó el cliente al restaurante.
      montoRecibido: e1.envio,
    }),
    'cobré',
  );
  exigir(c1.cobroEstado === 'confirmado', `cobro: ${c1.cobroEstado}`);
  const f1 = await verPedido(p1.pedidoId);
  exigir(f1.conciliacionEstado === 'conciliado', `conciliación: ${f1.conciliacionEstado}`);
  const s1 = await saldo(pobre);
  exigir(
    s1.disponible === e1.antes.disponible && s1.reservado === e1.antes.reservado,
    'PELIGRO: el saldo del conductor cambió en un pedido de pago directo',
  );
  const l1 = await libro(p1.pedidoId);
  exigir(
    sumaDe(l1, 'comision_cobrada').n === 0 && sumaDe(l1, 'comision_restaurante').n === 0,
    'con el restaurante al 0 % no debería salir comisión de nadie',
  );
  exigir((await saldoRest()) === rest0, 'el saldo del restaurante cambió con la comisión en 0 %');
  casos.push(
    `pedido de ${v1.total} centavos: comida ${e1.comida} al restaurante, envío ${e1.envio} entero en efectivo al conductor sin saldo, cero comisión, conciliado`,
  );

  // 5. El equipo sube la comisión del restaurante al 10 % (con la nota legal) y le carga saldo.
  const sinNota = await comisionRestaurante(1000);
  exigir(sinNota.estado === 422, `sin la nota legal debería ser 422 (${sinNota.estado})`);
  ok(
    await comisionRestaurante(1000, 'Revisión legal simulada del sitio de pruebas (guion)'),
    'comisión del restaurante al 10 %',
  );
  palancaTocada = true;
  const g10 = ok(await equipo('GET', '/datos/admin/finanzas/comida-quien-paga?pais=VE'), 'palanca');
  exigir(g10.restaurante.comisionPb === 1000, 'la comisión del restaurante no quedó en 10 %');
  if ((await saldoRest()) < 200)
    ok(
      await equipo('POST', `/datos/admin/finanzas/restaurantes/${r.id}/saldo`, {
        monto: 500,
        motivo: 'Saldo de regalo de pruebas (guion)',
        comprobante: '',
      }),
      'carga de saldo al restaurante',
    );
  const rest10 = await saldoRest();
  exigir(rest10 >= 200, `el restaurante no tiene saldo para la comisión (${rest10})`);
  casos.push(`comisión del restaurante al 10 % con nota legal (sin nota, 422); saldo ${rest10}`);

  // 6. Pedido con el envío por PAGO MÓVIL al conductor con «sí me llegó».
  const cuentas =
    ok(await pobre('GET', '/datos/repartidor/cuentas-cobro'), 'cuentas').cuentas ?? [];
  if (!cuentas.some((cu) => cu.tipo === 'pago_movil' && cu.vigente)) {
    const cu = ok(
      await pobre('POST', '/datos/repartidor/cuentas-cobro', {
        clave,
        tipo: 'pago_movil',
        banco: 'Banco de Venezuela',
        titular: 'Conductor de prueba',
        identificador: '04140000000',
      }),
      'cuenta de pago móvil',
    ).cuenta;
    ok(await equipo('PATCH', `/datos/admin/cuentas-cobro/${cu.id}`, {}), 'el equipo la confirma');
  }
  const p3 = await pedirComida('transferencia_repartidor');
  await aceptarRestaurante(p3.pedidoId);
  const e3 = await llevar(p3.pedidoId);
  soloComidaYEnvio(await verPedido(p3.pedidoId), e3);
  const pm = ok(
    await pobre('POST', `/datos/repartidor/pedidos/${p3.pedidoId}/pago-movil`, {
      recibido: true,
      referencia: '000000',
    }),
    'sí me llegó',
  );
  exigir(pm.estado === 'recibido', 'el pago móvil no quedó confirmado');
  const f3 = await verPedido(p3.pedidoId);
  exigir(
    f3.conciliacionEstado === 'conciliado',
    `conciliación pago móvil: ${f3.conciliacionEstado}`,
  );
  const diez = Math.round((e3.comida * 1000) / 10000);
  const l3 = await libro(p3.pedidoId);
  const cr = sumaDe(l3, 'comision_restaurante');
  exigir(
    cr.n === 1 && cr.s === diez,
    `la comisión del restaurante no salió una vez (${cr.n} · ${cr.s} de ${diez})`,
  );
  exigir(sumaDe(l3, 'comision_cobrada').n === 0, 'PELIGRO: se le cobró comisión al conductor');
  exigir(
    (await saldoRest()) === rest10 - diez,
    'el saldo del restaurante no bajó exactamente el 10 % de la comida',
  );
  const s3 = await saldo(pobre);
  exigir(
    s3.disponible === e3.antes.disponible && s3.reservado === e3.antes.reservado,
    'PELIGRO: el saldo del conductor cambió',
  );
  casos.push(
    `pedido de ${f3.total} centavos con el envío por pago móvil: «sí me llegó», ${diez} de comisión del saldo del restaurante (una vez), cero al conductor, conciliado`,
  );

  // 7. La comisión vuelve a 0 % y un pedido cancelado no le toca nada a nadie.
  ok(await comisionRestaurante(0), 'comisión del restaurante otra vez en 0 %');
  const restFin = await saldoRest();
  const p2 = await pedirComida('efectivo');
  await aceptarRestaurante(p2.pedidoId);
  const antes2 = await tomarSinSaldo(p2.pedidoId);
  ok(
    await equipo('POST', `/datos/admin/pedidos/${p2.pedidoId}/cancelar`, {
      motivo: 'Prueba: el restaurante no puede prepararlo',
    }),
    'cancelar',
  );
  const tras2 = await saldo(pobre);
  exigir(
    tras2.disponible === antes2.disponible && tras2.reservado === antes2.reservado,
    'el saldo del conductor cambió al cancelar',
  );
  exigir((await saldoRest()) === restFin, 'el saldo del restaurante cambió al cancelar');
  casos.push('comisión otra vez en 0 %; el pedido cancelado no le tocó el saldo a nadie');

  const salud = ok(await pedir('GET', '/datos/salud'), 'salud');
  exigir(
    salud.piezas?.comidaPaises === 'ok',
    `salud comida por país: ${salud.piezas?.comidaPaises}`,
  );
  exigir(
    salud.piezas?.pagoComida === 'ok',
    `salud del pago de la comida: ${salud.piezas?.pagoComida}`,
  );
  casos.push('la salud de comida por país y del pago de la comida sigue en verde');
} finally {
  await cerrarColgados().catch(() => null);
  if (palancaTocada) {
    const r0 = await comisionRestaurante(0).catch(() => null);
    casos.push(
      r0?.estado === 200
        ? 'la comisión del restaurante quedó otra vez en 0 %'
        : 'NO SE PUDO dejar la comisión del restaurante en 0 %: revísalo en el panel',
    );
  }
  const l = await interno('limpiar');
  casos.push(l.d.ok ? 'nadie quedó conectado ni con sesión' : 'LA LIMPIEZA FALLÓ');
}
const cuenta = await pedir('POST', '/datos/interno/diagnostico/vuelta', { id: VUELTA }, undefined, {
  'x-reloj-secreto': SECRETO,
});
console.log(JSON.stringify({ ok: true, vuelta: VUELTA, filas: cuenta.d, casos }, null, 2));
