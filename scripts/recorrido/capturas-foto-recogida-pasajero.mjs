/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- guion local: carpetas fijas del repositorio; `localStorage` corre dentro del navegador */
// C-FOTO-RECOGIDA (21 nov 2026) — todos los países. Prueba EN PANTALLA, con la app web real del
// cliente (/app) contra el servidor LOCAL del recorrido (.recorrido, puerto 8790; antes:
// node scripts/recorrido/preparar.mjs), de las dos ayudas del pasajero. No solo captura: cada paso
// lleva su comprobación y, si falla, el guion se para con el motivo.
//   a) Pide un mototaxi desde su casa guardada SIN fotos: sale la invitación «Agrega una foto de tu
//      entrada…»; al tocarla abre «Fotos de la entrada» de esa dirección; con la foto puesta, la
//      invitación desaparece.
//   b) Pide desde un punto suelto y termina el viaje: sale «¿Sales seguido de aquí?»; «Guardar este
//      punto» lo guarda en sus direcciones y ofrece agregar la foto.
// Datos neutros («Ciudad de ejemplo», «Calle de Ejemplo 120»); la foto es un dibujo.
//   → docs/capturas/foto-recogida/pasajero-<nombre>-<es|en>.png
// Uso: node scripts/recorrido/capturas-foto-recogida-pasajero.mjs
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'foto-recogida');
const FOTOS = join(RAIZ, 'e2e', 'recorrido', 'fotos');
mkdirSync(SALIDA, { recursive: true });
const servidor = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '-c',
    '.recorrido/wrangler.jsonc',
    '--port',
    new globalThis.URL(URL).port,
    '--persist-to',
    '.recorrido/estado',
  ],
  { cwd: RAIZ, stdio: 'ignore', detached: true },
);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.85.0.${++ip % 250}`,
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
    'x-reloj-secreto': SECRETO,
  });
const sql = (q) => interno('sql', { sql: q });
const paso = (token, operacion, nombre) =>
  pedir('POST', `/datos/conductor/operaciones/${operacion}/${nombre}`, {}, token, {
    'idempotency-key': `pasajero-${nombre}-${randomBytes(8).toString('hex')}`,
  });
const informe = [];
function comprobar(cond, paso_, evidencia) {
  if (!cond) throw new Error(`FALLA ${paso_}: ${evidencia}`);
  informe.push(`${paso_}: ${evidencia}`);
}

const ZONA = 'US-ZZ-EJEMPLO';
const CENTRO = { lat: 42.6006, lng: -84.1955 };
const CASA = { lat: 42.5922, lng: -84.198 };
const ESQUINA = { lat: 42.5975, lng: -84.203 };
const DESTINO = { lat: 42.5995, lng: -84.1889 };
const TARIFA = { base: 150, porKm: 60, porMinuto: 12, minimo: 400 };
const L = {
  es: {
    ciudad: 'Ciudad de ejemplo',
    cliente: 'Laura Pérez',
    otro: 'Ana Gómez',
    conductor: 'José Rojas',
    casaNombre: 'Casa',
    casa: 'Calle de Ejemplo 120',
    esquina: 'Esquina de Ejemplo',
    destino: 'Avenida de Ejemplo 45',
  },
  en: {
    ciudad: 'Example city',
    cliente: 'Jamie Lee',
    otro: 'Taylor Brooks',
    conductor: 'Sam Carter',
    casaNombre: 'Home',
    casa: '120 Example Street',
    esquina: 'Example Corner',
    destino: '45 Example Avenue',
  },
};

let navegador;
try {
  for (let i = 0; ; i++) {
    if (
      await fetch(`${URL}/datos/salud`).then(
        () => true,
        () => false,
      )
    )
      break;
    if (i > 90) throw new Error('el servidor local no encendió');
    await espera(2_000);
  }
  navegador = await chromium.launch();
  for (const idioma of ['es', 'en']) {
    const T = L[idioma];
    const v = `${idioma}${Date.now().toString(36)}`;
    await sql(
      `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES ('${ZONA}', '${T.ciudad}', 'US', 'USD', 'America/Detroit', ${CENTRO.lat}, ${CENTRO.lng}, 15, 1)
       ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, lat = excluded.lat, lng = excluded.lng`,
    );
    const a = await interno('carro/armar');
    await sql(`UPDATE servicios SET estado = 'disponible' WHERE id = 'moto'`);
    await sql(
      `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto', '${ZONA}', 'disponible') ON CONFLICT DO UPDATE SET estado = 'disponible'`,
    );
    await pedir(
      'POST',
      '/datos/admin/viajes/tarifas',
      { servicio: 'moto', zona: ZONA, tarifa: TARIFA, motivo: 'Capturas' },
      a.tokens.equipo,
    );
    await pedir(
      'PUT',
      '/datos/admin/viajes/ajustes',
      { zona: ZONA, servicio: 'moto', pin: 'nunca', selfieCasco: false },
      a.tokens.equipo,
    );
    const m = await interno('moto/armar');
    const moto = { id: m.ids.conductor, token: m.tokens.conductor };
    await sql(
      `UPDATE usuarios SET nombre = '${T.conductor}', idioma = '${idioma}' WHERE id = '${moto.id}'`,
    );
    const ubicar = (donde) =>
      sql(
        `UPDATE repartidores SET conectado = 1, zona_id = '${ZONA}', lat = ${donde.lat}, lng = ${donde.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${moto.id}'`,
      );
    const cuenta = async (nombre) => {
      const r = await pedir('POST', '/datos/cuentas/registro', {
        nombre,
        correo: `pasajero.${v}.${randomBytes(3).toString('hex')}@recorrido.test`,
        clave: DATOS.clave,
        rol: 'cliente',
        idioma,
      });
      await sql(
        `UPDATE usuarios SET correo_confirmado_en = datetime('now'), telefono_verificado_en = datetime('now'), fecha_nacimiento = '1990-03-15', idioma = '${idioma}' WHERE id = '${r.usuario.id}'`,
      );
      return { token: r.token, id: r.usuario.id };
    };
    const telefono = async (c, borrador) => {
      const ctx = await navegador.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        baseURL: URL,
        locale: idioma === 'en' ? 'en-US' : 'es-US',
        timezoneId: 'America/Detroit',
        geolocation: { latitude: borrador.lat, longitude: borrador.lng },
        permissions: ['geolocation'],
      });
      await ctx.addInitScript(
        ([pase, u, i, b]) => {
          localStorage.setItem('tumbite.idioma', i);
          localStorage.setItem('tumbite.sesion', pase);
          localStorage.setItem(`divoox.permisos.${u}`, '1');
          localStorage.setItem(`tumbite.borrador.moto.${u}`, b);
        },
        [
          c.token,
          c.id,
          idioma,
          JSON.stringify({
            recogida: borrador.direccion,
            recogidaLat: String(borrador.lat),
            recogidaLng: String(borrador.lng),
            destino: T.destino,
            destinoLat: String(DESTINO.lat),
            destinoLng: String(DESTINO.lng),
          }),
        ],
      );
      return ctx;
    };
    const captura = async (p, nombre) => {
      await p.screenshot({ path: join(SALIDA, `pasajero-${nombre}-${idioma}.png`) });
      console.log(`✓ pasajero-${nombre}-${idioma}.png`);
    };

    // ───────── a) desde su casa guardada SIN fotos: la invitación
    const cli = await cuenta(T.cliente);
    const casa = (
      await pedir(
        'POST',
        '/datos/mis-direcciones',
        { etiqueta: T.casaNombre, direccion: T.casa, ...CASA },
        cli.token,
      )
    ).direccion;
    const ctxA = await telefono(cli, { ...CASA, direccion: T.casa });
    const p = await ctxA.newPage();
    await p.goto('/app/ride');
    await p.getByTestId('moto-precio').waitFor({ timeout: 60_000 });
    const invitacion = p.getByTestId('viaje-invitar-foto');
    await invitacion.waitFor({ timeout: 20_000 });
    comprobar(
      (await invitacion.innerText()).includes(
        idioma === 'en' ? 'Add a photo of your entrance' : 'Agrega una foto de tu entrada',
      ),
      `a ${idioma}`,
      'con la casa guardada sin fotos, al ver el precio sale la invitación',
    );
    await invitacion.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await espera(900);
    await captura(p, 'invitacion');
    await invitacion.click();
    await p.getByTestId('fotos-puerta-tipo-casa').waitFor({ timeout: 20_000 });
    await espera(900);
    comprobar(
      true,
      `a ${idioma}`,
      'tocar la invitación abre «Fotos de la entrada» de esa dirección',
    );
    await captura(p, 'invitacion-abre-fotos');
    // La foto se pone (por el servidor, con el dibujo) y al cerrar la hoja la invitación ya no está.
    const foto = await fetch(`${URL}/datos/mis-direcciones/${casa.id}/fotos/1`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cli.token}`, 'content-type': 'image/jpeg' },
      body: readFileSync(join(FOTOS, `puerta-casa-frente-${idioma}.jpg`)),
    });
    comprobar(foto.ok, `a ${idioma}`, `la foto de la entrada se guarda (${foto.status})`);
    await p
      .getByTestId('fotos-puerta-ahora-no')
      .or(p.getByTestId('fotos-puerta-listo'))
      .first()
      .click({ timeout: 15_000 });
    await p.getByTestId('viaje-invitar-foto').waitFor({ state: 'hidden', timeout: 20_000 });
    comprobar(
      true,
      `a ${idioma}`,
      'con la foto puesta y la hoja cerrada, la invitación desaparece',
    );
    await ctxA.close();

    // ───────── b) desde un punto suelto: al terminar, guardar el punto
    const otro = await cuenta(T.otro);
    await ubicar(ESQUINA);
    const cot = (
      await pedir(
        'POST',
        '/datos/viajes/cotizar',
        {
          servicio: 'moto',
          origen: { ...ESQUINA, direccion: T.esquina },
          destino: { ...DESTINO, direccion: T.destino },
        },
        otro.token,
      )
    ).cotizacion;
    comprobar(
      cot.recogida?.guardada === false,
      `b ${idioma}`,
      'un punto suelto no cuenta como dirección guardada',
    );
    const id = (
      await pedir(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'efectivo' },
        otro.token,
      )
    ).viaje.id;
    for (let i = 0; ; i++) {
      await ubicar(ESQUINA);
      await pedir('GET', '/datos/viajes/actual', undefined, otro.token);
      if (
        await paso(moto.token, id, 'aceptar').then(
          () => true,
          () => false,
        )
      )
        break;
      if (i > 20) throw new Error('el conductor no pudo aceptar el viaje');
      await espera(1_500);
    }
    await paso(moto.token, id, 'llegue');
    await paso(moto.token, id, 'iniciar');
    const ctxB = await telefono(otro, { ...ESQUINA, direccion: T.esquina });
    const q = await ctxB.newPage();
    await q.goto('/app/ride');
    await q.getByTestId('viaje-pasajero').waitFor({ timeout: 60_000 });
    comprobar(
      (await q.getByTestId('viaje-guardar-punto').count()) === 0,
      `b ${idioma}`,
      'durante el viaje no se ofrece guardar nada',
    );
    await ubicar(DESTINO);
    await paso(moto.token, id, 'terminar');
    const oferta = q.getByTestId('viaje-guardar-punto');
    await oferta.waitFor({ timeout: 60_000 });
    await oferta.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await espera(900);
    comprobar(
      true,
      `b ${idioma}`,
      'al terminar un viaje pedido desde un punto suelto sale «¿Sales seguido de aquí?»',
    );
    await captura(q, 'guardar-punto');
    await q.getByTestId('viaje-punto-guardar').click();
    await q.getByTestId('viaje-punto-guardado').waitFor({ timeout: 20_000 });
    const guardadas = (await pedir('GET', '/datos/mis-direcciones', undefined, otro.token))
      .direcciones;
    comprobar(
      guardadas.length === 1 && Math.abs(guardadas[0].lat - ESQUINA.lat) < 1e-6,
      `b ${idioma}`,
      `el punto quedó en sus direcciones como «${guardadas[0]?.etiqueta}» (${guardadas.length} dirección)`,
    );
    await oferta.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await espera(700);
    await captura(q, 'punto-guardado');
    await q.getByTestId('viaje-punto-agregar-foto').click();
    await q.getByTestId('fotos-puerta-tipo-casa').waitFor({ timeout: 20_000 });
    comprobar(
      true,
      `b ${idioma}`,
      '«Agregar una foto de la entrada» abre la hoja de fotos del punto recién guardado',
    );
    await ctxB.close();
    await sql(`DELETE FROM conductor_ocupacion WHERE conductor_id = '${moto.id}'`);
  }
  console.log(informe.map((x) => `  · ${x}`).join('\n'));
} finally {
  await navegador?.close();
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ya estaba apagado */
  }
}
