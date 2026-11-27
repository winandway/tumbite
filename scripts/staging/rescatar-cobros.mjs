import { pedirConReintento } from './pedirConReintento.mjs';
// C-COBRO-SEGUNDO-PLANO: en el SITIO DE PRUEBAS el reloj está en pausa. Antes de conciliar se corren
// las tareas de dinero del reloj (liquidaciones y cobros de viajes) para que un cobro cortado a
// medias se cierre por el mismo camino que en producción. Corre desde GitHub con el secreto.
const base = process.env.URL_PRUEBAS;
const secreto = process.env.RELOJ_SECRETO;
if (
  !base ||
  !secreto ||
  !/staging\.tumbite\.com|tumbite-pruebas|^https:\/\/divoox-preview-[a-z0-9-]+\.windoce1\.workers\.dev$/.test(
    base,
  )
) {
  console.error('Solo contra el sitio de pruebas, con URL_PRUEBAS y RELOJ_SECRETO.');
  process.exit(1);
}
const r = await pedirConReintento(`${base}/datos/interno/diagnostico/rescatar-cobros`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-reloj-secreto': secreto },
  body: '{}',
});
const d = await r.json().catch(() => ({}));
console.log(`Rescate de cobros (${r.status}):`, JSON.stringify(d));
process.exit(r.ok && d.ok ? 0 : 1);
