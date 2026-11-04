import type { ComponentType } from 'react';
import { router } from 'expo-router';
import { ConSesion } from '@tumbite/movil';

function seguirMirando() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * C-MIRAR-SIN-CUENTA (4 nov 2026, Gerencia con el dictamen del auditor de tiendas, Apple 5.1.1 v):
 * sin cuenta se miran la portada, los restaurantes, los menús y las tiendas, como en DoorDash. Lo que
 * es de la cuenta (el carrito y el pago, los pedidos, Mi cuenta, avisos, favoritos…) pide entrar ahí
 * mismo y, con C-CORREO-OBLIGATORIO, el correo confirmado antes de seguir. Al entrar, la persona
 * sigue en la pantalla que había abierto. Todos los países.
 */
export function conCuenta<P extends object>(Pantalla: ComponentType<P>) {
  function ConCuenta(props: P) {
    return (
      <ConSesion rolRegistro="cliente" pideCumple exigeCorreo seguirMirando={seguirMirando}>
        <Pantalla {...props} />
      </ConSesion>
    );
  }
  return ConCuenta;
}
