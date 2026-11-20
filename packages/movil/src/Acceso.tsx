import { abrirPagina } from './PaginaEnApp';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Text } from './diseno';
import { BackHandler, Keyboard, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  correoEjemplo,
  pareceCorreo,
  ErrorApi,
  enIdioma,
  enIdiomaDireccion,
  useBorrador,
  pistaDeEntrada,
} from '@tumbite/compartido';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { URL_SERVIDOR, useSesion } from './sesion';
import { TEXTOS_MOVIL } from './textos';
import { AvisoBorrador } from './AvisoBorrador';
import { SugerenciaCorreo } from './SugerenciaCorreo';
import { FranjaPruebas } from './FranjaPruebas';
import { CampoFecha } from './CampoFecha';
import { CasillaSms } from './CasillaSms';
import { Boton, C, Campo, CampoClave, Pantalla, e, useAcentoApp } from './ui';
import { COLOR } from './tokens';
import { SelectorIdioma } from './SelectorIdioma';
import { Turnstile, olvidarPaseTurnstile, useTurnstileSitio } from './Turnstile';
import { mensajeSinCasilla } from './accesoErrores';
import { EncabezadoVolver, useVolverDelSistema } from './VolverAEntrar';

const INICIAL = {
  nombre: '',
  correo: '',
  telefono: '',
  fechaNacimiento: '',
  clave: '',
  sms: false,
  // C-REFERIDOS-EQUIPOS: el código con el que lo invitaron (opcional).
  invitacion: '',
};

/**
 * Entrar y crear cuenta, para las tres apps. C-SIN-CALLEJON y C-RESTAURANTE-DESDE-EL-TELEFONO
 * (19 nov 2026, Richard): desde «Crear cuenta» siempre se vuelve a «Entrar» (flecha arriba, enlace
 * arriba y al final, y el gesto del sistema); la app del restaurante también crea su cuenta aquí;
 * y en las dos pantallas hay «¿Necesitas ayuda?» sin tener que iniciar sesión.
 */
