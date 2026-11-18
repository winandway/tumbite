import type { Idioma } from '@tumbite/compartido';
import { BarraPestanas, COLOR } from '@tumbite/movil';
import { textosInicio } from './textos';

export type Pestana = 'inicio' | 'pedidos' | 'favoritos' | 'wallet' | 'cuenta';

const nombrePestana = (n: Record<Pestana, string>, p: Pestana) =>
  new Map(Object.entries(n) as [Pestana, string][]).get(p) ?? p;

/**
 * Navegación inferior: Inicio, Pedidos, Favoritos y Mi cuenta. C-APPS-DISENO (15 nov 2026): íconos de
 * línea que se rellenan al elegirse y la pestaña activa en el rojo oscuro de la marca (texto chico
 * legible, 4,5:1), como las barras de Uber Eats y DoorDash.
 */
export function BarraInferior({
  idioma,
  activa,
  alTocar,
  puntoCuenta = false,
}: {
  idioma: Idioma;
  activa: Pestana;
  alTocar: (p: Pestana) => void;
  puntoCuenta?: boolean;
}) {
  const t = textosInicio(idioma);
  return (
    <BarraPestanas
      activa={activa}
      alTocar={(p) => alTocar(p as Pestana)}
      colorActivo={COLOR.marcaOscuro}
      pestanas={[
        {
          clave: 'inicio',
          texto: nombrePestana(t.nav, 'inicio'),
          icono: 'home-outline',
          iconoActivo: 'home',
        },
        {
          clave: 'pedidos',
          texto: nombrePestana(t.nav, 'pedidos'),
          icono: 'receipt-outline',
          iconoActivo: 'receipt',
        },
        {
          clave: 'favoritos',
          texto: nombrePestana(t.nav, 'favoritos'),
          icono: 'heart-outline',
          iconoActivo: 'heart',
        },
        // C-INICIO-NUEVO (borrador aprobado): Wallet (saldo, tarjetas de regalo y regalos de Divoox).
        {
          clave: 'wallet',
          texto: nombrePestana(t.nav, 'wallet'),
          icono: 'wallet-outline',
          iconoActivo: 'wallet',
        },
        {
          clave: 'cuenta',
          texto: nombrePestana(t.nav, 'cuenta'),
          icono: 'person-outline',
          iconoActivo: 'person',
          punto: puntoCuenta,
        },
      ]}
    />
  );
}
