import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import {
  CONFIG_DINERO_INICIAL,
  type Idioma,
  type Restaurante,
  calcularEnvio,
  formatearMonto,
  textoNoDisponible,
  insigniaPromocion,
} from '@tumbite/compartido';
import { router } from 'expo-router';
import { C, urlFoto } from '@tumbite/movil';
import { IMG, fotoDeRelleno } from './recursos';
import { textosInicio } from './textos';
import { distanciaTexto } from '../textos';
import { Calificacion } from '../comida/Calificacion';

/** Ancho máximo de la portada en pantallas grandes (tableta, web): como la lista de Comida. */
const ANCHO_PORTADA = 640;

export type Favoritos = { ids: Set<string>; alternar: (id: string) => void };

const abierto = (r: Restaurante) => r.abiertoAhora ?? r.abierto;

/**
 * Envío estimado con la tarifa base de EE. UU. Fuera del dólar no se estima (C-MONEDA-RECORRIDO:
 * nunca se muestran cifras en dólares como si fueran pesos); el carrito trae las del país.
 */
const envioDe = (r: Restaurante, idioma: Idioma) =>
  (r.moneda ?? 'USD') === 'USD'
    ? formatearMonto(calcularEnvio(CONFIG_DINERO_INICIAL, r.distanciaKm ?? null), 'USD', idioma)
    : null;

/**
 * POR-1 (2 nov 2026): la tarjeta de restaurante de la portada, como DoorDash y Uber Eats: foto
 * grande, corazón real (Favoritos), nombre, nota o «Nuevo», categoría, distancia, tiempo y envío.
 * La misma pieza sirve para la fila deslizable y para la lista vertical.
 */
