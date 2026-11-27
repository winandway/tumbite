import type { ReactNode } from 'react';
import { Image, Pressable, View, type ViewStyle } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { BarraPestanas, C, COLOR, SelectorIdioma, Text } from '@tumbite/movil';
import { IMG, type Pestana } from './recursos';
import { textosRest } from './textos';

export const sombra: ViewStyle = {
  shadowColor: '#101010',
  shadowOpacity: 0.08,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
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
        {
          backgroundColor: '#fff',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLOR.borde,
          padding: 16,
          marginBottom: 12,
        },
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
  testID,
}: {
  texto: string;
  alTocar: () => void;
  tipo?: 'rojo' | 'verde' | 'claro' | 'borde';
  etiqueta?: string;
  desactivado?: boolean;
  flex?: number;
  testID?: string;
}) {
  const fondo = desactivado
    ? '#CCCCCC'
    : tipo === 'rojo'
      ? C.primario
      : tipo === 'verde'
        ? C.exito
        : tipo === 'borde'
          ? '#FFF4F1'
          : '#F6F6F6';
  const color = tipo === 'claro' ? C.secundario : tipo === 'borde' ? C.primario : '#fff';
  return (
    <Pressable
      testID={testID}
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
        // Fase cero: esquina 12, como todos los botones de las tres apps.
        borderRadius: 12,
        minHeight: 56,
        paddingVertical: 16,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color, fontWeight: '700', fontSize: 18 }}>{texto}</Text>
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
        minHeight: 40,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: activa ? (verde ? C.exito : COLOR.negro) : '#D6D8DC',
        backgroundColor: activa ? (verde ? C.exito : COLOR.negro) : '#fff',
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
        backgroundColor: bien ? '#E8F5EE' : mal ? '#FDECEC' : nuevo ? '#FFF4F1' : '#F6F6F6',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text
        style={{
          color: bien ? C.exito : mal ? '#B3261E' : nuevo ? C.primario : '#666B73',
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
        borderBottomColor: '#E6E7EA',
      }}
    >
      <View style={{ alignItems: 'flex-start' }}>
        <Image
          source={IMG.logo}
          style={{ width: 132, height: 40 }}
          resizeMode="contain"
          accessibilityLabel="Divoox"
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
      {/* El selector va en una píldora negra: el negro de Restaurants vive solo en su cabecera. */}
      <View style={{ backgroundColor: COLOR.negro, borderRadius: 999, paddingHorizontal: 4 }}>
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
        borderBottomColor: '#E6E7EA',
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
                backgroundColor: i <= paso ? C.exito : '#E6E7EA',
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
              backgroundColor: i <= paso ? C.exito : '#E6E7EA',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>{i <= paso ? '✓' : ''}</Text>
          </View>
          <Text
            style={{
              fontSize: 12,
              marginTop: 4,
              textAlign: 'center',
              color: i === paso ? C.secundario : '#666B73',
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

/**
 * Barra de abajo: Inicio, Pedidos, Menú, Estadísticas y Más. C-APPS-DISENO (15 nov 2026): íconos de
 * línea (rellenos al elegirse) en el negro de Restaurants y el número de pedidos nuevos en rojo.
 */
export function BarraInferior({
  idioma,
  activa,
  alTocar,
  aviso = 0,
  etiquetaMenu,
}: {
  idioma: Idioma;
  activa: Pestana;
  alTocar: (p: Pestana) => void;
  aviso?: number;
  /** C-MERCHANT-PALABRAS: «Catálogo» en una tienda; sin ella, «Menú». */
  etiquetaMenu?: string;
}) {
  const t = textosRest(idioma);
  const nav = etiquetaMenu ? { ...t.nav, menu: etiquetaMenu } : t.nav;
  const nombre = (p: Pestana) => new Map(Object.entries(nav) as [Pestana, string][]).get(p) ?? p;
  return (
    <BarraPestanas
      activa={activa}
      alTocar={(p) => alTocar(p as Pestana)}
      pestanas={[
        {
          clave: 'inicio',
          texto: nombre('inicio'),
          icono: 'home-outline',
          iconoActivo: 'home',
          insignia: aviso,
        },
        {
          clave: 'pedidos',
          texto: nombre('pedidos'),
          icono: 'receipt-outline',
          iconoActivo: 'receipt',
        },
        {
          clave: 'menu',
          texto: nombre('menu'),
          icono: 'restaurant-outline',
          iconoActivo: 'restaurant',
        },
        {
          clave: 'estadisticas',
          texto: nombre('estadisticas'),
          icono: 'stats-chart-outline',
          iconoActivo: 'stats-chart',
        },
        { clave: 'mas', texto: nombre('mas'), icono: 'menu-outline', iconoActivo: 'menu' },
      ]}
    />
  );
}
