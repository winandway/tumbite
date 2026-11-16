import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { PREFIJOS_FICHA, seccionAdmin } from './PanelApp';
import { SuperPedido, SuperPedidos } from './SuperPedido';
import { SuperCliente, SuperRepartidor, SuperRestaurante } from './SuperFichas';
import { SuperTickets } from './Superadmin';
import { SuperKyc } from './SuperKyc';
import { SuperFinanzas } from './SuperFinanzas';
import { SuperViaje } from './SuperViaje';

/**
 * C-SUPERADMIN-ENLACES (15 nov 2026, Richard tocó «Prueba en vivo» en Restaurantes y salió «Esta
 * página no existe»). Todos los países. Cada enlace de una lista del superadmin abre su ficha, con
 * un id UUID y con uno que no lo es. Comprobado en rojo volviendo al patrón viejo `[0-9a-f-]{36}`.
 */
const BASE = '/panel/control-x';
const ADMIN = { id: 'a1', nombre: 'Equipo', correo: 'e@ejemplo.com', rol: 'admin' } as never;
const IDS = [
  '407f2f1c-1234-4abc-9def-000000000001',
  'zz-vivo-r-2ff1f76da2c5',
  'vol_p_1',
  'ABC-123',
];
const COMPONENTE: Record<(typeof PREFIJOS_FICHA)[number], unknown> = {
  orders: SuperPedido,
  pedidos: SuperPedido,
  customers: SuperCliente,
  drivers: SuperRepartidor,
  restaurants: SuperRestaurante,
  tickets: SuperTickets,
  verifications: SuperKyc,
  flexfinance: SuperFinanzas,
  rides: SuperViaje,
};
const idDe = (e: ReactElement<Record<string, unknown>>) =>
  e.props.id ?? e.props.ticketId ?? e.props.empresaId;

describe('C-SUPERADMIN-ENLACES · cada enlace de una lista abre su ficha', () => {
  for (const prefijo of PREFIJOS_FICHA)
    for (const id of IDS)
      it(`/${prefijo}/${id} abre la ficha`, () => {
        const e = seccionAdmin(`/${prefijo}/${id}`, BASE, ADMIN, 'es');
        expect(isValidElement(e)).toBe(true);
        const el = e as ReactElement<Record<string, unknown>>;
        expect(el.type).toBe(COMPONENTE[prefijo]);
        expect(idDe(el)).toBe(id);
      });

  it('una dirección que no es de ficha sigue sin existir (no se abre cualquier cosa)', () => {
    expect(seccionAdmin('/restaurants/../x', BASE, ADMIN, 'es')).toBeNull();
    expect(seccionAdmin('/inventado/abc', BASE, ADMIN, 'es')).toBeNull();
    expect(seccionAdmin('/orders/a b', BASE, ADMIN, 'es')).toBeNull();
    expect((seccionAdmin('/orders', BASE, ADMIN, 'es') as ReactElement).type).toBe(SuperPedidos);
  });

  /**
   * Todos los enlaces que arman las pantallas del superadmin (`${base}/algo/${id}` y
   * `${base}/algo`) apuntan a una ficha o a una lista que existe. Si mañana una pantalla nueva
   * enlaza a `/rides/<id>` sin su ficha, esto se pone en rojo.
   */
  it('los enlaces escritos en las pantallas apuntan a fichas y listas que existen', () => {
    const carpeta = __dirname;
    const archivos = readdirSync(carpeta).filter(
      (f) => f.endsWith('.tsx') && !f.includes('.test.'),
    );
    const fichas = new Set<string>();
    const listas = new Set<string>();
    for (const f of archivos) {
      const s = readFileSync(join(carpeta, f), 'utf8');
      for (const m of s.matchAll(/\$\{base\}\/([a-z-]+)\/\$\{/g)) fichas.add(m[1] ?? '');
      for (const m of s.matchAll(/\$\{base\}\/([a-z-]+)[`?]/g)) listas.add(m[1] ?? '');
    }
    expect(fichas.size).toBeGreaterThan(5);
    for (const p of fichas)
      if (p !== 'cash') expect(PREFIJOS_FICHA as readonly string[], p).toContain(p);
    for (const p of listas) expect(seccionAdmin(`/${p}`, BASE, ADMIN, 'es'), p).not.toBeNull();
  });
});