function TarjetaRestaurante({
  r,
  i,
  ancho,
  idioma,
  favoritos,
  alTocar,
}: {
  r: Restaurante;
  i: number;
  ancho: number;
  idioma: Idioma;
  favoritos: Favoritos;
  alTocar: (r: Restaurante) => void;
}) {
  const t = textosInicio(idioma);
  const fav = favoritos.ids.has(r.id);
  const envio = envioDe(r, idioma);
  const detalle = [
    r.categoria,
    r.distanciaKm != null ? distanciaTexto(r.distanciaKm, idioma, r.pais) : null,
    `${r.tiempoPrepMin + 10}-${r.tiempoPrepMin + 20} ${t.min}`,
  ].filter(Boolean);
  return (
    <Pressable
      onPress={() => alTocar(r)}
      accessibilityRole="button"
      accessibilityLabel={r.nombre}
      style={({ pressed }) => ({
        width: ancho,
        opacity: !abierto(r) ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      <View>
        <Image
          source={
            urlFoto(r.imagen)
              ? { uri: urlFoto(r.imagen) ?? undefined }
              : fotoDeRelleno(r.categoria, i)
          }
          style={{
            width: ancho,
            height: Math.round(ancho * 0.5),
            borderRadius: 14,
            backgroundColor: '#F2F3F5',
          }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <Pressable
          onPress={() => favoritos.alternar(r.id)}
          accessibilityRole="button"
          accessibilityLabel={`${fav ? t.quitarFavorito : t.guardarFavorito}: ${r.nombre}`}
          accessibilityState={{ selected: fav }}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={IMG.iconoCorazon}
            style={{ width: 17, height: 17, tintColor: fav ? C.primario : '#101010' }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Pressable>
        {r.promocion ? (
          // C-PROMO-RESTAURANTE: la insignia de la promoción que paga el restaurante, en verde.
          <View
            style={{
              position: 'absolute',
              left: 10,
              top: 10,
              backgroundColor: C.exito,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text testID="promocion" style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>
              {insigniaPromocion(r.promocion, r.moneda ?? 'USD', idioma)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 8, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{ fontWeight: '700', fontSize: 16, color: C.secundario, flex: 1 }}
            numberOfLines={1}
          >
            {r.nombre}
          </Text>
          <Calificacion c={r.calificacion} idioma={idioma} />
        </View>
        <Text style={{ fontSize: 13, color: '#666B73' }} numberOfLines={1}>
          {detalle.join(' · ')}
        </Text>
        <Text style={{ fontSize: 13, color: '#666B73' }} numberOfLines={1}>
          {abierto(r) ? (
            envio ? (
              t.envioDe.replace('{monto}', envio)
            ) : (
              <Text style={{ color: C.exito, fontWeight: '700' }}>{t.abierto}</Text>
            )
          ) : (
            <Text style={{ color: '#8a0014', fontWeight: '700' }}>
              {textoNoDisponible(r, idioma) ?? t.cerrado}
            </Text>
          )}
        </Text>
        {r.patrocinado ? (
          // C-ANUNCIOS: como «Sponsored» de DoorDash, discreto y debajo del nombre.
          <Text testID="patrocinado" style={{ fontSize: 11, color: '#666B73' }}>
            {idioma === 'en' ? 'Sponsored' : 'Patrocinado'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const Titulo = ({ texto, verTodos }: { texto: string; verTodos?: string }) => (
  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginHorizontal: 16,
    }}
  >
    <Text style={{ fontSize: 20, fontWeight: '700', color: C.secundario }}>{texto}</Text>
    {verTodos ? (
      <Text
        style={{ color: '#666B73', fontWeight: '600' }}
        onPress={() => router.push('/restaurants')}
        accessibilityRole="link"
      >
        {verTodos} ›
      </Text>
    ) : null}
  </View>
);

/**
 * Fila que se desliza a lo ancho con tarjetas anchas («Más rápidos cerca de ti», «Te puede
 * gustar»), como los carruseles de DoorDash y Uber Eats: se ve una tarjeta y el borde de la otra.
 */
export function FilaRestaurantes({
  idioma,
  lista,
  titulo,
  testID,
  favoritos,
  alTocar,
}: {
  idioma: Idioma;
  lista: Restaurante[];
  titulo: string;
  testID: string;
  favoritos: Favoritos;
  alTocar: (r: Restaurante) => void;
}) {
  const t = textosInicio(idioma);
  const ancho = Math.round((Math.min(useWindowDimensions().width, ANCHO_PORTADA) - 32) * 0.78);
  if (!lista.length) return null;
  return (
    <View style={{ marginTop: 20 }} testID={testID}>
      <Titulo texto={titulo} verTodos={lista.length > 3 ? t.verTodos : undefined} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ancho + 14}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, gap: 14 }}
      >
        {lista.map((r, i) => (
          <TarjetaRestaurante
            key={r.id}
            r={r}
            i={i}
            ancho={ancho}
            idioma={idioma}
            favoritos={favoritos}
            alTocar={alTocar}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * «Todos los restaurantes»: lista VERTICAL con foto grande, como el final de la portada de
 * DoorDash y Uber Eats. Va dentro del scroll único del inicio; se muestran por tandas y la
 * siguiente tanda sale sola al llegar abajo (o con «Ver más restaurantes»).
 */
export function ListaRestaurantes({
  idioma,
  lista,
  cuantos,
  verMas,
  cargando,
  favoritos,
  alTocar,
  vacio,
}: {
  idioma: Idioma;
  lista: Restaurante[];
  cuantos: number;
  verMas: () => void;
  cargando: boolean;
  favoritos: Favoritos;
  alTocar: (r: Restaurante) => void;
  /** Texto cuando los filtros dejan la lista vacía (sin filtros, lo dice EstadoCatalogo). */
  vacio?: string;
}) {
  const t = textosInicio(idioma);
  const ancho = Math.min(useWindowDimensions().width, ANCHO_PORTADA) - 32;
  const vistos = lista.slice(0, cuantos);
  return (
    <View style={{ marginTop: 22 }} testID="lista-restaurantes">
      <Titulo texto={t.todos} />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 22 }}>
        {vistos.map((r, i) => (
          <TarjetaRestaurante
            key={r.id}
            r={r}
            i={i}
            ancho={ancho}
            idioma={idioma}
            favoritos={favoritos}
            alTocar={alTocar}
          />
        ))}
        {!cargando && !lista.length && vacio ? (
          <Text style={{ color: '#666B73' }}>{vacio}</Text>
        ) : null}
        {lista.length > cuantos ? (
          <Pressable
            onPress={verMas}
            accessibilityRole="button"
            style={{
              alignItems: 'center',
              paddingVertical: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#E3E5E8',
              backgroundColor: '#fff',
            }}
          >
            <Text style={{ fontWeight: '700', color: C.secundario }}>{t.verMas}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
