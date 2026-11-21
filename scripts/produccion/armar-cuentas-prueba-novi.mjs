// Cuentas de PRUEBA para la prueba en vivo de Carro en Novi, Michigan (C-CUENTA-PRUEBA, 21 nov 2026,
// pedido de Gerencia) — Estados Unidos. Se puede correr las veces que haga falta: no duplica nada.
//
// Arma en la base (producción por defecto; --pruebas para el sitio de pruebas):
//   - «Soporte Prueba Pasajero» (cliente) y «Soporte Prueba Conductor» (conductor), las dos marcadas de
//     prueba (usuarios.es_prueba = 1), con correo de divoox.com y entrada solo con clave;
//   - el conductor con su carro aprobado, sus papeles y requisitos de Carro aprobados por un año, su
//     habilitación de Carro y Carro encendido en sus servicios (desconectado: se conecta él en la app);
//   - Carro encendido en Novi SOLO para cuentas de prueba (servicios_prueba) y una tarifa de prueba de
//     Carro en Novi si no hay una activa. El público de Novi sigue sin ver Carro.
// Las claves se generan la primera vez y se guardan SOLO en ~/.config/tumbite/cuentas-prueba-richard
// (carpeta 700, archivo 600): «rol, correo, clave», un renglón por cuenta. Nunca se imprimen.
// Uso: node scripts/produccion/armar-cuentas-prueba-novi.mjs [--pruebas]
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- archivo fijo de la carpeta de configuración; claves de un mapa propio */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PRUEBAS = process.argv.includes('--pruebas');
const LLAVE = execFileSync(
  'security',
  ['find-generic-password', '-s', `yadominios-llave-ia-tumbite${PRUEBAS ? '-pruebas' : ''}`, '-w'],
  { encoding: 'utf8' },
).trim();
const ZONA = 'US-MI-NOVI';
const CARPETA = join(homedir(), '.config', 'tumbite');
const ARCHIVO = join(
  CARPETA,
  PRUEBAS ? 'cuentas-prueba-richard-pruebas' : 'cuentas-prueba-richard',
);
const CUENTAS = {
  pasajero: {
    correo: 'soporte.prueba.pasajero@divoox.com',
    nombre: 'Soporte Prueba Pasajero',
    rol: 'cliente',
  },
  conductor: {
    correo: 'soporte.prueba.conductor@divoox.com',
    nombre: 'Soporte Prueba Conductor',
    rol: 'repartidor',
  },
};

