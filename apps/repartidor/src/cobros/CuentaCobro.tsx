import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ErrorApi, type Idioma, enIdioma, nombreFormaPago, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  CampoClave,
  Text,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
} from '@tumbite/movil';
import {
  BORRADOR_CUENTA,
  type CuentaCobroApp,
  cuentaActiva,
  estadoCuenta,
  falloCuenta,
  identificadorPagoMovil,
  identificadorVisible,
  tipoElegido,
} from './logica';
import { T_COBROS } from './textos';

/**
 * C-CUENTA-COBRO-CONDUCTOR (19 nov 2026 — Venezuela y Perú): el conductor carga el número donde le
 * pagan los pasajeros (pago móvil en Venezuela; Yape o Plin en Perú). Antes solo se podía cargar por
 * la API. Pide la contraseña (nadie más cambia dónde le pagan), guarda lo escrito mientras se llena
 * (nunca la contraseña) y dice claro cuándo entra en uso. En un país sin billeteras no dibuja nada.
 */
export function CuentaCobro({ tipos, idioma }: { tipos: readonly string[]; idioma: Idioma }) {
  const { api, usuario } = useSesion();
  const t = enIdioma(T_COBROS, idioma);
  const [cuentas, setCuentas] = useState<CuentaCobroApp[] | null>(null);
  const [abiertoAMano, setAbierto] = useState(false);
  const [cerrado, setCerrado] = useState(false);
  const [clave, setClave] = useState('');
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [falloCarga, setFalloCarga] = useState(false);
  const b = useBorrador({
    formulario: 'cuenta-cobro-conductor',
    cuenta: usuario?.id,
    inicial: BORRADOR_CUENTA,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cargar = useCallback(() => {
    api
      .pedir<{ cuentas: CuentaCobroApp[] }>('GET', '/datos/repartidor/cuentas-cobro')
      .then((r) => {
        setCuentas(r.cuentas);
        setFalloCarga(false);
      })
      // Sin lista no se dice «todavía no cargaste tu número» (puede tenerlo): se dice que falló.
      .catch(() => setFalloCarga(true));
  }, [api]);
  useEffect(() => {
    if (tipos.length) cargar();
  }, [cargar, tipos.length]);
  if (!tipos.length) return null;
  if (cuentas == null)
    return falloCarga ? (
      <View
        testID="cuenta-cobro-fallo"
        style={{
          borderWidth: 1,
          borderColor: '#2a2a2a',
          borderRadius: 12,
          padding: 12,
          gap: 8,
          backgroundColor: '#fff',
        }}
      >
        <Text style={{ fontWeight: '800', color: C.secundario }}>{t.cuentaTitulo}</Text>
        <Text accessibilityRole="alert" style={{ color: C.primario }}>
          {t.noCarga}
        </Text>
        <Boton texto={t.reintentar} secundario alTocar={cargar} />
      </View>
    ) : null;
  // Un borrador recuperado abre el formulario solo: lo escrito vuelve a su sitio.
  const abierto = abiertoAMano || (b.recuperado && !cerrado);
  const v = b.valores;
  const actual = cuentaActiva(cuentas);
  const tipo = tipoElegido(v, tipos);
  const medios = tipos
    .map((x) => nombreFormaPago(x, idioma))
    .join(idioma === 'en' ? ' or ' : ' o ');
  const errorDe = (c: string) => (error?.campo === c ? error.mensaje : undefined);
  const aCelularPeru = tipo === 'yape' || tipo === 'plin';
  // C-CUENTA-COBRO-VENEZUELA: con solo pago móvil en el país, la tarjeta habla de pago móvil.
  const soloPagoMovil = tipos.length === 1 && tipos.at(0) === 'pago_movil';

  async function guardar() {
    setAviso('');
    const fallo = falloCuenta(v, clave, tipos);
    if (fallo) {
      const mensaje =
        tipo === 'pago_movil' && fallo === 'identificador'
          ? t.pagoMovil.falloTelefono
          : (new Map(Object.entries(t.fallos)).get(fallo) ?? '');
      setError({ mensaje, campo: fallo });
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await api.pedir('POST', '/datos/repartidor/cuentas-cobro', {
        clave,
        tipo,
        banco: tipo === 'pago_movil' ? v.banco.trim() : '',
        titular: v.titular.trim(),
        identificador:
          tipo === 'pago_movil'
            ? identificadorPagoMovil(v.identificador, v.cedula)
            : v.identificador.trim(),
      });
      // Solo después de la confirmación del servidor se limpia lo escrito.
      await b.limpiar();
      setClave('');
      setAbierto(false);
      setCerrado(true);
      setAviso(t.guardada);
      cargar();
    } catch (x) {
      setError(
        x instanceof ErrorApi
          ? { mensaje: x.message, campo: x.campo }
          : { mensaje: (x as Error).message },
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View
      testID="cuenta-cobro"
      style={{
        borderWidth: 1,
        borderColor: '#2a2a2a',
        borderRadius: 12,
        padding: 12,
        gap: 8,
        backgroundColor: '#fff',
      }}
    >
      <Text style={{ fontWeight: '800', color: C.secundario }}>{t.cuentaTitulo}</Text>
      <Text style={{ color: '#666B73', fontSize: 13 }}>
        {soloPagoMovil ? t.pagoMovil.ayuda : t.cuentaAyuda(medios)}
      </Text>
      {actual ? (
        <View testID="cuenta-cobro-actual" style={{ gap: 2 }}>
          <Text style={{ fontWeight: '700', color: C.secundario }}>
            {nombreFormaPago(actual.tipo, idioma)} · {identificadorVisible(actual)}
          </Text>
          <Text style={{ color: '#666B73' }}>
            {[actual.banco, actual.titular].filter(Boolean).join(' · ')}
          </Text>
          <Text
            style={{
              color: estadoCuenta(actual) === 'en_vigor' ? C.exito : '#666B73',
              fontWeight: estadoCuenta(actual) === 'en_vigor' ? '700' : '400',
              fontSize: 13,
            }}
          >
            {estadoCuenta(actual) === 'en_vigor' ? t.enVigor : t.enEspera}
          </Text>
        </View>
      ) : (
        <Text testID="cuenta-cobro-vacia" style={{ color: C.primario, fontWeight: '700' }}>
          {soloPagoMovil ? t.pagoMovil.sinCuenta : t.sinCuenta}
        </Text>
      )}
      {aviso ? (
        <Text accessibilityRole="alert" style={{ color: C.exito, fontWeight: '700' }}>
          {aviso}
        </Text>
      ) : null}
      {abierto ? (
        <View testID="cuenta-cobro-formulario" style={{ gap: 4 }}>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => {
              b.empezarDeNuevo();
              setClave('');
            }}
          />
          {tipos.length > 1 ? (
            <>
              <Text style={{ color: '#666B73', fontWeight: '600' }}>{t.tipo}</Text>
              <View
                accessibilityRole="radiogroup"
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
              >
                {tipos.map((x) => (
                  <Pressable
                    key={x}
                    testID={`cuenta-cobro-tipo-${x}`}
                    onPress={() => b.cambiar('tipo', x)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: v.tipo === x }}
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: v.tipo === x ? C.secundario : '#C9CCD1',
                      backgroundColor: v.tipo === x ? C.secundario : '#fff',
                    }}
                  >
                    <Text
                      style={{ fontWeight: '700', color: v.tipo === x ? '#fff' : C.secundario }}
                    >
                      {nombreFormaPago(x, idioma)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {errorDe('tipo') ? (
                <Text accessibilityRole="alert" style={{ color: C.primario }}>
                  {errorDe('tipo')}
                </Text>
              ) : null}
              {aCelularPeru ? (
                <Text style={{ color: '#666B73', fontSize: 12 }}>{t.yapePlin}</Text>
              ) : null}
            </>
          ) : null}
          {tipo === 'pago_movil' ? (
            <Campo
              etiqueta={t.banco}
              value={v.banco}
              onChangeText={(x) => b.cambiar('banco', x)}
              placeholder={t.banco}
              error={errorDe('banco')}
            />
          ) : null}
          <Campo
            etiqueta={t.titular}
            value={v.titular}
            onChangeText={(x) => b.cambiar('titular', x)}
            placeholder={t.titular}
            autoCapitalize="words"
            error={errorDe('titular')}
          />
          <Campo
            etiqueta={
              aCelularPeru
                ? t.celular
                : tipo === 'pago_movil'
                  ? t.pagoMovil.telefono
                  : t.identificador
            }
            value={v.identificador}
            onChangeText={(x) => b.cambiar('identificador', x)}
            placeholder={
              aCelularPeru
                ? t.celularAyuda
                : tipo === 'pago_movil'
                  ? t.pagoMovil.telefonoAyuda
                  : t.identificador
            }
            keyboardType={aCelularPeru || tipo === 'pago_movil' ? 'phone-pad' : 'default'}
            error={errorDe('identificador')}
          />
          {tipo === 'pago_movil' ? (
            <Campo
              etiqueta={t.pagoMovil.cedula}
              value={v.cedula}
              onChangeText={(x) => b.cambiar('cedula', x)}
              placeholder={t.pagoMovil.cedulaAyuda}
              autoCapitalize="characters"
              error={errorDe('cedula')}
            />
          ) : null}
          <CampoClave
            etiqueta={t.clave}
            valor={clave}
            cambiar={setClave}
            error={errorDe('clave')}
            alEnviar={() => void guardar()}
          />
          <Text style={{ color: '#666B73', fontSize: 12 }}>{t.claveAyuda}</Text>
          {error && !error.campo ? (
            <Text accessibilityRole="alert" style={{ color: C.primario }}>
              {error.mensaje}
            </Text>
          ) : null}
          <Boton texto={t.guardar} cargando={guardando} alTocar={() => void guardar()} />
          <Boton
            texto={t.cancelar}
            secundario
            alTocar={() => {
              setAbierto(false);
              setCerrado(true);
              setError(null);
              setClave('');
            }}
          />
        </View>
      ) : (
        <Boton
          texto={
            soloPagoMovil
              ? actual
                ? t.pagoMovil.cambiar
                : t.pagoMovil.cargar
              : actual
                ? t.cambiar
                : t.cargar
          }
          secundario={Boolean(actual)}
          alTocar={() => {
            setAviso('');
            setCerrado(false);
            setAbierto(true);
          }}
        />
      )}
    </View>
  );
}
