import { abrirPagina } from './PaginaEnApp';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Text } from './diseno';
import { BackHandler, Keyboard, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  correoEjemplo,
  correoLimpio,
  filasParaRevisar,
  pareceCorreo,
  ErrorApi,
  datosPais,
  enIdioma,
  enIdiomaDireccion,
  soloNumerosTelefono,
  textosRevisar,
  useBorrador,
  pistaDeEntrada,
  validarRegistro,
  accionDeError,
  CODIGO_PAPEL_POR_ACTIVAR,
  resumenFallos,
  textoAccionAcceso,
  llaveBorrador,
  pasoDeCasilla,
  pasoVigente,
  lugarDeBorrador,
  type CasillaRegistro,
  type FalloCasilla,
  type PasoDeFormulario,
} from '@tumbite/compartido';
import { FormularioPorPasos, type PasoVisible } from './FormularioPorPasos';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { URL_SERVIDOR, useSesion } from './sesion';
import { usePasoRegistro } from './rastroRegistro';
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
import { RevisaTusDatos } from './RevisaTusDatos';
import { SelectorPaisTelefono, usePaisSugerido } from './SelectorPaisTelefono';
import { useInvitacionLider } from './invitacionLider';
import { ActivarPapel } from './ActivarPapel';
import { SelectorLugar } from './SelectorLugar';

