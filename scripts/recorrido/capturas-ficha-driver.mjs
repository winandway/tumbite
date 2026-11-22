// Capturas REALES de Divoox Driver para su ficha de Google Play (22 nov 2026, pedido de Richard:
// «bien profesionales») — todos los países. Ocho pantallas por idioma, una idea por imagen, con el
// Driver web real (/driver, el mismo código de la app) contra el servidor LOCAL del recorrido.
// NO toca el sitio de pruebas ni producción. Datos neutros (C-DOCS-SIN-DATOS-REALES): ciudad de
// ejemplo, mapa sin rótulos, personas y placas inventadas, ninguna lista de ciudades.
//   → docs/tiendas/capturas-ficha-driver/originales/<es|en>/NN-nombre.png (las pantallas tal cual)
// Después: node scripts/marca/ficha-driver-google-play.mjs (marco de teléfono y titular).
// Antes: PUERTO_RECORRIDO=<puerto> node scripts/recorrido/preparar.mjs y el servidor encendido
//   (npx wrangler dev -c .recorrido/wrangler.jsonc --port <puerto> --persist-to .recorrido/estado).
// Uso: node scripts/recorrido/capturas-ficha-driver.mjs   (SOLO_IDIOMA=es|en, SOLO=01,05 para algunas)
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection, no-undef -- guion local: carpetas fijas del repositorio; `document` corre dentro del navegador */
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CIUDAD_NEUTRA, mapaSinRotulos } from './neutro.mjs';
import { SQL_TASA_EJEMPLO } from './tasaEjemplo.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SALIDA = join(RAIZ, 'docs', 'tiendas', 'capturas-ficha-driver', 'originales');
// El teléfono de la ficha: 400 × 752 puntos a 3× (1200 × 2256); entra entero en la pieza de 9:16.
const TELEFONO = { width: 400, height: 752 };
const SOLO = (process.env.SOLO ?? '').split(',').filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.91.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const interno = (ruta, cuerpo = {}) =>
  pedir('POST', `/datos/interno/diagnostico/${ruta}`, cuerpo, undefined, {
    'x-reloj-secreto': DATOS.relojSecreto,
  });
const sql = async (q) => (await interno('sql', { sql: q })).results ?? [];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (s) => String(s).replace(/'/g, "''");
const sesion = async (id) => {
  const token = randomBytes(24).toString('hex');
  await sql(
    `INSERT INTO sesiones (id, usuario_id, expira_en) VALUES ('${createHash('sha256').update(token).digest('hex')}', '${id}', datetime('now', '+90 minutes'))`,
  );
  return token;
};

// La ciudad de las fotos: la zona de pruebas del guion de Moto, con nombre de ejemplo mientras se
// toman. El saldo del conductor se ve en dólares en los dos idiomas (no hay moneda local a la vista).
const ZONA = 'VE-MER-ELVIGIA';
const TZ = 'America/Caracas';
const ORIGEN = { lat: 8.6219, lng: -71.6506 };
// La ciudad de la oferta: cobra solo en dólares. Puntos tierra adentro, sin costa reconocible.
const ZONA_USD = 'US-FL-MIAMI';
const ORIGEN_USD = { lat: 25.7652, lng: -80.3012 };
const DESTINO_USD = { lat: 25.7498, lng: -80.3301 };
// El conductor espera a unos 0,8 km de la recogida.
const CONDUCTOR_USD = { lat: 25.7722, lng: -80.2992 };
const VERSION_TERMINOS = /VERSION_TERMINOS = '([^']+)'/.exec(
  readFileSync(join(RAIZ, 'packages', 'compartido', 'src', 'terminos.ts'), 'utf8'),
)[1];
const IDS = { cliente: 'zz-mtve-c', conductor: 'zz-mtve-k', equipo: 'zz-mtve-a' };
const L = {
  es: {
    conductor: 'José Rojas',
    pasajero: 'Marta Díaz',
    nuevo: 'Carlos Vera',
    linea: 'Línea Ejemplo',
    miembros: ['Pedro Gil', 'Ana Silva', 'Luis Mora'],
    pendientes: ['Raúl Soto'],
    casa: 'Casa',
    recogida: 'Calle Las Flores 24',
    destino: 'Avenida Central 456',
    pregunta: '¿Cómo me uno a una línea?',
  },
  en: {
    conductor: 'Sam Carter',
    pasajero: 'Anna Davis',
    nuevo: 'Chris Young',
    linea: 'Example Line',
    miembros: ['Tom Clark', 'Emma Hill', 'Luke Moore'],
    pendientes: ['Dan Wright'],
    casa: 'Home',
    recogida: '24 Oak Street',
    destino: '456 Central Avenue',
    pregunta: 'How do I join a line?',
  },
};

