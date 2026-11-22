import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  ErrorApi,
  REFERENCIA_PAGO_VALIDA,
  TEXTOS_PAGO_COMIDA_RESTAURANTE,
  type VistaPagoComida,
  enIdioma,
  formatearMonto,
  limpiarReferenciaPago,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  CampoClave,
  Text,
  alSalirTelefono,
  almacenTelefono,
  fotoConCamara,
  useSesion,
} from '@tumbite/movil';

/**
 * C-COMIDA-PAGO-RESTAURANTE y C-SALDO-RESTAURANTE: lo que el restaurante hace con el pago de la
 * comida que el cliente le manda directo a su pago móvil. Confirma «Me llegó» mirando SU BANCO
 * (nunca por la captura), registra una devolución si el pedido se canceló después, y lleva su
 * cuenta de cobro y su saldo prepago. Divoox no recibe ni guarda el dinero de la comida.
 */
const CAMARA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 }),
};

const caja = {
  marginTop: 10,
  padding: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#2a2a2a',
  backgroundColor: '#fff',
  gap: 8,
} as const;

const mensaje = (x: unknown) =>
  x instanceof ErrorApi || x instanceof Error ? x.message : String(x);

function useTextos() {
  const { api, idioma: idiomaSesion, usuario } = useSesion();
  const idioma = idiomaSesion === 'en' ? ('en' as const) : ('es' as const);
  return { api, idioma, usuario, t: enIdioma(TEXTOS_PAGO_COMIDA_RESTAURANTE, idioma) };
}

