// C-PAIS-ABIERTO-SIN-PRONTO (25 nov 2026): antes de compilar la web se copia en
// src/sitio/paisesAbiertos.json qué países tienen un servicio abierto al público en PRODUCCIÓN
// (GET /datos/web/paises, solo lectura y con caché). Así las páginas prearmadas (título,
// descripción y tarjeta social) salen con el estado real: la plataforma las sirve sin pasar por el
// servidor. Si producción no responde o responde algo raro, se queda lo último guardado (el
// archivo está en el repositorio) y se avisa: nunca se compila con un país inventado.
// DIVOOX_ESTADO_SIN_RED=1 lo salta (pruebas sin red). DIVOOX_ESTADO_URL cambia el origen.
//
// C-CIUDAD-ABIERTA-SIN-PRONTO y C-TARIFAS-PUBLICAS (25 nov 2026): con el mismo patrón se guardan qué
// ciudades públicas tienen algo abierto (`ciudades` de la misma ruta) y los precios fijos de cada una
// (GET /datos/web/tarifas/<ciudad>, en src/sitio/tarifasCiudades.json). Un servidor que todavía no
// conoce las ciudades (sin la clave `ciudades`) no toca nada; una ciudad sin precios publicados (404)
// se quita, porque la página no puede mostrar precios que el sistema no cobra.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const archivo = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'sitio',
  'paisesAbiertos.json',
);
const archivoTarifas = join(dirname(archivo), 'tarifasCiudades.json');
const origen = process.env.DIVOOX_ESTADO_URL || 'https://divoox.com';

/** Valida la respuesta: { paises: { XX: [{ id, es, en }] } }. Devuelve null si no sirve. */
export function validar(d) {
  if (!d || typeof d !== 'object' || !d.paises || typeof d.paises !== 'object') return null;
  const paises = {};
  for (const [codigo, lista] of Object.entries(d.paises).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[A-Z]{2}$/.test(codigo) || !Array.isArray(lista)) return null;
    const limpia = [];
    for (const s of lista) {
      if (!s || typeof s.id !== 'string' || typeof s.es !== 'string' || typeof s.en !== 'string')
        return null;
      limpia.push({ id: s.id, es: s.es, en: s.en });
    }
    if (limpia.length) paises[codigo] = limpia;
  }
  // Las ciudades (clave pública → servicios). Sin la clave: servidor de antes (null = no se sabe).
  let ciudades = null;
  if (d.ciudades !== undefined) {
    if (!d.ciudades || typeof d.ciudades !== 'object') return null;
    ciudades = {};
    for (const [codigo, mapa] of Object.entries(d.ciudades).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (!/^[A-Z]{2}$/.test(codigo) || !mapa || typeof mapa !== 'object') return null;
      const cs = {};
      for (const [clave, lista] of Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b))) {
        if (!/^[a-z0-9-]{2,40}$/.test(clave) || !Array.isArray(lista)) return null;
        const limpia = [];
        for (const s of lista) {
          if (
            !s ||
            typeof s.id !== 'string' ||
            typeof s.es !== 'string' ||
            typeof s.en !== 'string'
          )
            return null;
          limpia.push({ id: s.id, es: s.es, en: s.en });
        }
        if (limpia.length) cs[clave] = limpia;
      }
      if (Object.keys(cs).length) ciudades[codigo] = cs;
    }
  }
  return ciudades ? { paises, ciudades } : { paises };
}

const precio = (p) =>
  p === null ||
  (p &&
    Number.isInteger(p.dia) &&
    p.dia > 0 &&
    (p.noche === null || (Number.isInteger(p.noche) && p.noche >= p.dia)));

/** Valida los precios de una ciudad (la forma de `TarifasPublicas` del servidor). null si no sirve. */
export function validarTarifas(t) {
  if (!t || typeof t !== 'object' || typeof t.ciudad !== 'string' || typeof t.moneda !== 'string')
    return null;
  if (!Array.isArray(t.grupos) || !Array.isArray(t.otros)) return null;
  for (const g of t.grupos) {
    if (!g || !(g.grupo === null || typeof g.grupo === 'string') || !Array.isArray(g.lugares))
      return null;
    for (const l of g.lugares)
      if (
        !l ||
        typeof l.lugar !== 'string' ||
        !precio(l.ida) ||
        !precio(l.regreso) ||
        !precio(l.idaVuelta) ||
        (l.ida === null && l.regreso === null)
      )
        return null;
  }
  for (const o of t.otros)
    if (
      !o ||
      typeof o.desde !== 'string' ||
      typeof o.hasta !== 'string' ||
      !precio(o.precio) ||
      o.precio === null
    )
      return null;
  if (!precio(t.minimo)) return null;
  // Nada interno: ni ids ni comisiones (la ruta no los da; si algún día los diera, no se guardan).
  if (/"id"|comision|umbral/i.test(JSON.stringify(t))) return null;
  return t;
}

