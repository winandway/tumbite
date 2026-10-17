import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { EstadoLista, Idioma } from '@tumbite/compartido';
import { Boton, e, useSesion } from '@tumbite/movil';

/** Lo que dice el servidor de una dirección fuera de cobertura (C-TERRITORIO). */
type Cobertura = {
  estado: 'dentro' | 'proximamente' | 'pausada' | 'cerrada' | 'fuera';
  area: { nombre: string; apertura: string | null } | null;
  ciudadesActivas: { id: string; nombre: string }[];
  proximas: { area: string; ciudad: string; apertura: string | null }[];
};

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
    abrePronto: 'Tu zona ({area}) abre muy pronto.',
    abreEl: 'Tu zona ({area}) abre el {fecha}.',
    pausada: 'El servicio en tu zona está en pausa por ahora.',
    yaEstamos: 'Ya estamos en: {lista}.',
    proximas: 'Próximas aperturas: {lista}.',
  },
  en: {
    zonaVacia: 'No restaurants in your area yet. Coming soon!',
    fueraDeZona: 'We’re not in your area yet. We’re coming to more cities soon.',
    error: 'We couldn’t load the restaurants. Check your connection.',
    noSeActualizo: 'We couldn’t refresh the list. Showing the last one that loaded.',
    reintentar: 'Try again',
    abrePronto: 'Your area ({area}) is opening very soon.',
    abreEl: 'Your area ({area}) opens on {fecha}.',
    pausada: 'Service in your area is paused for now.',
    yaEstamos: 'We’re already in: {lista}.',
    proximas: 'Opening soon: {lista}.',
  },
} as const;

export const textosCatalogo = (i: Idioma) => (i === 'en' ? TEXTOS.en : TEXTOS.es);

export function EstadoCatalogo({
  idioma,
  catalogo,
}: {
  idioma: Idioma;
  catalogo: EstadoLista & {
    reintentar: () => Promise<void>;
    punto?: { lat: number; lng: number } | null;
  };
}) {
  const t = textosCatalogo(idioma);
  const { api } = useSesion();
  const [cob, setCob] = useState<Cobertura | null>(null);
  const fuera = catalogo.estado === 'fuera_de_zona';
  const lat = catalogo.punto?.lat;
  const lng = catalogo.punto?.lng;
  useEffect(() => {
    if (!fuera) return;
    let vivo = true;
    const q = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : '';
    void (async () => {
      // Sin la lista, el mensaje de siempre sigue diciendo lo esencial.
      const r = await api.pedir<Cobertura>('GET', `/datos/cobertura${q}`).catch(() => null);
      if (vivo) setCob(r);
    })();
    return () => {
      vivo = false;
    };
  }, [api, fuera, lat, lng]);
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
      {fuera && cob ? <DetalleCobertura cob={cob} t={t} /> : null}
      {conReintentar ? (
        <Boton texto={t.reintentar} alTocar={() => void catalogo.reintentar()} secundario />
      ) : null}
    </View>
  );
}

function DetalleCobertura({ cob, t }: { cob: Cobertura; t: ReturnType<typeof textosCatalogo> }) {
  const suave = { color: '#5E5E5E', fontSize: 14 };
  const area = cob.area?.nombre ?? '';
  const lineas = [
    cob.estado === 'proximamente' && cob.area
      ? cob.area.apertura
        ? t.abreEl.replace('{area}', area).replace('{fecha}', cob.area.apertura)
        : t.abrePronto.replace('{area}', area)
      : null,
    cob.estado === 'pausada' ? t.pausada : null,
    cob.ciudadesActivas.length
      ? t.yaEstamos.replace('{lista}', cob.ciudadesActivas.map((z) => z.nombre).join(', '))
      : null,
    cob.proximas.length
      ? t.proximas.replace(
          '{lista}',
          cob.proximas
            .slice(0, 5)
            .map((p) => `${p.area} (${p.ciudad}${p.apertura ? `, ${p.apertura}` : ''})`)
            .join(' · '),
        )
      : null,
  ].filter((x): x is string => Boolean(x));
  return (
    <View testID="catalogo-cobertura" style={{ gap: 4 }}>
      {lineas.map((l) => (
        <Text key={l} style={suave}>
          {l}
        </Text>
      ))}
    </View>
  );
}
