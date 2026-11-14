#!/usr/bin/env node
// Comida · Venezuela (C-COMIDA-VE-PUNTA-A-PUNTA, 13 nov 2026). Hermano de probar-moto-venezuela.mjs:
// hace por la API, como las apps y el panel, el pedido de comida en El Vigía (estado Mérida):
//   el equipo abre Comida en El Vigía (paso del panel) → el restaurante venezolano se registra con su
//   ubicación, el equipo lo aprueba y él carga su menú → el repartidor recarga en dólares en el punto
//   de venta del equipo → pedido en EFECTIVO (acepta el restaurante, acepta el repartidor con la
//   comisión apartada, listo, paga en el local, recoge, entrega, «cobré») con la comisión cobrada una
//   sola vez y conciliado → un repartidor SIN saldo no recibe la oferta → un pedido cancelado devuelve
//   lo apartado → pedido por PAGO MÓVIL con «sí me llegó».
// Cuentas FIJAS que se reutilizan (zz-cmve-…): el saldo, los pedidos y el libro no se borran nunca.
// Cuenta sus filas con la vuelta de pruebas (x-vuelta-pruebas) y respeta su presupuesto. Nunca
// escribe en producción.
// Uso:
//   URL_PRUEBAS=https://staging.tumbite.com RELOJ_SECRETO=… node scripts/staging/probar-comida-venezuela.mjs
//   URL_PRUEBAS=http://localhost:8791 RELOJ_SECRETO=… node scripts/staging/probar-comida-venezuela.mjs (local)

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
const RECARGA = 500; // centavos de dólar
const TASA = 250; // bolívares por dólar, solo si el equipo no escribió la del día

