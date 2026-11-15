import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type Idioma,
  type RolPuerta,
  rutaPuertaRepartidor,
  textoRolPuerta,
  textosFotoPuerta,
} from '@tumbite/compartido';
import { C, useSesion } from '@tumbite/movil';

/**
 * C-FOTO-PUERTA (15 nov 2026) — todos los países. Lo que ve el repartidor: cuando el pedido va
 * «en camino» y el cliente tiene fotos de su puerta, la miniatura de la foto 1 reemplaza la imagen
 * de comida de la hoja blanca, con «1 de N». Al tocarla abre una hoja a MEDIA altura (nunca a
 * pantalla completa: el mapa, «Entregar» y los botones redondos siguen debajo) con las fotos
 * grandes deslizables, su rótulo y las notas completas. Sin compartir ni guardar. Las grandes se
 * piden solo al abrir la hoja; al dejar de estar en camino todo desaparece y se suelta de memoria.
 */
type FotoPuerta = { orden: number; rol: RolPuerta };

const T = {
  es: {
    verFotos: 'Ver las fotos de la puerta',
    cerrar: 'Cerrar',
    sinSenal: 'Sin señal, se cargará al volver.',
    reintentar: 'Reintentar',
    notas: 'Indicaciones del cliente',
    sinNotas: 'El cliente no dejó indicaciones.',
    foto: 'Foto {n}',
  },
  en: {
    verFotos: 'View the door photos',
    cerrar: 'Close',
    sinSenal: 'No signal. It will load when you’re back online.',
    reintentar: 'Try again',
    notas: 'Customer instructions',
    sinNotas: 'The customer didn’t leave instructions.',
    foto: 'Photo {n}',
  },
};

/** La lista de fotos y la miniatura de la foto 1, solo mientras el pedido va en camino. */
function usePuerta(pedidoId: string, estado: string) {
  const { api } = useSesion();
  const enCamino = estado === 'en_camino';
  // Lo cargado, guardado con el pedido para el que se pidió: otro pedido no ve fotos ajenas.
  const [datos, setDatos] = useState<{ pedido: string; fotos: FotoPuerta[]; mini: string | null }>({
    pedido: '',
    fotos: [],
    mini: null,
  });
  useEffect(() => {
    // Fuera de «en camino» (entregado, cancelado) no se pide nada.
    if (!enCamino || !pedidoId) return;
    let vivo = true;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    const cargar = async () => {
      try {
        const r = await api.pedir<{ fotos: FotoPuerta[] }>(
          'GET',
          `/datos/repartidor/pedidos/${encodeURIComponent(pedidoId)}/puerta`,
        );
        if (!vivo) return;
        const lista = [...r.fotos].sort((a, b) => a.orden - b.orden);
        const primera = lista[0];
        const uri = primera
          ? await api.verFoto(rutaPuertaRepartidor(pedidoId, primera.orden, true))
          : null;
        if (vivo) setDatos({ pedido: pedidoId, fotos: lista, mini: uri });
      } catch (x) {
        // Sin señal: se vuelve a intentar en un rato, sin molestar al repartidor.
        console.warn('foto de la puerta: no cargó', x);
        if (vivo) reintento = setTimeout(() => void cargar(), 20_000);
      }
    };
    void cargar();
    return () => {
      vivo = false;
      if (reintento) clearTimeout(reintento);
    };
  }, [api, pedidoId, enCamino]);
  // Al dejar de estar en camino, nada se muestra; y se suelta la imagen al cambiar de pedido.
  const vale = enCamino && datos.pedido === pedidoId;
  useEffect(() => {
    if (!enCamino && datos.pedido)
      // Suelta la miniatura de la memoria (cambio en una respuesta asíncrona, no en el render).
      void Promise.resolve().then(() => setDatos({ pedido: '', fotos: [], mini: null }));
  }, [enCamino, datos.pedido]);
  return { fotos: vale ? datos.fotos : [], mini: vale ? datos.mini : null };
}

