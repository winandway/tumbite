#!/usr/bin/env node
// El Agente Divoox de punta a punta (C-AGENTE-DIVOOX, 18 nov 2026) — todos los países con prepago.
// Recorre el circuito por la API, como las pantallas:
//   el equipo enciende la ciudad de pruebas y anota el fondo → el agente entra en dos pasos →
//   el conductor pide su código (el monto queda apartado; uno vivo a la vez) → el agente lo paga
//   (una sola vez: doble uso rechazado) → cancelación y vencimiento devuelven las ganancias →
//   sin fondo el panel no deja pagar → venta de saldo (acredita al instante; repetir no duplica) →
//   conciliación (lo vendido pasa al fondo) → permisos (la sesión del agente no abre nada más) →
//   la salud de agentes en verde. Deja la ciudad APAGADA.
// Cuentas FIJAS que se reutilizan (zz-age-…): el libro no se borra nunca. Cuenta sus filas con la
// vuelta de pruebas (x-vuelta-pruebas) y respeta su presupuesto. Nunca escribe en producción.
// Uso:
//   URL_PRUEBAS=https://staging.tumbite.com RELOJ_SECRETO=… node scripts/staging/probar-agente.mjs
//   URL_PRUEBAS=http://localhost:8791 RELOJ_SECRETO=… node scripts/staging/probar-agente.mjs (local)

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
const VUELTA = process.env.VUELTA_PRUEBAS ?? `agente-${Date.now().toString(36)}`;
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
  return { estado: r.status, d, galleta: (r.headers.get('set-cookie') ?? '').split(';')[0] ?? '' };
}
const exigir = (cond, texto) => {
  if (!cond) throw new Error(texto);
};
const ok = (r, que) => {
  exigir(r.estado >= 200 && r.estado < 300, `${que}: ${r.estado} ${r.d.error ?? ''}`);
  return r.d;
};
const interno = (ruta, cuerpo = {}) =>
  pedir('POST', `/datos/interno/diagnostico/agente/${ruta}`, cuerpo, undefined, {
    'x-reloj-secreto': SECRETO,
  });

const armado = await interno('armar', { ganancias: 4_000, vuelta: VUELTA });
exigir(armado.estado === 200, `armar: ${armado.estado} ${armado.d.error ?? ''}`);
const { tokens, ids, agente: cuentaAgente, zona, telefono } = armado.d;
const equipo = (metodo, ruta, cuerpo) =>
  pedir(metodo, `/datos/admin/${ruta}`, cuerpo, tokens.equipo);
const conductor = (metodo, ruta, cuerpo) => pedir(metodo, ruta, cuerpo, tokens.conductor);
const COBRO = '/datos/repartidor/cobro-efectivo';
let galleta = '';
const agente = (metodo, ruta, cuerpo) =>
  pedir(metodo, `/datos/agent/${ruta}`, cuerpo, undefined, { cookie: galleta });
const ciudad = (activo) =>
  equipo('PUT', `agentes-ciudad/${zona}`, {
    activo,
    pagaEn: 'USD',
    minimo: 500,
    topeConductorDia: 20_000,
  });
const ficha = async () =>
  ok(await equipo('GET', `agentes/${ids.agente}`), 'ficha del agente').agente;
const libro = (concepto, monto, sufijo) =>
  equipo('POST', `agentes/${ids.agente}/libro`, {
    concepto,
    monto,
    comprobante: `${VUELTA}-${sufijo}`.slice(0, 60),
    motivo: 'Guion de pruebas',
  });
const ganancias = async () => ok(await conductor('GET', COBRO), 'estado del cobro').ganancias;
const pedirCodigo = async (monto) =>
  ok(await conductor('POST', COBRO, { monto }), 'pedir el código').cobro;

