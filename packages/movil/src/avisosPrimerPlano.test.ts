import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { comoMostrarEnPrimerPlano } from './avisosPrimerPlanoRegla';

/**
 * C-AVISOS-PRIMER-PLANO (24 nov 2026; todos los países). Con expo-notifications 57, un aviso que llega
 * con la app ABIERTA se descarta si la app no tiene manejador: sin bandeja y sin sonido (lo dice la
 * librería: «The default behavior when the handler is not set … is not to show the notification»).
 * Driver y la app de clientes no tenían manejador. Ahora ningún aviso se descarta en silencio:
 * - una oferta al conductor queda en la bandeja, sin el sonido del sistema (suena la alarma propia de
 *   la hoja de oferta, que se pinta en cualquier pantalla) y la app la trae al instante;
 * - cualquier otro aviso sale arriba, con su sonido, y queda en la bandeja.
 */
describe('avisos con la app abierta', () => {
  it('lo que no es oferta: arriba, en la bandeja y con sonido', () => {
    const r = comoMostrarEnPrimerPlano({ tipo: 'viaje_cancelado' });
    expect(r.esOferta).toBe(false);
    expect(r.comportamiento).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
    expect(comoMostrarEnPrimerPlano(undefined).comportamiento.shouldShowBanner).toBe(true);
  });

  it('una oferta (viaje, envío, cliente fijo o comida): en la bandeja, sin doble sonido, y avisa a la app', () => {
    for (const tipo of ['oferta_operacion', 'oferta_pedido']) {
      const r = comoMostrarEnPrimerPlano({ tipo });
      expect(r.esOferta).toBe(true);
      expect(r.comportamiento.shouldShowList).toBe(true);
      expect(r.comportamiento.shouldShowBanner).toBe(false);
      expect(r.comportamiento.shouldPlaySound).toBe(false);
    }
  });

  it('la ruta de Flex (sin hoja con alarma propia) y los avisos de oferta retirada sí suenan', () => {
    for (const tipo of ['oferta', 'oferta_retirada', 'oferta_vencida']) {
      const r = comoMostrarEnPrimerPlano({ tipo });
      expect(r.esOferta).toBe(false);
      expect(r.comportamiento.shouldPlaySound).toBe(true);
    }
  });

  it('las dos apps lo usan: Driver y clientes', () => {
    const driver = readFileSync(join(__dirname, '../../../apps/repartidor/src/Inicio.tsx'), 'utf8');
    const cliente = readFileSync(
      join(__dirname, '../../../apps/cliente/src/AbrirAvisos.tsx'),
      'utf8',
    );
    expect(driver).toMatch(/useAvisosPrimerPlano\(/);
    expect(cliente).toMatch(/useAvisosPrimerPlano\(/);
  });

  it('la pieza pone el manejador y lo quita al desmontar', () => {
    const s = readFileSync(join(__dirname, 'avisosPrimerPlano.ts'), 'utf8');
    expect(s).toContain('setNotificationHandler({');
    expect(s).toContain('setNotificationHandler(null)');
    expect(s).toContain('addNotificationReceivedListener');
  });
});
