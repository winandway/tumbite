import { describe, expect, it } from 'vitest';
import { nombreConMarca } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import { lineaDeCuenta } from './rastro';
import {
  CLAVE_HUELLA_ESQUEMA,
  asegurarEsquema,
  reiniciarEsquema,
  renombrarMarcaVieja,
} from './esquema';
import { crearBasePruebas } from './pruebas/d1';

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

describe('C-NOMBRE-CON-MARCA: la migración renombra las cuentas del equipo en la base', () => {
  it('«Soporte Tumbite» y el restaurante del equipo pasan a Divoox; lo ajeno no se toca; repetirla no escribe', async () => {
    const DB = crearBasePruebas();
    await asegurarEsquema(DB);
    const usuario = (id: string, nombre: string, rol: string) =>
      DB.prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES (?, ?, ?, ?, 'x')",
      )
        .bind(id, `${id}@ejemplo.com`, nombre, rol)
        .run();
    await usuario('eq1', 'Soporte Tumbite', 'admin');
    await usuario('eq2', 'Ana (Soporte Tumbite)', 'admin');
    await usuario('cli', 'Tienda Tumbite Express', 'cliente');
    await usuario('cli2', 'Soporte Tumbite', 'cliente');
    await usuario('dueno', 'Dueño Ajeno', 'restaurante');
    await DB.prepare(
      "INSERT INTO restaurantes (id, dueno_id, nombre) VALUES ('r-eq', 'eq1', 'Restaurante de revisión Tumbite'), ('r-aj', 'dueno', 'Pizzas Tumbite')",
    ).run();
    // La migración de arranque lo hace sola (nunca a mano): una versión nueva trae otra huella.
    await DB.prepare('DELETE FROM config WHERE clave = ?').bind(CLAVE_HUELLA_ESQUEMA).run();
    reiniciarEsquema();
    await asegurarEsquema(DB);
    const nombre = async (tabla: string, id: string) =>
      (
        await DB.prepare(`SELECT nombre FROM ${tabla} WHERE id = ?`)
          .bind(id)
          .first<{ nombre: string }>()
      )?.nombre;
    expect(await nombre('usuarios', 'eq1')).toBe('Soporte Divoox');
    expect(await nombre('usuarios', 'eq2')).toBe('Ana (Soporte Divoox)');
    expect(await nombre('restaurantes', 'r-eq')).toBe('Restaurante de revisión Divoox');
    // Lo que no es del equipo se queda como su dueño lo escribió.
    expect(await nombre('usuarios', 'cli')).toBe('Tienda Tumbite Express');
    expect(await nombre('usuarios', 'cli2')).toBe('Soporte Tumbite');
    expect(await nombre('restaurantes', 'r-aj')).toBe('Pizzas Tumbite');
    // Idempotente: con todo al día no escribe ni una fila.
    expect(await renombrarMarcaVieja(DB)).toBe(0);
  });
});
