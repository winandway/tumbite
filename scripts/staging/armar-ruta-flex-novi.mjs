// Ruta de Divoox Flex de prueba en Michigan, SOLO en el sitio de pruebas (31 oct 2026, Richard: «la
// parte de logística no está terminada»). Arma una empresa de demo en Novi, tres envíos con dirección
// y ubicación cerca de Walled Lake y una ruta asignada al repartidor demo, para repasar «Mi ruta» de
// punta a punta en el simulador o en un teléfono. Se puede correr varias veces (crea otra ruta).
// Uso: CLAVE_DEMO=… node scripts/staging/armar-ruta-flex-novi.mjs
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

async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      // La API de Flex pide una clave única por operación (no repite envíos si se reintenta).
      ...(metodo !== 'GET' ? { 'idempotency-key': crypto.randomUUID() } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? JSON.stringify(d)}`);
  return d;
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
async function entrar(correo, nombre, rol) {
  try {
    return await api('POST', '/datos/cuentas/entrar', { correo, clave: CLAVE });
  } catch {
    const r = await api('POST', '/datos/cuentas/registro', {
      nombre,
      correo,
      clave: CLAVE,
      rol,
      telefono: '',
    });
    await sql("UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = ?", [
      correo,
    ]);
    return r;
  }
}

const dueno = await entrar('demo.flex.novi@ejemplo.com', 'Logística Demo Novi', 'cliente');
const misEmpresas = await api('GET', '/datos/v1/flex/empresas', undefined, dueno.token).catch(
  () => ({ empresas: [] }),
);
const empresa =
  (misEmpresas.empresas ?? []).find((e) => e.nombre === 'Logística Demo Novi') ??
  (
    await api(
      'POST',
      '/datos/v1/flex/empresas',
      { nombre: 'Logística Demo Novi', pais: 'US', moneda: 'USD' },
      dueno.token,
    )
  ).empresa;
const E = `/datos/v1/flex/empresas/${empresa.id}`;
const centro = (
  await api(
    'POST',
    `${E}/centros`,
    {
      nombre: 'Centro de prueba Novi',
      direccion: '43000 Grand River Ave, Novi, MI 48375',
      pais: 'US',
      ciudad: 'Novi',
      lat: 42.4775,
      lng: -83.4766,
    },
    dueno.token,
  )
).centro;
const corrida = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '');
const base = { centroId: centro.id, paquetes: [{ descripcion: 'Caja de prueba', pesoG: 1500 }] };
const envios = [];
for (const [i, e] of [
  { direccion: '1499 E West Maple Rd, Walled Lake, MI 48390', lat: 42.5373, lng: -83.4583 },
  { direccion: '100 N Pontiac Trl, Walled Lake, MI 48390', lat: 42.5377, lng: -83.4811 },
  { direccion: '1201 W West Maple Rd, Walled Lake, MI 48390', lat: 42.5393, lng: -83.5004 },
].entries())
  envios.push(
    (
      await api(
        'POST',
        `${E}/envios`,
        {
          ...base,
          ...e,
          referenciaExterna: `PRUEBA-${corrida}-${i + 1}`,
          destinatarioNombre: `Destinatario de prueba ${i + 1}`,
          destinatarioTelefono: `+1248555010${i + 1}`,
        },
        dueno.token,
      )
    ).envio,
  );
const conductor = await entrar('demo.repartidor@ejemplo.com', 'Demo Repartidor', 'repartidor');
await api(
  'POST',
  `${E}/conductores`,
  { correo: 'demo.repartidor@ejemplo.com', vinculo: 'propio' },
  dueno.token,
).catch((x) => console.log('conductor ya vinculado:', String(x).slice(0, 80)));
const ruta = (
  await api(
    'POST',
    `${E}/rutas`,
    {
      nombre: `Ruta de prueba Walled Lake ${corrida}`,
      centroId: centro.id,
      envioIds: envios.map((x) => x.id),
    },
    dueno.token,
  )
).ruta;
await api(
  'POST',
  `${E}/rutas/${ruta.id}/asignar`,
  { conductorId: conductor.usuario.id },
  dueno.token,
);
console.log(`Ruta ${ruta.id} con ${envios.length} envíos asignada a demo.repartidor@ejemplo.com`);
