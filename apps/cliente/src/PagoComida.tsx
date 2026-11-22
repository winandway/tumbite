import * as ImagePicker from 'expo-image-picker';
import * as Portapapeles from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  REFERENCIA_PAGO_VALIDA,
  TEXTOS_PAGO_COMIDA_CLIENTE,
  type VistaPagoComida,
  enIdioma,
  formatearMonto,
  limpiarReferenciaPago,
  relojPago,
  segundosHasta,
  textoTasaUsada,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  Text,
  alSalirTelefono,
  almacenTelefono,
  fotoConCamara,
  useSesion,
} from '@tumbite/movil';

/**
 * C-COMIDA-PAGO-RESTAURANTE: el cliente le paga la COMIDA directo al restaurante por pago móvil.
 * La app muestra los datos del restaurante y el monto congelado con su cuenta atrás, y el cliente
 * escribe el número de referencia (obligatorio). La captura es opcional y nunca es la prueba: el
 * restaurante confirma mirando su banco. El envío se paga aparte, al conductor, al recibir.
 */
const CAMARA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 }),
};

const BORRADOR = { referencia: '', banco: '' };

const caja = {
  marginTop: 10,
  padding: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#2a2a2a',
  backgroundColor: '#fff',
} as const;

function Dato({
  etiqueta,
  valor,
  copiar,
  copiado,
  testID,
}: {
  etiqueta: string;
  valor: string;
  copiar: string;
  copiado: string;
  testID: string;
}) {
  const [hecho, setHecho] = useState(false);
  if (!valor) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#e6e6e6',
        gap: 8,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#666B73', fontSize: 12 }}>{etiqueta}</Text>
        <Text testID={testID} selectable style={{ color: C.secundario, fontWeight: '700' }}>
          {valor}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${copiar}: ${etiqueta}`}
        onPress={() => {
          void Portapapeles.setStringAsync(valor).then(() => {
            setHecho(true);
            setTimeout(() => setHecho(false), 2000);
          });
        }}
        style={{ paddingVertical: 6, paddingHorizontal: 10 }}
      >
        <Text style={{ color: hecho ? C.exito : C.secundario, fontWeight: '700', fontSize: 13 }}>
          {hecho ? copiado : copiar}
        </Text>
      </Pressable>
    </View>
  );
}

export function PagoComida({
  pedidoId,
  pago,
  alCambiar,
}: {
  pedidoId: string;
  pago: VistaPagoComida;
  /** Vuelve a leer el pedido cuando el pago cambió (referencia enviada, tiempo agotado). */
  alCambiar: () => void;
}) {
  const { api, idioma: idiomaSesion, usuario } = useSesion();
  const idioma = idiomaSesion === 'en' ? 'en' : 'es';
  const t = enIdioma(TEXTOS_PAGO_COMIDA_CLIENTE, idioma);
  const b = useBorrador({
    formulario: `pago-comida-${pedidoId}`,
    cuenta: usuario?.id,
    inicial: BORRADOR,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const [captura, setCaptura] = useState<Blob | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restan, setRestan] = useState(() => segundosHasta(pago.venceEn, Date.now()));

  // La cuenta atrás corre en el aparato; al llegar a cero se vuelve a leer el pedido (el servidor
  // es quien lo cancela: aquí nunca se decide nada de dinero).
  useEffect(() => {
    if (pago.estado !== 'por_pagar' || !pago.venceEn) return;
    const tic = () => {
      const s = segundosHasta(pago.venceEn, Date.now());
      setRestan(s);
      if (s <= 0) alCambiar();
    };
    tic();
    const reloj = setInterval(tic, 1000);
    return () => clearInterval(reloj);
    // alCambiar cambia en cada render de la pantalla: no es parte de la cuenta atrás.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pago.estado, pago.venceEn]);

  const montoComida = formatearMonto(pago.comida, pago.moneda, idioma);
  const montoLocal = pago.montoLocal
    ? formatearMonto(pago.montoLocal.monto, pago.montoLocal.moneda, idioma)
    : null;
  const corrigiendo = pago.estado === 'no_llego' && pago.puedeCorregir;
  const conFormulario = pago.estado === 'por_pagar' || corrigiendo;

  async function elegirCaptura() {
    const a = await fotoConCamara(idioma, CAMARA, async () => {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      return r.canceled ? null : (r.assets[0] ?? null);
    });
    if (a) setCaptura(await (await fetch(a.uri)).blob());
  }

  async function enviar() {
    const referencia = limpiarReferenciaPago(b.valores.referencia);
    if (!referencia) return setError(t.referenciaFalta);
    if (!REFERENCIA_PAGO_VALIDA.test(referencia)) return setError(t.referenciaMala);
    setEnviando(true);
    setError(null);
    try {
      await api.pedir('POST', `/datos/pedidos/${pedidoId}/pago-comida`, {
        referencia,
        ...(b.valores.banco.trim() ? { banco: b.valores.banco.trim() } : {}),
      });
      // La referencia ya quedó guardada. La captura es de apoyo: si no sube, se dice y no frena nada.
      if (captura)
        await api
          .subirFoto(captura, `/datos/pedidos/${pedidoId}/pago-comida/comprobante`)
          .catch((x: unknown) => setError(x instanceof Error ? x.message : String(x)));
      await b.limpiar();
      setCaptura(null);
      alCambiar();
    } catch (x) {
      // Lo escrito se queda en pantalla para reintentar.
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  const devolucion =
    pago.devolucion?.estado === 'pendiente'
      ? t.devolucionPendiente.replace('{monto}', montoLocal ?? montoComida)
      : pago.devolucion?.estado === 'hecha'
        ? t.devolucionHecha.replace('{ref}', pago.devolucion.referencia ?? '')
        : null;

  if (pago.estado === 'cancelado' && !devolucion) return null;

  return (
    <View style={caja} testID="pago-comida">
      <Text style={{ fontWeight: '700', color: C.secundario }}>{t.titulo}</Text>

      {pago.estado === 'esperando_conductor' ? (
        <Text testID="pago-comida-espera" style={{ color: '#666B73', marginTop: 4 }}>
          {t.esperandoConductor}
        </Text>
      ) : null}

      {pago.estado === 'vencido' ? (
        <Text testID="pago-comida-vencido" style={{ color: C.primario, marginTop: 4 }}>
          {t.vencido}
        </Text>
      ) : null}

      {pago.cuenta && pago.estado !== 'vencido' ? (
        <View style={{ marginTop: 6 }}>
          {conFormulario ? <Text style={{ color: '#666B73' }}>{t.pagaA}</Text> : null}
          <Dato
            testID="pago-comida-monto"
            etiqueta={t.monto}
            valor={montoLocal ?? montoComida}
            copiar={t.copiar}
            copiado={t.copiado}
          />
          {pago.montoLocal ? (
            <Text
              testID="pago-comida-tasa"
              style={{ color: '#666B73', fontSize: 12, marginTop: 2 }}
            >
              {montoComida} ·{' '}
              {textoTasaUsada(
                {
                  moneda: pago.montoLocal.moneda,
                  tasa: pago.montoLocal.tasa,
                  fecha: pago.montoLocal.fecha,
                },
                idioma,
              )}
            </Text>
          ) : null}
          <Dato
            testID="pago-comida-banco"
            etiqueta={t.banco}
            valor={pago.cuenta.banco}
            copiar={t.copiar}
            copiado={t.copiado}
          />
          <Dato
            testID="pago-comida-telefono"
            etiqueta={t.telefono}
            valor={pago.cuenta.telefono}
            copiar={t.copiar}
            copiado={t.copiado}
          />
          <Dato
            testID="pago-comida-documento"
            etiqueta={t.documento}
            valor={pago.cuenta.documento}
            copiar={t.copiar}
            copiado={t.copiado}
          />
          <Dato
            testID="pago-comida-titular"
            etiqueta={t.titular}
            valor={pago.cuenta.titular}
            copiar={t.copiar}
            copiado={t.copiado}
          />
        </View>
      ) : null}

      {pago.estado === 'por_pagar' ? (
        <Text
          testID="pago-comida-reloj"
          accessibilityLiveRegion="none"
          style={{ color: C.secundario, fontWeight: '700', marginTop: 8 }}
        >
          {t.tiempo.replace('{reloj}', relojPago(restan))}
        </Text>
      ) : null}

      {pago.estado === 'reportado' ? (
        <Text testID="pago-comida-reportado" style={{ color: C.secundario, marginTop: 8 }}>
          {t.reportado.replace('{ref}', pago.referencia ?? '')}
        </Text>
      ) : null}

      {pago.estado === 'confirmado' ? (
        <Text
          testID="pago-comida-confirmado"
          style={{ color: C.exito, fontWeight: '700', marginTop: 4 }}
        >
          {t.confirmado}
        </Text>
      ) : null}

      {pago.estado === 'no_llego' ? (
        <Text testID="pago-comida-no-llego" style={{ color: C.primario, marginTop: 8 }}>
          {pago.puedeCorregir ? t.noLlego : t.noLlegoSinCorreccion}
        </Text>
      ) : null}

      {conFormulario ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => {
              b.empezarDeNuevo();
              setCaptura(null);
            }}
          />
          <Campo
            testID="pago-comida-referencia"
            etiqueta={t.referencia}
            value={b.valores.referencia}
            onChangeText={(x) => b.cambiar('referencia', x)}
            placeholder={t.referenciaAyuda}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Campo
            testID="pago-comida-banco-emisor"
            etiqueta={t.bancoEmisor}
            value={b.valores.banco}
            onChangeText={(x) => b.cambiar('banco', x)}
            placeholder={t.bancoEmisorAyuda}
          />
          <Boton
            texto={captura ? t.capturaLista : t.captura}
            secundario
            alTocar={() => void elegirCaptura()}
          />
          <Text style={{ color: '#666B73', fontSize: 12 }}>{t.capturaNota}</Text>
          {error ? (
            <Text
              testID="pago-comida-error"
              accessibilityRole="alert"
              style={{ color: C.primario }}
            >
              {error}
            </Text>
          ) : null}
          <Boton
            testID="pago-comida-enviar"
            texto={corrigiendo ? t.corregir : t.enviar}
            cargando={enviando}
            alTocar={() => void enviar()}
          />
        </View>
      ) : null}

      {devolucion ? (
        <Text testID="pago-comida-devolucion" style={{ color: C.secundario, marginTop: 8 }}>
          {devolucion}
        </Text>
      ) : null}

      {pago.envioAlConductor > 0 && pago.estado !== 'vencido' && pago.estado !== 'cancelado' ? (
        <Text testID="pago-comida-envio" style={{ color: '#666B73', fontSize: 13, marginTop: 8 }}>
          {t.envioAparte.replace(
            '{monto}',
            formatearMonto(pago.envioAlConductor, pago.moneda, idioma),
          )}
        </Text>
      ) : null}
    </View>
  );
}
