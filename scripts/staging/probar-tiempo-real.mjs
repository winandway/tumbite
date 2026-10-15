// Fase 2 · Prueba EN VIVO del tiempo real contra el sitio de pruebas y los Workers desplegados
// para pruebas. Corre desde GitHub (workflow tiempo-real-staging) con secretos que nadie ve.
// Variables: URL_PRUEBAS, TIEMPO_REAL_URL, RELOJ_SECRETO, AVISOS_LLAVE_ID, AVISOS_SECRETO.
import { createHash, createHmac, randomBytes } from 'node:crypto';

const { URL_PRUEBAS, TIEMPO_REAL_URL, RELOJ_SECRETO, AVISOS_LLAVE_ID, AVISOS_SECRETO } =
  process.env;
for (const [k, v] of Object.entries({
  URL_PRUEBAS,
  TIEMPO_REAL_URL,
  RELOJ_SECRETO,
  AVISOS_LLAVE_ID,
  AVISOS_SECRETO,
}))
  if (!v) {
    console.error(`Falta ${k}.`);
    process.exit(1);
  }
if (!/staging\.tumbite\.com|tumbite-pruebas/.test(URL_PRUEBAS)) {
  console.error('Solo se corre contra el sitio de pruebas.');
  process.exit(1);
}
const casos = [];
const caso = (nombre, ok, detalle = '') => {
  casos.push({ nombre, ok: Boolean(ok), detalle });
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const diag = async (cuerpo) => {
  const r = await fetch(`${URL_PRUEBAS}/datos/interno/diagnostico/vivo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-reloj-secreto': RELOJ_SECRETO },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`diagnóstico ${r.status}`);
  return r.json();
};
const pase = async (token, cuerpo = {}) => {
  const r = await fetch(`${URL_PRUEBAS}/datos/tiempo-real/pase`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });
  return { estado: r.status, datos: await r.json().catch(() => ({})) };
};
/** Abre un WebSocket y junta lo que llega. */
function abrir(ruta, paseTexto) {
  return new Promise((resolver) => {
    const ws = new WebSocket(new URL(ruta, TIEMPO_REAL_URL).toString().replace(/^http/, 'ws'), [
      'tumbite-v1',
      paseTexto,
    ]);
    const llegados = [];
    const t = setTimeout(() => resolver({ ws, llegados, ok: false }), 8000);
    ws.onmessage = (ev) => llegados.push(JSON.parse(String(ev.data)));
    ws.onopen = () => {
      clearTimeout(t);
      resolver({ ws, llegados, ok: true });
    };
    ws.onerror = () => {
      clearTimeout(t);
      resolver({ ws, llegados, ok: false });
    };
  });
}
const firmar = (ruta, cuerpo) => {
  const tiempo = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(18).toString('hex');
  const linea = [
    'POST',
    ruta,
    tiempo,
    nonce,
    createHash('sha256').update(cuerpo).digest('hex'),
  ].join('\n');
  return {
    'x-tumbite-llave': AVISOS_LLAVE_ID,
    'x-tumbite-tiempo': tiempo,
    'x-tumbite-nonce': nonce,
    'x-tumbite-firma': createHmac('sha256', AVISOS_SECRETO).update(linea).digest('hex'),
  };
};
const avisar = async (avisos, firmado = true) => {
  const ruta = '/v1/interno/zona/US-FL-MIAMI/avisar';
  const cuerpo = JSON.stringify({ avisos });
  const r = await fetch(new URL(ruta, TIEMPO_REAL_URL), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(firmado ? firmar(ruta, cuerpo) : {}) },
    body: cuerpo,
  });
  return { estado: r.status, datos: await r.json().catch(() => ({})) };
};

const k = randomBytes(6).toString('hex');
const armado = await diag({ accion: 'armar', k });
try {
  const pLibre = await pase(armado.tokens.repLibre);
  const pPedido = await pase(armado.tokens.repPedido);
  const pCliente = await pase(armado.tokens.cliente, { pedidoId: armado.pedido });
  caso(
    'el sitio de pruebas emite pases (repartidor y cliente)',
    pLibre.estado === 200 && pCliente.estado === 200,
    `${pLibre.estado}/${pCliente.estado}`,
  );

  // Seguridad de la conexión.
  const malo = await abrir('/v1/conexion', 'no.vale');
  caso('un pase falso no conecta', !malo.ok);
  const enUrl = await fetch(new URL(`/v1/conexion?pase=${pLibre.datos.pase}`, TIEMPO_REAL_URL), {
    headers: { upgrade: 'websocket' },
  });
  caso('el pase en la dirección no sirve', enUrl.status === 401, String(enUrl.status));
  const clienteComoRep = await abrir('/v1/conexion', pCliente.datos.pase);
  caso('un cliente no entra como repartidor', !clienteComoRep.ok);
  const ajeno = await abrir('/v1/seguir/otro-pedido', pCliente.datos.pase);
  caso('un cliente no sigue un pedido ajeno', !ajeno.ok);

  // GPS.
  const libre = await abrir('/v1/conexion', pLibre.datos.pase);
  const conPedido = await abrir('/v1/conexion', pPedido.datos.pase);
  const sigue = await abrir(`/v1/seguir/${armado.pedido}`, pCliente.datos.pase);
  caso('los tres WebSocket conectan', libre.ok && conPedido.ok && sigue.ok);
  libre.ws.send(JSON.stringify({ tipo: 'hola', desde: 0 }));
  const t = Date.now();
  libre.ws.send(JSON.stringify({ tipo: 'ubicacion', id: 'u1', lat: 25.811, lng: -80.131, t }));
  libre.ws.send(JSON.stringify({ tipo: 'ubicacion', id: 'u1', lat: 25.811, lng: -80.131, t }));
  libre.ws.send(
    JSON.stringify({ tipo: 'ubicacion', id: 'u2', lat: 27.811, lng: -80.131, t: t + 2000 }),
  );
  conPedido.ws.send(JSON.stringify({ tipo: 'ubicacion', id: 'p1', lat: 25.79, lng: -80.2, t }));
  await espera(2500);
  const acks = libre.llegados.filter((m) => m.tipo === 'ack').map((m) => m.resultado);
  caso(
    'ubicación aceptada, la repetida se marca duplicada y el salto se descarta',
    acks.join(',') === 'ok,duplicada,salto',
    acks.join(','),
  );
  caso(
    'el cliente ve la posición de SU repartidor',
    sigue.llegados.some((m) => m.tipo === 'posicion' && m.c === armado.ids.repPedido),
  );
  caso(
    'y no la de otro repartidor',
    !sigue.llegados.some((m) => m.tipo === 'posicion' && m.c === armado.ids.repLibre),
  );

  // Avisos, firma y duplicados.
  caso(
    'un aviso sin firma no entra',
    (await avisar([{ id: `x-${k}`, para: { usuarios: [armado.ids.repLibre] }, datos: {} }], false))
      .estado === 401,
  );
  const a1 = await avisar([
    { id: `a1-${k}`, para: { usuarios: [armado.ids.repLibre] }, datos: { tipo: 'prueba', n: 1 } },
  ]);
  const a1b = await avisar([
    { id: `a1-${k}`, para: { usuarios: [armado.ids.repLibre] }, datos: { tipo: 'prueba', n: 1 } },
  ]);
  await espera(1500);
  const avisosLibre = libre.llegados.filter((m) => m.tipo === 'aviso');
  caso(
    'el aviso firmado llega una sola vez aunque se mande dos',
    a1.estado === 200 && a1b.datos.repetidos === 1 && avisosLibre.length === 1,
    JSON.stringify(a1b.datos),
  );
  caso(
    'el aviso no le llega a otro repartidor',
    !conPedido.llegados.some((m) => m.tipo === 'aviso'),
  );

  // Reconexión: se cae, llega un aviso, vuelve y lo recupera (sin repetir el anterior).
  const ultimoSeq = Math.max(...avisosLibre.map((m) => m.seq));
  libre.ws.close();
  await espera(800);
  await avisar([
    { id: `a2-${k}`, para: { usuarios: [armado.ids.repLibre] }, datos: { tipo: 'prueba', n: 2 } },
  ]);
  const p2 = await pase(armado.tokens.repLibre);
  const vuelve = await abrir('/v1/conexion', p2.datos.pase);
  vuelve.ws.send(JSON.stringify({ tipo: 'hola', desde: ultimoSeq }));
  await espera(1500);
  const recuperados = vuelve.llegados.filter((m) => m.tipo === 'aviso').map((m) => m.datos.n);
  caso(
    'al reconectar recupera solo lo que se perdió',
    recuperados.join(',') === '2',
    recuperados.join(','),
  );

  // Lote a la base (cada 15 s) y reloj.
  await espera(20_000);
  const leido = await diag({ accion: 'leer', k });
  const pos = Object.fromEntries(leido.posiciones.map((p) => [p.usuario_id, p]));
  caso(
    'la posición del repartidor libre llegó a la base en menos de 20 s',
    pos[armado.ids.repLibre]?.lat === 25.811,
    JSON.stringify(pos[armado.ids.repLibre]),
  );
  caso(
    'la del repartidor con pedido en curso NO (sigue por la ruta actual)',
    pos[armado.ids.repPedido]?.lat == null,
    JSON.stringify(pos[armado.ids.repPedido]),
  );
  const externos = leido.reloj.filter((r) => r.origen === 'origen:externo');
  caso(
    'el reloj externo está corriendo (vueltas recientes)',
    externos.length > 0,
    `${externos.length} de ${leido.reloj.length}`,
  );
  caso(
    'nunca dos vueltas en el mismo minuto',
    new Set(leido.reloj.map((r) => r.clave)).size === leido.reloj.length,
  );
  for (const s of [vuelve, conPedido, sigue]) s.ws.close();
} finally {
  await diag({ accion: 'borrar', k });
}
const ok = casos.every((c) => c.ok);
console.log(ok ? 'TODO EN VERDE' : 'HAY FALLAS');
process.exit(ok ? 0 : 1);
