import { app } from '../app';
import { crearBasePruebas } from './d1';

/** Ayudas para las pruebas del servidor: una base nueva y llamadas con IP distinta cada vez. */
export function mundo(extra: Record<string, unknown> = {}) {
  const DB = crearBasePruebas();
  let ip = 0;
  async function llamar(metodo: string, ruta: string, cuerpo?: unknown, token?: string) {
    ip++;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.9.${Math.floor(ip / 250)}.${ip % 250}`,
    };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await app.request(
      ruta,
      { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) },
      { DB, ...extra },
    );
    const datos = (await res.json().catch(() => ({}))) as any;
    return { res, datos, estado: res.status };
  }
  async function cuenta(
    rol: 'cliente' | 'repartidor' | 'restaurante' | 'admin',
    nombre = `Persona ${rol}`,
  ) {
    const correo = `${rol}-${Math.random().toString(36).slice(2)}@ejemplo.com`;
    const r = await llamar('POST', '/datos/cuentas/registro', {
      nombre,
      correo,
      clave: 'clave-segura-1',
      rol: rol === 'admin' ? 'cliente' : rol,
    });
    if (rol === 'admin')
      await DB.prepare("UPDATE usuarios SET rol = 'admin' WHERE id = ?")
        .bind(r.datos.usuario.id)
        .run();
    return { token: r.datos.token as string, id: r.datos.usuario.id as string };
  }
  return { DB, llamar, cuenta };
}

export const RESTAURANTE_BASE = {
  nombre: 'Sabor Prueba',
  direccion: '100 Calle de Prueba, Miami, FL',
  lat: 25.77,
  lng: -80.19,
  categoria: 'Cubana',
};
