import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * C-MODO-TABLETA (29 oct 2026), como la tableta de DoorDash para comercios: pantalla completa,
 * pantalla siempre encendida (Screen Wake Lock) y sin el menú ni el botón de salir a la vista, para
 * que nadie cierre la sesión por descuido. El navegador solo lo deja empezar con un toque.
 */
export function useModoTableta() {
  const [activo, setActivo] = useState(false);
  const candado = useRef<WakeLockSentinel | null>(null);

  const pedirCandado = useCallback(async () => {
    try {
      candado.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // Sin permiso o sin soporte (algunos navegadores viejos): el modo sigue, solo sin candado.
      candado.current = null;
    }
  }, []);

  const entrar = useCallback(async () => {
    document.body.classList.add('modo-tableta');
    setActivo(true);
    await document.documentElement.requestFullscreen?.().catch(() => undefined);
    await pedirCandado();
  }, [pedirCandado]);

  const salir = useCallback(async () => {
    document.body.classList.remove('modo-tableta');
    setActivo(false);
    await candado.current?.release().catch(() => undefined);
    candado.current = null;
    if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => undefined);
  }, []);

  // El navegador suelta el candado al ocultar la pestaña: se vuelve a pedir al volver.
  useEffect(() => {
    if (!activo) return;
    const alVolver = () => {
      if (document.visibilityState === 'visible') void pedirCandado();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [activo, pedirCandado]);

  // Al salir de la pantalla de pedidos, el panel vuelve a la normalidad.
  useEffect(
    () => () => {
      document.body.classList.remove('modo-tableta');
      void candado.current?.release().catch(() => undefined);
    },
    [],
  );

  return { activo, entrar, salir };
}
