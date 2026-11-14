import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ErrorApi, type OpcionElegida, enIdioma, formatearMonto } from '@tumbite/compartido';
import { C, e, urlFoto, useSesion } from '@tumbite/movil';
import { fotoDeRelleno } from '../inicio/recursos';
import { usePedirOtraVez } from '../pedirOtraVez';
import { ANCHO_MAX, Encabezado, Tarjeta } from '../comida/piezas';
import { BarraInferior, type Pestana } from '../inicio/BarraInferior';
import { conCuenta } from '../ConCuenta';

const T = {
  es: {
    titulo: 'Mis pedidos',
    volver: 'Volver',
    vacio:
      'Todavía no has pedido nada. Cuando pidas, aquí verás tu historial, el recibo y el botón para repetir.',
    ver: 'Ver recibo',
    repetir: 'Pedir otra vez',
    seguir: 'Seguir mi pedido',
    articulos: (n: number) => (n === 1 ? '1 artículo' : `${n} artículos`),
    repitiendo: 'Armando tu carrito…',
    enCurso: 'En curso',
    estados: {
      pagado: 'Pagado',
      aceptado: 'En cocina',
      listo: 'Listo',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    } as Record<string, string>,
    // C-CLIENTE-AUSENTE: cerrado sin entregar porque no estabas; no se dice «Entregado».
    noEntregado: 'No entregado',
  },
  en: {
    titulo: 'My orders',
    volver: 'Back',
    vacio:
      'You haven’t ordered yet. Once you do, you’ll see your history, the receipt and the reorder button here.',
    ver: 'View receipt',
    repetir: 'Order again',
    seguir: 'Track my order',
    articulos: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    repitiendo: 'Building your cart…',
    enCurso: 'In progress',
    estados: {
      pagado: 'Paid',
      aceptado: 'Cooking',
      listo: 'Ready',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Canceled',
    } as Record<string, string>,
    noEntregado: 'Not delivered',
  },
};

type Pedido = {
  id: string;
  estado: string;
  /** C-CLIENTE-AUSENTE: «ausente» = se cerró sin entregar porque no estabas. */
  entregadoComo?: string | null;
  restauranteId: string;
  restauranteNombre?: string;
  restauranteImagen?: string;
  restauranteCategoria?: string;
  total: number;
  moneda?: string;
  creadoEn: string;
  lineas: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    opciones?: OpcionElegida[];
  }[];
};

