#!/usr/bin/env node
// Tiendas (C-TIENDAS-VITRINA): arma en el SITIO DE PRUEBAS un supermercado de ejemplo para probar la
// compra de punta a punta y sacar las capturas originales de Docs. Datos neutros («Mercado Demo»,
// «Brand Sample»), abierto en Miami cerca de Pizzería Demo. Se puede correr varias veces: actualiza.
// Nunca toca producción: se niega si la dirección no es la del sitio de pruebas.
// Uso: URL_PRUEBAS=https://staging.tumbite.com CLAVE_DEMO=… node scripts/staging/armar-tienda.mjs
import { execSync } from 'node:child_process';

const URL_PRUEBAS = (process.env.URL_PRUEBAS ?? 'https://staging.tumbite.com').replace(/\/$/, '');
if (!/^https:\/\/staging\./.test(URL_PRUEBAS)) {
  console.error('PARADA: esto solo corre contra el sitio de pruebas (staging).');
  process.exit(1);
}
const CLAVE = process.env.CLAVE_DEMO ?? '';
if (!CLAVE) {
  console.error('Falta CLAVE_DEMO (la de las cuentas demo de pruebas).');
  process.exit(1);
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

const CORREO = 'demo.mercado@ejemplo.com';
let ent = await api('POST', '/datos/cuentas/entrar', { correo: CORREO, clave: CLAVE });
if (ent.estado !== 200) {
  const reg = await api('POST', '/datos/cuentas/registro', {
    nombre: 'Mercado Demo',
    correo: CORREO,
    clave: CLAVE,
    rol: 'restaurante',
    telefono: '',
  });
  exigir(reg.estado === 201 || reg.estado === 200, `registro: ${reg.estado} ${reg.d.error ?? ''}`);
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
    nombre: 'Mercado Demo',
    direccion: '300 Biscayne Blvd, Miami, FL',
    lat: 25.7743,
    lng: -80.1868,
    categoria: 'Supermercado',
    telefono: '3055550199',
  },
  token,
);
exigir([200, 201].includes(datos.estado), `mi-restaurante: ${datos.estado} ${datos.d.error ?? ''}`);
const tid = datos.d.restaurante.id;
exigir(
  (await api('PUT', '/datos/mi-restaurante/tipo', { tipo: 'mercado' }, token)).estado === 200,
  'tipo',
);

const hoja = [
  'sku,barcode,name_en,name_es,brand,size,size_unit,category_1,price,sale_price,available,stock_quantity,restriction,sold_by,average_weight,weight_unit',
  'MD-001,,Spring water,Agua de manantial,Brand Sample,500,mL,Drinks,1.25,,yes,48,,,,',
  'MD-002,,Orange juice,Jugo de naranja,Brand Sample,52,fl oz,Drinks,4.99,3.99,yes,20,,,,',
  'MD-003,,Sparkling water,Agua con gas,Brand Sample,1,L,Drinks,1.80,,yes,30,,,,',
  'MD-004,,Whole milk,Leche entera,Brand Sample,1,gal,Dairy,4.20,,yes,20,,,,',
  'MD-005,,Greek yogurt,Yogur griego,Brand Sample,32,oz,Dairy,5.49,,yes,15,,,,',
  'MD-006,,Cheddar cheese,Queso cheddar,Brand Sample,8,oz,Dairy,3.79,,yes,18,,,,',
  'MD-007,,White rice,Arroz blanco,Brand Sample,2,lb,Pantry,2.80,,yes,35,,,,',
  'MD-008,,Ground coffee,Café molido,Brand Sample,12,oz,Pantry,7.50,6.50,yes,15,,,,',
  'MD-009,,Black beans,Frijoles negros,Brand Sample,15,oz,Pantry,1.29,,yes,40,,,,',
  'MD-010,,Bananas,Guineos,,1,lb,Produce,0.69,,yes,,,weight,2,lb',
  'MD-011,,Avocados,Aguacates,,1,each,Produce,1.50,,yes,30,,,,',
  'MD-012,,Tomatoes,Tomates,,1,lb,Produce,1.99,,yes,,,weight,1.5,lb',
  'MD-013,,Paper towels,Toallas de papel,Brand Sample,6,each,Household,9.99,,yes,12,,,,',
  'MD-014,,Dish soap,Jabón de platos,Brand Sample,24,fl oz,Household,3.49,,yes,14,,,,',
  'MD-015,,Light beer,Cerveza ligera,Brand Sample,355,mL,Beer and wine,1.80,,yes,60,alcohol,,,',
  'MD-016,,Sold out soda,Refresco agotado,Brand Sample,2,L,Drinks,2.50,,no,0,,,,',
].join('\n');
const imp = await api(
  'POST',
  '/datos/mi-restaurante/productos/importar',
  { csv: hoja, confirmar: true },
  token,
);
exigir(
  imp.estado === 200 && imp.d.guardado,
  `planilla: ${imp.estado} ${imp.d.error ?? ''} ${JSON.stringify(imp.d.errores ?? [])}`,
);
console.log(
  `planilla: ${imp.d.nuevos} nuevos, ${imp.d.actualizados} actualizados, ${imp.d.totalErrores} con error`,
);

