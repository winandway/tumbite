// C-ESTOY-AQUI (27 nov 2026, meta de Gerencia) — Venezuela, El Vigía. Crea UNA VEZ la tarea de medición
// de los nueve lugares que se pusieron desde el mapa y nadie confirmó en la calle, SIN asignarla: Richard
// elige al conductor en el panel («Medir lugares en la calle» → tres puntos → «Cambiar conductores»).
// Si ya existe una tarea abierta con este nombre, no crea otra.
// Uso: URL_DIVOOX=https://divoox.com TOKEN_EQUIPO=<token de una cuenta del equipo> node scripts/mediciones/crear-tarea-vigia.mjs
const URL = process.env.URL_DIVOOX ?? 'https://divoox.com';
const TOKEN = process.env.TOKEN_EQUIPO;
if (!TOKEN) throw new Error('Falta TOKEN_EQUIPO');
const ZONA = 'VE-MER-ELVIGIA';
const TITULO = 'Confirmar en la calle: nueve puntos puestos desde el mapa';
const NOTA =
  'Mide donde de verdad se deja al pasajero (la entrada, la parada o el letrero que usa la gente), no en medio de la carretera.';
const NOMBRES = [
  'La Vega II',
  'Pedeca',
  'Carlos Andrés',
  'Culebria',
  'KM 12',
  'KM 15',
  'El Puerto',
  'Aguas Clara',
  'Colinas de Buenos Aires',
];

async function pedir(metodo, ruta, cuerpo) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}

const ya = await pedir('GET', `/datos/admin/mediciones?zona=${ZONA}`);
const abierta = ya.tareas.find((t) => t.titulo === TITULO && t.estado === 'abierta');
if (abierta) {
  console.log(
    `ya existe: ${abierta.id} (${abierta.lugares.length} lugares, ${abierta.asignados.length} asignados)`,
  );
  process.exit(0);
}
const { lugares } = await pedir('GET', `/datos/admin/lugares-propios?zona=${ZONA}`);
const ids = NOMBRES.map((n) => {
  const l = lugares.find((x) => x.nombre === n && x.activo);
  if (!l) throw new Error(`No está el lugar «${n}» en El Vigía`);
  return l.id;
});
const r = await pedir('POST', '/datos/admin/mediciones', {
  zona: ZONA,
  titulo: TITULO,
  nota: NOTA,
  lugares: ids,
  conductores: [],
});
const comprobada = (await pedir('GET', `/datos/admin/mediciones?zona=${ZONA}`)).tareas.find(
  (t) => t.id === r.tarea.id,
);
if (comprobada?.lugares.length !== 9 || comprobada.asignados.length !== 0)
  throw new Error('La tarea no quedó con nueve lugares y sin asignar');
console.log(`tarea creada: ${r.tarea.id} · 9 lugares · sin asignar`);
