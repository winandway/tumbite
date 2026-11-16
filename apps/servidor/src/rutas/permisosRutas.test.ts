import { describe, expect, it } from 'vitest';
import {
  LIBRE,
  LISTA_RUTAS_ADMIN,
  PERFILES_INTERNOS,
  PERMISOS_INTERNOS,
  PERMISOS_RUTAS_ADMIN,
  PLANTILLAS_SISTEMA,
  RUTAS_ADMIN_PREVISTAS,
  esPermisoInterno,
  permisoDeRuta,
  permisosDeLegado,
  permiteAccionInterna,
} from '@tumbite/compartido';
import { app } from '../app';

/**
 * Candado C-PERMISOS-FINOS (MON-5, 15 nov 2026) — «ruta sin permiso = rojo». Recorre TODAS las rutas
 * que Hono tiene registradas bajo /datos/admin y exige que cada una declare su permiso en
 * `PERMISOS_RUTAS_ADMIN` (packages/compartido/src/rutasAdmin.ts). Comprobado en rojo quitando una
 * línea del mapa (la de `GET /admin/clientes/:id`): la prueba la nombra.
 */
const registradas = [
  ...new Set(
    app.routes
      .filter((r) => r.path.startsWith('/datos/admin') && r.method !== 'ALL')
      .map((r) => `${r.method} ${r.path.slice('/datos'.length)}`),
  ),
].sort();

describe('C-PERMISOS-FINOS: cada ruta del superadmin declara su permiso', () => {
  it('hay rutas que mirar (si el recorrido falla, la prueba no puede quedar verde por vacía)', () => {
    expect(registradas.length).toBeGreaterThan(150);
  });

  it('ninguna ruta registrada bajo /datos/admin queda sin permiso declarado', () => {
    const sinPermiso = registradas.filter((r) => !Object.hasOwn(PERMISOS_RUTAS_ADMIN, r));
    expect(sinPermiso).toEqual([]);
  });

  it('el mapa no guarda rutas que ya no existen (salvo las previstas de otra rama)', () => {
    const sobran = Object.keys(PERMISOS_RUTAS_ADMIN).filter(
      (k) => !registradas.includes(k) && !RUTAS_ADMIN_PREVISTAS.has(k),
    );
    expect(sobran).toEqual([]);
  });

  it('cada permiso del mapa existe (o es «libre»)', () => {
    for (const [ruta, p] of LISTA_RUTAS_ADMIN)
      expect(p === LIBRE || esPermisoInterno(p), ruta).toBe(true);
  });

  it('la petición encuentra su permiso: la ruta fija gana a la de parámetro', () => {
    expect(permisoDeRuta('GET', '/datos/admin/tickets/plantillas')?.permiso).toBe('tickets.ver');
    expect(permisoDeRuta('DELETE', '/datos/admin/tickets/plantillas/x1')?.permiso).toBe(
      'tickets.plantillas',
    );
    expect(permisoDeRuta('PATCH', '/datos/admin/tickets/abc')?.permiso).toBe('tickets.asignar');
    expect(permisoDeRuta('HEAD', '/datos/admin/pedidos')?.permiso).toBe('pedidos.ver');
    expect(permisoDeRuta('POST', '/datos/admin/no-existe')).toBeNull();
    expect(permisoDeRuta('GET', '/datos/admin/viajes/tarifas')?.permiso).toBe('viajes.ver');
  });

  it('una lectura nunca usa un permiso que también abra un cambio («Solo lectura» no cambia nada)', () => {
    const deLectura = new Set(
      LISTA_RUTAS_ADMIN.filter(([k]) => k.startsWith('GET ')).map(([, p]) => p),
    );
    const mezclados = LISTA_RUTAS_ADMIN.filter(
      ([k, p]) => !k.startsWith('GET ') && p !== LIBRE && deLectura.has(p),
    ).map(([k]) => k);
    expect(mezclados).toEqual([]);
  });
});

describe('C-PERMISOS-FINOS: compatibilidad — nadie que hoy tiene acceso lo pierde', () => {
  it('cada perfil viejo, traducido a permisos, abre EXACTAMENTE las mismas rutas que hoy', () => {
    for (const perfil of PERFILES_INTERNOS) {
      const permisos = new Set<string>(permisosDeLegado(perfil, LISTA_RUTAS_ADMIN));
      const distintas: string[] = [];
      for (const [clave, p] of LISTA_RUTAS_ADMIN) {
        const [metodo = 'GET', ruta = ''] = clave.split(' ');
        const hoy = permiteAccionInterna(perfil, metodo, `/datos${ruta}`);
        const ahora = p === LIBRE || permisos.has(p);
        // Lo que el perfil viejo frenaba DENTRO de la ruta (aprobar dinero, límites, el equipo)
        // sigue frenado: esas rutas abren con el perfil viejo y su permiso no está en el perfil.
        const frenadoDentro = ['dinero.aprobar', 'dinero.limites', 'equipo.gestionar'].includes(p);
        if (hoy !== ahora && !(hoy && frenadoDentro && !ahora))
          distintas.push(`${perfil}: ${clave}`);
      }
      expect(distintas, perfil).toEqual([]);
    }
  });

  it('Total es todos los permisos', () => {
    expect(permisosDeLegado('total', LISTA_RUTAS_ADMIN)).toEqual([...PERMISOS_INTERNOS]);
    expect(PLANTILLAS_SISTEMA.find((p) => p.id === 'total')?.permisos).toEqual(PERMISOS_INTERNOS);
  });

  it('Soporte y Finanzas viejos conservan lo que su ruta les dejaba aprobar (y nada más)', () => {
    const soporte = permisosDeLegado('soporte', LISTA_RUTAS_ADMIN);
    const finanzas = permisosDeLegado('finanzas', LISTA_RUTAS_ADMIN);
    expect(finanzas).toContain('dinero.aprobar');
    expect(soporte).not.toContain('dinero.aprobar');
    expect(soporte).toContain('pedidos.devolver');
    for (const p of [soporte, finanzas, permisosDeLegado('lectura', LISTA_RUTAS_ADMIN)]) {
      expect(p).not.toContain('dinero.limites');
      expect(p).not.toContain('equipo.gestionar');
      // Hoy cualquier cuenta del equipo ve fotos y contactos: los conservan (ahora con registro).
      expect(p).toContain('pedidos.fotos');
      expect(p).toContain('clientes.datos_personales');
    }
  });
});
