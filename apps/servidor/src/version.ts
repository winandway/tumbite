import { crearInfoVersion, type InfoVersion } from '@tumbite/compartido';

// Los graba scripts/construir.mjs al compilar (wrangler --define). En las pruebas no existen.
declare const COMMIT_PUBLICADO: string | undefined;
declare const VERSION_PUBLICADA: string | undefined;

/** La versión de ESTE servidor, la que se compiló y se desplegó (C-VERSION-DEL-ARTEFACTO). */
export const VERSION_SERVIDOR: InfoVersion = crearInfoVersion(
  typeof VERSION_PUBLICADA === 'string' ? VERSION_PUBLICADA : undefined,
  typeof COMMIT_PUBLICADO === 'string' ? COMMIT_PUBLICADO : undefined,
);
