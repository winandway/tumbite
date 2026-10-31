import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import { enIdioma, enIdiomaDireccion } from '@tumbite/compartido';
import { Boton, C, URL_SERVIDOR, useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Encabezado, Tarjeta } from '../comida/piezas';

/**
 * C-BLOQUE-EN-LA-APP (31 oct 2026, Richard en TestFlight): «Bloque de logística» mandaba directo a
 * la web. Ahora abre esta pantalla dentro de la app: qué es Divoox Flex, cómo funciona en cuatro
 * pasos y el registro de la empresa en la misma app (como Uber Direct o DoorDash Drive para
 * negocios). País: todos.
 */
const T = {
  es: {
    titulo: 'Divoox Flex',
    sub: 'Logística para tu empresa',
    queEs:
      'Repartimos los paquetes de tu negocio por rutas: tú cargas los envíos, nosotros armamos la ruta, un conductor los recoge en tu centro y los entrega con foto, firma o PIN.',
    pasos: [
      ['Registra tu empresa', 'Con tu país, tu moneda y tus centros de carga.'],
      ['Carga tus envíos', 'Uno por uno, desde una hoja de cálculo o por la API.'],
      ['Arma y asigna la ruta', 'Ordenamos las paradas; la asignas a tus conductores o a Divoox.'],
      ['Sigue cada entrega', 'En vivo, con la prueba de entrega de cada paquete.'],
    ],
    paraQuien:
      'Para tiendas en línea, farmacias, distribuidores y cualquier negocio que entrega todos los días.',
    registrar: 'Registrar mi empresa',
    cerrar: 'Volver',
    volver: 'Volver',
  },
  en: {
    titulo: 'Divoox Flex',
    sub: 'Logistics for your business',
    queEs:
      'We deliver your business’s packages in routes: you load the shipments, we build the route, a driver picks them up at your hub and delivers them with a photo, signature or PIN.',
    pasos: [
      ['Register your company', 'With your country, currency and loading hubs.'],
      ['Load your shipments', 'One by one, from a spreadsheet, or through the API.'],
      ['Build and assign the route', 'We order the stops; assign it to your drivers or to Divoox.'],
      ['Follow every delivery', 'Live, with proof of delivery for each package.'],
    ],
    paraQuien:
      'For online stores, pharmacies, distributors and any business that delivers every day.',
    registrar: 'Register my company',
    cerrar: 'Back',
    volver: 'Back',
  },
};

export default function PantallaEmpresas() {
  const { idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [registrando, setRegistrando] = useState(false);
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (registrando)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
        <Encabezado
          titulo={t.titulo}
          alVolver={() => setRegistrando(false)}
          etiquetaVolver={t.cerrar}
        />
        <WebView
          source={{ uri: `${URL_SERVIDOR}${enIdiomaDireccion('/business', idioma)}` }}
          style={{ flex: 1 }}
          testID="empresas-registro"
        />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.fondo }} edges={['top']}>
      <Encabezado titulo={t.titulo} alVolver={volver} etiquetaVolver={t.volver} />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
        testID="empresas"
      >
        <View style={{ backgroundColor: C.logistica, borderRadius: 18, padding: 18, gap: 6 }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>{t.sub}</Text>
          <Text style={{ color: '#E7F1F8', fontSize: 15, lineHeight: 21 }}>{t.queEs}</Text>
        </View>
        <Tarjeta>
          {t.pasos.map(([titulo, ayuda], i) => (
            <View key={titulo} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: C.logisticaAccion,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: C.logisticaTexto, fontWeight: '700' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontWeight: '700', color: C.secundario, fontSize: 16 }}>
                  {titulo}
                </Text>
                <Text style={{ color: '#5E5E5E', lineHeight: 20 }}>{ayuda}</Text>
              </View>
            </View>
          ))}
        </Tarjeta>
        <Text style={{ color: '#5E5E5E', lineHeight: 20 }}>{t.paraQuien}</Text>
        <Boton texto={t.registrar} logistica alTocar={() => setRegistrando(true)} />
      </ScrollView>
    </SafeAreaView>
  );
}
