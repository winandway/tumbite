import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, enIdioma, formatearMonto, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
} from '@tumbite/movil';
import { Tarjeta } from '../comida/piezas';

/**
 * C-VIAJES-HISTORIAL (13 nov 2026) — todos los países. «Mis viajes» del pasajero, como Uber: la lista
 * por páginas, el recibo de cada viaje (desglose, forma de pago, distancia, tiempo, conductor y
 * vehículo) y la ayuda con el viaje adjunto, incluida «Olvidé algo en el vehículo». El contacto es por
 * soporte: nunca se muestran teléfonos. El formulario de ayuda guarda lo escrito (borrador).
 */

type Fila = {
  id: string;
  servicio: string;
  categoria: string | null;
  estado: string;
  origen: string;
  destino: string;
  total: number | null;
  moneda: string | null;
  creadoEn: string;
};
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
  desglose: Record<string, number>;
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

const T = {
  es: {
    titulo: 'Mis viajes',
    vacio: 'Todavía no tienes viajes.',
    verMas: 'Ver más viajes',
    volver: 'Volver a mis viajes',
    recibo: 'Recibo del viaje',
    servicios: { moto: 'Moto', carro: 'Carro', carro_xl: 'Carro XL', envios: 'Envío' } as Record<
      string,
      string
    >,
    estados: {
      terminado: 'Terminado',
      cancelado: 'Cancelado',
      sin_conductor: 'Sin conductor',
      no_show: 'No te encontramos',
      buscando: 'Buscando conductor',
      asignado: 'En camino',
      conductor_llego: 'El conductor llegó',
      en_curso: 'En curso',
      pago_pendiente: 'Pago pendiente',
    } as Record<string, string>,
    piezas: {
      base: 'Tarifa base',
      distancia: 'Distancia',
      tiempo: 'Tiempo',
      ajusteMinimo: 'Ajuste a la tarifa mínima',
      dinamico: 'Alta demanda',
      cargoFijo: 'Cargo de servicio',
      redondeo: 'Redondeo',
    } as Record<string, string>,
    total: 'Total',
    propina: 'Propina',
    pago: 'Forma de pago',
    pagos: { efectivo: 'Efectivo', tarjeta: 'Tarjeta', pago_movil: 'Pago móvil' } as Record<
      string,
      string
    >,
    km: (m: number) => `${(m / 1000).toFixed(1)} km`,
    min: (s: number) => `${Math.max(1, Math.round(s / 60))} min`,
    conductor: 'Conductor',
    ayuda: 'Ayuda con este viaje',
    motivos: {
      objeto_olvidado: 'Olvidé algo en el vehículo',
      cobro: 'Problema con el cobro',
      conductor: 'Problema con el conductor',
      seguridad: 'Problema de seguridad',
      otro: 'Otra cosa',
    } as Record<string, string>,
    detalle: 'Cuéntanos qué pasó',
    detalleOlvido: 'Qué olvidaste y dónde lo dejaste',
    enviar: 'Enviar a soporte',
    enviado:
      'Listo: abrimos tu caso con este viaje adjunto. Nuestro equipo te escribe por correo y en Ayuda.',
    enviadoOlvido:
      'Listo: le avisamos al conductor y abrimos tu caso. Nuestro equipo coordina la devolución contigo; por seguridad no compartimos teléfonos.',
    casoAbierto: 'Ya tienes un caso abierto:',
    faltaDetalle: 'Cuéntanos qué pasó (al menos unas palabras).',
  },
  en: {
    titulo: 'My rides',
    vacio: 'You don’t have any rides yet.',
    verMas: 'See more rides',
    volver: 'Back to my rides',
    recibo: 'Ride receipt',
    servicios: { moto: 'Moto', carro: 'Car', carro_xl: 'Car XL', envios: 'Delivery' } as Record<
      string,
      string
    >,
    estados: {
      terminado: 'Completed',
      cancelado: 'Canceled',
      sin_conductor: 'No driver found',
      no_show: 'We couldn’t find you',
      buscando: 'Finding a driver',
      asignado: 'On the way',
      conductor_llego: 'Driver arrived',
      en_curso: 'In progress',
      pago_pendiente: 'Payment pending',
    } as Record<string, string>,
    piezas: {
      base: 'Base fare',
      distancia: 'Distance',
      tiempo: 'Time',
      ajusteMinimo: 'Minimum fare adjustment',
      dinamico: 'High demand',
      cargoFijo: 'Service fee',
      redondeo: 'Rounding',
    } as Record<string, string>,
    total: 'Total',
    propina: 'Tip',
    pago: 'Payment method',
    pagos: { efectivo: 'Cash', tarjeta: 'Card', pago_movil: 'Mobile payment' } as Record<
      string,
      string
    >,
    km: (m: number) => `${(m / 1609.34).toFixed(1)} mi`,
    min: (s: number) => `${Math.max(1, Math.round(s / 60))} min`,
    conductor: 'Driver',
    ayuda: 'Help with this ride',
    motivos: {
      objeto_olvidado: 'I left something in the vehicle',
      cobro: 'Problem with the charge',
      conductor: 'Problem with the driver',
      seguridad: 'Safety issue',
      otro: 'Something else',
    } as Record<string, string>,
    detalle: 'Tell us what happened',
    detalleOlvido: 'What you left and where',
    enviar: 'Send to support',
    enviado:
      'Done: we opened your case with this ride attached. Our team will email you and reply in Help.',
    enviadoOlvido:
      'Done: we let the driver know and opened your case. Our team will arrange the return with you; for safety, we don’t share phone numbers.',
    casoAbierto: 'You already have an open case:',
    faltaDetalle: 'Tell us what happened (at least a few words).',
  },
};