export function Acceso({
  rolRegistro,
  pideCumple,
  portada,
  modoInicial = 'entrar',
  seguirMirando,
}: {
  rolRegistro?: 'cliente' | 'repartidor' | 'restaurante';
  pideCumple?: boolean;
  /**
   * Portada propia (logotipo, título): la usa solo la app del restaurante con su diseño blanco.
   * Sin ella, el acceso se ve como siempre en cliente y repartidor.
   */
  portada?: ReactNode;
  /** Abre directo en «crear cuenta» (el enlace «¿Eres nuevo?» de la portada del cliente). */
  modoInicial?: 'entrar' | 'registro';
  /** C-MIRAR-SIN-CUENTA: en la app del cliente, volver a mirar sin cuenta. */
  seguirMirando?: () => void;
}) {
  const { api, idioma, alEntrar, rolesPermitidos, cambiarIdioma, sesionTerminada } = useSesion();
  const acento = useAcentoApp();
  const t = enIdioma(TEXTOS_MOVIL, idioma);
  const [modo, setModo] = useState<'entrar' | 'registro'>(modoInicial);
  // C-ENTRAR-CON-SALIDA (14 nov 2026, Richard): el botón de atrás del teléfono también saca de
  // la pantalla de entrar cuando se puede seguir mirando sin cuenta; nadie queda atrapado.
  useEffect(() => {
    if (!seguirMirando) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      seguirMirando();
      return true;
    });
    return () => sub.remove();
  }, [seguirMirando]);
  const b = useBorrador({
    formulario: `app-${modo}`,
    inicial: INICIAL,
    almacen: almacenTelefono,
    sensibles: ['clave'],
    alSalir: alSalirTelefono,
  });
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  // Volver de «Crear cuenta» a «Entrar». Cada modo tiene su borrador: lo escrito no se pierde al ir
  // y volver.
  const aEntrar = useCallback(() => {
    setError(null);
    setModo('entrar');
  }, []);
  const gestoVolver = useVolverDelSistema(modo === 'registro', aEntrar);
  // C-APP-DE-PRUEBAS-VISIBLE: si entrar falla y la causa probable es la app equivocada (la de
  // pruebas con una cuenta real, o la de la tienda con una cuenta de prueba), se orienta. Sale de
  // la app y de lo escrito, nunca del servidor: no revela si la cuenta existe.
  const [pista, setPista] = useState<'appDePruebas' | 'appReal' | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Casilla de aceptación de los términos al crear la cuenta (pedido de Richard, 27 oct 2026).
  const [acepto, setAcepto] = useState(false);
  const v = b.valores;
  const errorDe = (c: string) => (error?.campo === c ? error.mensaje : undefined);
  // El error de una casilla se va en cuanto la persona la corrige (antes quedaba en rojo aunque ya
  // estuviera bien escrita).
  const cambiar = (campo: Exclude<keyof typeof INICIAL, 'sms'>, valor: string) => {
    b.cambiar(campo, valor);
    setError((e) => (e?.campo === campo ? null : e));
  };
  const turnstileSitio = useTurnstileSitio(api);

  async function enviar() {
    setError(null);
    setPista(null);
    if (!pareceCorreo(v.correo)) {
      setError({ mensaje: t.correoInvalido, campo: 'correo' });
      return;
    }
    if (modo === 'registro' && rolRegistro && !acepto) {
      setError({ mensaje: t.faltaAceptar });
      return;
    }
    setEnviando(true);
    try {
      const r =
        modo === 'entrar' || !rolRegistro
          ? await api.entrar({ correo: v.correo, clave: v.clave })
          : await api.registro({
              nombre: v.nombre,
              correo: v.correo,
              clave: v.clave,
              telefono: v.telefono || undefined,
              fechaNacimiento: v.fechaNacimiento || undefined,
              rol: rolRegistro,
              idioma,
              // C-SMS-CONSENTIMIENTO: la casilla de SMS, aparte y sin marcar.
              smsConsentimiento: v.sms,
              canal: 'app',
              ...(v.invitacion.trim() ? { invitacion: v.invitacion.trim().toUpperCase() } : {}),
            });
      if (!rolesPermitidos.includes(r.usuario.rol)) {
        setError({ mensaje: t.rolEquivocado });
        return;
      }
      await b.limpiar();
      await alEntrar(r.token, r.usuario);
    } catch (x) {
      // Un 403 del escudo anti-robots: el pase ya no sirve, se pide otro.
      if (x instanceof ErrorApi && x.estado === 403) olvidarPaseTurnstile();
      if (modo === 'entrar' && x instanceof ErrorApi && x.estado === 401 && Platform.OS !== 'web')
        setPista(pistaDeEntrada(URL_SERVIDOR, v.correo));
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    } finally {
      setEnviando(false);
    }
  }

  const registro = modo === 'registro' && rolRegistro;
  const casillasVisibles = [
    'correo',
    'clave',
    ...(registro ? ['nombre', 'telefono', 'invitacion'] : []),
    ...(registro && pideCumple ? ['fechaNacimiento'] : []),
  ];
  const mensajeGeneral = mensajeSinCasilla(error, casillasVisibles);
  // Inglés sin prefijo, español bajo /es: la misma página legal en el idioma de la app.
  const abrir = (ruta: string) => abrirPagina(`${URL_SERVIDOR}${enIdiomaDireccion(ruta, idioma)}`);
  // Cada app con su color en la píldora del idioma: Driver azul, Restaurants (la única sin registro)
  // negro y el cliente rojo, para que las tres se distingan a primera vista.
  const fondoIdioma =
    acento === 'logistica' ? COLOR.logistica : rolRegistro ? C.primario : COLOR.negro;
  const marco = (cuerpo: ReactNode) =>
    portada ? (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} {...gestoVolver}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ backgroundColor: fondoIdioma, borderRadius: 999, paddingHorizontal: 4 }}>
            <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} />
          </View>
        </View>
        <ScrollView
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            padding: 24,
            width: '100%',
            maxWidth: 460,
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {registro ? <EncabezadoVolver texto={t.volverAEntrar} alVolver={aEntrar} /> : null}
          {portada}
          {cuerpo}
        </ScrollView>
      </SafeAreaView>
    ) : (
      <Pantalla
        titulo={registro ? t.crearCuenta : t.entrar}
        volver={registro ? aEntrar : seguirMirando}
      >
        {cuerpo}
      </Pantalla>
    );
  return marco(
    <>
      {/* Con portada propia (Driver), el título de «Crear cuenta» o «Entrar» va aquí. */}
      {portada && rolRegistro ? (
        <Text
          accessibilityRole="header"
          style={{ fontWeight: '700', fontSize: 26, color: C.secundario, marginBottom: 4 }}
        >
          {registro ? t.crearCuenta : t.entrar}
        </Text>
      ) : null}
      {rolRegistro ? (
        // Que se sepa siempre qué cuenta se crea o se usa: de cliente o de repartidor.
        <Text
          style={{ color: '#666B73', fontSize: 15, marginBottom: 12 }}
          accessibilityRole="header"
        >
          {rolRegistro === 'repartidor'
            ? t.cuentaDe.repartidor
            : rolRegistro === 'restaurante'
              ? t.cuentaDe.restaurante
              : t.cuentaDe.cliente}
        </Text>
      ) : null}
      {/* C-SIN-CALLEJON: quien ya tiene cuenta lo ve arriba, sin bajar por todo el formulario. */}
      {registro ? (
        <Text
          testID="ya-tengo-cuenta-arriba"
          style={[e.enlace, { textAlign: 'left', marginTop: 0, marginBottom: 12 }]}
          onPress={aEntrar}
          accessibilityRole="button"
        >
          {t.yaTengo}
        </Text>
      ) : null}
      {/* C-APP-DE-PRUEBAS-VISIBLE: la app de pruebas lo dice antes de pedir la cuenta. */}
      <FranjaPruebas />
      {/* C-SESION-TERMINADA: si se llegó aquí porque la sesión venció, se dice una vez, sin ventana. */}
      {sesionTerminada && modo === 'entrar' ? (
        <Text testID="sesion-terminada" style={{ color: '#666B73', marginBottom: 12 }}>
          {idioma === 'en'
            ? 'Your session ended. Sign in again to continue.'
            : 'Tu sesión terminó. Vuelve a entrar para seguir.'}
        </Text>
      ) : null}
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      {registro && (
        <Campo
          etiqueta={t.nombre}
          value={v.nombre}
          onChangeText={(x) => cambiar('nombre', x)}
          autoComplete="name"
          placeholder={t.nombre}
          error={errorDe('nombre')}
        />
      )}
      <Campo
        etiqueta={t.correo}
        value={v.correo}
        onChangeText={(x) => cambiar('correo', x)}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder={correoEjemplo(idioma)}
        error={errorDe('correo')}
      />
      {registro ? (
        <SugerenciaCorreo correo={v.correo} idioma={idioma} aceptar={(x) => cambiar('correo', x)} />
      ) : null}
      {registro && (
        <Campo
          etiqueta={t.telefono}
          value={v.telefono}
          onChangeText={(x) => cambiar('telefono', x)}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder={t.telefono}
          error={errorDe('telefono')}
        />
      )}
      {registro && (
        <Campo
          etiqueta={t.invitacion}
          value={v.invitacion}
          onChangeText={(x) => cambiar('invitacion', x.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={t.invitacionAyuda}
          testID="registro-invitacion"
          error={errorDe('invitacion')}
        />
      )}
      {registro && pideCumple && (
        // C-FECHA-MODERNA: opcional de verdad; vacía o a medias no impide crear la cuenta.
        <CampoFecha
          etiqueta={t.cumple}
          valor={v.fechaNacimiento}
          cambiar={(x) => cambiar('fechaNacimiento', x)}
          idioma={idioma}
          sinFuturo
          // Al completar el año se guarda el teclado numérico: los términos y el botón quedan a la vista.
          alCompletar={() => Keyboard.dismiss()}
          error={errorDe('fechaNacimiento')}
          testID="registro-cumple"
        />
      )}
      <CampoClave
        etiqueta={t.clave}
        valor={v.clave}
        cambiar={(x) => cambiar('clave', x)}
        nueva={Boolean(registro)}
        alEnviar={() => void enviar()}
        error={errorDe('clave')}
      />
      <Turnstile sitio={turnstileSitio} idioma={idioma} />
      {/* C-REGISTRO-ERRORES: un error sin casilla en pantalla sale aquí; nunca queda escondido. */}
      {mensajeGeneral ? (
        <Text
          style={[e.error, { marginBottom: 8 }]}
          accessibilityRole="alert"
          testID="acceso-error"
        >
          {mensajeGeneral}
        </Text>
      ) : null}
      {registro ? (
        // Aceptación con casilla antes de crear la cuenta (Apple y Google la revisan).
        // Solo el cuadrito es la casilla: el texto lleva enlaces y un toque ahí abre la página.
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <Pressable
            onPress={() => setAcepto(!acepto)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acepto }}
            accessibilityLabel={`${t.aceptas} ${t.terminos} ${t.yLa} ${t.privacidad}`}
            hitSlop={10}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              borderWidth: 2,
              borderColor: acepto ? C.primario : '#6B7078',
              backgroundColor: acepto ? C.primario : '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            {acepto ? (
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>✓</Text>
            ) : null}
          </Pressable>
          <Text style={{ color: '#666B73', fontSize: 13, flex: 1 }}>
            {t.aceptas}{' '}
            <Text style={e.enlaceLinea} onPress={() => abrir('/terms')} accessibilityRole="link">
              {t.terminos}
            </Text>
            {rolRegistro === 'repartidor' || rolRegistro === 'restaurante' ? (
              <>
                ,{' '}
                <Text
                  style={e.enlaceLinea}
                  onPress={() =>
                    abrir(rolRegistro === 'repartidor' ? '/driver-terms' : '/restaurant-terms')
                  }
                  accessibilityRole="link"
                >
                  {rolRegistro === 'repartidor' ? t.terminosRepartidores : t.terminosRestaurantes}
                </Text>
              </>
            ) : null}{' '}
            {t.yLa}{' '}
            <Text style={e.enlaceLinea} onPress={() => abrir('/privacy')} accessibilityRole="link">
              {t.privacidad}
            </Text>
            .
          </Text>
        </View>
      ) : null}
      {registro ? (
        <CasillaSms idioma={idioma} marcada={v.sms} cambiar={(x) => b.cambiar('sms', x)} />
      ) : null}
      {pista ? (
        <Text
          testID="pista-entrada"
          accessibilityRole="alert"
          style={{ color: '#7A4B00', fontSize: 14, marginBottom: 10 }}
        >
          {pista === 'appDePruebas' ? t.pistaAppDePruebas : t.pistaAppReal}
        </Text>
      ) : null}
      <Boton
        texto={enviando ? t.enviando : registro ? t.crearCuenta : t.entrar}
        alTocar={() => void enviar()}
        cargando={enviando}
      />
      {modo === 'entrar' ? (
        <Text
          style={e.enlace}
          onPress={() => abrirPagina(`${URL_SERVIDOR}/forgot-password`)}
          accessibilityRole="link"
        >
          {t.olvide}
        </Text>
      ) : null}
      {rolRegistro ? (
        <Text
          testID={modo === 'entrar' ? 'ir-a-crear-cuenta' : 'ya-tengo-cuenta'}
          style={e.enlace}
          onPress={() => {
            setError(null);
            setModo(modo === 'entrar' ? 'registro' : 'entrar');
          }}
          accessibilityRole="button"
        >
          {modo === 'entrar'
            ? rolRegistro === 'restaurante'
              ? t.crearCuentaRestaurante
              : t.noTengo
            : t.yaTengo}
        </Text>
      ) : null}
      {/* C-AYUDA-A-LA-VISTA: soporte sin tener que iniciar sesión, en entrar y en crear cuenta. */}
      <Text
        testID="acceso-ayuda"
        style={e.enlace}
        onPress={() => abrir('/support')}
        accessibilityRole="link"
      >
        {t.necesitasAyuda}
      </Text>
      {seguirMirando ? (
        <Text style={e.enlace} onPress={seguirMirando} accessibilityRole="button">
          {t.seguirMirando}
        </Text>
      ) : null}
    </>,
  );
}
