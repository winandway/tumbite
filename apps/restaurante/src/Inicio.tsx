import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import sonidoAlarma from '../assets/sonidos/alarma.wav';
import { useKeepAwake } from 'expo-keep-awake';
import {
  ErrorApi,
  type Restaurante,
  enIdioma,
  formatearDolares,
  nombrePlato,
  type RepartidorEnPedido,
  avisoLlegada,
  fotoSinConfirmar,
  lineaRepartidor,
} from '@tumbite/compartido';
import {
  Boton,
  C,
  CodigoQR,
  FotoPedido,
  MenuCuenta,
  Pantalla,
  TEXTOS_MOVIL,
  e,
  useSesion,
} from '@tumbite/movil';

type Pedido = {
  id: string;
  estado: string;
  total: number;
  subtotal: number;
  notas: string;
  creadoEn: string;
  tiempoPrepMin: number | null;
  fotoRecogida?: { tomadaEn: string; confirmadaEn: string | null } | null;
  repartidor?: RepartidorEnPedido | null;
  ajuste?: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    estado: 'pendiente' | 'quitado' | 'cancelado';
    devolucion: number | null;
    creadoEn: string;
  } | null;
  lineas: { platoId: string; nombreEs: string; nombreEn: string; cantidad: number }[];
};

const T = {
  es: {
    titulo: 'Pedidos',
    nuevos: 'Nuevos',
    preparando: 'Preparando',
    listos: 'Listos para recoger',
    camino: 'En camino',
    esperandoFoto: 'Esperando que el repartidor tome la foto del pedido en su app.',
    sinConfirmar: 'La foto lleva más de 2 minutos sin confirmar. El repartidor te está esperando.',
    faltaPlato: '¿Te falta un plato? Tócalo:',
    esperandoCliente:
      'Avisamos al cliente que no tienes «{plato}». Esperando su respuesta (máximo 5 minutos)…',
    quitado: 'El cliente quitó «{plato}». Prepara el resto.',
    masTiempo: '+5 min',
    qrAyuda:
      'Muéstrale este código al repartidor: lo escanea desde su app y así confirma que es su pedido.',
    verificado:
      'Código verificado por el repartidor. Cuando tome la foto de la bolsa, el pedido sale solo.',
    confirmarRecogida: 'Confirmar: se lo entregué al repartidor',
    ayudaConfirmar:
      'Foto que tomó el repartidor. Revisa que sea tu pedido y confirma: recién ahí sale en camino.',
    hechos: 'Hoy',
    aceptar: 'Aceptar',
    listo: '¡Listo!',
    minutos: 'min',
    rechazar: 'Rechazar pedido',
    confirmarRechazo: '¿Rechazar este pedido? Se le devuelve todo el dinero al cliente.',
    si: 'Sí, rechazar',
    no: 'No',
    mas: 'Más opciones',
    abierto: 'Recibiendo pedidos',
    cerrado: 'Cerrado',
    abrir: 'Abrir',
    pausar: 'Pausar',
    vacio: 'Sin pedidos por ahora. La alarma sonará cuando entre uno.',
    notas: 'Notas',
    pedido: 'Pedido',
    estados: { entregado: 'Entregado', cancelado: 'Cancelado' } as Record<string, string>,
    sinRest: 'Completa tu restaurante en tumbite.com/panel para empezar.',
    tiempo: '¿En cuánto estará listo?',
  },
  en: {
    titulo: 'Orders',
    nuevos: 'New',
    preparando: 'Preparing',
    listos: 'Ready for pickup',
    camino: 'On the way',
    esperandoFoto: 'Waiting for the driver to take a photo of the order in their app.',
    sinConfirmar: 'The photo has been waiting over 2 minutes. The driver is waiting on you.',
    faltaPlato: 'Out of an item? Tap it:',
    esperandoCliente:
      'We told the customer you’re out of “{plato}”. Waiting for their answer (up to 5 minutes)…',
    quitado: 'The customer removed “{plato}”. Prepare the rest.',
    masTiempo: '+5 min',
    qrAyuda:
      'Show this code to the driver: they scan it from their app to confirm it’s their order.',
    verificado:
      'Code verified by the driver. Once they photograph the bag, the order goes out on its own.',
    confirmarRecogida: 'Confirm: I handed it to the driver',
    ayudaConfirmar:
      'Photo taken by the driver. Check that it’s your order and confirm: only then does it go out.',
    hechos: 'Today',
    aceptar: 'Accept',
    listo: 'Ready!',
    minutos: 'min',
    rechazar: 'Reject order',
    confirmarRechazo: 'Reject this order? The customer gets a full refund.',
    si: 'Yes, reject',
    no: 'No',
    mas: 'More options',
    abierto: 'Taking orders',
    cerrado: 'Closed',
    abrir: 'Open',
    pausar: 'Pause',
    vacio: 'No orders right now. The alarm will ring when one comes in.',
    notas: 'Notes',
    pedido: 'Order',
    estados: { entregado: 'Delivered', cancelado: 'Canceled' } as Record<string, string>,
    sinRest: 'Set up your restaurant at tumbite.com/panel to get started.',
    tiempo: 'Ready in how long?',
  },
};

