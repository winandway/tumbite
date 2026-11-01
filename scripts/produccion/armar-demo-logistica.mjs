// Bloque de demostración de Divoox Flex para Richard EN PRODUCCIÓN (31 oct 2026, LG6, pedido de
// Richard: «un bloque asignado para ver las funciones en el demo… tengo impresora»). Arma con las
// cuentas del revisor (las mismas que usa Richard en TestFlight): una empresa de demo con sus datos
// legales, un centro en Novi, seis envíos reales por Walled Lake (cinco a la puerta y uno en un punto
// de encuentro), una ruta asignada al Driver del revisor y un PDF con las seis etiquetas listo para
// imprimir. No mueve dinero: Flex no cobra en EE. UU. y las recargas están apagadas.
// Las claves se leen de ~/.config/tumbite/revisores-tiendas (nunca del repositorio).
// Uso: node scripts/produccion/armar-demo-logistica.mjs
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { chromium } from 'playwright';

const SITIO = 'https://divoox.com';
// La ruta del archivo de cuentas es fija (la carpeta privada de esta Mac).
const cuentas = Object.fromEntries(
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs
    .readFileSync(join(os.homedir(), '.config', 'tumbite', 'revisores-tiendas'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t'))
    .map(([correo, clave, rol]) => [rol, { correo, clave }]),
);
const clave = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${SITIO}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-idioma': 'es',
      ...(metodo !== 'GET' ? { 'idempotency-key': clave() } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? JSON.stringify(d)}`);
  return d;
}
const entrar = async (rol) => {
  const c = new Map(Object.entries(cuentas)).get(rol);
  return api('POST', '/datos/cuentas/entrar', { correo: c.correo, clave: c.clave });
};

const dueno = await entrar('cliente');
const conductor = await entrar('repartidor');
const NOMBRE = 'Divoox Demo Logística';
const { empresas } = await api('GET', '/datos/v1/flex/empresas', undefined, dueno.token);
const empresa =
  empresas.find((e) => e.nombre === NOMBRE) ??
  (
    await api(
      'POST',
      '/datos/v1/flex/empresas',
      {
        nombre: NOMBRE,
        razonSocial: 'Windoce LLC (demostración)',
        pais: 'US',
        moneda: 'USD',
        numeroFiscal: '00-0000000',
        direccionFiscal: '43000 Grand River Ave, Novi, MI 48375',
        representante: 'Equipo Divoox (Soporte)',
        telefono: '+12485550100',
      },
      dueno.token,
    )
  ).empresa;
const E = `/datos/v1/flex/empresas/${empresa.id}`;
const { centros } = await api('GET', `${E}/centros`, undefined, dueno.token);
const centro =
  centros.find((c) => c.nombre === 'Centro Demo Novi') ??
  (
    await api(
      'POST',
      `${E}/centros`,
      {
        nombre: 'Centro Demo Novi',
        direccion: '43000 Grand River Ave, Novi, MI 48375',
        pais: 'US',
        ciudad: 'Novi',
        lat: 42.4775,
        lng: -83.4766,
        zonaHoraria: 'America/Detroit',
      },
      dueno.token,
    )
  ).centro;

const corrida = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '');
const destinos = [
  { direccion: '1499 E West Maple Rd, Walled Lake, MI 48390', lat: 42.5373, lng: -83.4583 },
  { direccion: '100 N Pontiac Trl, Walled Lake, MI 48390', lat: 42.5377, lng: -83.4811 },
  { direccion: '1201 W West Maple Rd, Walled Lake, MI 48390', lat: 42.5393, lng: -83.5004 },
  { direccion: '27500 Novi Rd, Novi, MI 48377', lat: 42.4958, lng: -83.4752 },
  { direccion: '26132 Ingersol Dr, Novi, MI 48375', lat: 42.4806, lng: -83.4655 },
  {
    direccion: 'Gas station, 13 Mile Rd & Novi Rd, Novi, MI',
    lat: 42.5232,
    lng: -83.4755,
    entrega: 'encuentro',
    puntoEncuentro: 'Estación de servicio de 13 Mile y Novi Rd',
  },
];
const envios = [];
for (const [i, d] of destinos.entries())
  envios.push(
    (
      await api(
        'POST',
        `${E}/envios`,
        {
          centroId: centro.id,
          referenciaExterna: `DEMO-${corrida}-${i + 1}`,
          destinatarioNombre: `Cliente de demostración ${i + 1}`,
          destinatarioTelefono: '',
          // El primero va a la cuenta del cliente del revisor: aparece en su «Mis paquetes».
          destinatarioCorreo: i === 0 ? cuentas.cliente.correo : '',
          direccion: d.direccion,
          lat: d.lat,
          lng: d.lng,
          entrega: d.entrega ?? 'domicilio',
          puntoEncuentro: d.puntoEncuentro ?? '',
          paquetes: [{ descripcion: `Caja de demostración ${i + 1}`, pesoG: 1000 }],
        },
        dueno.token,
      )
    ).envio,
  );
await api(
  'POST',
  `${E}/conductores`,
  { correo: cuentas.repartidor.correo, vinculo: 'propio' },
  dueno.token,
).catch(() => undefined);
const ruta = (
  await api(
    'POST',
    `${E}/rutas`,
    { nombre: `Ruta demo Novi ${corrida}`, centroId: centro.id, envioIds: envios.map((x) => x.id) },
    dueno.token,
  )
).ruta;
await api(
  'POST',
  `${E}/rutas/${ruta.id}/asignar`,
  { conductorId: conductor.usuario.id },
  dueno.token,
);

// Etiquetas para imprimir: seis por hoja, horizontal (regla de Richard para todo PDF).
const tarjetas = [];
for (const [i, e] of envios.entries()) {
  const p = e.paquetes[0];
  const destino = destinos.at(i);
  const qr = await QRCode.toDataURL(`dvx:${p.codigoEtiqueta}`, { margin: 0, width: 220 });
  tarjetas.push(`<div class="et">
    <div class="arriba"><b>DIVOOX FLEX</b><span>Parada ${i + 1} de ${envios.length}</span></div>
    <div class="medio"><img src="${qr}"><div>
      <div class="seg">${p.codigoSeguimiento}</div>
      <div class="dest">${e.destinatarioNombre}</div>
      <div class="dir">${destino?.puntoEncuentro ? `Punto de encuentro: ${destino.puntoEncuentro}` : e.direccion}</div>
      <div class="ref">${e.referenciaExterna}</div>
    </div></div>
    <div class="abajo">Etiqueta ${p.codigoEtiqueta} · Divoox Demo Logística · Centro Demo Novi</div>
  </div>`);
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter landscape; margin: 0.35in; }
body { font-family: Arial, sans-serif; margin: 0; }
.hoja { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 3.6in); gap: 0.15in; }
.et { border: 2px dashed #555; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; }
.arriba { display: flex; justify-content: space-between; font-size: 13px; }
.arriba b { background: #1F4D69; color: #fff; padding: 3px 8px; border-radius: 4px; }
.medio { display: flex; gap: 10px; align-items: center; }
.medio img { width: 1.55in; height: 1.55in; }
.seg { font-size: 15px; font-weight: bold; letter-spacing: 1px; }
.dest { font-size: 14px; margin-top: 6px; }
.dir { font-size: 12px; color: #333; margin-top: 4px; }
.ref { font-size: 11px; color: #777; margin-top: 4px; }
.abajo { font-size: 10px; color: #555; }
</style></head><body><div class="hoja">${tarjetas.join('')}</div></body></html>`;
const salida = join(process.cwd(), 'privado', 'etiquetas-demo-logistica.pdf');
fs.mkdirSync(join(process.cwd(), 'privado'), { recursive: true });
const nav = await chromium.launch();
const pag = await nav.newPage();
await pag.setContent(html, { waitUntil: 'load' });
await pag.pdf({ path: salida, landscape: true, printBackground: true, format: 'Letter' });
await nav.close();
console.log(
  `Empresa ${empresa.id} · ruta ${ruta.id} con ${envios.length} envíos asignada a ${cuentas.repartidor.correo}`,
);
console.log(`Etiquetas: ${salida}`);
