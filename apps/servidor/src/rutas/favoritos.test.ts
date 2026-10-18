import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';

/** Auditoría final, puntos 12 y 13: pestaña Pedidos real y Favoritos reales (C-PEDIDOS-FAVORITOS). */
describe('favoritos y pestaña de pedidos (C-PEDIDOS-FAVORITOS)', () => {
  it('guardar, listar y quitar un favorito; un restaurante inexistente no se guarda', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    expect((await m.llamar('PUT', `/datos/favoritos/${rid}`, {}, cliente.token)).estado).toBe(404);
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    expect(
      (await m.llamar('PUT', `/datos/favoritos/${rid}`, {}, cliente.token)).datos.favorito,
    ).toBe(true);
    await m.llamar('PUT', `/datos/favoritos/${rid}`, {}, cliente.token);
    expect((await m.llamar('GET', '/datos/favoritos', undefined, cliente.token)).datos.ids).toEqual(
      [rid],
    );
    expect(
      (await m.llamar('DELETE', `/datos/favoritos/${rid}`, undefined, cliente.token)).datos
        .favorito,
    ).toBe(false);
    expect((await m.llamar('GET', '/datos/favoritos', undefined, cliente.token)).datos.ids).toEqual(
      [],
    );
    expect((await m.llamar('GET', '/datos/favoritos', undefined, dueno.token)).estado).toBe(403);
  });

  it('la app tiene la pestaña Pedidos y la de Favoritos reales, y el seguimiento trae el recibo', () => {
    const raiz = join(__dirname, '..', '..', '..', '..');
    const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
    expect(leer('apps/cliente/src/Inicio.tsx')).toContain("router.push('/orders')");
    expect(leer('apps/cliente/src/Inicio.tsx')).toContain("router.push('/favorites')");
    expect(leer('apps/cliente/src/app/orders.tsx')).toContain("'/datos/mis-pedidos'");
    expect(leer('apps/cliente/src/app/orders.tsx')).toContain('repetir(');
    expect(leer('apps/cliente/src/app/favorites.tsx')).toContain("'/datos/favoritos'");
    expect(leer('apps/cliente/src/app/restaurants.tsx')).not.toContain('ModalMuyPronto');
    expect(leer('apps/cliente/src/app/order/[id].tsx')).toContain('testID="recibo"');
    expect(leer('apps/servidor/src/rutas/pedidos.ts')).toContain(
      'cargoPedidoPequeno: Number(f.cargo_pequeno',
    );
  });
});
