import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import {
  CONFIG_DINERO_INICIAL,
  type Idioma,
  type Restaurante,
  calcularEnvio,
  formatearMonto,
  proximaApertura,
  textoApertura,
} from '@tumbite/compartido';
import { router } from 'expo-router';
import { C, urlFoto } from '@tumbite/movil';
import { IMG, fotoDeRelleno } from './recursos';
import { textosInicio } from './textos';

const tarjeta = {
  backgroundColor: '#fff',
  borderRadius: 18,
  overflow: 'hidden',
  shadowColor: '#101010',
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

const Corazon = ({ alTocar, etiqueta }: { alTocar: () => void; etiqueta: string }) => (
  <Pressable
    onPress={alTocar}
    accessibilityRole="button"
    accessibilityLabel={etiqueta}
    hitSlop={6}
    style={{
      position: 'absolute',
      top: 8,
      right: 8,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Image
      source={IMG.iconoCorazon}
      style={{ width: 16, height: 16 }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  </Pressable>
);

const Tiempo = ({ texto }: { texto: string }) => (
  <View
    style={{
      position: 'absolute',
      left: 10,
      bottom: 10,
      backgroundColor: C.primario,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    }}
  >
    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{texto}</Text>
  </View>
);

/**
 * Restaurantes cerca de ti, en tarjetas horizontales: foto real (o de muestra por categoría),
 * tiempo estimado, envío calculado con la regla real y si está abierto. Sin restaurantes reales
 * se muestran tres de muestra marcados «Ejemplo».
 */
export function Restaurantes({
  idioma,
  lista,
  alTocar,
  alTocarEjemplo,
  cargando,
}: {
  idioma: Idioma;
  lista: Restaurante[];
  alTocar: (r: Restaurante) => void;
  alTocarEjemplo: () => void;
  cargando: boolean;
}) {
  const t = textosInicio(idioma);
  // Tres tarjetas a la vista, como en la pantalla aprobada.
  const ANCHO = Math.floor((useWindowDimensions().width - 32 - 20) / 3);
  // Envío estimado con la tarifa base de EE. UU. Fuera del dólar no se estima (C-MONEDA-RECORRIDO:
  // nunca se muestran cifras en dólares como si fueran pesos); el carrito trae las del país.
  const envioDe = (r: Restaurante) =>
    (r.moneda ?? 'USD') === 'USD'
      ? formatearMonto(calcularEnvio(CONFIG_DINERO_INICIAL, r.distanciaKm ?? null), 'USD', idioma)
      : null;
  const abierto = (r: Restaurante) => r.abiertoAhora ?? r.abierto;
  return (
    <View style={{ marginTop: 20 }} testID="lista-restaurantes">
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginHorizontal: 16,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{t.cerca}</Text>
        {lista.length > 3 ? (
          <Text
            style={{ color: '#5E5E5E', fontWeight: '600' }}
            onPress={() => router.push('/restaurants')}
            accessibilityRole="link"
          >
            {t.verTodos} ›
          </Text>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}
      >
        {lista.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => alTocar(r)}
            accessibilityRole="button"
            accessibilityLabel={r.nombre}
            style={({ pressed }) => [
              tarjeta,
              !abierto(r) && { opacity: 0.6 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View>
              <Image
                source={
                  urlFoto(r.imagen)
                    ? { uri: urlFoto(r.imagen) ?? undefined }
                    : fotoDeRelleno(r.categoria, i)
                }
                style={{
                  width: ANCHO,
                  height: Math.round(ANCHO * 0.72),
                  backgroundColor: '#f1f1f1',
                }}
                accessibilityIgnoresInvertColors
              />
              <Tiempo texto={`${r.tiempoPrepMin + 10}-${r.tiempoPrepMin + 20} ${t.min}`} />
              <Corazon alTocar={alTocarEjemplo} etiqueta={t.nav.favoritos} />
            </View>
            <View style={{ padding: 10 }}>
              <Text
                style={{ fontWeight: '800', fontSize: 15, color: C.secundario }}
                numberOfLines={1}
              >
                {r.nombre}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: abierto(r) ? '#0d7a3a' : '#8a0014',
                    fontWeight: '700',
                  }}
                  numberOfLines={1}
                >
                  {abierto(r)
                    ? t.abierto
                    : r.abierto && r.horarios?.length
                      ? textoApertura(
                          proximaApertura(r.horarios, r.zonaHoraria ?? 'America/New_York'),
                          idioma,
                        )
                      : t.cerrado}
                </Text>
                {envioDe(r) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Image
                      source={IMG.iconoEnvio}
                      style={{ width: 16, height: 13 }}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.secundario }}>
                      {envioDe(r)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: 12, color: '#5E5E5E', marginTop: 2 }} numberOfLines={1}>
                {r.categoria}
              </Text>
            </View>
          </Pressable>
        ))}
        {!cargando && lista.length === 0
          ? t.relleno.restaurantes.map((r, i) => (
              <Pressable
                key={r.nombre}
                onPress={alTocarEjemplo}
                accessibilityRole="button"
                accessibilityLabel={`${t.ejemplo}: ${r.nombre}`}
                style={[tarjeta, { width: ANCHO }]}
              >
                <View>
                  <Image
                    source={IMG.relleno.restaurantes.at(i)}
                    style={{ width: ANCHO, height: Math.round(ANCHO * 0.72) }}
                    accessibilityIgnoresInvertColors
                  />
                  <Tiempo texto={r.tiempo} />
                  <Corazon alTocar={alTocarEjemplo} etiqueta={t.nav.favoritos} />
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(25,25,25,0.75)',
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                      {t.ejemplo}
                    </Text>
                  </View>
                </View>
                <View style={{ padding: 10 }}>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: C.secundario }}>
                    {r.nombre}
                  </Text>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
                  >
                    <Image
                      source={IMG.iconoEnvio}
                      style={{ width: 16, height: 13 }}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.secundario }}>
                      {/* Ejemplo de muestra (Miami): en dólares. */}
                      {formatearMonto(r.envio, 'USD', idioma)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          : null}
      </ScrollView>
    </View>
  );
}
