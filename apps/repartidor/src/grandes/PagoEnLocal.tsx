import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  type Api,
  ErrorApi,
  type Idioma,
  formatearMonto,
  montoATexto,
  textoAMonto,
} from '@tumbite/compartido';
import { Boton, C, e } from '@tumbite/movil';
import { textosGrandes } from './textos';

type Datos = {
  montoEsperado: number;
  subtotal: number;
  /** Moneda del pedido (USD, COP, VES…): los montos van en su unidad menor. */
  moneda?: string;
  registrado: {
    montoPagado: number;
    importeTicket: number;
    metodo: 'efectivo' | 'tarjeta_propia';
    diferenciaPago: number;
    diferenciaTicket: number;
    conFotoTicket?: boolean;
  } | null;
};

/**
 * Cobro directo, pasos 2 y 3 del recorrido aprobado (C-COBRO-DIRECTO-LOCAL): el repartidor paga la
 * comida en el mostrador con SU dinero (efectivo o su tarjeta), anota cuánto pagó y cuánto dice el
 * ticket, y entrega el ticket con el pedido. Divoox no presta ni financia esta compra.
 */
export function PagoEnLocal({
  api,
  idioma,
  pedidoId,
  alRegistrar,
  fotoTicket,
}: {
  api: Api;
  idioma: Idioma;
  pedidoId: string;
  alRegistrar: () => void;
  /** Toma la foto del ticket con la cámara y la sube (la misma función de las otras fotos). */
  fotoTicket?: () => Promise<void>;
}) {
  const t = textosGrandes(idioma).local;
  const [d, setD] = useState<Datos | null>(null);
  const [pagado, setPagado] = useState('');
  const [ticket, setTicket] = useState('');
  const [metodo, setMetodo] = useState<'efectivo' | 'tarjeta_propia'>('efectivo');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await api.pedir<Datos>('GET', `/datos/repartidor/pedidos/${pedidoId}/pago-local`);
        if (!vivo) return;
        setD(r);
        setPagado(montoATexto(r.montoEsperado, r.moneda));
        setTicket(montoATexto(r.subtotal, r.moneda));
      } catch (x) {
        if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [api, pedidoId]);

  async function registrar() {
    const montoPagado = textoAMonto(pagado, d?.moneda);
    const importeTicket = textoAMonto(ticket, d?.moneda);
    if (!(montoPagado > 0) || !(importeTicket > 0)) return setError(t.montoInvalido);
    setError('');
    setEnviando(true);
    try {
      const r = await api.pedir<{ registrado: Datos['registrado'] }>(
        'POST',
        `/datos/repartidor/pedidos/${pedidoId}/pago-local`,
        { montoPagado, importeTicket, metodo },
      );
      setD((v) => (v ? { ...v, registrado: r.registrado } : v));
      alRegistrar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (!d) return error ? <Text style={{ color: '#c4001d' }}>{error}</Text> : null;
  const reg = d.registrado;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#2a2a2a',
        borderRadius: 12,
        padding: 12,
        gap: 8,
        backgroundColor: '#fff',
        marginTop: 8,
      }}
      testID="pago-en-local"
    >
      <Text style={{ fontWeight: '900', color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E' }}>
        {t.paga}{' '}
        <Text style={{ fontWeight: '900', color: C.secundario }}>
          {formatearMonto(d.montoEsperado, d.moneda, idioma)}
        </Text>
      </Text>
      <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
        {t.explica.replace('{comida}', formatearMonto(d.subtotal, d.moneda, idioma))}
      </Text>
      {reg ? (
        <>
          <Text style={{ color: C.exito, fontWeight: '800' }} accessibilityRole="alert">
            {t.registrado}
          </Text>
          <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
            {t.resumen
              .replace('{pagado}', formatearMonto(reg.montoPagado, d.moneda, idioma))
              .replace('{ticket}', formatearMonto(reg.importeTicket, d.moneda, idioma))
              .replace('{metodo}', reg.metodo === 'efectivo' ? t.efectivo : t.tarjeta)}
          </Text>
          {reg.diferenciaPago !== 0 || reg.diferenciaTicket !== 0 ? (
            <Text style={{ color: '#c4001d', fontSize: 13 }}>{t.conDiferencia}</Text>
          ) : null}
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.entregaTicket}</Text>
          {reg.conFotoTicket ? (
            <Text style={{ color: C.exito, fontWeight: '700', fontSize: 13 }}>
              {t.fotoTicketOk}
            </Text>
          ) : fotoTicket ? (
            <Boton
              texto={t.fotoTicket}
              alTocar={() =>
                void fotoTicket().then(async () => {
                  const r = await api
                    .pedir<Datos>('GET', `/datos/repartidor/pedidos/${pedidoId}/pago-local`)
                    .catch(() => null);
                  if (r) setD(r);
                })
              }
              secundario
            />
          ) : null}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['efectivo', 'tarjeta_propia'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMetodo(m)}
                accessibilityRole="radio"
                accessibilityState={{ selected: metodo === m }}
                accessibilityLabel={m === 'efectivo' ? t.efectivo : t.tarjeta}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: metodo === m ? C.primario : '#DADADA',
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <Text
                  style={{ fontWeight: '800', color: metodo === m ? C.primario : C.secundario }}
                >
                  {m === 'efectivo' ? t.efectivo : t.tarjeta}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: C.secundario, fontWeight: '700' }}>{t.cuantoPagaste}</Text>
          <TextInput
            value={pagado}
            onChangeText={setPagado}
            accessibilityLabel={t.cuantoPagaste}
            keyboardType="decimal-pad"
            style={e.input}
          />
          <Text style={{ color: C.secundario, fontWeight: '700' }}>{t.importeTicket}</Text>
          <TextInput
            value={ticket}
            onChangeText={setTicket}
            accessibilityLabel={t.importeTicket}
            keyboardType="decimal-pad"
            style={e.input}
          />
          <Boton texto={t.registrar} alTocar={() => void registrar()} cargando={enviando} exito />
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.tuDinero}</Text>
        </>
      )}
      {error ? (
        <Text style={{ color: '#c4001d' }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