function fotografo(idioma) {
  const dir = join(SALIDA, idioma);
  mkdirSync(dir, { recursive: true });
  return async (p, nombre) => {
    await espera(900);
    await p.screenshot({ path: join(dir, `${nombre}.png`) });
    console.log(`✓ ${idioma}/${nombre}.png`);
  };
}

/**
 * El enlace «¿Una empresa o un restaurante te invitó? Pega su enlace» no es de lo que habla la pieza
 * y distrae (revisión de Gerencia, 22 nov 2026): se deja invisible SIN mover nada de su sitio, que es
 * lo mismo que recortarlo. El resto de la pantalla queda tal cual.
 */
const sinEnlaceDeInvitacion = (p) =>
  p
    .getByText(/te invitó\? Pega su enlace|invite you\? Paste its link/)
    .first()
    .evaluate((x) => {
      x.style.visibility = 'hidden';
    })
    .catch(() => null);

const navegador = mapaSinRotulos(await chromium.launch());
let n = 0;

async function telefono(idioma, cuenta, donde = ORIGEN) {
  const ctx = await navegador.newContext({
    viewport: TELEFONO,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    baseURL: URL,
    locale: idioma === 'en' ? 'en-US' : 'es-US',
    timezoneId: TZ,
    geolocation: { latitude: donde.lat, longitude: donde.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, u, i]) => {
      localStorage.setItem('tumbite.idioma', i);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
    },
    [cuenta.token, cuenta.id, idioma],
  );
  return ctx;
}

async function preparar() {
  // El guion de punta a punta de Moto deja al conductor aprobado, con su moto y con saldo. Su
  // última comprobación (la salud del servidor local) no importa aquí.
  if (!process.env.SIN_ARMAR)
    try {
      execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
        cwd: RAIZ,
        env: {
          ...process.env,
          URL_PRUEBAS: URL,
          RELOJ_SECRETO: DATOS.relojSecreto,
          CIUDAD_VE: 'el-vigia',
        },
        stdio: 'ignore',
      });
    } catch {
      /* las cuentas ya quedaron armadas */
    }
  await sql(SQL_TASA_EJEMPLO);
  await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${ZONA}' AND activa = 1`);
  const tokens = { conductor: await sesion(IDS.conductor), cliente: await sesion(IDS.cliente) };
  await pedir(
    'POST',
    '/datos/conductor/aviso-ia',
    { acepto: true, plataforma: 'web', desde: 'aviso' },
    tokens.conductor,
  );
  return tokens;
}

