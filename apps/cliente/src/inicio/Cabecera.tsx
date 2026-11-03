import { Image, Pressable, Text, View } from 'react-native';
import { C, SelectorIdioma } from '@tumbite/movil';
import type { Idioma } from '@tumbite/compartido';
import { IMG } from './recursos';
import { textosInicio } from './textos';

/**
 * POR-1 (2 nov 2026): cabecera del inicio como DoorDash y Uber Eats. A la izquierda «Entregar en»
 * con la dirección actual y su flechita (abre el cambio de dirección); a la derecha la campana real
 * y el selector de idioma estilo Amazon, en chico y sobre fondo blanco.
 */
export function Cabecera({
  idioma,
  cambiarIdioma,
  direccion,
  alDireccion,
  alCampana,
  pendientes = 0,
}: {
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  /** Texto de la dirección de entrega (o «Ubicación actual» / «Elige tu dirección»). */
  direccion: string;
  alDireccion: () => void;
  alCampana: () => void;
  /** Avisos que pasan ahora (pedidos en curso): punto rojo sobre la campana. */
  pendientes?: number;
}) {
  const t = textosInicio(idioma);
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Pressable
        onPress={alDireccion}
        accessibilityRole="button"
        accessibilityLabel={`${t.cambiarDireccion}: ${direccion}`}
        testID="inicio-direccion"
        hitSlop={6}
        style={{ flex: 1 }}
      >
        <Text style={{ fontSize: 12, color: '#666B73', fontWeight: '600' }}>{t.entregarEn}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text
            style={{ fontSize: 16, fontWeight: '700', color: C.secundario, flexShrink: 1 }}
            numberOfLines={1}
          >
            {direccion}
          </Text>
          <Text style={{ fontSize: 12, color: C.secundario }}>▾</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={alCampana}
        accessibilityRole="button"
        accessibilityLabel={pendientes ? `${t.campana} (${pendientes})` : t.campana}
        hitSlop={6}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#F2F3F5',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={IMG.iconoCampana}
          style={{ width: 40, height: 40, borderRadius: 20 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        {pendientes > 0 ? (
          <View
            testID="campana-punto"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              paddingHorizontal: 4,
              backgroundColor: C.primario,
              borderWidth: 2,
              borderColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{pendientes}</Text>
          </View>
        ) : null}
      </Pressable>
      <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} sobreClaro />
    </View>
  );
}
