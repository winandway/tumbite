/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio y de Entregas; `document` y `localStorage` corren dentro del navegador */
// Capturas REALES para el video «Fotos de la entrada» (C-FOTO-PUERTA y C-FOTO-RECOGIDA, 21 nov 2026)
// — todos los países. Con las apps web reales del cliente (/app) y de Driver (/driver/) contra el
// servidor LOCAL del recorrido (.recorrido, puerto 8790; antes: node scripts/recorrido/preparar.mjs).
// El guion enciende el servidor y los simuladores, toma las capturas y lo apaga todo. NO toca el sitio
// de pruebas ni producción.
//
// Tamaño de iPhone: 390 × 844 a 3× = 1170 × 2532, como las 01 a 05 de la misma serie.
// Datos neutros: «Ciudad de ejemplo», «Calle de Ejemplo 120», «Pizzería Ejemplo»; la foto de la casa es
// un DIBUJO de una fachada sin gente (e2e/recorrido/fotos). Ninguna persona, placa ni ciudad real.
//
//   06 la casilla «Frente de la casa» con la foto tomada y su marca de guardada
//   07 la dirección guardada en la lista, con su nombre y el sello de que tiene fotos
//   08 el cliente con un pedido en camino (seguimiento)
//   09 Driver durante esa entrega, con la foto de la entrada abierta
//   10 Driver con el pedido entregado, ya sin la foto
//   11 Driver yendo a recoger a un pasajero (mototaxi), con la foto de la entrada a la vista
//   12 Driver con el pasajero ya recogido, sin la foto
//   13 Driver yendo a recoger a un pasajero (taxi en carro), con la foto de la entrada
//   → ~/Documents/Entregas/Divoox/video-fotos-de-la-entrada/pantallas/NN-nombre-<es|en>.png
//   → y la carpeta entera copiada a docs/videos/fotos-de-la-entrada/pantallas/
// Uso: node scripts/recorrido/capturas-video-fotos-entrada.mjs   (SOLO_IDIOMA=es|en, SOLO=06,07…)
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const PUERTO = new globalThis.URL(URL).port;
const FOTOS = join(RAIZ, 'e2e', 'recorrido', 'fotos');
const ENTREGA = join(
  homedir(),
  'Documents',
  'Entregas',
  'Divoox',
  'video-fotos-de-la-entrada',
  'pantallas',
);
const EN_REPO = join(RAIZ, 'docs', 'videos', 'fotos-de-la-entrada', 'pantallas');
mkdirSync(ENTREGA, { recursive: true });
mkdirSync(EN_REPO, { recursive: true });
const SOLO = process.env.SOLO ? new Set(process.env.SOLO.split(',')) : null;
const quiero = (n) => !SOLO || SOLO.has(n);

// ───────────────────────── servidor local y simuladores (se apagan al terminar)
const hijos = [];
const encender = (cmd, args) => {
  const h = spawn(cmd, args, { cwd: RAIZ, stdio: 'ignore', detached: true });
  hijos.push(h);
};
const apagar = () => {
  for (const h of hijos)
    try {
      process.kill(-h.pid);
    } catch {
      /* ya estaba apagado */
    }
};
encender('node', ['scripts/recorrido/stripe-simulado.mjs']);
encender('node', ['scripts/recorrido/twilio-simulado.mjs']);
encender('npx', [
  'wrangler',
  'dev',
  '-c',
  '.recorrido/wrangler.jsonc',
  '--port',
  PUERTO,
  '--persist-to',
  '.recorrido/estado',
]);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ip = 0;
async function llamar(metodo, ruta, cuerpo, token, extra = {}) {
  return fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.84.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await llamar(metodo, ruta, cuerpo, token, extra);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const sql = (q) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': SECRETO,
  });
const interno = (ruta, cuerpo = {}) =>
  pedir('POST', `/datos/interno/diagnostico/${ruta}`, cuerpo, undefined, {
    'x-reloj-secreto': SECRETO,
  });
