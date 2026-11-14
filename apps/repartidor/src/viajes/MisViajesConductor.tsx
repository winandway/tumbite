import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, enIdioma, formatearMonto } from '@tumbite/compartido';
import { Boton, C, e, useSesion } from '@tumbite/movil';

/**
 * C-VIAJES-HISTORIAL (13 nov 2026) — todos los países. «Mis viajes» del conductor de Moto y Carro: la
 * lista por páginas, el recibo de cada viaje y, arriba, los objetos que un pasajero olvidó en su
 * vehículo la última semana (el contacto es por soporte: no se muestran teléfonos).
 */
type Fila = {
  id: string;
  servicio: string;
  categoria: string | null;
  estado: string;
  destino: string;
  total: number | null;
  moneda: string | null;
  metodoPago: string;
  creadoEn: string;
};
type Recibo = {
  total: number | null;
  moneda: string | null;
  propina: number;
  metodoPago: string;
  distanciaM: number | null;
  duracionS: number | null;
  origen: string;
  destino: string;
};

const T = {
  es: {
    titulo: 'Mis viajes',
    vacio: 'Todavía no tienes viajes de pasajeros.',
    verMas: 'Ver más viajes',
    olvidados: 'Objetos olvidados en tu vehículo',
    olvidadosAyuda:
      'Guárdalo en un lugar seguro. Nuestro equipo te escribe para coordinar la devolución.',
    servicios: { moto: 'Moto', carro: 'Carro', carro_xl: 'Carro XL', envios: 'Envío' } as Record<
      string,
      string
    >,
    estados: {
      terminado: 'Terminado',
      cancelado: 'Cancelado',
      no_show: 'No se presentó',
      sin_conductor: 'Sin conductor',
      en_curso: 'En curso',
      asignado: 'Aceptado',
      conductor_llego: 'Llegaste',
    } as Record<string, string>,
    pagos: { efectivo: 'Efectivo', tarjeta: 'Tarjeta', pago_movil: 'Pago móvil' } as Record<
      string,
      string
    >,
    propina: 'Propina',
    km: (m: number) => `${(m / 1000).toFixed(1)} km`,
    min: (s: number) => `${Math.max(1, Math.round(s / 60))} min`,
  },
  en: {
    titulo: 'My rides',
    vacio: 'You don’t have any passenger rides yet.',
    verMas: 'See more rides',
    olvidados: 'Items left in your vehicle',
    olvidadosAyuda: 'Keep it somewhere safe. Our team will contact you to arrange the return.',
    servicios: { moto: 'Moto', carro: 'Car', carro_xl: 'Car XL', envios: 'Delivery' } as Record<
      string,
      string
    >,
    estados: {
      terminado: 'Completed',
      cancelado: 'Canceled',
      no_show: 'No-show',
      sin_conductor: 'No driver',
      en_curso: 'In progress',
      asignado: 'Accepted',
      conductor_llego: 'Arrived',
    } as Record<string, string>,
    pagos: { efectivo: 'Cash', tarjeta: 'Card', pago_movil: 'Mobile payment' } as Record<
      string,
      string
    >,
    propina: 'Tip',
    km: (m: number) => `${(m / 1609.34).toFixed(1)} mi`,
    min: (s: number) => `${Math.max(1, Math.round(s / 60))} min`,
  },
};

const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k) ?? k;

export function MisViajesConductor() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [olvidados, setOlvidados] = useState<{ viajeId: string; detalle: string }[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<{ id: string; recibo: Recibo | null } | null>(null);
  const [error, setError] = useState('');

  const traer = useCallback(
    (antes: string | null) =>
      api
        .pedir<{
          viajes: Fila[];
          siguiente: string | null;
          objetosOlvidados: { viajeId: string; detalle: string }[];
        }>(
          'GET',
          `/datos/conductor/viajes/historial${antes ? `?antes=${encodeURIComponent(antes)}` : ''}`,
        )
        .then((r) => {
          setFilas((x) => (antes ? [...(x ?? []), ...r.viajes] : r.viajes));
          setSiguiente(r.siguiente);
          if (!antes) setOlvidados(r.objetosOlvidados);
        })
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x))),
    [api],
  );
  useEffect(() => {
    void traer(null);
  }, [traer]);

  function abrir(id: string) {
    if (abierto?.id === id) return setAbierto(null);
    setAbierto({ id, recibo: null });
    api
      .pedir<{ recibo: Recibo }>('GET', `/datos/conductor/viajes/${id}/recibo`)
      .then((r) => setAbierto({ id, recibo: r.recibo }))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }

  const nombre = (f: Fila) =>
    de(t.servicios, f.servicio === 'carro' && f.categoria === 'xl' ? 'carro_xl' : f.servicio);
  return (
    <View style={{ gap: 8, paddingVertical: 8 }} testID="mis-viajes-conductor">
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.secundario }}>{t.titulo}</Text>
      {error ? <Text style={{ color: C.primario }}>{error}</Text> : null}
      {olvidados.length ? (
        <View style={e.tarjeta}>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{t.olvidados}</Text>
          {olvidados.map((o) => (
            <Text key={o.viajeId} style={{ color: C.secundario }}>
              · {o.detalle}
            </Text>
          ))}
          <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 4 }}>{t.olvidadosAyuda}</Text>
        </View>
      ) : null}
      {filas && filas.length === 0 ? <Text style={{ color: '#5E5E5E' }}>{t.vacio}</Text> : null}
      {(filas ?? []).map((f) => (
        <Pressable key={f.id} onPress={() => abrir(f.id)} accessibilityRole="button">
          <View style={e.tarjeta}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: C.secundario }}>
                {nombre(f)} · {f.creadoEn.slice(0, 10)}
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
              {de(t.estados, f.estado)} · {de(t.pagos, f.metodoPago)}
            </Text>
            {abierto?.id === f.id && abierto.recibo ? (
              <View style={{ marginTop: 6 }}>
                <Text style={{ color: C.secundario }}>{abierto.recibo.origen}</Text>
                <Text style={{ color: '#5E5E5E' }}>
                  {abierto.recibo.distanciaM ? t.km(abierto.recibo.distanciaM) : ''}
                  {abierto.recibo.duracionS != null ? ` · ${t.min(abierto.recibo.duracionS)}` : ''}
                  {abierto.recibo.propina > 0
                    ? ` · ${t.propina}: ${formatearMonto(abierto.recibo.propina, abierto.recibo.moneda ?? 'USD', idioma)}`
                    : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ))}
      {siguiente ? <Boton texto={t.verMas} alTocar={() => void traer(siguiente)} /> : null}
    </View>
  );
}
