import { useEffect } from 'react';
import { router } from 'expo-router';
import type { Api } from '@tumbite/compartido';
import { type ViajeAbierto, rutaAlAbrir } from './volverAlViaje';

/** Una sola vez por apertura de la app: no se vuelve a saltar si la persona regresa al inicio. */
let yaRevisado = false;
/** Si al abrir no hubo red, se vuelve a preguntar a los pocos segundos (revisión del 18 nov). */
const REINTENTO_MS = 5_000;
const MAX_INTENTOS = 3;

/**
 * C-VOLVER-AL-VIAJE: al abrir la app (el inicio), si hay un viaje o un envío en curso, se va directo
 * a su pantalla de seguimiento. «Atrás» desde ahí vuelve al inicio. Si la consulta falla (sin red),
 * no se da por revisado: se reintenta.
 */
export function useVolverAlViaje(api: Api, conCuenta: boolean) {
  useEffect(() => {
    if (!conCuenta || yaRevisado) return;
    yaRevisado = true;
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    const leer = (ruta: string) =>
      api
        .pedir<{ viaje: ViajeAbierto }>('GET', ruta)
        .then((r) => ({ ok: true, viaje: r.viaje }))
        .catch(() => ({ ok: false, viaje: null }));
    const revisar = async (intento: number) => {
      const r = await Promise.all([
        leer('/datos/viajes/actual'),
        leer('/datos/viajes/actual?servicio=envios'),
      ]);
      if (!vivo) return;
      const ruta = rutaAlAbrir(r.map((x) => x.viaje));
      if (ruta) return router.push(ruta);
      if (r.some((x) => !x.ok)) {
        if (intento + 1 >= MAX_INTENTOS) {
          // Sin red todavía: la próxima vez que se abra el inicio se vuelve a preguntar.
          yaRevisado = false;
          return;
        }
        reloj = setTimeout(() => void revisar(intento + 1), REINTENTO_MS);
      }
    };
    void revisar(0);
    return () => {
      vivo = false;
      if (reloj) clearTimeout(reloj);
      // Si el inicio se desmontó antes de terminar, otra apertura puede volver a revisar.
      if (reloj) yaRevisado = false;
    };
  }, [api, conCuenta]);
}
