import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PRECIO-PROTAGONISTA (19 nov 2026, todos los países; bolívares solo en Venezuela). Orden de
 * Richard: «el monto a cobrar va tan visible como el PIN de entrega: cifra grande, en negrita, en
 * verde, con los bolívares debajo. Vale para todas las pantallas del viaje, del envío y de la oferta
 * en Driver».
 *
 * La vara es el PIN que el conductor escribe en Driver (casillas «viaje-pin» y «envio-pin-entrega»
 * de ViajeActivo: letra de 24). Todo monto a cobrar en Driver (y la ganancia de la oferta) pasa por
 * la pieza única MontoEnMano en `tamano="grande"` y en verde de éxito, arriba de su tarjeta, con la
 * etiqueta que le toca a esa pantalla. El verde es SOLO para lo que se cobra en mano o se gana: el
 * precio de un viaje pagado con tarjeta va grande pero en el color de texto, con su aviso.
 *
 * Comprobado en ROJO antes del cambio (19 nov 2026): con el código de main fallaban 9 de 10 pruebas
 * (la pieza grande iba en '700', la oferta de viaje y la de comida pintaban la ganancia a mano en
 * negro, el viaje activo y el cobro de comida iban en tamaño normal, y Flex sin la pieza); solo
 * pasaba «se achica en una línea», que la pieza ya cumplía. Revisión del mismo día: la regla de la
 * tarjeta en verde se vio en rojo con el bloque `viaje-tarjeta` todavía en `C.exito`.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
const pieza = leer('packages/movil/src/MontoEnMano.tsx');

/**
 * Cada `<MontoEnMano … />` de un archivo, entero. Se lee carácter a carácter contando las llaves
 * (`{ … }`) y las comillas, así un `/>` o un `>` dentro de una propiedad no corta el elemento.
 */
export function usos(codigo: string): string[] {
  const salida: string[] = [];
  let desde = codigo.indexOf('<MontoEnMano');
  while (desde >= 0) {
    let llaves = 0;
    let comilla: string | null = null;
    let i = desde + '<MontoEnMano'.length;
    for (; i < codigo.length; i++) {
      const ch = codigo.charAt(i);
      if (comilla) {
        if (ch === comilla && codigo.charAt(i - 1) !== '\\') comilla = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') comilla = ch;
      else if (ch === '{') llaves++;
      else if (ch === '}') llaves--;
      else if (llaves === 0 && ch === '/' && codigo.charAt(i + 1) === '>') break;
    }
    salida.push(codigo.slice(desde, i + 2));
    desde = codigo.indexOf('<MontoEnMano', i);
  }
  return salida;
}
const uso = (codigo: string, testID: string) =>
  usos(codigo).find((u) => u.includes(`testID="${testID}"`));

/** El verde de éxito: el de la marca (C.exito) o, en el fondo oscuro de Flex, su VERDE de «hecho». */
const ENVERDE = /color=\{(C\.exito|VERDE)\}/;
/** Montos de la pieza que NO son un cobro ni una ganancia (van grandes, pero sin verde). */
const SIN_VERDE = new Set(['viaje-tarjeta']);

/** Los archivos .tsx de Driver (sin pruebas). */
function archivosDriver(dir = join(raiz, 'apps/repartidor/src')): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivosDriver(p);
    return p.endsWith('.tsx') && !p.includes('.test.') ? [p] : [];
  });
}

describe('el lector de <MontoEnMano>', () => {
  it('no se corta en un «/>» ni en un «>» dentro de una propiedad', () => {
    const [u] = usos(
      `<MontoEnMano testID="x" monto={a > b ? { m: '/>' } : c} etiqueta={f(() => 1)} tamano="grande" />`,
    );
    expect(u).toMatch(/tamano="grande" \/>$/);
  });
});

