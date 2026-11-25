import { describe, expect, it } from 'vitest';
import { nombreConMarca } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import { lineaDeCuenta } from './rastro';

/**
 * C-NOMBRE-CON-MARCA (25 nov 2026, Richard: la línea de tiempo de un conductor firmaba «por Soporte
 * Tumbite») — todos los países. La cuenta del equipo creada antes del cambio de marca conserva su
 * nombre en la base; lo que se ve siempre dice Divoox.
 */
describe('C-NOMBRE-CON-MARCA: el equipo firma con la marca de hoy', () => {
  it('la pieza cambia la marca vieja y deja lo demás igual', () => {
    expect(nombreConMarca('Soporte Tumbite')).toBe('Soporte Divoox');
    expect(nombreConMarca('SOPORTE TUMBITE')).toBe('SOPORTE DIVOOX');
    expect(nombreConMarca('Ana (Soporte)')).toBe('Ana (Soporte)');
    expect(nombreConMarca(null)).toBeNull();
  });

  it('la línea de tiempo de la cuenta dice «Soporte Divoox» aunque la cuenta se llame «Soporte Tumbite»', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Tumbite');
    const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
    await m.DB.prepare(
      "INSERT INTO kyc (usuario_id, estado, doc_frente, selfie, enviado_en, revisado_en, revisado_por) VALUES (?, 'aprobado', 'kyc/doc', 'kyc/cara', datetime('now', '-2 hours'), datetime('now'), ?)",
    )
      .bind(rep.id, admin.id)
      .run();
    const linea = await lineaDeCuenta(m.DB, rep.id);
    const delEquipo = (linea?.linea ?? []).filter((l) => l.quien);
    expect(delEquipo.length).toBeGreaterThan(0);
    for (const l of delEquipo) expect(l.quien).not.toMatch(/tumbite/i);
    expect(delEquipo.some((l) => l.quien === 'Soporte Divoox')).toBe(true);
  });
});
