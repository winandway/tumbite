/**
 * Examen de Camila (C-ROBOT-NOCTURNO, 26 nov 2026): cincuenta preguntas al chat de Camila en el SITIO
 * DE PRUEBAS, con la cuenta demo de conductor, calificadas sin IA. Reglas en camila-examen.json.
 *
 * Uso (desde la raíz del repositorio):
 *   node scripts/aceptacion/camila.mjs                 corre las cincuenta
 *   node scripts/aceptacion/camila.mjs --repetir       repite solo las «no-se-pudo» de la corrida de hoy
 *   node scripts/aceptacion/camila.mjs --solo K01,K22  solo esas (mezcla con lo ya escrito hoy)
 *
 * Calificación por pregunta: correcta (contiene / no contiene, contra el dato REAL leído de la API con
 * la misma cuenta o del tabulador de El Vigía del repositorio), corta, sin inventar y, en las trampa,
 * que pase al equipo lo que no sabe. Camila tiene tope de 1 dólar al día: se espacia cada pregunta.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RAIZ, carpetaCorrida, cuentasDemo, escribirSeccion, fechaCorrida, sitioDePruebas,
} from './comun.mjs';

const BASE = sitioDePruebas();
const CORREO = 'demo.repartidor@ejemplo.com';
const ESPERA_MS = Number(process.env.CAMILA_ESPERA_MS || 5000);
const args = process.argv.slice(2);
const SOLO = (args.find((a) => a.startsWith('--solo=')) || args[args.indexOf('--solo') + 1] || '')
  .replace('--solo=', '').split(',').filter((x) => /^K\d\d$/.test(x));
const REPETIR = args.includes('--repetir');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- datos reales ----------
const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function api(ruta, token, init = {}) {
  const r = await fetch(`${BASE}/datos/${ruta}`, {
    ...init,
    headers: {
      'content-type': 'application/json', 'x-tumbite-app': 'driver',
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers || {}),
    },
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* respuesta no JSON */ }
  return { status: r.status, json };
}

/** Tabulador de El Vigía del repositorio: la misma hoja que siembra el sitio de pruebas. */
function leerTabulador() {
  const src = readFileSync(join(RAIZ, 'apps/servidor/src/tabuladorElVigia.ts'), 'utf8');
  const mapa = {};
  for (const m of src.matchAll(/nombre:\s*'([^']+)',\s*precio:\s*(\d+)/g)) mapa[norm(m[1])] = Number(m[2]);
  return mapa;
}

/** Regex (sobre texto normalizado) de una cantidad en centavos. */
function reDinero(c) {
  const ent = Math.floor(c / 100), cc = c % 100;
  const pre = '(?<![\\d.,])';
  if (cc === 0) return `${pre}${ent}(?:[.,]00?)?(?![.,]?\\d)`;
  const dd = String(cc).padStart(2, '0');
  return `${pre}${ent}[.,](?:${dd}${dd[1] === '0' ? `|${dd[0]}` : ''})(?!\\d)`;
}
const reEntero = (n) => `(?<![\\d.,])${n}(?![.,]?\\d)`;

