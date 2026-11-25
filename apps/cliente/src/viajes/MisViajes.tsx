import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ErrorApi,
  type Referencia,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import {
  MontoEnMano,
  AvisoBorrador,
  Boton,
  C,
  COLOR,
  Campo,
  ESPACIO,
  EstadoVacio,
  FilaLista,
  Icono,
  LETRA,
  RADIO,
  SOMBRA,
  alSalirTelefono,
  almacenTelefono,
  useColores,
  useSesion,
  Text,
  Modal,
} from '@tumbite/movil';
import { Tarjeta } from '../comida/piezas';
import { ConfirmarMismaRuta } from './ConfirmarMismaRuta';
import { MapaRuta } from './MapaRuta';
import {
  type ViajeHistorial,
  agruparPorMes,
  categoriaDe,
  fechaServidor,
  puntosEnOrden,
  sePuedeRepetir,
} from './mismaRuta';
import { TEXTOS_MIS_VIAJES } from './textos';
import { TEXTOS_FIJOS } from './textosFijos';
import { PrecioCompacto, PrecioDelViaje, type RegaloDelViaje } from './PrecioDelViaje';

/**
 * C-VIAJES-HISTORIAL (13 nov 2026) — todos los países. «Mis viajes» del pasajero, como Uber: la lista
 * por páginas, el recibo de cada viaje (desglose, forma de pago, distancia, tiempo, conductor y
 * vehículo) y la ayuda con el viaje adjunto, incluida «Olvidé algo en el vehículo». El contacto es por
 * soporte: nunca se muestran teléfonos. El formulario de ayuda guarda lo escrito (borrador).
 *
 * C-MISMA-RUTA (15 nov 2026): la lista va agrupada por mes; cada viaje es una tarjeta con el mapita de
 * su ruta real y «Pedir la misma ruta», que abre la confirmación con el precio de ahora. El recibo y
 * la ayuda van en los tres puntos. Mirar la lista no escribe en la base.
 */

type Recibo = {
  id: string;
  servicio: string;
  categoria: string;
  estado: string;
  metodoPago: string;
  origen: string;
  destino: string;
  fecha: string;
  total: number | null;
  moneda: string | null;
  /** C-PRECIO-CON-REGALO: lo que pagó Divoox (o el regalo que volvió a la cuenta si no hubo viaje). */
  regalo?: RegaloDelViaje | null;
  desglose: Record<string, number>;
  /** C-BS-EN-MANO: lo pagado en mano en bolívares, con la tasa y la fecha usadas. */
  enManoLocal?: Referencia | null;
  propina: number;
  distanciaM: number | null;
  duracionS: number | null;
  conductor: {
    nombre: string;
    vehiculo: {
      marca: string | null;
      modelo: string | null;
      color: string | null;
      placa: string | null;
    };
  } | null;
};

const MOTIVOS = ['objeto_olvidado', 'cobro', 'conductor', 'seguridad', 'otro'] as const;

const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k) ?? k;
const ORDEN_PIEZAS = [
  'base',
  'distancia',
  'tiempo',
  'ajusteMinimo',
  'dinamico',
  'cargoFijo',
  'redondeo',
  // C-PRECIO-ZONA: el precio fijo de la zona, en su propia línea del recibo.
  'precioZona',
  // C-QUIEN-PAGA-VIAJES: la tarifa de servicio de Divoox, en su propia línea del recibo.
  'tarifaServicio',
];

