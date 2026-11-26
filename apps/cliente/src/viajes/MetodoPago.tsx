import { Image, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type CotizacionViaje,
  type Idioma,
  type MetodoPagoViaje,
  TEXTO_METODO_NO_DISPONIBLE,
  enManoCon,
  esPagoACelular,
  formatearMonto,
  nombreFormaPago,
  pagaEnMano,
  textoLocal,
} from '@tumbite/compartido';
import { C, COLOR, Icono, MontoEnMano, type NombreIcono, Text } from '@tumbite/movil';
import { IMG_COMIDA } from '../comida/recursos';
import { BotonGrande } from './BotonGrande';
import { decisionDePago, metodoDisponible } from './decisionPago';

/**
 * C-METODO-PAGO-PANTALLA (25 nov 2026, Venezuela; sirve a todos los países con los métodos de su
 * perfil). La pantalla «Método de pago», entre la cotización y la solicitud, como la hoja de pago de
 * las apps grandes de viajes de la región: arriba «Monto a pagar» grande (dólares y bolívares con la
 * tasa del BCV y su fecha, la misma pieza `MontoEnMano`), la tarjeta del Saldo Divoox con el isotipo
 * (lo disponible, un interruptor y el desglose en vivo), las formas de pago del país como opciones de
 * radio (lo que cubre el resto) y abajo el botón rojo «Solicitar …». Un método que no se puede usar
 * en este viaje sale apagado con «Aún no disponible para este viaje», nunca una ventana de error.
 *
 * No guarda nada: lo elegido vive en el borrador de Pedir viaje (no se pierde al cerrar) y la cuenta
 * de dinero la hace el servidor con la misma regla (`cuentaConSaldo`).
 */
export const TEXTOS_METODO_PAGO = {
  es: {
    titulo: 'Método de pago',
    volver: 'Volver',
    montoAPagar: 'Monto a pagar',
    saldo: 'Saldo Divoox',
    disponible: (m: string) => `Disponible: ${m}`,
    usarSaldo: 'Usar mi Saldo Divoox',
    sinSaldo: 'Sin saldo por ahora',
    saldoSoloAhora: 'El saldo se usa en los viajes de ahora, no en las reservas.',
    usas: (m: string) => `Usas ${m} de tu saldo`,
    tePaga: 'Pagas todo con tu saldo. No pagas nada en mano.',
    quedaPorPagar: 'Te queda por pagar',
    teQueda: (m: string) => `Te quedará ${m} de saldo.`,
    comoPagas: 'Cómo pagas',
    comoPagasResto: 'Cómo pagas el resto',
    ayudas: {
      efectivo: 'Le pagas al conductor al terminar.',
      pago_movil: 'Le pagas al conductor por Pago Móvil; ves sus datos cuando acepta.',
      tarjeta: 'Se autoriza al pedir y se cobra al terminar.',
      celular: (n: string) => `Le pagas al conductor por ${n}; ves sus datos cuando acepta.`,
    },
    pasamosAEfectivo: 'Pago Móvil no está disponible para este viaje: elegimos Efectivo.',
    faltaElegir: 'Elige cómo pagas el resto para seguir.',
    nombres: { efectivo: 'Efectivo', pago_movil: 'Pago Móvil', tarjeta: 'Tarjeta' },
  },
  en: {
    titulo: 'Payment method',
    volver: 'Back',
    montoAPagar: 'Amount to pay',
    saldo: 'Divoox Balance',
    disponible: (m: string) => `Available: ${m}`,
    usarSaldo: 'Use my Divoox Balance',
    sinSaldo: 'No balance right now',
    saldoSoloAhora: 'Your balance works on rides now, not on scheduled rides.',
    usas: (m: string) => `You use ${m} of your balance`,
    tePaga: 'You pay it all with your balance. Nothing to pay in person.',
    quedaPorPagar: 'Left to pay',
    teQueda: (m: string) => `You’ll have ${m} of balance left.`,
    comoPagas: 'How you pay',
    comoPagasResto: 'How you pay the rest',
    ayudas: {
      efectivo: 'You pay the driver when the ride ends.',
      pago_movil: 'You pay the driver by Pago Móvil; you’ll see their details when they accept.',
      tarjeta: 'Authorized when you request and charged when the ride ends.',
      celular: (n: string) =>
        `You pay the driver with ${n}; you’ll see their details when they accept.`,
    },
    pasamosAEfectivo: 'Pago Móvil isn’t available for this trip: we picked Cash.',
    faltaElegir: 'Choose how you’ll pay the rest to continue.',
    nombres: { efectivo: 'Cash', pago_movil: 'Pago Móvil', tarjeta: 'Card' },
  },
} as const;

const ICONOS: Partial<Record<MetodoPagoViaje, NombreIcono>> = {
  efectivo: 'cash-outline',
  pago_movil: 'phone-portrait-outline',
  tarjeta: 'card-outline',
  yape: 'phone-portrait-outline',
  plin: 'phone-portrait-outline',
};