const INICIAL = {
  nombre: '',
  correo: '',
  telefono: '',
  fechaNacimiento: '',
  clave: '',
  sms: false,
  // C-REFERIDOS-EQUIPOS: el código con el que lo invitaron (opcional).
  invitacion: '',
  // C-TELEFONO-E164: el país del celular (arranca en el país desde donde se abre la app).
  paisTelefono: '',
  // C-FORMULARIO-POR-PASOS: el paso del registro en el que iba (vuelve al reabrir).
  pasoRegistro: '',
  // C-REGISTRO-TODO-EL-PAIS: dónde vive (País → Estado → Ciudad), como texto JSON del lugar elegido.
  lugar: '',
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
  // C-INVITAR-LIDER-UN-PASO: abierto desde el enlace personal de un líder: directo a «Crear cuenta».
  const invitacionLider = useInvitacionLider(rolRegistro === 'repartidor', () =>
    setModo('registro'),
  );
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
  const [error, setError] = useState<{ mensaje: string; campo?: string; codigo?: unknown } | null>(
    null,
  );
  // C-MENSAJES-ACCESO: el correo que se lleva al cambiar de «Entrar» a «Crear cuenta» (o al revés)
  // desde el botón que acompaña al error. Cada modo tiene su borrador; el correo no se pierde.
  const correoQueSigue = useRef('');
  // C-REVISA-TUS-DATOS: al crear la cuenta hay dos pasos, el formulario y «Revisa tus datos». La
  // cuenta solo se crea desde el segundo, con el toque en «Crear mi cuenta».
  const [paso, setPaso] = useState<'formulario' | 'revisar'>('formulario');
  // «Editar» en la revisión vuelve al formulario con esa casilla ya abierta.
  const [enfocar, setEnfocar] = useState<CasillaRegistro | null>(null);
  // Los fallos de cada casilla al tocar «Continuar», dichos al lado de su casilla.
  const [fallos, setFallos] = useState<FalloCasilla[]>([]);
  // Un paso atrás. Desde «Revisa tus datos» se vuelve al formulario; desde «Crear cuenta», a
  // «Entrar». Cada modo tiene su borrador: lo escrito no se pierde al ir y volver.
  const aEntrar = useCallback(() => {
    setError(null);
    if (paso === 'revisar') {
      setPaso('formulario');
      return;
    }
    setFallos([]);
    setModo('entrar');
  }, [paso]);
  const gestoVolver = useVolverDelSistema(modo === 'registro', aEntrar);
  // C-APP-DE-PRUEBAS-VISIBLE: si entrar falla y la causa probable es la app equivocada (la de
  // pruebas con una cuenta real, o la de la tienda con una cuenta de prueba), se orienta. Sale de
  // la app y de lo escrito, nunca del servidor: no revela si la cuenta existe.
  const [pista, setPista] = useState<'appDePruebas' | 'appReal' | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Casilla de aceptación de los términos al crear la cuenta (pedido de Richard, 27 oct 2026).
  const [acepto, setAcepto] = useState(false);
  const v = b.valores;
  // C-CUENTA-UNICA: solo la app de clientes y Driver ofrecen el papel que falta con la misma cuenta.
  // Divoox Restaurants (rolRegistro «restaurante») no lo manda y se comporta como siempre.
  const papelApp = rolRegistro === 'cliente' || rolRegistro === 'repartidor' ? rolRegistro : null;
  const porActivar = papelApp && modo === 'entrar' && error?.codigo === CODIGO_PAPEL_POR_ACTIVAR;
  // C-RASTRO: los pasos de antes de crear la cuenta, una vez por aparato (solo un contador).
  const registrando = modo === 'registro';
  usePasoRegistro(api, rolRegistro, 'abrio', registrando);
  usePasoRegistro(api, rolRegistro, 'formulario', registrando && Boolean(v.nombre || v.correo));
  usePasoRegistro(api, rolRegistro, 'revisar', registrando && paso === 'revisar');
  const errorDe = (c: CasillaRegistro) =>
    fallos.find((f) => f.campo === c)?.mensaje ?? (error?.campo === c ? error.mensaje : undefined);
  // El error de una casilla se va en cuanto la persona la corrige (antes quedaba en rojo aunque ya
  // estuviera bien escrita).
  const cambiar = (campo: Exclude<keyof typeof INICIAL, 'sms'>, valor: string) => {
    b.cambiar(campo, valor);
    setError((e) => (e?.campo === campo ? null : e));
    setFallos((f) => f.filter((x) => x.campo !== campo));
  };
  // Con la invitación, el correo ya puesto (si la persona todavía no escribió otro).
  useEffect(() => {
    if (modo === 'registro' && invitacionLider?.correo && !v.correo)
      b.cambiar('correo', invitacionLider.correo);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando llega la invitación o cambia el modo
  }, [invitacionLider, modo]);
  const turnstileSitio = useTurnstileSitio(api);
  // C-TELEFONO-E164: el selector del país del celular arranca donde está la persona (si no lo eligió).
  const paisSugerido = usePaisSugerido();
  useEffect(() => {
    if (paisSugerido && !v.paisTelefono) b.cambiar('paisTelefono', paisSugerido);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando llega la sugerencia
  }, [paisSugerido]);
  const r = textosRevisar(idioma);
  const registro = modo === 'registro' && rolRegistro;
  // C-FORMULARIO-POR-PASOS: la app de clientes y Driver crean la cuenta paso a paso. Divoox
  // Restaurants (caso abierto con Apple) sigue con su formulario de siempre, sin ningún cambio.
  const porPasos = rolRegistro === 'cliente' || rolRegistro === 'repartidor';
  const pasoReg = pasoVigente(PASOS_REGISTRO, v.pasoRegistro);
  // C-FORMULARIO-POR-PASOS: si dejó la cuenta a medio crear, al volver a abrir la app sigue en ese
  // paso (como Uber), no en «Entrar». Arriba tiene «Ya tengo una cuenta» y «Empezar de nuevo».
  useEffect(() => {
    if (!porPasos || modoInicial === 'registro') return;
    let vivo = true;
    void Promise.resolve(almacenTelefono.leer(llaveBorrador('app-registro')))
      .then((guardado) => {
        if (!vivo || !guardado) return;
        const datos = JSON.parse(guardado) as { pasoRegistro?: unknown };
        if (typeof datos.pasoRegistro === 'string' && datos.pasoRegistro) setModo('registro');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Solo al abrir la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const irAlPaso = (clave: string) => {
    setFallos([]);
    setError(null);
    b.cambiar('pasoRegistro', clave);
  };
  // Las casillas del registro, en el orden de la pantalla (también el de «Revisa tus datos»).
  const casillasRegistro: CasillaRegistro[] = [
    'nombre',
    // C-REGISTRO-TODO-EL-PAIS: clientes y Driver dicen dónde viven (cualquier ciudad del país).
    ...(porPasos ? (['lugar'] as const) : []),
    'correo',
    'telefono',
    'invitacion',
    ...(pideCumple ? (['fechaNacimiento'] as const) : []),
    'clave',
  ];

  const casillasVisibles: string[] = [
    'correo',
    'clave',
    ...(registro ? ['nombre', 'telefono', 'invitacion'] : []),
    ...(registro && porPasos ? ['lugar'] : []),
    ...(registro && pideCumple ? ['fechaNacimiento'] : []),
  ];

  // C-MENSAJES-ACCESO: con el correo puesto al pasar de un modo al otro (si ese borrador no tenía uno).
  useEffect(() => {
    const correo = correoQueSigue.current;
    if (!correo) return;
    correoQueSigue.current = '';
    if (!v.correo) b.cambiar('correo', correo);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de modo
  }, [modo]);

  /**
   * C-INTENTOS-ACCESO: lo que falla en el teléfono y nunca llega a ser un alta queda anotado para el
   * equipo. Nunca frena ni muestra nada; sin señal se reintenta una vez un poco después.
   */
  function avisarIntento(
    paso: 'formulario' | 'revisar',
    codigo: 'validacion' | 'sin_aceptar' | 'sin_conexion',
    detalle = '',
  ) {
    const cuerpo = {
      accion: 'registro',
      paso,
      codigo,
      ...(detalle ? { detalle: detalle.slice(0, 100) } : {}),
      ...(pareceCorreo(v.correo) ? { correo: correoLimpio(v.correo) } : {}),
    };
    const mandar = () => api.pedir('POST', '/datos/cuentas/intento', cuerpo);
    mandar().catch(() => setTimeout(() => void mandar().catch(() => undefined), 20_000));
  }

  /** Algo salió mal en el servidor: lo escrito se queda; si es de una casilla, se ve a su lado. */
  function alFallar(x: unknown) {
    if (modo === 'entrar' && x instanceof ErrorApi && x.estado === 401 && Platform.OS !== 'web')
      setPista(pistaDeEntrada(URL_SERVIDOR, v.correo));
    if (x instanceof ErrorApi && x.campo && casillasVisibles.includes(x.campo)) {
      setPaso('formulario');
      // C-FORMULARIO-POR-PASOS: al paso donde está la casilla que dijo el servidor.
      const alli = pasoDeCasilla(PASOS_REGISTRO, x.campo);
      if (porPasos && alli) b.cambiar('pasoRegistro', alli);
    }
    if (modo === 'registro' && x instanceof ErrorApi && x.sinConexion)
      avisarIntento('revisar', 'sin_conexion');
    setError(
      x instanceof ErrorApi
        ? { mensaje: x.message, campo: x.campo, codigo: x.datos?.codigo }
        : { mensaje: String(x) },
    );
  }

  /** El botón que acompaña al error (C-MENSAJES-ACCESO): crear cuenta, recuperar o entrar. */
  const accion = accionDeError(error?.codigo, modo);
  function hacerAccion() {
    if (accion === 'olvide') {
      abrirPagina(`${URL_SERVIDOR}/forgot-password`);
      return;
    }
    if ((accion === 'crear' && !rolRegistro) || !accion) return;
    correoQueSigue.current = correoLimpio(v.correo);
    setError(null);
    setFallos([]);
    setPista(null);
    setPaso('formulario');
    setModo(accion === 'crear' ? 'registro' : 'entrar');
  }

  async function entrarConCuenta() {
    setError(null);
    setPista(null);
    if (!pareceCorreo(v.correo)) {
      setError({ mensaje: t.correoInvalido, campo: 'correo' });
      return;
    }
    setEnviando(true);
    try {
      const sesion = await api.entrar({
        correo: v.correo,
        clave: v.clave,
        ...(papelApp ? { cuentaUnica: true } : {}),
      });
      if (!rolesPermitidos.includes(sesion.usuario.rol)) {
        setError({ mensaje: t.rolEquivocado });
        return;
      }
      await b.limpiar();
      await alEntrar(sesion.token, sesion.usuario);
    } catch (x) {
      alFallar(x);
    } finally {
      // C-MENSAJES-ACCESO: el pase del escudo sirve una sola vez; el escudo pide otro ya.
      olvidarPaseTurnstile();
      setEnviando(false);
    }
  }

  /** C-CUENTA-UNICA: «Activar mi cuenta de cliente» / «Empezar mi registro de conductor». */
  async function activarYEntrar() {
    if (!papelApp) return;
    setEnviando(true);
    try {
      const sesion = await api.entrar({
        correo: v.correo,
        clave: v.clave,
        cuentaUnica: true,
        activarPapel: true,
        aceptaTerminosPapel: true,
      });
      if (!rolesPermitidos.includes(sesion.usuario.rol)) {
        setError({ mensaje: t.rolEquivocado });
        return;
      }
      setError(null);
      await b.limpiar();
      await alEntrar(sesion.token, sesion.usuario);
    } catch (x) {
      alFallar(x);
    } finally {
      olvidarPaseTurnstile();
      setEnviando(false);
    }
  }

  /**
   * C-REVISA-TUS-DATOS: «Continuar» del formulario. Valida cada casilla y, si todo está bien, abre
   * «Revisa tus datos». NUNCA crea la cuenta.
   */
  function continuar() {
    setError(null);
    Keyboard.dismiss();
    const malos = validarRegistro(v, idioma, casillasRegistro);
    setFallos(malos);
    if (malos.length) {
      avisarIntento('formulario', 'validacion', malos.map((m) => m.campo).join(','));
      // C-FORMULARIO-POR-PASOS: una casilla de un paso anterior quedó mal: se vuelve a ese paso.
      const alli = pasoDeCasilla(PASOS_REGISTRO, malos[0]?.campo);
      if (porPasos && alli) b.cambiar('pasoRegistro', alli);
      return;
    }
    if (!acepto) {
      setError({ mensaje: t.faltaAceptar });
      avisarIntento('formulario', 'sin_aceptar');
      return;
    }
    setEnfocar(null);
    setPaso('revisar');
  }

  /**
   * C-FORMULARIO-POR-PASOS: «Siguiente» de un paso del registro. Valida solo las casillas de ese
   * paso; el error va al lado de cada una y, junto al botón, por qué no avanza.
   */
  function validarPaso(clave: string): boolean {
    setError(null);
    Keyboard.dismiss();
    const delPaso = PASOS_REGISTRO.find((p) => p.clave === clave)?.casillas ?? [];
    const malos = validarRegistro(
      v,
      idioma,
      casillasRegistro.filter((c) => delPaso.includes(c)),
    );
    setFallos(malos);
    if (malos.length) {
      avisarIntento('formulario', 'validacion', malos.map((m) => m.campo).join(','));
      return false;
    }
    return true;
  }

  /** «Editar» en la revisión: de vuelta al formulario, con lo escrito y esa casilla abierta. */
  function editar(campo: CasillaRegistro | null) {
    setError(null);
    setEnfocar(campo);
    setPaso('formulario');
    // C-FORMULARIO-POR-PASOS: al paso de esa casilla («Editar datos», al primero).
    if (porPasos) b.cambiar('pasoRegistro', pasoDeCasilla(PASOS_REGISTRO, campo) ?? 'nombre');
  }

  /**
   * Crea la cuenta. La llama SOLO el botón «Crear mi cuenta» de «Revisa tus datos» (candado
   * C-REVISA-TUS-DATOS): ni la última casilla, ni el teclado, ni un efecto.
   */
  async function crearCuenta() {
    if (!rolRegistro) return;
    setError(null);
    setEnviando(true);
    try {
      const sesion = await api.registro({
        nombre: v.nombre.trim(),
        correo: correoLimpio(v.correo),
        clave: v.clave,
        telefono: v.telefono || undefined,
        ...(v.telefono && v.paisTelefono ? { paisTelefono: v.paisTelefono } : {}),
        fechaNacimiento: v.fechaNacimiento || undefined,
        rol: rolRegistro,
        idioma,
        // C-SMS-CONSENTIMIENTO: la casilla de SMS, aparte y sin marcar.
        smsConsentimiento: v.sms,
        canal: 'app',
        // C-TELEFONO-AL-REGISTRARSE: esta app trae la pantalla del código por SMS.
        verificaTelefono: true,
        ...(v.invitacion.trim() ? { invitacion: v.invitacion.trim().toUpperCase() } : {}),
        // C-REGISTRO-TODO-EL-PAIS: dónde vive. La cuenta se crea SIEMPRE, haya zona o no.
        ...(porPasos && lugarDeBorrador(v.lugar) ? { lugar: lugarDeBorrador(v.lugar) } : {}),
      });
      if (!rolesPermitidos.includes(sesion.usuario.rol)) {
        setError({ mensaje: t.rolEquivocado });
        return;
      }
      await b.limpiar();
      await alEntrar(sesion.token, sesion.usuario);
    } catch (x) {
      alFallar(x);
    } finally {
      olvidarPaseTurnstile();
      setEnviando(false);
    }
  }

  // C-CUENTA-UNICA: con la tarjeta de activar el papel, el texto va en la tarjeta (no como error).
  const mensajeGeneral = porActivar ? null : mensajeSinCasilla(error, casillasVisibles);
  // Inglés sin prefijo, español bajo /es: la misma página legal en el idioma de la app.
  const abrir = (ruta: string) => abrirPagina(`${URL_SERVIDOR}${enIdiomaDireccion(ruta, idioma)}`);
  // Cada app con su color en la píldora del idioma: Driver azul, Restaurants (la única sin registro)
  // negro y el cliente rojo, para que las tres se distingan a primera vista.
  const fondoIdioma =
    acento === 'logistica' ? COLOR.logistica : rolRegistro ? C.primario : COLOR.negro;
  // Arriba, la flecha dice adónde lleva: de la revisión al formulario, del formulario a «Entrar».
  const textoVolver = paso === 'revisar' ? r.editarDatos : t.volverAEntrar;
  const tituloPantalla = !registro ? t.entrar : paso === 'revisar' ? r.titulo : t.crearCuenta;
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
          {registro ? <EncabezadoVolver texto={textoVolver} alVolver={aEntrar} /> : null}
          {portada}
          {cuerpo}
        </ScrollView>
      </SafeAreaView>
    ) : (
      <Pantalla titulo={tituloPantalla} volver={registro ? aEntrar : seguirMirando}>
        {cuerpo}
      </Pantalla>
    );
  if (registro && paso === 'revisar')
    return marco(
      <RevisaTusDatos
        idioma={idioma}
        correo={v.correo}
        filas={filasParaRevisar(v, idioma, casillasRegistro)}
        enviando={enviando}
        error={mensajeGeneral}
        conTitulo={Boolean(portada)}
        alEditar={editar}
        alEditarDatos={() => editar(null)}
        alCrear={() => void crearCuenta()}
        aceptarCorreo={(x) => cambiar('correo', x)}
      >
        <Turnstile sitio={turnstileSitio} idioma={idioma} />
      </RevisaTusDatos>,
    );
  // ── Las casillas, una vez: el registro por pasos y el formulario de siempre usan las mismas. ──
  const campoNombre = registro ? (
    <Campo
      etiqueta={t.nombre}
      value={v.nombre}
      onChangeText={(x) => cambiar('nombre', x)}
      autoComplete="name"
      textContentType="name"
      autoCapitalize="words"
      autoFocus={enfocar === 'nombre'}
      placeholder={t.nombre}
      error={errorDe('nombre')}
    />
  ) : null;
  const campoCorreo = (
    <>
      <Campo
        etiqueta={t.correo}
        value={v.correo}
        onChangeText={(x) => cambiar('correo', x)}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        autoFocus={Boolean(registro) && enfocar === 'correo'}
        placeholder={correoEjemplo(idioma)}
        error={errorDe('correo')}
      />
      {registro ? (
        <SugerenciaCorreo correo={v.correo} idioma={idioma} aceptar={(x) => cambiar('correo', x)} />
      ) : null}
    </>
  );
  const campoCelular = registro ? (
    <>
      <SelectorPaisTelefono
        pais={v.paisTelefono || null}
        alCambiar={(x) => cambiar('paisTelefono', x)}
        idioma={idioma}
      />
      <Campo
        etiqueta={t.telefono}
        value={v.telefono}
        // Solo números (y el + del país): las letras no entran.
        onChangeText={(x) => cambiar('telefono', soloNumerosTelefono(x))}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        autoFocus={enfocar === 'telefono'}
        // Cómo se escribe un celular en ese país (ejemplo imposible a propósito).
        placeholder={datosPais(v.paisTelefono)?.ejemploCelular ?? t.telefono}
        error={errorDe('telefono')}
      />
    </>
  ) : null;
  // C-REGISTRO-TODO-EL-PAIS: «Dónde vives», con el catálogo completo del país (nunca las zonas).
  const campoLugar =
    registro && porPasos ? (
      <SelectorLugar
        valor={lugarDeBorrador(v.lugar)}
        alElegir={(l) => cambiar('lugar', JSON.stringify(l))}
        idioma={idioma}
        paisSugerido={paisSugerido}
        error={errorDe('lugar')}
        testID="registro-lugar"
      />
    ) : null;
  const campoInvitacion = registro ? (
    <Campo
      etiqueta={t.invitacion}
      value={v.invitacion}
      onChangeText={(x) => cambiar('invitacion', x.toUpperCase())}
      autoCapitalize="characters"
      autoCorrect={false}
      autoFocus={enfocar === 'invitacion'}
      placeholder={t.invitacionAyuda}
      testID="registro-invitacion"
      error={errorDe('invitacion')}
    />
  ) : null;
  const campoCumple =
    registro && pideCumple ? (
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
    ) : null;
  const campoClave = (
    <CampoClave
      etiqueta={t.clave}
      valor={v.clave}
      cambiar={(x) => cambiar('clave', x)}
      nueva={Boolean(registro)}
      // C-REVISA-TUS-DATOS: al crear la cuenta, la tecla del teclado solo lo guarda; nada se
      // manda solo. Al entrar sí entra, como en cualquier app.
      alEnviar={registro ? () => Keyboard.dismiss() : () => void entrarConCuenta()}
      error={errorDe('clave')}
    />
  );
  const terminos = registro ? (
    // Aceptación con casilla antes de crear la cuenta (Apple y Google la revisan).
    // Solo el cuadrito es la casilla: el texto lleva enlaces y un toque ahí abre la página.
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
      <Pressable
        onPress={() => {
          setAcepto(!acepto);
          setError((x) => (x?.mensaje === t.faltaAceptar ? null : x));
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acepto }}
        accessibilityLabel={`${t.aceptas} ${t.terminos} ${t.yLa} ${t.privacidad}`}
        hitSlop={10}
        testID="registro-acepto"
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
  ) : null;
  const casillaSms = registro ? (
    <CasillaSms idioma={idioma} marcada={v.sms} cambiar={(x) => b.cambiar('sms', x)} />
  ) : null;
  // C-MENSAJES-ACCESO: el error dice qué pasó y este botón, qué hacer.
  const botonAccion =
    accion && (accion !== 'crear' || rolRegistro) ? (
      <Boton
        testID={`accion-${accion}`}
        secundario
        texto={textoAccionAcceso(accion, idioma)}
        alTocar={hacerAccion}
      />
    ) : null;
  const avisoPista = pista ? (
    <Text
      testID="pista-entrada"
      accessibilityRole="alert"
      style={{ color: '#7A4B00', fontSize: 14, marginBottom: 10 }}
    >
      {pista === 'appDePruebas' ? t.pistaAppDePruebas : t.pistaAppReal}
    </Text>
  ) : null;
  const enlaceCambiarModo = rolRegistro ? (
    <Text
      testID={modo === 'entrar' ? 'ir-a-crear-cuenta' : 'ya-tengo-cuenta'}
      style={e.enlace}
      onPress={() => {
        setError(null);
        setFallos([]);
        setPaso('formulario');
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
  ) : null;
  const pie = (
    <>
      {enlaceCambiarModo}
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
    </>
  );
  const encabezado = (
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
      {registro && invitacionLider ? (
        <Text testID="invitacion-lider" style={{ fontSize: 15, marginBottom: 12 }}>
          {idioma === 'en'
            ? `You’re invited to lead the “${invitacionLider.linea}” line in ${invitacionLider.ciudad}. Create your account${invitacionLider.correo ? ' with this email' : ''} and the line is yours automatically.`
            : `Te invitamos a ser el líder de la línea «${invitacionLider.linea}» en ${invitacionLider.ciudad}. Crea tu cuenta${invitacionLider.correo ? ' con este correo' : ''} y la línea queda a tu nombre sola.`}
        </Text>
      ) : null}
    </>
  );

  // C-FORMULARIO-POR-PASOS: crear la cuenta en la app de clientes y en Driver, un paso por pantalla.
  if (registro && porPasos) {
    const tp = enIdioma(TEXTOS_PASOS_REGISTRO, idioma);
    const pasos: PasoVisible[] = [
      {
        clave: 'nombre',
        casillas: ['nombre', 'fechaNacimiento'],
        titulo: tp.nombre,
        contenido: (
          <>
            {campoNombre}
            {campoCumple}
          </>
        ),
      },
      {
        clave: 'lugar',
        casillas: ['lugar'],
        titulo: tp.lugar,
        ayuda: tp.lugarAyuda,
        contenido: campoLugar,
      },
      {
        clave: 'correo',
        casillas: ['correo'],
        titulo: tp.correo,
        ayuda: tp.correoAyuda,
        contenido: campoCorreo,
      },
      {
        clave: 'celular',
        casillas: ['telefono'],
        titulo: tp.celular,
        ayuda: tp.celularAyuda,
        contenido: (
          <>
            {campoCelular}
            {casillaSms}
          </>
        ),
      },
      {
        clave: 'clave',
        casillas: ['clave'],
        titulo: tp.clave,
        ayuda: tp.claveAyuda,
        contenido: campoClave,
      },
      {
        clave: 'final',
        casillas: ['invitacion'],
        titulo: tp.final,
        ayuda: tp.finalAyuda,
        contenido: (
          <>
            {campoInvitacion}
            {terminos}
          </>
        ),
      },
    ];
    return marco(
      <>
        {encabezado}
        <FormularioPorPasos
          pasos={pasos}
          paso={pasoReg}
          alCambiarPaso={irAlPaso}
          alSiguiente={validarPaso}
          alTerminar={continuar}
          alSalir={aEntrar}
          textoTerminar={r.continuar}
          testIDTerminar="registro-continuar"
          porQue={fallos.length ? resumenFallos(fallos, idioma) : mensajeGeneral}
          testIDPorQue={fallos.length ? 'registro-revisar-casillas' : 'acceso-error'}
          idioma={idioma}
          testID="registro-por-pasos"
        />
        {botonAccion}
        {pie}
      </>,
    );
  }

  return marco(
    <>
      {encabezado}
      {campoNombre}
      {campoCorreo}
      {campoCelular}
      {campoInvitacion}
      {campoCumple}
      {campoClave}
      {/* En el registro, el escudo va en «Revisa tus datos», donde se crea la cuenta. */}
      {registro ? null : <Turnstile sitio={turnstileSitio} idioma={idioma} />}
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
      {terminos}
      {casillaSms}
      {/* C-SIN-EXITO-FALSO: junto al botón, qué casillas faltan (el error de cada una va a su lado). */}
      {registro && fallos.length ? (
        <Text
          style={[e.error, { marginBottom: 8 }]}
          accessibilityRole="alert"
          testID="registro-revisar-casillas"
        >
          {resumenFallos(fallos, idioma)}
        </Text>
      ) : null}
      {botonAccion}
      {avisoPista}
      {porActivar && papelApp ? (
        <ActivarPapel
          papel={papelApp}
          idioma={idioma}
          enviando={enviando}
          alActivar={() => void activarYEntrar()}
          abrirTerminos={() => abrir(papelApp === 'repartidor' ? '/driver-terms' : '/terms')}
          alOtroCorreo={() => {
            setError(null);
            setFallos([]);
            setPaso('formulario');
            setModo('registro');
          }}
        />
      ) : registro ? (
        // C-REVISA-TUS-DATOS: «Continuar» lleva a revisar; la cuenta todavía no se crea.
        <Boton testID="registro-continuar" texto={r.continuar} alTocar={continuar} />
      ) : (
        <Boton
          texto={enviando ? t.enviando : t.entrar}
          alTocar={() => void entrarConCuenta()}
          cargando={enviando}
        />
      )}
      {modo === 'entrar' ? (
        <Text
          style={e.enlace}
          onPress={() => abrirPagina(`${URL_SERVIDOR}/forgot-password`)}
          accessibilityRole="link"
        >
          {t.olvide}
        </Text>
      ) : null}
      {pie}
    </>,
  );
}

/** C-FORMULARIO-POR-PASOS: los pasos del registro (cliente y Driver), en orden. */
const PASOS_REGISTRO: readonly PasoDeFormulario[] = [
  { clave: 'nombre', casillas: ['nombre', 'fechaNacimiento'] },
  { clave: 'lugar', casillas: ['lugar'] },
  { clave: 'correo', casillas: ['correo'] },
  { clave: 'celular', casillas: ['telefono'] },
  { clave: 'clave', casillas: ['clave'] },
  { clave: 'final', casillas: ['invitacion'] },
];

/** C-FORMULARIO-POR-PASOS: el título y la ayuda de cada paso del registro (cliente y Driver). */
const TEXTOS_PASOS_REGISTRO = {
  es: {
    nombre: '¿Cómo te llamas?',
    lugar: '¿Dónde vives?',
    lugarAyuda: 'Elige tu país, tu estado y tu ciudad o pueblo.',
    correo: '¿Cuál es tu correo?',
    correoAyuda: 'Ahí te mandamos el enlace para activar tu cuenta.',
    celular: '¿Cuál es tu celular?',
    celularAyuda: 'Lo usamos para avisarte y para confirmar que eres tú.',
    clave: 'Crea tu contraseña',
    claveAyuda: 'Al menos 8 caracteres. Toca el ojito para verla.',
    final: 'Último paso',
    finalAyuda: 'Si alguien te invitó, escribe su código. Después revisas tus datos.',
  },
  en: {
    nombre: 'What’s your name?',
    lugar: 'Where do you live?',
    lugarAyuda: 'Choose your country, your state, and your city or town.',
    correo: 'What’s your email?',
    correoAyuda: 'We’ll send the link to activate your account there.',
    celular: 'What’s your mobile number?',
    celularAyuda: 'We use it to keep you posted and to confirm it’s you.',
    clave: 'Create your password',
    claveAyuda: 'At least 8 characters. Tap the eye to see it.',
    final: 'Last step',
    finalAyuda: 'If someone invited you, enter their code. Then you’ll review your details.',
  },
};
