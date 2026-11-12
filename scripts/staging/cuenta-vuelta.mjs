// C-PRESUPUESTO-VUELTA-PRUEBAS: al terminar una corrida contra el sitio de pruebas, dice cuántas
// filas leyó y escribió esa vuelta y cuántas van hoy, y falla si el servidor la frenó.
// Uso (desde GitHub): URL_PRUEBAS=… RELOJ_SECRETO=… VUELTA_PRUEBAS=… node scripts/staging/cuenta-vuelta.mjs
const base = process.env.URL_PRUEBAS;
const secreto = process.env.RELOJ_SECRETO;
const id = process.env.VUELTA_PRUEBAS;
if (!base || !secreto || !id) {
  console.log('cuenta de la vuelta: faltan datos, se omite');
  process.exit(0);
}
const r = await fetch(`${base}/datos/interno/diagnostico/vuelta`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-reloj-secreto': secreto },
  body: JSON.stringify({ id }),
});
const d = await r.json().catch(() => ({}));
console.log(`FILAS-VUELTA ${JSON.stringify(d)}`);
if (d.vuelta?.frenada) {
  console.error('::error::La vuelta de pruebas se frenó por pasar del presupuesto de filas');
  process.exit(1);
}
