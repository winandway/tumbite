import { app } from '../app';
import { crearBasePruebas } from './d1';
import { crearAlmacenPruebas } from './r2';

/** Cabecera mínima de un WebP de verdad: sirve como «foto» en las pruebas. */
export const FOTO_PRUEBA = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, 1, 2, 3, 4,
]);

/** Ayudas para las pruebas del servidor: una base nueva y llamadas con IP distinta cada vez. */
export function mundo(extraDado: Record<string, unknown> = {}) {
  const DB = crearBasePruebas();
  // Almacén de fotos de mentira por defecto (las entregas llevan foto).
  const extra = { BUCKET: crearAlmacenPruebas().bucket, ...extraDado };
  let ip = 0;
  // Cada mundo con su propia red de mentira: el límite de intentos vive en memoria y, si no,
  // las pruebas de un mismo archivo chocaban entre sí.
  const red = Math.floor(Math.random() * 200) + 20;
  async function llamar(metodo: string, ruta: string, cuerpo?: unknown, token?: string) {
    ip++;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.${red}.${Math.floor(ip / 250)}.${ip % 250}`,
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
  /** Petición cruda (con cabeceras propias, p. ej. la firma de un aviso de Stripe). */
  const crudo = (ruta: string, init: RequestInit) => app.request(ruta, init, { DB, ...extra });
  /** Sube una foto (bytes crudos) con la ubicación en la dirección, como lo hace la app. */
  async function foto(ruta: string, token: string, donde?: { lat: number; lng: number }) {
    ip++;
    const q = donde ? `${ruta.includes('?') ? '&' : '?'}lat=${donde.lat}&lng=${donde.lng}` : '';
    const res = await app.request(
      `${ruta}${q}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'image/webp',
          'cf-connecting-ip': `10.${red}.${Math.floor(ip / 250)}.${ip % 250}`,
        },
        body: FOTO_PRUEBA as BodyInit,
      },
      { DB, ...extra },
    );
    return { res, datos: (await res.json().catch(() => ({}))) as any, estado: res.status };
  }
  const lugar = async (sql: string, id: string) => {
    const f = await DB.prepare(sql).bind(id).first<{ lat: number | null; lng: number | null }>();
    return f?.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : { lat: 0, lng: 0 };
  };
  /** Recoger como manda el flujo: foto en el restaurante y el restaurante la confirma. */
  async function recoger(id: string, tokenRepartidor: string, tokenDueno: string) {
    const enRest = await lugar(
      'SELECT r.lat, r.lng FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ?',
      id,
    );
    const f = await foto(`/datos/repartidor/pedidos/${id}/foto-recogida`, tokenRepartidor, enRest);
    if (f.estado !== 200) return f;
    return llamar('POST', `/datos/restaurante/pedidos/${id}/confirmar-recogida`, {}, tokenDueno);
  }
  /** El celular manda su ubicación con la precisión del GPS (metros). */
  function ubicar(token: string, donde: { lat: number; lng: number }, precision = 10) {
    return llamar('POST', '/datos/repartidor/ubicacion', { ...donde, precision }, token);
  }
  /**
   * Como si pasara un minuto: las lecturas guardadas del repartidor envejecen, así la próxima no
   * parece un salto imposible (en las pruebas todo ocurre en el mismo segundo).
   */
  async function envejecerGps(id: string, segundos = 60) {
    await DB.prepare(
      `UPDATE ubicaciones_recientes SET creado_en = datetime(creado_en, '-${segundos} seconds') WHERE usuario_id = (SELECT repartidor_id FROM pedidos WHERE id = ?)`,
    )
      .bind(id)
      .run();
  }
  /**
   * Entregar parado en la puerta, con la foto de la entrega. Como un celular de verdad, antes
   * manda dos lecturas precisas del GPS en ese lugar (la regla de llegada confiable las exige).
   */
  async function entregar(
    id: string,
    tokenRepartidor: string,
    donde?: { lat: number; lng: number },
  ) {
    const enCasa = donde ?? (await lugar('SELECT lat, lng FROM pedidos WHERE id = ?', id));
    await envejecerGps(id);
    await ubicar(tokenRepartidor, enCasa);
    await ubicar(tokenRepartidor, enCasa);
    return foto(`/datos/repartidor/pedidos/${id}/entregado`, tokenRepartidor, enCasa);
  }
  return { DB, llamar, cuenta, crudo, foto, recoger, entregar, extra, ubicar, envejecerGps };
}

export const RESTAURANTE_BASE = {
  nombre: 'Sabor Prueba',
  direccion: '100 Calle de Prueba, Miami, FL',
  lat: 25.77,
  lng: -80.19,
  categoria: 'Cubana',
};
