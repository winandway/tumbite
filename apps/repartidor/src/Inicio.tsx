import { Text } from 'react-native';
import { t as texto } from '@tumbite/compartido';
import { Boton, Pantalla, TEXTOS_MOVIL, e, useSesion } from '@tumbite/movil';
import { enIdioma } from '@tumbite/compartido';

/** Inicio provisional: las pantallas de verdad llegan en los pasos siguientes del plan. */
export function Inicio() {
  const { usuario, idioma, salir } = useSesion();
  const t = enIdioma(TEXTOS_MOVIL, idioma);
  return (
    <Pantalla titulo={`${t.hola}, ${usuario?.nombre.split(' ')[0] ?? ''}`}>
      <Text style={e.tarjeta}>{texto(idioma, 'app.repartidor')}</Text>
      <Boton texto={t.salir} alTocar={() => void salir()} secundario />
    </Pantalla>
  );
}
