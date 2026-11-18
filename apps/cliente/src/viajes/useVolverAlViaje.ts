import { useEffect } from 'react';
import { router } from 'expo-router';
import type { Api } from '@tumbite/compartido';
import { type ViajeAbierto, rutaAlAbrir } from './volverAlViaje';

/** Una sola vez por apertura de la app: no se vuelve a saltar si la persona regresa al inicio. */
let yaRevisado = false;

/**
 * C-VOLVER-AL-VIAJE: al abrir la app (el inicio), si hay un viaje o un envío en curso, se va directo
 * a su pantalla de seguimiento. «Atrás» desde ahí vuelve al inicio.
 */
export function useVolverAlViaje(api: Api, conCuenta: boolean) {
  useEffect(() => {
    if (!conCuenta || yaRevisado) return;
    yaRevisado = true;
    const leer = (ruta: string) =>
      api
        .pedir<{ viaje: ViajeAbierto }>('GET', ruta)
        .then((r) => r.viaje)
        .catch(() => null);
    void Promise.all([
      leer('/datos/viajes/actual'),
      leer('/datos/viajes/actual?servicio=envios'),
    ]).then((viajes) => {
      const ruta = rutaAlAbrir(viajes);
      if (ruta) router.push(ruta);
    });
  }, [api, conCuenta]);
}
