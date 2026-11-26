import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  request as crearRequest,
} from '@playwright/test';
import { celularDePrueba } from '../../recorrido/celularDePrueba';
import { VERSION_TERMINOS } from '../../../packages/compartido/src/terminos';

/**
 * C-ROBOT-PANEL (26 nov 2026, Gerencia con autorización de Richard). Piezas del robot del panel: la
 * sesión del equipo de Soporte en el SITIO DE PRUEBAS, el conductor nuevo del robot (El Vigía, moto)
 * dado de alta por la API pública como lo hace la app Driver, y la captura de cada línea.
 *
 * Nada de secretos: ni el secreto de diagnóstico ni la dirección privada del superadmin se escriben en
 * el repositorio. La clave de Soporte llega del lanzador (ACEPTACION_CLAVE_SOPORTE) o se lee en el
 * momento del archivo privado de cuentas; la dirección privada se le pide al servidor con la sesión.
 * Todas las cuentas nuevas son `@aceptacion.test` (el sitio de pruebas no les manda códigos de verdad).
 */
export const URL = (process.env.ACEPTACION_URL || 'https://staging.tumbite.com').replace(/\/$/, '');
if (!['https://staging.tumbite.com', 'https://tumbite-pruebas.sitios.dev'].includes(URL))
  throw new Error(`El robot del panel solo corre contra el sitio de pruebas, no contra ${URL}.`);
const DOMINIO = new globalThis.URL(URL).hostname;

export const CARPETA =
  process.env.ACEPTACION_CARPETA ||
  join(
    resolve(__dirname, '../../..'),
    'registros/aceptacion',
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit' }).format(new Date()),
  );
mkdirSync(CARPETA, { recursive: true });

export const SOPORTE = 'demo.soporte@ejemplo.com';
export const CIUDAD = { id: 'VE-MER-ELVIGIA', nombre: 'El Vigía' };
/** Zona de revisión de las tiendas: el robot nunca la toca (solo comprueba que no reciba nada). */
export const ZONA_REVISION = 'US-MI-DETROIT';

/** Corta una corrida que no pudo ni empezar: el lanzador la anota como «no se pudo», no como rojo. */
export class NoSePudo extends Error {
  constructor(motivo: string) {
    super(`NO-SE-PUDO: ${motivo}`);
  }
}

function claveSoporte(): string {
  if (process.env.ACEPTACION_CLAVE_SOPORTE) return process.env.ACEPTACION_CLAVE_SOPORTE;
  const ruta =
    process.env.ACEPTACION_CUENTAS || '/Users/windocellc/Divoox/docs/CUENTAS-DE-PRUEBA.md';
  if (existsSync(ruta))
    for (const l of readFileSync(ruta, 'utf8').split('\n')) {
      const m = l.match(/\|\s*demo\.soporte@ejemplo\.com\s*\|\s*([^|\s]+)\s*\|/i);
      if (m?.[1]) return m[1];
    }
  throw new NoSePudo('no encontré la clave de la cuenta de Soporte de pruebas');
}

const vuelta = process.env.VUELTA_PRUEBAS || `robot-panel-${Date.now().toString(36)}`;
export const CABECERAS = { 'x-idioma': 'es', 'x-vuelta-pruebas': vuelta };

let api: APIRequestContext | null = null;
export async function apiPruebas(): Promise<APIRequestContext> {
  api ??= await crearRequest.newContext({ baseURL: URL, extraHTTPHeaders: CABECERAS });
  return api;
}

export type Respuesta = { estado: number; d: Record<string, unknown> & { error?: string } };
export async function pedir(
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  ruta: string,
  token?: string,
  cuerpo?: unknown,
  extra: Record<string, string> = {},
): Promise<Respuesta> {
  const a = await apiPruebas();
  const r = await a.fetch(ruta, {
    method: metodo,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
    ...(cuerpo === undefined ? {} : { data: cuerpo }),
  });
  const d = (await r.json().catch(() => ({}))) as Respuesta['d'];
  return { estado: r.status(), d };
}
export function ok(r: Respuesta, que: string): Respuesta['d'] {
  if (r.estado < 200 || r.estado >= 300)
    throw new NoSePudo(`${que} contestó ${r.estado}${r.d.error ? ` («${r.d.error}»)` : ''}`);
  return r.d;
}

/** La sesión del equipo: token y la dirección privada del superadmin (solo en memoria). */
let soporte: Promise<{ token: string; raiz: string }> | null = null;
export function sesionSoporte() {
  soporte ??= (async () => {
    const r = ok(
      await pedir('POST', '/datos/cuentas/entrar', undefined, {
        correo: SOPORTE,
        clave: claveSoporte(),
      }),
      'entrar como Soporte',
    );
    const token = String(r.token);
    const { ruta } = ok(await pedir('GET', '/datos/admin/ruta', token), 'dirección del panel') as {
      ruta: string | null;
    };
    return { token, raiz: ruta ? `/panel/${ruta}` : '/panel' };
  })();
  return soporte;
}

