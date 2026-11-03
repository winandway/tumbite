import { ScrollView } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { Pildora } from '../comida/piezas';
import { textosInicio } from './textos';

export type FiltrosInicio = { recoger: boolean; ofertas: boolean; abiertos: boolean };

/**
 * POR-1 (2 nov 2026): filtros rápidos del inicio, como DoorDash («Pickup», «Offers», «Open now»).
 * Entrega y Recoger son una sola elección; Ofertas y Abiertos se prenden y apagan. Van pegados
 * arriba junto al buscador cuando la persona baja.
 */
export function Filtros({
  idioma,
  valor,
  cambiar,
}: {
  idioma: Idioma;
  valor: FiltrosInicio;
  cambiar: (v: FiltrosInicio) => void;
}) {
  const t = textosInicio(idioma).filtros;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      testID="filtros-inicio"
    >
      <Pildora
        texto={t.entrega}
        activa={!valor.recoger}
        alTocar={() => cambiar({ ...valor, recoger: false })}
        rol="radio"
      />
      <Pildora
        texto={t.recoger}
        activa={valor.recoger}
        alTocar={() => cambiar({ ...valor, recoger: true })}
        rol="radio"
      />
      <Pildora
        texto={t.ofertas}
        activa={valor.ofertas}
        alTocar={() => cambiar({ ...valor, ofertas: !valor.ofertas })}
        rol="checkbox"
      />
      <Pildora
        texto={t.abiertos}
        activa={valor.abiertos}
        alTocar={() => cambiar({ ...valor, abiertos: !valor.abiertos })}
        rol="checkbox"
      />
    </ScrollView>
  );
}
