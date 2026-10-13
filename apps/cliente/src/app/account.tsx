import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ErrorApi, enIdioma, formatearDolares } from '@tumbite/compartido';
import { Boton, C, Pantalla, ReportarProblema, URL_SERVIDOR, e, useSesion } from '@tumbite/movil';

const T = {
  es: {
    titulo: 'Mi cuenta',
    volver: '← Volver',
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
    volver: '← Back',
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
  total: number;
  creadoEn: string;
};
type Tarjeta = { id: string; marca: string; ultimos4: string; vence: string };

/** «Mi cuenta» del cliente: historial, tarjetas guardadas, datos y ayuda. */
export default function MiCuenta() {
  const { api, idioma, usuario } = useSesion();
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
    <Pantalla titulo={t.titulo}>
      <Text style={e.enlace} onPress={() => router.back()} accessibilityRole="button">
        {t.volver}
      </Text>
      <Text style={{ fontWeight: '700' }}>{usuario?.nombre}</Text>
      <Text style={{ color: '#5E5E5E', marginBottom: 16 }}>{usuario?.correo}</Text>
      {error ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Text style={estilos.subtitulo}>{t.pedidos}</Text>
      {pedidos?.length === 0 ? <Text style={e.tarjeta}>{t.sinPedidos}</Text> : null}
      {pedidos?.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/order/${p.id}`)}
          accessibilityRole="link"
          style={[e.tarjeta, { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{p.restauranteNombre}</Text>
            <Text style={{ color: '#5E5E5E' }}>
              {fecha(p.creadoEn)} · {t.estados[p.estado] ?? p.estado}
            </Text>
          </View>
          <Text style={{ fontWeight: '800' }}>{formatearDolares(p.total, idioma)}</Text>
        </Pressable>
      ))}

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
        alTocar={() => void Linking.openURL(`${URL_SERVIDOR}/panel/settings`)}
        secundario
      />

      <Text style={estilos.subtitulo}>{t.ayuda}</Text>
      <ReportarProblema />
    </Pantalla>
  );
}

const estilos = {
  subtitulo: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: C.secundario,
    marginTop: 16,
    marginBottom: 8,
  },
};
