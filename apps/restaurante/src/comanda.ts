import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { printAsync } from 'expo-print';
import { ANCHO_COMANDA_PUNTOS, type PedidoComanda, htmlComanda } from '@tumbite/compartido';

/**
 * C-COMANDA-APP (LAN-3): la comanda impresa desde la app del restaurante, como la de DoorDash
 * Merchant y Uber Eats Manager. La misma pieza que el panel (`htmlComanda`, 80 mm, sin dinero ni
 * dirección) con la impresión del sistema: AirPrint en el iPhone y el iPad, el servicio de
 * impresión en Android (la impresora térmica o cualquier impresora que el equipo ya tenga).
 * En la versión web, `expo-print` imprimiría la pantalla entera: ahí se imprime un marco oculto.
 */
export async function imprimirComanda(p: PedidoComanda, restaurante: string, idioma: 'es' | 'en') {
  const html = htmlComanda(p, restaurante, idioma);
  if (Platform.OS !== 'web') {
    await printAsync({ html, width: ANCHO_COMANDA_PUNTOS });
    return;
  }
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(marco);
  const doc = marco.contentWindow?.document;
  if (!doc || !marco.contentWindow) {
    marco.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  marco.contentWindow.focus();
  marco.contentWindow.print();
  setTimeout(() => marco.remove(), 1000);
}

const CLAVE = 'divoox.comandaAlAceptar';

/** «Imprimir la comanda al aceptar»: se guarda en ESTE equipo, como en el panel. */
export function useComandaAlAceptar(): [boolean, (v: boolean) => void] {
  const [activa, setActiva] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((v) => setActiva(v === '1'))
      .catch((e: unknown) => console.warn('comanda: no se pudo leer la preferencia', e));
  }, []);
  const cambiar = useCallback((v: boolean) => {
    setActiva(v);
    AsyncStorage.setItem(CLAVE, v ? '1' : '0').catch((e: unknown) =>
      console.warn('comanda: no se pudo guardar la preferencia', e),
    );
  }, []);
  return [activa, cambiar];
}