async function leerReales(token) {
  const [saldo, perfil, gan, estado, serv, cal] = await Promise.all([
    api('repartidor/saldo-prepago', token), api('repartidor/perfil', token),
    api('repartidor/ganancias', token), api('repartidor/estado', token),
    api('conductor/servicios', token), api('repartidor/calificaciones', token),
  ]);
  for (const [n, r] of Object.entries({ saldo, perfil, gan, estado, serv })) {
    if (r.status !== 200 || !r.json) throw new Error(`No se pudo leer ${n} de la API (HTTP ${r.status}).`);
  }
  const p = perfil.json.perfil, v = p.vehiculo || {}, ped = gan.json.pedidos?.[0];
  const carro = serv.json.servicios?.find((s) => s.servicioId === 'carro')?.cambiarA?.nombre;
  const ciudades = { 'vi-mer-elvigia': 'el vigia' };
  const zona = norm(estado.json.zonaId || '');
  const tab = leerTabulador();
  const t = {
    saldo: reDinero(saldo.json.disponible),
    carreras: reEntero(saldo.json.carrerasAlcanzan),
    comision: reDinero(saldo.json.comisionTipica),
    regalos: reDinero(saldo.json.regalosPorCobrar ?? 0),
    viajes: reEntero(p.trayectoria?.viajes),
    entregas: reEntero(gan.json.pedidos?.length ?? 0),
    calificacion: `(?<![\\d.,])${Math.round(p.trayectoria?.calificacion ?? cal.json?.clientes?.promedio ?? 5)}(?:[.,]0)?(?![.,]?\\d)`,
    placa: norm(p.placa || '').replace(/(\d)/, ' ?$1').replace(/^/, '').replace(/ \?/g, ' ?'),
    modelo: norm(v.modelo || 'zzz').replace(/([a-z])(\d)/, '$1 ?$2'),
    marca: norm(v.marca || 'zzz'),
    puntos: reEntero(estado.json.puntos),
    nivel: norm(estado.json.nivel?.es || 'zzz') + '|' + norm(estado.json.nivel?.en || 'zzz'),
    ultimoTotal: ped ? reDinero(ped.total) : 'zzz',
    ultimoCodigo: norm(ped?.codigo || 'zzz'),
    ciudad: zona.includes('elvigia') ? 'el vigia' : norm(zona),
    carro: norm(carro || 'zzz'),
    correo: norm(CORREO).replace(/\./g, '\\.'),
  };
  const datos = { saldo: saldo.json.disponible, viajes: p.trayectoria?.viajes, entregas: gan.json.pedidos?.length, placa: p.placa, ultimoTotal: ped?.total, regalos: saldo.json.regalosPorCobrar };
  return { t, tab, datos };
}

/** Convierte una ficha {…} en regex; devuelve null si no es ficha. */
function ficha(s, R) {
  const m = s.match(/^\{(tab|noche):(.+)\}$/);
  if (m) {
    const precio = R.tab[norm(m[2])];
    if (precio == null) throw new Error(`El tabulador no trae «${m[2]}».`);
    return reDinero(m[1] === 'noche' ? Math.round(precio * 130) : precio * 100);
  }
  const k = s.match(/^\{(\w+)\}$/);
  if (k) {
    if (!(k[1] in R.t)) throw new Error(`Ficha desconocida {${k[1]}}.`);
    return R.t[k[1]];
  }
  return null;
}
const aRegex = (s, R) => {
  const f = ficha(s, R);
  if (f) return new RegExp(f, 'i');
  if (s.startsWith('re:')) return new RegExp(s.slice(3), 'i');
  return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
};
/** Rellena las fichas dentro del texto «ensenar». */
const textoEnsenar = (q) => q.ensenar;

// ---------- calificación ----------
const MARCA_EQUIPO = /(alguien del equipo|persona del equipo|persona de nuestro equipo|nuestro equipo|el equipo (te|lo|les|va|revis|confirm)|con el equipo|equipo de soporte|abri un caso|he abierto un caso|someone on (the|our) team|(the|our) team (will|can|would)|to the team|opened a case)/;
const NO_ENTENDI = /(te puedo ayudar con esto: pedir un viaje|i can help you with this: requesting a ride)/;
const CORREOS_OK = new Set([CORREO, 'soporte@divoox.com', 'support@divoox.com']);

function medir(respuesta) {
  const lineas = respuesta.split('\n').map((l) => l.trim()).filter((l) => l && !/^(ver la guia|see the guide)/.test(norm(l)) && !/^https?:\/\/\S+$/.test(l));
  const frases = lineas.join(' ').replace(/https?:\/\/\S+/g, '').replace(/(^|\s)\d+[.)]\s/g, ' ')
    .split(/(?<=[.!?])\s+/).filter((f) => f.replace(/\W/g, '').length > 2);
  return { lineas: lineas.length, frases: frases.length, letras: lineas.join(' ').length };
}

