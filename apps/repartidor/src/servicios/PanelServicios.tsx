import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { type Api, ErrorApi, type Idioma } from '@tumbite/compartido';
import {
  COLOR,
  ConRelojBucle,
  Deslizador,
  FUENTE,
  Icono,
  LETRA,
  RADIO,
  Radar,
  TarjetaServicio,
  Text,
  type EstadoServicio,
  useSondeo,
} from '@tumbite/movil';
import {
  detalleServicio,
  franjaPausa,
  iconoServicio,
  nombreServicio,
  ordenarServicios,
  textoLlevando,
  textoTrasDesconectar,
  tituloLlevando,
  type PanelServicios as Panel,
  type ServicioPanel,
  type TipoLleva,
} from './logica';
import { textosServicios } from './textos';
import { IconoServicio } from './IconoServicio';

/**
 * C-SERVICIOS-CONECTADOS (Richard, 16 nov 2026; diseño en DRIVER.md de Gerencia, pantallas 01, 02
 * y 04) — todos los países. El inicio del Driver ya no es un solo interruptor: arriba la tarjeta
 * tinta con el radar («Conectado a 3 servicios»), la lista de servicios al momento (cada uno se
 * conecta con un toque y se desconecta deslizando) y la tarjeta de Divoox Flex. Todo sale de
 * `/datos/conductor/panel-servicios`: lo que el servidor no da (apagado en la ciudad) no se dibuja.
 */

/**
 * El panel de servicios del servidor, leído al entrar, cada `cadaMs` (5 s) y cuando algo cambia.
 * Con `cadaMs` en 0 no se lee solo: lo lee quien lo usa (el inicio, junto con su estado).
 */
export function usePanelServicios(api: Api, cadaMs = 10_000) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const cargar = useCallback(async () => {
    try {
      setPanel(await api.pedir<Panel>('GET', '/datos/conductor/panel-servicios'));
    } catch {
      // Sin señal: se queda lo último que se vio y se reintenta en la próxima vuelta.
      return false;
    }
  }, [api]);
  // C-SESION-TERMINADA: si falla, espera cada vez más (nunca pregunta sin pausa).
  useSondeo(cargar, cadaMs, cadaMs > 0);
  return { panel, setPanel, cargar };
}

