// Capturas REALES de Divoox Moto en Venezuela para Docs (C-MOTO-VE-CAPTURAS, 13 nov 2026). Venezuela.
// Desde el 13 nov 2026 se toman en El Vigía, estado Mérida (zona VE-MER-ELVIGIA), no en Caracas, con
// una tarifa que no es de prueba (sin la etiqueta «Precio de prueba» en Docs públicos), y también
// las de seguridad: contactos de confianza, «¿Todo bien?», compartir y emergencia, y el descanso.
// Contra el servidor local del recorrido (.recorrido, armado con scripts/recorrido/preparar.mjs y
// encendido en el puerto 8790), con las apps web reales del cliente y del Driver y el panel:
//   1. corre el guion de punta a punta (probar-moto-venezuela.mjs): conductor aprobado con saldo;
//   2. el equipo escribe una tasa de referencia;
//   3. toma las pantallas en español e inglés, con datos neutros («Conductor de prueba»).
// Guarda las originales en docs/capturas/recorrido/moto-ve-*-es.png.
// C-CAPTURAS-POR-IDIOMA (15 nov 2026, EE. UU. y Venezuela): cada idioma con SUS ejemplos. El español se
// toma en El Vigía (dólares con bolívares, efectivo y pago móvil, saldo para comisiones). El inglés se
// toma en Novi, Michigan (dólares, efectivo o tarjeta, sin nada de Venezuela) y se guarda como
// docs/capturas/recorrido/moto-us-*-en.png. `SOLO_IDIOMA=en` o `es` corre una sola pasada.
// Uso: node scripts/recorrido/capturas-moto-venezuela.mjs
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { deslizar } from './deslizar.mjs';
import { abrirAlta, abrirDocumentos } from './altaDriver.mjs';
import { ciudadNeutra, mapaSinRotulos } from './neutro.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const LUGARES = {
  ve: {
    pais: 'VE',
    prefijo: 've',
    pagoMovil: true,
    zona: 'VE-MER-ELVIGIA',
    origen: { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Central' },
    destino: { lat: 8.6105, lng: -71.6672, direccion: 'Avenida Principal 12' },
    contacto: { nombre: 'Contacto de confianza', telefono: '+58 414 000 0000' },
  },
  us: {
    pais: 'US',
    prefijo: 'us',
    pagoMovil: false,
    zona: 'US-MI-NOVI',
    ciudad: {
      id: 'US-MI-NOVI',
      nombre: 'Novi',
      lat: 42.4806,
      lng: -83.4755,
      radioKm: 15,
      zonaHoraria: 'America/Detroit',
    },
    origen: { lat: 42.4915, lng: -83.4706, direccion: 'Central Plaza' },
    destino: { lat: 42.4712, lng: -83.4745, direccion: '12 Main Avenue' },
    contacto: { nombre: 'Alex M.', telefono: '+1 555 010 0134' },
    // Tarifa de este servidor local para las fotos (centavos de dólar).
    tarifa: {
      base: 200,
      porKm: 90,
      porMinuto: 20,
      minimo: 500,
      esperaGratisS: 300,
      porMinutoEspera: 20,
      cancelacionGratisS: 120,
      cargoCancelacion: 200,
      cargoNoSePresento: 300,
    },
  },
};

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}, intento = 1) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      // Servidor local: cada llamada desde otra dirección, para no chocar con el límite de intentos.
      'cf-connecting-ip': `10.77.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 429 && intento < 4) {
    await new Promise((x) => setTimeout(x, 15_000));
    return pedir(metodo, ruta, cuerpo, token, extra, intento + 1);
  }
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
const sesion = async (id) => {
  const token = randomBytes(24).toString('hex');
  await sql(
    `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(token).digest('hex')}', '${id}', datetime('now', '+90 minutes'))`,
  );
  return token;
};

