import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Idioma } from '@tumbite/compartido';
import { URL_SERVIDOR } from './sesion';

let paseActual: string | null = null;
const oyentes = new Set<() => void>();

/** El pase vigente del escudo anti-robots; la API lo manda en `cf-turnstile-response`. */
export const paseTurnstile = () => paseActual;
/**
 * C-MENSAJES-ACCESO (24 nov 2026): el pase de Cloudflare sirve UNA sola vez. Se olvida después de
 * cada envío (entrar o crear la cuenta, salga bien o mal) y el escudo pide otro EN ESE MOMENTO. Antes
 * solo se olvidaba tras un 403 y el escudo tardaba hasta un minuto en volver: el segundo intento
 * llevaba un pase gastado y salía «No pudimos confirmar que eres una persona».
 */
export const olvidarPaseTurnstile = () => {
  paseActual = null;
  for (const o of oyentes) o();
};

/**
 * Escudo anti-robots de Cloudflare dentro de la app (F5 de la auditoría): una vista web pequeña
 * abre /turnstile.html del propio sitio con la clave pública y recibe el pase por postMessage.
 * Sin clave del sitio (desde /datos/publico) no se pinta nada y el servidor no la exige.
 */
export function Turnstile({ sitio, idioma }: { sitio: string; idioma: Idioma }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    // Pase olvidado (usado o rechazado): el escudo se vuelve a cargar de una vez.
    const otra = () => setVersion((v) => v + 1);
    oyentes.add(otra);
    // Y si el pase vence sin usarse, cada minuto se pide otro.
    const t = setInterval(() => {
      if (!paseActual) otra();
    }, 60_000);
    return () => {
      oyentes.delete(otra);
      clearInterval(t);
    };
  }, []);
  if (!sitio) return null;
  const url = `${URL_SERVIDOR}/turnstile.html?sitio=${encodeURIComponent(sitio)}&idioma=${idioma}`;
  return (
    <View style={{ height: 72, marginBottom: 12 }} testID="turnstile">
      <WebView
        key={version}
        source={{ uri: url }}
        style={{ backgroundColor: 'transparent' }}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={(ev) => {
          try {
            const m = JSON.parse(ev.nativeEvent.data) as { tipo: string; pase?: string };
            paseActual = m.tipo === 'pase' && m.pase ? m.pase : null;
          } catch {
            paseActual = null;
          }
        }}
      />
    </View>
  );
}

/**
 * La clave pública del escudo la publica el servidor en /datos/publico: así se enciende y se
 * apaga desde el panel de YaDominios sin publicar la app otra vez.
 */
export function useTurnstileSitio(api: {
  pedir: <T>(m: 'GET', ruta: string) => Promise<T>;
}): string {
  const [sitio, setSitio] = useState('');
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ turnstileSitio?: string }>('GET', '/datos/publico')
      .then((p) => {
        if (vivo) setSitio(p.turnstileSitio ?? '');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  return sitio;
}