function Detalle({ id, alVolver }: { id: string; alVolver: () => void }) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS_MIS_VIAJES, idioma);
  const [r, setR] = useState<Recibo | null>(null);
  const [ayuda, setAyuda] = useState<{ motivo: string; ticketId: string }[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: `viaje-ayuda-${id}`,
    cuenta: usuario?.id,
    inicial: { motivo: '', detalle: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cargar = useCallback(
    () =>
      api
        .pedir<{
          recibo: Recibo;
          ayuda: { motivo: string; ticketId: string }[];
        }>('GET', `/datos/viajes/${id}/recibo`)
        .then((x) => {
          setR(x.recibo);
          setAyuda(x.ayuda);
        })
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x))),
    [api, id],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function enviar() {
    setError('');
    setOk('');
    if (b.valores.detalle.trim().length < 3) {
      setError(t.faltaDetalle);
      return;
    }
    setEnviando(true);
    try {
      await api.pedir('POST', `/datos/viajes/${id}/ayuda`, {
        motivo: b.valores.motivo,
        detalle: b.valores.detalle.trim(),
      });
      setOk(b.valores.motivo === 'objeto_olvidado' ? t.enviadoOlvido : t.enviado);
      // Solo se borra lo escrito cuando el servidor confirmó el caso.
      await b.limpiar();
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  const monto = (n: number) => formatearMonto(n, r?.moneda ?? 'USD', idioma);
  const pieza = (k: string) => new Map(Object.entries(r?.desglose ?? {})).get(k);
  const nombre = (x: { servicio: string; categoria: string | null }) =>
    de(t.servicios, x.servicio === 'carro' && x.categoria === 'xl' ? 'carro_xl' : x.servicio);
  return (
    <View style={{ gap: 12 }} testID="recibo-viaje">
      <Pressable onPress={alVolver} accessibilityRole="button" hitSlop={8}>
        <Text style={{ color: C.secundario, textDecorationLine: 'underline' }}>{t.volver}</Text>
      </Pressable>
      {r ? (
        <Tarjeta>
          <Text style={{ fontWeight: '700', fontSize: 18, color: C.secundario }}>{t.recibo}</Text>
          <Text style={{ color: '#666B73' }}>
            {nombre(r)} · {de(t.estados, r.estado)} · {r.fecha.slice(0, 16)}
          </Text>
          <Text style={{ color: C.secundario, marginTop: 6 }}>{r.origen}</Text>
          <Text style={{ color: C.secundario }}>{r.destino}</Text>
          <View style={{ marginTop: 8, gap: 2 }}>
            {ORDEN_PIEZAS.filter((k) => (pieza(k) ?? 0) !== 0).map((k) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#666B73' }}>{de(t.piezas, k)}</Text>
                <Text style={{ color: C.secundario }}>{monto(pieza(k) ?? 0)}</Text>
              </View>
            ))}
            {r.propina > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#666B73' }}>{t.propina}</Text>
                <Text style={{ color: C.secundario }}>{monto(r.propina)}</Text>
              </View>
            ) : null}
            {/* C-PRECIO-CON-REGALO: el total tachado, el regalo y lo que se pagó de verdad. */}
            <PrecioDelViaje
              etiqueta={t.total}
              total={r.total == null ? null : r.total + r.propina}
              regalo={r.regalo}
              moneda={r.moneda ?? 'USD'}
              idioma={idioma}
            />
            {r.enManoLocal ? (
              <MontoEnMano
                testID="recibo-en-mano-bs"
                monto={{ monto: 0, moneda: 'USD', local: r.enManoLocal, sinTasa: false }}
                idioma={idioma === 'en' ? 'en' : 'es'}
                quien="pasajero"
                etiqueta={t.pagadoEnMano}
                soloLocal
              />
            ) : null}
          </View>
          <Text style={{ color: '#666B73', marginTop: 8 }}>
            {t.pago}: {de(t.pagos, r.metodoPago)}
            {r.distanciaM ? ` · ${t.km(r.distanciaM)}` : ''}
            {r.duracionS != null ? ` · ${t.min(r.duracionS)}` : ''}
          </Text>
          {r.conductor ? (
            <Text style={{ color: '#666B73' }}>
              {t.conductor}: {r.conductor.nombre} ·{' '}
              {[r.conductor.vehiculo.marca, r.conductor.vehiculo.modelo, r.conductor.vehiculo.color]
                .filter(Boolean)
                .join(' · ')}
              {r.conductor.vehiculo.placa ? ` · ${r.conductor.vehiculo.placa}` : ''}
            </Text>
          ) : null}
        </Tarjeta>
      ) : null}
      {r ? (
        <Tarjeta>
          <Text style={{ fontWeight: '700', color: C.secundario }}>{t.ayuda}</Text>
          {ayuda.map((a) => (
            <Text key={a.motivo} style={{ color: C.exito, fontWeight: '700' }}>
              {t.casoAbierto} {de(t.motivos, a.motivo)}
            </Text>
          ))}
          <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
          <View accessibilityRole="radiogroup" style={{ gap: 4, marginTop: 6 }}>
            {MOTIVOS.filter((m) => m !== 'objeto_olvidado' || r.conductor).map((m) => {
              const elegido = b.valores.motivo === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => b.cambiar('motivo', m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: elegido }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: elegido ? C.secundario : '#C9CDD3',
                      backgroundColor: elegido ? C.secundario : 'transparent',
                    }}
                  />
                  <Text style={{ color: C.secundario }}>{de(t.motivos, m)}</Text>
                </Pressable>
              );
            })}
          </View>
          {b.valores.motivo ? (
            <>
              <Campo
                etiqueta={b.valores.motivo === 'objeto_olvidado' ? t.detalleOlvido : t.detalle}
                value={b.valores.detalle}
                onChangeText={(x) => b.cambiar('detalle', x)}
                multiline
                maxLength={1000}
              />
              <Boton texto={t.enviar} alTocar={() => void enviar()} cargando={enviando} />
            </>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
              {error}
            </Text>
          ) : null}
          {ok ? <Text style={{ color: C.exito, fontWeight: '700' }}>{ok}</Text> : null}
        </Tarjeta>
      ) : null}
      {!r && error ? <Text style={{ color: C.primario }}>{error}</Text> : null}
    </View>
  );
}

