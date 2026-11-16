import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { enIdioma } from '@tumbite/compartido';
import { ESPACIO, MARGEN, useColores, useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Encabezado } from '../comida/piezas';
import { FormularioViajeFijo } from '../viajes/FormularioViajeFijo';
import { TEXTOS_FIJOS } from '../viajes/textosFijos';
import { conCuenta } from '../ConCuenta';

/** C-VIAJES-FIJOS (16 nov 2026) — todos los países. «Nuevo viaje fijo» y «Editar viaje fijo». */
function PantallaFormularioFijo() {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_FIJOS, idioma);
  const col = useColores();
  const { id, servicio } = useLocalSearchParams<{ id?: string; servicio?: string }>();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/fixed-rides'));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: col.fondo }} edges={['top', 'left', 'right']}>
      <Encabezado titulo={id ? t.editar : t.nuevo} alVolver={volver} etiquetaVolver={t.volver} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingHorizontal: MARGEN.pantalla,
          paddingTop: ESPACIO.xl,
          paddingBottom: ESPACIO.xxxl,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
      >
        <FormularioViajeFijo
          id={id ?? null}
          servicioInicial={servicio}
          alGuardar={() => router.replace('/fixed-rides')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export default conCuenta(PantallaFormularioFijo);
