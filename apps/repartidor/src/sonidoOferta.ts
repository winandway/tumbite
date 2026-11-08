import { Platform } from 'react-native';

/**
 * C-OFERTA-SUENA (8 nov 2026, Richard): en la prueba de las tres apps la oferta llegó a los
 * teléfonos sin sonar. La oferta solo vibraba, y Safari en el iPhone no vibra. En la versión web
 * suena la misma alarma del restaurante, una vez por oferta. En las apps de las tiendas el sonido
 * va con el aviso del celular (pendiente de la próxima compilación).
 */
export function sonarOferta(): void {
  if (Platform.OS !== 'web') return;
  const Audio = (globalThis as { Audio?: new (src: string) => { play(): Promise<void> } }).Audio;
  if (!Audio) return;
  try {
    void new Audio('/alarma.wav').play().catch(() => undefined);
  } catch {
    /* sin audio en este navegador: queda la oferta en pantalla */
  }
}
