import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
// C-BUSCADOR-INSTANTANEO: la memoria de búsquedas del superadmin no pasa de una prueba a otra.
import { olvidarTodasLasBusquedas } from './apps/panel/src/panel/memoriaBusqueda';

afterEach(() => {
  cleanup();
  olvidarTodasLasBusquedas();
});
