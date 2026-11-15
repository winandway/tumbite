#!/usr/bin/env node
// Capturas ORIGINALES del mapa de Google en vivo (C-MAPA-GOOGLE-WEB, 14 nov 2026) — todos los países.
// La llave del navegador solo sirve en los dominios de Divoox: el mapa real no carga en local, así
// que esto corre contra el SITIO DE PRUEBAS, con las cuentas demo y Stripe en modo prueba
// (pm_card_visa con la clave pública de PRUEBA; si la clave no es de prueba, se detiene).
// Hace DOS pedidos de comida seguidos en Novi sin recargar la pantalla del conductor (el segundo
// comprueba que el mapa no queda en blanco), mira el seguimiento del cliente, el mapa del conductor
// y, si el conductor tiene una ruta Flex asignada (scripts/staging/armar-ruta-flex-novi.mjs), «Mi
// ruta». Guarda las capturas en docs/capturas/mapa-google/ y dice si la consola mostró un bloqueo de
// la política de contenido (CSP). Cada pedido abre mapas: gasta unas seis cargas de la cuota diaria.
// C-MAPA-DIA-NOCHE (14 nov 2026): TEMA=claro u oscuro fija el ajuste «Colores del mapa» de la persona
// (como si lo hubiera elegido en su cuenta) y las capturas llevan «dia-» o «noche-» delante; sin TEMA
// queda en automático. El modo «ajuste» abre la cuenta, captura el ajuste de tres posiciones, toca
// «Oscuro» y comprueba en un mapa que quedó de noche.
// Uso: CLAVE_DEMO=… [TEMA=claro|oscuro] node scripts/recorrido/capturas-mapa-google-vivo.mjs [comida|flex|elegir|ajuste]
/* global window, document -- las funciones que se pasan a la página corren en el navegador */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = (process.env.URL_PRUEBAS ?? 'https://staging.tumbite.com').replace(/\/$/, '');
if (!/^https:\/\/staging\.tumbite\.com$/.test(BASE)) {
  console.error('PARADA: esto solo corre contra el sitio de pruebas.');
  process.exit(1);
}
const CLAVE = process.env.CLAVE_DEMO;
if (!CLAVE) {
  console.error('Falta CLAVE_DEMO (la clave de las cuentas demo del sitio de pruebas).');
  process.exit(2);
}
const QUE = process.argv[2] ?? 'comida';
// IDIOMA=en saca las capturas en inglés (con su sufijo); VUELTAS=1 hace un solo pedido.
const IDIOMA = process.env.IDIOMA === 'en' ? 'en' : 'es';
const SUFIJO = IDIOMA === 'en' ? '-en' : '';
const VUELTAS = process.env.VUELTAS === '1' ? [1] : [1, 2];
const TEMA = ['claro', 'oscuro'].includes(process.env.TEMA) ? process.env.TEMA : '';
const PREFIJO = TEMA === 'claro' ? 'dia-' : TEMA === 'oscuro' ? 'noche-' : '';
const CARPETA = 'docs/capturas/mapa-google';
mkdirSync(CARPETA, { recursive: true });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const FOTO = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

