// Conciliación de saldos en el SITIO DE PRUEBAS después del recorrido: el libro del día cuadra
// por dentro y cada cobro coincide con Stripe (modo prueba). Corre desde GitHub con el secreto.
const base = process.env.URL_PRUEBAS;
const secreto = process.env.RELOJ_SECRETO;
if (!base || !secreto || !/staging\.tumbite\.com|tumbite-pruebas/.test(base)) {
  console.error('Solo contra el sitio de pruebas, con URL_PRUEBAS y RELOJ_SECRETO.');
  process.exit(1);
}
const r = await fetch(`${base}/datos/interno/diagnostico/conciliacion`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-reloj-secreto': secreto },
  body: '{}',
});
const d = await r.json().catch(() => ({}));
for (const c of d.casos ?? [])
  console.log(
    `${c.ok ? 'OK   ' : 'FALLA'} ${c.nombre}${c.detalle && !c.ok ? ` — ${c.detalle}` : ''}`,
  );
console.log(d.ok ? 'CONCILIACIÓN EN VERDE' : `CONCILIACIÓN CON FALLAS (${r.status})`);
process.exit(d.ok ? 0 : 1);
