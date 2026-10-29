import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ErrorApi,
  type OpcionElegida,
  type Plan,
  enIdioma,
  formatearMonto,
  textoLinea,
} from '@tumbite/compartido';
import { C, e, useSesion } from '@tumbite/movil';
import { useCarrito } from '../../carrito';
import { ANCHO_MAX, BotonAncho, Encabezado, Tarjeta } from '../../comida/piezas';

/**
 * C-PEDIDO-GRUPO (29 oct 2026), como el «Group Order» de DoorDash: el enlace se comparte, cada
 * persona agrega lo suyo desde el menú y queda con su nombre; quien lo armó lo cierra, los platos
 * pasan a su carrito con el precio de hoy y paga como siempre.
 */
type Grupo = {
  codigo: string;
  estado: 'abierto' | 'cerrado' | 'cancelado';
  soyAnfitrion: boolean;
  /** C-PEDIDO-GRUPO-HORA */
  cierraEn?: string | null;
  pasoLaHora?: boolean;
  restaurante: { id: string; nombre: string; moneda: string };
  items: {
    id: string;
    persona: string;
    mio: boolean;
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    opciones: OpcionElegida[];
    precioCentavos: number;
  }[];
  noDisponibles: number;
};

const T = {
  es: {
    titulo: 'Pedido en grupo',
    ayuda:
      'Comparte el enlace. Cada persona entra con su cuenta y agrega lo suyo; quien armó el pedido lo revisa y paga.',
    compartir: 'Compartir el enlace',
    agregar: 'Agregar mis platos',
    vacio: 'Todavía nadie agregó platos.',
    quitar: 'Quitar',
    total: 'Total de la comida',
    cerrar: 'Cerrar y pagar',
    seguroCerrar:
      '¿Cerrar el pedido en grupo? Nadie podrá agregar más y los platos pasan a tu carrito.',
    si: 'Sí, cerrar',
    no: 'No',
    cerrado: 'Este pedido en grupo ya se cerró: quien lo armó lo está pagando.',
    cancelado: 'Este pedido en grupo se canceló.',
    hora: 'Hora de cierre',
    sinHora: 'Sin hora',
    en: (m: string) => `En ${m}`,
    seCierra: (h: string) => `Se cierra a las ${h}.`,
    yaCerro: 'Llegó la hora de cierre: ya nadie puede agregar más.',
    noDisponibles: (n: number) => `${n} plato(s) ya no están disponibles y no se cobrarán.`,
    mensaje: (r: string, url: string) =>
      `Armemos un pedido en grupo de ${r} en Divoox. Agrega lo tuyo aquí: ${url}`,
  },
  en: {
    titulo: 'Group order',
    ayuda:
      'Share the link. Each person signs in and adds their items; whoever started the order reviews it and pays.',
    compartir: 'Share the link',
    agregar: 'Add my items',
    vacio: 'Nobody has added items yet.',
    quitar: 'Remove',
    total: 'Food total',
    cerrar: 'Close and pay',
    seguroCerrar: 'Close the group order? Nobody can add more and the items move to your cart.',
    si: 'Yes, close',
    no: 'No',
    cerrado: 'This group order is closed: whoever started it is paying.',
    cancelado: 'This group order was canceled.',
    hora: 'Closing time',
    sinHora: 'No time',
    en: (m: string) => `In ${m}`,
    seCierra: (h: string) => `Closes at ${h}.`,
    yaCerro: 'It’s closing time: nobody can add more.',
    noDisponibles: (n: number) => `${n} item(s) are no longer available and won’t be charged.`,
    mensaje: (r: string, url: string) =>
      `Let’s do a group order from ${r} on Divoox. Add yours here: ${url}`,
  },
};

/** La hora de cierre, desde ahora (fuera del componente: se calcula al tocar, no al dibujar). */
const dentroDe = (minutos: number) => new Date(Date.now() + minutos * 60_000).toISOString();

function confirmar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, onPress: () => r(true) },
    ]),
  );
}

