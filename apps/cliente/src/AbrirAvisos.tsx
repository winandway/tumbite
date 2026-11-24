import { useCallback } from 'react';
import { router } from 'expo-router';
import { useAvisosPrimerPlano, useToqueAviso } from '@tumbite/movil';

/**
 * Al tocar un aviso se abre lo que corresponde: un pedido de comida va a su seguimiento y un paquete
 * de Divoox Flex a «Mis paquetes» (C-AVISO-PAQUETE). No dibuja nada.
 * C-AVISOS-PRIMER-PLANO (24 nov 2026): con la app abierta, un aviso (tu conductor llegó, mensaje,
 * viaje cancelado) sale arriba y suena; antes se descartaba en silencio.
 */
export function AbrirAvisos() {
  const alTocar = useCallback((datos: Record<string, unknown>) => {
    if (datos.tipo === 'flex_paquete') router.push('/packages');
    else if (typeof datos.pedidoId === 'string' && /^[\w-]{8,64}$/.test(datos.pedidoId))
      router.push(`/order/${datos.pedidoId}`);
  }, []);
  useToqueAviso(alTocar);
  useAvisosPrimerPlano('cliente');
  return null;
}