export function MetodoPago({
  cotizacion,
  idioma,
  metodo,
  cambiarMetodo,
  usarSaldo,
  cambiarUsarSaldo,
  reserva,
  textoBoton,
  trabajando,
  error,
  alSolicitar,
  volver,
}: {
  cotizacion: CotizacionViaje;
  idioma: Idioma;
  metodo: string;
  cambiarMetodo: (m: MetodoPagoViaje) => void;
  usarSaldo: boolean;
  cambiarUsarSaldo: (v: boolean) => void;
  /** Viaje reservado para después: el saldo no se usa (el servidor también lo frena). */
  reserva: boolean;
  textoBoton: string;
  trabajando: boolean;
  /** El error del servidor al pedir, en palabras (la pantalla sigue con todo lo elegido). */
  error: string;
  alSolicitar: (cuerpo: { metodoPago: string; usarSaldo?: boolean }) => void;
  volver: () => void;
}) {
  const t = idioma === 'en' ? TEXTOS_METODO_PAGO.en : TEXTOS_METODO_PAGO.es;
  const i = idioma === 'en' ? 'en' : 'es';
  const moneda = cotizacion.moneda;
  const dinero = (c: number) => formatearMonto(c, moneda, idioma);
  const metodos = cotizacion.metodosPago ?? ['efectivo', 'tarjeta'];
  const saldo = cotizacion.saldoDivoox ?? null;
  // C-PAGO-MOVIL-DISPONIBLE: si lo elegido (de antes) no se puede usar en este viaje, va Efectivo con
  // una línea discreta. Nunca una ventana de error. Lo elegido sigue guardado para el próximo viaje.
  const paso =
    !metodoDisponible(cotizacion, metodo) &&
    metodos.some((m) => m === 'efectivo' && metodoDisponible(cotizacion, m));
  const metodoVigente = paso ? 'efectivo' : metodo;
  const d = decisionDePago(cotizacion, { metodo: metodoVigente, usarSaldo, reserva });
  // Arriba, lo que cuesta el viaje (después del regalo de código): en dólares y en bolívares.
  const arriba = cotizacion.enMano ?? null;
  const resto = enManoCon(arriba, d.resto);
  const bsDe = (c: number) => {
    const m = enManoCon(arriba, c);
    return m?.local ? textoLocal(m.local, i) : '';
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="metodo-pago">
      <View
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 52 }}
      >
        <Pressable
          onPress={volver}
          accessibilityRole="button"
          accessibilityLabel={t.volver}
          hitSlop={10}
          testID="pago-volver"
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icono nombre="chevron-back" tamano={24} color={C.secundario} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', marginRight: 44 }}
        >
          {t.titulo}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 24,
          gap: 16,
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
        }}
      >
        {/* «Monto a pagar»: la cifra grande y, debajo, los bolívares con la tasa y su fecha. */}
        <View testID="pago-monto" style={{ alignItems: 'center', gap: 2, paddingVertical: 4 }}>
          <Text style={{ color: COLOR.textoSuave, fontWeight: '700' }}>{t.montoAPagar}</Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{ fontSize: 36, fontWeight: '700', color: C.secundario }}
          >
            {dinero(d.despuesDelRegalo)}
          </Text>
          {arriba ? (
            <MontoEnMano
              monto={enManoCon(arriba, d.despuesDelRegalo)}
              idioma={i}
              quien="pasajero"
              soloLocal
              testID="pago-monto-bs"
            />
          ) : null}
        </View>

        {/* C-SALDO-CLIENTE: la tarjeta del Saldo Divoox (solo donde el país lo tiene encendido). */}
        {saldo ? (
          <View
            testID="pago-saldo"
            style={{
              borderWidth: d.conSaldo ? 2 : 1,
              borderColor: d.conSaldo ? C.secundario : COLOR.borde,
              borderRadius: 16,
              padding: 14,
              gap: 10,
              opacity: saldo.disponible > 0 && !reserva ? 1 : 0.6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: COLOR.superficie,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={IMG_COMIDA.mascota}
                  style={{ width: 38, height: 26 }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                  accessibilityLabel="Divoox"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 16, color: C.secundario }}>
                  {t.saldo}
                </Text>
                <Text
                  style={{ color: COLOR.textoSuave, fontSize: 13 }}
                  testID="pago-saldo-disponible"
                >
                  {saldo.disponible > 0
                    ? `${t.disponible(dinero(saldo.disponible))}${bsDe(saldo.disponible) ? ` · ${bsDe(saldo.disponible)}` : ''}`
                    : t.sinSaldo}
                </Text>
              </View>
              <Switch
                value={d.conSaldo}
                disabled={saldo.disponible <= 0 || reserva}
                onValueChange={cambiarUsarSaldo}
                accessibilityLabel={t.usarSaldo}
                trackColor={{ true: C.exito, false: '#D6D8DC' }}
                testID="pago-saldo-usar"
              />
            </View>
            {reserva && saldo.disponible > 0 ? (
              <Text style={{ color: COLOR.textoSuave, fontSize: 13 }}>{t.saldoSoloAhora}</Text>
            ) : null}
            {d.conSaldo ? (
              <View testID="pago-saldo-desglose" style={{ gap: 2 }}>
                <Text style={{ color: C.exito, fontWeight: '700' }}>
                  {t.usas(dinero(d.saldoUsado))}
                </Text>
                {d.cubreTodo ? (
                  <Text style={{ color: C.exito }}>{t.tePaga}</Text>
                ) : (
                  <Text style={{ color: C.secundario }}>
                    {t.quedaPorPagar}: <Text style={{ fontWeight: '700' }}>{dinero(d.resto)}</Text>
                    {resto?.local ? ` · ${textoLocal(resto.local, i)}` : ''}
                  </Text>
                )}
                <Text style={{ color: COLOR.textoSuave, fontSize: 13 }}>
                  {t.teQueda(dinero(d.saldoQueQueda))}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Las formas de pago del país (lo que cubre el resto). Con todo pagado con saldo, no hace falta. */}
        {d.cubreTodo ? null : (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.secundario }}>
              {d.conSaldo ? t.comoPagasResto : t.comoPagas}
            </Text>
            <View accessibilityRole="radiogroup" style={{ gap: 8 }} testID="pago-metodos">
              {metodos.map((m) => {
                const puede = metodoDisponible(cotizacion, m);
                const elegido = metodoVigente === m && puede;
                const nombre =
                  new Map<string, string>(Object.entries(t.nombres)).get(m) ??
                  nombreFormaPago(m, idioma);
                const ayuda = !puede
                  ? i === 'en'
                    ? TEXTO_METODO_NO_DISPONIBLE.en
                    : TEXTO_METODO_NO_DISPONIBLE.es
                  : m === 'efectivo'
                    ? t.ayudas.efectivo
                    : m === 'pago_movil'
                      ? t.ayudas.pago_movil
                      : m === 'tarjeta'
                        ? t.ayudas.tarjeta
                        : esPagoACelular(m)
                          ? t.ayudas.celular(nombre)
                          : '';
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      if (!puede) return;
                      cambiarMetodo(m);
                    }}
                    disabled={!puede}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: elegido, disabled: !puede }}
                    aria-checked={elegido}
                    testID={`pago-metodo-${m}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      minHeight: 64,
                      borderRadius: 16,
                      borderWidth: elegido ? 2 : 1,
                      borderColor: elegido ? C.secundario : COLOR.borde,
                      backgroundColor: puede ? '#FFFFFF' : COLOR.superficie,
                    }}
                  >
                    <Icono
                      nombre={new Map(Object.entries(ICONOS)).get(m) ?? 'wallet-outline'}
                      tamano={24}
                      color={puede ? C.secundario : COLOR.iconoApagado}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontWeight: '700',
                          fontSize: 16,
                          color: puede ? C.secundario : COLOR.textoTenue,
                        }}
                      >
                        {nombre}
                      </Text>
                      {ayuda ? (
                        <Text
                          style={{ color: COLOR.textoSuave, fontSize: 13 }}
                          testID={puede ? undefined : `pago-metodo-${m}-apagado`}
                        >
                          {ayuda}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: elegido ? C.secundario : COLOR.bordeFuerte,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {elegido ? (
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: C.secundario,
                          }}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {paso ? (
              <Text testID="pago-paso-efectivo" style={{ color: COLOR.textoSuave, fontSize: 13 }}>
                {t.pasamosAEfectivo}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
      <SafeAreaView
        edges={['bottom']}
        style={{ borderTopWidth: 1, borderColor: COLOR.borde, backgroundColor: '#FFFFFF' }}
      >
        <View
          style={{
            padding: 16,
            paddingBottom: 8,
            gap: 8,
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
          }}
        >
          {error ? (
            <Text accessibilityRole="alert" style={{ color: C.acento, fontWeight: '700' }}>
              {error}
            </Text>
          ) : d.falta ? (
            <Text testID="pago-por-que" style={{ color: COLOR.textoSuave }}>
              {t.faltaElegir}
            </Text>
          ) : null}
          <BotonGrande
            texto={
              d.cubreTodo || d.resto === 0
                ? textoBoton
                : `${textoBoton} · ${dinero(pagaEnMano(cotizacion.total, d.conSaldo || metodoVigente !== 'tarjeta' ? cotizacion.regalo : null, d.saldoUsado))}`
            }
            alTocar={() => alSolicitar(d.cuerpo)}
            apagado={d.falta}
            cargando={trabajando}
            testID="pago-solicitar"
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
