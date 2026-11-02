/* global Response, crypto, TextEncoder, fetch, AbortSignal, URL, Headers, console */
// Divoox · Progreso (1 nov 2026, pedido de Richard): la página del avance del proyecto para Richard
// y su equipo. Sirve los estáticos (index.html, datos.json…) y tres rutas pequeñas:
//   GET  /datos/marcas  → lo que Richard marcó como «Ya lo hice» (la IA lo lee antes de cada respuesta)
//   POST /datos/marcar  → marcar o desmarcar un punto, con la clave del equipo
//   GET  /datos/salud   → el estado en vivo de divoox.com (sin datos privados)
// La clave del equipo no está en el repositorio: solo su huella SHA-256.
const HUELLA_CLAVE = 'a937141f91d693b02fb8abc404928bc823a78b807b2383d467e18f3925b64753';

const json = (datos, estado = 200) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

async function huella(texto) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function marcas(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, hecho, nota, quien, actualizado_en FROM marcas ORDER BY actualizado_en DESC',
  ).all();
  return results;
}

async function marcar(request, env) {
  let d;
  try {
    d = await request.json();
  } catch {
    return json({ error: 'No pudimos leer lo que mandaste.' }, 400);
  }
  const id = String(d?.id ?? '').slice(0, 80);
  const clave = String(d?.clave ?? '');
  if (!id || !/^[a-z0-9-]+$/.test(id)) return json({ error: 'Punto desconocido.' }, 400);
  if ((await huella(clave.trim())) !== HUELLA_CLAVE)
    return json({ error: 'La clave del equipo no es correcta.' }, 401);
  const hecho = d.hecho ? 1 : 0;
  const nota = String(d.nota ?? '').slice(0, 500);
  const quien = String(d.quien ?? '').slice(0, 60);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO marcas (id, hecho, nota, quien, actualizado_en) VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET hecho = excluded.hecho, nota = excluded.nota,
         quien = excluded.quien, actualizado_en = excluded.actualizado_en`,
    ).bind(id, hecho, nota, quien),
    env.DB.prepare(
      "INSERT INTO historial_marcas (id, hecho, nota, quien, creado_en) VALUES (?, ?, ?, ?, datetime('now'))",
    ).bind(id, hecho, nota, quien),
  ]);
  return json({ ok: true, marcas: await marcas(env) });
}

async function salud() {
  try {
    const r = await fetch('https://divoox.com/datos/salud', {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Divoox-Progreso/1.0' },
    });
    const d = await r.json();
    return json({ ok: Boolean(d.ok), piezas: d.piezas ?? {}, medido: new Date().toISOString() });
  } catch {
    return json({ ok: false, piezas: {}, medido: new Date().toISOString(), sinRespuesta: true });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/datos/marcas' && request.method === 'GET')
        return json({ marcas: await marcas(env) });
      if (url.pathname === '/datos/marcar' && request.method === 'POST')
        return marcar(request, env);
      if (url.pathname === '/datos/salud' && request.method === 'GET') return salud();
    } catch (e) {
      console.error('progreso:', e);
      return json({ error: 'Algo falló de nuestro lado. Intenta otra vez.' }, 500);
    }
    const r = await env.ASSETS.fetch(request);
    // Los datos del avance cambian con cada actualización: nunca se guardan en caché.
    if (url.pathname.endsWith('.json') || url.pathname === '/' || url.pathname.endsWith('.html')) {
      const h = new Headers(r.headers);
      h.set('cache-control', 'no-store');
      h.set('x-robots-tag', 'noindex, nofollow');
      return new Response(r.body, { status: r.status, headers: h });
    }
    return r;
  },
};
