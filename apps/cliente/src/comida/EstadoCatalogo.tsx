import { Text, View } from 'react-native';
import type { EstadoLista, Idioma } from '@tumbite/compartido';
import { Boton, e } from '@tumbite/movil';

/**
 * Hito 1 · C-CATALOGO-ESTABLE: lo que la persona ve cuando la lista NO es simplemente «aquí están
 * los restaurantes». Nunca una pantalla vacía sin explicación.
 */
const TEXTOS = {
  es: {
    zonaVacia: 'Todavía no hay restaurantes en tu zona. ¡Muy pronto!',
    fueraDeZona: 'Todavía no llegamos a tu zona. Pronto estaremos en más ciudades.',
    error: 'No pudimos cargar los restaurantes. Revisa tu conexión.',
    noSeActualizo: 'No pudimos actualizar la lista. Te mostramos la última que cargó.',
    reintentar: 'Intentar de nuevo',
  },
  en: {
    zonaVacia: 'No restaurants in your area yet. Coming soon!',
    fueraDeZona: 'We’re not in your area yet. We’re coming to more cities soon.',
    error: 'We couldn’t load the restaurants. Check your connection.',
    noSeActualizo: 'We couldn’t refresh the list. Showing the last one that loaded.',
    reintentar: 'Try again',
  },
} as const;

export const textosCatalogo = (i: Idioma) => (i === 'en' ? TEXTOS.en : TEXTOS.es);

export function EstadoCatalogo({
  idioma,
  catalogo,
}: {
  idioma: Idioma;
  catalogo: EstadoLista & { reintentar: () => Promise<void> };
}) {
  const t = textosCatalogo(idioma);
  const mensaje =
    catalogo.estado === 'fuera_de_zona'
      ? t.fueraDeZona
      : catalogo.estado === 'zona_vacia'
        ? t.zonaVacia
        : catalogo.estado === 'error'
          ? t.error
          : catalogo.error
            ? t.noSeActualizo
            : null;
  if (!mensaje) return null;
  const conReintentar = catalogo.estado === 'error' || Boolean(catalogo.error);
  return (
    <View
      style={{ marginHorizontal: 16, marginTop: 12, gap: 8 }}
      accessibilityRole="summary"
      testID={`catalogo-${catalogo.estado}${catalogo.error ? '-con-error' : ''}`}
    >
      <Text style={conReintentar ? e.error : { color: '#5E5E5E', fontSize: 15 }}>{mensaje}</Text>
      {conReintentar ? (
        <Boton texto={t.reintentar} alTocar={() => void catalogo.reintentar()} secundario />
      ) : null}
    </View>
  );
}
