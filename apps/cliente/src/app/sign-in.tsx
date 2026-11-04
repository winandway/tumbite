import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Acceso, useSesion } from '@tumbite/movil';

/**
 * C-MIRAR-SIN-CUENTA: «Entrar» y «¿Eres nuevo? Crea tu cuenta» de la portada. Al entrar (o crear la
 * cuenta) vuelve a la portada (router.replace solo si no hay a dónde volver); si ya había sesión, ni
 * se muestra.
 */
export default function Entrar() {
  const { usuario } = useSesion();
  const { crear } = useLocalSearchParams<{ crear?: string }>();
  useEffect(() => {
    if (!usuario) return;
    // Vuelve a la portada que ya estaba abierta (sin apilar otra encima).
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [usuario]);
  if (usuario) return null;
  return (
    <Acceso
      rolRegistro="cliente"
      pideCumple
      modoInicial={crear === '1' ? 'registro' : 'entrar'}
      seguirMirando={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