describe('C-PRECIO-PROTAGONISTA: el monto a cobrar en Driver, tan visible como el PIN', () => {
  it('la cifra grande de la pieza es en negrita y no más chica que el PIN de Driver', () => {
    const viaje = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
    const tamanosPin = ['viaje-pin', 'envio-pin-entrega'].map((id) => {
      const bloque = viaje.slice(viaje.indexOf(`testID="${id}"`)).slice(0, 700);
      const m = /fontSize: (\d+)/.exec(bloque);
      expect(m, `no encontré la letra del PIN ${id}`).toBeTruthy();
      return Number(m?.[1]);
    });
    const grande = /fontSize: grande \? (\d+)/.exec(pieza);
    expect(Number(grande?.[1])).toBeGreaterThanOrEqual(Math.max(...tamanosPin));
    expect(pieza).toMatch(/fontWeight: grande \? '800'/);
  });

  it('cabe en 360 de ancho y con letra grande: una línea que se achica sola', () => {
    expect(pieza).toMatch(/numberOfLines=\{1\}\s*adjustsFontSizeToFit/);
  });

  // Cada pantalla de cobro de Driver: la cifra que va grande y en verde y la etiqueta que lleva
  // (null: la pantalla la dice fuera de la pieza, con su propio texto).
  const PANTALLAS: [string, [string, RegExp | null][]][] = [
    // La oferta de Moto, Carro y envío: lo que gana y, si cobra en mano, cuánto cobra.
    [
      'apps/repartidor/src/viajes/OfertaViaje.tsx',
      [
        ['oferta-viaje-ganancia', /etiqueta=\{t\.ganas\}/],
        [
          'oferta-en-mano',
          /etiqueta=\{oferta\.metodoPago === 'efectivo' \? t\.enEfectivo : t\.cobraEnMano\}/,
        ],
      ],
    ],
    // La oferta de comida: lo que gana y, si el cliente paga en mano, cuánto cobra.
    [
      'apps/repartidor/src/grandes/Oferta.tsx',
      [
        ['oferta-ganancia', /etiqueta=\{t\.garantizado\}/],
        [
          'oferta-cobro-monto',
          /etiqueta=\{oferta\.metodoPago === 'efectivo' \? t\.enEfectivo : t\.porTransferencia\}/,
        ],
      ],
    ],
    // El viaje y el envío activos (todos sus pasos), el cierre y el pago móvil.
    [
      'apps/repartidor/src/viajes/ViajeActivo.tsx',
      [
        ['viaje-bs', /etiqueta=\{etiquetaCobro\}/],
        ['viaje-cobra-monto', /etiqueta=\{etiquetaCobro\}/],
        ['viaje-pago-movil-monto', null],
      ],
    ],
    // El pedido de comida activo cuando se cobra en mano.
    [
      'apps/repartidor/src/Inicio.tsx',
      [['cobro-directo-bs', /tg\.pedido\.cobrarEfectivo\s*:\s*tg\.pedido\.cobrarTransfer/]],
    ],
    // Flex: el cobro contra entrega de la parada (el título «Cobrar al entregar» va arriba).
    ['apps/repartidor/src/flex/MiRuta.tsx', [['cobro-entrega-monto', null]]],
  ];
  it.each(PANTALLAS)(
    '%s: la cifra va con la pieza, grande, en verde y con su etiqueta',
    (archivo, ids) => {
      const codigo = leer(archivo);
      for (const [id, etiqueta] of ids) {
        const u = uso(codigo, id);
        expect(u, `${archivo}: falta <MontoEnMano testID="${id}">`).toBeTruthy();
        expect(u, `${id} no va en grande`).toMatch(/tamano="grande"/);
        expect(u, `${id} no va en verde`).toMatch(ENVERDE);
        if (etiqueta) expect(u, `${id} no lleva su etiqueta`).toMatch(etiqueta);
      }
    },
  );

  it('las etiquetas existen en español y en inglés', () => {
    const viajes = leer('apps/repartidor/src/viajes/textos.ts');
    for (const clave of [
      'ganas',
      'enEfectivo',
      'cobraEnMano',
      'cobra',
      'cobraPagoMovil',
      'cobraAlPasajero',
    ])
      expect(viajes.split(` ${clave}:`).length - 1, clave).toBeGreaterThanOrEqual(2);
    const grandes = leer('apps/repartidor/src/grandes/textos.ts');
    for (const clave of [
      'garantizado',
      'enEfectivo',
      'porTransferencia',
      'cobrarEfectivo',
      'cobrarTransfer',
    ])
      expect(grandes.split(` ${clave}:`).length - 1, clave).toBeGreaterThanOrEqual(2);
  });

  it('con tarjeta: el precio grande en el color de texto (no verde) y el aviso bien visible', () => {
    const v = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
    const u = uso(v, 'viaje-tarjeta');
    expect(u).toBeTruthy();
    expect(u).toMatch(/tamano="grande"/);
    expect(u).not.toMatch(ENVERDE);
    expect(u).toMatch(/color=\{COLOR\.texto\}/);
    const aviso = v.slice(v.indexOf('testID="viaje-tarjeta-aviso"')).slice(0, 200);
    expect(aviso).toMatch(/fontWeight: '800'/);
    expect(aviso).toContain('{t.pagaConTarjeta}');
  });

  it('barrido: ningún monto de la pieza queda pequeño o con el color equivocado en Driver', () => {
    const malos = archivosDriver()
      .filter((p) => !p.endsWith('CobrarEfectivo.tsx')) // el Agente Divoox tiene su propio candado
      .flatMap((p) =>
        usos(readFileSync(p, 'utf8'))
          .filter((u) => {
            const id = /testID="([^"]+)"/.exec(u)?.[1] ?? '';
            if (!/tamano="grande"/.test(u)) return true;
            return SIN_VERDE.has(id) ? ENVERDE.test(u) : !ENVERDE.test(u);
          })
          .map((u) => `${relative(raiz, p)}: ${/testID="([^"]+)"/.exec(u)?.[1] ?? u.slice(0, 60)}`),
      );
    expect(malos).toEqual([]);
  });

  it('las ganancias de las ofertas ya no se pintan a mano en negro', () => {
    for (const archivo of [
      'apps/repartidor/src/viajes/OfertaViaje.tsx',
      'apps/repartidor/src/grandes/Oferta.tsx',
    ])
      expect(leer(archivo)).not.toMatch(/fontSize: 40, fontWeight: '800', color: C\.secundario/);
  });

  it('viaje activo: la tarjeta del precio va arriba, antes de la dirección', () => {
    const v = leer('apps/repartidor/src/viajes/ViajeActivo.tsx');
    const precio = v.indexOf('testID="viaje-precio"');
    expect(precio).toBeGreaterThan(0);
    expect(precio).toBeLessThan(v.indexOf('{direccion}</Text>'));
    // Con regalo: «Cobra al pasajero» (o «a quien envía») y lo de Divoox aparte, en verde.
    expect(v).toMatch(/regaloDivoox > 0\s*\?\s*t\.cobraAlPasajero/);
    const textos = leer('apps/repartidor/src/viajes/textos.ts');
    for (const frase of [
      "cobraAlPasajero: 'Cobra al pasajero'",
      "cobraAlPasajero: 'Collect from the rider'",
      "cobraAlPasajero: 'Cobra a quien envía'",
      "cobraAlPasajero: 'Collect from the sender'",
    ])
      expect(textos).toContain(frase);
  });
});