/** Una pestaña del panel con la sesión de Soporte, en computadora y en español. */
export async function panel(
  browser: Browser,
): Promise<{ ctx: BrowserContext; p: Page; raiz: string }> {
  const { token, raiz } = await sesionSoporte();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'es-US',
    extraHTTPHeaders: { 'x-vuelta-pruebas': vuelta },
  });
  await ctx.addCookies([
    { name: 'tumbite_sesion', value: token, domain: DOMINIO, path: '/', secure: true },
  ]);
  await ctx.addInitScript(() => localStorage.setItem('tumbite.idioma', 'es'));
  const p = await ctx.newPage();
  p.on('dialog', (d) => void d.dismiss());
  return { ctx, p, raiz };
}

/** Captura de la línea en la carpeta de la corrida (la ruta va al parte). */
export async function captura(p: Page, id: string, completa = false): Promise<string> {
  const archivo = join(CARPETA, `${id}.png`);
  await p.screenshot({ path: archivo, fullPage: completa }).catch(() => undefined);
  return archivo;
}

/** Un JPEG de verdad (la foto de siempre del recorrido) para los papeles que no se leen. */
export const FOTO = readFileSync(join(__dirname, '../../recorrido/fotos/bolsa-entrega.jpg'));

/**
 * Un documento de identidad de MUESTRA (dibujado aquí, con «DOCUMENTO DE PRUEBA» bien visible) con la
 * fecha de nacimiento escrita, para que la lectura automática del sitio de pruebas tenga qué leer (A3).
 * Nunca es un documento real. Ojo: si la lectura sale segura (80 % o más) la fecha pasa sola a la
 * cuenta y el panel ya no muestra «Usar esta fecha»; se probó a propósito con la fecha borrosa, tapada
 * o repetida (26 nov 2026) y la lectura sale o segura (90–100 %) o vacía, nunca en el medio.
 */
export async function documentoMuestra(browser: Browser, nombre: string, nacimiento: string) {
  const [a, m, d] = nacimiento.split('-');
  const ctx = await browser.newContext({ viewport: { width: 900, height: 560 } });
  const p = await ctx.newPage();
  await p.setContent(`<div style="width:860px;height:520px;margin:20px;border-radius:24px;background:#e9eef5;
    font-family:Arial;padding:28px;box-sizing:border-box;border:2px solid #9aa">
    <div style="font-size:22px;font-weight:bold">DOCUMENTO DE PRUEBA · MUESTRA SIN VALOR</div>
    <div style="font-size:18px;margin-top:6px">CÉDULA DE IDENTIDAD</div>
    <div style="display:flex;gap:28px;margin-top:26px">
      <div style="width:210px;height:260px;background:#c9d1db;border-radius:10px"></div>
      <div style="font-size:24px;line-height:1.7">
        <div>V 00.000.000</div>
        <div>APELLIDOS: ${nombre.split(' ').slice(1).join(' ').toUpperCase()}</div>
        <div>NOMBRES: ${nombre.split(' ')[0]?.toUpperCase()}</div>
        <div>F. NACIMIENTO: ${d}/${m}/${a}</div>
        <div>F. EXPEDICIÓN: 01/01/2024</div>
        <div>F. VENCIMIENTO: 01/01/2034</div>
      </div>
    </div></div>`);
  const jpg = await p.screenshot({ type: 'jpeg', quality: 90 });
  await ctx.close();
  return jpg;
}

export type ConductorRobot = {
  id: string;
  token: string;
  correo: string;
  nombre: string;
  placa: string;
  telefono: string;
  motoId: string;
  papelId: string | null;
  nacimiento: string;
  avisos: string[];
};

/**
 * El conductor nuevo del robot, de cero, en El Vigía con moto, como lo hace la app Driver: cuenta,
 * términos, ciudad, moto con sus fotos (enviada), licencia de moto, aviso de la IA, identidad
 * (documento de muestra y cara) y envío a revisión. Se arma una sola vez por corrida.
 */
let conductor: Promise<ConductorRobot> | null = null;
export function conductorRobot(browser: Browser): Promise<ConductorRobot> {
  conductor ??= armarConductor(browser);
  return conductor;
}