const TIEMPOS = [10, 15, 20, 30, 45];

function confirmar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, style: 'destructive', onPress: () => r(true) },
    ]),
  );
}

export function Inicio() {
  useKeepAwake(); // La tablet del mostrador no se apaga mientras la app está abierta.
  const { api, idioma, salir } = useSesion();
  const t = enIdioma(T, idioma);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const alarma = useAudioPlayer(sonidoAlarma);
  const estadoAlarma = useAudioPlayerStatus(alarma);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [rest, setRest] = useState<Restaurante | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [menuDe, setMenuDe] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        api.pedir<{ pedidos: Pedido[] }>('GET', '/datos/restaurante/pedidos'),
        api.pedir<{ restaurante: Restaurante | null }>('GET', '/datos/mi-restaurante'),
      ]);
      setPedidos(p.pedidos);
      setRest(r.restaurante);
      setError('');
    } catch (x) {
      if (x instanceof ErrorApi && x.estado === 404) setRest(null);
      else setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }, [api]);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
    const primero = setTimeout(() => void cargar(), 0);
    const reloj = setInterval(() => void cargar(), 5000);
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
    };
  }, [cargar]);

  const nuevos = pedidos.filter((p) => p.estado === 'pagado');
  // La alarma suena sin parar mientras haya un pedido sin aceptar.
  // …y también mientras una foto del repartidor lleve más de 2 minutos sin confirmar (amarillo).
  const hayNuevos =
    nuevos.some((p) => p.ajuste?.estado !== 'pendiente') ||
    pedidos.some((p) => fotoSinConfirmar(p));
  useEffect(() => {
    if (hayNuevos) alarma.play();
    else alarma.pause();
  }, [hayNuevos, alarma]);
  useEffect(() => {
    // Al terminar el sonido, vuelve a empezar mientras siga habiendo pedidos sin aceptar.
    if (estadoAlarma.didJustFinish && hayNuevos) {
      void alarma.seekTo(0).then(() => alarma.play());
    }
  }, [estadoAlarma.didJustFinish, hayNuevos, alarma]);
  // Un toque de alarma, una sola vez por pedido, cuando el repartidor está a 5 minutos y al llegar.
  const avisados = useRef(new Set<string>());
  useEffect(() => {
    for (const p of pedidos) {
      const aviso = avisoLlegada(p.repartidor);
      if (!aviso) continue;
      const clave = `${p.id}:${aviso}`;
      if (avisados.current.has(clave)) continue;
      avisados.current.add(clave);
      if (!hayNuevos) void alarma.seekTo(0).then(() => alarma.play());
    }
  }, [pedidos, hayNuevos, alarma]);

  async function accion(ruta: string, cuerpo: unknown = {}) {
    setError('');
    try {
      await api.pedir('POST', ruta, cuerpo);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function alternarAbierto() {
    if (!rest) return;
    try {
      await api.pedir('PATCH', '/datos/mi-restaurante/abierto', { abierto: !rest.abierto });
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function rechazar(p: Pedido) {
    setMenuDe(null);
    if (await confirmar(t.confirmarRechazo, t.si, t.no))
      await accion(`/datos/restaurante/pedidos/${p.id}/rechazar`);
  }

  if (rest === null) {
    return (
      <Pantalla titulo={t.titulo}>
        <Text style={e.tarjeta}>{t.sinRest}</Text>
        <Boton texto={tm.salir} alTocar={() => void salir()} secundario />
      </Pantalla>
    );
  }

  const tarjeta = (p: Pedido, botones: React.ReactNode, resaltar = false) => (
    <View
      key={p.id}
      style={[
        e.tarjeta,
        resaltar && { borderWidth: 3, borderColor: C.primario },
        fotoSinConfirmar(p) && {
          borderWidth: 3,
          borderColor: '#E0A000',
          backgroundColor: '#FFF8E1',
        },
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>
          {t.pedido} #{p.id.slice(0, 4).toUpperCase()}
        </Text>
        <Text style={{ fontWeight: '700' }}>{formatearDolares(p.subtotal, idioma)}</Text>
      </View>
      {p.lineas.map((l) => (
        <Text key={l.platoId} style={{ fontSize: 17, marginTop: 4 }}>
          {l.cantidad} × {nombrePlato(l, idioma)}
        </Text>
      ))}
      {p.notas ? (
        <Text style={{ marginTop: 6, color: '#5E5E5E' }}>
          {t.notas}: {p.notas}
        </Text>
      ) : null}
      {p.ajuste?.estado === 'pendiente' ? (
        <Text
          style={{ marginTop: 6, color: '#B26A00', fontWeight: '800' }}
          accessibilityRole="alert"
        >
          {t.esperandoCliente.replace(
            '{plato}',
            idioma === 'en' ? p.ajuste.nombreEn || p.ajuste.nombreEs : p.ajuste.nombreEs,
          )}
        </Text>
      ) : null}
      {p.ajuste?.estado === 'quitado' && p.estado === 'pagado' ? (
        <Text style={{ marginTop: 6, color: C.exito, fontWeight: '800' }}>
          {t.quitado.replace(
            '{plato}',
            idioma === 'en' ? p.ajuste.nombreEn || p.ajuste.nombreEs : p.ajuste.nombreEs,
          )}
        </Text>
      ) : null}
      {(p.estado === 'pagado' || p.estado === 'aceptado') && !p.repartidor && !p.ajuste ? (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.faltaPlato}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {p.lineas.map((l) => (
              <Pressable
                key={l.platoId}
                onPress={() =>
                  void accion(`/datos/restaurante/pedidos/${p.id}/falta`, { platoId: l.platoId })
                }
                accessibilityRole="button"
                accessibilityLabel={`${t.faltaPlato} ${nombrePlato(l, idioma)}`}
                style={{
                  borderWidth: 1,
                  borderColor: '#D6D6D6',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 13 }}>{nombrePlato(l, idioma)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {lineaRepartidor(p.repartidor, idioma) ? (
        <Text style={{ marginTop: 6, color: C.exito, fontWeight: '800' }}>
          {lineaRepartidor(p.repartidor, idioma)}
        </Text>
      ) : null}
      {fotoSinConfirmar(p) ? (
        <Text
          style={{ marginTop: 4, color: '#B26A00', fontWeight: '800' }}
          accessibilityRole="alert"
        >
          {t.sinConfirmar}
        </Text>
      ) : null}
      <View style={{ marginTop: 10, gap: 8 }}>{botones}</View>
      {(p.estado === 'pagado' || p.estado === 'aceptado') && (
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable
            onPress={() => setMenuDe(menuDe === p.id ? null : p.id)}
            accessibilityRole="button"
            accessibilityLabel={t.mas}
            style={{ padding: 8 }}
          >
            <Text style={{ fontSize: 22 }}>⋮</Text>
          </Pressable>
          {menuDe === p.id && (
            <Pressable
              onPress={() => void rechazar(p)}
              accessibilityRole="button"
              style={{ padding: 10 }}
            >
              <Text style={{ color: '#c4001d', fontWeight: '700' }}>{t.rechazar}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  const seccion = (
    titulo: string,
    lista: Pedido[],
    botones: (p: Pedido) => React.ReactNode,
    resaltar = false,
  ) =>
    lista.length ? (
      <View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: C.secundario, marginVertical: 8 }}>
          {titulo} ({lista.length})
        </Text>
        {lista.map((p) => tarjeta(p, botones(p), resaltar))}
      </View>
    ) : null;

  return (
    <Pantalla titulo={rest?.nombre ?? t.titulo}>
      {rest && (
        <View
          style={[
            e.tarjeta,
            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
          ]}
        >
          <Text style={{ fontWeight: '800', color: rest.abierto ? '#0d7a3a' : '#8a0014' }}>
            {rest.abierto ? t.abierto : t.cerrado}
          </Text>
          <Pressable
            onPress={() => void alternarAbierto()}
            accessibilityRole="button"
            style={{
              backgroundColor: rest.abierto ? '#fff' : C.primario,
              borderWidth: 1,
              borderColor: '#D6D6D6',
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontWeight: '700', color: rest.abierto ? C.secundario : '#fff' }}>
              {rest.abierto ? t.pausar : t.abrir}
            </Text>
          </Pressable>
        </View>
      )}
      {error ? <Text style={e.error}>{error}</Text> : null}
      {pedidos.length === 0 && <Text style={e.tarjeta}>{t.vacio}</Text>}
      {seccion(
        t.nuevos,
        nuevos,
        (p) =>
          p.ajuste?.estado === 'pendiente' ? null : (
            <>
              <Text style={{ fontWeight: '700' }}>{t.tiempo}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {TIEMPOS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() =>
                      void accion(`/datos/restaurante/pedidos/${p.id}/aceptar`, { minutos: m })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${t.aceptar} ${m} ${t.minutos}`}
                    style={{
                      backgroundColor: C.primario,
                      borderRadius: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                      {t.aceptar} · {m} {t.minutos}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ),
        true,
      )}
      {seccion(
        t.preparando,
        pedidos.filter((p) => p.estado === 'aceptado'),
        (p) => (
          <>
            <Boton
              texto={t.listo}
              alTocar={() => void accion(`/datos/restaurante/pedidos/${p.id}/listo`)}
            />
            {!p.repartidor ? (
              <Boton
                texto={t.masTiempo}
                alTocar={() =>
                  void api
                    .pedir('PATCH', `/datos/restaurante/pedidos/${p.id}/tiempo`, {
                      minutos: Math.min(120, (p.tiempoPrepMin ?? 20) + 5),
                    })
                    .then(() => cargar())
                    .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
                }
                secundario
              />
            ) : null}
          </>
        ),
      )}
      {seccion(
        t.listos,
        pedidos.filter((p) => p.estado === 'listo'),
        (p) =>
          p.fotoRecogida ? (
            <>
              <CodigoQR texto={`tumbite:pedido:${p.id}`} numero={p.id.slice(0, 4).toUpperCase()} />
              <FotoPedido
                pedidoId={p.id}
                tipo="recogida"
                version={p.fotoRecogida.tomadaEn}
                pie={t.ayudaConfirmar}
              />
              <Boton
                texto={t.confirmarRecogida}
                alTocar={() => void accion(`/datos/restaurante/pedidos/${p.id}/confirmar-recogida`)}
                exito
              />
            </>
          ) : (
            <>
              <CodigoQR texto={`tumbite:pedido:${p.id}`} numero={p.id.slice(0, 4).toUpperCase()} />
              <Text style={{ color: '#5E5E5E', marginTop: 6 }}>
                {p.repartidor?.verificado ? t.verificado : t.qrAyuda}
              </Text>
            </>
          ),
        true,
      )}
      {seccion(
        t.camino,
        pedidos.filter((p) => p.estado === 'en_camino'),
        () => null,
      )}
      {seccion(
        t.hechos,
        pedidos.filter((p) => p.estado === 'entregado' || p.estado === 'cancelado'),
        (p) => (
          <Text style={{ color: '#5E5E5E' }}>{t.estados[p.estado]}</Text>
        ),
      )}
      <Boton texto={tm.salir} alTocar={() => void salir()} secundario />
      <MenuCuenta />
    </Pantalla>
  );
}