/**
 * Los precios de cada ciudad con Moto abierta, como los da producción. `guardadas` son las del archivo.
 * - Una ciudad que dejó de estar abierta se QUITA (nunca quedan precios viejos de algo cerrado).
 * - 404 = esa ciudad no tiene precios publicados hoy: se quita.
 * - Un fallo pasajero (red, 5xx, respuesta rara) de una ciudad que SIGUE abierta conserva lo guardado
 *   de esa ciudad, y se avisa en el registro.
 */
export async function tarifasDe(ciudades, guardadas = {}, pedir = pedirTarifas) {
  const claves = Object.values(ciudades)
    .flatMap((cs) =>
      Object.entries(cs)
        .filter(([, servicios]) => servicios.some((s) => s.id === 'moto'))
        .map(([clave]) => clave),
    )
    .sort();
  const tarifas = {};
  const avisos = [];
  for (const clave of claves) {
    let r;
    try {
      r = await pedir(clave);
    } catch (e) {
      r = { error: e?.message ?? String(e) };
    }
    if (r.estado === 404) continue;
    const t = r.datos ? validarTarifas(r.datos) : null;
    if (t) {
      if (t.grupos.length || t.otros.length) tarifas[clave] = t;
      continue;
    }
    const antes = new Map(Object.entries(guardadas)).get(clave);
    avisos.push(
      `tarifas de ${clave}: ${r.error ?? (r.estado ? `respondió ${r.estado}` : 'respuesta rara')}; ${antes ? 'queda lo guardado' : 'sin precios guardados'}`,
    );
    if (antes) tarifas[clave] = antes;
  }
  return { tarifas, avisos };
}

async function pedirTarifas(clave) {
  const r = await fetch(`${origen}/datos/web/tarifas/${clave}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return { estado: r.status };
  return { estado: r.status, datos: await r.json().catch(() => null) };
}

/** Escribe un archivo solo si cambió (sin fecha adentro: compilar no ensucia el repositorio). */
function guardar(ruta, datos) {
  const nuevo = `${JSON.stringify(datos, null, 2)}\n`;
  if (readFileSync(ruta, 'utf8') === nuevo) return false;
  writeFileSync(ruta, nuevo);
  return true;
}

async function main() {
  if (process.env.DIVOOX_ESTADO_SIN_RED === '1') return;
  let datos = null;
  try {
    const r = await fetch(`${origen}/datos/web/paises`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) datos = validar(await r.json());
    else console.warn(`estado-paises: ${origen} respondió ${r.status}; queda lo guardado`);
  } catch (e) {
    console.warn(`estado-paises: sin respuesta de ${origen}; queda lo guardado`, e?.message ?? e);
  }
  if (!datos) return;
  // Una respuesta válida pero sin ningún país (un mal minuto de la base) no cierra los países ya
  // abiertos: cerrar un país es una decisión, y se hace vaciando el archivo a mano.
  if (!Object.keys(datos.paises).length) {
    console.warn(`estado-paises: ${origen} respondió sin países; queda lo guardado`);
    return;
  }
  // Un servidor de antes no da las ciudades: se conservan las guardadas.
  const guardado = JSON.parse(readFileSync(archivo, 'utf8'));
  const ciudades = datos.ciudades ?? guardado.ciudades ?? {};
  if (guardar(archivo, { paises: datos.paises, ciudades }))
    console.log(
      `estado-paises: países abiertos según producción: ${Object.keys(datos.paises).join(', ') || 'ninguno'}`,
    );
  // Un servidor de antes (sin ciudades) no confirma precios: no se toca lo guardado (vacío en el repo).
  if (!datos.ciudades) return;
  const guardadas = JSON.parse(readFileSync(archivoTarifas, 'utf8')).tarifas ?? {};
  const { tarifas, avisos } = await tarifasDe(datos.ciudades, guardadas);
  for (const a of avisos) console.warn(`estado-paises: ${a}`);
  if (guardar(archivoTarifas, { tarifas }))
    console.log(
      `estado-paises: precios según producción: ${Object.keys(tarifas).join(', ') || 'ninguna ciudad'}`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
