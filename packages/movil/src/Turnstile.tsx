import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Idioma } from '@tumbite/compartido';
import { URL_SERVIDOR } from './sesion';

let paseActual: string | null = null;

/** El pase vigente del escudo anti-robots; la API lo manda en `cf-turnstile-response`. */
export const paseTurnstile = () => paseActual;
/** Después de un 403 del servidor: el pase ya no sirve y el widget pide otro. */
export const olvidarPaseTurnstile = () => {
  paseActual = null;
};

/**
 * Escudo anti-robots de Cloudflare dentro de la app (F5 de la auditoría): una vista web pequeña
 * abre /turnstile.html del propio sitio con la clave pública y recibe el pase por postMessage.
 * Sin clave del sitio (desde /datos/publico) no se pinta nada y el servidor no la exige.
 */
export function Turnstile({ sitio, idioma }: { sitio: string; idioma: Idioma }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    // Si alguien olvidó el pase (403), se vuelve a cargar el widget.
    const t = setInterval(() => {
      if (!paseActual) setVersion((v) => v + 1);
    }, 60_000);
    return () => clearInterval(t);
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