/** Venezuela: el guion de punta a punta deja al conductor aprobado y con saldo en El Vigía. */
async function cuentasVe(M) {
  const IDS = { cliente: 'zz-mtve-c', conductor: 'zz-mtve-k', equipo: 'zz-mtve-a' };
  // Si una vuelta anterior se cortó en la captura del descanso, sus horas al volante se deshacen.
  await sql(
    `UPDATE viajes SET asignado_en = datetime('now', '-15 minutes') WHERE asignado_en < datetime('now', '-12 hours') AND operacion_id IN (SELECT id FROM operaciones WHERE conductor_id = '${IDS.conductor}')`,
  ).catch(() => null);
  execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
    cwd: RAIZ,
    env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO, CIUDAD_VE: 'el-vigia' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  // Pases de sesión para las cuentas fijas (el guion borró los suyos al terminar).
  const tokens = {
    cliente: await sesion(IDS.cliente),
    conductor: await sesion(IDS.conductor),
    equipo: await sesion(IDS.equipo),
  };
  await pedir('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 240 }, tokens.equipo);
  // Solo en este servidor local: la tarifa de la ciudad pasa a «no de prueba» para que la captura
  // pública no diga «Precio de prueba (sitio de pruebas)». En el sitio de pruebas sigue siendo de prueba.
  await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${M.zona}' AND activa = 1`);
  return { IDS, tokens };
}

/**
 * Estados Unidos (Novi, Michigan): las cuentas de prueba de Estados Unidos del guion de Carro, con
 * nombres en inglés, y el conductor con su moto aprobada. El paso del panel no abre el país sin la
 * orden legal: en este servidor local la ciudad, la tarifa y el alta se arman directo.
 */
async function cuentasUs(M) {
  const a = await interno('carro/armar');
  const IDS = { cliente: a.ids.cliente, conductor: a.ids.conductorUs, equipo: a.ids.equipo };
  const tokens = {
    cliente: await sesion(IDS.cliente),
    conductor: await sesion(IDS.conductor),
    equipo: await sesion(IDS.equipo),
  };
  await sql(`UPDATE usuarios SET nombre = 'Sam C.' WHERE id = '${IDS.conductor}'`);
  await sql(`UPDATE usuarios SET nombre = 'Jamie L.' WHERE id = '${IDS.cliente}'`);
  await sql(
    `UPDATE viajes SET asignado_en = datetime('now', '-15 minutes') WHERE asignado_en < datetime('now', '-12 hours') AND operacion_id IN (SELECT id FROM operaciones WHERE conductor_id = '${IDS.conductor}')`,
  ).catch(() => null);
  const C = M.ciudad;
  await sql(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${C.id}', '${C.nombre}', 'US', 'USD', '${C.zonaHoraria}', ${C.lat}, ${C.lng}, ${C.radioKm}, 1)`,
  );
  await sql(
    `INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('moto', 1)`,
  ).catch(() => null);
  await sql("UPDATE servicios SET estado = 'disponible' WHERE id = 'moto'");
  await sql(
    `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto', '${C.id}', 'disponible')
     ON CONFLICT DO UPDATE SET estado = 'disponible'`,
  );
  await pedir(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'moto',
      zona: C.id,
      tarifa: M.tarifa,
      dePrueba: false,
      motivo: 'Tarifa de las capturas de Moto (servidor local)',
    },
    tokens.equipo,
  );
  await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${C.id}' AND activa = 1`);
  // Un viaje colgado de una vuelta anterior se cierra antes de tocar al conductor.
  const colgado = (await pedir('GET', '/datos/viajes/actual', undefined, tokens.cliente)).viaje;
  if (colgado) {
    const k = { 'idempotency-key': `capturas-moto-us-${Date.now().toString(36)}` };
    if (colgado.estado === 'en_curso')
      await pedir(
        'POST',
        `/datos/conductor/operaciones/${colgado.id}/terminar`,
        {},
        tokens.conductor,
        k,
      );
    else await pedir('POST', `/datos/viajes/${colgado.id}/cancelar`, {}, tokens.cliente, k);
  }
  // El conductor queda en la ciudad con su ficha, acepta los términos y su foto de control queda
  // como recién tomada (no es parte de estas capturas).
  await interno('carro/conductor', { quien: 'us', zonaId: C.id, ...M.origen });
  await pedir(
    'POST',
    '/datos/repartidor/terminos',
    { version: a.versionTerminos },
    tokens.conductor,
  );
  await sql(
    `DELETE FROM selfies_control WHERE usuario_id = '${IDS.conductor}' AND tomada_en IS NULL`,
  );
  await sql(
    `INSERT OR REPLACE INTO selfies_control (id, usuario_id, tomada_en, resultado)
     VALUES ('capturas-moto-US', '${IDS.conductor}', datetime('now'), 'ok')`,
  );
  // Su moto aprobada con sus papeles, su identidad verificada y los requisitos de Moto cumplidos.
  const veh = 'zz-moto-v-us';
  await sql(
    `INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
     VALUES ('${veh}', '${IDS.conductor}', 'moto', 'Honda', 'PCX', 'Gray', 'MC4821', 'MI', 2023, 1, 'aprobado')
     ON CONFLICT(id) DO UPDATE SET estado = 'aprobado', color = 'Gray'`,
  );
  for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente', 'foto_placa'])
    await sql(
      `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en)
       VALUES ('zz-moto-us-${t}', '${veh}', '${t}', 'zz', 'aprobado', datetime('now', '+1 year'))
       ON CONFLICT(id) DO UPDATE SET estado = 'aprobado', vence_en = excluded.vence_en`,
    );
  await sql(
    `INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en, revisado_por)
     VALUES ('${IDS.conductor}', 'aprobado', 'identificacion', 'zz', 'zz', datetime('now'), datetime('now'), '${IDS.equipo}')
     ON CONFLICT(usuario_id) DO UPDATE SET estado = 'aprobado', revisado_en = datetime('now'), revisado_por = excluded.revisado_por`,
  );
  // Sus antecedentes ya pasaron por el proveedor (en «Documentos» se ve «Approved»).
  await sql(
    `INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, antecedentes) VALUES ('${IDS.conductor}', 'moto', 'aprobado')
     ON CONFLICT(usuario_id) DO UPDATE SET antecedentes = 'aprobado'`,
  );
  for (const [req, v, fuente] of [
    ['identidad', '', 'kyc'],
    ['antecedentes_pasajeros', '', 'checkr'],
    ['historial_manejo', '', 'checkr'],
    ['licencia_moto', '', 'checkr'],
    ['edad_minima_21', '', 'sistema'],
    ['seguro_pasajeros', veh, 'sistema'],
    ['casco_pasajero', veh, 'sistema'],
  ])
    await sql(
      `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, vence_en, aprobado_por)
       VALUES ('${IDS.conductor}', '${v}', '${req}', 'aprobado', '${fuente}', datetime('now', '+1 year'), '${IDS.equipo}')
       ON CONFLICT(conductor_id, vehiculo_id, requisito) DO UPDATE SET estado = 'aprobado', vence_en = excluded.vence_en`,
    );
  await sql(
    `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en)
     VALUES ('${IDS.conductor}', 'moto', 'aprobada', '${IDS.equipo}', datetime('now'))
     ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET estado = 'aprobada'`,
  );
  await sql(
    `UPDATE repartidores SET vehiculo_activo_id = '${veh}' WHERE usuario_id = '${IDS.conductor}'`,
  );
  await pedir(
    'PUT',
    '/datos/conductor/preferencias',
    { servicioId: 'carro', activa: false },
    tokens.conductor,
  ).catch(() => null);
  return { IDS, tokens };
}