async function api(metodo, ruta, cuerpo, token, tipo) {
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': tipo ?? 'application/json',
      'x-idioma': 'es',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : tipo ? cuerpo : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? JSON.stringify(d)}`);
  return d;
}
const entrar = async (correo) =>
  (await api('POST', '/datos/cuentas/entrar', { correo, clave: CLAVE })).token;

const bloqueos = [];
async function abrir(navegador, token, donde, nombre) {
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: IDIOMA === 'en' ? 'en-US' : 'es-US',
    geolocation: { latitude: donde.lat, longitude: donde.lng, accuracy: 8 },
    permissions: ['geolocation'],
  });
  if (token)
    await ctx.addInitScript((t) => window.localStorage.setItem('tumbite.sesion', t), token);
  await ctx.addInitScript((i) => window.localStorage.setItem('tumbite.idioma', i), IDIOMA);
  if (TEMA)
    await ctx.addInitScript((t) => window.localStorage.setItem('divoox.mapa.tema', t), TEMA);
  const pagina = await ctx.newPage();
  pagina.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to|violates the following/i.test(t))
      bloqueos.push(`[${nombre}] ${t.slice(0, 400)}`);
  });
  return { ctx, pagina };
}
/** Espera el mapa de Google dibujado (con lienzo o teselas) y dice cómo quedó. */
async function mapaListo(pagina, ms = 25000) {
  // La app del conductor pide permisos la primera vez.
  const listo = pagina.getByText(/^(Estoy listo|I'm ready)$/);
  if (await listo.count()) await listo.first().click();
  await pagina.waitForSelector('.gm-style', { timeout: ms });
  await pagina.locator('.gm-style').first().scrollIntoViewIfNeeded();
  await esperar(4500);
  return pagina.evaluate(() => {
    const m = document.querySelector('.gm-style');
    const r = m.getBoundingClientRect();
    return {
      ancho: Math.round(r.width),
      alto: Math.round(r.height),
      lienzos: m.querySelectorAll('canvas').length,
      imagenes: m.querySelectorAll('img').length,
      marcas: document.querySelectorAll('gmp-advanced-marker').length,
      // C-MAPA-DIA-NOCHE y C-MAPA-ISOTIPO: con qué tema quedó y si el repartidor es el isotipo.
      tema: document.querySelector('[data-testid="mapa-google"]')?.getAttribute('data-tema'),
      isotipos: document.querySelectorAll('[data-marca="isotipo"]').length,
    };
  });
}
const foto = (pagina, nombre) =>
  pagina
    .screenshot({ path: `${CARPETA}/${PREFIJO}${nombre}${SUFIJO}.png` })
    .then(() => console.log(`  captura ${PREFIJO}${nombre}${SUFIJO}`));

// Con la tarjeta gráfica (Metal en Mac) para que Google dibuje el mapa vectorial e inclinado; con el
// dibujo por software cae al mapa plano de imágenes.
const navegador = await chromium.launch({
  channel: 'chromium',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'],
});
try {
  const tCliente = await entrar('demo.cliente@ejemplo.com');
  const tRepartidor = await entrar('demo.repartidor@ejemplo.com');

  if (QUE === 'elegir') {
    // El mapa de elegir punto abre donde está la persona (aquí, la ubicación simulada: Novi).
    const novi = { lat: 42.4806, lng: -83.4755 };
    const { pagina } = await abrir(navegador, tCliente, novi, 'elegir');
    await pagina.goto(`${BASE}/app/ride?servicio=carro`, { waitUntil: 'domcontentloaded' });
    await pagina
      .getByText(/Ver en el mapa|See on the map/)
      .first()
      .click();
    console.log('elegir punto:', JSON.stringify(await mapaListo(pagina)));
    await foto(pagina, 'elegir-punto-abre-donde-estas');
  }

  if (QUE === 'ajuste') {
    // El ajuste «Colores del mapa» de la cuenta del cliente y del conductor: se toca «Oscuro» y un
    // mapa abierto después sale de noche (se guardó en el navegador de la persona).
    const novi = { lat: 42.4806, lng: -83.4755 };
    const { pagina } = await abrir(navegador, tCliente, novi, 'ajuste');
    if (process.env.SOLO_CONDUCTOR !== '1') {
      await pagina.goto(`${BASE}/app/account`, { waitUntil: 'domcontentloaded' });
      const ajuste = pagina.getByTestId('ajuste-mapa');
      await ajuste.waitFor({ timeout: 20000 });
      await ajuste.scrollIntoViewIfNeeded();
      await foto(pagina, 'ajuste-cuenta-cliente-automatico');
      await pagina.getByTestId('ajuste-mapa-oscuro').click();
      await esperar(600);
      await foto(pagina, 'ajuste-cuenta-cliente-oscuro');
      const guardado = await pagina.evaluate(() => window.localStorage.getItem('divoox.mapa.tema'));
      console.log('ajuste guardado en el navegador:', guardado);
      await pagina.goto(`${BASE}/app/ride?servicio=carro`, { waitUntil: 'domcontentloaded' });
      await pagina
        .getByText(/Ver en el mapa|See on the map/)
        .first()
        .click();
      console.log('mapa después de elegir «Oscuro»:', JSON.stringify(await mapaListo(pagina)));
      await foto(pagina, 'ajuste-mapa-queda-de-noche');
    }
    const conductor = await abrir(navegador, tRepartidor, novi, 'ajuste-conductor');
    await conductor.pagina.goto(`${BASE}/driver/`, { waitUntil: 'domcontentloaded' });
    // La primera vez la app explica los permisos: se cierra antes de ir al perfil.
    const listo = conductor.pagina.getByText(/^(Estoy listo|I.m ready)$/).first();
    await listo.waitFor({ timeout: 8000 }).catch(() => {});
    if (await listo.count()) await listo.click();
    await esperar(1500);
    await conductor.pagina
      .getByText(/^(Perfil|Profile)$/)
      .last()
      .click();
    const ajusteConductor = conductor.pagina.getByTestId('ajuste-mapa');
    await ajusteConductor.waitFor({ timeout: 20000 });
    await ajusteConductor.scrollIntoViewIfNeeded();
    await foto(conductor.pagina, 'ajuste-cuenta-conductor');
  }

  if (QUE === 'flex') {
    const { pagina } = await abrir(navegador, tRepartidor, { lat: 42.5247, lng: -83.5363 }, 'flex');
    await pagina.goto(`${BASE}/driver/`, { waitUntil: 'domcontentloaded' });
    await esperar(3000);
    await foto(pagina, 'flex-inicio');
    const ruta = pagina.getByText(/Mi ruta|My route/).first();
    if (await ruta.count()) {
      await ruta.click();
      console.log('ruta Flex:', JSON.stringify(await mapaListo(pagina)));
      await foto(pagina, 'flex-mi-ruta');
    } else console.log('ruta Flex: el conductor no tiene ruta asignada; no se pudo mirar');
  }

  if (QUE === 'comida') {
    const tResto = await entrar('demo.restaurante.novi@ejemplo.com');
    const mio = await api('GET', '/datos/mi-restaurante', undefined, tResto);
    const r = mio.restaurante ?? mio;
    const plato = (mio.platos ?? r.platos ?? []).find((p) => p.disponible !== false);
    const local = { lat: Number(r.lat), lng: Number(r.lng) };
    // La casa, a poco más de un kilómetro al sur del local.
    const casa = { lat: local.lat - 0.011, lng: local.lng + 0.002 };
    await api('PATCH', '/datos/mi-restaurante/abierto', { abierto: true }, tResto);
    // El servidor descarta los saltos imposibles (más de 180 km/h): antes de mandar una lectura se
    // espera lo que tardaría en llegar ahí a unos 120 km/h desde la anterior.
    let ultima = { ...local, en: Date.now() - 60000 };
    const ubicar = async (p) => {
      const m = Math.hypot((p.lat - ultima.lat) * 111000, (p.lng - ultima.lng) * 82000);
      const falta = (m / 33) * 1000 - (Date.now() - ultima.en);
      if (falta > 0) await esperar(falta);
      ultima = { ...p, en: Date.now() };
      return api('POST', '/datos/repartidor/ubicacion', { ...p, precision: 8 }, tRepartidor);
    };
    // La llegada a la puerta la confirman varias lecturas precisas seguidas (C-GPS-SERIO).
    const enLaPuerta = async (p) => {
      for (let i = 0; i < 4; i++) {
        await ubicar({ lat: p.lat + i * 0.000004, lng: p.lng });
        await esperar(2500);
      }
    };
    const conectar = () =>
      api('POST', '/datos/repartidor/conectar', { conectado: true, ...local }, tRepartidor);
    await conectar().catch(async () => {
      // La cuenta demo debe la foto de control (dos poses): se sube una foto de prueba y se sigue.
      for (const pose of ['frente', 'giro'])
        await api(
          'POST',
          `/datos/kyc/selfie-control?pose=${pose}`,
          FOTO,
          tRepartidor,
          'image/jpeg',
        );
      await conectar();
    });
    await ubicar(local);

    // Un pedido que quedó a medias de una corrida anterior se termina antes de empezar.
    const terminar = async (id) => {
      await api('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, tResto).catch(() => {});
      await api(
        'POST',
        `/datos/repartidor/pedidos/${id}/foto-recogida?lat=${local.lat}&lng=${local.lng}`,
        FOTO,
        tRepartidor,
        'image/jpeg',
      ).catch(() => {});
      await api('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {}, tResto).catch(
        () => {},
      );
      await enLaPuerta(casa);
      await api(
        'POST',
        `/datos/repartidor/pedidos/${id}/entregado?lat=${casa.lat}&lng=${casa.lng}`,
        FOTO,
        tRepartidor,
        'image/jpeg',
      );
      await ubicar(local);
    };
    const previo = (await api('GET', '/datos/repartidor/estado', undefined, tRepartidor)).activo;
    if (previo?.id ?? previo?.pedidoId) await terminar(previo.id ?? previo.pedidoId);

    const cliente = await abrir(navegador, tCliente, casa, 'cliente');
    const conductor = await abrir(navegador, tRepartidor, local, 'conductor');
    await conductor.pagina.goto(`${BASE}/driver/`, { waitUntil: 'domcontentloaded' });

    for (const vuelta of VUELTAS) {
      console.log(`pedido ${vuelta}`);
      // El panel del local «pregunta por pedidos»: eso marca que tiene señal y puede recibir.
      await api('GET', '/datos/restaurante/pedidos', undefined, tResto);
      const pedido = await api(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: r.id,
          lineas: [{ platoId: plato.id, cantidad: 1 }],
          propinaCentavos: 0,
          direccion: '41000 W Ten Mile Rd, Novi, MI 48375',
          ...casa,
          metodoPago: 'tarjeta',
        },
        tCliente,
      );
      const id = pedido.pedidoId ?? pedido.id ?? pedido.pedido?.id;
      const pago = pedido.pago ?? pedido;
      if (!String(pago.clavePublica ?? '').startsWith('pk_test_'))
        throw new Error('PARADA: la clave pública de Stripe no es de PRUEBA.');
      const conf = await fetch(
        `https://api.stripe.com/v1/payment_intents/${String(pago.clientSecret).split('_secret_')[0]}/confirm`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            key: pago.clavePublica,
            client_secret: pago.clientSecret,
            payment_method: 'pm_card_visa',
            return_url: `${BASE}/app/`,
          }),
        },
      );
      const cj = await conf.json();
      if (!conf.ok) throw new Error(`Stripe (prueba): ${cj.error?.message ?? conf.status}`);
      // El aviso de Stripe lo deja pagado; el restaurante lo acepta y el repartidor toma la oferta.
      let aceptado = false;
      for (let i = 0; i < 25 && !aceptado; i++) {
        await esperar(3000);
        aceptado = await api(
          'POST',
          `/datos/restaurante/pedidos/${id}/aceptar`,
          { minutos: 5 },
          tResto,
        )
          .then(() => true)
          .catch(() => false);
      }
      if (!aceptado) throw new Error('el restaurante no pudo aceptar: el pago no llegó');
      let tomado = false;
      for (let i = 0; i < 25 && !tomado; i++) {
        await esperar(3000);
        tomado = await api('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, tRepartidor)
          .then(() => true)
          .catch(() => false);
      }
      if (!tomado) throw new Error('la oferta no le llegó al repartidor demo');

      await cliente.pagina.goto(`${BASE}/app/order/${id}`, { waitUntil: 'domcontentloaded' });
      console.log('  cliente:', JSON.stringify(await mapaListo(cliente.pagina)));
      await foto(cliente.pagina, `pedido${vuelta}-cliente-1-hacia-el-local`);
      console.log('  conductor:', JSON.stringify(await mapaListo(conductor.pagina)));
      await foto(conductor.pagina, `pedido${vuelta}-conductor-1-hacia-el-local`);

      await api('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, tResto);
      await api(
        'POST',
        `/datos/repartidor/pedidos/${id}/foto-recogida?lat=${local.lat}&lng=${local.lng}`,
        FOTO,
        tRepartidor,
        'image/jpeg',
      );
      await api('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {}, tResto);
      // A mitad de camino y después a unos 120 metros de la casa (el mapa se acerca solo).
      const tramos = [
        ['2-en-camino', 0.5],
        ['3-cerca-de-la-casa', 0.9],
      ];
      for (const [nombre, f] of tramos) {
        const p = {
          lat: local.lat + (casa.lat - local.lat) * f,
          lng: local.lng + (casa.lng - local.lng) * f,
        };
        await ubicar(p);
        await conductor.ctx.setGeolocation({ latitude: p.lat, longitude: p.lng, accuracy: 8 });
        await esperar(14000);
        console.log(`  ${nombre} cliente:`, JSON.stringify(await mapaListo(cliente.pagina)));
        await foto(cliente.pagina, `pedido${vuelta}-cliente-${nombre}`);
        console.log(`  ${nombre} conductor:`, JSON.stringify(await mapaListo(conductor.pagina)));
        await foto(conductor.pagina, `pedido${vuelta}-conductor-${nombre}`);
      }
      if (process.env.SIN_SENAL === '1') {
        // C-SEGUIMIENTO-HONESTO: sin lecturas por más de un minuto, la marca del repartidor se ve
        // apagada. La app del conductor abierta manda su ubicación: se cierra mientras tanto.
        await conductor.pagina.goto('about:blank');
        await esperar(80000);
        await foto(cliente.pagina, `pedido${vuelta}-cliente-5-sin-senal`);
        await conductor.pagina.goto(`${BASE}/driver/`, { waitUntil: 'domcontentloaded' });
        await esperar(4000);
      }
      // La app abierta también manda su ubicación: se pone en la casa para que no se intercale.
      await conductor.ctx.setGeolocation({ latitude: casa.lat, longitude: casa.lng, accuracy: 8 });
      await enLaPuerta(casa);
      await esperar(6000);
      await foto(cliente.pagina, `pedido${vuelta}-cliente-4-en-la-puerta`);
      await foto(conductor.pagina, `pedido${vuelta}-conductor-4-en-la-puerta`);
      await api(
        'POST',
        `/datos/repartidor/pedidos/${id}/entregado?lat=${casa.lat}&lng=${casa.lng}`,
        FOTO,
        tRepartidor,
        'image/jpeg',
      );
      await conductor.ctx.setGeolocation({
        latitude: local.lat,
        longitude: local.lng,
        accuracy: 8,
      });
      await ubicar(local);
      await esperar(8000);
    }
  }
} finally {
  await navegador.close();
}
console.log(
  bloqueos.length
    ? `BLOQUEOS DE CSP (${bloqueos.length}):\n${[...new Set(bloqueos)].join('\n')}`
    : 'consola: sin bloqueos de la política de contenido',
);