type Textos = (typeof TEXTOS_MIS_VIAJES)['es'];

/** «Hoy, 8:12 a. m.», «Ayer, 6:40 p. m.» o «12 nov, 9:05 a. m.» (hora del teléfono). */
function fechaCorta(f: string, idioma: 'es' | 'en', t: Textos): string {
  const d = fechaServidor(f);
  const hora = d.toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mismoDia(d, hoy)) return `${t.hoy}, ${hora}`;
  if (mismoDia(d, ayer)) return `${t.ayer}, ${hora}`;
  return `${d.toLocaleDateString(idioma === 'en' ? 'en-US' : 'es', { day: 'numeric', month: 'short' })}, ${hora}`;
}

/** El nombre del vehículo del viaje: Moto, Carro, Carro XL… */
export function vehiculoDe(v: Pick<ViajeHistorial, 'servicio' | 'categoria'>, t: Textos): string {
  return de(t.vehiculo, v.servicio === 'moto' ? 'moto' : categoriaDe(v));
}

export function TarjetaViaje({
  v,
  alRepetir,
  alOpciones,
}: {
  v: ViajeHistorial;
  alRepetir: () => void;
  alOpciones: () => void;
}) {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_MIS_VIAJES, idioma);
  const col = useColores();
  const estado = de(t.estados, v.estado);
  const ok = v.estado === 'terminado';
  const malo = ['cancelado', 'sin_conductor', 'no_show'].includes(v.estado);
  const colorEstado = ok ? col.exito : malo ? COLOR.error : col.textoSuave;
  return (
    <View
      testID={`viaje-${v.id}`}
      style={{
        borderWidth: 1,
        borderColor: col.borde,
        borderRadius: RADIO.l,
        backgroundColor: col.fondo,
        overflow: 'hidden',
      }}
    >
      <MapaRuta puntos={puntosEnOrden(v)} alto={96}>
        <View
          style={[
            {
              position: 'absolute',
              top: ESPACIO.s,
              left: ESPACIO.s,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: RADIO.s,
              backgroundColor: col.fondo,
            },
            SOMBRA.tarjeta,
          ]}
        >
          <Icono
            nombre={v.servicio === 'moto' ? 'bicycle-outline' : 'car-outline'}
            tamano={16}
            color={col.texto}
          />
          <Text style={[LETRA.tarjeta, { fontSize: 13, color: col.texto }]}>
            {vehiculoDe(v, t)}
          </Text>
        </View>
      </MapaRuta>
      <View style={{ padding: ESPACIO.l, gap: ESPACIO.m }}>
        <View style={{ flexDirection: 'row', gap: ESPACIO.m, alignItems: 'flex-start' }}>
          <Text style={[LETRA.tarjeta, { flex: 1, color: col.texto }]} numberOfLines={2}>
            {v.origen} → {v.destino}
          </Text>
          <PrecioCompacto
            total={v.total}
            regalo={v.regalo}
            moneda={v.moneda ?? 'USD'}
            idioma={idioma}
            estilo={[LETRA.cifra, { fontSize: 16, lineHeight: 20, color: col.texto }]}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <Text style={[LETRA.secundario, { color: col.textoSuave }]}>
            {fechaCorta(v.creadoEn, idioma, t)} ·
          </Text>
          {ok || malo ? (
            <Icono
              nombre={ok ? 'checkmark' : 'close-circle-outline'}
              tamano={16}
              color={colorEstado}
            />
          ) : null}
          <Text style={[LETRA.secundario, { color: colorEstado, fontWeight: '700' }]}>
            {estado}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: ESPACIO.s, alignItems: 'center' }}>
          {sePuedeRepetir(v) ? (
            <View style={{ flex: 1 }}>
              <Boton
                tipo="fuerte"
                icono="repeat-outline"
                texto={t.pedirMismaRuta}
                alTocar={alRepetir}
                testID={`pedir-misma-ruta-${v.id}`}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable
            onPress={alOpciones}
            accessibilityRole="button"
            accessibilityLabel={t.masOpciones}
            testID={`viaje-opciones-${v.id}`}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: RADIO.m,
              borderWidth: 1,
              borderColor: col.borde,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? col.superficie : col.fondo,
            })}
          >
            <Icono nombre="ellipsis-vertical" color={col.texto} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Los tres puntos del viaje: recibo y ayuda (los dos abren el recibo, con la ayuda debajo) y, en un
 * viaje terminado con conductor, «Conductor de confianza» para marcarlo o quitarlo (C-CONDUCTOR-
 * CONFIANZA). Va aquí y no en la tarjeta para no cambiar su tamaño ni su diseño.
 */
