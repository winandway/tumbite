import type { ReactNode } from 'react';
import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { C, SelectorIdioma } from '@tumbite/movil';
import { ICONO_PESTANA, IMG, type Pestana } from './recursos';
import { textosRest } from './textos';

export const sombra: ViewStyle = {
  shadowColor: '#191919',
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

/** Tarjeta blanca redondeada, sin franjas de color (regla de diseño). */
export function Tarjeta({
  children,
  style,
  etiqueta,
}: {
  children: ReactNode;
  style?: ViewStyle | (ViewStyle | false | null | undefined)[];
  etiqueta?: string;
}) {
  return (
    <View
      accessibilityLabel={etiqueta}
      style={[
        { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12 },
        sombra,
        ...(Array.isArray(style) ? style : [style]),
      ]}
    >
      {children}
    </View>
  );
}

/** Botón grande, cómodo para tocar en la cocina: rojo (acción), verde (éxito) o claro. */
export function BotonGrande({
  texto,
  alTocar,
  tipo = 'rojo',
  etiqueta,
  desactivado = false,
  flex,
}: {
  texto: string;
  alTocar: () => void;
  tipo?: 'rojo' | 'verde' | 'claro' | 'borde';
  etiqueta?: string;
  desactivado?: boolean;
  flex?: number;
}) {
  const fondo = desactivado
    ? '#CCCCCC'
    : tipo === 'rojo'
      ? C.primario
      : tipo === 'verde'
        ? C.exito
        : tipo === 'borde'
          ? '#FFF4F1'
          : '#F2F3F5';
  const color = tipo === 'claro' ? C.secundario : tipo === 'borde' ? C.primario : '#fff';
  return (
    <Pressable
      onPress={alTocar}
      disabled={desactivado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? texto}
      accessibilityState={{ disabled: desactivado }}
      style={({ pressed }) => ({
        flex,
        backgroundColor: fondo,
        borderWidth: tipo === 'borde' ? 1.5 : 0,
        borderColor: C.primario,
        borderRadius: 14,
        paddingVertical: 17,
        paddingHorizontal: 12,
        alignItems: 'center',
        marginTop: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color, fontWeight: '800', fontSize: 17 }}>{texto}</Text>
    </Pressable>
  );
}

/** Botón en píldora: activo en rojo de la marca (o en verde si es la elección que salió bien). */
export function Pildora({
  texto,
  activa,
  alTocar,
  etiqueta,
  verde = false,
}: {
  texto: string;
  activa: boolean;
  alTocar: () => void;
  etiqueta?: string;
  verde?: boolean;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? texto}
      accessibilityState={{ selected: activa }}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: activa ? (verde ? C.exito : C.primario) : '#DADADA',
        backgroundColor: activa ? (verde ? C.exito : C.primario) : '#fff',
      }}
    >
      <Text style={{ color: activa ? '#fff' : C.secundario, fontWeight: '700', fontSize: 15 }}>
        {texto}
      </Text>
    </Pressable>
  );
}

/** Insignia de estado: verde lo que salió bien, rojo solo lo cancelado, gris lo que está en curso. */
export function Insignia({ estado, texto }: { estado: string; texto: string }) {
  const bien = ['listo', 'entregado', 'activo'].includes(estado);
  const mal = ['cancelado', 'agotado'].includes(estado);
  const nuevo = estado === 'pagado';
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bien ? '#E8F5EE' : mal ? '#FDECEC' : nuevo ? '#FFF4F1' : '#F2F3F5',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          color: bien ? C.exito : mal ? '#B3261E' : nuevo ? C.primario : '#5E5E5E',
          fontWeight: '700',
          fontSize: 12,
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

/** Cabecera blanca: logotipo con «Restaurante» y el selector de idioma estilo Amazon. */
export function Cabecera({
  idioma,
  cambiarIdioma,
}: {
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
}) {
  const t = textosRest(idioma);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
      }}
    >
      <View style={{ alignItems: 'flex-start' }}>
        <Image
          source={IMG.logo}
          style={{ width: 132, height: 40 }}
          resizeMode="contain"
          accessibilityLabel="Tumbite"
        />
        <Text
          style={{
            fontWeight: '800',
            fontSize: 13,
            color: C.secundario,
            marginTop: -4,
            marginLeft: 46,
          }}
        >
          {t.restaurante}
        </Text>
      </View>
      {/* El selector va sobre fondo oscuro, como en la cabecera roja de siempre. */}
      <View style={{ backgroundColor: C.primario, borderRadius: 999, paddingHorizontal: 4 }}>
        <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} />
      </View>
    </View>
  );
}

/** Cabecera de una pantalla interna: flecha, título y algo opcional a la derecha. */
export function CabeceraInterna({
  titulo,
  alVolver,
  etiquetaVolver,
  derecha,
}: {
  titulo: string;
  alVolver: () => void;
  etiquetaVolver: string;
  derecha?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
      }}
    >
      <Pressable
        onPress={alVolver}
        accessibilityRole="button"
        accessibilityLabel={etiquetaVolver}
        hitSlop={8}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 28, lineHeight: 30, color: C.secundario }}>‹</Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: '800',
          color: C.secundario,
        }}
      >
        {titulo}
      </Text>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{derecha}</View>
    </View>
  );
}

/** Pasos del pedido: lo que ya pasó, en verde; lo que falta, en gris. */
export function Pasos({ nombres, paso }: { nombres: string[]; paso: number }) {
  return (
    <View style={{ flexDirection: 'row', marginVertical: 12 }} accessibilityRole="progressbar">
      {nombres.map((nombre, i) => (
        <View key={nombre} style={{ flex: 1, alignItems: 'center' }}>
          {i > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: 15,
                right: '50%',
                width: '100%',
                height: 3,
                backgroundColor: i <= paso ? C.exito : '#E5E5E5',
              }}
            />
          ) : null}
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: i <= paso ? C.exito : '#E5E5E5',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>{i <= paso ? '✓' : ''}</Text>
          </View>
          <Text
            style={{
              fontSize: 12,
              marginTop: 4,
              textAlign: 'center',
              color: i === paso ? C.secundario : '#5E5E5E',
              fontWeight: i === paso ? '800' : '500',
            }}
          >
            {nombre}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Barra de abajo: Inicio, Pedidos, Menú, Estadísticas y Más. */
export function BarraInferior({
  idioma,
  activa,
  alTocar,
  aviso = 0,
}: {
  idioma: Idioma;
  activa: Pestana;
  alTocar: (p: Pestana) => void;
  aviso?: number;
}) {
  const t = textosRest(idioma);
  const nombres = new Map(Object.entries(t.nav) as [Pestana, string][]);
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: '#fff',
          paddingTop: 8,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: '#EFEFEF',
        },
      ]}
      accessibilityRole="tablist"
    >
      {(['inicio', 'pedidos', 'menu', 'estadisticas', 'mas'] as const).map((p) => {
        const on = p === activa;
        return (
          <Pressable
            key={p}
            onPress={() => alTocar(p)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={nombres.get(p)}
            style={{ flex: 1, alignItems: 'center', gap: 3 }}
          >
            <View>
              <Image
                source={ICONO_PESTANA.get(p) ?? IMG.logo}
                style={{ width: 24, height: 24, tintColor: on ? C.primario : '#6B6B6B' }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              {p === 'inicio' && aviso > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -10,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: C.primario,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{aviso}</Text>
                </View>
              ) : null}
            </View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: on ? '800' : '500',
                color: on ? C.primario : '#6B6B6B',
              }}
            >
              {nombres.get(p)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
