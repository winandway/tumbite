// Copia las migraciones de la Fase 1 (docs/fase-1/*.sql) a un módulo del servidor, para que el
// diagnóstico del sitio de pruebas las pueda correr sin token de base. La prueba
// migraciones/fase1.test.ts falla si el módulo y los archivos no son idénticos.
// Uso (desde la raíz del repositorio): node scripts/staging/generar-migraciones.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const datos = {
  m4: readFileSync('docs/fase-1/M4-vehiculos.sql', 'utf8'),
  m5: readFileSync('docs/fase-1/M5-comida-y-vehiculo-activo.sql', 'utf8'),
  verificar: readFileSync('docs/fase-1/verificar.sql', 'utf8'),
  revertir: readFileSync('docs/fase-1/revertir.sql', 'utf8'),
};
const salida = `// GENERADO por scripts/staging/generar-migraciones.mjs a partir de docs/fase-1/*.sql. No editar a mano.
export const MIGRACIONES_FASE1 = ${JSON.stringify(datos, null, 2)} as const;
`;
writeFileSync('apps/servidor/src/migraciones/fase1.ts', salida);
console.log('migraciones de la Fase 1 copiadas al servidor');
