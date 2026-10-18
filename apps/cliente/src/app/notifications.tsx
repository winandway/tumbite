import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MARCA } from '@tumbite/compartido';
import { C, useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Encabezado, Pildora, Tarjeta } from '../comida/piezas';
import { textosComida } from '../comida/textos';
import { useRestaurantes } from '../comida/useRestaurantes';
import { type Aviso, useAvisos } from '../inicio/useAvisos';
import { textosInicio } from '../inicio/textos';
import { Pressable } from 'react-native';

/**
 * La campana (como en los grandes): una lista de avisos reales, sin tabla nueva. Pedidos en
 * curso (tocar abre el seguimiento), regalos en marcha (pestaña «Regalos», la que abre el cupón) y
 * próximas aperturas en la ciudad. Nada inventado: si no hay nada, se dice.
 */
export default function Avisos() {
  const { api, idioma } = useSesion();
  const t = textosInicio(idioma);
  const tc = textosComida(idioma);
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [pestana, setPestana] = useState<'todos' | 'regalos'>(
    tab === 'regalos' ? 'regalos' : 'todos',
  );
  const catalogo = useRestaurantes(api, null);
  const { datos } = useAvisos(api, catalogo.punto);
  const lista = (datos?.avisos ?? []).filter((a) => pestana === 'todos' || a.tipo === 'regalo');
  const llenar = (s: string, v: Record<string, string | number>) =>
    Object.entries(v).reduce((acc, [k, x]) => acc.replaceAll(`{${k}}`, String(x)), s);

  const tarjeta = (a: Aviso, i: number) => {
    if (a.tipo === 'pedido')
      return (
        <Pressable
          key={`p-${a.pedidoId}`}
          onPress={() => router.push(`/order/${a.pedidoId}`)}
          accessibilityRole="button"
          accessibilityLabel={llenar(t.avisoPedido, { restaurante: a.restauranteNombre })}
        >
          <Tarjeta>
            <Titulo texto={llenar(t.avisoPedido, { restaurante: a.restauranteNombre })} punto />
            <Texto texto={t.estadoPedido[a.estado] ?? a.estado} />
          </Tarjeta>
        </Pressable>
      );
    if (a.tipo === 'regalo') {
      const completa = a.progreso >= a.meta;
      return (
        <Pressable
          key={`r-${a.restauranteId}-${a.regalo}`}
          onPress={() => router.push(`/restaurant/${a.restauranteId}`)}
          accessibilityRole="button"
          accessibilityLabel={a.restauranteNombre}
        >
          <Tarjeta>
            <Titulo
              texto={llenar(a.regalo === 'sellos' ? t.avisoSellos : t.avisoVuelve, {
                restaurante: a.restauranteNombre,
              })}
            />
            {a.regalo === 'sellos' ? (
              <>
                <Texto
                  texto={
                    completa
                      ? t.sellosListo
                      : llenar(t.sellosProgreso, { n: a.progreso, meta: a.meta })
                  }
                />
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#E9ECF1',
                    marginTop: 10,
                    overflow: 'hidden',
                  }}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: a.meta, now: a.progreso }}
                >
                  {/* Lo cumplido va en verde (regla: lo que salió bien, en verde). */}
                  <View
                    style={{
                      width: `${Math.round((a.progreso / a.meta) * 100)}%`,
                      height: 6,
                      backgroundColor: MARCA.colores.exito,
                    }}
                  />
                </View>
              </>
            ) : (
              <Texto texto={llenar(t.vuelveTexto, { pct: Math.round((a.pb ?? 0) / 100) })} />
            )}
          </Tarjeta>
        </Pressable>
      );
    }
    return (
      <Tarjeta key={`a-${i}`}>
        <Titulo texto={llenar(t.avisoApertura, { area: a.area })} />
        <Texto
          texto={llenar(t.aperturaTexto, {
            area: a.area,
            ciudad: a.ciudad,
            fecha: a.apertura ? llenar(t.aperturaFecha, { fecha: a.apertura }) : '',
          })}
        />
      </Tarjeta>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <Encabezado
        titulo={pestana === 'regalos' ? t.tusRegalos : t.avisosTitulo}
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
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <Pildora
            texto={t.pestanaTodos}
            activa={pestana === 'todos'}
            alTocar={() => setPestana('todos')}
            rol="tab"
          />
          <Pildora
            texto={t.pestanaRegalos}
            activa={pestana === 'regalos'}
            alTocar={() => setPestana('regalos')}
            rol="tab"
          />
        </View>
        {datos && !lista.length ? (
          <Text style={{ color: '#5E5E5E', fontSize: 15 }} testID="avisos-vacio">
            {pestana === 'regalos' ? t.sinRegalos : t.sinAvisos}
          </Text>
        ) : null}
        {lista.map(tarjeta)}
      </ScrollView>
    </SafeAreaView>
  );
}

const Titulo = ({ texto, punto }: { texto: string; punto?: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    {punto ? (
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primario }} />
    ) : null}
    <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario, flex: 1 }}>{texto}</Text>
  </View>
);
const Texto = ({ texto }: { texto: string }) => (
  <Text style={{ color: '#3A3A3A', fontSize: 14, marginTop: 6 }}>{texto}</Text>
);
