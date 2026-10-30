import type { ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { C } from '@tumbite/movil';

/** Ancho máximo del contenido: en tableta la columna queda centrada y legible. */
export const ANCHO_MAX = 640;

export const sombra: ViewStyle = {
  shadowColor: '#101010',
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

/** Tarjeta blanca redondeada, sin franjas de color (regla de diseño). */
export function Tarjeta({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12 },
        sombra,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Flecha de volver en un círculo (sobre foto) o suelta (sobre blanco). */
export function Flecha({
  alTocar,
  etiqueta,
  sobreFoto = false,
}: {
  alTocar: () => void;
  etiqueta: string;
  sobreFoto?: boolean;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: sobreFoto ? 'rgba(25,25,25,0.55)' : 'transparent',
      }}
    >
      <Text style={{ fontSize: 26, lineHeight: 28, color: sobreFoto ? '#fff' : C.secundario }}>
        ‹
      </Text>
    </Pressable>
  );
}

/** Encabezado blanco: flecha, título al centro y algo opcional a la derecha. */
export function Encabezado({
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
        paddingVertical: 6,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
      }}
    >
      <Flecha alTocar={alVolver} etiqueta={etiquetaVolver} />
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

/** Botón en forma de píldora: rojo de la marca si está activo, blanco con borde si no. */
export function Pildora({
  texto,
  activa,
  alTocar,
  etiqueta,
  rol = 'button',
}: {
  texto: string;
  activa: boolean;
  alTocar: () => void;
  etiqueta?: string;
  rol?: 'button' | 'radio' | 'tab' | 'checkbox';
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole={rol}
      accessibilityLabel={etiqueta ?? texto}
      accessibilityState={
        rol === 'button' ? { selected: activa } : { selected: activa, checked: activa }
      }
      style={{
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: activa ? C.primario : '#F2F3F5',
      }}
    >
      <Text style={{ color: activa ? '#fff' : C.secundario, fontWeight: '700', fontSize: 14 }}>
        {texto}
      </Text>
    </Pressable>
  );
}

/** Botón redondo «+» / «−» para cantidades y agregar platos. */
export function BotonRedondo({
  texto,
  alTocar,
  etiqueta,
  lleno = true,
  desactivado = false,
  color,
}: {
  texto: string;
  alTocar: () => void;
  etiqueta: string;
  lleno?: boolean;
  desactivado?: boolean;
  color?: string;
}) {
  const fondo = desactivado ? '#CCCCCC' : (color ?? C.primario);
  return (
    <Pressable
      onPress={alTocar}
      disabled={desactivado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: desactivado }}
      hitSlop={6}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: lleno ? fondo : '#fff',
        borderWidth: lleno ? 0 : 1,
        borderColor: '#D6D6D6',
      }}
    >
      <Text
        style={{
          color: lleno ? '#fff' : C.secundario,
          fontSize: 20,
          lineHeight: 22,
          fontWeight: '700',
        }}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

/** Botón ancho de acción principal (rojo) o secundario (gris claro). */
export function BotonAncho({
  texto,
  alTocar,
  secundario = false,
  etiqueta,
  desactivado = false,
}: {
  texto: string;
  alTocar: () => void;
  secundario?: boolean;
  etiqueta?: string;
  desactivado?: boolean;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={desactivado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? texto}
      accessibilityState={{ disabled: desactivado }}
      style={({ pressed }) => ({
        backgroundColor: desactivado ? '#CCCCCC' : secundario ? '#F2F3F5' : C.primario,
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: secundario ? C.secundario : '#fff', fontWeight: '800', fontSize: 16 }}>
        {texto}
      </Text>
    </Pressable>
  );
}

/** Etiqueta verde «Abierto» (o gris «Cerrado»). */
export function Estado({ abierto, texto }: { abierto: boolean; texto: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: abierto ? '#E8F5EE' : '#F2F3F5',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: abierto ? C.exito : '#5E5E5E', fontWeight: '700', fontSize: 12 }}>
        {texto}
      </Text>
    </View>
  );
}