function OpcionesViaje({
  viaje,
  alCerrar,
  alRecibo,
  alConfianza,
}: {
  viaje: ViajeHistorial | null;
  alCerrar: () => void;
  alRecibo: () => void;
  alConfianza: (v: ViajeHistorial) => void;
}) {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_MIS_VIAJES, idioma);
  const tf = enIdioma(TEXTOS_FIJOS, idioma);
  const col = useColores();
  const conConductor = viaje?.estado === 'terminado' && Boolean(viaje.conductor);
  return (
    <Modal visible={viaje != null} transparent animationType="fade" onRequestClose={alCerrar}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(16,16,16,0.45)' }}
        onPress={alCerrar}
        accessibilityRole="button"
        accessibilityLabel={t.cerrar}
      />
      <View
        style={[
          {
            backgroundColor: col.fondo,
            borderTopLeftRadius: RADIO.hoja,
            borderTopRightRadius: RADIO.hoja,
            paddingVertical: ESPACIO.s,
            paddingBottom: ESPACIO.xxxl,
          },
          SOMBRA.flotante,
        ]}
        testID="viaje-opciones"
      >
        {viaje && conConductor ? (
          <FilaLista
            titulo={viaje.deConfianza ? tf.esDeConfianza : tf.marcarConfianza}
            detalle={
              viaje.deConfianza
                ? tf.esDeConfianzaDetalle
                : tf.marcarConfianzaDetalle(viaje.conductor ?? '')
            }
            icono={viaje.deConfianza ? 'shield-checkmark' : 'shield-checkmark-outline'}
            derecha={
              viaje.deConfianza ? (
                <Icono nombre="checkmark-circle" tamano={22} color={col.exito} />
              ) : undefined
            }
            alTocar={() => alConfianza(viaje)}
            testID="viaje-opcion-confianza"
          />
        ) : null}
        <FilaLista
          titulo={t.verRecibo}
          icono="receipt-outline"
          alTocar={alRecibo}
          testID="viaje-opcion-recibo"
        />
        <FilaLista
          titulo={t.ayuda}
          icono="help-circle-outline"
          alTocar={alRecibo}
          testID="viaje-opcion-ayuda"
        />
        <FilaLista titulo={t.cerrar} icono="close" alTocar={alCerrar} ultima />
      </View>
    </Modal>
  );
}

/**
 * La lista de «Mis viajes». `alPedir` lleva a la pantalla de espera del viaje nuevo y `alCambiar`
 * abre Pedir viaje ya lleno (los dos los decide la pantalla que la monta).
 */