try {
  // ── El equipo: ciudad encendida y fondo. ──
  ok(await ciudad(true), 'encender la ciudad');
  let f = await ficha();
  // Cada corrida anota 50 dólares de fondo; al final devuelve lo que pase de 50 (queda estable).
  ok(await libro('fondo', 5_000, 'fondo'), 'anotar el fondo');
  exigir(
    (await libro('fondo', 5_000, 'fondo')).estado === 409,
    'el mismo comprobante sumó dos veces',
  );
  f = await ficha();
  casos.push(`ciudad encendida y fondo anotado (${f.fondo} centavos); el comprobante no se repite`);

  // ── El agente entra en dos pasos. ──
  const mala = await pedir('POST', '/datos/agent/login', {
    correo: cuentaAgente.correo,
    clave: 'no-es-la-clave',
  });
  exigir(mala.estado === 401, `contraseña mala: ${mala.estado}`);
  const entrada = await pedir('POST', '/datos/agent/login', cuentaAgente);
  ok(entrada, 'entrar');
  galleta = entrada.galleta;
  exigir((await agente('GET', 'me')).estado === 401, 'la sesión sirvió sin el segundo paso');
  exigir(entrada.d.codigoPrueba, 'el sitio de pruebas no devolvió el código de entrada');
  const verificada = await agente('POST', 'verify', { codigo: entrada.d.codigoPrueba });
  ok(verificada, 'segundo paso');
  galleta = verificada.galleta || galleta;
  const yo = ok(await agente('GET', 'me'), 'panel del agente').agente;
  exigir(yo.fondo === f.fondo, `el agente ve otro fondo (${yo.fondo} y ${f.fondo})`);
  casos.push('el agente entra con correo, contraseña y código; sin el código la sesión no sirve');

  // ── Permisos: la sesión del agente no abre nada más, y nadie más abre su panel. ──
  const llave = galleta.split('=')[1] ?? '';
  for (const ruta of ['/datos/cuentas/yo', '/datos/admin/agentes', COBRO]) {
    const comoCookie = await pedir('GET', ruta, undefined, undefined, {
      cookie: `${galleta}; tumbite_sesion=${llave}`,
    });
    const comoLlave = await pedir('GET', ruta, undefined, llave);
    exigir(comoCookie.estado === 401 && comoLlave.estado === 401, `el agente abrió ${ruta}`);
  }
  exigir(
    (await pedir('GET', '/datos/agent/me', undefined, tokens.conductor)).estado === 401,
    'un conductor abrió el panel del agente',
  );
  exigir(
    (await pedir('GET', '/datos/agent/me', undefined, tokens.equipo)).estado === 401,
    'el equipo abrió el panel del agente con su sesión',
  );
  casos.push(
    'permisos: el agente no abre cuentas, superadmin ni rutas del conductor; nadie más abre su panel',
  );

  // ── Cobro: el código aparta el monto; uno vivo a la vez; se paga una sola vez. ──
  const antes = await ganancias();
  exigir(antes >= 4_000, `el conductor de prueba no tiene ganancias (${antes})`);
  exigir(
    (await conductor('POST', COBRO, { monto: 1_050 })).estado === 422,
    'aceptó centavos en dólares',
  );
  const c1 = await pedirCodigo(1_000);
  exigir(/^[1-9]\d{5}$/.test(c1.codigo), `código raro: ${c1.codigo}`);
  exigir((await ganancias()) === antes - 1_000, 'el monto no quedó apartado');
  exigir(
    (await conductor('POST', COBRO, { monto: 500 })).estado === 409,
    'dejó pedir un segundo código vivo',
  );
  exigir(
    (await agente('POST', 'payouts/lookup', { codigo: '012345' })).estado === 404,
    'un código que no existe pasó',
  );
  const visto = ok(
    await agente('POST', 'payouts/lookup', { codigo: c1.codigo }),
    'buscar el código',
  ).cobro;
  exigir(visto.monto === 1_000 && visto.alcanzaFondo, 'la ficha del cobro no cuadra');
  exigir(
    !JSON.stringify(visto).includes(ids.conductor),
    'la ficha del cobro trae el id del conductor',
  );
  const pago = ok(
    await agente('POST', `payouts/${visto.id}/pay`, { codigo: c1.codigo }),
    'pagar',
  ).recibo;
  exigir(pago.fondo === f.fondo - 1_000, `el fondo no bajó lo pagado (${pago.fondo})`);
  exigir(
    (await agente('POST', `payouts/${visto.id}/pay`, { codigo: c1.codigo })).estado === 409,
    'DOBLE USO: pagó dos veces',
  );
  exigir((await ganancias()) === antes - 1_000, 'las ganancias cambiaron al pagar');
  casos.push('cobro de 10 dólares: apartado al pedir, pagado una sola vez, el fondo bajó 10');

  // ── Cancelar y vencer devuelven las ganancias. ──
  await pedirCodigo(500);
  ok(await conductor('DELETE', COBRO), 'cancelar el código');
  exigir((await ganancias()) === antes - 1_000, 'cancelar no devolvió el monto');
  const c3 = await pedirCodigo(500);
  ok(await interno('vencer'), 'vencer el código');
  const vencido = ok(await conductor('GET', COBRO), 'estado tras vencer');
  exigir(
    vencido.vivo === null && vencido.historial[0]?.estado === 'vencido',
    'el código no se venció',
  );
  exigir(vencido.ganancias === antes - 1_000, 'vencer no devolvió el monto');
  exigir(
    (await agente('POST', 'payouts/lookup', { codigo: c3.codigo })).estado === 404,
    'un código vencido se pudo buscar',
  );
  casos.push('cancelado y vencido: el monto volvió a las ganancias y el código dejó de servir');

  // ── Fondo agotado: el panel no deja pagar. ──
  f = await ficha();
  ok(await libro('devolucion_fondo', f.fondo, 'devuelve'), 'dejar el fondo en cero');
  const c4 = await pedirCodigo(500);
  const v4 = ok(
    await agente('POST', 'payouts/lookup', { codigo: c4.codigo }),
    'buscar sin fondo',
  ).cobro;
  exigir(v4.alcanzaFondo === false, 'la ficha dice que el fondo alcanza');
  exigir(
    (await agente('POST', `payouts/${v4.id}/pay`, { codigo: c4.codigo })).estado === 409,
    'PAGÓ SIN FONDO',
  );
  ok(await libro('fondo', f.fondo, 'repone'), 'reponer el fondo');
  ok(await agente('POST', `payouts/${v4.id}/pay`, { codigo: c4.codigo }), 'pagar con fondo');
  casos.push('fondo agotado: no deja pagar; con el fondo repuesto, paga');

  // ── Venta de saldo: acredita al instante; repetir el toque no duplica. ──
  const saldoAntes = ok(
    await conductor('GET', '/datos/repartidor/saldo-prepago'),
    'saldo',
  ).disponible;
  const encontrado = ok(
    await agente('POST', 'drivers/find', { telefono }),
    'buscar al conductor',
  ).conductor;
  const venta = {
    conductorId: encontrado.id,
    monto: 1_000,
    idem: `${VUELTA}-venta`.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40),
  };
  const r1 = ok(await agente('POST', 'sales', venta), 'vender saldo').recibo;
  const r2 = ok(await agente('POST', 'sales', venta), 'repetir la venta').recibo;
  exigir(r1.numero === r2.numero, 'repetir el toque vendió dos veces');
  const saldo = ok(await conductor('GET', '/datos/repartidor/saldo-prepago'), 'saldo después');
  exigir(
    saldo.disponible === saldoAntes + 1_000,
    `el saldo no subió 10 (${saldoAntes} → ${saldo.disponible})`,
  );
  exigir(saldo.cargas?.[0]?.tipo === 'agente', 'la recarga no sale en las cargas del conductor');
  casos.push('venta de saldo de 10 dólares: acreditada al instante, una sola vez');

  // ── Conciliación: lo vendido pasa al fondo y todo cuadra. ──
  const medio = await ficha();
  exigir(medio.deuda >= 1_000, `la deuda no subió (${medio.deuda})`);
  ok(await libro('compensacion', medio.deuda, 'compensa'), 'pasar lo vendido al fondo');
  const fin = await ficha();
  exigir(fin.deuda === 0 && fin.fondo === medio.fondo + medio.deuda, 'la compensación no cuadra');
  const historial = ok(await agente('GET', 'history'), 'historial del agente').historial;
  exigir(
    historial.some((m) => m.tipo === 'pago') && historial.some((m) => m.tipo === 'venta'),
    'el historial no trae el pago o la venta',
  );
  const sobra = fin.fondo - 5_000;
  if (sobra > 0) ok(await libro('devolucion_fondo', sobra, 'sobra'), 'devolver el fondo que sobra');
  exigir((await ficha()).fondo <= 5_000, 'el fondo de pruebas quedó por encima de 50 dólares');
  casos.push(
    `conciliación: fondo ${fin.fondo}, deuda 0, pagado ${fin.pagado}, vendido ${fin.vendido}`,
  );

  const salud = (await pedir('GET', '/datos/salud')).d;
  exigir(salud.piezas?.agentes === 'ok', `salud agentes: ${salud.piezas?.agentes}`);
  casos.push('la salud de agentes está en verde');

  ok(await agente('POST', 'logout'), 'salir');
  exigir((await agente('GET', 'me')).estado === 401, 'la sesión siguió viva después de salir');
  casos.push('salir cierra la sesión de verdad');
} finally {
  // Pase lo que pase, la ciudad de pruebas queda apagada.
  const apagada = await ciudad(false).catch(() => null);
  casos.push(apagada?.estado === 200 ? 'la ciudad quedó apagada' : 'NO SE PUDO APAGAR LA CIUDAD');
}
const cuenta = await pedir('POST', '/datos/interno/diagnostico/vuelta', { id: VUELTA }, undefined, {
  'x-reloj-secreto': SECRETO,
});
console.log(JSON.stringify({ ok: true, vuelta: VUELTA, filas: cuenta.d, casos }, null, 2));