async function correr(idioma, tokens) {
  const T = L[idioma];
  const en = idioma === 'en';
  const foto = fotografo(idioma);
  await sql(`UPDATE zonas SET nombre = '${CIUDAD_NEUTRA[idioma]}' WHERE id = '${ZONA}'`);
  await sql(
    `UPDATE usuarios SET nombre = '${T.conductor}', idioma = '${idioma}' WHERE id = '${IDS.conductor}'`,
  );
  await sql(
    `UPDATE usuarios SET nombre = '${T.pasajero}', idioma = '${idioma}' WHERE id = '${IDS.cliente}'`,
  );
  const conductor = (m, r, c) => pedir(m, r, c, tokens.conductor);
  const pasajero = (m, r, c) => pedir(m, r, c, tokens.cliente);
  const paso = (op, nombre, cuerpo = {}) =>
    pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, tokens.conductor, {
      'idempotency-key': `ficha-${nombre}-${++n}-${Date.now().toString(36)}`,
    });
  const cerrarColgado = async () => {
    const v = (await pasajero('GET', '/datos/viajes/actual')).viaje;
    if (!v) return;
    if (v.estado === 'en_curso') await paso(v.id, 'terminar');
    else
      await pedir('POST', `/datos/viajes/${v.id}/cancelar`, {}, tokens.cliente, {
        'idempotency-key': `ficha-cancelar-${Date.now().toString(36)}`,
      });
  };
  const conectar = async () => {
    await conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true });
    await conductor('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN });
    await sql(
      `UPDATE repartidores SET conectado = 1, lat = ${ORIGEN.lat}, lng = ${ORIGEN.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${IDS.conductor}'`,
    );
  };
  await sql(`DELETE FROM servicios_zona WHERE servicio_id = 'carro' AND zona_id = '${ZONA}'`);
  await sql(
    `DELETE FROM habilitaciones WHERE conductor_id = '${IDS.conductor}' AND servicio_id = 'carro'`,
  ).catch(() => null);
  await cerrarColgado();
  await conectar();
  const yo = { id: IDS.conductor, token: tokens.conductor };
  const ctx = await telefono(idioma, yo);
  const d = await ctx.newPage();
  const tab = (es, eng) => d.getByRole('tab', { name: en ? eng : es }).click({ timeout: 60_000 });
  await d.goto('/driver/');
  await d.getByTestId('estado-servicios').waitFor({ timeout: 90_000 });

  // 02 · Conéctate cuando quieras: el inicio, conectado y esperando viajes.
  if (toca('02')) {
    // «En línea» cuenta desde que la app lo vio conectado: el reloj de la página avanza 3 h 20 min,
    // como un conductor que lleva la tarde conectado (sus viajes de hoy ya están hechos).
    const ctxR = await telefono(idioma, yo);
    await ctxR.clock.install();
    const r = await ctxR.newPage();
    await r.goto('/driver/');
    await r.getByTestId('estado-servicios').waitFor({ timeout: 90_000 });
    await r.getByTestId('desconectarme').waitFor({ timeout: 30_000 });
    await ctxR.clock.fastForward('03:20:00');
    await r
      .getByTestId('resumen-dia')
      .getByText(/3h 2\dm/)
      .waitFor({ timeout: 20_000 });
    await sinEnlaceDeInvitacion(r);
    await foto(r, '02-conectado');
    await ctxR.close();
  }

  // 05 · Tu saldo claro: Ganancias, con el saldo y para cuántas carreras alcanza.
  if (toca('05')) {
    // Neutra de país: la tarjeta de «dónde te pagan» nombra el método de pago local de un país, así
    // que en esta foto la lista de esos métodos llega vacía y la app no la dibuja (como en un país
    // que no los usa). El saldo, lo apartado y para cuántas carreras alcanza son los de la cuenta.
    await ctx.route('**/datos/**', async (ruta) => {
      const r = await ruta.fetch();
      const cuerpo = await r.json().catch(() => null);
      if (cuerpo && Array.isArray(cuerpo.cuentasACelular))
        return ruta.fulfill({ response: r, json: { ...cuerpo, cuentasACelular: [] } });
      return ruta.fulfill({ response: r });
    });
    // Los viajes de ejemplo de hoy, cobrados en dólares: el total de hoy no nombra la moneda de un país.
    await sql(
      `UPDATE viajes SET ref_monto = NULL WHERE operacion_id IN (SELECT id FROM operaciones WHERE conductor_id = '${IDS.conductor}')`,
    );
    await d.reload();
    await tab('Ganancias', 'Earnings');
    await d.getByTestId('saldo-prepago').waitFor({ timeout: 30_000 });
    // «Ganancias» arriba (el enlace de invitaciones queda fuera) y el total de hoy entero abajo.
    await d
      .getByText(en ? 'Earnings' : 'Ganancias', { exact: true })
      .first()
      .evaluate((x) => x.scrollIntoView({ block: 'start' }));
    await foto(d, '05-saldo');
    await ctx.unroute('**/datos/**');
  }

  // 01 y 07 · La oferta con lo que ganas antes de aceptar, y la foto de la entrada del pasajero.
  // Con otra cuenta de ejemplo, en una ciudad que cobra solo en dólares: la oferta no muestra
  // moneda local de ningún país.
  if (toca('01') || toca('07')) {
    // Ningún conductor de una pasada anterior se queda con la oferta.
    await sql(`UPDATE repartidores SET conectado = 0 WHERE zona_id = '${ZONA_USD}'`);
    // …ni queda buscando conductor un viaje de una pasada que se cortó.
    for (const v of await sql(
      `SELECT id, cliente_id FROM operaciones WHERE zona_id = '${ZONA_USD}' AND estado_general = 'buscando'`,
    ))
      await pedir('POST', `/datos/viajes/${v.id}/cancelar`, {}, await sesion(v.cliente_id), {
        'idempotency-key': `ficha-limpiar-${v.id}`,
      }).catch(() => null);
    const m = await interno('moto/armar');
    const k = { id: m.ids.conductor, token: m.tokens.conductor };
    const c = { id: m.ids.cliente, token: m.tokens.cliente };
    await sql(`UPDATE zonas SET nombre = '${CIUDAD_NEUTRA[idioma]}' WHERE id = '${ZONA_USD}'`);
    await sql(
      `UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${ZONA_USD}' AND activa = 1`,
    );
    await sql(
      `UPDATE usuarios SET nombre = '${T.conductor}', idioma = '${idioma}' WHERE id = '${k.id}'`,
    );
    await sql(
      `UPDATE usuarios SET nombre = '${T.pasajero}', idioma = '${idioma}' WHERE id = '${c.id}'`,
    );
    await sql(
      `UPDATE vehiculos SET marca = 'Honda', modelo = 'PCX', color = '${en ? 'Gray' : 'Gris'}', placa = 'EJ${String(m.sufijo).slice(-4).toUpperCase()}' WHERE conductor_id = '${k.id}'`,
    );
    await sql(
      `UPDATE repartidores SET lat = ${CONDUCTOR_USD.lat}, lng = ${CONDUCTOR_USD.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${k.id}'`,
    );
    await pedir(
      'POST',
      '/datos/conductor/aviso-ia',
      { acepto: true, plataforma: 'web', desde: 'aviso' },
      k.token,
    );
    await pedir('POST', '/datos/repartidor/terminos', { version: VERSION_TERMINOS }, k.token);
    // La casa guardada del pasajero, con el DIBUJO de su entrada (nunca una casa real).
    const casa = (
      await pedir(
        'POST',
        '/datos/mis-direcciones',
        { etiqueta: T.casa, direccion: T.recogida, ...ORIGEN_USD },
        c.token,
      )
    ).direccion;
    const subida = await fetch(`${URL}/datos/mis-direcciones/${casa.id}/fotos/1`, {
      method: 'POST',
      headers: { authorization: `Bearer ${c.token}`, 'content-type': 'image/jpeg' },
      body: readFileSync(
        join(RAIZ, 'e2e', 'recorrido', 'fotos', `puerta-casa-frente-${idioma}.jpg`),
      ),
    });
    if (!subida.ok) throw new Error(`foto de la entrada: ${subida.status}`);
    const pedirViaje = async () => {
      const cot = (
        await pedir(
          'POST',
          '/datos/viajes/cotizar',
          {
            servicio: 'moto',
            origen: { ...ORIGEN_USD, direccion: T.recogida },
            destino: { ...DESTINO_USD, direccion: T.destino },
          },
          c.token,
        )
      ).cotizacion;
      return (
        await pedir(
          'POST',
          '/datos/viajes',
          { cotizacionId: cot.id, metodoPago: 'efectivo' },
          c.token,
        )
      ).viaje;
    };
    const ctxK = await telefono(idioma, k, CONDUCTOR_USD);
    const o = await ctxK.newPage();
    if (toca('01')) {
      const viaje = await pedirViaje();
      await o.goto('/driver/');
      await o.getByTestId('oferta-viaje').waitFor({ timeout: 90_000 });
      await foto(o, '01-oferta');
      await pedir('POST', `/datos/viajes/${viaje.id}/cancelar`, {}, c.token, {
        'idempotency-key': `ficha-cancelar-${viaje.id}`,
      });
    }
    if (toca('07')) {
      // Otro viaje, aceptado por la ruta normal en cuanto se le ofrece (la oferta dura segundos).
      const viaje = await pedirViaje();
      for (let i = 0; ; i++) {
        await sql(
          `UPDATE repartidores SET ubicacion_en = datetime('now') WHERE usuario_id = '${k.id}'`,
        );
        await pedir('GET', '/datos/viajes/actual', undefined, c.token);
        const ok = await pedir(
          'POST',
          `/datos/conductor/operaciones/${viaje.id}/aceptar`,
          {},
          k.token,
          { 'idempotency-key': `ficha-aceptar-${i}-${Date.now().toString(36)}` },
        ).then(
          () => true,
          () => false,
        );
        if (ok) break;
        if (i > 20) throw new Error('el conductor no pudo aceptar el viaje');
        await espera(1_500);
      }
      await o.goto('/driver/');
      await o.getByTestId('viaje-activo').waitFor({ timeout: 60_000 });
      await o.getByTestId('recogida-foto').waitFor({ timeout: 30_000 });
      await o.getByTestId('viaje-mapa').evaluate((x) => x.scrollIntoView({ block: 'start' }));
      // La pantalla del viaje, limpia: el mapa, la dirección y la tarjeta con la foto de la entrada.
      await o.getByTestId('viaje-mapa').evaluate((x) => x.scrollIntoView({ block: 'start' }));
      await foto(o, '07-foto-entrada');
    }
    await ctxK.close();
    await interno('moto/limpiar', { sufijo: m.sufijo }).catch(() => null);
  }

  // 03 · Moto o carro: «Mi vehículo» del perfil, con su moto en uso y la entrada para su carro.
  if (toca('03')) {
    await sql(`UPDATE servicios SET estado = 'disponible' WHERE id = 'carro'`);
    await sql(
      `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('carro', '${ZONA}', 'disponible') ON CONFLICT DO UPDATE SET estado = 'disponible'`,
    );
    await d.goto('/driver/');
    await tab('Perfil', 'Profile');
    const seccion = d.getByTestId('seccion-vehiculo').first();
    await seccion.waitFor({ timeout: 30_000 });
    if (
      !(await d
        .getByTestId('vehiculo-moto')
        .first()
        .isVisible()
        .catch(() => false))
    )
      await seccion.click();
    await d.getByTestId('vehiculo-moto').first().waitFor({ timeout: 15_000 });
    // «Mi perfil» arriba: el enlace de invitaciones queda fuera de la vista.
    await d
      .getByText(en ? 'My profile' : 'Mi perfil', { exact: true })
      .first()
      .evaluate((x) => {
        x.scrollIntoView({ block: 'start' });
        // …con aire arriba: la foto de perfil es más alta que el renglón del nombre.
        let caja = x.parentElement;
        while (caja && caja.scrollTop === 0) caja = caja.parentElement;
        if (caja) caja.scrollTop -= 60;
      });
    await sinEnlaceDeInvitacion(d);
    await foto(d, '03-moto-o-carro');
    // El inicio de las demás fotos no ofrece un servicio que esta cuenta de ejemplo no tiene.
    await sql(`DELETE FROM servicios_zona WHERE servicio_id = 'carro' AND zona_id = '${ZONA}'`);
  }

  // 06 · Tu línea y tu equipo: el líder con su código y sus conductores.
  if (toca('06')) {
    await sql(`DELETE FROM pedidos_linea WHERE equipo_id LIKE 'zz-ficha-%'`);
    await sql(`DELETE FROM miembros_equipo WHERE equipo_id LIKE 'zz-ficha-%'`);
    await sql(`DELETE FROM lineas WHERE equipo_id LIKE 'zz-ficha-%'`);
    await sql(`DELETE FROM equipos WHERE id LIKE 'zz-ficha-%'`);
    const linea = `zz-ficha-${idioma}-${Date.now().toString(36)}`;
    await sql(
      `INSERT INTO equipos (id, nombre, zona_id, lider_id, codigo, creado_por) VALUES ('${linea}', '${txt(T.linea)}', '${ZONA}', '${IDS.conductor}', 'EJEMPLO01', '${IDS.conductor}')`,
    );
    await sql(
      `INSERT INTO lineas (equipo_id, tipo, contacto2_nombre, contacto2_telefono, conductores_estimados, telefono_verificado_en)
       VALUES ('${linea}', 'mototaxi', '${T.miembros[0]}', '+15550100002', 24, datetime('now'))`,
    );
    const colega = async (nombre, k2) => {
      const r = await pedir('POST', '/datos/cuentas/registro', {
        nombre,
        correo: `ficha-${linea}-${k2}@recorrido.test`,
        clave: DATOS.clave,
        rol: 'repartidor',
        idioma,
      });
      await sql(`UPDATE usuarios SET zona_id = '${ZONA}' WHERE id = '${r.usuario.id}'`);
      await sql(
        `INSERT INTO repartidores (usuario_id, zona_id) VALUES ('${r.usuario.id}', '${ZONA}') ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`,
      );
      return r.usuario.id;
    };
    for (const [i, nombre] of T.miembros.entries()) {
      const id = await colega(nombre, i);
      await sql(`INSERT INTO miembros_equipo (usuario_id, equipo_id) VALUES ('${id}', '${linea}')`);
      await sql(
        `INSERT INTO pedidos_linea (usuario_id, equipo_id, estado, resuelto_en) VALUES ('${id}', '${linea}', 'aceptada', datetime('now'))`,
      );
    }
    for (const [i, nombre] of T.pendientes.entries()) {
      const id = await colega(nombre, 10 + i);
      await sql(
        `INSERT INTO pedidos_linea (usuario_id, equipo_id, estado) VALUES ('${id}', '${linea}', 'pendiente')`,
      );
    }
    await d.goto('/driver/');
    await d
      .getByLabel(en ? 'Profile' : 'Perfil')
      .first()
      .click({ timeout: 60_000 });
    await d
      .getByText(en ? 'My line' : 'Mi línea', { exact: true })
      .first()
      .click({ timeout: 30_000 });
    await d.getByTestId('linea-lider').waitFor({ timeout: 30_000 });
    await espera(1500);
    await foto(d, '06-linea');
  }

  // 04 · Registro guiado con fotos: el asistente de un conductor nuevo.
  if (toca('04') || toca('08')) {
    const r = await pedir('POST', '/datos/cuentas/registro', {
      nombre: T.nuevo,
      correo: `ficha-nuevo-${idioma}-${Date.now().toString(36)}@recorrido.test`,
      clave: DATOS.clave,
      rol: 'repartidor',
      idioma,
    });
    const nuevo = { id: r.usuario.id, token: r.token };
    await sql(
      `UPDATE usuarios SET zona_id = '${ZONA}', correo_verificado_en = datetime('now') WHERE id = '${nuevo.id}'`,
    ).catch(() => sql(`UPDATE usuarios SET zona_id = '${ZONA}' WHERE id = '${nuevo.id}'`));
    await sql(
      `INSERT INTO repartidores (usuario_id, zona_id) VALUES ('${nuevo.id}', '${ZONA}') ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`,
    );
    await pedir(
      'POST',
      '/datos/conductor/aviso-ia',
      { acepto: true, plataforma: 'web', desde: 'aviso' },
      nuevo.token,
    );
    const ctxN = await telefono(idioma, nuevo);
    const q = await ctxN.newPage();
    await q.goto('/driver/');
    await espera(8000);
    await q
      .getByText(en ? 'Take my photo' : 'Tomar mi foto')
      .first()
      .click();
    await q.getByTestId('asistente-papeles').waitFor({ timeout: 30_000 });
    await espera(2500);
    if (toca('04')) await foto(q, '04-registro-guiado');

    // 08 · Camila te ayuda: el chat de ayuda con su respuesta (cuenta nueva: sin mensajes viejos).
    if (toca('08')) {
      await q.goto('/driver/');
      await q
        .getByLabel(en ? 'Menu' : 'Menú')
        .first()
        .click({ timeout: 60_000 });
      await q
        .getByText(en ? 'Help' : 'Ayuda', { exact: true })
        .first()
        .click({ timeout: 20_000 });
      await q.getByTestId('ayuda-hablar').click({ timeout: 20_000 });
      await q.getByTestId('chat-soporte-casilla').waitFor({ timeout: 30_000 });
      await q.getByTestId('chat-soporte-casilla').fill(process.env.PREGUNTA ?? T.pregunta);
      await q.getByTestId('chat-soporte-enviar').click();
      await q.getByTestId('chat-enlace-guia').first().waitFor({ timeout: 60_000 });
      await q.evaluate(() => document.activeElement?.blur());
      // La pregunta arriba y la respuesta entera a la vista.
      await q
        .getByTestId('chat-mensaje-persona')
        .last()
        .evaluate((x) => x.scrollIntoView({ block: 'start' }))
        .catch(() => null);
      await foto(q, '08-camila');
    }
    await ctxN.close();
  }

  await ctx.close();
}

const SOLO_IDIOMA = process.env.SOLO_IDIOMA;
try {
  const tokens = await preparar();
  if (SOLO_IDIOMA !== 'en') await correr('es', tokens);
  if (SOLO_IDIOMA !== 'es') await correr('en', tokens);
} finally {
  await sql(`UPDATE zonas SET nombre = 'El Vigía' WHERE id = '${ZONA}'`).catch(() => null);
  await sql(`UPDATE zonas SET nombre = 'Miami' WHERE id = '${ZONA_USD}'`).catch(() => null);
  await navegador.close();
}