/** La tarjeta tinta de arriba: radar y «Conectado a N servicios», o «Desconectado». */
function TarjetaEstado({
  panel,
  idioma,
  pausado,
  textoPausado,
}: {
  panel: Panel;
  idioma: Idioma;
  pausado: boolean;
  textoPausado: string;
}) {
  const t = textosServicios(idioma);
  const conectado = panel.conectadoGeneral && panel.conectados > 0;
  return (
    <View
      testID="estado-servicios"
      accessibilityRole="summary"
      style={{
        backgroundColor: COLOR.negro,
        borderRadius: 20,
        paddingVertical: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {conectado ? (
        <Radar tamano={56} />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 2,
            borderColor: '#3A3A3F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre="power" tamano={24} color="#A1A1AA" />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontFamily: FUENTE.titulo, fontSize: 18, lineHeight: 24, color: COLOR.blanco }}
        >
          {conectado ? t.conectadoA(panel.conectados) : t.desconectadoTitulo}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: '#C9CACE' }}>
          {conectado ? (pausado ? textoPausado : t.esperando) : t.desconectadoTexto}
        </Text>
      </View>
    </View>
  );
}

export type RutaFlexPanel = {
  id: string;
  nombre: string;
  estado: string;
  paradas: number;
  bloqueDesde?: string | null;
  bloqueHasta?: string | null;
};

export function PanelServiciosInicio({
  panel,
  idioma,
  resumen,
  rutaFlex,
  textoBloqueFlex,
  pausado,
  textoPausado,
  cambiando,
  alConectarServicio,
  alDesconectarServicio,
  alConectarTodo,
  alDesconectarTodo,
  alVerServicio,
  alAbrirFlex,
  alDesconectado,
  debajo,
  arriba,
  motivo,
  motivoServicio,
}: {
  panel: Panel;
  idioma: Idioma;
  /** «Hoy», servicios y tiempo en línea (va entre la tarjeta tinta y la lista). */
  resumen: ReactNode;
  rutaFlex: RutaFlexPanel | null;
  textoBloqueFlex: string | null;
  pausado: boolean;
  textoPausado: string;
  /** El servicio que se está conectando (o 'todo'), para el botón ocupado. */
  cambiando: string | null;
  alConectarServicio: (id: string) => Promise<boolean>;
  alDesconectarServicio: (id: string) => Promise<boolean>;
  alConectarTodo: () => unknown;
  alDesconectarTodo: () => unknown;
  alVerServicio: (s: ServicioPanel) => void;
  alAbrirFlex: () => void;
  /** Al desconectar uno: la pantalla muestra abajo «Comida desconectada… Para volver, desliza su tarjeta.» */
  /** `texto`: C-ULTIMO-SERVICIO, «Lo demás sigue conectado» solo si queda otro conectado. */
  alDesconectado: (id: string, nombre: string, texto: string) => void;
  /** Lo que va debajo de la lista (errores y avisos del inicio), dentro del mismo bloque. */
  debajo?: ReactNode;
  /**
   * C-FOTO-CARA-A-LA-VISTA y C-QUE-TE-FALTA: lo que le falta para recibir carreras (la foto de la cara,
   * su vehículo, las puertas para conectarse). Va ARRIBA DE TODO, encima del estado y de la barra.
   */
  arriba?: ReactNode;
  /** Por qué el servidor no lo dejó conectarse: pegado a la barra (o a la tarjeta de ese servicio). */
  motivo?: ReactNode;
  /** El servicio que no se pudo conectar (el motivo va debajo de su tarjeta). */
  motivoServicio?: string;
}) {
  const t = textosServicios(idioma);
  const servicios = ordenarServicios(panel.servicios);
  // Mientras lleva algo (una ruta de Flex, por ejemplo) los demás están en pausa, no apagados.
  const conectado = panel.conectadoGeneral && (panel.conectados > 0 || Boolean(panel.lleva));
  const hayAprobados = servicios.some((s) => s.estado === 'desconectado');
  const enSuTarjeta = Boolean(
    motivoServicio && servicios.some((s) => s.servicioId === motivoServicio),
  );
  const motivoArriba = enSuTarjeta ? null : motivo;

  return (
    <ConRelojBucle>
      <View style={{ gap: 16 }}>
        {arriba}
        {panel.lleva ? (
          <>
            <AvisoLlevando
              tipo={panel.lleva.tipo}
              servicioId={panel.lleva.servicioId}
              idioma={idioma}
            />
            <FranjaPausa panel={panel} idioma={idioma} />
          </>
        ) : (
          <TarjetaEstado
            panel={panel}
            idioma={idioma}
            pausado={pausado}
            textoPausado={textoPausado}
          />
        )}
        {resumen}
        {/* C-FOTO-CARA-A-LA-VISTA: el motivo va justo encima de la barra que se acaba de deslizar. */}
        {motivoArriba}
        {!conectado && hayAprobados ? (
          // C-CONECTAR-DESLIZANDO: conectarse se desliza (un toque en el bolsillo no conecta).
          <Deslizador
            variante="accion"
            tono="exito"
            texto={cambiando === 'todo' ? t.buscandoUbicacion : t.deslizarConectarme}
            ocupado={cambiando === 'todo'}
            accionLector={t.conectarme}
            confirmar={{ pregunta: t.confirmarConectarme, si: t.siConectar, no: t.no }}
            alConfirmar={alConectarTodo}
            testID="conectarme"
          />
        ) : null}
        {servicios.length ? (
          <View style={{ gap: 8 }}>
            <View style={{ gap: 2, marginBottom: 4 }}>
              <Text
                style={{
                  fontFamily: FUENTE.titulo,
                  fontSize: 17,
                  lineHeight: 22,
                  color: COLOR.texto,
                }}
                accessibilityRole="header"
              >
                {t.serviciosAlMomento}
              </Text>
              {conectado ? (
                <Text style={{ fontSize: 13, lineHeight: 18, color: COLOR.textoSuave }}>
                  {t.pista}
                </Text>
              ) : null}
            </View>
            {servicios.map((s, i) => {
              const nombre = nombreServicio(s, idioma);
              const tarjeta = (
                <TarjetaServicio
                  key={s.servicioId}
                  testID={`servicio-${s.servicioId}`}
                  estado={s.estado as EstadoServicio}
                  nombre={nombre}
                  detalle={detalleServicio(s, idioma)}
                  icono={iconoServicio(s.servicioId)}
                  dibujo={<IconoServicio id={s.servicioId} tamano={40} />}
                  indice={i}
                  cargando={cambiando === s.servicioId}
                  textos={{
                    deslizarConectar: t.deslizarConectar,
                    soltarConectar: t.soltarConectar,
                    conectarLector: t.accionConectar,
                    confirmarConectar: t.confirmarConectar,
                    siConectar: t.siConectar,
                    ver: t.ver,
                    soltar: t.soltar,
                    desconectar: t.accionDesconectar,
                    confirmar: t.confirmarDesconectar,
                    si: t.si,
                    no: t.no,
                  }}
                  alConectar={() => alConectarServicio(s.servicioId)}
                  alVer={() => alVerServicio(s)}
                  alAgregar={() => alVerServicio(s)}
                  alDesconectar={async () => {
                    // Con la lista de ANTES de desconectar (la de después ya cambió).
                    const texto = textoTrasDesconectar(servicios, s.servicioId, idioma);
                    if (await alDesconectarServicio(s.servicioId))
                      alDesconectado(s.servicioId, nombre, texto);
                  }}
                />
              );
              return enSuTarjeta && motivoServicio === s.servicioId ? (
                <View key={s.servicioId} style={{ gap: 8 }}>
                  {tarjeta}
                  {motivo}
                </View>
              ) : (
                tarjeta
              );
            })}
            {conectado ? (
              <View style={{ marginTop: 8 }}>
                <Deslizador
                  variante="accion"
                  tono="neutro"
                  texto={t.deslizarDesconectarme}
                  ocupado={cambiando === 'todo'}
                  accionLector={t.desconectarme}
                  confirmar={{ pregunta: t.confirmarDesconectarme, si: t.si, no: t.no }}
                  alConfirmar={alDesconectarTodo}
                  testID="desconectarme"
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {debajo}
        {rutaFlex ? (
          <View style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Text style={LETRA.subtitulo} accessibilityRole="header">
                {t.flex}
              </Text>
              <Text style={{ fontSize: 13, color: COLOR.textoSuave }}>{t.bloquesPaquetes}</Text>
            </View>
            <Pressable
              onPress={alAbrirFlex}
              accessibilityRole="button"
              accessibilityLabel={`${t.flex}: ${textoBloqueFlex ?? rutaFlex.nombre}`}
              testID="ruta-flex-inicio"
              style={({ pressed }) => ({
                minHeight: 76,
                borderRadius: RADIO.l,
                borderWidth: 1,
                borderColor: COLOR.borde,
                backgroundColor: pressed ? COLOR.superficie : COLOR.fondo,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: RADIO.m,
                  backgroundColor: COLOR.logisticaSuave,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icono nombre="cube-outline" tamano={24} color={COLOR.logistica} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={LETRA.tarjeta} numberOfLines={1}>
                  {textoBloqueFlex ?? rutaFlex.nombre}
                </Text>
                <Text
                  style={{ fontSize: 13, lineHeight: 18, color: COLOR.textoSuave }}
                  numberOfLines={1}
                >
                  {textoBloqueFlex ? `${rutaFlex.nombre} · ` : ''}
                  {idioma === 'en'
                    ? `${rutaFlex.paradas} ${rutaFlex.paradas === 1 ? 'stop' : 'stops'}`
                    : `${rutaFlex.paradas} ${rutaFlex.paradas === 1 ? 'parada' : 'paradas'}`}
                </Text>
              </View>
              <View
                style={{
                  height: 40,
                  paddingHorizontal: 16,
                  borderRadius: RADIO.m,
                  backgroundColor: COLOR.superficie,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 15 }}>{t.ver}</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ConRelojBucle>
  );
}

/**
 * Estado 2 (pantalla 02): el aviso tinta fijo «Estás llevando una comida · Lo demás está en pausa»,
 * con el ícono del servicio en rojo. Va sobre el mapa o arriba de la pantalla del trabajo.
 */
export function AvisoLlevando({
  tipo,
  servicioId,
  idioma,
  flotante,
}: {
  tipo: TipoLleva;
  servicioId: string;
  idioma: Idioma;
  /** Sobre el mapa: posición absoluta arriba. */
  flotante?: boolean;
}) {
  return (
    <View
      testID="aviso-llevando"
      accessibilityRole="summary"
      style={[
        {
          backgroundColor: COLOR.negro,
          borderRadius: 20,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        },
        flotante ? { position: 'absolute', top: 12, left: 16, right: 16, zIndex: 4 } : null,
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: RADIO.m,
          backgroundColor: COLOR.marca,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconoServicio id={servicioId} tamano={30} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontFamily: FUENTE.titulo, fontSize: 16, lineHeight: 22, color: COLOR.blanco }}
        >
          {tituloLlevando(tipo, idioma)}
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: '#C9CACE' }}>
          {textoLlevando(tipo, idioma)}
        </Text>
      </View>
    </View>
  );
}

/** Estado 2: la franja gris «En pausa: … · No te llegan ofertas hasta entregar esto». */
export function FranjaPausa({ panel, idioma }: { panel: Panel; idioma: Idioma }) {
  const f = franjaPausa(panel, idioma);
  if (!f) return null;
  return (
    <View
      testID="franja-pausa"
      accessibilityRole="text"
      style={{
        borderWidth: 1,
        borderColor: COLOR.borde,
        borderRadius: RADIO.l,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {f.servicios.slice(0, 3).map((s) => (
          <View
            key={s.servicioId}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: COLOR.superficieFuerte,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconoServicio id={s.servicioId} tamano={22} />
          </View>
        ))}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: FUENTE.textoNegrita, fontSize: 14, lineHeight: 19 }}>
          {f.titulo}
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: COLOR.textoSuave }}>{f.texto}</Text>
      </View>
      <Icono nombre="pause" tamano={18} color={COLOR.textoSuave} />
    </View>
  );
}

/** Estado 3: los servicios al momento bloqueados durante el bloque de Flex (con candado). */
export function ServiciosBloqueados({
  panel,
  idioma,
  oscuro,
}: {
  panel: Panel | null;
  idioma: Idioma;
  oscuro?: boolean;
}) {
  const t = textosServicios(idioma);
  const ids = (panel?.servicios ?? []).map((s) => s.servicioId);
  const iconos = ids.length ? ids : ['comida', 'moto', 'carro'];
  return (
    <View
      testID="servicios-bloqueados"
      accessibilityRole="text"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
    >
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {iconos.slice(0, 4).map((id) => (
          <View
            key={id}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: oscuro ? '#1C3445' : COLOR.superficie,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconoServicio id={id} tamano={22} />
          </View>
        ))}
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 18,
          color: oscuro ? '#A9B9C6' : COLOR.textoSuave,
        }}
      >
        {t.serviciosBloqueados}
      </Text>
    </View>
  );
}

/** El mensaje de un error de la API, o el texto de respaldo. */
export function mensajeDe(x: unknown, respaldo: string): string {
  return x instanceof ErrorApi ? x.message : respaldo;
}
