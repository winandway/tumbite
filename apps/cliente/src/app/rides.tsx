import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { enIdioma } from '@tumbite/compartido';
import { ESPACIO, LETRA, MARGEN, Pildora, Text, useColores, useSesion } from '@tumbite/movil';
import { ANCHO_MAX } from '../comida/piezas';
import { BarraInferior, type Pestana } from '../inicio/BarraInferior';
import { MisViajes } from '../viajes/MisViajes';
import { TEXTOS_MIS_VIAJES } from '../viajes/textos';
import { conCuenta } from '../ConCuenta';

/**
 * C-MISMA-RUTA (15 nov 2026) — todos los países. La pantalla «Mis viajes» (pantalla 7 del sistema de
 * diseño), dentro de la pestaña Pedidos: chips Viajes, Comida y Tiendas (Comida y Tiendas llevan a
 * «Mis pedidos», donde viven los pedidos de restaurantes y tiendas), los viajes agrupados por mes y
 * «Pedir la misma ruta». Al pedir, cae en la pantalla de espera de siempre (/ride).
 */
function PantallaMisViajes() {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_MIS_VIAJES, idioma);
  const col = useColores();
  const pestana = (p: Pestana) => {
    if (p === 'inicio') return router.replace('/');
    if (p === 'pedidos') return router.replace('/orders');
    if (p === 'favoritos') return router.push('/favorites');
    if (p === 'cuenta') return router.push('/account');
  };
  const aViaje = (servicio: string) => router.push({ pathname: '/ride', params: { servicio } });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: col.fondo }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: MARGEN.pantalla,
          paddingTop: ESPACIO.xxl,
          paddingBottom: ESPACIO.xxxl,
          gap: ESPACIO.l,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
      >
        <Text style={[LETRA.titular, { color: col.texto }]} accessibilityRole="header">
          {t.titulo}
        </Text>
        <View style={{ flexDirection: 'row', gap: ESPACIO.s, flexWrap: 'wrap' }}>
          <Pildora texto={t.chipViajes} activa alTocar={() => undefined} testID="chip-viajes" />
          <Pildora
            texto={t.chipComida}
            alTocar={() => router.replace('/orders')}
            testID="chip-comida"
          />
          <Pildora
            texto={t.chipTiendas}
            alTocar={() => router.replace('/orders')}
            testID="chip-tiendas"
          />
        </View>
        <MisViajes
          conTitulo={false}
          alPedir={(_id, servicio) => aViaje(servicio)}
          alCambiar={aViaje}
        />
      </ScrollView>
      <BarraInferior idioma={idioma} activa="pedidos" alTocar={pestana} />
    </SafeAreaView>
  );
}

export default conCuenta(PantallaMisViajes);
