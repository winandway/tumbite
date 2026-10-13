import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Candado C-QUEJAS: las tres apps reportan problemas con un ticket, nunca con un correo suelto. */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');

describe('quejas desde las tres apps', () => {
  it('el cliente reporta desde su pedido (con el pedido atado) y ya no hay correo a una cuenta personal', () => {
    const pedido = leer('apps', 'cliente', 'src', 'app', 'order', '[id].tsx');
    expect(pedido).toMatch(/<ReportarProblema pedidoId=\{p\.id\}/);
    expect(pedido).not.toMatch(/mailto:/);
  });
  it('el repartidor reporta desde su pantalla y el restaurante desde los tres puntos del pedido', () => {
    expect(leer('apps', 'repartidor', 'src', 'Inicio.tsx')).toMatch(/<ReportarProblema/);
    expect(leer('apps', 'panel', 'src', 'panel', 'Pedidos.tsx')).toMatch(
      /<ReportarPanel pedidoId=\{p\.id\}/,
    );
    expect(leer('packages', 'movil', 'src', 'ReportarProblema.tsx')).toMatch(/\/datos\/quejas/);
  });
});
