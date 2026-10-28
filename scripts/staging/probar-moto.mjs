#!/usr/bin/env node
// Divoox Moto · M1 en el SITIO DE PRUEBAS: el superadmin de pruebas enciende Moto en Miami, pone una
// tarifa DE PRUEBA y un pasajero de prueba cotiza un viaje con precio fijo. Después se comprueba,
// solo leyendo, que en producción Moto sigue «muy pronto» (C-MOTO-SOLO-PRUEBAS).
// Nunca escribe en producción: se niega a correr si la dirección no es la del sitio de pruebas.
// Uso: URL_PRUEBAS=https://staging.tumbite.com ADMIN_CORREO=… ADMIN_CLAVE=… CLIENTE_CORREO=… CLIENTE_CLAVE=… node scripts/staging/probar-moto.mjs

const URL_PRUEBAS = (process.env.URL_PRUEBAS ?? '').replace(/\/$/, '');
if (!/^https:\/\/staging\./.test(URL_PRUEBAS)) {
  console.error('PARADA: esto solo corre contra el sitio de pruebas (staging).');
  process.exit(1);
}
const need = (k) => {
  // eslint-disable-next-line security/detect-object-injection -- nombres fijos de variables
  const v = process.env[k];
  if (!v) {
    console.error(`Falta ${k}.`);
    process.exit(1);
  }
  return v;
};

async function entrar(correo, clave) {
  const r = await fetch(`${URL_PRUEBAS}/datos/cuentas/entrar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ correo, clave }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`entrar ${correo}: ${r.status} ${d.error ?? ''}`);
  return d.token;
}
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
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}

const ZONA = 'US-FL-MIAMI';
const admin = await entrar(need('ADMIN_CORREO'), need('ADMIN_CLAVE'));
const cliente = await entrar(need('CLIENTE_CORREO'), need('CLIENTE_CLAVE'));
const lista = await api('GET', '/datos/admin/servicios', undefined, admin);
if (!lista.implementadosEnEsteCodigo.includes('moto'))
  throw new Error('el sitio de pruebas no trae Moto implementada');
await api('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, admin);
await api('PUT', `/datos/admin/servicios/moto/zonas/${ZONA}`, { estado: 'disponible' }, admin);
await api(
  'POST',
  '/datos/admin/viajes/tarifas',
  {
    servicio: 'moto',
    zona: ZONA,
    // Valores de PRUEBA (no comerciales): los reales los decide Richard.
    tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400, porMinutoEspera: 20 },
    dePrueba: true,
    motivo: 'Tarifa de prueba para M1 (staging)',
  },
  admin,
);
const { cotizacion } = await api(
  'POST',
  '/datos/viajes/cotizar',
  {
    servicio: 'moto',
    origen: { lat: 25.7617, lng: -80.1918, direccion: 'Centro de Miami' },
    destino: { lat: 25.79, lng: -80.13, direccion: 'Miami Beach' },
  },
  cliente,
);
const d = cotizacion.desglose;
if (
  d.base + d.distancia + d.tiempo + d.ajusteMinimo + d.dinamico + d.cargoFijo + d.redondeo !==
  cotizacion.total
)
  throw new Error('el desglose no suma el total');
const salud = await api('GET', '/datos/salud');
if (salud.piezas?.servicios !== 'ok')
  throw new Error(`salud de servicios: ${salud.piezas?.servicios}`);
// Producción, solo lectura: Moto no puede aparecer disponible.
const prod = await (await fetch('https://divoox.com/datos/servicios')).json();
const motoProd = prod.servicios?.find((s) => s.id === 'moto');
if (!motoProd || motoProd.estado === 'disponible')
  throw new Error('PELIGRO: Moto aparece disponible en producción');
console.log(
  JSON.stringify({
    ok: true,
    cotizacion: cotizacion.id,
    total: cotizacion.total,
    moneda: cotizacion.moneda,
    distanciaM: cotizacion.distanciaM,
    duracionS: cotizacion.duracionS,
    dePrueba: cotizacion.dePrueba,
    produccionMoto: motoProd.estado,
  }),
);