const casos = [];
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
async function foto(ruta, token, donde) {
  const r = await fetch(`${URL_PRUEBAS}${ruta}?lat=${donde.lat}&lng=${donde.lng}`, {
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
const { tokens, ids, clave, versionTerminos } = armado.d;
const equipo = (m, r, c) => pedir(m, r, c, tokens.equipo);
const cliente = (m, r, c) => pedir(m, r, c, tokens.cliente);
const resto = (m, r, c) => pedir(m, r, c, tokens.restaurante);
const yo = (m, r, c) => pedir(m, r, c, tokens.repartidor);
const pobre = (m, r, c) => pedir(m, r, c, tokens.sinSaldo);
const saldo = async (quien = yo) =>
  ok(await quien('GET', '/datos/repartidor/saldo-prepago'), 'saldo');
const ubicar = async (donde) => {
  for (let i = 0; i < 2; i++)
    ok(await yo('POST', '/datos/repartidor/ubicacion', { ...donde, precision: 8 }), 'ubicación');
};

/** Lo que haya quedado abierto de una vuelta anterior se cierra por la API (nunca a mano). */
async function cerrarColgados() {
  const { d } = await cliente('GET', '/datos/mis-pedidos');
  const mios = (d.pedidos ?? []).filter((p) => !['entregado', 'cancelado'].includes(p.estado));
  for (const p of mios)
    await equipo('POST', `/datos/admin/pedidos/${p.id}/cancelar`, {
      motivo: 'Cierre de una vuelta de pruebas anterior',
    });
}

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
  const tasas = ok(await equipo('GET', '/datos/admin/tasas-referencia'), 'tasas').tasas;
  if (!tasas.find((t) => t.pais === 'VE')?.vigente)
    ok(await equipo('PUT', '/datos/admin/tasas-referencia/VE', { tasa: TASA }), 'tasa del día');

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
  casos.push('el restaurante de El Vigía quedó aprobado, con su menú y abierto');

  // 3. Repartidores: términos, conectados en el local; el de saldo recarga en dólares.
  for (const quien of [yo, pobre]) {
    ok(await quien('POST', '/datos/repartidor/terminos', { version: versionTerminos }), 'términos');
    ok(
      await quien('POST', '/datos/repartidor/conectar', { conectado: true, ...LOCAL_REST }),
      'conectarse',
    );
  }
  const sp = await saldo(pobre);
  exigir(sp.disponible === 0, `el repartidor sin saldo tiene ${sp.disponible}`);
  if ((await saldo()).disponible < RECARGA) {
    const puntos = ok(await equipo('GET', '/datos/admin/puntos-venta'), 'puntos').puntos;
    let punto = puntos.find(
      (p) => p.usuarioId === ids.equipo && p.pais === 'VE' && p.moneda === 'USD',
    );
    if (!punto)
      punto = ok(
        await equipo('POST', '/datos/admin/puntos-venta', {
          nombre: 'Equipo Divoox Venezuela (pruebas)',
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
          comprobante: `pruebas-${VUELTA}`.slice(0, 60),
        }),
        'fondo del punto',
      );
    const codigo = ok(
      await equipo('POST', '/datos/punto-venta/codigos', { monto: RECARGA }),
      'código',
    ).codigo;
    ok(await yo('POST', '/datos/repartidor/recargar', { codigo }), 'canjear la recarga');
    casos.push(`recarga de ${RECARGA} centavos de dólar en el punto del equipo`);
  }
  const s0 = await saldo();
  exigir(s0.moneda === 'USD', `el saldo debería estar en dólares (${s0.moneda})`);
  exigir(
    s0.pedidosAlcanzan === Math.floor(s0.disponible / s0.comisionTipicaComida),
    '«te alcanza para N pedidos» no cuadra',
  );
  casos.push(`saldo ${s0.disponible}: te alcanza para unos ${s0.pedidosAlcanzan} pedidos`);

  const pedirComida = async (metodoPago) =>
    ok(
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
  const aceptarRestaurante = async (id) =>
    ok(await resto('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }), 'acepta');
  const ofertasDe = async (quien) =>
    (ok(await quien('GET', '/datos/repartidor/ofertas'), 'ofertas').ofertas ?? []).map((o) => o.id);
  /** Del «acepto» del repartidor hasta la puerta del cliente; devuelve lo apartado. */
  async function llevar(id) {
    const antes = await saldo();
    exigir((await ofertasDe(yo)).includes(id), 'el repartidor con saldo no recibió la oferta');
    ok(await yo('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}), 'acepta el repartidor');
    const tras = await saldo();
    const apartado = tras.reservado - antes.reservado;
    exigir(
      apartado > 0 && tras.disponible === antes.disponible - apartado,
      'no apartó la comisión',
    );
    ok(await resto('POST', `/datos/restaurante/pedidos/${id}/listo`, {}), 'listo');
    const l = ok(await yo('GET', `/datos/repartidor/pedidos/${id}/pago-local`), 'pago en el local');
    ok(
      await yo('POST', `/datos/repartidor/pedidos/${id}/pago-local`, {
        montoPagado: l.montoEsperado,
        importeTicket: l.subtotal,
        metodo: 'efectivo',
      }),
      'registra el pago en el local',
    );
    await ubicar(LOCAL_REST);
    ok(
      await foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, tokens.repartidor, LOCAL_REST),
      'foto de recogida',
    );
    ok(
      await resto('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {}),
      'confirma la recogida',
    );
    await ubicar(CASA);
    ok(
      await foto(`/datos/repartidor/pedidos/${id}/entregado`, tokens.repartidor, CASA),
      'foto de entrega',
    );
    return { antes, apartado };
  }
  const verPedido = async (id) =>
    ok(await cliente('GET', `/datos/pedidos/${id}`), 'el pedido').pedido;

  // 4. Pedido en EFECTIVO de punta a punta.
  const p1 = await pedirComida('efectivo');
  await aceptarRestaurante(p1.pedidoId);
  const e1 = await llevar(p1.pedidoId);
  const v1 = await verPedido(p1.pedidoId);
  exigir(v1.moneda === 'USD', 'el pedido debería estar en dólares');
  exigir(v1.referencia?.moneda === 'VES', 'el cliente no ve el equivalente en bolívares');
  const c1 = ok(
    await yo('POST', `/datos/repartidor/pedidos/${p1.pedidoId}/cobre`, {
      montoRecibido: v1.total - v1.propina,
    }),
    'cobré',
  );
  exigir(c1.cobroEstado === 'confirmado', `cobro: ${c1.cobroEstado}`);
  const f1 = await verPedido(p1.pedidoId);
  exigir(f1.conciliacionEstado === 'conciliado', `conciliación: ${f1.conciliacionEstado}`);
  const s1 = await saldo();
  exigir(
    s1.disponible === e1.antes.disponible - e1.apartado && s1.reservado === e1.antes.reservado,
    'la comisión no salió del saldo una sola vez',
  );
  casos.push(
    `pedido en efectivo de ${v1.total} centavos: comisión ${e1.apartado} cobrada una vez, conciliado`,
  );

  // 5. Sin saldo no hay oferta; y un pedido cancelado devuelve lo apartado.
  const p2 = await pedirComida('efectivo');
  await aceptarRestaurante(p2.pedidoId);
  exigir(
    !(await ofertasDe(pobre)).includes(p2.pedidoId),
    'PELIGRO: ofrecido a quien no tiene saldo',
  );
  casos.push('el repartidor sin saldo no recibió la oferta');
  const antes2 = await saldo();
  exigir(
    (await ofertasDe(yo)).includes(p2.pedidoId),
    'el repartidor con saldo no recibió la oferta',
  );
  ok(await yo('POST', `/datos/repartidor/ofertas/${p2.pedidoId}/aceptar`, {}), 'acepta');
  ok(
    await equipo('POST', `/datos/admin/pedidos/${p2.pedidoId}/cancelar`, {
      motivo: 'Prueba: el restaurante no puede prepararlo',
    }),
    'cancelar',
  );
  const tras2 = await saldo();
  exigir(
    tras2.disponible === antes2.disponible && tras2.reservado === antes2.reservado,
    'lo apartado no volvió completo al cancelar',
  );
  casos.push('el pedido cancelado devolvió lo apartado al saldo');

  // 6. Pedido por PAGO MÓVIL con «sí me llegó».
  const cuentas = ok(await yo('GET', '/datos/repartidor/cuentas-cobro'), 'cuentas').cuentas ?? [];
  if (!cuentas.some((cu) => cu.tipo === 'pago_movil' && cu.vigente)) {
    const cu = ok(
      await yo('POST', '/datos/repartidor/cuentas-cobro', {
        clave,
        tipo: 'pago_movil',
        banco: 'Banco de Venezuela',
        titular: 'Repartidor de prueba',
        identificador: '04140000000',
      }),
      'cuenta de pago móvil',
    ).cuenta;
    ok(await equipo('PATCH', `/datos/admin/cuentas-cobro/${cu.id}`, {}), 'el equipo la confirma');
  }
  const p3 = await pedirComida('transferencia_repartidor');
  await aceptarRestaurante(p3.pedidoId);
  const e3 = await llevar(p3.pedidoId);
  const pm = ok(
    await yo('POST', `/datos/repartidor/pedidos/${p3.pedidoId}/pago-movil`, {
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
  casos.push(
    `pedido por pago móvil de ${f3.total} centavos: «sí me llegó», comisión ${e3.apartado}, conciliado`,
  );

  const salud = ok(await pedir('GET', '/datos/salud'), 'salud');
  exigir(
    salud.piezas?.comidaPaises === 'ok',
    `salud comida por país: ${salud.piezas?.comidaPaises}`,
  );
  casos.push('la salud de comida por país sigue en verde');
} finally {
  await cerrarColgados().catch(() => null);
  const l = await interno('limpiar');
  casos.push(l.d.ok ? 'nadie quedó conectado ni con sesión' : 'LA LIMPIEZA FALLÓ');
}
const cuenta = await pedir('POST', '/datos/interno/diagnostico/vuelta', { id: VUELTA }, undefined, {
  'x-reloj-secreto': SECRETO,
});
console.log(JSON.stringify({ ok: true, vuelta: VUELTA, filas: cuenta.d, casos }, null, 2));
