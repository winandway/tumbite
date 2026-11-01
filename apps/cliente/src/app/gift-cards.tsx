import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ErrorApi, enIdioma, formatearMonto, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  Campo,
  alSalirTelefono,
  almacenTelefono,
  e,
  useSesion,
} from '@tumbite/movil';
import { ANCHO_MAX, Encabezado, Tarjeta } from '../comida/piezas';
import { PagoTarjeta } from '../PagoTarjeta';
import type { Cobro } from '../pagoTipos';

/**
 * C-TARJETAS-REGALO (R-T4, como las tarjetas de regalo de DoorDash y Uber Eats): comprar una para
 * alguien (monto, correo y mensaje), canjear un código y ver el saldo de regalo.
 */
const T = {
  es: {
    titulo: 'Tarjetas de regalo',
    saldo: 'Tu saldo de regalo',
    usarlo: 'Se usa en el carrito al pagar.',
    canjear: 'Canjear un código',
    codigo: 'Código de la tarjeta',
    botonCanjear: 'Canjear',
    canjeada: 'Listo: se sumó a tu saldo.',
    regalar: 'Regala una tarjeta',
    monto: (min: string, max: string) => `Monto (de ${min} a ${max})`,
    correo: 'Correo de quien la recibe',
    nombre: 'Su nombre (opcional)',
    mensaje: 'Mensaje (opcional)',
    comprar: 'Comprar y enviar',
    pagar: 'Pagar la tarjeta',
    cargando: 'Preparando el pago…',
    sinFormulario: 'No pudimos abrir el pago. Intenta otra vez.',
    reintentar: 'Intentar otra vez',
    enviada: 'Pagada. Le enviamos el código por correo.',
    pronto: 'Las tarjetas de regalo llegan muy pronto.',
  },
  en: {
    titulo: 'Gift cards',
    saldo: 'Your gift card balance',
    usarlo: 'You can use it in your cart at checkout.',
    canjear: 'Redeem a code',
    codigo: 'Gift card code',
    botonCanjear: 'Redeem',
    canjeada: 'Done: it was added to your balance.',
    regalar: 'Send a gift card',
    monto: (min: string, max: string) => `Amount (${min} to ${max})`,
    correo: 'Recipient’s email',
    nombre: 'Their name (optional)',
    mensaje: 'Message (optional)',
    comprar: 'Buy and send',
    pagar: 'Pay for gift card',
    cargando: 'Getting payment ready…',
    sinFormulario: 'We couldn’t open the payment. Try again.',
    reintentar: 'Try again',
    enviada: 'Paid. We emailed them the code.',
    pronto: 'Gift cards are coming very soon.',
  },
};

type Estado = { activas: boolean; minimo: number; maximo: number; saldo: number };

export default function TarjetasRegalo() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // Lo escrito se guarda solo y vuelve si la app se cierra (regla de formularios).
  const b = useBorrador({
    formulario: 'tarjeta-regalo',
    cuenta: usuario?.id,
    inicial: { codigo: '', monto: '', correo: '', nombre: '', mensaje: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  const cargar = useCallback(() => {
    api
      .pedir<Estado>('GET', '/datos/tarjetas-regalo')
      .then(setEstado)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  useEffect(cargar, [cargar]);

  const dinero = (c: number) => formatearMonto(c, 'USD', idioma);

  async function canjear() {
    setError('');
    setAviso('');
    setOcupado(true);
    try {
      await api.pedir('POST', '/datos/tarjetas-regalo/canjear', { codigo: b.valores.codigo });
      b.cambiar('codigo', '');
      setAviso(t.canjeada);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  async function comprar() {
    setError('');
    setAviso('');
    setOcupado(true);
    try {
      const r = await api.pedir<{
        tarjetaId: string;
        clientSecret: string;
        sesionCliente: string;
        clienteStripe: string;
        clavePublica: string;
      }>('POST', '/datos/tarjetas-regalo', {
        centavos: Math.round(Number(b.valores.monto || 0) * 100),
        paraCorreo: b.valores.correo.trim(),
        paraNombre: b.valores.nombre,
        mensaje: b.valores.mensaje,
      });
      setCobro({ pedidoId: r.tarjetaId, ...r });
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      <Encabezado titulo={t.titulo} alVolver={() => router.back()} etiquetaVolver="‹" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
      >
        {estado && !estado.activas ? <Text testID="tarjetas-pronto">{t.pronto}</Text> : null}
        {estado?.activas ? (
          <>
            <AvisoBorrador
              visible={b.recuperado}
              idioma={idioma}
              empezar={() => void b.empezarDeNuevo()}
            />
            <Tarjeta>
              <Text style={{ color: '#5E5E5E' }}>{t.saldo}</Text>
              <Text style={{ fontSize: 24, fontWeight: '700' }}>{dinero(estado.saldo)}</Text>
              <Text style={{ color: '#5E5E5E' }}>{t.usarlo}</Text>
            </Tarjeta>
            <Tarjeta>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>{t.canjear}</Text>
              <Campo
                etiqueta={t.codigo}
                value={b.valores.codigo}
                onChangeText={(v) => b.cambiar('codigo', v)}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Boton texto={t.botonCanjear} alTocar={() => void canjear()} cargando={ocupado} />
            </Tarjeta>
            <Tarjeta>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>{t.regalar}</Text>
              <Campo
                etiqueta={t.monto(dinero(estado.minimo), dinero(estado.maximo))}
                value={b.valores.monto}
                onChangeText={(v) => b.cambiar('monto', v)}
                keyboardType="decimal-pad"
              />
              <Campo
                etiqueta={t.correo}
                value={b.valores.correo}
                onChangeText={(v) => b.cambiar('correo', v)}
                keyboardType="email-address"
              />
              <Campo
                etiqueta={t.nombre}
                value={b.valores.nombre}
                onChangeText={(v) => b.cambiar('nombre', v)}
              />
              <Campo
                etiqueta={t.mensaje}
                value={b.valores.mensaje}
                onChangeText={(v) => b.cambiar('mensaje', v)}
                multiline
              />
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
                  alPagar={() => {
                    setCobro(null);
                    void b.limpiar();
                    setAviso(t.enviada);
                  }}
                />
              ) : (
                <Boton texto={t.comprar} alTocar={() => void comprar()} cargando={ocupado} />
              )}
            </Tarjeta>
          </>
        ) : null}
        {/* Lo que salió bien va en verde. */}
        {aviso ? <Text style={{ marginTop: 10, color: '#0d7a3a' }}>{aviso}</Text> : null}
        {error ? (
          <Text style={[e.error, { marginTop: 10 }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
