import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REFERENCIA_PAGO_VALIDA,
  TEXTOS_PAGO_COMIDA_CLIENTE,
  TEXTOS_PAGO_COMIDA_CONDUCTOR,
  TEXTOS_PAGO_COMIDA_RESTAURANTE,
  limpiarReferenciaPago,
  relojPago,
  segundosHasta,
} from './pagoComidaVista';

const raiz = resolve(__dirname, '../../..');
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8');

describe('C-COMIDA-PAGO-RESTAURANTE · lo que ve el cliente', () => {
  it('la cuenta atrás nunca es negativa y se lee como reloj', () => {
    expect(relojPago(900)).toBe('15:00');
    expect(relojPago(65)).toBe('1:05');
    expect(relojPago(-4)).toBe('0:00');
    expect(relojPago(null)).toBe('0:00');
    const ahora = Date.parse('2026-01-01T00:00:00Z');
    expect(segundosHasta('2026-01-01T00:14:30Z', ahora)).toBe(870);
    expect(segundosHasta('2025-12-31T23:59:00Z', ahora)).toBe(0);
    expect(segundosHasta(null, ahora)).toBe(0);
  });

  it('la referencia pegada del banco se limpia y se valida como en el servidor', () => {
    expect(limpiarReferenciaPago(' 0012 3456.78 ')).toBe('0012345678');
    expect(REFERENCIA_PAGO_VALIDA.test('0012345678')).toBe(true);
    expect(REFERENCIA_PAGO_VALIDA.test('123')).toBe(false);
    expect(REFERENCIA_PAGO_VALIDA.test('12 34')).toBe(false);
  });

  it('español e inglés tienen los mismos textos, y dicen «conductor» / «driver»', () => {
    const { es, en } = TEXTOS_PAGO_COMIDA_CLIENTE;
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const v of Object.values(es)) expect(v.toLowerCase()).not.toContain('repartidor');
    for (const [k, v] of Object.entries(en)) expect(v, k).not.toMatch(/[áéíóúñ¿¡]/);
    expect(es.capturaNota).toMatch(/mirando su banco/);
  });

  it('la pantalla del pedido del cliente monta la pieza, con borrador y cámara', () => {
    const pedido = leer('apps/cliente/src/app/order/[id].tsx');
    expect(pedido).toMatch(/<PagoComida\b/);
    const pieza = leer('apps/cliente/src/PagoComida.tsx');
    expect(pieza).toMatch(/useBorrador\(/);
    expect(pieza).toMatch(/fotoConCamara\(/);
    expect(pieza).toMatch(/\/pago-comida`/);
    expect(pieza).toMatch(/\/pago-comida\/comprobante`/);
    // La captura es opcional: el botón de enviar no depende de ella.
    expect(pieza).not.toMatch(/disabled=\{[^}]*captura/);
  });

  it('el restaurante confirma mirando su banco, tiene su cuenta de cobro y su saldo', () => {
    const { es, en } = TEXTOS_PAGO_COMIDA_RESTAURANTE;
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    expect(es.miraTuBanco).toMatch(/captura no es prueba/);
    expect(JSON.stringify(es).toLowerCase()).not.toContain('repartidor');
    const inicio = leer('apps/restaurante/src/Inicio.tsx');
    expect(inicio).toMatch(/<PagoComidaPedido\b/);
    expect(inicio).toMatch(/<CuentaCobroRestaurante\b/);
    expect(inicio).toMatch(/<SaldoRestaurante\b/);
    // La fila del pedido avisa del pago por confirmar sin tener que abrirla (visto al tomar las capturas).
    expect(inicio).toMatch(/fila-pago-por-confirmar/);
    expect(es.filaConfirma).toMatch(/mira tu banco/);
    // Con pago directo, el restaurante no ve «el conductor paga en el mostrador» (lo contradecía).
    expect(inicio).toMatch(/metodoPago !== 'tarjeta' && !p\.pagoComida \?/);
    const pieza = leer('apps/restaurante/src/PagoComidaRest.tsx');
    expect(pieza).toMatch(/\/pago-comida`, \{ llego/);
    expect(pieza).toMatch(/\/pago-comida\/devolucion`/);
    expect(pieza).toMatch(/\/datos\/restaurante\/cuenta-cobro/);
    expect(pieza).toMatch(/\/datos\/restaurante\/saldo\/recargas/);
    // Tres formularios, los tres con borrador; la contraseña nunca se guarda en el borrador.
    expect(pieza.match(/useBorrador\(/g)?.length).toBe(3);
    expect(pieza).not.toMatch(/b\.cambiar\('clave'/);
    expect(pieza).toMatch(/fotoConCamara\(/);
  });

  it('Driver: el conductor no paga en el local, espera el «Me llegó» y cobra solo el envío', () => {
    const { es, en } = TEXTOS_PAGO_COMIDA_CONDUCTOR;
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    const inicio = leer('apps/repartidor/src/Inicio.tsx');
    expect(inicio).toMatch(/<SalidaPagoComida\b/);
    // Con pago directo al restaurante no se muestra el formulario de «pagué en el local».
    expect(inicio).toMatch(/!activo\.pagoComida &&[\s\S]{0,200}<PagoEnLocal/);
    const pieza = leer('apps/repartidor/src/grandes/SalidaPagoComida.tsx');
    expect(pieza).toMatch(/listoParaIr/);
  });

  it('el panel web del restaurante tiene lo mismo que su app', () => {
    const pedidos = leer('apps/panel/src/panel/Pedidos.tsx');
    expect(pedidos).toMatch(/<PagoComidaPanel\b/);
    expect(pedidos).toMatch(/pagoComida\.estado === 'confirmado'/);
    const pieza = leer('apps/panel/src/panel/PagoComidaPanel.tsx');
    expect(pieza).toMatch(/\/pago-comida`, \{ llego/);
    expect(pieza).toMatch(/useBorrador\(/);
    expect(pieza).toMatch(/miraTuBanco/);
    // Y su cuenta de pago móvil con su saldo, en «Mi restaurante» (la contraseña fuera del borrador).
    const mio = leer('apps/panel/src/panel/MiRestaurante.tsx');
    expect(mio).toMatch(/<CuentaSaldoRestaurante\b/);
    const cuenta = leer('apps/panel/src/panel/CuentaSaldoRestaurante.tsx');
    expect(cuenta).toMatch(/useBorrador\(/);
    expect(cuenta).toMatch(/<CampoClave\b/);
    expect(cuenta).not.toMatch(/b\.cambiar\('clave'/);
    expect(cuenta).toMatch(/\/datos\/restaurante\/saldo/);
  });

  it('el superadmin revisa las recargas de restaurantes y puede poner su comisión', () => {
    const fin = leer('apps/panel/src/panel/SuperFinanzas.tsx');
    expect(fin).toMatch(/<RecargasRestaurantesAdmin\b/);
    expect(fin).toMatch(/restaurante: 'Restaurante'/);
    const pieza = leer('apps/panel/src/panel/RecargasRestaurantesAdmin.tsx');
    expect(pieza).toMatch(/restaurantes-saldo\/recargas\/\$\{id\}\/acreditar/);
    // Rechazar va dentro de los tres puntos, nunca a la vista.
    expect(pieza).toMatch(/MenuTresPuntos[\s\S]{0,200}t\.rechazar/);
  });
});