/** Pestaña Pedidos (auditoría final, punto 12): historial con estado, recibo y «Repetir pedido», como en DoorDash. */
function Pedidos() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const { pedirOtraVez } = usePedirOtraVez(idioma);
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [repitiendo, setRepitiendo] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api
      .pedir<{ pedidos: Pedido[] }>('GET', '/datos/mis-pedidos')
      .then((r) => setPedidos(r.pedidos))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  useEffect(cargar, [cargar]);

  /** C-PEDIR-OTRA-VEZ: el servidor arma lo repetible (restaurante o tienda, precio de hoy). */
  async function repetir(p: Pedido) {
    setError('');
    setAviso('');
    setRepitiendo(p.id);
    try {
      await pedirOtraVez(p.id);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setRepitiendo(null);
    }
  }

  const pestana = (p: Pestana) => {
    if (p === 'inicio') return router.replace('/');
    if (p === 'favoritos') return router.push('/favorites');
    if (p === 'cuenta') return router.push('/account');
  };
  const fecha = (f: string) =>
    new Date(`${f.replace(' ', 'T')}Z`).toLocaleDateString(idioma, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  const vivo = (p: Pedido) => !['entregado', 'cancelado'].includes(p.estado);
  const nombre = (l: Pedido['lineas'][number]) =>
    idioma === 'en' ? l.nombreEn || l.nombreEs : l.nombreEs;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <Encabezado
        titulo={t.titulo}
        alVolver={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        etiquetaVolver={t.volver}
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
        {error ? (
          <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {aviso ? (
          <Text style={{ color: '#5E5E5E', marginBottom: 8 }} accessibilityLiveRegion="polite">
            {aviso}
          </Text>
        ) : null}
        {pedidos?.length === 0 ? <Text style={{ color: '#5E5E5E' }}>{t.vacio}</Text> : null}
        {pedidos?.map((p, i) => {
          // C-MIS-PEDIDOS-MINIATURA (1 nov 2026, pedido de Richard): como la lista de pedidos de los
          // grandes: miniatura del local, estado con color (verde = entregado) y botones compactos.
          const ausente = p.estado === 'entregado' && p.entregadoComo === 'ausente';
          const textoEstado = ausente ? t.noEntregado : (t.estados[p.estado] ?? p.estado);
          const estado = ausente
            ? { fondo: '#FDECEC', texto: C.primario }
            : p.estado === 'entregado'
              ? { fondo: '#E6F4EC', texto: C.exito }
              : p.estado === 'cancelado'
                ? { fondo: '#F1F1F2', texto: '#5E5E5E' }
                : { fondo: '#E7F0F7', texto: '#1F5F8B' };
          const articulos = p.lineas.reduce((n, l) => n + l.cantidad, 0);
          const foto = urlFoto(p.restauranteImagen ?? null, 'miniatura');
          return (
            <Tarjeta key={p.id} style={{ marginBottom: 12, padding: 12 }}>
              <Pressable
                onPress={() => router.push(`/order/${p.id}`)}
                accessibilityRole="link"
                accessibilityLabel={`${p.restauranteNombre ?? ''} · ${textoEstado}`}
                style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
              >
                <Image
                  source={foto ? { uri: foto } : fotoDeRelleno(p.restauranteCategoria ?? '', i)}
                  style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: '#f1f1f1' }}
                  accessibilityIgnoresInvertColors
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text
                      style={{ flex: 1, fontWeight: '700', fontSize: 16, color: C.secundario }}
                      numberOfLines={1}
                    >
                      {p.restauranteNombre}
                    </Text>
                    <Text style={{ fontWeight: '700', color: C.secundario }}>
                      {formatearMonto(p.total, p.moneda ?? 'USD', idioma)}
                    </Text>
                  </View>
                  <Text style={{ color: '#5E5E5E', marginTop: 2, fontSize: 13 }} numberOfLines={1}>
                    {fecha(p.creadoEn)} · {t.articulos(articulos)}
                  </Text>
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 6,
                      backgroundColor: estado.fondo,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: estado.texto, fontWeight: '700', fontSize: 12 }}>
                      {textoEstado}
                    </Text>
                  </View>
                </View>
              </Pressable>
              <Text style={{ color: '#5E5E5E', marginTop: 10, fontSize: 13 }} numberOfLines={1}>
                {p.lineas.map((l) => `${l.cantidad} × ${nombre(l)}`).join(' · ')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {vivo(p) ? (
                  <Pressable
                    onPress={() => router.push(`/order/${p.id}`)}
                    accessibilityRole="button"
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: '#1F5F8B',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontWeight: '700', color: '#fff' }} numberOfLines={1}>
                      {t.seguir}
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      onPress={() => router.push(`/order/${p.id}`)}
                      accessibilityRole="link"
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: '#D6D6D6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#fff',
                      }}
                    >
                      <Text style={{ fontWeight: '700', color: C.secundario }} numberOfLines={1}>
                        {t.ver}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void repetir(p)}
                      disabled={repitiendo === p.id}
                      accessibilityRole="button"
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 999,
                        backgroundColor: C.exito,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: repitiendo === p.id ? 0.7 : 1,
                      }}
                    >
                      <Text style={{ fontWeight: '700', color: '#fff' }} numberOfLines={1}>
                        {repitiendo === p.id ? t.repitiendo : t.repetir}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </Tarjeta>
          );
        })}
      </ScrollView>
      <BarraInferior idioma={idioma} activa="pedidos" alTocar={pestana} />
    </SafeAreaView>
  );
}

export default conCuenta(Pedidos);
