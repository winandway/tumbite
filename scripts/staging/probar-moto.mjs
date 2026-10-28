#!/usr/bin/env node
// Divoox Moto · M10: viaje de Moto de PUNTA A PUNTA en el SITIO DE PRUEBAS, por la API, como lo
// hacen las apps. La herramienta interna del sitio (doble cerrojo: dominio de pruebas + secreto del
// reloj) arma un pasajero y un conductor temporales («zz-mt-…») y al final los borra.
// Después se comprueba, solo leyendo, que en producción Moto sigue «muy pronto» (C-MOTO-SOLO-PRUEBAS).
// Nunca escribe en producción: se niega a correr si la dirección no es la del sitio de pruebas.
// Uso: URL_PRUEBAS=https://staging.tumbite.com RELOJ_SECRETO=… node scripts/staging/probar-moto.mjs

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

const armado = await interno('/datos/interno/diagnostico/moto/armar', {});
exigir(armado.estado === 200, `armar: ${armado.estado} ${armado.d.error ?? ''}`);
const { tokens, punto, sufijo } = armado.d;
const comoCliente = { authorization: `Bearer ${tokens.cliente}` };
const comoConductor = { authorization: `Bearer ${tokens.conductor}` };
const casos = [];
let n = 0;
const paso = (id, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${id}/${nombre}`, cuerpo, {
    ...comoConductor,
    'idempotency-key': `m10-${nombre}-${++n}-${sufijo}`,
  });
try {
  const cot = await pedir(
    'POST',
    '/datos/viajes/cotizar',
    {
      servicio: 'moto',
      origen: { ...punto, direccion: 'Centro de Miami' },
      destino: { lat: 25.79, lng: -80.13, direccion: 'Miami Beach' },
    },
    comoCliente,
  );
  exigir(cot.estado === 201, `cotizar: ${cot.estado} ${cot.d.error ?? ''}`);
  const c = cot.d.cotizacion;
  const d = c.desglose;
  exigir(
    d.base + d.distancia + d.tiempo + d.ajusteMinimo + d.dinamico + d.cargoFijo + d.redondeo ===
      c.total,
    'el desglose no suma el total',
  );
  casos.push(`cotización con precio fijo: ${c.total} ${c.moneda} (${c.distanciaM} m)`);
  const v = await pedir(
    'POST',
    '/datos/viajes',
    { cotizacionId: c.id, metodoPago: 'efectivo' },
    comoCliente,
  );
  exigir(v.estado === 201, `pedir: ${v.estado} ${v.d.error ?? ''}`);
  const id = v.d.viaje.id;
  const o = await pedir('GET', '/datos/conductor/operaciones/ofertas', undefined, comoConductor);
  exigir(
    o.d.ofertas?.some((x) => x.operacionId === id),
    'el conductor no recibió la oferta al pedir',
  );
  casos.push('la oferta llegó al conductor al instante');
  exigir((await paso(id, 'aceptar')).estado === 200, 'aceptar');
  const comp = await pedir('POST', `/datos/viajes/${id}/compartir`, {}, comoCliente);
  exigir(comp.estado === 201, 'compartir');
  const codigo = String(comp.d.url).split('/ride/')[1];
  const vivo = await pedir('GET', `/datos/publico/viaje/${codigo}`);
  exigir(vivo.d.viaje?.estado === 'asignado', 'el enlace compartido no muestra el viaje');
  casos.push('el enlace compartido muestra el viaje en vivo');
  exigir((await paso(id, 'llegue')).estado === 200, 'llegué');
  const actual = await pedir('GET', '/datos/viajes/actual', undefined, comoCliente);
  const pin = actual.d.viaje?.pin;
  exigir(/^\d{4}$/.test(pin ?? ''), 'el pasajero no ve su código');
  exigir(
    (await paso(id, 'iniciar', { pin: pin === '0000' ? '1111' : '0000' })).estado === 409,
    'un código equivocado no debe iniciar',
  );
  exigir((await paso(id, 'iniciar', { pin })).estado === 200, 'iniciar con el código');
  const fin = await paso(id, 'terminar');
  exigir(fin.estado === 200 && fin.d.totalFinal === c.total, `terminar: ${JSON.stringify(fin.d)}`);
  casos.push(`viaje terminado; se cobra en efectivo ${fin.d.totalFinal} ${c.moneda}`);
  const apagado = await pedir('GET', `/datos/publico/viaje/${codigo}`);
  exigir(apagado.d.viaje?.terminado === true, 'el enlace compartido sigue mostrando el viaje');
  casos.push('el enlace compartido se apagó al terminar');
  exigir(
    (await pedir('POST', `/datos/viajes/${id}/calificar`, { estrellas: 5 }, comoCliente)).estado ===
      200,
    'calificar',
  );
  exigir(
    (
      await pedir(
        'POST',
        `/datos/conductor/operaciones/${id}/calificar`,
        { estrellas: 5 },
        comoConductor,
      )
    ).estado === 200,
    'calificar al pasajero',
  );
  casos.push('los dos lados calificaron');
  const salud = await pedir('GET', '/datos/salud');
  exigir(salud.d.piezas?.servicios === 'ok', `salud servicios: ${salud.d.piezas?.servicios}`);
  exigir(salud.d.piezas?.viajes === 'ok', `salud viajes: ${salud.d.piezas?.viajes}`);
  casos.push('la salud de servicios y viajes sigue en verde');
} finally {
  const l = await interno('/datos/interno/diagnostico/moto/limpiar', { sufijo });
  casos.push(l.d.ok ? 'la limpieza no dejó nada temporal' : 'LA LIMPIEZA FALLÓ');
}
// Producción, solo lectura: Moto no puede aparecer disponible.
const prod = await (await fetch('https://divoox.com/datos/servicios')).json();
const motoProd = prod.servicios?.find((s) => s.id === 'moto');
exigir(
  motoProd && motoProd.estado !== 'disponible',
  'PELIGRO: Moto aparece disponible en producción',
);
casos.push(`en producción Moto sigue «${motoProd.estado}»`);
console.log(JSON.stringify({ ok: true, casos }, null, 2));