function calificar(q, respuesta, R) {
  const fallas = [];
  const n = norm(respuesta);
  for (const grupo of q.contiene || []) {
    if (!grupo.some((s) => aRegex(s, R).test(n))) fallas.push(`correcta: no dice ${grupo.slice(0, 3).map((g) => (ficha(g, R) ? g : `«${g.replace(/^re:/, '')}»`)).join(' / ')}`);
  }
  for (const s of q.noContiene || []) {
    if (aRegex(s, R).test(n)) fallas.push(`correcta: dice algo que no debe (${s.replace(/^re:/, '').slice(0, 40)})`);
  }
  if (NO_ENTENDI.test(n)) fallas.push('correcta: contestó «no entendí» con los tres temas');
  const m = medir(respuesta);
  const tope = q.largo === 'pasos' ? { l: 8, f: 9 } : { l: 5, f: 4 };
  if (m.lineas > tope.l || m.frases > tope.f) fallas.push(`corta: ${m.lineas} líneas y ${m.frases} frases (máximo ${tope.l} y ${tope.f})`);
  // Sin inventar: enlaces, correos y teléfonos ajenos, y «asistente virtual» sin que lo pregunten.
  for (const u of respuesta.match(/https?:\/\/[^\s)]+/g) || []) {
    if (!/^https?:\/\/(www\.)?divoox\.com(\/|$)/.test(u)) fallas.push(`inventa: enlace ajeno ${u}`);
  }
  for (const e of respuesta.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []) {
    if (!CORREOS_OK.has(e.toLowerCase())) fallas.push(`inventa: correo ${e}`);
  }
  if (/\+?\d[\d ()-]{9,}\d/.test(respuesta.replace(/https?:\/\/\S+/g, ''))) fallas.push('inventa: número de teléfono');
  if (/asistente virtual|virtual assistant/i.test(respuesta)) fallas.push('inventa: dice «asistente virtual» sin que se lo pregunten');
  const pasa = MARCA_EQUIPO.test(n);
  if (q.pasaAlEquipo === 'debe' && !pasa) fallas.push('equipo: no pasó al equipo lo que no sabe');
  return { fallas, pasa, medida: m };
}

// ---------- corrida ----------
async function preguntar(q, token) {
  for (let intento = 0; intento < 2; intento++) {
    const r = await api('camila/mensaje', token, {
      method: 'POST', headers: { 'x-idioma': q.idioma }, body: JSON.stringify({ texto: q.pregunta, canal: 'app' }),
    });
    if (r.status === 200 && r.json) return r;
    if (intento === 0 && r.status >= 500) { await dormir(8000); continue; }
    return r;
  }
}

