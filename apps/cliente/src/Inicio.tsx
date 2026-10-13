import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorApi, type Restaurante, descripcion, enIdioma } from '@tumbite/compartido';
import {
  Boton,
  C,
  MenuCuenta,
  Pantalla,
  TEXTOS_MOVIL,
  e,
  urlFoto,
  useSesion,
} from '@tumbite/movil';
import { useCarrito } from './carrito';
import { TEXTOS, distanciaTexto } from './textos';
import { type Punto, miUbicacion } from './ubicacion';

export function Inicio() {
  const { api, idioma, usuario, salir } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const { cantidadTotal } = useCarrito();
  const [lista, setLista] = useState<Restaurante[] | null>(null);
  const [error, setError] = useState('');
  const [punto, setPunto] = useState<Punto | null>(null);
  // La portada de tumbite.com puede mandar la ubicación por la dirección (?lat=&lng=).
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const cargar = useCallback(
    async (p: Punto | null) => {
      setError('');
      try {
        const q = p ? `?lat=${p.lat}&lng=${p.lng}` : '';
        const r = await api.pedir<{ restaurantes: Restaurante[] }>(
          'GET',
          `/datos/restaurantes${q}`,
        );
        setLista(r.restaurantes);
      } catch (x) {
        setError(x instanceof ErrorApi ? x.message : String(x));
      }
    },
    [api],
  );

  useEffect(() => {
    void (async () => {
      const deUrl =
        params.lat && params.lng && Number.isFinite(Number(params.lat))
          ? { lat: Number(params.lat), lng: Number(params.lng) }
          : null;
      const p = deUrl ?? (await miUbicacion());
      setPunto(p);
      await cargar(p);
    })();
  }, [cargar, params.lat, params.lng]);

  return (
    <Pantalla titulo={`${tm.hola}, ${usuario?.nombre.split(' ')[0] ?? ''}`}>
      {/* Mi cuenta: historial, tarjetas, datos y ayuda. */}
      <Boton
        texto={idioma === 'en' ? 'My account' : 'Mi cuenta'}
        alTocar={() => router.push('/account')}
        secundario
      />
      <Text style={{ fontSize: 18, fontWeight: '700', color: C.secundario, marginBottom: 8 }}>
        {t.cerca}
      </Text>
      {!punto && <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>{t.sinUbicacion}</Text>}
      {error ? (
        <View>
          <Text style={e.error}>{error}</Text>
          <Boton texto={t.reintentar} alTocar={() => void cargar(punto)} secundario />
        </View>
      ) : null}
      {lista && lista.length === 0 && <Text style={e.tarjeta}>{t.sinRestaurantes}</Text>}
      {lista?.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => router.push(`/restaurant/${r.id}`)}
          accessibilityRole="button"
          accessibilityLabel={r.nombre}
          style={({ pressed }) => [
            e.tarjeta,
            !r.abierto && { opacity: 0.55 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {urlFoto(r.imagen) ? (
            <Image
              source={{ uri: urlFoto(r.imagen) ?? undefined }}
              accessibilityIgnoresInvertColors
              style={{
                width: '100%',
                aspectRatio: 16 / 9,
                borderRadius: 12,
                marginBottom: 10,
                backgroundColor: '#f1f1f1',
              }}
            />
          ) : null}
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.secundario }}>{r.nombre}</Text>
          <Text style={{ color: '#5E5E5E', marginTop: 2 }}>
            {[
              r.categoria,
              r.distanciaKm != null ? distanciaTexto(r.distanciaKm, idioma) : null,
              `${r.tiempoPrepMin + 15} ${t.minutos}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {descripcion(r, idioma) ? (
            <Text style={{ marginTop: 6 }} numberOfLines={2}>
              {descripcion(r, idioma)}
            </Text>
          ) : null}
          <Text
            style={{ marginTop: 6, fontWeight: '700', color: r.abierto ? '#0d7a3a' : '#8a0014' }}
          >
            {r.abierto ? t.abierto : t.cerrado}
          </Text>
        </Pressable>
      ))}
      {cantidadTotal > 0 && (
        <Boton texto={`${t.verCarrito} (${cantidadTotal})`} alTocar={() => router.push('/cart')} />
      )}
      <Boton texto={tm.salir} alTocar={() => void salir()} secundario />
      <MenuCuenta />
    </Pantalla>
  );
}
