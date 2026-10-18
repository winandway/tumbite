import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import sonidoAlarma from '../assets/sonidos/alarma.wav';
import { useKeepAwake } from 'expo-keep-awake';
import {
  ErrorApi,
  type Restaurante,
  enIdioma,
  formatearDolares,
  type RepartidorEnPedido,
  avisoLlegada,
  fotoSinConfirmar,
  lineaRepartidor,
  textoLinea,
  type OpcionElegida,
  type Plato,
  textoActivacion,
  OPCIONES_COCINA_OCUPADA,
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
  urlFoto,
  useSesion,
} from '@tumbite/movil';
import { Estadisticas } from './Estadisticas';
import { MiMenu } from './MiMenu';
import type { Pestana } from './piezas/recursos';
import { textosRest } from './piezas/textos';
import {
  BarraInferior,
  BotonGrande,
  Cabecera,
  CabeceraInterna,
  Insignia,
  Pasos,
  Pildora,
  Tarjeta,
} from './piezas/ui';

type Pedido = {
  id: string;
  estado: string;
  entrega?: 'puerta' | 'mano' | 'recoger';
  requiereEdad?: boolean;
  total: number;
  subtotal: number;
  notas: string;
  creadoEn: string;
  aceptadoEn?: string | null;
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
  lineas: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    precioCentavos?: number;
    opciones?: OpcionElegida[];
  }[];
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
    fueraHorario: 'Abierto, fuera de horario',
    cerrado: 'Cerrado',
    activacion: 'Para abrir te falta:',
    recoge: 'El cliente lo recoge en el local (sin repartidor)',
    pinCliente: 'PIN del cliente (4 dígitos, está en su app)',
    mayorEdad: 'Revisé el documento: mayor de 21',
    entregadoLocal: 'Entregado al cliente',
    abrir: 'Abrir',
    pausar: 'Pausar',
    vacio: 'Sin pedidos por ahora. La alarma sonará cuando entre uno.',
    notas: 'Notas',
    pedido: 'Pedido',
    estados: { entregado: 'Entregado', cancelado: 'Cancelado' } as Record<string, string>,
    sinRest: 'Completa tu restaurante en tumbite.com/panel para empezar.',
    tiempo: '¿En cuánto estará listo?',
    sugerido: 'sugerido',
    cocina: 'Cocina ocupada',
    cocinaAyuda: 'Suma minutos al tiempo sugerido de los pedidos nuevos.',
    normal: 'Normal',
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
    fueraHorario: 'Open, outside hours',
    cerrado: 'Closed',
    activacion: 'To open, you still need:',
    recoge: 'Customer picks up in store (no driver)',
    pinCliente: 'Customer PIN (4 digits, in their app)',
    mayorEdad: 'I checked the ID: 21 or older',
    entregadoLocal: 'Handed to the customer',
    abrir: 'Open',
    pausar: 'Pause',
    vacio: 'No orders right now. The alarm will ring when one comes in.',
    notas: 'Notes',
    pedido: 'Order',
    estados: { entregado: 'Delivered', cancelado: 'Canceled' } as Record<string, string>,
    sinRest: 'Set up your restaurant at tumbite.com/panel to get started.',
    tiempo: 'Ready in how long?',
    sugerido: 'suggested',
    cocina: 'Busy kitchen',
    cocinaAyuda: 'Adds minutes to the suggested time for new orders.',
    normal: 'Normal',
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
  const { api, idioma, salir, cambiarIdioma } = useSesion();
  const t = enIdioma(T, idioma);
  const tr = textosRest(idioma);
  const { width } = useWindowDimensions();
  const ancha = width >= 768;
  const [vista, setVista] = useState<Pestana>('inicio');
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'preparando' | 'listos' | 'completados'>('todos');
  const [platos, setPlatos] = useState<Plato[]>([]);
  // Minutos elegidos para aceptar cada pedido nuevo (por defecto, el sugerido).
  const [elegido, setElegido] = useState<Record<string, number>>({});
  const [faltaDe, setFaltaDe] = useState<string | null>(null);
  // Reloj de la pantalla: los tiempos de espera y de cocina avanzan cada segundo.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const r = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(r);
  }, []);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const alarma = useAudioPlayer(sonidoAlarma);
  const estadoAlarma = useAudioPlayerStatus(alarma);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cocina, setCocina] = useState({ prepSugerida: 20, cocinaOcupada: 0 });
  const [rest, setRest] = useState<Restaurante | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [menuDe, setMenuDe] = useState<string | null>(null);
  const [pinLocal, setPinLocal] = useState('');
  const [edadLocal, setEdadLocal] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        api.pedir<{ pedidos: Pedido[]; prepSugerida: number; cocinaOcupada: number }>(
          'GET',
          '/datos/restaurante/pedidos',
        ),
        api.pedir<{ restaurante: Restaurante | null; platos?: Plato[] }>(
          'GET',
          '/datos/mi-restaurante',
        ),
      ]);
      setPlatos(r.platos ?? []);
      setPedidos(p.pedidos);
      setCocina({ prepSugerida: p.prepSugerida, cocinaOcupada: p.cocinaOcupada });
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

  // ---------- Ayudas de presentación (los datos y las acciones son los de siempre) ----------
  const numero = (p: Pedido) => `#${p.id.slice(0, 4).toUpperCase()}`;
  const fotoDe = (p: Pedido) => {
    const id = p.lineas[0]?.platoId;
    return urlFoto(platos.find((x) => x.id === id)?.imagen ?? null);
  };
  const reloj = (seg: number) => {
    const s = Math.max(0, Math.floor(Math.abs(seg)));
    return `${seg < 0 ? '-' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const segundosDesde = (iso?: string | null) =>
    iso ? (ahora - new Date(`${iso.endsWith('Z') ? iso : `${iso}Z`}`).getTime()) / 1000 : 0;
  const nombreAjuste = (p: Pedido) =>
    idioma === 'en' ? p.ajuste?.nombreEn || p.ajuste?.nombreEs || '' : (p.ajuste?.nombreEs ?? '');
  const PASO = new Map([
    ['pagado', 0],
    ['aceptado', 1],
    ['listo', 2],
    ['en_camino', 3],
    ['entregado', 3],
  ]);
  const enCocina = pedidos.filter((p) => ['aceptado', 'listo', 'en_camino'].includes(p.estado));
  const hoyHechos = pedidos.filter((p) => p.estado === 'entregado').length;
  const detalle = detalleId ? pedidos.find((p) => p.id === detalleId) : undefined;

  const foto = (p: Pedido, lado = 64) => {
    const f = fotoDe(p);
    return f ? (
      <Image
        source={{ uri: f }}
        style={{ width: lado, height: lado, borderRadius: 12, backgroundColor: '#f1f1f1' }}
        accessibilityIgnoresInvertColors
      />
    ) : null;
  };

  /** Líneas, notas, faltantes y repartidor: lo mismo que antes, con el diseño nuevo. */
  const cuerpoPedido = (p: Pedido) => (
    <>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {foto(p)}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '900', fontSize: 18, color: C.secundario }}>
              {numero(p)}
            </Text>
            <Text style={{ fontWeight: '900', fontSize: 18, color: C.secundario }}>
              {formatearDolares(p.subtotal, idioma)}
            </Text>
          </View>
          {p.lineas.map((l) => (
            <Text
              key={`${l.platoId}-${textoLinea(l, idioma)}`}
              style={{ fontSize: 16, marginTop: 3, color: C.secundario }}
            >
              {l.cantidad} × {textoLinea(l, idioma)}
            </Text>
          ))}
        </View>
      </View>
      {p.notas ? (
        <Text style={{ marginTop: 8, color: '#5E5E5E' }}>
          {t.notas}: {p.notas}
        </Text>
      ) : null}
      {p.ajuste?.estado === 'pendiente' ? (
        <Text
          style={{ marginTop: 8, color: '#B26A00', fontWeight: '800' }}
          accessibilityRole="alert"
        >
          {t.esperandoCliente.replace('{plato}', nombreAjuste(p))}
        </Text>
      ) : null}
      {p.ajuste?.estado === 'quitado' && p.estado === 'pagado' ? (
        <Text style={{ marginTop: 8, color: C.exito, fontWeight: '800' }}>
          {t.quitado.replace('{plato}', nombreAjuste(p))}
        </Text>
      ) : null}
      {(p.estado === 'pagado' || p.estado === 'aceptado') && !p.repartidor && !p.ajuste ? (
        <View style={{ marginTop: 10 }}>
          <Pressable
            onPress={() => setFaltaDe(faltaDe === p.id ? null : p.id)}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              backgroundColor: '#F7F8FA',
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
            }}
          >
            <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{tr.faltaProducto}</Text>
            <Text style={{ color: '#5E5E5E' }}>{faltaDe === p.id ? '▾' : '›'}</Text>
          </Pressable>
          {faltaDe === p.id ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {p.lineas.map((l) => (
                <Pressable
                  key={l.platoId}
                  onPress={() =>
                    void accion(`/datos/restaurante/pedidos/${p.id}/falta`, { platoId: l.platoId })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${t.faltaPlato} ${textoLinea(l, idioma)}`}
                  style={{
                    borderWidth: 1,
                    borderColor: '#D6D6D6',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{textoLinea(l, idioma)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {lineaRepartidor(p.repartidor, idioma) ? (
        <Text style={{ marginTop: 8, color: C.exito, fontWeight: '800' }}>
          {lineaRepartidor(p.repartidor, idioma)}
        </Text>
      ) : null}
      {fotoSinConfirmar(p) ? (
        <Text
          style={{ marginTop: 6, color: '#B26A00', fontWeight: '800' }}
          accessibilityRole="alert"
        >
          {t.sinConfirmar}
        </Text>
      ) : null}
    </>
  );

  /** Tres puntos con «Rechazar pedido», solo mientras se puede (como antes). */
  const tresPuntos = (p: Pedido) =>
    p.estado === 'pagado' || p.estado === 'aceptado' ? (
      <View>
        <Pressable
          onPress={() => setMenuDe(menuDe === p.id ? null : p.id)}
          accessibilityRole="button"
          accessibilityLabel={t.mas}
          hitSlop={8}
          style={{ padding: 8 }}
        >
          <Text style={{ fontSize: 22, color: C.secundario }}>⋮</Text>
        </Pressable>
        {menuDe === p.id && (
          <Pressable
            onPress={() => void rechazar(p)}
            accessibilityRole="button"
            style={{
              position: 'absolute',
              right: 0,
              top: 40,
              backgroundColor: '#fff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E5E5E5',
              paddingHorizontal: 16,
              paddingVertical: 12,
              zIndex: 10,
              minWidth: 170,
            }}
          >
            <Text style={{ color: '#B3261E', fontWeight: '700' }}>{t.rechazar}</Text>
          </Pressable>
        )}
      </View>
    ) : null;

  /** Elegir el tiempo y aceptar: el sugerido viene marcado en verde. */
  const aceptarBloque = (p: Pedido) => {
    if (p.ajuste?.estado === 'pendiente') return null;
    const opciones = [
      cocina.prepSugerida,
      ...TIEMPOS.filter((m) => m !== cocina.prepSugerida),
    ].sort((a, b) => a - b);
    const m = elegido[p.id] ?? cocina.prepSugerida;
    return (
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '800', color: C.secundario, marginBottom: 8 }}>
          {tr.tiempoPrep}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {opciones.map((x) => (
            <Pildora
              key={x}
              texto={`${x} ${t.minutos}`}
              activa={x === m}
              verde
              etiqueta={`${tr.tiempoPrep}: ${x} ${t.minutos}${x === cocina.prepSugerida ? ` · ${t.sugerido}` : ''}`}
              alTocar={() => setElegido((v) => ({ ...v, [p.id]: x }))}
            />
          ))}
        </View>
        <BotonGrande
          texto={`${tr.aceptarPedido} · ${m} ${t.minutos}`}
          etiqueta={`${t.aceptar} · ${m} ${t.minutos}${m === cocina.prepSugerida ? ` · ${t.sugerido}` : ''}`}
          alTocar={() => void accion(`/datos/restaurante/pedidos/${p.id}/aceptar`, { minutos: m })}
        />
      </View>
    );
  };

  // ---------- Inicio ----------
  const tarjetaRestaurante = rest ? (
    <View
      style={{
        backgroundColor: C.secundario,
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {urlFoto(rest.imagen) ? (
        <Image
          source={{ uri: urlFoto(rest.imagen) ?? undefined }}
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#333' }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }} numberOfLines={1}>
          {rest.nombre}
        </Text>
        {rest.categoria ? (
          <Text style={{ color: '#CFCFCF', marginTop: 2 }}>{rest.categoria}</Text>
        ) : null}
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: 6,
            // F13: verde solo si DE VERDAD recibe pedidos (abierto, en horario y con señal).
            backgroundColor: rest.abierto && rest.abiertoAhora ? C.exito : '#5E5E5E',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
            {rest.abierto ? (rest.abiertoAhora ? t.abierto : t.fueraHorario) : t.cerrado}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => void alternarAbierto()}
        accessibilityRole="button"
        style={{
          backgroundColor: rest.abierto ? '#fff' : C.primario,
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 10,
        }}
      >
        <Text style={{ fontWeight: '800', color: rest.abierto ? C.secundario : '#fff' }}>
          {rest.abierto ? t.pausar : t.abrir}
        </Text>
      </Pressable>
    </View>
  ) : null;

  const contadores = (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
      {(
        [
          [nuevos.length, tr.contadores.nuevos, C.primario],
          [
            pedidos.filter((p) => p.estado === 'aceptado').length,
            tr.contadores.preparando,
            C.secundario,
          ],
          [hoyHechos, tr.contadores.hoy, C.exito],
        ] as const
      ).map(([n, nombre, color]) => (
        <Tarjeta
          key={nombre}
          style={{ flex: 1, marginBottom: 0, alignItems: 'center', paddingVertical: 12 }}
        >
          <Text style={{ fontSize: 28, fontWeight: '900', color }}>{n}</Text>
          <Text style={{ color: '#5E5E5E', fontSize: 12, textAlign: 'center' }}>{nombre}</Text>
        </Tarjeta>
      ))}
    </View>
  );

  const avisosRest = (
    <>
      {rest?.activacion && !rest.activacion.lista ? (
        <Tarjeta>
          <Text style={{ fontWeight: '800' }}>{t.activacion}</Text>
          {rest.activacion.items
            .filter((i) => !i.listo && i.obligatorio)
            .map((i) => (
              <Text key={i.clave}>○ {textoActivacion(i.clave, idioma)}</Text>
            ))}
        </Tarjeta>
      ) : null}
      {rest ? (
        <Tarjeta>
          <Text style={{ fontWeight: '800' }}>{t.cocina}</Text>
          <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.cocinaAyuda}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {OPCIONES_COCINA_OCUPADA.map((min) => (
              <Pildora
                key={min}
                texto={min ? `+${min} ${t.minutos}` : t.normal}
                etiqueta={`${t.cocina}: ${min ? `+${min} ${t.minutos}` : t.normal}`}
                activa={cocina.cocinaOcupada === min}
                alTocar={() =>
                  void api
                    .pedir<{ prepSugerida: number; cocinaOcupada: number }>(
                      'PATCH',
                      '/datos/restaurante/cocina',
                      {
                        extraMin: min,
                      },
                    )
                    .then(setCocina)
                    .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
                }
              />
            ))}
          </View>
        </Tarjeta>
      ) : null}
    </>
  );

  const columnaNuevos = (
    <View style={{ flex: 1 }}>
      {tarjetaRestaurante}
      {contadores}
      {nuevos.length ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginVertical: 6,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>
            {tr.nuevoPedido} ({nuevos.length})
          </Text>
          <View
            style={{
              backgroundColor: C.primario,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>
              {reloj(segundosDesde(nuevos[nuevos.length - 1]?.creadoEn))}
            </Text>
          </View>
        </View>
      ) : null}
      {nuevos.map((p) => (
        <Tarjeta key={p.id} style={{ borderWidth: 2, borderColor: C.primario }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>{cuerpoPedido(p)}</View>
            {tresPuntos(p)}
          </View>
          {aceptarBloque(p)}
        </Tarjeta>
      ))}
      {pedidos.length === 0 ? (
        <Tarjeta>
          <Text>{t.vacio}</Text>
        </Tarjeta>
      ) : null}
      {/* En la tableta, los avisos y la cocina ocupada van en la columna derecha. */}
      {ancha ? null : avisosRest}
    </View>
  );

  const filaPedido = (p: Pedido) => (
    <Pressable
      key={p.id}
      onPress={() => setDetalleId(p.id)}
      accessibilityRole="button"
      accessibilityLabel={`${tr.pedido} ${numero(p)}`}
    >
      <Tarjeta
        style={[
          { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10 },
          fotoSinConfirmar(p) && {
            borderWidth: 3,
            borderColor: '#E0A000',
            backgroundColor: '#FFF8E1',
          },
        ]}
      >
        {foto(p, 56)}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '900', fontSize: 16, color: C.secundario }}>
              {numero(p)}
            </Text>
            <Text style={{ fontWeight: '800', color: C.secundario }}>
              {formatearDolares(p.subtotal, idioma)}
            </Text>
          </View>
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
            {new Date(p.creadoEn.endsWith('Z') ? p.creadoEn : `${p.creadoEn}Z`).toLocaleTimeString(
              idioma === 'en' ? 'en-US' : 'es-US',
              { hour: 'numeric', minute: '2-digit' },
            )}
          </Text>
          <Text style={{ color: C.secundario, fontSize: 13 }} numberOfLines={2}>
            {p.lineas.map((l) => `${l.cantidad} × ${textoLinea(l, idioma)}`).join(', ')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <Insignia estado={p.estado} texto={tr.insignia[p.estado] ?? p.estado} />
            {p.estado === 'aceptado' && p.tiempoPrepMin ? (
              <Text style={{ fontWeight: '800', color: C.secundario }}>
                {reloj(p.tiempoPrepMin * 60 - segundosDesde(p.aceptadoEn ?? p.creadoEn))}
              </Text>
            ) : null}
          </View>
        </View>
      </Tarjeta>
    </Pressable>
  );

  const columnaCocina = enCocina.length ? (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: C.secundario, marginVertical: 8 }}>
        {tr.enCocina} ({enCocina.length})
      </Text>
      {enCocina.map(filaPedido)}
    </View>
  ) : null;

  // ---------- Detalle del pedido (en preparación, listo, recogido) ----------
  const vistaDetalle = (p: Pedido) => {
    const paso = PASO.get(p.estado) ?? -1;
    const total = (p.tiempoPrepMin ?? 0) * 60;
    const pasado = segundosDesde(p.aceptadoEn ?? p.creadoEn);
    const resta = total - pasado;
    return (
      <View>
        {p.estado !== 'cancelado' ? <Pasos nombres={tr.pasos} paso={paso} /> : null}
        {p.estado === 'aceptado' && total > 0 ? (
          <Tarjeta>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#5E5E5E' }}>{tr.transcurrido}</Text>
                <Text style={{ fontSize: 34, fontWeight: '900', color: C.secundario }}>
                  {reloj(pasado)}{' '}
                  <Text style={{ fontSize: 13, fontWeight: '500', color: '#5E5E5E' }}>
                    {tr.de} {p.tiempoPrepMin} {t.minutos}
                  </Text>
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#5E5E5E' }}>{tr.restante}</Text>
                <Text
                  style={{
                    fontSize: 34,
                    fontWeight: '900',
                    color: resta < 0 ? '#B3261E' : C.exito,
                  }}
                >
                  {reloj(resta)}
                </Text>
              </View>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#F2F3F5', marginTop: 10 }}>
              <View
                style={{
                  width: `${Math.min(100, Math.round((pasado / total) * 100))}%`,
                  height: 8,
                  borderRadius: 4,
                  // Avance en verde; si se pasó del tiempo prometido, en rojo (es un problema).
                  backgroundColor: resta < 0 ? '#B3261E' : C.exito,
                }}
              />
            </View>
          </Tarjeta>
        ) : null}
        {p.estado === 'listo' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: '#E8F5EE',
              borderRadius: 16,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: C.exito,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>✓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.exito, fontWeight: '900', fontSize: 17 }}>
                {p.entrega === 'recoger' ? t.recoge : tr.listoParaRecoger}
              </Text>
              {p.entrega !== 'recoger' ? (
                <Text style={{ color: '#3E5E4A', marginTop: 2 }}>
                  {p.repartidor?.verificado ? t.verificado : t.qrAyuda}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {p.estado === 'listo' && p.entrega !== 'recoger' ? (
          <Tarjeta style={{ alignItems: 'center' }}>
            <CodigoQR texto={`tumbite:pedido:${p.id}`} numero={p.id.slice(0, 4).toUpperCase()} />
          </Tarjeta>
        ) : null}
        <Tarjeta>{cuerpoPedido(p)}</Tarjeta>
        {p.estado === 'pagado' ? <Tarjeta>{aceptarBloque(p)}</Tarjeta> : null}
        {p.estado === 'aceptado' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {!p.repartidor ? (
              <BotonGrande
                texto={t.masTiempo}
                tipo="borde"
                flex={1}
                alTocar={() =>
                  void api
                    .pedir('PATCH', `/datos/restaurante/pedidos/${p.id}/tiempo`, {
                      minutos: Math.min(120, (p.tiempoPrepMin ?? 20) + 5),
                    })
                    .then(() => cargar())
                    .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
                }
              />
            ) : null}
            <BotonGrande
              texto={tr.marcarListo}
              etiqueta={t.listo}
              flex={2}
              alTocar={() => void accion(`/datos/restaurante/pedidos/${p.id}/listo`)}
            />
          </View>
        ) : null}
        {p.estado === 'listo' && p.entrega === 'recoger' ? (
          <Tarjeta>
            <TextInput
              value={pinLocal}
              onChangeText={(x) => setPinLocal(x.replace(/\D/g, '').slice(0, 4))}
              placeholder={t.pinCliente}
              accessibilityLabel={t.pinCliente}
              keyboardType="number-pad"
              style={[e.input, { letterSpacing: 6, fontSize: 20 }]}
            />
            {p.requiereEdad ? (
              <Pressable
                onPress={() => setEdadLocal((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: edadLocal }}
                accessibilityLabel={t.mayorEdad}
                style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}
              >
                <Switch
                  value={edadLocal}
                  onValueChange={setEdadLocal}
                  accessibilityLabel={t.mayorEdad}
                />
                <Text style={{ fontWeight: '700' }}>{t.mayorEdad}</Text>
              </Pressable>
            ) : null}
            <BotonGrande
              texto={t.entregadoLocal}
              tipo="verde"
              alTocar={() =>
                void accion(`/datos/restaurante/pedidos/${p.id}/entregado-local`, {
                  pin: pinLocal,
                  mayorEdad: edadLocal,
                }).then(() => setPinLocal(''))
              }
            />
          </Tarjeta>
        ) : null}
        {p.estado === 'listo' && p.entrega !== 'recoger' && p.fotoRecogida ? (
          <Tarjeta>
            <FotoPedido
              pedidoId={p.id}
              tipo="recogida"
              version={p.fotoRecogida.tomadaEn}
              pie={t.ayudaConfirmar}
            />
            <BotonGrande
              texto={tr.marcarRecogido}
              etiqueta={t.confirmarRecogida}
              tipo="verde"
              alTocar={() => void accion(`/datos/restaurante/pedidos/${p.id}/confirmar-recogida`)}
            />
          </Tarjeta>
        ) : null}
        {p.estado === 'listo' && p.entrega !== 'recoger' && !p.fotoRecogida ? (
          <Text style={{ color: '#5E5E5E', textAlign: 'center', marginBottom: 8 }}>
            {t.esperandoFoto}
          </Text>
        ) : null}
        {p.estado === 'en_camino' ? (
          <Text
            style={{ color: C.exito, fontWeight: '800', textAlign: 'center', marginVertical: 8 }}
          >
            {t.camino}
          </Text>
        ) : null}
        {t.estados[p.estado] ? (
          <Text style={{ color: '#5E5E5E', textAlign: 'center', marginVertical: 8 }}>
            {t.estados[p.estado]}
          </Text>
        ) : null}
        <BotonGrande texto={tr.volver} tipo="claro" alTocar={() => setDetalleId(null)} />
      </View>
    );
  };

  // ---------- Pedidos (historial de las últimas 24 horas) ----------
  const GRUPO = new Map<typeof filtro, (p: Pedido) => boolean>([
    ['todos', () => true],
    ['preparando', (p) => p.estado === 'pagado' || p.estado === 'aceptado'],
    ['listos', (p) => p.estado === 'listo' || p.estado === 'en_camino'],
    ['completados', (p) => p.estado === 'entregado' || p.estado === 'cancelado'],
  ]);
  const vistaPedidos = (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        {(
          [
            ['todos', tr.filtros.todos],
            ['preparando', tr.filtros.preparando],
            ['listos', tr.filtros.listos],
            ['completados', tr.filtros.completados],
          ] as const
        ).map(([f, nombre]) => (
          <Pildora key={f} texto={nombre} activa={filtro === f} alTocar={() => setFiltro(f)} />
        ))}
      </View>
      <Text style={{ color: '#5E5E5E', fontSize: 12, marginBottom: 10 }}>{tr.historialAyuda}</Text>
      {pedidos.filter(GRUPO.get(filtro) ?? (() => true)).map(filaPedido)}
      {pedidos.length === 0 ? <Text style={{ color: '#5E5E5E' }}>{tr.sinPedidos}</Text> : null}
    </View>
  );

  // ---------- Más ----------
  const vistaMas = (
    <View>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 22, fontWeight: '900', color: C.secundario, marginBottom: 12 }}
      >
        {tr.mas}
      </Text>
      <BotonGrande texto={tm.salir} tipo="claro" alTocar={() => void salir()} />
      <View style={{ marginTop: 12 }}>
        <MenuCuenta />
      </View>
    </View>
  );

  const cuerpo = detalle ? (
    vistaDetalle(detalle)
  ) : vista === 'pedidos' ? (
    vistaPedidos
  ) : vista === 'menu' ? (
    <MiMenu platos={platos} recargar={cargar} />
  ) : vista === 'estadisticas' ? (
    <Estadisticas />
  ) : vista === 'mas' ? (
    vistaMas
  ) : ancha ? (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      {columnaNuevos}
      <View style={{ flex: 1 }}>
        {columnaCocina}
        {avisosRest}
      </View>
    </View>
  ) : (
    <>
      {columnaNuevos}
      {columnaCocina}
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8FA' }} edges={['top', 'left', 'right']}>
      {detalle ? (
        <CabeceraInterna
          titulo={`${tr.pedido} ${numero(detalle)}`}
          alVolver={() => setDetalleId(null)}
          etiquetaVolver={tr.volver}
          derecha={tresPuntos(detalle)}
        />
      ) : (
        <Cabecera idioma={idioma} cambiarIdioma={cambiarIdioma} />
      )}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: ancha && !detalle && vista === 'inicio' ? 1200 : 720,
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {cuerpo}
      </ScrollView>
      <BarraInferior
        idioma={idioma}
        activa={vista}
        aviso={nuevos.length}
        alTocar={(p) => {
          setDetalleId(null);
          setVista(p);
        }}
      />
    </SafeAreaView>
  );
}
