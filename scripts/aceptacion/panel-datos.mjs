// Datos del robot del PANEL (líneas A1 a A9): crea por la API, como lo hacen las apps, un conductor
// nuevo de El Vigía (Venezuela) con su moto y sus papeles, y un pasajero de robot. Todo con correo
// «@robots.invalid» y marcado como cuenta de prueba (C-ROBOTS-SOLO-PRUEBAS). Solo sitio de pruebas.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  api,
  celularRobot,
  correoRobot,
  marcarCuentaRobot,
  sql,
  q,
  URL_PRUEBAS,
} from './base-pruebas.mjs';
import { cuentasDemo } from './comun.mjs';

export const CLAVE_ROBOT = 'Robot2026-Panel!';
export const ZONA_VE = 'VE-MER-ELVIGIA';
const FOTOS = join(process.cwd(), 'e2e', 'recorrido', 'fotos');
const foto = readFileSync(join(FOTOS, 'bolsa-entrega.jpg'));

// La clave de la cuenta demo del sitio de pruebas vive fuera del repositorio (es público).
const claveDemo = () => {
  if (process.env.CLAVE_DEMO) return process.env.CLAVE_DEMO;
  const f = join(homedir(), '.config', 'tumbite', 'clave-demo-pruebas');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  const delArchivo = cuentasDemo()['demo.soporte@ejemplo.com'];
  if (delArchivo) return delArchivo;
  throw new Error(
    'Falta la clave demo de pruebas (~/.config/tumbite/clave-demo-pruebas o CLAVE_DEMO).',
  );
};
export const SUPERADMIN = {
  correo: 'demo.soporte@ejemplo.com',
  get clave() {
    return claveDemo();
  },
};

const ok = (r, que) => {
  if (r.estado < 200 || r.estado >= 300)
    throw new Error(`${que}: ${r.estado} ${r.d?.error ?? JSON.stringify(r.d).slice(0, 200)}`);
  return r.d;
};

/** Sube una foto cruda (image/jpeg) como la app. */
async function subirFoto(ruta, token) {
  const r = await fetch(`${URL_PRUEBAS}${ruta}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg', 'x-idioma': 'es' },
    body: foto,
  });
  return { estado: r.status, d: await r.json().catch(() => ({})) };
}

export async function entrarSuperadmin() {
  const d = ok(await api('POST', '/datos/cuentas/entrar', SUPERADMIN), 'entrar como equipo');
  const ruta = ok(
    await api('GET', '/datos/admin/ruta', undefined, { token: d.token }),
    'ruta del equipo',
  ).ruta;
  return { token: d.token, ruta: `/panel/${ruta}` };
}

/** Un conductor nuevo con su moto y todas las fotos del asistente, enviado a revisión. */
export async function crearConductor({ nombre, enviar = true, conNacimiento = false }) {
  const correo = correoRobot('conductor');
  const reg = ok(
    await api('POST', '/datos/cuentas/registro', {
      nombre,
      correo,
      clave: CLAVE_ROBOT,
      rol: 'repartidor',
      telefono: celularRobot('VE'),
      ...(conNacimiento ? { fechaNacimiento: '1990-05-15' } : {}),
      idioma: 'es',
    }),
    'registro del conductor',
  );
  await marcarCuentaRobot(correo);
  const token = reg.token;
  ok(await api('PUT', '/datos/conductor/ciudad', { zonaId: ZONA_VE }, { token }), 'ciudad');
  const placa = `ZR${Math.floor(Math.random() * 9e5 + 1e5)}`;
  const moto = ok(
    await api(
      'POST',
      '/datos/conductor/vehiculos',
      { tipo: 'moto', marca: 'Marca', modelo: 'Modelo', anio: 2023, color: 'Negro', placa },
      { token },
    ),
    'moto',
  ).id;
  for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente', 'foto_placa'])
    await subirFoto(`/datos/conductor/vehiculos/${moto}/documentos?tipo=${t}`, token);
  if (enviar) await api('POST', `/datos/conductor/vehiculos/${moto}/enviar`, {}, { token });
  const v0 = ok(
    await api('GET', '/datos/conductor/verificacion', undefined, { token }),
    'asistente',
  );
  const pasos = v0.pasos.map((x) => x.paso);
  if (pasos.includes('cara'))
    ok(
      await api('POST', '/datos/kyc/consentimiento', { acepto: true }, { token }),
      'consentimiento',
    );
  const subidas = [];
  for (const paso of pasos) {
    const r = await subirFoto(`/datos/conductor/verificacion/foto/${paso}?origen=camara`, token);
    subidas.push(`${paso}:${r.estado}`);
  }
  if (enviar)
    ok(
      await api('POST', '/datos/conductor/verificacion/enviar', {}, { token }),
      'enviar a revisión',
    );
  const [u] = await sql(`SELECT id FROM usuarios WHERE correo = ${q(correo)}`);
  return { correo, token, id: u.id, moto, placa, nombre, pasos, subidas };
}

/** Un pasajero de robot (para cotizar como lo hace la app). */
export async function crearPasajero() {
  const correo = correoRobot('pasajero');
  const reg = ok(
    await api('POST', '/datos/cuentas/registro', {
      nombre: 'Robot Pasajero',
      correo,
      clave: CLAVE_ROBOT,
      rol: 'cliente',
      telefono: celularRobot('VE'),
      idioma: 'es',
    }),
    'registro del pasajero',
  );
  await marcarCuentaRobot(correo);
  return {
    correo,
    token: reg.token,
    id: (await sql(`SELECT id FROM usuarios WHERE correo = ${q(correo)}`))[0].id,
  };
}
