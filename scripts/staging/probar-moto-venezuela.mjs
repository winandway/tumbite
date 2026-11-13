#!/usr/bin/env node
// Divoox Moto · Venezuela (C-MOTO-VE-PUNTA-A-PUNTA, 13 nov 2026). Hermano de probar-moto.mjs: hace por
// la API, como las apps y el panel, todo el camino del mototaxi en Caracas de pruebas:
//   el equipo abre la ciudad (si no está abierta) → el conductor elige Caracas, registra su moto y
//   sube sus papeles y su identidad → el equipo lo aprueba → recarga en dólares en el punto de venta
//   del equipo → viaje en EFECTIVO (cotiza, pide, oferta, acepta, ubicación en la recogida, llegué,
//   código, termina) con la comisión del 10 % descontada del saldo → un conductor SIN saldo no
//   recibe la oferta → viaje por PAGO MÓVIL con «sí me llegó».
// Cuentas FIJAS que se reutilizan (zz-mtve-…): el saldo y el libro no se borran nunca; el alta del
// conductor vuelve a empezar en cada vuelta. Cuenta sus filas con la vuelta de pruebas
// (x-vuelta-pruebas) y respeta su presupuesto. Nunca escribe en producción.
// Uso:
//   URL_PRUEBAS=https://staging.tumbite.com RELOJ_SECRETO=… node scripts/staging/probar-moto-venezuela.mjs
//   URL_PRUEBAS=http://localhost:8791 RELOJ_SECRETO=… node scripts/staging/probar-moto-venezuela.mjs (local)

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
const VUELTA = process.env.VUELTA_PRUEBAS ?? `moto-ve-${Date.now().toString(36)}`;
const FOTO = readFileSync(
  join(import.meta.dirname, '..', '..', 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'),
);
const CIUDAD = {
  id: 'VE-CCS-PRUEBAS',
  nombre: 'Caracas (pruebas)',
  lat: 10.4806,
  lng: -66.9036,
  radioKm: 25,
  zonaHoraria: 'America/Caracas',
};
const ORIGEN = { lat: 10.4806, lng: -66.9036, direccion: 'Plaza Venezuela' };
const DESTINO = { lat: 10.4806, lng: -66.8406, direccion: 'Los Dos Caminos' };
const RECARGA = 300; // centavos de dólar

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
  pedir('POST', `/datos/interno/diagnostico/moto-ve/${ruta}`, cuerpo, undefined, {
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
    'idempotency-key': `mtve-${nombre}-${++n}-${VUELTA}`.slice(0, 80),
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
      'idempotency-key': `mtve-cancelar-${VUELTA}`.slice(0, 80),
    });
}

