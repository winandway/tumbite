import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ErrorApi,
  type OpcionElegida,
  type Plato,
  type Restaurante,
  enIdioma,
  formatearDolares,
} from '@tumbite/compartido';
import { Boton, C, e, useSesion } from '@tumbite/movil';
import { useCarrito } from '../carrito';
import { ANCHO_MAX, Encabezado, Tarjeta } from '../comida/piezas';
import { BarraInferior, type Pestana } from '../inicio/BarraInferior';

const T = {
  es: {
    titulo: 'Mis pedidos',
    volver: 'Volver',
    vacio:
      'Todavía no has pedido nada. Cuando pidas, aquí verás tu historial, el recibo y el botón para repetir.',
    ver: 'Ver pedido y recibo',
    repetir: 'Repetir pedido',
    repitiendo: 'Armando tu carrito…',
    faltan: 'Algunos platos ya no están en el menú: te pusimos los que sí.',
    nada: 'Ninguno de esos platos sigue en el menú.',
    enCurso: 'En curso',
    estados: {
      pagado: 'Pagado',
      aceptado: 'En cocina',
      listo: 'Listo',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    } as Record<string, string>,
  },
  en: {
    titulo: 'My orders',
    volver: 'Back',
    vacio:
      'You haven’t ordered yet. Once you do, you’ll see your history, the receipt and the reorder button here.',
    ver: 'See order and receipt',
    repetir: 'Reorder',
    repitiendo: 'Building your cart…',
    faltan: 'Some items are no longer on the menu: we added the ones that are.',
    nada: 'None of those items are on the menu anymore.',
    enCurso: 'In progress',
    estados: {
      pagado: 'Paid',
      aceptado: 'Cooking',
      listo: 'Ready',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Canceled',
    } as Record<string, string>,
  },
};

type Pedido = {
  id: string;
  estado: string;
  restauranteId: string;
  restauranteNombre?: string;
  total: number;
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
export default function Pedidos() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const { agregar, vaciar } = useCarrito();
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

  /** Vuelve a armar el carrito con los platos de ese pedido que sigan en el menú y lleva al carrito. */
  async function repetir(p: Pedido) {
    setError('');
    setAviso('');
    setRepitiendo(p.id);
    try {
      const r = await api.pedir<{ restaurante: Restaurante; platos: Plato[] }>(
        'GET',
        `/datos/restaurantes/${p.restauranteId}`,
      );
      const rest = {
        id: r.restaurante.id,
        nombre: r.restaurante.nombre,
        plan: r.restaurante.plan,
        lat: r.restaurante.lat,
        lng: r.restaurante.lng,
      };
      const disponibles = new Map(
        r.platos.filter((x) => x.disponible !== false).map((x) => [x.id, x]),
      );
      let puestos = 0;
      let faltan = 0;
      vaciar();
      for (const l of p.lineas) {
        const plato = disponibles.get(l.platoId);
        if (!plato) {
          faltan++;
          continue;
        }
        for (let i = 0; i < l.cantidad; i++) agregar(rest, plato, l.opciones ?? []);
        puestos++;
      }
      if (!puestos) return setError(t.nada);
      if (faltan) setAviso(t.faltan);
      router.push('/cart');
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
        alVolver={() => router.replace('/')}
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
        {pedidos?.map((p) => (
          <Tarjeta key={p.id} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontWeight: '900', fontSize: 17, color: C.secundario }}
                  numberOfLines={1}
                >
                  {p.restauranteNombre}
                </Text>
                <Text style={{ color: '#5E5E5E', marginTop: 2 }}>
                  {fecha(p.creadoEn)} ·{' '}
                  <Text
                    style={
                      p.estado === 'entregado'
                        ? { color: C.exito, fontWeight: '700' }
                        : vivo(p)
                          ? { color: C.primario, fontWeight: '700' }
                          : undefined
                    }
                  >
                    {t.estados[p.estado] ?? p.estado}
                  </Text>
                </Text>
              </View>
              <Text style={{ fontWeight: '900', color: C.secundario }}>
                {formatearDolares(p.total, idioma)}
              </Text>
            </View>
            <Text style={{ color: '#5E5E5E', marginTop: 6 }} numberOfLines={2}>
              {p.lineas.map((l) => `${l.cantidad} × ${nombre(l)}`).join(' · ')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={() => router.push(`/order/${p.id}`)}
                accessibilityRole="link"
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#2a2a2a',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '800', color: C.secundario }}>
                  {vivo(p) ? t.enCurso : t.ver}
                </Text>
              </Pressable>
              {!vivo(p) ? (
                <View style={{ flex: 1 }}>
                  <Boton
                    texto={repitiendo === p.id ? t.repitiendo : t.repetir}
                    alTocar={() => void repetir(p)}
                    cargando={repitiendo === p.id}
                  />
                </View>
              ) : null}
            </View>
          </Tarjeta>
        ))}
      </ScrollView>
      <BarraInferior idioma={idioma} activa="pedidos" alTocar={pestana} />
    </SafeAreaView>
  );
}
