import { createHash } from 'node:crypto';
import { expect, type Page } from './fixtures';
import { sqlLocal } from './sqlLocal';

/**
 * C-TELEFONO-AL-REGISTRARSE (22 nov 2026): la cuenta nueva creada en la app confirma su celular por SMS.
 * En el recorrido LOCAL la prueba cruza la puerta de verdad: escribe el número si la cuenta no tiene,
 * espera el código y lo lee como lo leería el teléfono (aquí, del hash de la base: seis cifras), lo
 * escribe y sigue. Solo en esta computadora (usa la base local).
 */
export async function cruzarPuertaCelular(p: Page, correo: string, telefono?: string) {
  await expect(p.getByTestId('confirma-tu-celular')).toBeVisible({ timeout: 30_000 });
  if (telefono && (await p.getByTestId('celular-nuevo').isVisible())) {
    await p.getByTestId('celular-nuevo').fill(telefono);
    await p.getByTestId('celular-guardar').click();
  }
  await expect(p.getByTestId('codigo-celular')).toBeVisible({ timeout: 30_000 });
  const id = String(
    sqlLocal(`SELECT id FROM usuarios WHERE correo = '${correo.replace(/'/g, "''")}'`)[0]?.id ?? '',
  );
  expect(id, 'la cuenta existe').not.toBe('');
  let hash = '';
  for (let i = 0; i < 30 && (!hash || hash === '-'); i++) {
    hash = String(
      sqlLocal(`SELECT codigo_hash FROM codigos_telefono WHERE usuario_id = '${id}'`)[0]
        ?.codigo_hash ?? '',
    );
    if (!hash || hash === '-') await p.waitForTimeout(500);
  }
  // Las huellas de las seis cifras posibles, buscadas de una vez (es una prueba local, no un secreto).
  const huellas = new Map<string, string>();
  for (let n = 0; n < 1_000_000; n++) {
    const c = String(n).padStart(6, '0');
    huellas.set(createHash('sha256').update(`${id}:${c}`).digest('hex'), c);
  }
  const codigo = huellas.get(hash) ?? '';
  expect(codigo, 'llegó un código').not.toBe('');
  await p.getByTestId('codigo-celular').fill(codigo);
  await expect(p.getByTestId('celular-confirmado')).toBeVisible({ timeout: 30_000 });
  await p.getByTestId('celular-continuar').click();
  await expect(p.getByTestId('confirma-tu-celular')).toBeHidden();
}
