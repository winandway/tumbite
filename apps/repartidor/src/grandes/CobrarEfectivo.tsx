import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  type Api,
  ErrorApi,
  type Idioma,
  enIdioma,
  formatearMonto,
  textoLocal,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  CodigoQR,
  Text,
  alSalirTelefono,
  almacenTelefono,
} from '@tumbite/movil';

/**
 * C-AGENTE-DIVOOX (18 nov 2026): «Cobrar en efectivo» en Ganancias. El conductor elige un monto de
 * sus ganancias, recibe un código de un solo uso (y su QR) que vale 24 horas, y lo cobra con un
 * Agente Divoox de su ciudad, como el retiro en agente de las billeteras [DOC]. El monto queda
 * apartado; si el código se vence o lo cancela, vuelve a sus ganancias. Uno vivo a la vez.
 * Si su ciudad todavía no tiene el servicio, la tarjeta no aparece (C-SOLO-LO-TERMINADO).
 */
const T = {
  es: {
    titulo: 'Cobrar en efectivo',
    ayuda: 'Pide un código y cóbralo con un Agente Divoox de tu ciudad.',
    disponibles: 'Ganancias que puedes cobrar',
    cobrar: 'Cobrar en efectivo',
    monto: 'Monto (dólares)',
    todo: 'Todo lo que puedo',
    limites: (a: string, b: string) => `Entre ${a} y ${b}.`,
    enteros: 'En efectivo se entregan dólares enteros. El resto se queda en tu billetera.',
    recibes: 'Recibes en la mano',
    tasa: (t: string) => `Tasa de hoy: Bs. ${t} por dólar. Queda fija al pedir el código.`,
    sinTasa: 'Todavía no hay tasa del día. Intenta en unos minutos.',
    pedir: 'Pedir mi código',
    cancelar: 'Cancelar',
    pocas: (m: string) => `Necesitas al menos ${m} en ganancias para cobrar en efectivo.`,
    tuCodigo: 'Tu código de cobro',
    muestra: 'Muéstrale este código al agente. No lo compartas con nadie más.',
    apartado: 'Apartado de tus ganancias',
    vence: (h: string) => `Vale hasta ${h}. Si no lo usas, el dinero vuelve a tus ganancias.`,
    cancelarCodigo: 'Cancelar el código',
    seguro: 'Al cancelarlo, el dinero vuelve a tus ganancias y el código deja de servir.',
    siCancelar: 'Sí, cancelar el código',
    noCancelar: 'Dejarlo como está',
    donde: 'Dónde cobrar',
    historial: 'Tus cobros en efectivo',
    estados: {
      pagado: 'Cobrado',
      vencido: 'Se venció: volvió a tus ganancias',
      cancelado: 'Cancelado: volvió a tus ganancias',
    } as Record<string, string>,
  },
  en: {
    titulo: 'Cash out',
    ayuda: 'Get a code and collect your cash from a Divoox Agent in your city.',
    disponibles: 'Earnings you can cash out',
    cobrar: 'Cash out',
    monto: 'Amount (dollars)',
    todo: 'Everything I can',
    limites: (a: string, b: string) => `Between ${a} and ${b}.`,
    enteros: 'Cash is paid in whole dollars. The rest stays in your wallet.',
    recibes: 'You get in hand',
    tasa: (t: string) => `Today’s rate: Bs. ${t} per dollar. It’s locked in when you get the code.`,
    sinTasa: 'Today’s rate isn’t available yet. Try again in a few minutes.',
    pedir: 'Get my code',
    cancelar: 'Cancel',
    pocas: (m: string) => `You need at least ${m} in earnings to cash out.`,
    tuCodigo: 'Your cash-out code',
    muestra: 'Show this code to the agent. Don’t share it with anyone else.',
    apartado: 'Set aside from your earnings',
    vence: (h: string) =>
      `Valid until ${h}. If you don’t use it, the money goes back to your earnings.`,
    cancelarCodigo: 'Cancel the code',
    seguro: 'If you cancel it, the money goes back to your earnings and the code stops working.',
    siCancelar: 'Yes, cancel the code',
    noCancelar: 'Keep it',
    donde: 'Where to collect',
    historial: 'Your cash-outs',
    estados: {
      pagado: 'Collected',
      vencido: 'Expired: back in your earnings',
      cancelado: 'Canceled: back in your earnings',
    } as Record<string, string>,
  },
};