async function cotizarYPedir(metodoPago) {
  const cot = ok(
    await pasajero('POST', '/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN,
      destino: DESTINO,
    }),
    'cotizar en Caracas',
  ).cotizacion;
  exigir(cot.moneda === 'USD', `la cotización debería ir en dólares (${cot.moneda})`);
  exigir(cot.metodosPago.includes(metodoPago), `${metodoPago} no está entre los métodos de pago`);
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
  const comision = Math.round(v.total / 10);
  const reservado = (await saldo()).reservado;
  exigir(reservado === comision, `al aceptar se apartan ${reservado} y debían ser ${comision}`);
  // El conductor llega a la recogida: manda su ubicación ahí (la app lo hace sola).
  ok(
    await yo('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng }),
    'ubicación',
  );
  ok(await paso(v.id, 'llegue'), 'llegué');
  const vista = ok(await pasajero('GET', `/datos/viajes/${v.id}`), 'el pasajero ve su viaje').viaje;
  exigir(/^\d{4}$/.test(vista.pin ?? ''), 'el pasajero no ve su código');
  exigir(
    (await paso(v.id, 'iniciar', { pin: vista.pin === '0000' ? '1111' : '0000' })).estado === 409,
    'un código equivocado no debe iniciar',
  );
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

try {
  await cerrarColgados();
  // Con nada colgado, el alta del conductor vuelve a empezar (su saldo y su libro se quedan).
  exigir((await interno('reiniciar')).estado === 200, 'reiniciar el alta del conductor');
  // 1. El equipo abre Caracas de pruebas (solo si Moto todavía no cotiza ahí).
  const prueba = await pasajero('POST', '/datos/viajes/cotizar', {
    servicio: 'moto',
    origen: ORIGEN,
    destino: DESTINO,
  });
  if (prueba.estado !== 201) {
    const abrir = () =>
      equipo('POST', '/datos/admin/viajes/ciudades', {
        servicio: 'moto',
        zona: CIUDAD,
        motivo: 'Ciudad de pruebas de Moto en Venezuela (guion de punta a punta)',
      });
    let r = await abrir();
    // En local Moto está cerrado como en producción: se abre la compuerta del país (base local).
    if (r.estado === 409 && LOCAL) {
      ok(
        await equipo('PUT', '/datos/admin/pasajeros-pais/VE/moto', {
          clave,
          abierto: true,
          solicitudMarca: 'LOCAL-0000',
          confirmo: true,
        }),
        'abrir Moto en Venezuela (solo local)',
      );
      r = await abrir();
    }
    ok(r, 'abrir Caracas de pruebas');
    casos.push('el equipo abrió Caracas de pruebas con un paso del panel');
  } else casos.push('Caracas de pruebas ya estaba abierta');
  const pais = ok(await equipo('GET', '/datos/admin/paises/VE'), 'configuración de Venezuela');
  if (!pais.config?.recargasPuntoVentaActivas)
    ok(
      await equipo('PUT', '/datos/admin/paises/VE', { recargasPuntoVentaActivas: true }),
      'encender las recargas en puntos de venta',
    );

  // 2. El conductor se registra con la app.
  ok(await yo('PUT', '/datos/conductor/ciudad', { zonaId: CIUDAD.id }), 'elegir Caracas');
  const papeles = ok(await yo('GET', '/datos/conductor/papeles'), 'qué papeles pide');
  exigir(papeles.ciudad.pais === 'VE', 'la ciudad del conductor no es de Venezuela');
  exigir(
    papeles.perfil.documentos.join(',') === 'licencia_moto,antecedentes_penales',
    `Venezuela debería pedir licencia y antecedentes (${papeles.perfil.documentos})`,
  );
  const moto = ok(
    await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Bera',
      modelo: 'SBR',
      anio: 2023,
      color: 'Negro',
      placa: `ZZ${Math.floor(Math.random() * 1e6)}`,
    }),
    'registrar la moto',
  ).id;
  for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente'])
    ok(
      await subir(`/datos/conductor/vehiculos/${moto}/documentos?tipo=${t}`, tokens.conductor),
      `subir ${t}`,
    );
  ok(await yo('POST', `/datos/conductor/vehiculos/${moto}/enviar`), 'enviar la moto a revisión');
  const docs = [];
  for (const t of ['licencia_moto', 'antecedentes_penales'])
    docs.push(
      ok(await subir(`/datos/conductor/papeles?tipo=${t}&vence=2030-01-01`, tokens.conductor), t)
        .id,
    );
  for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
    ok(await subir(`/datos/kyc/foto/${p}`, tokens.conductor), `identidad: ${p}`);
  ok(await yo('POST', '/datos/kyc/enviar', { docTipo: 'identificacion' }), 'enviar la identidad');
  casos.push('el conductor eligió Caracas, registró su moto y subió sus papeles y su identidad');

  // 3. El equipo lo aprueba desde el panel.
  const cola = ok(await equipo('GET', '/datos/admin/papeles-conductor'), 'cola de papeles');
  exigir(
    docs.every((id) => cola.documentos.some((d) => d.id === id && d.pais === 'VE')),
    'los papeles no aparecen en la cola del equipo',
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
    'motos por revisar',
  );
  const fila = veh.vehiculos.find((x) => x.id === moto);
  exigir(fila, 'la moto no aparece por revisar');
  for (const d of fila.documentos)
    ok(
      await equipo('PUT', `/datos/admin/vehiculos/${moto}/documentos/${d.id}`, {
        estado: 'aprobado',
        venceEn: '2030-01-01',
      }),
      'aprobar papel de la moto',
    );
  ok(
    await equipo('PUT', `/datos/admin/vehiculos/${moto}`, { estado: 'aprobado' }),
    'aprobar la moto',
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
  ok(await yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: moto }), 'usar la moto');
  const servicios = ok(await yo('GET', '/datos/conductor/servicios'), 'servicios del conductor');
  const sMoto = servicios.servicios.find((s) => s.servicioId === 'moto');
  exigir(sMoto?.puedeActivar, `Moto no quedó lista: falta ${sMoto?.requisitosFaltantes}`);
  casos.push('el equipo aprobó papeles, identidad, edad, moto y casco: quedó habilitado');

  // 4. Recarga en dólares en el punto de venta del equipo.
  const puntos = ok(await equipo('GET', '/datos/admin/puntos-venta'), 'puntos de venta').puntos;
  let punto = puntos.find(
    (p) => p.usuarioId === ids.equipo && p.pais === 'VE' && p.moneda === 'USD',
  );
  if (!punto)
    punto = ok(
      await equipo('POST', '/datos/admin/puntos-venta', {
        nombre: 'Equipo Divoox Caracas (pruebas)',
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
  const previo = (await saldo()).disponible;
  const codigo = ok(
    await equipo('POST', '/datos/punto-venta/codigos', { monto: RECARGA }),
    'código',
  ).codigo;
  ok(await yo('POST', '/datos/repartidor/recargar', { codigo }), 'canjear la recarga');
  const recargado = await saldo();
  exigir(recargado.moneda === 'USD', `el saldo debería estar en dólares (${recargado.moneda})`);
  exigir(recargado.disponible === previo + RECARGA, 'la recarga no llegó completa al saldo');
  exigir(
    recargado.carrerasAlcanzan === Math.floor(recargado.disponible / recargado.comisionTipica),
    '«te alcanza para N carreras» no cuadra',
  );
  casos.push(
    `recargó ${RECARGA} centavos de dólar; le alcanza para unas ${recargado.carrerasAlcanzan} carreras`,
  );

  // 5. Su pago móvil (se carga una vez y queda) y se conecta en la recogida.
  const cuentas = ok(
    await yo('GET', '/datos/repartidor/cuentas-cobro'),
    'cuentas de cobro',
  ).cuentas;
  if (!cuentas.some((x) => x.tipo === 'pago_movil' && x.vigente)) {
    const nueva = ok(
      await yo('POST', '/datos/repartidor/cuentas-cobro', {
        clave,
        tipo: 'pago_movil',
        banco: 'Banco de pruebas',
        titular: 'Conductor de prueba',
        identificador: '0412-0000000 · V-00000000',
      }),
      'cargar el pago móvil',
    ).cuenta;
    ok(await equipo('PATCH', `/datos/admin/cuentas-cobro/${nueva.id}`), 'confirmar el pago móvil');
  }
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
  // Y el conductor SIN saldo, aprobado y conectado al lado.
  exigir((await interno('sin-saldo')).estado === 200, 'preparar el conductor sin saldo');

  // 6. Viaje en efectivo.
  const v1 = await cotizarYPedir('efectivo');
  const s0 = ok(await sinSaldo('GET', '/datos/repartidor/saldo-prepago'), 'saldo del otro');
  exigir(
    s0.sinSaldo === true && s0.carrerasAlcanzan === 0,
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
    `viaje en efectivo de ${v1.total} centavos de dólar terminado; la comisión de ${e1.comision} salió del saldo`,
  );

  // 7. Viaje por pago móvil: el pasajero ve los datos del conductor y él confirma «sí me llegó».
  const v2 = await cotizarYPedir('pago_movil');
  const e2 = await hacerViaje(v2);
  exigir(
    e2.vista.pagoMovil?.datos?.titular === 'Conductor de prueba',
    'el pasajero no ve el pago móvil del conductor',
  );
  const pm = ok(
    await paso(v2.id, 'pago-movil', { recibido: true, referencia: '000000' }),
    'sí me llegó',
  );
  exigir(pm.estado === 'recibido', 'el pago móvil no quedó confirmado');
  await terminarYComprobar(v2, e2.antes, e2.comision);
  const fin = ok(await pasajero('GET', `/datos/viajes/${v2.id}`), 'el viaje por pago móvil').viaje;
  exigir(fin.pagoMovil?.confirmado === 'recibido', 'el pasajero no ve el pago confirmado');
  casos.push(
    `viaje por pago móvil de ${v2.total} centavos: «sí me llegó» y la comisión salió del saldo`,
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
if (!LOCAL) {
  // Producción, solo lectura: Moto no puede aparecer disponible.
  const prod = await (await fetch('https://divoox.com/datos/servicios')).json();
  const motoProd = prod.servicios?.find((s) => s.id === 'moto');
  exigir(
    motoProd && motoProd.estado !== 'disponible',
    'PELIGRO: Moto aparece disponible en producción',
  );
  casos.push(`en producción Moto sigue «${motoProd.estado}»`);
}
const cuenta = await pedir('POST', '/datos/interno/diagnostico/vuelta', { id: VUELTA }, undefined, {
  'x-reloj-secreto': SECRETO,
});
console.log(JSON.stringify({ ok: true, vuelta: VUELTA, filas: cuenta.d, casos }, null, 2));