// C-DOCS-SIN-DATOS-REALES: el mapa sin rótulos y la ciudad con nombre de ejemplo.
const navegador = mapaSinRotulos(await chromium.launch());
let n = 0;
let restaurarCiudad = async () => {};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Todas las capturas de Moto de un país, en los idiomas que le tocan. */
async function correr(M, idiomas) {
  const { IDS, tokens } = await (M.pais === 'VE' ? cuentasVe(M) : cuentasUs(M));
  const ORIGEN = M.origen;
  const DESTINO = M.destino;
  restaurarCiudad = await ciudadNeutra(sql, M.zona, idiomas[0]);
  const conductor = (m, r, c) => pedir(m, r, c, tokens.conductor);
  const pasajero = (m, r, c) => pedir(m, r, c, tokens.cliente);
  const paso = (op, nombre, cuerpo = {}) =>
    pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, tokens.conductor, {
      'idempotency-key': `capturas-${nombre}-${++n}-${Date.now().toString(36)}`,
    });
  const cerrarColgado = async () => {
    const v = (await pasajero('GET', '/datos/viajes/actual')).viaje;
    if (!v) return;
    if (v.estado === 'en_curso') await paso(v.id, 'terminar');
    else
      await pedir('POST', `/datos/viajes/${v.id}/cancelar`, {}, tokens.cliente, {
        'idempotency-key': `capturas-cancelar-${Date.now().toString(36)}`,
      });
  };
  // Un contacto de confianza neutro y «solo de noche», para la guía de seguridad.
  const seg = await pasajero('GET', '/datos/seguridad');
  if (!(seg.contactos ?? []).length)
    await pasajero('POST', '/datos/seguridad/contactos', M.contacto);
  await pasajero('PUT', '/datos/seguridad/compartir', { compartir: 'noche' });
  await conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true });

  const telefono = async (token, id, idioma) => {
    const ctx = await navegador.newContext({
      ...devices['Pixel 7'],
      baseURL: URL,
      locale: idioma === 'en' ? 'en-US' : 'es-VE',
      ...(M.pais === 'US' ? { timezoneId: 'America/Detroit' } : {}),
      geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
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
  const archivo = (nombre, idioma) => join(SALIDA, `moto-${M.prefijo}-${nombre}-v2-${idioma}.png`);
  const foto = (p, nombre, idioma) => p.screenshot({ path: archivo(nombre, idioma) });
  const viajeEnEfectivo = async () => {
    const cot = (
      await pasajero('POST', '/datos/viajes/cotizar', {
        servicio: 'moto',
        origen: ORIGEN,
        destino: DESTINO,
      })
    ).cotizacion;
    return (
      await pasajero('POST', '/datos/viajes', { cotizacionId: cot.id, metodoPago: 'efectivo' })
    ).viaje;
  };

  for (const idioma of idiomas) {
    const en = idioma === 'en';
    await cerrarColgado();
    await conductor('POST', '/datos/repartidor/conectar', { conectado: false });

    // ───────── Driver: Divoox Moto (ciudad, moto, papeles, estado) y Ganancias
    const ctxD = await telefono(tokens.conductor, IDS.conductor, idioma);
    const d = await ctxD.newPage();
    await d.goto('/driver/');
    await abrirAlta(d, 'moto', en);
    await espera(1_200);
    await d.getByTestId('alta-moto').evaluate((x) => x.scrollIntoView({ block: 'start' }));
    await espera(800);
    await foto(d, 'driver-moto', idioma);
    if (M.pais === 'VE') {
      await d
        .getByText(en ? 'Your documents' : 'Tus papeles', { exact: true })
        .first()
        .evaluate((x) => x.scrollIntoView({ block: 'start' }));
    } else {
      // En Estados Unidos no hay papeles del conductor que subir: se ve el estado, ya aprobado.
      await d.getByTestId('estado-moto').evaluate((x) => {
        x.scrollIntoView({ block: 'end' });
        globalThis.scrollBy(0, 40);
      });
    }
    await espera(600);
    await foto(d, 'driver-moto-papeles', idioma);
    // La identidad verificada, en «Documentos» del mismo perfil.
    await abrirDocumentos(d, en);
    await espera(1_500);
    await d
      .getByText(en ? 'Documents' : 'Documentos', { exact: true })
      .first()
      .evaluate((x) => x.scrollIntoView({ block: 'start' }));
    await espera(600);
    await foto(d, 'driver-identidad', idioma);
    await d.getByRole('tab', { name: en ? 'Earnings' : 'Ganancias' }).click();
    if (M.pais === 'VE') {
      await d.getByTestId('saldo-prepago').waitFor({ timeout: 30_000 });
      await d.getByTestId('saldo-prepago').scrollIntoViewIfNeeded();
      await espera(800);
      await foto(d, 'driver-saldo', idioma);
    }

    // ───────── Cliente: pedir moto con el precio fijo y la forma de pago de su país
    await conductor('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN });
    await conductor('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng });
    await sql(
      `UPDATE repartidores SET conectado = 1, lat = ${ORIGEN.lat}, lng = ${ORIGEN.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${IDS.conductor}'`,
    );
    const ctxC = await telefono(tokens.cliente, IDS.cliente, idioma);
    await ctxC.addInitScript(
      ([u, b]) => localStorage.setItem(`tumbite.borrador.moto.${u}`, b),
      [
        IDS.cliente,
        JSON.stringify({
          recogida: ORIGEN.direccion,
          recogidaLat: String(ORIGEN.lat),
          recogidaLng: String(ORIGEN.lng),
          destino: DESTINO.direccion,
          destinoLat: String(DESTINO.lat),
          destinoLng: String(DESTINO.lng),
        }),
      ],
    );
    const c = await ctxC.newPage();
    await c.goto('/app/ride');
    // El mapa web arranca en la ciudad por defecto y aquí no hay buscador de direcciones (sin llave de
    // Google en local): el destino se deja escrito como lo guarda la app (su borrador) y se recorta el
    // aviso «Recuperamos lo que estabas escribiendo» de la imagen (lo de abajo es la pantalla real).
    // C-INICIO-NUEVO (borrador aprobado): ya no hay «Ver precio»; el precio sale solo con el destino.
    await c
      .getByTestId('moto-precio')
      .waitFor({ timeout: 30_000 })
      .catch(async (x) => {
        await c.screenshot({
          path: join(RAIZ, 'test-results', `moto-${M.prefijo}-sin-precio.png`),
          fullPage: true,
        });
        throw x;
      });
    if (M.pagoMovil) await c.getByTestId('moto-precio-bs').waitFor({ timeout: 10_000 });
    // La forma de pago de cada país: pago móvil en Venezuela; en Estados Unidos, efectivo (o tarjeta).
    await c
      .getByText(M.pagoMovil ? (en ? 'Mobile payment' : 'Pago móvil') : en ? 'Cash' : 'Efectivo', {
        exact: true,
      })
      .first()
      .click();
    await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
    await espera(600);
    // Coordenadas de página: desde «Punto de recogida» hasta el final de la tarjeta del precio.
    const caja = (l) =>
      l.evaluate((x) => {
        const r = x.getBoundingClientRect();
        return { y: r.top + globalThis.scrollY, fin: r.bottom + globalThis.scrollY };
      });
    const arriba = await caja(c.getByText(en ? 'Pick up at' : 'Recoger en').first());
    const precio = await caja(c.getByTestId('moto-precio'));
    const desde = arriba.y - 16;
    await c.screenshot({
      path: archivo('cliente-pedir', idioma),
      fullPage: true,
      clip: { x: 0, y: desde, width: c.viewportSize().width, height: precio.fin + 90 - desde },
    });
    // C-PUNTO-EXACTO: el punto en el mapa con el pin fijo, para la guía «El punto exacto» (antes se
    // tomaba a mano en el simulador, con una dirección de verdad; C-DOCS-SIN-DATOS-REALES).
    await c.getByTestId('moto-fijar-recogida').click();
    await c.getByTestId('punto-exacto').waitFor({ timeout: 20_000 });
    await c
      .getByTestId('punto-exacto-referencia')
      .fill(en ? 'Black gate' : 'Portón negro')
      .catch(() => null);
    await espera(3_000);
    await c.screenshot({
      path: join(RAIZ, 'docs', 'capturas', 'punto-exacto', `punto-exacto-pin-v2-${idioma}.png`),
    });
    await c.getByTestId('punto-exacto-volver').click();
    await c.getByTestId('moto-precio').waitFor({ timeout: 30_000 });
    // Seguridad del pasajero: los contactos de confianza, debajo de la pantalla de Moto.
    await c
      .getByText(en ? 'Trusted contacts' : 'Contactos de confianza', { exact: true })
      .first()
      .evaluate((x) => x.scrollIntoView({ block: 'start' }));
    await espera(600);
    await foto(c, 'cliente-contactos', idioma);
    await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
    await c
      .getByRole('button', { name: en ? /Request/ : /Pedir|Solicitar/ })
      .last()
      .click();
    await espera(2_500);
    const viaje = (await pasajero('GET', '/datos/viajes/actual')).viaje;
    if (!viaje) throw new Error('el pasajero no quedó con un viaje');

    // ───────── Driver: la oferta
    await d.getByRole('tab', { name: en ? 'Home' : 'Inicio' }).click();
    await d.reload();
    await d.getByTestId('oferta-viaje').waitFor({ timeout: 60_000 });
    await espera(800);
    await foto(d, 'driver-oferta', idioma);
    await paso(viaje.id, 'aceptar');
    await paso(viaje.id, 'llegue');
    const pin = (await pasajero('GET', `/datos/viajes/${viaje.id}`)).viaje.pin;
    await paso(viaje.id, 'iniciar', { pin });

    // ───────── Cliente: viaje en curso (en Venezuela, con los datos de pago móvil)
    await c.reload();
    if (M.pagoMovil) await c.getByTestId('viaje-pago-movil').waitFor({ timeout: 60_000 });
    else
      await c
        .getByText(en ? 'Share my ride' : 'Compartir mi viaje', { exact: true })
        .first()
        .waitFor({ timeout: 60_000 });
    // El mapa termina de cargar sus cuadros antes de la foto.
    await espera(M.pagoMovil ? 800 : 4_000);
    await foto(c, 'cliente-viaje', idioma);
    // Compartir y emergencia, al final del viaje en curso.
    await c
      .getByText(en ? 'Share my ride' : 'Compartir mi viaje', { exact: true })
      .first()
      .evaluate((x) => x.scrollIntoView({ block: 'center' }));
    await espera(600);
    await foto(c, 'cliente-compartir', idioma);
    // «¿Todo bien?»: el servidor la levanta cuando el viaje se sale de la ruta; aquí se simula la alerta.
    await sql(
      `INSERT OR IGNORE INTO alertas_viaje (id, operacion_id, tipo, lat, lng) VALUES ('zz-alerta-${viaje.id}', '${viaje.id}', 'desvio', ${ORIGEN.lat}, ${ORIGEN.lng})`,
    );
    await c.reload();
    await c
      .getByText(en ? 'Everything OK?' : '¿Todo bien?', { exact: true })
      .waitFor({ timeout: 60_000 });
    await espera(M.pagoMovil ? 800 : 4_000);
    await foto(c, 'cliente-todo-bien', idioma);
    await c.getByText(en ? 'I’m OK' : 'Estoy bien', { exact: true }).click();
    await espera(1_000);

    // ───────── Driver: viaje activo (en Venezuela, con «sí me llegó» el pago móvil) y el cobro
    await d.reload();
    if (M.pagoMovil) {
      await d.getByTestId('viaje-pago-movil').waitFor({ timeout: 60_000 });
      await d.getByTestId('viaje-pago-movil').scrollIntoViewIfNeeded();
    } else await d.getByTestId('viaje-terminar').waitFor({ timeout: 60_000 });
    await espera(800);
    await foto(d, M.pagoMovil ? 'driver-viaje-pago-movil' : 'driver-viaje', idioma);
    await d
      .getByText(en ? 'Emergency' : 'Emergencia', { exact: true })
      .last()
      .evaluate((x) => x.scrollIntoView({ block: 'center' }));
    await espera(600);
    await foto(d, 'driver-emergencia', idioma);
    if (M.pagoMovil) {
      await d.getByTestId('viaje-pago-movil').scrollIntoViewIfNeeded();
      await d.getByText(en ? 'Yes, it arrived' : 'Sí, me llegó', { exact: true }).click();
    }
    await deslizar(d, 'viaje-terminar');
    await d.getByTestId('viaje-cobra-efectivo').waitFor({ timeout: 30_000 });
    await espera(800);
    await foto(d, M.pagoMovil ? 'driver-cobro-pago-movil' : 'driver-cobro-efectivo', idioma);

    let ultimo = viaje.id;
    if (M.pagoMovil) {
      // ───────── Driver (Venezuela): otro viaje, en efectivo, y su cobro
      const v2 = await viajeEnEfectivo();
      await paso(v2.id, 'aceptar');
      await paso(v2.id, 'llegue');
      await paso(v2.id, 'iniciar', {
        pin: (await pasajero('GET', `/datos/viajes/${v2.id}`)).viaje.pin,
      });
      await d.reload();
      await deslizar(d, 'viaje-terminar');
      await d.getByTestId('viaje-cobra-efectivo').waitFor({ timeout: 30_000 });
      await espera(800);
      await foto(d, 'driver-cobro-efectivo', idioma);
      ultimo = v2.id;
    } else {
      // ───────── Pasajero (Estados Unidos): llegó, califica y ve cómo dejar propina
      await c.getByTestId('viaje-calificar').waitFor({ timeout: 60_000 });
      await c.getByTestId('estrella-5').click();
      await espera(600);
      await c.getByTestId('viaje-calificar').evaluate((x) => x.scrollIntoView({ block: 'start' }));
      await c.evaluate(() => globalThis.scrollBy(0, -160));
      await espera(600);
      await foto(c, 'cliente-propina', idioma);
    }

    // ───────── Driver: con 12 horas al volante, descansa (se simula alargando el viaje recién hecho)
    await sql(
      `UPDATE viajes SET asignado_en = datetime('now', '-13 hours'), terminado_en = datetime('now', '-5 minutes') WHERE operacion_id = '${ultimo}'`,
    );
    const v3 = await viajeEnEfectivo();
    await d.reload();
    await d.getByTestId('oferta-viaje').waitFor({ timeout: 60_000 });
    await d.getByText(en ? 'Accept ride' : 'Aceptar viaje', { exact: true }).click();
    await espera(1_500);
    await pedir('POST', `/datos/viajes/${v3.id}/cancelar`, {}, tokens.cliente, {
      'idempotency-key': `capturas-cancelar-descanso-${Date.now().toString(36)}`,
    });
    await d.getByTestId('oferta-viaje').waitFor({ state: 'detached', timeout: 30_000 });
    await d
      .getByText(en ? /been driving/ : /horas manejando/)
      .first()
      .waitFor({ timeout: 30_000 });
    await espera(600);
    await foto(d, 'driver-descanso', idioma);
    await sql(
      `UPDATE viajes SET asignado_en = datetime('now', '-15 minutes') WHERE operacion_id = '${ultimo}'`,
    );
    await ctxC.close();
    await ctxD.close();

    // ───────── Panel: Moto · Abrir y aprobar (interno, con la tasa de Venezuela: solo en esa pasada)
    if (M.pais !== 'VE') continue;
    const ruta = (await pedir('GET', '/datos/admin/ruta', undefined, tokens.equipo)).ruta;
    const ctxP = await navegador.newContext({
      viewport: { width: 1280, height: 1000 },
      baseURL: URL,
      locale: en ? 'en-US' : 'es-US',
    });
    await ctxP.addCookies([
      { name: 'tumbite_sesion', value: tokens.equipo, url: URL, httpOnly: true },
    ]);
    await ctxP.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctxP.newPage();
    await p.goto(`${en ? '' : '/es'}/panel/${ruta}/moto`);
    await p.getByTestId('super-moto').waitFor({ timeout: 60_000 });
    await p.getByTestId('tasa-referencia').waitFor({ timeout: 30_000 });
    await espera(1_000);
    await foto(p, 'panel', idioma);
    await p.getByTestId('tasa-referencia').scrollIntoViewIfNeeded();
    await espera(500);
    await foto(p, 'panel-tasa', idioma);
    await ctxP.close();
  }
  await conductor('POST', '/datos/repartidor/conectar', { conectado: false });
}

// Los servicios de pasajeros de Estados Unidos vuelven a quedar apagados en este servidor local: el
// país no está abierto y, encendidos, el canario de servicios se pone en rojo y frena la pasada de
// Venezuela (su guion de punta a punta exige la salud en verde).
const apagarPasajerosUs = async () => {
  await sql(
    "UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id IN ('moto', 'carro') AND zona_id IN (SELECT id FROM zonas WHERE pais = 'US')",
  ).catch(() => null);
  // Y el servicio que no quedó encendido en ninguna ciudad vuelve a «próximamente».
  await sql(
    "UPDATE servicios SET estado = 'proximamente' WHERE id IN ('moto', 'carro') AND NOT EXISTS (SELECT 1 FROM servicios_zona z WHERE z.servicio_id = servicios.id AND z.estado = 'disponible')",
  ).catch(() => null);
};
// Español en El Vigía; inglés en Novi, Michigan (C-CAPTURAS-POR-IDIOMA).
const SOLO = process.env.SOLO_IDIOMA;
try {
  if (SOLO !== 'en') await correr(LUGARES.ve, ['es']).finally(() => restaurarCiudad());
  if (SOLO !== 'es') await correr(LUGARES.us, ['en']).finally(() => restaurarCiudad());
} finally {
  await apagarPasajerosUs();
  await navegador.close();
}
console.log('capturas de Moto listas en docs/capturas/recorrido/moto-{ve,us}-*.png');
