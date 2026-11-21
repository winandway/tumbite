// Prueba de punta a punta de un viaje de Carro en Novi con las cuentas de PRUEBA (C-CUENTA-PRUEBA,
// 21 nov 2026) — Estados Unidos. Antes: node scripts/produccion/armar-cuentas-prueba-novi.mjs.
//
// Hace, por la API y como las apps: el pasajero guarda su dirección (la biblioteca pública de Novi) con
// las dos fotos ilustradas de la entrada, cotiza Carro desde ahí hasta Twelve Oaks, pide en EFECTIVO;
// el conductor se conecta en la recogida, recibe la oferta, acepta, ve las fotos de la entrada en «Ve a
// recoger», llega, inicia con el código del pasajero y termina; los dos se califican. Dice lo que cobró,
// la comisión y lo que falle.
//
// Las sesiones se crean directo en la base (la entrada pide el escudo anti-robots, que un guion no
// pasa) y se borran al final. Nunca usa tarjeta ni mueve dinero real: solo efectivo.
// Uso: node scripts/produccion/probar-viaje-prueba-novi.mjs [--pruebas]
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- archivos fijos del repositorio y de la configuración; claves de un mapa propio */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PRUEBAS = process.argv.includes('--pruebas');
const SITIO = PRUEBAS ? 'https://staging.tumbite.com' : 'https://divoox.com';
const LLAVE = execFileSync(
  'security',
  ['find-generic-password', '-s', `yadominios-llave-ia-tumbite${PRUEBAS ? '-pruebas' : ''}`, '-w'],
  { encoding: 'utf8' },
).trim();
const RAIZ = join(import.meta.dirname, '..', '..');
const ids = JSON.parse(
  readFileSync(
    join(
      homedir(),
      '.config',
      'tumbite',
      PRUEBAS ? '.ids-prueba-novi-pruebas.json' : '.ids-prueba-novi.json',
    ),
    'utf8',
  ),
);
const RECOGIDA = {
  lat: 42.4655564,
  lng: -83.4916797,
  direccion: '45255 W 10 Mile Rd, Novi, MI 48375, USA',
};
const DESTINO = {
  lat: 42.4919627,
  lng: -83.4702908,
  direccion: '27500 Novi Rd, Novi, MI 48377, USA',
};
const VUELTA = Date.now().toString(36);
const resultado = [];
const fallos = [];
const anotar = (t) => {
  resultado.push(t);
  console.log(`✓ ${t}`);
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function sql(q, params = []) {
  const r = await fetch('https://yapanel.yadominios.com/api/sitio/v1/consultar_base', {
    method: 'POST',
    headers: { authorization: `Bearer ${LLAVE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sql: q, params }),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(`base: ${d.mensaje ?? d.error ?? r.status}`);
  return d.resultado?.results ?? [];
}
const sha256 = async (t) =>
  Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))).toString('hex');

async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const binario = cuerpo instanceof Uint8Array;
  const r = await fetch(`${SITIO}${ruta}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': binario ? 'image/jpeg' : 'application/json',
      'x-idioma': 'es',
      ...extra,
    },
    body: cuerpo === undefined ? undefined : binario ? cuerpo : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  return { estado: r.status, d };
}
function ok(r, que) {
  if (r.estado >= 200 && r.estado < 300) return r.d;
  throw new Error(`${que}: ${r.estado} ${r.d.error ?? JSON.stringify(r.d).slice(0, 200)}`);
}

// Sesiones de dos horas para las dos cuentas (se borran al final).
const tokens = {};
for (const quien of ['pasajero', 'conductor']) {
  const t = `prueba-${crypto.randomUUID()}-${crypto.randomUUID()}`;
  await sql(
    "INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+2 hours'))",
    [await sha256(t), ids[quien]],
  );
  tokens[quien] = t;
}
const P = (m, r, c, x) => pedir(m, r, c, tokens.pasajero, x);
const C = (m, r, c, x) => pedir(m, r, c, tokens.conductor, x);
const paso = (id, nombre, cuerpo = {}) =>
  C('POST', `/datos/conductor/operaciones/${id}/${nombre}`, cuerpo, {
    'idempotency-key': `novi-${nombre}-${id}`.slice(0, 80),
  });

let viajeId = null;
try {
  // 1. El pasajero ve Carro (solo él, por ser de prueba).
  const servicios = ok(
    await P('GET', `/datos/servicios?lat=${RECOGIDA.lat}&lng=${RECOGIDA.lng}`),
    'servicios del pasajero',
  ).servicios;
  const carro = servicios.find((s) => s.id === 'carro');
  if (carro?.estado !== 'disponible') throw new Error(`el pasajero no ve Carro (${carro?.estado})`);
  anotar('el pasajero de prueba ve Carro disponible en Novi');
  const publico = (
    await (await fetch(`${SITIO}/datos/servicios?lat=${RECOGIDA.lat}&lng=${RECOGIDA.lng}`)).json()
  ).servicios.find((s) => s.id === 'carro');
  if (publico?.estado === 'disponible') fallos.push('¡el público también ve Carro en Novi!');
  else anotar(`el público de Novi no ve Carro (${publico?.estado ?? 'no sale'})`);

  // 2. Su dirección guardada con las dos fotos ilustradas de la entrada.
  const mias = ok(await P('GET', '/datos/mis-direcciones'), 'mis direcciones').direcciones ?? [];
  let casa = mias.find((d) => d.direccion === RECOGIDA.direccion);
  if (!casa)
    casa = ok(
      await P('POST', '/datos/mis-direcciones', {
        etiqueta: 'Casa',
        direccion: RECOGIDA.direccion,
        lat: RECOGIDA.lat,
        lng: RECOGIDA.lng,
        instrucciones: 'Entrada principal, junto a las escaleras.',
      }),
      'guardar la dirección',
    ).direccion;
  for (const [orden, foto] of [
    [1, 'puerta-casa-frente-es.jpg'],
    [2, 'puerta-casa-cerca-es.jpg'],
  ])
    ok(
      await P(
        'POST',
        `/datos/mis-direcciones/${casa.id}/fotos/${orden}`,
        new Uint8Array(readFileSync(join(RAIZ, 'e2e', 'recorrido', 'fotos', foto))),
      ),
      `foto ${orden} de la entrada`,
    );
  anotar('la dirección «Casa» (biblioteca pública de Novi) quedó con sus dos fotos ilustradas');

  // 3. El conductor acepta los términos y se conecta en la recogida.
  ok(
    await C('POST', '/datos/repartidor/terminos', { version: '2026-10-18' }),
    'términos del conductor',
  );
  let conexion = await C('POST', '/datos/repartidor/conectar', { conectado: true, ...RECOGIDA });
  if (conexion.estado === 409 && conexion.d.campo === 'selfie') {
    // La foto de control (de frente y girando), como en la app. En la cuenta de prueba va un dibujo.
    const dibujo = new Uint8Array(
      readFileSync(join(RAIZ, 'e2e', 'recorrido', 'fotos', 'bolsa-recogida.jpg')),
    );
    for (const pose of ['frente', 'giro'])
      ok(
        await C('POST', `/datos/kyc/selfie-control?pose=${pose}`, dibujo),
        `foto de control (${pose})`,
      );
    anotar('pidió la foto de control al conectarse y se tomó (de frente y girando)');
    conexion = await C('POST', '/datos/repartidor/conectar', { conectado: true, ...RECOGIDA });
  }
  ok(conexion, 'conectarse');
  ok(
    await C('POST', '/datos/repartidor/ubicacion', { lat: RECOGIDA.lat, lng: RECOGIDA.lng }),
    'ubicación',
  );
  anotar('el conductor se conectó en la recogida');

  // 4. Cotiza y pide en efectivo.
  const cot = ok(
    await P('POST', '/datos/viajes/cotizar', {
      servicio: 'carro',
      origen: RECOGIDA,
      destino: DESTINO,
    }),
    'cotizar',
  ).cotizacion;
  anotar(
    `cotización: ${(cot.total / 100).toFixed(2)} ${cot.moneda}; métodos ${cot.metodosPago?.join(', ')}; recogida guardada ${cot.recogida?.guardada ? 'sí' : 'no'}, con fotos ${cot.recogida?.conFotos ? 'sí' : 'no'}`,
  );
  const pedido = ok(
    await P(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo' },
      { 'idempotency-key': `novi-pedir-${VUELTA}` },
    ),
    'pedir el viaje',
  );
  viajeId = pedido.viaje.id;
  anotar('viaje pedido en efectivo');

  // 5. La oferta llega, acepta y ve la foto de la entrada en «Ve a recoger».
  let oferta = false;
  for (let i = 0; i < 15 && !oferta; i++) {
    const o = ok(await C('GET', '/datos/conductor/operaciones/ofertas'), 'ofertas').ofertas ?? [];
    oferta = o.some((x) => x.operacionId === viajeId);
    if (!oferta) {
      await P('GET', `/datos/viajes/${viajeId}`);
      await espera(2500);
    }
  }
  if (!oferta) throw new Error('la oferta nunca le llegó al conductor');
  anotar('la oferta le llegó al conductor');
  ok(await paso(viajeId, 'aceptar'), 'aceptar');
  anotar('el conductor aceptó');
  const recogida = ok(
    await C('GET', `/datos/conductor/operaciones/${viajeId}/recogida`),
    'ir a recoger',
  );
  const fotos = recogida.recogida?.fotos ?? recogida.fotos ?? [];
  if (fotos.length >= 1) anotar(`«Ve a recoger» muestra ${fotos.length} foto(s) de la entrada`);
  else fallos.push(`«Ve a recoger» no muestra fotos: ${JSON.stringify(recogida).slice(0, 200)}`);

  // 6. Llega, inicia con el código y termina.
  ok(await paso(viajeId, 'llegue'), 'llegué');
  const vista = ok(await P('GET', `/datos/viajes/${viajeId}`), 'el pasajero ve su viaje').viaje;
  ok(await paso(viajeId, 'iniciar', vista.pin ? { pin: vista.pin } : {}), 'iniciar');
  anotar(`empezó el viaje${vista.pin ? ' con el código del pasajero' : ''}`);
  const sinRecogida = await C('GET', `/datos/conductor/operaciones/${viajeId}/recogida`);
  if (
    sinRecogida.estado === 200 &&
    (sinRecogida.d.recogida?.fotos ?? sinRecogida.d.fotos ?? []).length
  )
    fallos.push('las fotos de la entrada siguen visibles después de recoger');
  else anotar('después de recoger, el conductor ya no ve las fotos de la entrada');
  await C('POST', '/datos/repartidor/ubicacion', { lat: DESTINO.lat, lng: DESTINO.lng });
  const fin = ok(await paso(viajeId, 'terminar'), 'terminar');
  anotar(`terminó: total ${((fin.totalFinal ?? cot.total) / 100).toFixed(2)} USD en efectivo`);

  // 7. Se califican.
  ok(
    await P('POST', `/datos/viajes/${viajeId}/calificar`, { estrellas: 5, comentario: '' }),
    'el pasajero califica',
  );
  ok(await paso(viajeId, 'calificar', { estrellas: 5, comentario: '' }), 'el conductor califica');
  anotar('los dos se calificaron con 5 estrellas');

  // 8. El dinero: lo que quedó en el libro para este viaje.
  const libro = await sql(
    'SELECT cuenta_id, bolsillo, monto, moneda, referencia FROM libro WHERE referencia LIKE ? ORDER BY rowid',
    [`%${viajeId}%`],
  );
  const op = (
    await sql(
      'SELECT estado_general, total_final, comision, metodo_pago FROM operaciones WHERE id = ?',
      [viajeId],
    ).catch(() => [])
  )[0];
  anotar(`operación: ${JSON.stringify(op ?? {})}`);
  anotar(
    libro.length
      ? `libro: ${libro.map((l) => `${l.bolsillo} ${l.monto} ${l.moneda}`).join(' · ')}`
      : 'libro: ningún movimiento para este viaje (en efectivo en EE. UU. no se descuenta comisión de un saldo)',
  );
} catch (e) {
  fallos.push(String(e.message ?? e));
  if (viajeId)
    await P(
      'POST',
      `/datos/viajes/${viajeId}/cancelar`,
      {},
      { 'idempotency-key': `novi-cancelar-${VUELTA}` },
    ).catch(() => null);
} finally {
  await C('POST', '/datos/repartidor/conectar', { conectado: false }).catch(() => null);
  await sql(
    "DELETE FROM sesiones WHERE usuario_id IN (?, ?) AND expira_en <= datetime('now', '+2 hours')",
    [ids.pasajero, ids.conductor],
  ).catch(() => null);
}
console.log(
  `\n${fallos.length ? `FALLÓ (${fallos.length}):\n- ${fallos.join('\n- ')}` : 'TODO EN VERDE'}`,
);
process.exitCode = fallos.length ? 1 : 0;
