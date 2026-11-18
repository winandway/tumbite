import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { debeConfirmar } from './serviciosLogica';

/**
 * C-CONECTAR-DESLIZANDO (Richard, 18 nov 2026; todos los países). En Driver, conectarse es deslizar
 * de izquierda a derecha, nunca un toque: un toque en el bolsillo o un niño conectaban sin querer,
 * llegaba un viaje y el conductor se llevaba una mala nota. Una sola pieza (`Deslizador`) para
 * conectar, desconectar, llegar y entregar.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('el gesto: un toque o soltar a medio camino no conectan; deslizar completo, sí', () => {
  const recorrido = 280;
  it('un toque simple (sin moverse) no conecta', () => {
    expect(debeConfirmar(0, recorrido)).toBe(false);
  });
  it('soltar a medio camino no conecta', () => {
    expect(debeConfirmar(recorrido / 2, recorrido)).toBe(false);
    expect(debeConfirmar(recorrido * 0.84, recorrido)).toBe(false);
  });
  it('deslizar completo sí conecta', () => {
    expect(debeConfirmar(recorrido, recorrido)).toBe(true);
  });
});

describe('ningún punto de conexión de Driver se toca: todos deslizan', () => {
  it('la tarjeta de un servicio desconectado se conecta deslizando (sin botón «Conectar»)', () => {
    const s = leer('packages/movil/src/TarjetaServicio.tsx');
    expect(s).toMatch(/sentido="conectar"/);
    expect(s).not.toMatch(/texto=\{textos\.conectar\}/);
  });
  it('«Conectarme» y «Desconectarme» del inicio deslizan', () => {
    const s = leer('apps/repartidor/src/servicios/PanelServicios.tsx');
    expect(s).not.toMatch(/<BotonAncho[\s\S]{0,120}t\.conectarme/);
    expect(s).not.toMatch(/<BotonAncho[\s\S]{0,120}t\.desconectarme/);
    expect(s).toMatch(/testID="conectarme"/);
    expect(s).toMatch(/<Deslizador[\s\S]{0,400}testID="conectarme"/);
  });
  it('volver de la pausa también desliza', () => {
    const s = leer('apps/repartidor/src/Inicio.tsx');
    expect(s).not.toMatch(/texto=\{estado\.pausado \? tg\.pausa\.reanudar : tg\.pausa\.pausar\}/);
    expect(s).toMatch(/<Deslizador[\s\S]{0,300}tg\.pausa\.reanudar/);
  });
  it('con lector de pantalla, conectar pide confirmar', () => {
    const s = leer('packages/movil/src/Deslizador.tsx');
    expect(s).toMatch(/confirmarConSistema/);
    expect(s).toMatch(/sentido/);
  });
});
