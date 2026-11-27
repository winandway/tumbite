#!/usr/bin/env node
/**
 * Robot nocturno, línea P2 completa (C-LUGARES-PROPIOS, 27 nov 2026, Gerencia por Richard): cada noche
 * busca TODOS los destinos del tabulador de El Vigía en el buscador de destino del sitio de pruebas,
 * como lo hace la web y la app (ubicación en el centro de El Vigía), y exige que cada uno salga PRIMERO,
 * como lugar propio de la ciudad, con su precio. Deja la sección «destinos» en
 * registros/aceptacion/<fecha>/ (la junta el parte de la mañana).
 *
 *   node scripts/aceptacion/destinos.mjs [--solo "KM 9,Pedeca"]
 *
 * Solo el sitio de pruebas. Una búsqueda por destino (83 por noche), sin cuenta y sin escribir nada.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SITIOS = ['https://staging.tumbite.com', 'https://tumbite-pruebas.sitios.dev'];
/** El centro de El Vigía (el casco urbano del tabulador). */
export const CENTRO_EL_VIGIA = { lat: 8.6219, lng: -71.6506 };

/** Los nombres del tabulador, leídos del archivo que siembra la base (la prueba fija que son 83). */
export function destinosDelTabulador(raiz = RAIZ) {
  const ts = readFileSync(join(raiz, 'apps/servidor/src/tabuladorElVigia.ts'), 'utf8');
  return [...ts.matchAll(/nombre: '([^']+)',\s*precio: (\d+)/g)].map((m) => ({
    nombre: m[1],
    precio: Number(m[2]),
  }));
}

function sitio() {
  const url = (process.env.ACEPTACION_URL || SITIOS[0]).replace(/\/$/, '');
  if (!SITIOS.includes(url))
    throw new Error(`El robot solo corre contra el sitio de pruebas, no contra ${url}.`);
  return url;
}

const fecha =
  process.env.ACEPTACION_FECHA ||
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit' }).format(new Date());

/** 1,6 s entre búsquedas: 83 destinos quedan por debajo del tope de 40 por minuto. */
const PAUSA_MS = 1600;

async function buscar(url, q, intento = 1) {
  const p = new URLSearchParams({
    q,
    lat: String(CENTRO_EL_VIGIA.lat),
    lng: String(CENTRO_EL_VIGIA.lng),
  });
  const r = await fetch(`${url}/datos/lugares/sugerencias?${p}`, {
    headers: { 'x-idioma': 'es' },
    signal: AbortSignal.timeout(15_000),
  });
  // El buscador admite 40 búsquedas por minuto por persona (app.ts): si se pasa, espera y repite.
  if (r.status === 429 && intento < 3) {
    const s = Number(r.headers.get('retry-after')) || 60;
    await new Promise((ok) => setTimeout(ok, s * 1000));
    return buscar(url, q, intento + 1);
  }
  if (!r.ok) throw new Error(`el buscador respondió ${r.status}`);
  return (await r.json()).sugerencias ?? [];
}

async function principal() {
  const url = sitio();
  const i = process.argv.indexOf('--solo');
  const solo = i > 0 ? new Set(process.argv[i + 1].split(',').map((x) => x.trim())) : null;
  const lineas = [];
  for (const [n, d] of destinosDelTabulador().entries()) {
    if (solo && !solo.has(d.nombre)) continue;
    const linea = {
      id: `P2.${n + 1}`,
      titulo: `Buscar «${d.nombre}» desde El Vigía`,
      estado: 'rojo',
      motivo: '',
    };
    if (lineas.length) await new Promise((ok) => setTimeout(ok, PAUSA_MS));
    try {
      const s = await buscar(url, d.nombre);
      const primero = s[0];
      if (!primero) linea.motivo = 'no salió nada';
      else if (primero.principal !== d.nombre)
        linea.motivo = `primero salió «${primero.principal ?? primero.texto}»`;
      else if (!String(primero.id).startsWith('lp~'))
        linea.motivo = 'salió, pero no como lugar propio de la ciudad (sin su punto real)';
      else if (primero.precio == null) linea.motivo = 'salió sin su precio del tabulador';
      else {
        linea.estado = 'verde';
        linea.motivo = `primero, ${(primero.precio / 100).toFixed(2)} USD`;
      }
    } catch (e) {
      linea.motivo = String(e?.message ?? e);
    }
    lineas.push(linea);
  }
  const carpeta = join(process.env.ACEPTACION_SALIDA || join(RAIZ, 'registros/aceptacion'), fecha);
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(
    join(carpeta, 'destinos.json'),
    JSON.stringify({ seccion: 'destinos', lineas }, null, 2),
  );
  const verdes = lineas.filter((l) => l.estado === 'verde').length;
  const md = [
    `# destinos — ${fecha}`,
    '',
    `${verdes} de ${lineas.length} destinos del tabulador de El Vigía salen primero.`,
    '',
    ...lineas.map(
      (l) => `- ${l.estado === 'verde' ? '🟢' : '🔴'} ${l.id} ${l.titulo}: ${l.motivo}`,
    ),
    '',
  ].join('\n');
  writeFileSync(join(carpeta, 'destinos.md'), md);
  console.log(`destinos: ${verdes} de ${lineas.length} en verde (${carpeta})`);
  return verdes === lineas.length ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  principal().then(
    (c) => process.exit(c),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