const txt = (s) => String(s).replace(/'/g, "''");
const subirFoto = async (ruta, token, archivo, tipo = 'image/jpeg') => {
  const r = await fetch(`${URL}${ruta}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': tipo },
    body: readFileSync(archivo),
  });
  if (!r.ok) throw new Error(`foto ${ruta}: ${r.status} ${await r.text()}`);
};
/** Un paso del conductor en un viaje (cada acción lleva su clave nueva). */
const paso = (token, operacion, nombre, cuerpo = {}) =>
  pedir('POST', `/datos/conductor/operaciones/${operacion}/${nombre}`, cuerpo, token, {
    'idempotency-key': `video-${nombre}-${randomBytes(8).toString('hex')}`,
  });

// El mapa necesita un lugar de verdad. Para que no salga el nombre de ninguna ciudad, los puntos
// están en campo abierto (calles sin rótulo de población) y la zona se llama «de ejemplo».
const ZONA = 'US-ZZ-EJEMPLO';
const CENTRO = { lat: 42.6006, lng: -84.1955 };
const LOCAL = { lat: 42.601, lng: -84.1935 };
const CASA = { lat: 42.5922, lng: -84.198 };
const DESTINO = { lat: 42.5995, lng: -84.1889 };
const CERCA = { lat: 42.5945, lng: -84.1972 };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };

const L = {
  es: {
    ciudad: 'Ciudad de ejemplo',
    locale: 'es-US',
    cliente: 'Laura Pérez',
    conductor: 'José Rojas',
    taxista: 'Marta Díaz',
    casaNombre: 'Casa',
    casa: 'Calle de Ejemplo 120',
    destino: 'Avenida de Ejemplo 45',
    mensaje: 'Portón verde. Toca el timbre dos veces.',
    restaurante: 'Pizzería Ejemplo',
    local: 'Avenida Principal de Ejemplo 10',
    plato: ['Pizza margarita', 'Margherita pizza'],
  },
  en: {
    ciudad: 'Example city',
    locale: 'en-US',
    cliente: 'Jamie Lee',
    conductor: 'Sam Carter',
    taxista: 'Alex Rivera',
    casaNombre: 'Home',
    casa: '120 Example Street',
    destino: '45 Example Avenue',
    mensaje: 'Green gate. Ring the bell twice.',
    restaurante: 'Example Pizza',
    local: '10 Example Main Avenue',
    plato: ['Pizza margarita', 'Margherita pizza'],
  },
};

let navegador;
async function pasada(idioma) {
  const T = L[idioma];
  const v = `${idioma}${Date.now().toString(36)}`;
  const captura = async (p, numero, nombre) => {
    const archivo = join(ENTREGA, `${numero}-${nombre}-${idioma}.png`);
    await p.screenshot({ path: archivo });
    console.log(`✓ ${numero}-${nombre}-${idioma}.png`);
  };
  const telefono = async (token, id, donde) => {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      baseURL: URL,
      locale: T.locale,
      timezoneId: 'America/Detroit',
      geolocation: { latitude: donde.lat, longitude: donde.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, u, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [token, id, idioma],
    );
    return ctx;
  };
  const mapaListo = async (p) => {
    await p
      .locator('.leaflet-tile-loaded')
      .nth(3)
      .waitFor({ timeout: 20_000 })
      .catch(() => null);
    await espera(2_500);
  };
  const sesion = async (id) => {
    const token = randomBytes(24).toString('hex');
    await sql(
      `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(token).digest('hex')}', '${id}', datetime('now', '+90 minutes'))`,
    );
    return token;
  };
  const cuenta = async (rol, nombre) => {
    const r = await pedir('POST', '/datos/cuentas/registro', {
      nombre,
      correo: `video.${rol}.${v}.${randomBytes(3).toString('hex')}@recorrido.test`,
      clave: DATOS.clave,
      rol,
      idioma,
    });
    await sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now'), telefono_verificado_en = datetime('now'), fecha_nacimiento = '1990-03-15', idioma = '${idioma}' WHERE id = '${r.usuario.id}'`,
    );
    return { token: r.token, id: r.usuario.id };
  };

  // ───────── la ciudad de ejemplo, con comida, mototaxi y taxi encendidos
  await sql(
    `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${ZONA}', '${txt(T.ciudad)}', 'US', 'USD', 'America/Detroit', ${CENTRO.lat}, ${CENTRO.lng}, 15, 1)
     ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, lat = excluded.lat, lng = excluded.lng`,
  );
  const a = await interno('carro/armar');
  const equipo = a.tokens.equipo;
  for (const servicio of ['moto', 'carro']) {
    // En el servidor local los servicios de pasajeros se encienden por la base (como moto/armar).
    await sql(`UPDATE servicios SET estado = 'disponible' WHERE id = '${servicio}'`);
    await sql(
      `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('${servicio}', '${ZONA}', 'disponible')
       ON CONFLICT DO UPDATE SET estado = 'disponible'`,
    );
    await pedir(
      'POST',
      '/datos/admin/viajes/tarifas',
      { servicio, zona: ZONA, tarifa: TARIFA, motivo: 'Capturas' },
      equipo,
    );
    // Sin código para empezar: las capturas son de la foto, no del PIN.
    await pedir(
      'PUT',
      '/datos/admin/viajes/ajustes',
      { zona: ZONA, servicio, pin: 'nunca', selfieCasco: false },
      equipo,
    );
  }
  const listoParaManejar = async (id, token, nombre) => {
    await sql(
      `UPDATE usuarios SET nombre = '${txt(nombre)}', idioma = '${idioma}' WHERE id = '${id}'`,
    );
    await pedir('POST', '/datos/repartidor/terminos', { version: a.versionTerminos }, token).catch(
      () => null,
    );
    await sql(`DELETE FROM selfies_control WHERE usuario_id = '${id}' AND tomada_en IS NULL`);
    await sql(
      `INSERT OR REPLACE INTO selfies_control (id, usuario_id, tomada_en, resultado) VALUES ('video-${id}', '${id}', datetime('now'), 'ok')`,
    );
    await sql(
      `UPDATE operaciones SET estado_general = 'cancelada' WHERE conductor_id = '${id}' AND estado_general IN ('asignada', 'en_curso')`,
    ).catch(() => null);
    await sql(`DELETE FROM conductor_ocupacion WHERE conductor_id = '${id}'`);
  };
  const ubicar = async (id, donde) =>
    sql(
      `UPDATE repartidores SET conectado = 1, zona_id = '${ZONA}', lat = ${donde.lat}, lng = ${donde.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${id}'`,
    );
  // El taxista (carro) también reparte comida; el mototaxista sale de su propio armado.
  const taxista = { id: a.ids.conductorUs, token: await sesion(a.ids.conductorUs) };
  await interno('carro/conductor', { quien: 'us', zonaId: ZONA, ...LOCAL });
  await listoParaManejar(taxista.id, taxista.token, T.taxista);
  const m = await interno('moto/armar');
  const moto = { id: m.ids.conductor, token: m.tokens.conductor };
  await listoParaManejar(moto.id, moto.token, T.conductor);

  // ───────── el cliente, con su casa guardada y la foto de su entrada (un dibujo)
  const cli = await cuenta('cliente', T.cliente);
  const casa = (
    await pedir(
      'POST',
      '/datos/mis-direcciones',
      { etiqueta: T.casaNombre, direccion: T.casa, ...CASA, instrucciones: T.mensaje },
      cli.token,
    )
  ).direccion;
  await pedir('PATCH', `/datos/mis-direcciones/${casa.id}`, { tipoLugar: 'casa' }, cli.token);
  await subirFoto(
    `/datos/mis-direcciones/${casa.id}/fotos/1`,
    cli.token,
    join(FOTOS, `puerta-casa-frente-${idioma}.jpg`),
  );
  await subirFoto(
    `/datos/mis-direcciones/${casa.id}/fotos/1?tam=mini`,
    cli.token,
    join(FOTOS, `puerta-casa-frente-${idioma}.jpg`),
  ).catch(() => null);

  // ───────── 07 y 06: la lista de direcciones y la casilla con la foto guardada
  if (quiero('06') || quiero('07')) {
    const ctx = await telefono(cli.token, cli.id, CASA);
    const p = await ctx.newPage();
    await p.goto('/app');
    await p.getByTestId('inicio-direccion').click({ timeout: 60_000 });
    await p.getByTestId(`direccion-con-foto-${casa.id}`).waitFor({ timeout: 20_000 });
    await espera(800);
    if (quiero('07')) await captura(p, '07', 'direccion-guardada-con-fotos');
    if (quiero('06')) {
      await p.getByTestId(`direccion-menu-${casa.id}`).click();
      await p.getByTestId(`direccion-fotos-${casa.id}`).click({ timeout: 10_000 });
      const guardada = p.getByTestId('fotos-puerta-guardada-1');
      await guardada.waitFor({ timeout: 20_000 });
      // La casilla entera (título, foto y marca de guardada) a la vista: se baja con la rueda hasta
      // que la marca de guardada quede por encima del botón fijo de abajo.
      await p.mouse.move(195, 420);
      for (let i = 0; i < 12; i++) {
        const caja = await guardada.boundingBox();
        if (caja && caja.y + caja.height < 640) break;
        await p.mouse.wheel(0, 160);
        await espera(250);
      }
      await espera(1_200);
      await captura(p, '06', 'frente-de-la-casa-guardada');
    }
    await ctx.close();
  }

  // ───────── 08, 09 y 10: un pedido de comida a esa casa
  if (quiero('08') || quiero('09') || quiero('10')) {
    const dueno = await cuenta('restaurante', T.restaurante);
    const resto = (me, r, c) => pedir(me, r, c, dueno.token);
    const rest = (
      await resto('PUT', '/datos/mi-restaurante', {
        nombre: T.restaurante,
        categoria: 'Pizza',
        telefono: '5550100142',
        direccion: T.local,
        ...LOCAL,
      })
    ).restaurante;
    const plato = (
      await resto('POST', '/datos/mi-restaurante/platos', {
        nombreEs: T.plato[0],
        nombreEn: T.plato[1],
        precioCentavos: 1450,
      })
    ).plato;
    await resto('PUT', '/datos/mi-restaurante/horarios', {
      turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
    });
    await sql(
      `UPDATE restaurantes SET estado = 'aprobado', zona_id = '${ZONA}' WHERE id = '${rest.id}'`,
    );
    await resto('PATCH', '/datos/mi-restaurante/abierto', { abierto: true });
    const yo = (me, r, c) => pedir(me, r, c, taxista.token);
    await yo('POST', '/datos/repartidor/conectar', { conectado: true, ...LOCAL });
    await ubicar(taxista.id, LOCAL);
    const pedidoId = (
      await pedir(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: rest.id,
          lineas: [{ platoId: plato.id, cantidad: 2 }],
          propinaCentavos: 400,
          entrega: 'puerta',
          direccion: T.casa,
          notas: T.mensaje,
          ...CASA,
        },
        cli.token,
      )
    ).pedidoId;
    await sql(
      `UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now') WHERE id = '${pedidoId}'`,
    );
    await resto('POST', `/datos/restaurante/pedidos/${pedidoId}/aceptar`, { minutos: 5 });
    for (let i = 0; ; i++) {
      await ubicar(taxista.id, LOCAL);
      const ofertas = (await yo('GET', '/datos/repartidor/ofertas')).ofertas ?? [];
      if (ofertas.some((o) => o.id === pedidoId)) break;
      if (i > 20) throw new Error('la oferta del pedido no le llegó al repartidor');
      await espera(3_000);
    }
    await yo('POST', `/datos/repartidor/ofertas/${pedidoId}/aceptar`, {});
    await resto('POST', `/datos/restaurante/pedidos/${pedidoId}/listo`, {});
    await fetch(
      `${URL}/datos/repartidor/pedidos/${pedidoId}/foto-recogida?lat=${LOCAL.lat}&lng=${LOCAL.lng}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${taxista.token}`, 'content-type': 'image/jpeg' },
        body: readFileSync(join(FOTOS, 'bolsa-recogida.jpg')),
      },
    );
    await resto('POST', `/datos/restaurante/pedidos/${pedidoId}/confirmar-recogida`, {});
    await ubicar(taxista.id, CERCA);
    await yo('POST', '/datos/repartidor/ubicacion', { ...CERCA, precision: 8 }).catch(() => null);

    if (quiero('08')) {
      const ctx = await telefono(cli.token, cli.id, CASA);
      const p = await ctx.newPage();
      await p.goto(`/app/order/${pedidoId}`);
      // El aviso de activar las notificaciones no es parte de esta pantalla: «Ahora no».
      await p
        .getByText(idioma === 'en' ? 'Not now' : 'Ahora no', { exact: true })
        .first()
        .click({ timeout: 8_000 })
        .catch(() => null);
      await mapaListo(p);
      await espera(1_500);
      await captura(p, '08', 'pedido-en-camino');
      await ctx.close();
    }
    if (quiero('09')) {
      const ctx = await telefono(taxista.token, taxista.id, CERCA);
      const d = await ctx.newPage();
      await d.goto('/driver/');
      await d.getByTestId('puerta-miniatura').waitFor({ timeout: 60_000 });
      await mapaListo(d);
      await d.getByTestId('puerta-miniatura').click();
      await d.getByTestId('puerta-foto-1').locator('img').first().waitFor({ timeout: 20_000 });
      await espera(1_200);
      await captura(d, '09', 'driver-entrega-con-la-foto');
      await ctx.close();
    }
    // Entregado: Driver ya no tiene la foto.
    await ubicar(taxista.id, CASA);
    await yo('POST', '/datos/repartidor/ubicacion', { ...CASA, precision: 8 }).catch(() => null);
    await sql(
      `INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito) VALUES ('${pedidoId}', 'llego_cliente')`,
    );
    const entrega = await fetch(
      `${URL}/datos/repartidor/pedidos/${pedidoId}/entregado?lat=${CASA.lat}&lng=${CASA.lng}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${taxista.token}`, 'content-type': 'image/jpeg' },
        body: readFileSync(join(FOTOS, 'bolsa-entrega.jpg')),
      },
    );
    if (!entrega.ok) throw new Error(`entregar: ${entrega.status} ${await entrega.text()}`);
    const despues = await llamar(
      'GET',
      `/datos/repartidor/pedidos/${pedidoId}/puerta/1`,
      undefined,
      taxista.token,
    );
    if (despues.status !== 404)
      throw new Error(`entregado y la foto sigue respondiendo ${despues.status}`);
    if (quiero('10')) {
      const ctx = await telefono(taxista.token, taxista.id, CASA);
      const d = await ctx.newPage();
      await d.goto('/driver/');
      await mapaListo(d);
      await espera(2_000);
      if ((await d.getByTestId('puerta-miniatura').count()) !== 0)
        throw new Error('entregado y Driver todavía dibuja la miniatura');
      await captura(d, '10', 'driver-entregado-sin-la-foto');
      await ctx.close();
    }
    await yo('POST', '/datos/repartidor/conectar', { conectado: false }).catch(() => null);
  }

  // ───────── 11, 12 y 13: un viaje pedido desde la casa (mototaxi y taxi en carro)
  const viaje = async (servicio, conductor, numeros) => {
    if (!numeros.some(quiero)) return;
    await ubicar(conductor.id, CERCA);
    const cot = (
      await pedir(
        'POST',
        '/datos/viajes/cotizar',
        {
          servicio,
          origen: { ...CASA, direccion: T.casa },
          destino: { ...DESTINO, direccion: T.destino },
        },
        cli.token,
      )
    ).cotizacion;
    if (!cot.recogida?.guardada || !cot.recogida?.conFotos)
      throw new Error(
        `la cotización no reconoció la casa guardada: ${JSON.stringify(cot.recogida)}`,
      );
    const id = (
      await pedir(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'efectivo' },
        cli.token,
      )
    ).viaje.id;
    // El despacho se mueve con la consulta del pasajero; el conductor acepta en cuanto tiene la oferta.
    for (let i = 0; ; i++) {
      await ubicar(conductor.id, CERCA);
      await pedir('GET', '/datos/viajes/actual', undefined, cli.token);
      const aceptado = await paso(conductor.token, id, 'aceptar').then(
        () => true,
        () => false,
      );
      if (aceptado) break;
      if (i > 20) throw new Error(`el conductor no pudo aceptar el viaje de ${servicio}`);
      await espera(1_500);
    }
    const ctx = await telefono(conductor.token, conductor.id, CERCA);
    const d = await ctx.newPage();
    await d.goto('/driver/');
    await d.getByTestId('recogida-foto').waitFor({ timeout: 60_000 });
    await d.getByTestId('recogida-foto').locator('img').first().waitFor({ timeout: 20_000 });
    await mapaListo(d);
    await espera(800);
    await captura(d, numeros[0], `driver-${servicio}-va-a-recoger-con-la-foto`);
    await ubicar(conductor.id, CASA);
    await pedir(
      'POST',
      '/datos/repartidor/ubicacion',
      { ...CASA, precision: 8 },
      conductor.token,
    ).catch(() => null);
    await paso(conductor.token, id, 'llegue');
    await paso(conductor.token, id, 'iniciar');
    const despues = await llamar(
      'GET',
      `/datos/conductor/operaciones/${id}/recogida/1`,
      undefined,
      conductor.token,
    );
    if (despues.status !== 404)
      throw new Error(`recogido y la foto sigue respondiendo ${despues.status}`);
    if (numeros[1] && quiero(numeros[1])) {
      await d.reload();
      await d.getByTestId('viaje-activo').waitFor({ timeout: 60_000 });
      await mapaListo(d);
      if ((await d.getByTestId('recogida-foto').count()) !== 0)
        throw new Error('pasajero recogido y Driver todavía dibuja la foto');
      await captura(d, numeros[1], `driver-${servicio}-recogido-sin-la-foto`);
    }
    await ctx.close();
    await ubicar(conductor.id, DESTINO);
    await paso(conductor.token, id, 'terminar').catch((e) =>
      console.warn(`terminar ${servicio}: ${e.message}`),
    );
    await sql(`DELETE FROM conductor_ocupacion WHERE conductor_id = '${conductor.id}'`);
    await sql(
      `UPDATE operaciones SET estado_general = 'terminada' WHERE id = '${id}' AND estado_general IN ('asignada', 'en_curso')`,
    ).catch(() => null);
  };
  await viaje('moto', moto, ['11', '12']);
  await viaje('carro', taxista, ['13']);
}

try {
  for (let i = 0; ; i++) {
    // Basta con que conteste: con mototaxi y taxi encendidos fuera del sitio de pruebas, la salud
    // del servidor local se queja a propósito (C-MOTO-SOLO-PRUEBAS) y eso aquí no importa.
    const ok = await fetch(`${URL}/datos/salud`)
      .then(() => true)
      .catch(() => false);
    if (ok) break;
    if (i > 90) throw new Error('el servidor local no encendió');
    await espera(2_000);
  }
  navegador = await chromium.launch();
  const SOLO_IDIOMA = process.env.SOLO_IDIOMA;
  if (SOLO_IDIOMA !== 'en') await pasada('es');
  if (SOLO_IDIOMA !== 'es') await pasada('en');
  cpSync(ENTREGA, EN_REPO, { recursive: true });
  execFileSync('ls', [ENTREGA], { stdio: 'inherit' });
} finally {
  await navegador?.close();
  apagar();
}
console.log(
  'capturas del video listas en Documentos → Entregas → Divoox → video-fotos-de-la-entrada → pantallas',
);