export function MisViajes({
  alPedir,
  alCambiar,
  conTitulo = true,
}: {
  alPedir: (viajeId: string, servicio: string) => void;
  alCambiar: (servicio: string) => void;
  /** En «Pedir viaje» va con su título; en la pantalla Mis viajes el título lo pone la pantalla. */
  conTitulo?: boolean;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_MIS_VIAJES, idioma);
  const tf = enIdioma(TEXTOS_FIJOS, idioma);
  const col = useColores();
  // C-CONDUCTOR-CONFIANZA: el aviso de «ya es tu conductor de confianza» (verde) o el error del servidor.
  const [avisoConfianza, setAvisoConfianza] = useState('');
  const [filas, setFilas] = useState<ViajeHistorial[] | null>(null);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<string | null>(null);
  const [repetir, setRepetir] = useState<ViajeHistorial | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const traer = useCallback(
    (antes: string | null) =>
      api
        .pedir<{ viajes: ViajeHistorial[]; siguiente: string | null }>(
          'GET',
          `/datos/viajes/historial${antes ? `?antes=${encodeURIComponent(antes)}` : ''}`,
        )
        .then((r) => {
          setFilas((x) => (antes ? [...(x ?? []), ...r.viajes] : r.viajes));
          setSiguiente(r.siguiente);
        })
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
        .finally(() => setCargando(false)),
    [api],
  );
  useEffect(() => {
    void traer(null);
  }, [traer]);

  async function confianza(v: ViajeHistorial) {
    setOpciones(null);
    setError('');
    setAvisoConfianza('');
    const quitar = Boolean(v.deConfianza);
    try {
      await api.pedir(quitar ? 'DELETE' : 'PUT', `/datos/viajes/${v.id}/confianza`);
      const nombre = v.conductor ?? '';
      // Solo cambia este viaje: el historial no trae el id del conductor y dos pueden llamarse igual.
      setFilas((x) => (x ?? []).map((f) => (f.id === v.id ? { ...f, deConfianza: !quitar } : f)));
      setAvisoConfianza(quitar ? tf.quitado(nombre) : tf.marcado(nombre));
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (abierto) return <Detalle id={abierto} alVolver={() => setAbierto(null)} />;
  const grupos = agruparPorMes(filas ?? [], idioma);
  return (
    <View style={{ gap: ESPACIO.l }} testID="mis-viajes">
      {conTitulo ? (
        <Text style={[LETRA.titulo, { color: col.texto }]} accessibilityRole="header">
          {t.titulo}
        </Text>
      ) : null}
      {error ? (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: 'row', gap: ESPACIO.s, alignItems: 'center' }}
        >
          <Icono nombre="alert-circle-outline" color={COLOR.error} tamano={20} />
          <Text style={[LETRA.secundario, { color: COLOR.error, flex: 1 }]}>{error}</Text>
        </View>
      ) : null}
      {avisoConfianza ? (
        <View
          accessibilityRole="summary"
          testID="aviso-confianza"
          style={{ flexDirection: 'row', gap: ESPACIO.s, alignItems: 'center' }}
        >
          <Icono nombre="checkmark-circle-outline" color={col.exito} tamano={20} />
          <Text style={[LETRA.secundario, { color: col.exito, flex: 1 }]}>{avisoConfianza}</Text>
        </View>
      ) : null}
      {filas && filas.length === 0 ? (
        <EstadoVacio icono="car-outline" titulo={t.titulo} texto={t.vacio} />
      ) : null}
      {grupos.map((g) => (
        <View key={g.clave} style={{ gap: ESPACIO.m }}>
          <Text style={[LETRA.cuerpoFuerte, { color: col.textoSuave }]}>{g.titulo}</Text>
          {g.viajes.map((v) => (
            <TarjetaViaje
              key={v.id}
              v={v}
              alRepetir={() => setRepetir(v)}
              alOpciones={() => setOpciones(v.id)}
            />
          ))}
        </View>
      ))}
      {siguiente ? (
        <Boton
          tipo="terciario"
          texto={t.verMas}
          alTocar={() => {
            setCargando(true);
            void traer(siguiente);
          }}
          cargando={cargando}
        />
      ) : null}
      <OpcionesViaje
        viaje={(filas ?? []).find((f) => f.id === opciones) ?? null}
        alConfianza={(v) => void confianza(v)}
        alCerrar={() => setOpciones(null)}
        alRecibo={() => {
          setAbierto(opciones);
          setOpciones(null);
        }}
      />
      <ConfirmarMismaRuta
        viaje={repetir}
        alCerrar={() => setRepetir(null)}
        alPedir={(id, servicio) => {
          setRepetir(null);
          alPedir(id, servicio);
        }}
        alCambiar={(servicio) => {
          setRepetir(null);
          alCambiar(servicio);
        }}
      />
    </View>
  );
}