/** En la tarjeta de cada pedido: el estado del pago y «Me llegó / No me llegó». */
export function PagoComidaPedido({
  pedidoId,
  pago,
  alCambiar,
}: {
  pedidoId: string;
  pago: VistaPagoComida;
  alCambiar: () => void;
}) {
  const { api, idioma, usuario, t } = useTextos();
  const [enviando, setEnviando] = useState(false);
  const [dudando, setDudando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = useBorrador({
    formulario: `devolucion-comida-${pedidoId}`,
    cuenta: usuario?.id,
    inicial: { referencia: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const monto = pago.montoLocal
    ? formatearMonto(pago.montoLocal.monto, pago.montoLocal.moneda, idioma)
    : formatearMonto(pago.comida, pago.moneda, idioma);

  async function responder(llego: boolean) {
    setEnviando(true);
    setError(null);
    try {
      await api.pedir('POST', `/datos/restaurante/pedidos/${pedidoId}/pago-comida`, { llego });
      setDudando(false);
      alCambiar();
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }

  async function devolver() {
    const referencia = limpiarReferenciaPago(b.valores.referencia);
    if (!REFERENCIA_PAGO_VALIDA.test(referencia)) return setError(t.devolucionReferenciaAyuda);
    setEnviando(true);
    setError(null);
    try {
      await api.pedir('POST', `/datos/restaurante/pedidos/${pedidoId}/pago-comida/devolucion`, {
        referencia,
      });
      await b.limpiar();
      alCambiar();
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }

  const devolucion = pago.devolucion;
  if ((pago.estado === 'cancelado' || pago.estado === 'vencido') && !devolucion) return null;

  return (
    <View style={caja} testID="pago-comida-restaurante">
      <Text style={{ fontWeight: '800', color: C.secundario }}>{t.titulo}</Text>

      {pago.estado === 'esperando_conductor' ? (
        <Text style={{ color: '#666B73' }}>{t.esperandoConductor}</Text>
      ) : null}
      {pago.estado === 'por_pagar' ? (
        <Text style={{ color: '#666B73' }}>{t.porPagar.replace('{monto}', monto)}</Text>
      ) : null}

      {pago.estado === 'reportado' ? (
        <>
          <Text style={{ color: C.secundario, fontWeight: '700' }}>
            {t.reportado.replace('{monto}', monto)}
          </Text>
          <Text testID="pago-comida-ref" selectable style={{ color: C.secundario, fontSize: 18 }}>
            {t.referencia}: <Text style={{ fontWeight: '800' }}>{pago.referencia}</Text>
          </Text>
          {pago.bancoEmisor ? (
            <Text style={{ color: '#666B73' }}>
              {t.bancoEmisor}: {pago.bancoEmisor}
            </Text>
          ) : null}
          <Text testID="pago-comida-mira-banco" style={{ color: C.secundario }}>
            {t.miraTuBanco}
          </Text>
          {dudando ? (
            <>
              <Text style={{ color: C.primario }}>{t.seguroNo}</Text>
              <Boton
                testID="pago-comida-si-no-llego"
                texto={t.siNoLlego}
                secundario
                cargando={enviando}
                alTocar={() => void responder(false)}
              />
              <Boton texto={t.volver} secundario alTocar={() => setDudando(false)} />
            </>
          ) : (
            <>
              <Boton
                testID="pago-comida-me-llego"
                texto={t.meLlego}
                cargando={enviando}
                alTocar={() => void responder(true)}
              />
              <Boton
                testID="pago-comida-no-me-llego"
                texto={t.noMeLlego}
                secundario
                alTocar={() => setDudando(true)}
              />
            </>
          )}
        </>
      ) : null}

      {pago.estado === 'confirmado' && !devolucion ? (
        <Text testID="pago-comida-ok" style={{ color: C.exito, fontWeight: '700' }}>
          {t.confirmado}
        </Text>
      ) : null}

      {pago.estado === 'no_llego' ? (
        <>
          <Text style={{ color: C.primario }}>{t.noLlego}</Text>
          {pago.referencia ? (
            <Text selectable style={{ color: C.secundario }}>
              {t.referencia}: {pago.referencia}
            </Text>
          ) : null}
          {pago.puedeCorregirRestaurante ? (
            <Boton
              testID="pago-comida-corregir-si"
              texto={t.corregirSi}
              cargando={enviando}
              alTocar={() => void responder(true)}
            />
          ) : null}
        </>
      ) : null}

      {devolucion?.estado === 'pendiente' ? (
        <>
          <Text style={{ color: C.primario, fontWeight: '800' }}>
            {t.devolucionTitulo.replace('{monto}', monto)}
          </Text>
          <Text style={{ color: C.secundario }}>{t.devolucionAyuda}</Text>
          <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
          <Campo
            testID="devolucion-referencia"
            etiqueta={t.devolucionReferencia}
            value={b.valores.referencia}
            onChangeText={(x) => b.cambiar('referencia', x)}
            placeholder={t.devolucionReferenciaAyuda}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Boton
            testID="devolucion-enviar"
            texto={t.devolucionEnviar}
            cargando={enviando}
            alTocar={() => void devolver()}
          />
        </>
      ) : null}
      {devolucion?.estado === 'hecha' ? (
        <Text style={{ color: C.exito }}>
          {t.devolucionHecha.replace('{ref}', devolucion.referencia ?? '')}
        </Text>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type CuentaRest = {
  id: string;
  banco: string;
  telefono: string;
  documento: string;
  titular: string;
  vigente: boolean;
  activa: boolean;
};

const CUENTA_VACIA = { banco: '', telefono: '', documento: '', titular: '' };

/** La cuenta de pago móvil donde los clientes le pagan la comida. Solo en países de pago directo. */
export function CuentaCobroRestaurante({
  alSaber,
}: {
  /** Le dice al inicio si este país usa el pago directo (para mostrar el saldo). */
  alSaber?: (exigida: boolean) => void;
}) {
  const { api, idioma, usuario, t } = useTextos();
  const [datos, setDatos] = useState<{
    exigida: boolean;
    cuenta: CuentaRest | null;
    cuentas: CuentaRest[];
  } | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // La contraseña NO entra al borrador (dato sensible): vive solo en la pantalla.
  const b = useBorrador({
    formulario: 'cuenta-cobro-restaurante',
    cuenta: usuario?.id,
    inicial: CUENTA_VACIA,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cargar = useCallback(() => {
    api
      .pedir<NonNullable<typeof datos>>('GET', '/datos/restaurante/cuenta-cobro')
      .then((r) => {
        setDatos(r);
        alSaber?.(r.exigida);
      })
      .catch((x: unknown) => setError(mensaje(x)));
    // alSaber es un setState del inicio: estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);
  useEffect(cargar, [cargar]);

  if (!datos?.exigida) return null;
  const v = b.valores;
  const conFormulario = abierto || b.recuperado;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const r = await api.pedir<{ enVigorYa: boolean }>('POST', '/datos/restaurante/cuenta-cobro', {
        clave,
        banco: v.banco.trim(),
        telefono: v.telefono.trim(),
        documento: v.documento.trim(),
        titular: v.titular.trim(),
      });
      await b.limpiar();
      setClave('');
      setAbierto(false);
      setAviso(r.enVigorYa ? null : t.cuentaEnEspera);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para reintentar.
      setError(mensaje(x));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={caja} testID="cuenta-cobro-restaurante">
      <Text style={{ fontWeight: '800', color: C.secundario }}>{t.cuentaTitulo}</Text>
      <Text style={{ color: '#666B73', fontSize: 13 }}>{t.cuentaAyuda}</Text>
      {datos.cuenta ? (
        <View>
          <Text style={{ color: C.secundario, fontWeight: '700' }}>{datos.cuenta.titular}</Text>
          <Text style={{ color: C.secundario }}>
            {datos.cuenta.banco} · {datos.cuenta.telefono} · {datos.cuenta.documento}
          </Text>
        </View>
      ) : (
        <Text testID="cuenta-cobro-falta" style={{ color: C.primario, fontWeight: '700' }}>
          {t.cuentaFalta}
        </Text>
      )}
      {aviso ? <Text style={{ color: C.secundario }}>{aviso}</Text> : null}
      {conFormulario ? (
        <>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => {
              b.empezarDeNuevo();
              setClave('');
            }}
          />
          <Campo
            etiqueta={t.cuentaBanco}
            value={v.banco}
            onChangeText={(x) => b.cambiar('banco', x)}
            placeholder={t.cuentaBancoAyuda}
          />
          <Campo
            etiqueta={t.cuentaTelefono}
            value={v.telefono}
            onChangeText={(x) => b.cambiar('telefono', x)}
            placeholder={t.cuentaTelefonoAyuda}
            keyboardType="phone-pad"
          />
          <Campo
            etiqueta={t.cuentaDocumento}
            value={v.documento}
            onChangeText={(x) => b.cambiar('documento', x)}
            placeholder={t.cuentaDocumentoAyuda}
            autoCapitalize="characters"
          />
          <Campo
            etiqueta={t.cuentaTitular}
            value={v.titular}
            onChangeText={(x) => b.cambiar('titular', x)}
            placeholder={t.cuentaTitularAyuda}
            autoCapitalize="words"
          />
          <CampoClave etiqueta={t.cuentaClave} valor={clave} cambiar={setClave} />
          <Text style={{ color: '#666B73', fontSize: 12 }}>{t.cuentaSoloDueno}</Text>
          <Boton
            testID="cuenta-cobro-guardar"
            texto={t.cuentaGuardar}
            cargando={guardando}
            alTocar={() => void guardar()}
          />
          <Boton
            texto={t.cuentaCancelar}
            secundario
            alTocar={() => {
              setAbierto(false);
              setError(null);
              void b.limpiar();
              setClave('');
            }}
          />
        </>
      ) : (
        <Boton
          testID="cuenta-cobro-abrir"
          texto={datos.cuenta ? t.cuentaCambiar : t.cuentaAgregar}
          secundario={Boolean(datos.cuenta)}
          alTocar={() => setAbierto(true)}
        />
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type Saldo = {
  moneda: string;
  disponible: number;
  sinSaldo: boolean;
  comision: { activa: boolean; deUnPedidoDe10: number };
  recargas: {
    activas: boolean;
    minimo: number;
    maximo: number;
    instrucciones: string;
    lista: {
      id: string;
      monto: number;
      moneda: string;
      referencia: string;
      estado: 'pendiente' | 'acreditada' | 'rechazada';
      motivo: string;
    }[];
  };
};

const RECARGA_VACIA = { monto: '', referencia: '', banco: '' };

/** El saldo prepago del restaurante y su recarga, igual que el del conductor. Hoy la comisión es 0 %. */
export function SaldoRestaurante({ visible }: { visible: boolean }) {
  const { api, idioma, usuario, t } = useTextos();
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const b = useBorrador({
    formulario: 'recarga-restaurante',
    cuenta: usuario?.id,
    inicial: RECARGA_VACIA,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cargar = useCallback(() => {
    if (!visible) return;
    api
      .pedir<Saldo>('GET', '/datos/restaurante/saldo')
      .then(setSaldo)
      .catch((x: unknown) => setError(mensaje(x)));
  }, [api, visible]);
  useEffect(cargar, [cargar]);

  if (!visible || !saldo) return null;
  const v = b.valores;
  const conFormulario = saldo.recargas.activas && (abierto || b.recuperado);

  async function elegirFoto() {
    const a = await fotoConCamara(idioma, CAMARA, async () => {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      return r.canceled ? null : (r.assets[0] ?? null);
    });
    if (a) setFoto(await (await fetch(a.uri)).blob());
  }

  async function enviar() {
    const monto = Math.round(Number(v.monto.replace(',', '.')) * 100);
    const referencia = limpiarReferenciaPago(v.referencia);
    if (!Number.isSafeInteger(monto) || monto <= 0) return setError(t.recargaMonto);
    if (!REFERENCIA_PAGO_VALIDA.test(referencia)) return setError(t.recargaReferenciaAyuda);
    if (!foto) return setError(t.recargaFotoFalta);
    setEnviando(true);
    setError(null);
    try {
      const subida = await api.subirFotoCon<{ comprobanteId: string }>(
        foto,
        '/datos/restaurante/saldo/comprobante',
      );
      await api.pedir('POST', '/datos/restaurante/saldo/recargas', {
        monto,
        referencia,
        ...(v.banco.trim() ? { banco: v.banco.trim() } : {}),
        comprobanteId: subida.comprobanteId,
      });
      await b.limpiar();
      setFoto(null);
      setAbierto(false);
      setAviso(t.recargaEnviada);
      cargar();
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={caja} testID="saldo-restaurante">
      <Text style={{ fontWeight: '800', color: C.secundario }}>{t.saldoTitulo}</Text>
      <Text testID="saldo-restaurante-disponible" style={{ color: C.secundario, fontSize: 22 }}>
        {formatearMonto(saldo.disponible, saldo.moneda, idioma)}{' '}
        <Text style={{ color: '#666B73', fontSize: 13 }}>{t.saldoDisponible}</Text>
      </Text>
      <Text style={{ color: saldo.comision.activa ? C.secundario : C.exito }}>
        {saldo.comision.activa
          ? t.saldoComision.replace(
              '{monto}',
              formatearMonto(saldo.comision.deUnPedidoDe10, saldo.moneda, idioma),
            )
          : t.saldoGratis}
      </Text>
      {saldo.sinSaldo ? (
        <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
          {t.saldoSin}
        </Text>
      ) : null}
      {aviso ? <Text style={{ color: C.exito }}>{aviso}</Text> : null}
      {!saldo.recargas.activas ? (
        <Text style={{ color: '#666B73', fontSize: 13 }}>{t.recargasApagadas}</Text>
      ) : conFormulario ? (
        <>
          <Text style={{ fontWeight: '700', color: C.secundario }}>{t.recargarTitulo}</Text>
          {saldo.recargas.instrucciones ? (
            <Text selectable style={{ color: C.secundario }}>
              {saldo.recargas.instrucciones}
            </Text>
          ) : null}
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => {
              b.empezarDeNuevo();
              setFoto(null);
            }}
          />
          <Campo
            etiqueta={t.recargaMonto}
            value={v.monto}
            onChangeText={(x) => b.cambiar('monto', x)}
            placeholder={t.recargaMontoAyuda}
            keyboardType="decimal-pad"
          />
          <Campo
            etiqueta={t.recargaReferencia}
            value={v.referencia}
            onChangeText={(x) => b.cambiar('referencia', x)}
            placeholder={t.recargaReferenciaAyuda}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Campo
            etiqueta={t.recargaBanco}
            value={v.banco}
            onChangeText={(x) => b.cambiar('banco', x)}
            placeholder={t.recargaBancoAyuda}
          />
          <Boton
            texto={foto ? t.recargaFotoLista : t.recargaFoto}
            secundario
            alTocar={() => void elegirFoto()}
          />
          <Boton
            testID="recarga-enviar"
            texto={t.recargaEnviar}
            cargando={enviando}
            alTocar={() => void enviar()}
          />
        </>
      ) : (
        <Boton
          testID="recarga-abrir"
          texto={t.recargarTitulo}
          secundario
          alTocar={() => setAbierto(true)}
        />
      )}
      {saldo.recargas.lista.length ? (
        <View>
          <Text style={{ fontWeight: '700', color: C.secundario }}>{t.recargasLista}</Text>
          {saldo.recargas.lista.map((r) => (
            <Text key={r.id} style={{ color: C.secundario }}>
              {formatearMonto(r.monto, r.moneda, idioma)} · {r.referencia} ·{' '}
              <Text style={{ color: r.estado === 'acreditada' ? C.exito : C.secundario }}>
                {t.estadoRecarga[r.estado]}
              </Text>
              {r.estado === 'rechazada' && r.motivo ? ` · ${r.motivo}` : ''}
            </Text>
          ))}
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
