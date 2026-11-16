import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { enIdioma } from '@tumbite/compartido';
import { ESPACIO, MARGEN, useColores, useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Encabezado } from '../comida/piezas';
import { ConductoresConfianza } from '../viajes/ConductoresConfianza';
import { TEXTOS_FIJOS } from '../viajes/textosFijos';
import { conCuenta } from '../ConCuenta';

/** C-CONDUCTOR-CONFIANZA (16 nov 2026) — todos los países. La pantalla «Conductores de confianza». */
function PantallaConductoresConfianza() {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_FIJOS, idioma);
  const col = useColores();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: col.fondo }} edges={['top', 'left', 'right']}>
      <Encabezado
        titulo={t.conductores}
        alVolver={() => (router.canGoBack() ? router.back() : router.replace('/account'))}
        etiquetaVolver={t.volver}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: MARGEN.pantalla,
          paddingTop: ESPACIO.xl,
          paddingBottom: ESPACIO.xxxl,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
      >
        <ConductoresConfianza alMisViajes={() => router.push('/rides')} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default conCuenta(PantallaConductoresConfianza);
