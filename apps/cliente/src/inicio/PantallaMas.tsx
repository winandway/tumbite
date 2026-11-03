import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  type Idioma,
  ORDEN_SERVICIOS,
  type ServicioCatalogo,
  serviciosTerminados,
} from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { ANCHO_MAX } from '../comida/piezas';
import { ICONO_SERVICIO, IMG } from './recursos';
import type { Servicio } from './Servicios';
import { textosInicio } from './textos';

/**
 * C-SOLO-LO-TERMINADO (3 nov 2026, Richard): «Más» es la puerta a todos los servicios, como la
 * pestaña «Services» de Uber y «Todos los servicios» de Grab (estudio REA del 3 nov): arriba el logo
 * y una bienvenida corta, y enseguida los servicios en una cuadrícula pareja de dos en dos, cada uno con su
 * dibujo, su nombre en una sola línea y una frase. Solo sale lo que ya se puede usar (nada de
 * «Pronto»); cada cuadro abre la pantalla de su servicio.
 */
export function PantallaMas({
  idioma,
  servicios,
}: {
  idioma: Idioma;
  servicios: ServicioCatalogo[];
}) {
  const t = textosInicio(idioma);
  const listos = serviciosTerminados(servicios);
  const nombre = (s: ServicioCatalogo) =>
    (ORDEN_SERVICIOS as readonly string[]).includes(s.id)
      ? t.servicios[s.id as Servicio]
      : s.nombre;
  const abrir = (s: ServicioCatalogo) =>
    s.id === 'comida'
      ? router.push('/restaurants')
      : router.push({ pathname: '/service/[id]', params: { id: s.id } });
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 32,
        width: '100%',
        maxWidth: ANCHO_MAX,
        alignSelf: 'center',
      }}
      testID="pantalla-mas"
    >
      <View style={{ marginBottom: 18 }}>
        <Image
          source={IMG.logo}
          style={{ width: 120, height: 30 }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Divoox"
        />
        <Text
          accessibilityRole="header"
          style={{ fontSize: 24, fontWeight: '700', color: C.secundario, marginTop: 12 }}
        >
          {t.masBienvenida}
        </Text>
        <Text style={{ fontSize: 15, color: '#666B73', marginTop: 4 }}>{t.masAyuda}</Text>
      </View>
      {/* Una sola cuadrícula pareja, dos por fila: un servicio solo nunca se estira. */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: 12,
        }}
      >
        {listos.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={nombre(s)}
            testID={`explorar-${s.id}`}
            onPress={() => abrir(s)}
            style={({ pressed }) => ({
              width: '48%',
              minHeight: 140,
              padding: 14,
              borderRadius: 16,
              backgroundColor: '#F6F7F9',
              borderWidth: 1,
              borderColor: '#ECEDEF',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Image
              source={ICONO_SERVICIO.get(s.id as Servicio) ?? IMG.servicios.mas}
              style={{ width: 72, height: 72, alignSelf: 'flex-end' }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={1.3}
              style={{ fontSize: 18, fontWeight: '700', color: C.secundario, marginTop: 8 }}
            >
              {nombre(s)}
            </Text>
            {t.lemaServicio[s.id] ? (
              <Text numberOfLines={2} style={{ fontSize: 13, color: '#666B73', marginTop: 2 }}>
                {t.lemaServicio[s.id]}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
