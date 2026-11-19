// C-FRANJA-SOLO-EN-PRUEBAS (18 y 19 nov 2026): ningún .aab sube a NINGUNA pista de Google Play
// (ni prueba interna ni producción) sin abrir antes su pantalla de entrar en el emulador. La 46 del
// cliente, la 42 de Driver y la 18 de Restaurants se publicaron pintando la franja «PRUEBAS».
// Sin salida de emergencia: si el emulador no está, se enciende; no se salta.
import { execFileSync } from 'node:child_process';

export const APP_DE_PAQUETE = {
  'com.windoce.tumbite': 'cliente',
  'com.windoce.tumbite.driver': 'repartidor',
  'com.windoce.tumbite.restaurants': 'restaurante',
};

/** Corta el proceso (salida 4) si el paquete no es conocido o su pantalla de entrar pinta la franja. */
export function exigirSinFranja(paquete, aab) {
  const app = new Map(Object.entries(APP_DE_PAQUETE)).get(paquete);
  if (!app) {
    console.error(`NO SE SUBE ${paquete}: no es un paquete de la tienda conocido.`);
    process.exit(4);
  }
  try {
    execFileSync('bash', ['scripts/tiendas/comprobar-franja.sh', app, aab], { stdio: 'inherit' });
  } catch {
    console.error(`NO SE SUBE ${paquete}: no pasó la comprobación de la pantalla de entrar.`);
    process.exit(4);
  }
}
