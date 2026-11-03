import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ErrorApi, enIdioma, formatearMonto } from '@tumbite/compartido';
import {
  Boton,
  C,
  MenuCuenta,
  MisCasos,
  TEXTOS_MOVIL,
  selectorDeCapturas,
  ReportarProblema,
  URL_SERVIDOR,
  e,
  urlFoto,
  useSesion,
  abrirPanel,
  VersionInstalada,
} from '@tumbite/movil';
import { fotoDeRelleno } from '../inicio/recursos';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ANCHO_MAX, Encabezado } from '../comida/piezas';
import { BarraInferior, type Pestana } from '../inicio/BarraInferior';

const T = {
  es: {
    titulo: 'Mi cuenta',
    volver: 'Volver',
    pedidos: 'Mis pedidos',
    sinPedidos: 'Todavía no has pedido. ¡Tu primer antojo te espera!',
    tarjetas: 'Mis tarjetas',
    sinTarjetas: 'No tienes tarjetas guardadas. Al pagar puedes elegir guardar la tuya.',
    vence: 'vence',
    opciones: 'Opciones de la tarjeta',
    quitar: 'Quitar esta tarjeta',
    seguro: '¿Quitar esta tarjeta? Para volver a usarla tendrás que escribirla otra vez.',
    si: 'Sí, quitarla',
    no: 'No',
    datos: 'Mis datos',
    editarDatos: 'Cambiar nombre, correo o contraseña',
    ayuda: 'Ayuda',
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
    titulo: 'My account',
    volver: 'Back',
    pedidos: 'My orders',
    sinPedidos: 'You haven’t ordered yet. Your first craving is waiting!',
    tarjetas: 'My cards',
    sinTarjetas: 'You have no saved cards. When you pay, you can choose to save yours.',
    vence: 'expires',
    opciones: 'Card options',
    quitar: 'Remove this card',
    seguro: 'Remove this card? To use it again you’ll have to type it in again.',
    si: 'Yes, remove it',
    no: 'No',
    datos: 'My details',
    editarDatos: 'Change name, email, or password',
    ayuda: 'Help',
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
  restauranteNombre?: string;
  restauranteImagen?: string;
  restauranteCategoria?: string;
  total: number;
  moneda?: string;
  creadoEn: string;
};
type Tarjeta = { id: string; marca: string; ultimos4: string; vence: string };

/** «Mi cuenta» del cliente: historial, tarjetas guardadas, datos y ayuda. */
export default function MiCuenta() {
  const { api, idioma, usuario, salir } = useSesion();
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const pestana = (p: Pestana) => {
    if (p === 'inicio') return router.replace('/');
    if (p === 'pedidos') return router.push('/orders');
    if (p === 'favoritos') return router.push('/favorites');
  };
  const t = enIdioma(T, idioma);
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [tarjetas, setTarjetas] = useState<Tarjeta[] | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api
      .pedir<{ pedidos: Pedido[] }>('GET', '/datos/mis-pedidos')
      .then((r) => setPedidos(r.pedidos))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
    api
      .pedir<{ tarjetas: Tarjeta[] }>('GET', '/datos/mis-tarjetas')
      .then((r) => setTarjetas(r.tarjetas))
      .catch(() => setTarjetas([]));
  }, [api]);
  useEffect(cargar, [cargar]);
  // C-PLUS y C-TARJETAS-REGALO: sus entradas aparecen solo cuando están encendidas.
  const [plusDisponible, setPlusDisponible] = useState(false);
  const [tarjetasActivas, setTarjetasActivas] = useState(false);
  // C-REFERIDOS: «Invita a un amigo» aparece solo cuando el equipo lo enciende.
  const [invitarActivo, setInvitarActivo] = useState(false);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ disponible: boolean }>('GET', '/datos/plus')
      .then((r) => vivo && setPlusDisponible(r.disponible))
      .catch(() => undefined);
    api
      .pedir<{ activas: boolean }>('GET', '/datos/tarjetas-regalo')
      .then((r) => vivo && setTarjetasActivas(r.activas))
      .catch(() => undefined);
    api
      .pedir<{ activos: boolean }>('GET', '/datos/referidos')
      .then((r) => vivo && setInvitarActivo(r.activos))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);

  async function quitar(id: string) {
    setError('');
    try {
      await api.pedir('POST', `/datos/mis-tarjetas/${id}/quitar`, {});
      setConfirmar(null);
      setMenu(null);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const fecha = (f: string) =>
    new Date(`${f.replace(' ', 'T')}Z`).toLocaleDateString(idioma, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    // Mismo armazón que Favoritos y Pedidos (antes la cabecera roja vieja con «← Volver»).
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <Encabezado
        titulo={t.titulo}
        alVolver={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        etiquetaVolver={t.volver}
      />
      <ScrollView
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontWeight: '700' }}>{usuario?.nombre}</Text>
        <Text style={{ color: '#5E5E5E', marginBottom: 16 }}>{usuario?.correo}</Text>
        {error ? (
          <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {plusDisponible ? (
          <Pressable
            onPress={() => router.push('/plus')}
            accessibilityRole="link"
            testID="ir-divoox-plus"
            style={[e.tarjeta, { flexDirection: 'row', justifyContent: 'space-between' }]}
          >
            <Text style={{ fontWeight: '700' }}>Divoox Plus</Text>
            <Text style={{ fontWeight: '700' }}>›</Text>
          </Pressable>
        ) : null}
        {tarjetasActivas ? (
          <Pressable
            onPress={() => router.push('/gift-cards')}
            accessibilityRole="link"
            testID="ir-tarjetas-regalo"
            style={[e.tarjeta, { flexDirection: 'row', justifyContent: 'space-between' }]}
          >
            <Text style={{ fontWeight: '700' }}>
              {idioma === 'en' ? 'Gift cards' : 'Tarjetas de regalo'}
            </Text>
            <Text style={{ fontWeight: '700' }}>›</Text>
          </Pressable>
        ) : null}
        {invitarActivo ? (
          <Pressable
            onPress={() => router.push('/invite')}
            accessibilityRole="link"
            testID="ir-invitar-amigo"
            style={[e.tarjeta, { flexDirection: 'row', justifyContent: 'space-between' }]}
          >
            <Text style={{ fontWeight: '700' }}>
              {idioma === 'en' ? 'Invite a friend' : 'Invita a un amigo'}
            </Text>
            <Text style={{ fontWeight: '700' }}>›</Text>
          </Pressable>
        ) : null}
        {/* Divoox Flex: lo que las empresas me envían (C-FLEX-UBICACION). */}
        <Pressable
          onPress={() => router.push('/packages')}
          accessibilityRole="link"
          testID="ir-mis-paquetes"
          style={[e.tarjeta, { flexDirection: 'row', justifyContent: 'space-between' }]}
        >
          <Text style={{ fontWeight: '700' }}>
            {idioma === 'en' ? 'My packages' : 'Mis paquetes'}
          </Text>
          <Text style={{ fontWeight: '700' }}>›</Text>
        </Pressable>

        <Text style={estilos.subtitulo}>{t.pedidos}</Text>
        {pedidos?.length === 0 ? <Text style={e.tarjeta}>{t.sinPedidos}</Text> : null}
        {pedidos?.map((p, i) => {
          // C-MIS-PEDIDOS-MINIATURA: la misma tarjeta que «Mis pedidos»: miniatura y estado con color.
          const estado =
            p.estado === 'entregado'
              ? { fondo: '#E6F4EC', texto: C.exito }
              : p.estado === 'cancelado'
                ? { fondo: '#F1F1F2', texto: '#5E5E5E' }
                : { fondo: '#E7F0F7', texto: '#1F5F8B' };
          const foto = urlFoto(p.restauranteImagen ?? null, 'miniatura');
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push(`/order/${p.id}`)}
              accessibilityRole="link"
              style={[e.tarjeta, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            >
              <Image
                source={foto ? { uri: foto } : fotoDeRelleno(p.restauranteCategoria ?? '', i)}
                style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: '#f1f1f1' }}
                accessibilityIgnoresInvertColors
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '700' }} numberOfLines={1}>
                  {p.restauranteNombre}
                </Text>
                <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{fecha(p.creadoEn)}</Text>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 4,
                    backgroundColor: estado.fondo,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: estado.texto, fontWeight: '700', fontSize: 12 }}>
                    {t.estados[p.estado] ?? p.estado}
                  </Text>
                </View>
              </View>
              <Text style={{ fontWeight: '700' }}>
                {formatearMonto(p.total, p.moneda ?? 'USD', idioma)}
              </Text>
            </Pressable>
          );
        })}

        <Text style={estilos.subtitulo}>{t.tarjetas}</Text>
        {tarjetas?.length === 0 ? <Text style={e.tarjeta}>{t.sinTarjetas}</Text> : null}
        {tarjetas?.map((x) => (
          <View key={x.id} style={e.tarjeta}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontWeight: '700' }}>
                {x.marca.toUpperCase()} •••• {x.ultimos4}{' '}
                <Text style={{ fontWeight: '400', color: '#5E5E5E' }}>
                  {t.vence} {x.vence}
                </Text>
              </Text>
              {/* Quitar la tarjeta va escondido en los tres puntos y con confirmación. */}
              <Pressable
                onPress={() => setMenu(menu === x.id ? null : x.id)}
                accessibilityRole="button"
                accessibilityLabel={t.opciones}
                hitSlop={8}
                style={{ padding: 8 }}
              >
                <Text style={{ fontSize: 22 }}>⋮</Text>
              </Pressable>
            </View>
            {menu === x.id && confirmar !== x.id ? (
              <Text style={[e.enlace, { color: C.primario }]} onPress={() => setConfirmar(x.id)}>
                {t.quitar}
              </Text>
            ) : null}
            {confirmar === x.id ? (
              <View>
                <Text style={{ marginVertical: 8 }}>{t.seguro}</Text>
                <Boton texto={t.si} alTocar={() => void quitar(x.id)} />
                <Text style={e.enlace} onPress={() => setConfirmar(null)}>
                  {t.no}
                </Text>
              </View>
            ) : null}
          </View>
        ))}

        <Text style={estilos.subtitulo}>{t.datos}</Text>
        <Boton
          texto={t.editarDatos}
          alTocar={() => void abrirPanel(api, URL_SERVIDOR, '/panel/settings')}
          secundario
        />

        <Text style={estilos.subtitulo}>{t.ayuda}</Text>
        <ReportarProblema />
        {/* C-AYUDA-EN-LA-APP: los casos y su chat con Soporte, sin salir a la web. */}
        <MisCasos
          elegirCapturas={selectorDeCapturas(
            ImagePicker.launchImageLibraryAsync,
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          )}
        />

        {/* POR-1 (2 nov 2026): «Cerrar sesión» vive aquí, no en la portada (como los grandes).
            Los tres puntos guardan las guías, el soporte y borrar la cuenta. */}
        <View style={{ marginTop: 20, gap: 8 }}>
          <Boton texto={tm.salir} alTocar={() => void salir()} secundario />
          <MenuCuenta />
        </View>
        {/* C-VERSION-VISIBLE: versión y compilación instaladas, para soporte. */}
        <VersionInstalada />
      </ScrollView>
      <BarraInferior idioma={idioma} activa="cuenta" alTocar={pestana} />
    </SafeAreaView>
  );
}

const estilos = {
  subtitulo: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: C.secundario,
    marginTop: 16,
    marginBottom: 8,
  },
};