export default function PedidoEnGrupo() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const { llenar } = useCarrito();
  const [g, setG] = useState<Grupo | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    api
      .pedir<{ grupo: Grupo }>('GET', `/datos/grupos/${String(codigo)}`)
      .then((r) => setG(r.grupo))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api, codigo]);
  useEffect(() => {
    cargar();
    // Mientras está abierto, se refresca solo para ver lo que agregan los demás.
    const reloj = setInterval(cargar, 8000);
    return () => clearInterval(reloj);
  }, [cargar]);

  const url = `https://divoox.com/app/group/${String(codigo)}`;
  async function compartir() {
    if (!g) return;
    const mensaje = t.mensaje(g.restaurante.nombre, url);
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(mensaje).catch(() => undefined);
      return;
    }
    await Share.share({ message: mensaje }).catch(() => undefined);
  }
  async function ponerHora(minutos: number | null) {
    try {
      await api.pedir('PATCH', `/datos/grupos/${String(codigo)}`, {
        cierraEn: minutos == null ? null : dentroDe(minutos),
      });
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function quitar(itemId: string) {
    try {
      await api.pedir('DELETE', `/datos/grupos/${String(codigo)}/items/${itemId}`);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function cerrar() {
    if (!(await confirmar(t.seguroCerrar, t.si, t.no))) return;
    try {
      const r = await api.pedir<{
        restaurante: {
          id: string;
          nombre: string;
          plan: Plan;
          lat: number | null;
          lng: number | null;
          moneda: string;
          esTienda: boolean;
        };
        lineas: {
          platoId: string;
          nombreEs: string;
          nombreEn: string;
          precioCentavos: number;
          cantidad: number;
          opciones?: OpcionElegida[];
          requiereEdad?: boolean;
        }[];
      }>('POST', `/datos/grupos/${String(codigo)}/cerrar`, {});
      llenar(r.restaurante, r.lineas);
      router.replace('/cart');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const total = (g?.items ?? []).reduce((s, i) => s + i.precioCentavos * i.cantidad, 0);
  const personas = [...new Set((g?.items ?? []).map((i) => i.persona))];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <Encabezado titulo={t.titulo} alVolver={() => router.back()} etiquetaVolver={t.titulo} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ width: '100%', maxWidth: ANCHO_MAX, alignSelf: 'center', gap: 12 }}>
          {error ? <Text style={e.error}>{error}</Text> : null}
          {g ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>
                {g.restaurante.nombre}
              </Text>
              <Text style={{ color: '#5E5E5E' }}>{t.ayuda}</Text>
              {g.estado === 'cerrado' ? <Text style={e.aviso}>{t.cerrado}</Text> : null}
              {g.estado === 'cancelado' ? <Text style={e.aviso}>{t.cancelado}</Text> : null}
              {g.estado === 'abierto' && g.cierraEn ? (
                <Text
                  style={{ fontWeight: '700', color: g.pasoLaHora ? C.primario : C.secundario }}
                >
                  {g.pasoLaHora
                    ? t.yaCerro
                    : t.seCierra(
                        new Date(`${g.cierraEn.replace(' ', 'T')}Z`).toLocaleTimeString(
                          idioma === 'en' ? 'en-US' : 'es-US',
                          { hour: 'numeric', minute: '2-digit' },
                        ),
                      )}
                </Text>
              ) : null}
              {g.estado === 'abierto' && g.soyAnfitrion && !g.pasoLaHora ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: '#5E5E5E' }}>{t.hora}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(
                      [
                        [null, t.sinHora],
                        [30, t.en('30 min')],
                        [60, t.en('1 h')],
                        [120, t.en('2 h')],
                      ] as const
                    ).map(([min, texto]) => (
                      <Text
                        key={texto}
                        onPress={() => void ponerHora(min)}
                        accessibilityRole="button"
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: '#DADADA',
                          backgroundColor: '#fff',
                          fontWeight: '700',
                          color: C.secundario,
                        }}
                      >
                        {texto}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}
              {g.estado === 'abierto' && !g.pasoLaHora ? (
                <View style={{ gap: 8 }}>
                  <BotonAncho texto={t.compartir} alTocar={() => void compartir()} secundario />
                  <BotonAncho
                    texto={t.agregar}
                    alTocar={() =>
                      router.push(`/restaurant/${g.restaurante.id}?grupo=${String(codigo)}`)
                    }
                  />
                </View>
              ) : null}
              {!g.items.length ? <Text style={{ color: '#5E5E5E' }}>{t.vacio}</Text> : null}
              {personas.map((persona) => (
                <Tarjeta key={persona}>
                  <Text style={{ fontWeight: '900', color: C.secundario, marginBottom: 6 }}>
                    {persona}
                  </Text>
                  {g.items
                    .filter((i) => i.persona === persona)
                    .map((i) => (
                      <View
                        key={i.id}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginTop: 4,
                        }}
                      >
                        <Text style={{ flex: 1, color: C.secundario }}>
                          {i.cantidad} × {textoLinea(i, idioma)}
                        </Text>
                        <Text style={{ color: C.secundario }}>
                          {formatearMonto(
                            i.precioCentavos * i.cantidad,
                            g.restaurante.moneda,
                            idioma,
                          )}
                        </Text>
                        {g.estado === 'abierto' && (i.mio || g.soyAnfitrion) ? (
                          <Text
                            style={e.enlace}
                            onPress={() => void quitar(i.id)}
                            accessibilityRole="button"
                          >
                            {t.quitar}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                </Tarjeta>
              ))}
              {g.noDisponibles ? (
                <Text style={e.aviso}>{t.noDisponibles(g.noDisponibles)}</Text>
              ) : null}
              {g.items.length ? (
                <Text style={{ fontWeight: '900', fontSize: 17, color: C.secundario }}>
                  {t.total}: {formatearMonto(total, g.restaurante.moneda, idioma)}
                </Text>
              ) : null}
              {g.soyAnfitrion && g.estado === 'abierto' && g.items.length ? (
                <BotonAncho texto={t.cerrar} alTocar={() => void cerrar()} />
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
