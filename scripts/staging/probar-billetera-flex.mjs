#!/usr/bin/env node
// Divoox Flex · Fase 4: recarga de PUNTA A PUNTA en el SITIO DE PRUEBAS con Stripe en MODO PRUEBA.
// 1) el superadmin de pruebas enciende las recargas de EE. UU. (solo staging);
// 2) una empresa de prueba («zz-…») abre una recarga de 10 dólares con su clave de idempotencia;
// 3) el pago se confirma en Stripe con la tarjeta de PRUEBA pm_card_visa (clave pública + secreto
//    del intento, igual que el formulario de Stripe en la pantalla);
// 4) se espera a que el aviso FIRMADO de Stripe acredite el saldo (el navegador nunca acredita).
// Nunca toca producción: se niega a correr si la dirección no es la del sitio de pruebas.
// Uso: URL_PRUEBAS=https://staging.tumbite.com ADMIN_CORREO=… ADMIN_CLAVE=… DUENO_CORREO=… DUENO_CLAVE=… node scripts/staging/probar-billetera-flex.mjs

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
async function api(metodo, ruta, cuerpo, token, extra = {}) {
  const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      authorization: `Bearer ${token}`,
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}

const admin = await entrar(need('ADMIN_CORREO'), need('ADMIN_CLAVE'));
const dueno = await entrar(need('DUENO_CORREO'), need('DUENO_CLAVE'));
await api(
  'PUT',
  '/datos/admin/finanzas/recargas-config/US',
  {
    activas: true,
    minimo: 500,
    maximo: 100000,
    sugeridos: [1000, 2000, 5000, 10000],
    automaticaPermitida: true,
  },
  admin,
);
const B = '/datos/v1/flex';
const e = (
  await api(
    'POST',
    `${B}/empresas`,
    { nombre: `zz-Billetera ${new Date().toISOString().slice(0, 16)}`, pais: 'US', moneda: 'USD' },
    dueno,
    {
      'idempotency-key': crypto.randomUUID(),
    },
  )
).empresa;
const clave = crypto.randomUUID();
const r = await api('POST', `${B}/empresas/${e.id}/billetera/recargas`, { monto: 1000 }, dueno, {
  'idempotency-key': clave,
});
const r2 = await api('POST', `${B}/empresas/${e.id}/billetera/recargas`, { monto: 1000 }, dueno, {
  'idempotency-key': clave,
});
if (r2.recarga.id !== r.recarga.id) throw new Error('la misma clave abrió dos recargas');
const pi = r.clientSecret.split('_secret_')[0];
if (!r.clavePublica.startsWith('pk_test_'))
  throw new Error('PARADA: la clave pública no es de PRUEBA.');
const conf = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}/confirm`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    key: r.clavePublica,
    client_secret: r.clientSecret,
    payment_method: 'pm_card_visa',
    return_url: `${URL_PRUEBAS}/panel/business`,
  }),
});
const cj = await conf.json();
if (!conf.ok || cj.status !== 'succeeded')
  throw new Error(`Stripe (prueba) no confirmó: ${conf.status} ${cj.error?.message ?? cj.status}`);
let saldo = 0;
for (let i = 0; i < 30 && saldo !== 1000; i++) {
  await new Promise((ok) => setTimeout(ok, 3000));
  saldo = (await api('GET', `${B}/empresas/${e.id}/billetera`, undefined, dueno)).saldo.disponible;
}
if (saldo !== 1000)
  throw new Error(`el aviso de Stripe no acreditó la recarga (disponible ${saldo})`);
const comp = await api('GET', `${B}/empresas/${e.id}/comprobantes`, undefined, dueno);
if (comp.comprobantes.length !== 1) throw new Error('falta el comprobante de la recarga');
console.log(
  JSON.stringify({
    ok: true,
    empresa: e.id,
    recarga: r.recarga.id,
    intento: pi,
    disponible: saldo,
    comprobante: comp.comprobantes[0].numero,
  }),
);
