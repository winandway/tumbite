import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * C-REGISTRO-TODO-EL-PAIS: para las pruebas del registro web. Sirve el catálogo de verdad
 * (apps/panel/public/lugares) a un `fetch` falso y elige una ciudad como lo haría una persona.
 */
const CARPETA = join(__dirname, '..', 'public');

/** La respuesta del catálogo para una dirección «…/lugares/VE/V.json»; null si no es del catálogo. */
export function respuestaCatalogo(url: string): Response | null {
  const m = /\/lugares\/(VE|US)\/([A-Za-z]+)\.json$/.exec(String(url));
  if (!m) return null;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- carpeta fija del repositorio, nombre validado arriba
  return new Response(readFileSync(join(CARPETA, 'lugares', m[1]!, `${m[2]}.json`), 'utf8'), {
    status: 200,
  });
}

/** Abre «Dónde vives», escribe y toca la primera ciudad que se llama así. */
export async function elegirCiudad(texto: string, ciudad: string) {
  await userEvent.click(screen.getByTestId('registro-lugar'));
  // Sin país sugerido arranca eligiendo el país.
  const venezuela = screen.queryByRole('button', { name: /Venezuela/ });
  if (venezuela) await userEvent.click(venezuela);
  await userEvent.type(screen.getByTestId('selector-lugar-buscar'), texto);
  const fila = await screen.findAllByRole('button', { name: (n) => n.startsWith(ciudad) });
  await userEvent.click(fila[0]!);
}