// La aprobación la hace nuestro equipo; en pruebas se marca directo en la base.
await sql("UPDATE restaurantes SET estado = 'aprobado' WHERE id = ?", [tid]);
const turnos = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' }));
exigir(
  (await api('PUT', '/datos/mi-restaurante/horarios', { turnos }, token)).estado === 200,
  'horarios',
);
const ab = await api('PATCH', '/datos/mi-restaurante/abierto', { abierto: true }, token);
exigir(ab.estado === 200, `abrir: ${ab.estado} ${ab.d.error ?? ''}`);
await api('GET', '/datos/restaurante/pedidos', undefined, token); // señal: el panel está escuchando

// Los servicios de tiendas se encienden para la zona de la tienda, como Moto (superadmin de pruebas).
const sop = await api('POST', '/datos/cuentas/entrar', {
  correo: 'demo.soporte@ejemplo.com',
  clave: CLAVE,
});
exigir(sop.estado === 200, `soporte: ${sop.estado} ${sop.d.error ?? ''}`);
const zona =
  (await sql('SELECT zona_id FROM restaurantes WHERE id = ?', [tid])).resultado?.filas?.[0]
    ?.zona_id ?? (await sql('SELECT zona_id FROM restaurantes WHERE id = ?', [tid]));
const zonaId =
  typeof zona === 'string' ? zona : JSON.stringify(zona).match(/"zona_id":"([^"]+)"/)?.[1];
exigir(zonaId, 'no encontré la zona de la tienda');
for (const s of ['mercado', 'farmacia', 'licores', 'mas']) {
  const a = await api('PUT', `/datos/admin/servicios/${s}`, { estado: 'disponible' }, sop.d.token);
  const b = await api(
    'PUT',
    `/datos/admin/servicios/${s}/zonas/${zonaId}`,
    { estado: 'disponible' },
    sop.d.token,
  );
  exigir(
    a.estado === 200 && b.estado === 200,
    `encender ${s}: ${a.estado}/${b.estado} ${a.d.error ?? b.d.error ?? ''}`,
  );
}
console.log(`servicios de tiendas encendidos en la zona ${zonaId}`);

const cerca = await api('GET', '/datos/tiendas?servicio=mercado&lat=25.78&lng=-80.2');
exigir(cerca.estado === 200, `vitrina: ${cerca.estado} ${cerca.d.error ?? ''}`);
exigir(
  cerca.d.tiendas.some((t) => t.id === tid),
  'Mercado Demo no sale en la vitrina',
);
const prods = await api('GET', `/datos/tiendas/${tid}/productos`);
exigir(
  !prods.d.productos.some((p) => p.nombre === 'Refresco agotado'),
  'un agotado salió a la venta',
);
console.log(
  `vitrina: ${cerca.d.tiendas.length} tienda(s) cerca; Mercado Demo con ${prods.d.productos.length} productos a la venta`,
);
const prod = await fetch('https://divoox.com/datos/tiendas?servicio=mercado&lat=25.78&lng=-80.2');
console.log(`producción: /datos/tiendas responde ${prod.status} (tiene que ser 404: apagado)`);
console.log(`tienda ${tid}`);