async function sql(q, params = []) {
  const r = await fetch('https://yapanel.yadominios.com/api/sitio/v1/consultar_base', {
    method: 'POST',
    headers: { authorization: `Bearer ${LLAVE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sql: q, params }),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(`base: ${d.mensaje ?? d.error ?? r.status} — ${q.slice(0, 80)}`);
  return d.resultado?.results ?? [];
}

// La misma derivación que apps/servidor/src/cripto.ts (PBKDF2-SHA256, 100.000 vueltas, 32 bytes).
async function hashClave(clave) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(clave),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 100_000 },
    llave,
    256,
  );
  const b64 = (u) => Buffer.from(u).toString('base64');
  return `pbkdf2$100000$${b64(sal)}$${b64(new Uint8Array(bits))}`;
}
const claveNueva = () =>
  `Dvx-${Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('base64url')}-7a`;

// Las claves: las del archivo si ya existe; si no, nuevas y guardadas (sin imprimirlas).
const claves = {};
if (existsSync(ARCHIVO))
  for (const linea of readFileSync(ARCHIVO, 'utf8').split('\n')) {
    const [rol, correo, clave] = linea.split(',').map((x) => x?.trim());
    if (rol && correo && clave) claves[correo] = clave;
  }
for (const c of Object.values(CUENTAS)) claves[c.correo] ??= claveNueva();
mkdirSync(CARPETA, { recursive: true, mode: 0o700 });
chmodSync(CARPETA, 0o700);
writeFileSync(
  ARCHIVO,
  `${Object.entries(CUENTAS)
    .map(([rol, c]) => `${rol}, ${c.correo}, ${claves[c.correo]}`)
    .join('\n')}\n`,
  { mode: 0o600 },
);
chmodSync(ARCHIVO, 0o600);

const ids = {};
for (const [rol, c] of Object.entries(CUENTAS)) {
  const ya = (await sql('SELECT id FROM usuarios WHERE correo = ?', [c.correo]))[0];
  const id = ya?.id ?? crypto.randomUUID();
  const hash = await hashClave(claves[c.correo]);
  await sql(
    `INSERT INTO usuarios (id, correo, nombre, rol, idioma, zona_id, clave_hash, correo_confirmado_en, fecha_nacimiento, es_prueba)
     VALUES (?, ?, ?, ?, 'es', ?, ?, datetime('now'), '1988-04-12', 1)
     ON CONFLICT(id) DO UPDATE SET clave_hash = excluded.clave_hash, nombre = excluded.nombre, es_prueba = 1,
       activo = 1, zona_id = excluded.zona_id, correo_confirmado_en = COALESCE(usuarios.correo_confirmado_en, excluded.correo_confirmado_en)`,
    [id, c.correo, c.nombre, c.rol, ZONA, hash],
  );
  ids[rol] = id;
  console.log(`${rol}: ${ya ? 'ya existía, al día' : 'creada'} (marcada de prueba)`);
}

// El conductor, listo para Carro en Novi (la misma receta del guion de Carro del sitio de pruebas).
const k = ids.conductor;
const veh = `prueba-novi-carro-${k.slice(0, 8)}`;
const z = (await sql('SELECT lat, lng FROM zonas WHERE id = ?', [ZONA]))[0];
if (!z) throw new Error(`no existe la zona ${ZONA}`);
await sql(
  `INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id, vehiculo_activo_id)
   VALUES (?, 0, ?, ?, datetime('now'), ?, ?)
   ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, vehiculo_activo_id = excluded.vehiculo_activo_id`,
  [k, z.lat, z.lng, ZONA, veh],
);
await sql(
  `INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado, categoria, aprobado_en, aprobado_por)
   VALUES (?, ?, 'carro', 'Toyota', 'Corolla', 'Blanco', 'PRUEBA1', 'MI', 2021, 4, 'aprobado', 'estandar', datetime('now'), 'equipo')
   ON CONFLICT(id) DO UPDATE SET estado = 'aprobado'`,
  [veh, k],
);
for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'inspeccion'])
  await sql(
    `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en, revisado_por, revisado_en)
     VALUES (?, ?, ?, 'prueba', 'aprobado', datetime('now', '+1 year'), 'equipo', datetime('now'))
     ON CONFLICT(id) DO UPDATE SET estado = 'aprobado', vence_en = excluded.vence_en`,
    [`${veh}-${t}`, veh, t],
  );
await sql(
  `INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en, revisado_por)
   VALUES (?, 'aprobado', 'licencia', 'prueba', 'prueba', datetime('now'), datetime('now'), 'equipo')
   ON CONFLICT(usuario_id) DO UPDATE SET estado = 'aprobado', revisado_en = datetime('now')`,
  [k],
);
await sql(
  `INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, marca, modelo, anio, color, placa, licencia_estado, licencia_vence, antecedentes, antecedentes_fecha)
   VALUES (?, 'carro', 'Toyota', 'Corolla', 2021, 'Blanco', 'PRUEBA1', 'MI', date('now', '+1 year'), 'aprobado', date('now'))
   ON CONFLICT(usuario_id) DO UPDATE SET antecedentes = 'aprobado', antecedentes_fecha = date('now'), licencia_vence = excluded.licencia_vence`,
  [k],
);
const requisitos = await sql(
  "SELECT r.requisito, d.nivel FROM servicio_requisitos r JOIN requisitos_def d ON d.requisito = r.requisito WHERE r.servicio_id = 'carro'",
);
for (const r of requisitos)
  await sql(
    `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, vence_en, aprobado_por)
     VALUES (?, ?, ?, 'aprobado', ?, datetime('now', '+1 year'), 'equipo')
     ON CONFLICT(conductor_id, vehiculo_id, requisito) DO UPDATE SET estado = 'aprobado', vence_en = excluded.vence_en`,
    [
      k,
      r.nivel === 'vehiculo' ? veh : '',
      r.requisito,
      r.requisito === 'identidad' ? 'kyc' : 'revision_manual',
    ],
  );
await sql(
  `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en)
   VALUES (?, 'carro', 'aprobada', 'equipo', datetime('now'))
   ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET estado = 'aprobada'`,
  [k],
);
await sql(
  `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, 'carro', 1)
   ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET activa = 1`,
  [k],
);
console.log(
  `conductor: carro aprobado, ${requisitos.length} requisitos de Carro aprobados, habilitado`,
);

// Carro en Novi solo para cuentas de prueba, con su tarifa de prueba.
await sql(
  "INSERT OR IGNORE INTO servicios_prueba (servicio_id, zona_id, creado_por) VALUES ('carro', ?, 'equipo')",
  [ZONA],
);
await sql(
  `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
     espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion, cargo_no_se_presento,
     tope_dinamico_pb, redondeo, activa, de_prueba, motivo)
   SELECT 'prueba-carro-novi', 'carro', ?, 'USD', 250, 110, 30, 800, 300, 30, 120, 300, 400, 10000, 1, 1, 1,
          'Tarifa de prueba de Carro en Novi (solo cuentas de prueba)'
    WHERE NOT EXISTS (SELECT 1 FROM tarifas_viaje WHERE servicio_id = 'carro' AND zona_id = ? AND activa = 1)`,
  [ZONA, ZONA],
);
const publico = await sql(
  "SELECT estado FROM servicios_zona WHERE servicio_id = 'carro' AND zona_id = ?",
  [ZONA],
);
console.log(
  `Novi: Carro encendido solo para pruebas; para el público sigue «${publico[0]?.estado ?? 'sin encender'}»`,
);
console.log(`claves guardadas en ${ARCHIVO} (600)`);
writeFileSync(
  join(CARPETA, PRUEBAS ? '.ids-prueba-novi-pruebas.json' : '.ids-prueba-novi.json'),
  JSON.stringify(ids),
  {
    mode: 0o600,
  },
);
