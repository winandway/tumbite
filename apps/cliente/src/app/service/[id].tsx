import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  type RespuestaServicios,
  type ServicioCatalogo,
  ORDEN_SERVICIOS,
} from '@tumbite/compartido';
import { Boton, C, useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Encabezado, Tarjeta } from '../../comida/piezas';
import { textosComida } from '../../comida/textos';
import { ICONO_SERVICIO, IMG, type Servicio } from '../../inicio/recursosServicio';
import { textosInicio } from '../../inicio/textos';
import { FranjaEstado } from '../../inicio/FranjaEstado';

/**
 * Pantalla de un servicio (Moto, Carro, Envíos, Mercado, Farmacia, Licores, Más… y Comida si no
 * está disponible). Como en los grandes: cada servicio tiene su pantalla; si todavía no está
 * listo, una FRANJA discreta lo dice («Estamos construyendo este servicio»), no una ventana que
 * haya que cerrar. Lo que se muestra abajo es lo que va a poder hacer, marcado «Ejemplo».
 */
export default function PantallaServicio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, idioma } = useSesion();
  const t = textosInicio(idioma);
  const tc = textosComida(idioma);
  const [s, setS] = useState<ServicioCatalogo | null>(null);
  useEffect(() => {
    let vivo = true;
    void api
      .pedir<RespuestaServicios>('GET', '/datos/servicios')
      .then((r) => {
        if (vivo) setS(r.servicios.find((x) => x.id === id) ?? null);
      })
      .catch((e: unknown) => console.warn('servicio: no se pudo cargar', e));
    return () => {
      vivo = false;
    };
  }, [api, id]);
  const conocido = (ORDEN_SERVICIOS as readonly string[]).includes(id ?? '');
  const nombre = (conocido && t.servicios[id as Servicio]) || s?.nombre || '';
  const accion = s?.accion ?? 'muy_pronto';
  const abrir = () => router.push('/restaurants');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <Encabezado
        titulo={nombre}
        alVolver={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        etiquetaVolver={tc.volver}
      />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
      >
        <FranjaEstado
          texto={new Map(Object.entries(t.franja)).get(accion) ?? t.franja.muy_pronto ?? ''}
          enProceso={accion !== 'abrir'}
        />
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <Image
            source={ICONO_SERVICIO.get(id as Servicio) ?? IMG.servicios.mas}
            style={{ width: 140, height: 140 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text
            accessibilityRole="header"
            style={{ fontSize: 26, fontWeight: '900', color: C.secundario, marginTop: 8 }}
          >
            {nombre}
          </Text>
          {s?.descripcion ? (
            <Text style={{ color: '#5E5E5E', fontSize: 15, textAlign: 'center', marginTop: 6 }}>
              {s.descripcion}
            </Text>
          ) : null}
        </View>
        {accion === 'abrir' && id === 'comida' ? (
          <View style={{ marginTop: 18 }}>
            <Boton texto={t.abrirServicio} alTocar={abrir} />
          </View>
        ) : null}
        <Tarjeta style={{ marginTop: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>
              {t.loQueViene}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#8A8A8A' }}>{t.ejemplo}</Text>
          </View>
          {(
            new Map(Object.entries(t.detalleServicio)).get(id ?? '') ??
            t.detalleServicio.mas ??
            []
          ).map((linea) => (
            <Text key={linea} style={{ color: '#3A3A3A', fontSize: 15, marginTop: 8 }}>
              · {linea}
            </Text>
          ))}
        </Tarjeta>
      </ScrollView>
    </SafeAreaView>
  );
}
