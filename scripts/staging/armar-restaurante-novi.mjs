// Restaurante de demo en Novi, Michigan, SOLO en el sitio de pruebas (31 oct 2026, pedido de Richard:
// las pruebas en la calle se hacen en Michigan). Arma «Pizzería Demo Novi» abierta todo el día con
// platos baratos, en la zona de Detroit que abre armar-tienda.mjs (CIUDAD=novi), para probar el
// circuito completo gratis con la tarjeta de prueba 4242. Si ya existe, la deja al día.
// Uso: CLAVE_DEMO=… node scripts/staging/armar-restaurante-novi.mjs
import { execSync } from 'node:child_process';

const URL_PRUEBAS = 'https://staging.tumbite.com';
const CLAVE = process.env.CLAVE_DEMO;
if (!CLAVE) {
  console.error('Falta CLAVE_DEMO (la clave de las cuentas demo del sitio de pruebas).');
  process.exit(2);
}
const LLAVE = execSync(
  'security find-generic-password -a tumbite -s yadominios-llave-ia-tumbite-pruebas -w',
)
  .toString()
  .trim();
const CORREO = 'demo.restaurante.novi@ejemplo.com';

async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { estado: r.status, d: await r.json().catch(() => ({})) };
}
async function sql(consulta, params = []) {
  const r = await fetch('https://yapanel.yadominios.com/api/sitio/v1/consultar_base', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${LLAVE}` },
    body: JSON.stringify({ sql: consulta, params }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`base: ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}
const exigir = (c, t) => {
  if (!c) throw new Error(t);
};

let ent = await api('POST', '/datos/cuentas/entrar', { correo: CORREO, clave: CLAVE });
if (ent.estado !== 200) {
  const reg = await api('POST', '/datos/cuentas/registro', {
    nombre: 'Pizzería Demo Novi',
    correo: CORREO,
    clave: CLAVE,
    rol: 'restaurante',
    telefono: '',
  });
  exigir([200, 201].includes(reg.estado), `registro: ${reg.estado} ${reg.d.error ?? ''}`);
  ent = { estado: 200, d: reg.d };
}
const token = ent.d.token;
await sql(
  "UPDATE usuarios SET correo_confirmado_en = COALESCE(correo_confirmado_en, datetime('now')) WHERE correo = ?",
  [CORREO],
);
const datos = await api(
  'PUT',
  '/datos/mi-restaurante',
  {
    nombre: 'Pizzería Demo Novi',
    direccion: '43155 Main St, Novi, MI 48375',
    lat: 42.4806,
    lng: -83.4755,
    categoria: 'Pizza',
    // Número ficticio (555): sin teléfono la lista de activación no deja abrir.
    telefono: '+12485550100',
  },
  token,
);
exigir([200, 201].includes(datos.estado), `mi-restaurante: ${datos.estado} ${datos.d.error ?? ''}`);
const rid = datos.d.restaurante.id;

// Los platos que ya tiene (se miran en la base: así correr el guion dos veces no los repite).
const ya = await sql('SELECT nombre_es FROM platos WHERE restaurante_id = ?', [rid]);
const nombres = new Set(
  (ya.resultado?.results ?? ya.resultado ?? []).map((f) => f.nombre_es).filter(Boolean),
);
const PLATOS = [
  { nombreEs: 'Porción de pizza de queso', nombreEn: 'Cheese pizza slice', precioCentavos: 300 },
  {
    nombreEs: 'Pizza pepperoni personal',
    nombreEn: 'Personal pepperoni pizza',
    precioCentavos: 800,
  },
  { nombreEs: 'Refresco', nombreEn: 'Soda', precioCentavos: 150 },
];
for (const p of PLATOS) {
  if (nombres.has(p.nombreEs)) continue;
  const r = await api(
    'POST',
    '/datos/mi-restaurante/platos',
    { ...p, categoria: 'Pizza', categoriaEn: 'Pizza', disponible: true },
    token,
  );
  exigir([200, 201].includes(r.estado), `plato ${p.nombreEs}: ${r.estado} ${r.d.error ?? ''}`);
}

// La aprobación la hace nuestro equipo; en pruebas se marca directo en la base.
await sql("UPDATE restaurantes SET estado = 'aprobado' WHERE id = ?", [rid]);
const turnos = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' }));
exigir(
  (await api('PUT', '/datos/mi-restaurante/horarios', { turnos }, token)).estado === 200,
  'horarios',
);
const ab = await api('PATCH', '/datos/mi-restaurante/abierto', { abierto: true }, token);
exigir(ab.estado === 200, `abrir: ${ab.estado} ${ab.d.error ?? ''}`);
await api('GET', '/datos/restaurante/pedidos', undefined, token); // señal: el panel está escuchando

const lista = await api('GET', '/datos/restaurantes?lat=42.5378&lng=-83.4810');
const visto = (lista.d.restaurantes ?? []).find((r) => r.id === rid);
exigir(visto?.abiertoAhora, 'el restaurante no aparece abierto cerca de Walled Lake');
console.log(`Pizzería Demo Novi abierta en pruebas (${visto.distanciaKm} km de Walled Lake)`);