function HojaFotos({
  cerrar,
  pedidoId,
  fotos,
  notas,
  idioma,
}: {
  cerrar: () => void;
  pedidoId: string;
  fotos: FotoPuerta[];
  notas: string;
  idioma: Idioma;
}) {
  const { api } = useSesion();
  const t = idioma === 'en' ? T.en : T.es;
  const { width, height } = useWindowDimensions();
  const abajo = useSafeAreaInsets().bottom;
  const [grandes, setGrandes] = useState<Record<number, string>>({});
  const [fallo, setFallo] = useState<Record<number, boolean>>({});
  const [pagina, setPagina] = useState(0);
  const [intento, setIntento] = useState(0);
  const alto = Math.round(height * 0.55);
  const altoFoto = Math.max(140, Math.min(alto - 190 - abajo, Math.round(width * 0.75)));

  // Deslizar hacia abajo desde la manija cierra la hoja.
  const arrastre = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 60) cerrar();
        },
      }),
    [cerrar],
  );

  // Las grandes se piden solo con la hoja abierta; al cerrarla se desmonta y se sueltan.
  useEffect(() => {
    let vivo = true;
    for (const f of fotos) {
      if (grandes[f.orden]) continue;
      api
        .verFoto(rutaPuertaRepartidor(pedidoId, f.orden))
        .then((uri) => {
          if (!vivo) return;
          setGrandes((g) => ({ ...g, [f.orden]: uri }));
          setFallo((x) => ({ ...x, [f.orden]: false }));
        })
        .catch(() => vivo && setFallo((x) => ({ ...x, [f.orden]: true })));
    }
    return () => {
      vivo = false;
    };
    // `intento` vuelve a pedir las que fallaron.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento, pedidoId, fotos.map((f) => f.orden).join(',')]);

  // «Se cargará al volver»: mientras la hoja está abierta y algo falló, se reintenta solo.
  const hayFallo = Object.values(fallo).some(Boolean);
  useEffect(() => {
    if (!hayFallo) return;
    const r = setTimeout(() => setIntento((n) => n + 1), 8_000);
    return () => clearTimeout(r);
  }, [hayFallo, intento]);

  return (
    <Modal transparent visible animationType="slide" onRequestClose={cerrar}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Tocar fuera cierra. */}
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
          onPress={cerrar}
          accessibilityRole="button"
          accessibilityLabel={t.cerrar}
          testID="puerta-fondo"
        />
        <View
          testID="puerta-hoja"
          style={{
            height: alto,
            backgroundColor: '#fff',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingBottom: abajo + 10,
          }}
        >
          <View {...arrastre.panHandlers} style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#D6D6D6' }} />
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(ev) =>
              setPagina(Math.round(ev.nativeEvent.contentOffset.x / Math.max(1, width)))
            }
            scrollEventThrottle={16}
            style={{ flexGrow: 0 }}
          >
            {fotos.map((f) => (
              <View key={f.orden} style={{ width, paddingHorizontal: 16, gap: 6 }}>
                <Text style={{ fontWeight: '800', color: C.secundario }}>
                  {textoRolPuerta(idioma, f.rol).rotulo}
                </Text>
                <View
                  style={{
                    height: altoFoto,
                    borderRadius: 14,
                    overflow: 'hidden',
                    backgroundColor: '#F4F5F7',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {grandes[f.orden] ? (
                    <Image
                      source={{ uri: grandes[f.orden] }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                      accessibilityLabel={textoRolPuerta(idioma, f.rol).rotulo}
                    />
                  ) : fallo[f.orden] ? (
                    <View style={{ alignItems: 'center', gap: 10, padding: 16 }}>
                      <Text style={{ color: '#5E5E5E', textAlign: 'center' }}>{t.sinSenal}</Text>
                      <Pressable
                        onPress={() => setIntento((n) => n + 1)}
                        accessibilityRole="button"
                        testID={`puerta-reintentar-${f.orden}`}
                        style={{
                          borderWidth: 1,
                          borderColor: '#2a2a2a',
                          borderRadius: 999,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ fontWeight: '700', color: C.secundario }}>
                          {t.reintentar}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <ActivityIndicator color={C.primario} />
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
          {fotos.length > 1 ? (
            <View
              style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 8 }}
              accessibilityLabel={textosFotoPuerta(idioma)
                .deCuantas.replace('{n}', String(pagina + 1))
                .replace('{total}', String(fotos.length))}
            >
              {fotos.map((f, i) => (
                <View
                  key={f.orden}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: i === pagina ? C.secundario : '#D6D6D6',
                  }}
                />
              ))}
            </View>
          ) : null}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 4 }}>
            <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.notas}</Text>
            <Text style={{ color: C.secundario }} testID="puerta-notas">
              {notas.trim() || t.sinNotas}
            </Text>
          </ScrollView>
          <Pressable
            onPress={cerrar}
            accessibilityRole="button"
            accessibilityLabel={t.cerrar}
            testID="puerta-cerrar"
            style={({ pressed }) => ({
              marginHorizontal: 16,
              minHeight: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#2a2a2a',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontWeight: '700', color: C.secundario }}>{t.cerrar}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * La imagen de la izquierda de la hoja blanca: la miniatura de la puerta (si el pedido va en camino
 * y hay fotos) o lo de siempre (`respaldo`, la imagen de comida de 54 × 54).
 */
export function MiniaturaPuerta({
  pedidoId,
  estado,
  notas,
  idioma,
  respaldo,
}: {
  pedidoId: string;
  estado: string;
  notas: string;
  idioma: Idioma;
  respaldo: ReactNode;
}) {
  const t = idioma === 'en' ? T.en : T.es;
  const { fotos, mini } = usePuerta(pedidoId, estado);
  const [abierta, setAbierta] = useState(false);
  const hay = fotos.length > 0 && !!mini;
  if (!hay) return <>{respaldo}</>;
  return (
    <>
      <Pressable
        onPress={() => setAbierta(true)}
        accessibilityRole="button"
        accessibilityLabel={t.verFotos}
        testID="puerta-miniatura"
        style={{ width: 54, height: 54 }}
      >
        <Image
          source={{ uri: mini }}
          style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: '#F4F5F7' }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <View
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            backgroundColor: C.secundario,
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderWidth: 1.5,
            borderColor: '#fff',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
            {textosFotoPuerta(idioma)
              .deCuantas.replace('{n}', '1')
              .replace('{total}', String(fotos.length))}
          </Text>
        </View>
      </Pressable>
      {/* Sin fotos (entregado o cancelado) la hoja desaparece con la miniatura. */}
      {abierta ? (
        <HojaFotos
          cerrar={() => setAbierta(false)}
          pedidoId={pedidoId}
          fotos={fotos}
          notas={notas}
          idioma={idioma}
        />
      ) : null}
    </>
  );
}
