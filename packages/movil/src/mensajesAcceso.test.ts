import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-MENSAJES-ACCESO, C-SIN-EXITO-FALSO y C-INTENTOS-ACCESO (24 nov 2026, Richard) — todos los países.
 * La pantalla de entrar y crear cuenta de las tres apps: el botón que acompaña a cada error, el pase
 * del escudo que sirve una sola vez, las casillas mal dichas junto al botón y el aviso al equipo de lo
 * que falló en el teléfono sin llegar a ser un alta. Comprobada en ROJO quitando cada pieza.
 */
const leer = (f: string) => readFileSync(join(__dirname, f), 'utf8');

describe('pantalla de acceso de las apps', () => {
  const acceso = leer('Acceso.tsx');

  it('debajo del error va el botón que toca (crear cuenta, recuperar o entrar), según el código del servidor', () => {
    expect(acceso).toContain('accionDeError(error?.codigo, modo)');
    expect(acceso).toContain('codigo: x.datos?.codigo');
    expect(acceso).toMatch(/testID=\{`accion-\$\{accion\}`\}/);
    expect(acceso).toContain('textoAccionAcceso(accion, idioma)');
    // «Crear cuenta» lleva el correo escrito al registro.
    expect(acceso).toContain('correoQueSigue.current = correoLimpio(v.correo);');
  });

  it('el pase del escudo se olvida después de CADA envío (entrar y crear cuenta), no solo tras un 403', () => {
    const finales = acceso.split('} finally {').slice(1);
    expect(finales.length).toBeGreaterThanOrEqual(2);
    for (const f of finales.slice(0, 2))
      expect(f.slice(0, 200)).toContain('olvidarPaseTurnstile()');
    const turnstile = leer('Turnstile.tsx');
    // Y el escudo pide otro en ese momento (antes esperaba hasta un minuto).
    expect(turnstile).toMatch(/for \(const o of oyentes\) o\(\);/);
    expect(turnstile).toContain('oyentes.add(otra)');
  });

  it('«Continuar» con casillas mal: junto al botón se dice cuáles, y el equipo lo ve', () => {
    expect(acceso).toContain('testID="registro-revisar-casillas"');
    expect(acceso).toContain('resumenFallos(fallos, idioma)');
    expect(acceso).toContain("avisarIntento('formulario', 'validacion'");
    expect(acceso).toContain("avisarIntento('formulario', 'sin_aceptar')");
    expect(acceso).toContain("avisarIntento('revisar', 'sin_conexion')");
    expect(acceso).toContain("'/datos/cuentas/intento'");
  });
});
