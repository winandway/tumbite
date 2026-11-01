import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ErrorApi, enIdioma, formatearMonto } from '@tumbite/compartido';
import { Boton, e, useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Encabezado, Tarjeta } from '../comida/piezas';
import { PagoTarjeta } from '../PagoTarjeta';
import type { Cobro } from '../pagoTipos';

/**
 * C-PLUS (R-T3, como DashPass): suscribirse, ver hasta cuándo está vigente y cancelar. El cobro
 * mensual lo hace Stripe; la suscripción se activa cuando llega su aviso firmado de pago.
 */
const T = {
  es: {
    titulo: 'Divoox Plus',
    intro: 'Ahorra en cada pedido con una cuota mensual.',
    envio: 'Envío gratis',
    servicio: (pct: number) => `${pct} % menos en el cargo de servicio`,
    minimo: (m: string) => `En pedidos desde ${m}`,
    precio: (p: string) => `${p} al mes. Se renueva solo; cancelas cuando quieras.`,
    suscribirme: 'Suscribirme',
    pagar: 'Pagar la suscripción',
    cargando: 'Preparando el pago…',
    sinFormulario: 'No pudimos abrir el pago. Intenta otra vez.',
    reintentar: 'Intentar otra vez',
    confirmando: 'Confirmando tu pago…',
    activo: 'Tienes Divoox Plus.',
    renueva: (f: string) => `Se renueva el ${f}.`,
    termina: (f: string) => `Cancelada: sigue vigente hasta el ${f}.`,
    cancelar: 'Cancelar Divoox Plus',
    cancelada: 'Listo: no se renovará.',
    pronto: 'Divoox Plus llega muy pronto.',
  },
  en: {
    titulo: 'Divoox Plus',
    intro: 'Save on every order with a monthly membership.',
    envio: 'Free delivery',
    servicio: (pct: number) => `${pct}% off the service fee`,
    minimo: (m: string) => `On orders of ${m} or more`,
    precio: (p: string) => `${p} a month. Renews automatically; cancel anytime.`,
    suscribirme: 'Join',
    pagar: 'Pay for membership',
    cargando: 'Getting payment ready…',
    sinFormulario: 'We couldn’t open the payment. Try again.',
    reintentar: 'Try again',
    confirmando: 'Confirming your payment…',
    activo: 'You have Divoox Plus.',
    renueva: (f: string) => `Renews on ${f}.`,
    termina: (f: string) => `Canceled: active until ${f}.`,
    cancelar: 'Cancel Divoox Plus',
    cancelada: 'Done: it won’t renew.',
    pronto: 'Divoox Plus is coming very soon.',
  },
};

export type EstadoPlus = {
  disponible: boolean;
  centavosMes: number;
  minimoSubtotal: number;
  servicioDescuentoPct: number;
  activo: boolean;
  suscripcion: { estado: string; venceEn: string | null; cancelaAlFinal: boolean } | null;
};

export default function Plus() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<EstadoPlus | null>(null);
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(
    () =>
      api
        .pedir<EstadoPlus>('GET', '/datos/plus')
        .then((r) => {
          setEstado(r);
          return r;
        })
        .catch((x: unknown) => {
          setError(x instanceof ErrorApi ? x.message : String(x));
          return null;
        }),
    [api],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function suscribirme() {
    setError('');
    setOcupado(true);
    try {
      const r = await api.pedir<{
        clientSecret: string;
        sesionCliente: string;
        clienteStripe: string;
        clavePublica: string;
      }>('POST', '/datos/plus/suscribirse', {});
      setCobro({ pedidoId: 'plus', ...r });
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  // Pagado en la hoja: se espera el aviso firmado de Stripe (unos segundos) antes de decir que está activa.
  async function alPagar() {
    setCobro(null);
    setAviso(t.confirmando);
    for (let i = 0; i < 10; i++) {
      const r = await cargar();
      if (r?.activo) return setAviso('');
      await new Promise((ok) => setTimeout(ok, 2000));
    }
    setAviso('');
  }

  async function cancelar() {
    setError('');
    setOcupado(true);
    try {
      await api.pedir('POST', '/datos/plus/cancelar', {});
      setAviso(t.cancelada);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  const fecha = (iso: string | null) =>
    iso
      ? new Date(`${iso.replace(' ', 'T')}Z`).toLocaleDateString(
          idioma === 'en' ? 'en-US' : 'es-US',
          {
            month: 'long',
            day: 'numeric',
          },
        )
      : '';
  const dinero = (c: number) => formatearMonto(c, 'USD', idioma);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      <Encabezado titulo={t.titulo} alVolver={() => router.back()} etiquetaVolver="‹" />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
      >
        {estado && !estado.disponible ? <Text testID="plus-pronto">{t.pronto}</Text> : null}
        {estado?.disponible ? (
          <Tarjeta>
            <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 6 }}>{t.intro}</Text>
            <Text>{t.envio}</Text>
            <Text>{t.servicio(estado.servicioDescuentoPct)}</Text>
            <Text style={{ color: '#5E5E5E' }}>{t.minimo(dinero(estado.minimoSubtotal))}</Text>
            <Text style={{ marginTop: 8, fontWeight: '700' }}>
              {t.precio(dinero(estado.centavosMes))}
            </Text>
          </Tarjeta>
        ) : null}
        {estado?.activo ? (
          <Tarjeta>
            {/* Algo que salió bien va en verde. */}
            <Text style={{ fontWeight: '700', color: '#0d7a3a' }}>{t.activo}</Text>
            <Text>
              {estado.suscripcion?.cancelaAlFinal
                ? t.termina(fecha(estado.suscripcion.venceEn))
                : t.renueva(fecha(estado.suscripcion?.venceEn ?? null))}
            </Text>
            {!estado.suscripcion?.cancelaAlFinal ? (
              <Boton
                texto={t.cancelar}
                secundario
                alTocar={() => void cancelar()}
                cargando={ocupado}
              />
            ) : null}
          </Tarjeta>
        ) : null}
        {estado?.disponible && !estado.activo && !cobro && !aviso ? (
          <Boton texto={t.suscribirme} alTocar={() => void suscribirme()} cargando={ocupado} />
        ) : null}
        {cobro ? (
          <PagoTarjeta
            cobro={cobro}
            clavePublica={cobro.clavePublica ?? ''}
            idioma={idioma}
            textos={{
              pagar: t.pagar,
              cargando: t.cargando,
              sinFormulario: t.sinFormulario,
              reintentar: t.reintentar,
            }}
            alPagar={() => void alPagar()}
          />
        ) : null}
        {aviso ? <Text style={{ marginTop: 10 }}>{aviso}</Text> : null}
        {error ? (
          <Text style={[e.error, { marginTop: 10 }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
