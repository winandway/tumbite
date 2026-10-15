import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-RESTAURANTE-DISENO (14 oct 2026): la app del restaurante con el diseño aprobado de
 * ocho pantallas conserva la alarma, la pantalla encendida, el código QR y todas las acciones del
 * pedido, y Mi menú usa las mismas rutas del panel web (sin servicios duplicados).
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');
const APP = ['apps', 'restaurante', 'src'];

describe('app del restaurante con el diseño aprobado', () => {
  const inicio = leer(...APP, 'Inicio.tsx');
  it('la alarma, la pantalla encendida y el QR siguen igual', () => {
    expect(inicio).toMatch(/useKeepAwake\(\)/);
    expect(inicio).toMatch(/if \(hayNuevos\) alarma\.play\(\)/);
    expect(inicio).toMatch(/<CodigoQR texto=\{`tumbite:pedido:\$\{p\.id\}`\}/);
  });
  it('todas las acciones del pedido siguen conectadas', () => {
    for (const ruta of [
      '/aceptar`',
      '/listo`',
      '/tiempo`',
      '/falta`',
      '/rechazar`',
      '/confirmar-recogida`',
      '/entregado-local`',
    ])
      expect(inicio).toContain(ruta);
    expect(inicio).toMatch(/\/datos\/mi-restaurante\/abierto/);
    expect(inicio).toMatch(/\/datos\/restaurante\/cocina/);
  });
  it('barra de abajo con Inicio, Pedidos, Menú, Estadísticas y Más', () => {
    expect(leer(...APP, 'piezas', 'ui.tsx')).toMatch(
      /\['inicio', 'pedidos', 'menu', 'estadisticas', 'mas'\] as const/,
    );
    expect(inicio).toMatch(/<MiMenu platos=\{platos\} recargar=\{cargar\} \/>/);
    expect(inicio).toMatch(/<Estadisticas \/>/);
  });
  it('Mi menú usa las rutas del panel, guarda el borrador y borra solo desde los tres puntos', () => {
    const menu = leer(...APP, 'MiMenu.tsx');
    expect(menu).toMatch(/'POST', '\/datos\/mi-restaurante\/platos'/);
    expect(menu).toMatch(/'PUT',\s*`\/datos\/mi-restaurante\/platos\/\$\{plato\.id\}`/);
    expect(menu).toMatch(/\/datos\/mi-restaurante\/platos\/\$\{p\.id\}\/disponible/);
    expect(menu).toMatch(/'DELETE', `\/datos\/mi-restaurante\/platos\/\$\{p\.id\}`/);
    expect(menu).toMatch(/useBorrador\(/);
    expect(menu).toMatch(/menuDe === p\.id \?/);
    expect(menu).toMatch(/await confirmar\(/);
  });
  it('la app del restaurante se publica en la web en /restaurant', () => {
    expect(JSON.parse(leer('apps', 'restaurante', 'app.json')).expo.experiments.baseUrl).toBe(
      '/restaurant',
    );
    const publicar = leer('.github', 'workflows', 'publicar.yml');
    expect(publicar).toMatch(/npm run build:restaurante-web/);
    expect(publicar).toMatch(/out-deploy\/restaurant\//);
  });
  it('el acceso del restaurante tiene su portada sin cambiar el de cliente y repartidor', () => {
    expect(leer(...APP, 'app', 'index.tsx')).toMatch(/<Acceso portada=\{<Portada \/>\} \/>/);
    expect(leer('packages', 'movil', 'src', 'Acceso.tsx')).toMatch(/portada \?/);
    expect(leer('apps', 'cliente', 'src', 'app', '_layout.tsx')).not.toMatch(/portada/);
  });
});