async function armarConductor(browser: Browser): Promise<ConductorRobot> {
  const sufijo = Date.now().toString(36);
  const correo = `robot-panel-${sufijo}@aceptacion.test`;
  const nombre = `Robot Panel ${sufijo.slice(-5).toUpperCase()}`;
  const clave = `Robot-${sufijo}-Panel9`;
  const telefono = celularDePrueba();
  const nacimiento = '1996-03-14';
  const avisos: string[] = [];
  const reg = await pedir('POST', '/datos/cuentas/registro', undefined, {
    nombre,
    correo,
    clave,
    rol: 'repartidor',
    telefono,
    idioma: 'es',
    canal: 'app',
  });
  const r = ok(reg, 'crear la cuenta del conductor') as { token: string; usuario: { id: string } };
  const token = r.token;
  const id = r.usuario.id;
  const yo = (
    m: 'GET' | 'POST' | 'PUT',
    ruta: string,
    c?: unknown,
    extra?: Record<string, string>,
  ) => pedir(m, ruta, token, c, extra);
  const foto = async (ruta: string, bytes: Buffer, que: string) => {
    const a = await apiPruebas();
    const x = await a.post(ruta, {
      headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
      data: bytes,
    });
    if (!x.ok()) avisos.push(`${que}: ${x.status()} ${(await x.text()).slice(0, 120)}`);
    return (await x.json().catch(() => ({}))) as { id?: string };
  };
  await yo('POST', '/datos/repartidor/terminos', { version: VERSION_TERMINOS });
  ok(await yo('PUT', '/datos/conductor/ciudad', { zonaId: CIUDAD.id }), `elegir ${CIUDAD.nombre}`);
  // La moto, con sus fotos, enviada a revisión.
  const placa = `RB${String(Date.now()).slice(-5)}`;
  const moto = String(
    ok(
      await yo('POST', '/datos/conductor/vehiculos', {
        tipo: 'moto',
        marca: 'Bera',
        modelo: 'BR 150',
        anio: 2022,
        color: 'Negro',
        placa,
      }),
      'registrar la moto',
    ).id,
  );
  for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente'])
    await foto(`/datos/conductor/vehiculos/${moto}/documentos?tipo=${t}`, FOTO, `foto ${t}`);
  const env = await yo('POST', `/datos/conductor/vehiculos/${moto}/enviar`);
  if (env.estado >= 300) avisos.push(`enviar la moto: ${env.estado} ${env.d.error ?? ''}`);
  // La licencia de moto.
  const papel = await foto(
    '/datos/conductor/papeles?tipo=licencia_moto&vence=2030-01-01',
    FOTO,
    'licencia de moto',
  );
  // La identidad, como en la app: aviso de la IA, consentimiento, documento de muestra y cara.
  await yo('POST', '/datos/conductor/verificacion/permiso-ia', { acepto: true });
  await yo('POST', '/datos/kyc/consentimiento', { acepto: true });
  const doc = await documentoMuestra(browser, nombre, nacimiento);
  const v = ok(await yo('GET', '/datos/conductor/verificacion'), 'pasos de la verificación') as {
    pasos: { paso: string }[];
  };
  for (const { paso } of v.pasos) {
    const bytes = /doc|cedula|documento|frente/.test(paso) ? doc : FOTO;
    await foto(`/datos/conductor/verificacion/foto/${paso}?origen=camara`, bytes, `foto ${paso}`);
  }
  const envio = await yo('POST', '/datos/conductor/verificacion/enviar', {});
  if (envio.estado >= 300)
    avisos.push(`enviar la verificación: ${envio.estado} ${envio.d.error ?? ''}`);
  const resumen = { id, correo, nombre, placa, telefono, motoId: moto, papelId: papel.id ?? null };
  writeFileSync(
    join(CARPETA, 'panel-conductor.json'),
    JSON.stringify({ ...resumen, avisos }, null, 2),
  );
  return { ...resumen, token, nacimiento, avisos };
}

/** Lee el número del menú de una sección del superadmin («Verificaciones 13» → 13; sin número → 0). */
export async function numeroDelMenu(p: Page, texto: RegExp): Promise<number> {
  const enlace = p.locator('nav a, aside a').filter({ hasText: texto }).first();
  const t = (await enlace.innerText().catch(() => '')).replace(texto, '');
  const m = t.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/**
 * Abre una pantalla del panel. Si la sesión tropieza (el 26 nov 2026 el servidor de pruebas contestó
 * 500 a «quién soy» y el panel mostró «Esta página no existe.»), lo anota para el parte y recarga UNA
 * vez: el tropiezo queda dicho, no escondido, y no tumba la línea que se está probando.
 */
export async function abrir(p: Page, ruta: string, tropiezos: string[]): Promise<void> {
  for (let intento = 1; intento <= 2; intento++) {
    if (intento === 1) await p.goto(ruta);
    else await p.reload();
    const menu = p
      .locator('nav a, aside a')
      .filter({ hasText: /Verificaciones/ })
      .first();
    const noExiste = p.getByRole('heading', { name: 'Esta página no existe.' });
    await expect(menu.or(noExiste).first()).toBeVisible({ timeout: 30_000 });
    if (!(await noExiste.isVisible().catch(() => false))) return;
    tropiezos.push(
      'al abrir una pantalla el panel mostró «Esta página no existe.» y al recargar sí cargó',
    );
  }
  throw new Error('el panel muestra «Esta página no existe.» aun después de recargar');
}