async function main() {
  const examen = JSON.parse(readFileSync(new URL('./camila-examen.json', import.meta.url), 'utf8'));
  const fecha = fechaCorrida();
  const archivoHoy = join(carpetaCorrida(fecha), 'camila.json');
  const previo = existsSync(archivoHoy) ? JSON.parse(readFileSync(archivoHoy, 'utf8')) : null;
  const clave = cuentasDemo()[CORREO];
  if (!clave) throw new Error('No encontré la cuenta demo del conductor en el archivo privado de cuentas.');
  const empezo = new Date().toISOString();

  const sesion = await api('cuentas/entrar', null, { method: 'POST', body: JSON.stringify({ correo: CORREO, clave }) });
  if (sesion.status !== 200 || !sesion.json?.token) throw new Error(`No pude entrar con la cuenta demo (HTTP ${sesion.status}).`);
  const token = sesion.json.token;
  await api('camila/permiso-ia', token, { method: 'POST', body: JSON.stringify({ acepto: true }) });
  const R = await leerReales(token);

  let aPreguntar = examen.preguntas;
  if (SOLO.length) aPreguntar = aPreguntar.filter((q) => SOLO.includes(q.id));
  else if (REPETIR && previo) {
    const ids = new Set(previo.lineas.filter((l) => l.estado === 'no-se-pudo').map((l) => l.id));
    aPreguntar = aPreguntar.filter((q) => ids.has(q.id));
  }
  const nuevas = new Map();
  for (const q of aPreguntar) {
    const linea = { id: q.id, titulo: `${q.grupo}: ${q.titulo}`, estado: 'no-se-pudo', motivo: '', pregunta: q.pregunta, respuesta: '' };
    try {
      const r = await preguntar(q, token);
      if (r.status !== 200) linea.motivo = `Falló el robot o el sitio: HTTP ${r.status} ${JSON.stringify(r.json || {}).slice(0, 120)}`;
      else if (!r.json.respuesta) linea.motivo = 'Camila no contestó (silencio: el equipo tiene el hilo o falta el permiso)';
      else {
        linea.respuesta = r.json.respuesta;
        const c = calificar(q, linea.respuesta, R);
        linea.estado = c.fallas.length ? 'rojo' : 'verde';
        linea.motivo = c.fallas.join('; ') || `correcta, corta (${c.medida.lineas} líneas), sin inventar${q.pasaAlEquipo === 'debe' ? ' y pasó al equipo' : ''}`;
        linea.pasoAlEquipo = c.pasa;
        if (c.fallas.length) linea.ensenar = textoEnsenar(q);
      }
    } catch (e) {
      linea.motivo = `Falló el robot: ${e.message}`;
    }
    nuevas.set(q.id, linea);
    console.log(`${linea.id} ${linea.estado} ${linea.motivo.slice(0, 110)}`);
    await dormir(ESPERA_MS);
  }

  const todas = new Map((previo?.lineas || []).map((l) => [l.id, l]));
  for (const [id, l] of nuevas) todas.set(id, l);
  const lineas = examen.preguntas.map((q) => todas.get(q.id)).filter(Boolean);
  const aprobadas = lineas.filter((l) => l.estado === 'verde').length;
  const nota = `${aprobadas} de ${examen.preguntas.length} aprobadas (${lineas.filter((l) => l.estado === 'rojo').length} en rojo, ${lineas.filter((l) => l.estado === 'no-se-pudo').length} sin poder preguntar)`;
  const { carpeta } = escribirSeccion('camila', { empezo, termino: new Date().toISOString(), nota, lineas }, fecha);
  await añadirLeccionesYDetalle(carpeta, lineas, nota, examen);
  console.log(`\nNota: ${nota}\nSalida: ${carpeta}`);
}

import { appendFileSync, writeFileSync, readFileSync as leer } from 'node:fs';
async function añadirLeccionesYDetalle(carpeta, lineas, nota, examen) {
  const f = join(carpeta, 'camila.md');
  const rojas = lineas.filter((l) => l.estado === 'rojo');
  const sinPoder = lineas.filter((l) => l.estado === 'no-se-pudo');
  const porId = new Map(examen.preguntas.map((q) => [q.id, q]));
  let md = leer(f, 'utf8');
  md = md.replace(/\n/, `\n\n**Nota: ${nota}.**\n`);
  md += '\n## Lo que hay que enseñarle\n\n';
  md += rojas.length ? '' : 'Nada: todas las respondidas salieron bien.\n';
  for (const l of rojas) {
    md += `- **${l.id} ${l.titulo}** — Pregunta: «${l.pregunta}».\n  - Qué falló: ${l.motivo}\n  - Qué enseñarle: ${porId.get(l.id)?.ensenar}\n`;
  }
  if (sinPoder.length) {
    md += '\n## Sin poder preguntar (fallo del robot o del sitio, no de Camila)\n\n';
    for (const l of sinPoder) md += `- ${l.id} ${l.titulo}: ${l.motivo}\n`;
  }
  md += '\n## Preguntas y respuestas\n\n';
  for (const l of lineas) {
    md += `### ${l.id} ${l.titulo} — ${l.estado}\n\n- Pregunta: ${l.pregunta}\n- Respuesta de Camila: ${(l.respuesta || '(sin respuesta)').replace(/\n+/g, ' / ')}\n- Calificación: ${l.motivo}\n\n`;
  }
  md += '## Cómo se califica\n\nCorrecta: lo que debe y no debe contener, contra el dato real de la API (o del tabulador de El Vigía; de noche +30 %). Corta: máximo 4 frases y 5 líneas (8 y 9 si son pasos). Sin inventar: nada de enlaces fuera de divoox.com, correos, teléfonos ni «asistente virtual». Equipo: en las trampa que no sabe, debe pasar al equipo. Sin IA.\n';
  writeFileSync(f, md);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
