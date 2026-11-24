import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-FORMULARIO-POR-PASOS (24 nov 2026, orden de Richard; todos los países). Los formularios largos de
 * las apps son un carrusel de pasos cortos, como Uber, DoorDash y Rappi, con UNA pieza
 * (`FormularioPorPasos`, con `BarraDePasos` y `BotonesDePasos`): barra verde arriba, «Atrás» y
 * «Siguiente» grandes, el error al lado de la casilla y, junto al botón, por qué no avanza. El paso
 * se guarda en el borrador; la contraseña no.
 *
 * Visto en ROJO el 24 nov 2026 con el registro, Envíos y la empresa de antes (un formulario largo de
 * una sola pantalla): fallaban esas tres pruebas.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-FORMULARIO-POR-PASOS', () => {
  const pieza = leer('packages/movil/src/FormularioPorPasos.tsx');
  const acceso = leer('packages/movil/src/Acceso.tsx');
  const envio = leer('apps/cliente/src/viajes/PedirMoto.tsx');
  const empresa = leer('apps/cliente/src/app/business.tsx');

  it('la pieza única: barra verde, «Atrás»/«Siguiente» y por qué no avanza junto al botón', () => {
    expect(pieza).toContain('backgroundColor: COLOR.exito');
    expect(pieza).toContain('accessibilityRole="progressbar"');
    expect(pieza).toMatch(/porQue \?[\s\S]{0,200}accessibilityRole="alert"/);
    expect(pieza).toContain('testID="pasos-atras"');
    expect(leer('packages/movil/src/index.ts')).toContain("export * from './FormularioPorPasos'");
  });

  it('crear la cuenta en la app de clientes y en Driver va por pasos', () => {
    expect(acceso).toContain(
      "const porPasos = rolRegistro === 'cliente' || rolRegistro === 'repartidor';",
    );
    expect(acceso).toMatch(/if \(registro && porPasos\)[\s\S]{0,4000}<FormularioPorPasos/);
    // El último paso sigue llevando a «Revisa tus datos» (C-REVISA-TUS-DATOS): nunca crea la cuenta.
    expect(acceso).toMatch(
      /alTerminar=\{continuar\}[\s\S]{0,200}testIDTerminar="registro-continuar"/,
    );
    // El paso vuelve al reabrir; la contraseña nunca se guarda.
    expect(acceso).toContain("pasoRegistro: '',");
    expect(acceso).toContain("sensibles: ['clave']");
    // Un error del servidor o una casilla mal de antes lleva a su paso.
    expect(acceso.match(/pasoDeCasilla\(PASOS_REGISTRO/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('Divoox Restaurants (caso abierto con Apple) conserva su formulario de siempre', () => {
    expect(acceso).not.toMatch(/porPasos = [^;]*restaurante/);
  });

  it('Envíos (A → B) va por pasos: ruta, paquete, quién lo recibe y precio con el pago', () => {
    expect(envio).toMatch(
      /clave: 'ruta'[\s\S]*clave: 'paquete'[\s\S]*clave: 'recibe'[\s\S]*clave: 'pagar'/,
    );
    expect(envio).toContain('<BarraDePasos');
    expect(envio).toContain('<BotonesDePasos');
    expect(envio).toContain("pasoEnvio: '',");
    // El error de cada casilla, a su lado.
    for (const c of ['paqueteDescripcion', 'destinatarioNombre', 'destinatarioTelefono'])
      expect(envio).toContain(`error={fallosEnvio.get('${c}')}`);
  });

  it('el registro de la empresa de Flex en la app va por pasos', () => {
    expect(empresa).toContain('<FormularioPorPasos');
    expect(empresa).toContain("pasoRegistro: '',");
  });
});