type Cobro = {
  id: string;
  monto: number;
  moneda: string;
  pagaEn: string;
  refTasa: number | null;
  refMonto: number | null;
  codigo?: string;
  estado: string;
  expiraEn: string;
  pagadoEn: string | null;
  creadoEn: string;
  agente: string | null;
};
type Estado = {
  disponible: boolean;
  moneda: string;
  pagaEn: 'USD' | 'VES';
  minimo: number;
  maximo: number;
  ganancias: number;
  tasa: { tasa: number; fecha: string } | null;
  sinTasa: boolean;
  vivo: Cobro | null;
  agentes: { nombre: string; direccion: string; horario: string; telefono: string | null }[];
  historial: Cobro[];
};

const tarjeta = {
  borderWidth: 1,
  borderColor: '#2a2a2a',
  borderRadius: 12,
  padding: 12,
  gap: 8,
  backgroundColor: '#fff',
} as const;

/** Las fechas del servidor vienen en UTC («2026-11-18 14:05:00»). */
const cuando = (sql: string, idioma: Idioma) => {
  const d = new Date(`${sql.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime())
    ? sql
    : d.toLocaleString(idioma === 'es' ? 'es' : 'en-US', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
};
const aCentavos = (s: string) => Math.round(Number(s.replace(',', '.') || 0) * 100);

export function CobrarEfectivo({
  api,
  idioma,
  cuenta,
  alCambiar,
}: {
  api: Api;
  idioma: Idioma;
  /** El id del conductor: el borrador del monto es suyo. */
  cuenta?: string;
  /** Las ganancias cambiaron (se apartó o volvió dinero): la pantalla de arriba se refresca. */
  alCambiar?: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [e, setE] = useState<Estado | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: 'driver-cobrar-efectivo',
    cuenta,
    inicial: { monto: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const leer = useCallback(
    () => api.pedir<Estado>('GET', '/datos/repartidor/cobro-efectivo'),
    [api],
  );
  useEffect(() => {
    let vivo = true;
    leer()
      .then((d) => {
        if (vivo) setE(d);
      })
      // Una versión del servidor sin esta función, o sin ciudad: la tarjeta no aparece.
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [leer]);
  // Sin el servicio en su ciudad y sin cobros anteriores no se muestra nada.
  if (!e || (!e.disponible && !e.vivo && e.historial.length === 0)) return null;
  const dinero = (c: number) => formatearMonto(c, e.moneda, idioma);
  const bolivares = (monto: number | null, tasa: number | null) =>
    monto == null ? '' : textoLocal({ moneda: 'VES', monto, tasa: tasa ?? 0, fecha: '' }, idioma);
  const monto = aCentavos(b.valores.monto);
  const montoOk =
    Number.isSafeInteger(monto) &&
    monto >= e.minimo &&
    monto <= e.maximo &&
    (e.pagaEn === 'VES' || monto % 100 === 0);
  async function hacer(accion: () => Promise<unknown>) {
    setError('');
    setOcupado(true);
    try {
      await accion();
      setE(await leer());
      alCambiar?.();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }
  const pedir = () =>
    hacer(async () => {
      await api.pedir('POST', '/datos/repartidor/cobro-efectivo', { monto });
      await b.limpiar();
      setPidiendo(false);
    });
  const cancelar = () =>
    hacer(async () => {
      await api.pedir('DELETE', '/datos/repartidor/cobro-efectivo');
      setCancelando(false);
    });
  const vivo = e.vivo;
  return (
    <View style={tarjeta} testID="cobrar-efectivo">
      <Text style={{ fontWeight: '800', fontSize: 18, color: C.secundario }}>{t.titulo}</Text>
      {vivo ? (
        <View style={{ gap: 8 }} testID="cobro-vivo">
          <Text style={{ color: '#666B73' }}>{t.muestra}</Text>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ color: '#666B73', fontSize: 12 }}>{t.tuCodigo}</Text>
            <CodigoQR
              texto={vivo.codigo ?? ''}
              numero={`${(vivo.codigo ?? '').slice(0, 3)} ${(vivo.codigo ?? '').slice(3)}`}
              tamano={180}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: C.secundario }}>{t.apartado}</Text>
            <Text style={{ fontWeight: '800', color: C.secundario }}>{dinero(vivo.monto)}</Text>
          </View>
          {vivo.pagaEn === 'VES' && vivo.refMonto != null ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: C.secundario }}>{t.recibes}</Text>
              <Text style={{ fontWeight: '800', color: C.secundario }} testID="cobro-en-mano">
                {bolivares(vivo.refMonto, vivo.refTasa)}
              </Text>
            </View>
          ) : null}
          <Text style={{ color: '#666B73', fontSize: 12 }}>
            {t.vence(cuando(vivo.expiraEn, idioma))}
          </Text>
          {e.agentes.length ? (
            <View style={{ gap: 4 }} testID="cobro-agentes">
              <Text style={{ fontWeight: '800', color: C.secundario }}>{t.donde}</Text>
              {e.agentes.map((a) => (
                <View key={`${a.nombre}-${a.direccion}`}>
                  <Text style={{ color: C.secundario, fontWeight: '700' }}>{a.nombre}</Text>
                  {a.direccion ? <Text style={{ color: '#666B73' }}>{a.direccion}</Text> : null}
                  {a.horario ? <Text style={{ color: '#666B73' }}>{a.horario}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
          {cancelando ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.secundario }}>{t.seguro}</Text>
              <Boton texto={t.siCancelar} cargando={ocupado} alTocar={() => void cancelar()} />
              <Boton texto={t.noCancelar} secundario alTocar={() => setCancelando(false)} />
            </View>
          ) : (
            <Boton texto={t.cancelarCodigo} secundario alTocar={() => setCancelando(true)} />
          )}
        </View>
      ) : e.disponible ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#666B73' }}>{t.ayuda}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: C.secundario }}>{t.disponibles}</Text>
            <Text style={{ fontWeight: '800', color: C.exito }} testID="cobro-disponible">
              {dinero(e.maximo)}
            </Text>
          </View>
          {e.maximo < e.minimo ? (
            <Text style={{ color: '#666B73', fontSize: 12 }}>{t.pocas(dinero(e.minimo))}</Text>
          ) : e.sinTasa ? (
            <Text style={{ color: C.primario, fontSize: 12 }}>{t.sinTasa}</Text>
          ) : pidiendo ? (
            <View style={{ gap: 6 }} testID="cobro-formulario">
              <AvisoBorrador
                visible={b.recuperado}
                idioma={idioma}
                empezar={() => void b.empezarDeNuevo()}
              />
              <Campo
                etiqueta={t.monto}
                value={b.valores.monto}
                onChangeText={(x) => b.cambiar('monto', x.replace(/[^\d.,]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <Boton
                texto={`${t.todo}: ${dinero(e.maximo)}`}
                secundario
                alTocar={() => b.cambiar('monto', String(e.maximo / 100))}
              />
              <Text style={{ color: '#666B73', fontSize: 12 }}>
                {t.limites(dinero(e.minimo), dinero(e.maximo))}
                {e.pagaEn === 'USD' ? ` ${t.enteros}` : ''}
              </Text>
              {e.pagaEn === 'VES' && e.tasa ? (
                <>
                  <Text style={{ color: '#666B73', fontSize: 12 }}>
                    {t.tasa(
                      e.tasa.tasa.toLocaleString(idioma === 'es' ? 'es' : 'en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      }),
                    )}
                  </Text>
                  {montoOk ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: C.secundario }}>{t.recibes}</Text>
                      <Text style={{ fontWeight: '800', color: C.secundario }}>
                        {bolivares(Math.round(monto * e.tasa.tasa), e.tasa.tasa)}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}
              <Boton
                texto={t.pedir}
                exito
                cargando={ocupado}
                alTocar={() => {
                  if (montoOk) void pedir();
                  else setError(t.limites(dinero(e.minimo), dinero(e.maximo)));
                }}
              />
              <Boton texto={t.cancelar} secundario alTocar={() => setPidiendo(false)} />
            </View>
          ) : (
            <Boton texto={t.cobrar} exito alTocar={() => setPidiendo(true)} testID="cobro-abrir" />
          )}
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
          {error}
        </Text>
      ) : null}
      {e.historial.length ? (
        <View style={{ gap: 4 }} testID="cobro-historial">
          <Text style={{ fontWeight: '800', color: C.secundario }}>{t.historial}</Text>
          {e.historial.map((c) => (
            <View
              key={c.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
            >
              <Text style={{ color: '#666B73', flex: 1 }}>
                {cuando(c.pagadoEn ?? c.creadoEn, idioma)} ·{' '}
                {new Map(Object.entries(t.estados)).get(c.estado) ?? c.estado}
                {c.agente && c.estado === 'pagado' ? ` · ${c.agente}` : ''}
              </Text>
              <Text style={{ color: c.estado === 'pagado' ? C.exito : '#666B73' }}>
                {dinero(c.monto)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
