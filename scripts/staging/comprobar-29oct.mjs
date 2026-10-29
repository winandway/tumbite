// Comprueba en el sitio de pruebas lo publicado el 29 oct 2026, solo por la API y sin pagar nada.
// Uso: CLAVE_DEMO=… node scripts/staging/comprobar-29oct.mjs
const URL = process.env.URL_PRUEBAS ?? 'https://staging.tumbite.com';
const CLAVE = process.env.CLAVE_DEMO;
if (!CLAVE) throw new Error('Falta CLAVE_DEMO (la de las cuentas demo de pruebas).');
let fallos = 0;
async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(URL + ruta, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    datos = { texto };
  }
  return { estado: r.status, datos };
}
const ver = (nombre, ok, detalle = '') => {
  if (!ok) fallos++;
  console.log(`${ok ? 'OK ' : 'MAL'} ${nombre}${detalle ? ` · ${detalle}` : ''}`);
};
const entrar = async (correo) =>
  (await api('POST', '/datos/cuentas/entrar', { correo, clave: CLAVE })).datos.token;
const cli = await entrar('demo.cliente@ejemplo.com');
const rep = await entrar('demo.repartidor@ejemplo.com');
const sop = await entrar('demo.soporte@ejemplo.com');

const eq = await api('GET', '/datos/admin/equipo', undefined, sop);
ver(
  'equipo interno',
  eq.estado === 200 && Array.isArray(eq.datos.equipo),
  `mi perfil ${eq.datos.miPerfil}`,
);
const acc = await api('GET', '/datos/admin/equipo/acciones', undefined, sop);
ver('registro de acciones', acc.estado === 200);
const av = await api('GET', '/datos/admin/mis-avisos', undefined, sop);
ver('mis avisos', av.estado === 200 && av.datos.avisos?.length === 4);
const hoy = new Date().toISOString().slice(0, 10);
const inf = await api('GET', `/datos/admin/informes?desde=2026-10-01&hasta=${hoy}`, undefined, sop);
ver('informes', inf.estado === 200, `${inf.datos.filas?.length} filas`);
const csv = await fetch(`${URL}/datos/admin/informes?desde=2026-10-01&hasta=${hoy}&formato=csv`, {
  headers: { authorization: `Bearer ${sop}` },
});
ver('informe en CSV', csv.ok && (csv.headers.get('content-type') ?? '').includes('text/csv'));
const pl = await api('GET', '/datos/admin/tickets/plantillas', undefined, sop);
ver('respuestas guardadas', pl.estado === 200 && Array.isArray(pl.datos.plantillas));
const tk = await api('GET', '/datos/admin/tickets', undefined, sop);
ver(
  'bandeja con prioridad',
  tk.estado === 200 && (tk.datos.tickets ?? []).every((t) => 'prioridad' in t),
);
const tu = await api('GET', '/datos/repartidor/turnos', undefined, rep);
ver('turnos del repartidor', tu.estado === 200 && Array.isArray(tu.datos.turnos));
// Un turno de prueba pasado mañana, y se cancela enseguida (no deja nada a medias).
const paso = 30 * 60_000;
const inicio = new Date(Math.ceil((Date.now() + 2 * 86_400_000) / paso) * paso);
const nuevo = await api(
  'POST',
  '/datos/repartidor/turnos',
  { inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 2 * 3_600_000).toISOString() },
  rep,
);
ver('reservar turno', nuevo.estado === 201, nuevo.datos.error ?? '');
if (nuevo.datos.id) {
  const borrar = await api('DELETE', `/datos/repartidor/turnos/${nuevo.datos.id}`, undefined, rep);
  ver('cancelar turno', borrar.estado === 200);
}
const mios = await api('GET', '/datos/mis-pedidos', undefined, cli);
ver(
  'pedidos del cliente (fila del inicio)',
  mios.estado === 200,
  `${mios.datos.pedidos?.filter((p) => p.estado === 'entregado').length} entregados`,
);
console.log(fallos ? `${fallos} con problemas` : 'todo bien');
process.exit(fallos ? 1 : 0);