const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k) ?? k;
const ORDEN_PIEZAS = [
  'base',
  'distancia',
  'tiempo',
  'ajusteMinimo',
  'dinamico',
  'cargoFijo',
  'redondeo',
];

function Detalle({ id, alVolver }: { id: string; alVolver: () => void }) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
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
          <Text style={{ color: '#5E5E5E' }}>
            {nombre(r)} · {de(t.estados, r.estado)} · {r.fecha.slice(0, 16)}
          </Text>
          <Text style={{ color: C.secundario, marginTop: 6 }}>{r.origen}</Text>
          <Text style={{ color: C.secundario }}>{r.destino}</Text>
          <View style={{ marginTop: 8, gap: 2 }}>
            {ORDEN_PIEZAS.filter((k) => (pieza(k) ?? 0) !== 0).map((k) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#5E5E5E' }}>{de(t.piezas, k)}</Text>
                <Text style={{ color: C.secundario }}>{monto(pieza(k) ?? 0)}</Text>
              </View>
            ))}
            {r.propina > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#5E5E5E' }}>{t.propina}</Text>
                <Text style={{ color: C.secundario }}>{monto(r.propina)}</Text>
              </View>
            ) : null}
            {r.total != null ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: C.secundario }}>{t.total}</Text>
                <Text style={{ fontWeight: '700', color: C.secundario }}>
                  {monto(r.total + r.propina)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: '#5E5E5E', marginTop: 8 }}>
            {t.pago}: {de(t.pagos, r.metodoPago)}
            {r.distanciaM ? ` · ${t.km(r.distanciaM)}` : ''}
            {r.duracionS != null ? ` · ${t.min(r.duracionS)}` : ''}
          </Text>
          {r.conductor ? (
            <Text style={{ color: '#5E5E5E' }}>
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

export function MisViajes() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState('');

  const traer = useCallback(
    (antes: string | null) =>
      api
        .pedir<{ viajes: Fila[]; siguiente: string | null }>(
          'GET',
          `/datos/viajes/historial${antes ? `?antes=${encodeURIComponent(antes)}` : ''}`,
        )
        .then((r) => {
          setFilas((x) => (antes ? [...(x ?? []), ...r.viajes] : r.viajes));
          setSiguiente(r.siguiente);
        })
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x))),
    [api],
  );
  useEffect(() => {
    void traer(null);
  }, [traer]);

  if (abierto) return <Detalle id={abierto} alVolver={() => setAbierto(null)} />;
  return (
    <View style={{ gap: 8 }} testID="mis-viajes">
      <Text style={{ fontWeight: '700', fontSize: 18, color: C.secundario }}>{t.titulo}</Text>
      {error ? <Text style={{ color: C.primario }}>{error}</Text> : null}
      {filas && filas.length === 0 ? <Text style={{ color: '#5E5E5E' }}>{t.vacio}</Text> : null}
      {(filas ?? []).map((f) => (
        <Pressable key={f.id} onPress={() => setAbierto(f.id)} accessibilityRole="button">
          <Tarjeta>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: C.secundario }}>
                {de(
                  t.servicios,
                  f.servicio === 'carro' && f.categoria === 'xl' ? 'carro_xl' : f.servicio,
                )}{' '}
                · {f.creadoEn.slice(0, 10)}
              </Text>
              {f.total != null ? (
                <Text style={{ fontWeight: '700', color: C.secundario }}>
                  {formatearMonto(f.total, f.moneda ?? 'USD', idioma)}
                </Text>
              ) : null}
            </View>
            <Text numberOfLines={1} style={{ color: '#5E5E5E' }}>
              {f.destino}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: f.estado === 'terminado' ? C.exito : '#5E5E5E',
              }}
            >
              {de(t.estados, f.estado)}
            </Text>
          </Tarjeta>
        </Pressable>
      ))}
      {siguiente ? <Boton texto={t.verMas} alTocar={() => void traer(siguiente)} /> : null}
    </View>
  );
}
