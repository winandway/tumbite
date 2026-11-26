import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Api, ErrorApi, type PasoVerificacion } from '@tumbite/compartido';
import {
  Boton,
  COLOR,
  FUENTE,
  Icono,
  MOTOR_NATIVO,
  SelectorIdioma,
  Text,
  almacenTelefono,
  useReducirMovimiento,
  useSesion,
} from '@tumbite/movil';
import { AvisoIa } from './AvisoIa';
import { hayQueMostrarAvisoIa } from './textosAvisoIa';
import { CamaraConMarco } from './CamaraConMarco';
import { AnilloPerfil, DibujoHorma, MarcaLista, Mini } from './Horma';
import {
  type PasoDelServidor,
  type Verificacion,
  avanceDeFotos,
  avisoDeLaIa,
  dibujoDePaso,
  esRedonda,
  fotoLista,
  momentoDelPaso,
  nombreDeFoto,
  pasoPendiente,
  pasosEnOrden,
  proporcionDeHorma,
  sePuedeCambiar,
  siguientePaso,
  todasLasExigidas,
  textosDelPaso,
} from './logica';

const T = {
  es: {
    volver: 'Volver',
    paso: (i: number, n: number) => `Paso ${i} de ${n}`,
    asi: 'Así te la vamos a pedir. Se toma en un momento.',
    tomar: 'Tomar foto',
    soloCamara: 'Se toma en vivo, con la cámara de la app.',
    seVe: '¿Se ve completa y se lee bien?',
    seVeCara: 'Así quedará tu foto de perfil.',
    usar: 'Usar esta',
    repetir: 'Repetir',
    usarIgual: 'Usar esta de todos modos',
    lista: 'Foto lista',
    siguiente: 'Siguiente',
    opcionalTexto:
      'Si tu licencia tiene parte de atrás, súbela también. Es opcional: con el frente basta.',
    saltar: 'Saltar este paso',
    opcionalCorta: 'Opcional',
    revisar: 'Revisar mis papeles',
    cambiar: 'Cambiar esta foto',
    aprobada: 'Este papel ya está aprobado. No hace falta cambiarlo.',
    pidieron: 'Nuestro equipo pidió repetir esta foto:',
    guardar: 'Guardar y seguir después',
    ayuda: '¿Necesitas ayuda?',
    consentimiento:
      'Usamos la foto de tu cara para comprobar que el documento es tuyo y como tu foto de perfil. La ve el equipo de Divoox y los pasajeros de tus viajes. No la vendemos.',
    acepto: 'Acepto y sigo',
    // C-PERMISO-IA: permiso explícito ANTES de la primera foto (Apple 5.1.2(i)).
    papeles: 'Revisa tus papeles',
    papelesAyuda: 'Toca cualquiera para repetirla. Cuando todo esté bien, envíalos.',
    enviar: 'Enviar a revisión',
    faltan: 'Todavía faltan fotos. Toca las que dicen «Falta».',
    listaCorta: 'Lista',
    falta: 'Falta',
    hayQueRepetir: 'Repetir',
    enviadosTitulo: 'Papeles enviados',
    enviadosTexto:
      'Nuestro equipo los revisa. Te avisamos aquí y por correo en cuanto estén aprobados.',
    yaEnRevision: 'Tus papeles ya están en revisión. Te avisamos aquí y por correo.',
    alInicio: 'Ir al inicio',
    yaPuedes: 'Ya puedes trabajar',
    yaPuedesTexto: (d: number) =>
      d > 0
        ? `Tu cuenta está activa. Conéctate y empieza a recibir viajes y pedidos. Tienes ${d} días para subir el resto de tus papeles.`
        : 'Tu cuenta está activa. Conéctate y empieza a recibir viajes y pedidos.',
    seguir: 'Seguir con mis papeles',
    listos: (a: number, b: number) => `${a} de ${b} fotos listas`,
    hola: (n: string) => (n ? `Hola, ${n}` : 'Hola'),
    reintentar: 'Reintentar',
  },
  en: {
    volver: 'Back',
    paso: (i: number, n: number) => `Step ${i} of ${n}`,
    asi: 'This is what we’ll ask for. It takes a moment.',
    tomar: 'Take photo',
    soloCamara: 'It’s taken live, with the app’s camera.',
    seVe: 'Is it complete and easy to read?',
    seVeCara: 'This will be your profile photo.',
    usar: 'Use this one',
    repetir: 'Retake',
    usarIgual: 'Use this one anyway',
    lista: 'Photo ready',
    siguiente: 'Next',
    opcionalTexto:
      'If your license has a back side, upload it too. It’s optional: the front is enough.',
    saltar: 'Skip this step',
    opcionalCorta: 'Optional',
    revisar: 'Review my documents',
    cambiar: 'Change this photo',
    aprobada: 'This document is already approved. No need to change it.',
    pidieron: 'Our team asked you to retake this photo:',
    guardar: 'Save and continue later',
    ayuda: 'Need help?',
    consentimiento:
      'We use your face photo to confirm the document is yours and as your profile photo. The Divoox team and the riders on your trips see it. We don’t sell it.',
    acepto: 'I agree, continue',
    papeles: 'Review your documents',
    papelesAyuda: 'Tap any photo to retake it. When everything looks right, send them.',
    enviar: 'Send for review',
    faltan: 'Some photos are still missing. Tap the ones marked “Missing”.',
    listaCorta: 'Ready',
    falta: 'Missing',
    hayQueRepetir: 'Retake',
    enviadosTitulo: 'Documents sent',
    enviadosTexto:
      'Our team is reviewing them. We’ll let you know here and by email once approved.',
    yaEnRevision: 'Your documents are already under review. We’ll let you know here and by email.',
    alInicio: 'Go to home',
    yaPuedes: 'You can start working',
    yaPuedesTexto: (d: number) =>
      d > 0
        ? `Your account is active. Go online and start getting trips and orders. You have ${d} days to upload the rest of your documents.`
        : 'Your account is active. Go online and start getting trips and orders.',
    seguir: 'Continue with my documents',
    listos: (a: number, b: number) => `${a} of ${b} photos ready`,
    hola: (n: string) => (n ? `Hi, ${n}` : 'Hi'),
    reintentar: 'Retry',
  },
};

type Pantalla =
  | { tipo: 'paso'; paso: PasoVerificacion }
  | { tipo: 'revisar' }
  | { tipo: 'enviado' }
  | { tipo: 'yaPuedes'; sigue: PasoVerificacion | null };

const LLAVE_YA_PUEDES = 'driver.papeles.yaPuedes';

/** Las miniaturas de las fotos ya guardadas (privadas: se piden con la sesión). */
export function useMiniaturas(api: Api, v: Verificacion | null) {
  const [minis, setMinis] = useState<Map<PasoVerificacion, { id: string; uri: string }>>(new Map());
  const pedidas = useRef(new Set<string>());
  useEffect(() => {
    let vivo = true;
    for (const p of v?.pasos ?? []) {
      const f = p.foto;
      if (!f || pedidas.current.has(f.id)) continue;
      pedidas.current.add(f.id);
      api
        .verFoto(`/datos/conductor/verificacion/foto/${p.paso}`)
        .then((uri) => {
          if (vivo) setMinis((m) => new Map(m).set(p.paso, { id: f.id, uri }));
        })
        .catch(() => pedidas.current.delete(f.id));
    }
    return () => {
      vivo = false;
    };
  }, [api, v]);
  const poner = useCallback((paso: PasoVerificacion, uri: string) => {
    setMinis((m) => new Map(m).set(paso, { id: 'local', uri }));
  }, []);
  const uriDe = useCallback(
    (p: PasoDelServidor) => (p.foto ? (minis.get(p.paso)?.uri ?? null) : null),
    [minis],
  );
  return { uriDe, poner };
}

/**
 * C-ASISTENTE-DRIVER: el asistente de verificación, igual al borrador aprobado. Un paso por foto;
 * antes de abrir la cámara se ve la horma de lo que se va a pedir; la cámara trae el marco con esa
 * misma figura; cada foto tomada queda como miniatura con su marca verde en la tira de arriba, y se
 * avanza con «Siguiente». Cada foto se guarda al aceptarla (se puede dejar a medias y retomar).
 * NADA se manda a revisión solo: hace falta el toque en «Enviar a revisión» de «Revisa tus papeles».
 */
export function AsistentePapeles({
  v,
  recargar,
  alSalir,
  alAyuda,
  abrirEn,
  alSubida,
  alConsentir,
}: {
  v: Verificacion;
  recargar: () => Promise<Verificacion | null>;
  alSalir: () => void;
  alAyuda: () => void;
  /** C-FOTO-CARA-A-LA-VISTA: la foto ya subió (cuenta como tomada aunque la relectura falle). */
  alSubida?: (paso: PasoVerificacion) => void;
  /** El consentimiento de la cara ya quedó guardado. */
  alConsentir?: () => void;
  /** «revisar» abre directo en «Revisa tus papeles». */
  abrirEn?: 'revisar';
}) {
  const { api, idioma, cambiarIdioma } = useSesion();
  const t = idioma === 'en' ? T.en : T.es;
  const [pantalla, setPantalla] = useState<Pantalla>(() => {
    const falta = pasoPendiente(v);
    return abrirEn === 'revisar' || !falta ? { tipo: 'revisar' } : { tipo: 'paso', paso: falta };
  });
  const { uriDe, poner } = useMiniaturas(api, v);
  // C-PAPELES-SOLO-CAMARA: toda foto sale de la cámara de la app; nunca de los archivos.
  const [nueva, setNueva] = useState<{ uri: string } | null>(null);
  const [aviso, setAviso] = useState('');
  const [recien, setRecien] = useState<PasoVerificacion | null>(null);
  const [camara, setCamara] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [consintio, setConsintio] = useState(false);
  // C-FOTO-CARA-A-LA-VISTA: el embudo (una fila la primera vez; el servidor descarta las repeticiones).
  useEffect(() => {
    void api.hito('asistente_abierto');
  }, [api]);

  const orden = pasosEnOrden(v);
  const irA = (p: Pantalla) => {
    setNueva(null);
    setAviso('');
    setError('');
    setPantalla(p);
  };
  const fallo = (x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x));

  async function aceptarConsentimiento() {
    setOcupado(true);
    setError('');
    try {
      await api.pedir('POST', '/datos/kyc/consentimiento', { acepto: true });
      // Guardado: se sigue aunque la relectura falle con mala señal.
      setConsintio(true);
      alConsentir?.();
      await recargar();
    } catch (x) {
      fallo(x);
    } finally {
      setOcupado(false);
    }
  }

  /** «Usar esta»: recién aquí la foto sube. El servidor contesta al momento lo que vio la IA. */
  async function usar(paso: PasoVerificacion) {
    if (!nueva || ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const blob = await (await fetch(nueva.uri)).blob();
      const r = await api.subirFotoCon<{ ia?: { color?: string; aviso?: string } }>(
        blob,
        `/datos/conductor/verificacion/foto/${paso}?origen=camara`,
      );
      poner(paso, nueva.uri);
      alSubida?.(paso);
      setNueva(null);
      setRecien(paso);
      const nuevo = await recargar();
      const dice = avisoDeLaIa(r.ia);
      setAviso(dice);
      // La cara es lo que deja empezar: la primera vez, dentro del plazo, se celebra.
      if (!dice && paso === 'cara' && nuevo?.plazo.estado === 'en_plazo') {
        let visto: string | null = null;
        try {
          visto = (await almacenTelefono.leer(LLAVE_YA_PUEDES)) ?? null;
        } catch {
          visto = null;
        }
        if (!visto) {
          try {
            await almacenTelefono.guardar(LLAVE_YA_PUEDES, '1');
          } catch (x) {
            console.warn('papeles: no se guardó la marca de bienvenida', x);
          }
          setPantalla({ tipo: 'yaPuedes', sigue: siguientePaso(nuevo, paso) });
        }
      }
    } catch (x) {
      // La foto tomada se queda: «Reintentar» la vuelve a subir sin repetirla.
      const motivo = x instanceof ErrorApi ? (x.datos?.motivo as string | undefined) : undefined;
      void api.hito(
        'subida_fallida',
        motivo === 'tiempo' || motivo === 'sin_conexion' || motivo === 'servidor'
          ? motivo
          : 'rechazo',
      );
      fallo(x);
    } finally {
      setOcupado(false);
    }
  }

  async function insistir(paso: PasoVerificacion) {
    setOcupado(true);
    setError('');
    try {
      await api.pedir('POST', `/datos/conductor/verificacion/foto/${paso}/insistir`, {});
      setAviso('');
    } catch (x) {
      fallo(x);
    } finally {
      setOcupado(false);
    }
  }

  async function enviar() {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    try {
      await api.pedir('POST', '/datos/conductor/verificacion/enviar', {});
      await recargar();
      setPantalla({ tipo: 'enviado' });
    } catch (x) {
      fallo(x);
    } finally {
      setOcupado(false);
    }
  }

  const cabecera = (centro: string, atras: () => void) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable
          testID="papeles-volver"
          onPress={atras}
          accessibilityRole="button"
          accessibilityLabel={t.volver}
          hitSlop={12}
          style={{ padding: 8 }}
        >
          <Icono nombre="chevron-back" tamano={24} />
        </Pressable>
        <Text style={{ color: COLOR.textoSuave, fontFamily: FUENTE.textoFuerte, fontSize: 14 }}>
          {centro}
        </Text>
      </View>
      <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} sobreClaro />
    </View>
  );
  const marco = (cuerpo: ReactNode) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="asistente-papeles">
      {cuerpo}
    </SafeAreaView>
  );
  const textoError = error ? (
    <Text
      accessibilityRole="alert"
      testID="papeles-error"
      style={{ color: COLOR.error, fontWeight: '700', textAlign: 'center', lineHeight: 20 }}
    >
      {error}
    </Text>
  ) : null;
  const enlaces = (
    <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4 }}>
      <Pressable
        testID="papeles-guardar"
        onPress={alSalir}
        accessibilityRole="button"
        style={{ padding: 6 }}
      >
        <Text style={{ fontFamily: FUENTE.tituloMedio, textDecorationLine: 'underline' }}>
          {t.guardar}
        </Text>
      </Pressable>
      <Pressable
        testID="papeles-ayuda"
        onPress={alAyuda}
        accessibilityRole="link"
        style={{ padding: 6 }}
      >
        <Text style={{ color: COLOR.textoSuave, textDecorationLine: 'underline' }}>{t.ayuda}</Text>
      </Pressable>
    </View>
  );

  // C-AVISO-IA-UNICO: la pantalla propia del aviso de IA va ANTES de la primera foto y del permiso
  // de cámara (reemplaza el «Sí / No» que salía encima de la horma).
  if (hayQueMostrarAvisoIa(v))
    return <AvisoIa api={api} idioma={idioma} alListo={() => recargar()} />;

  // ───────────────────────── «Ya puedes trabajar» ─────────────────────────
  if (pantalla.tipo === 'yaPuedes') {
    const sigue = pantalla.sigue;
    return marco(
      <>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Celebracion>
            <AnilloPerfil
              uri={uriDe(orden.find((p) => p.paso === 'cara') ?? orden[0]!)}
              hechas={avanceDeFotos(v).listas}
              total={avanceDeFotos(v).total}
              lado={132}
            />
          </Celebracion>
          <Text
            testID="ya-puedes-trabajar"
            style={{
              fontFamily: FUENTE.titulo,
              fontSize: 28,
              color: COLOR.exito,
              marginTop: 22,
              textAlign: 'center',
            }}
          >
            {t.yaPuedes}
          </Text>
          <Text
            style={{
              color: COLOR.textoSuave,
              fontSize: 16,
              lineHeight: 23,
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            {t.yaPuedesTexto(v.plazo.dias)}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 22, paddingBottom: 18, gap: 10 }}>
          <Boton texto={t.alInicio} alTocar={alSalir} exito testID="ya-puedes-inicio" />
          <Boton
            texto={t.seguir}
            alTocar={() => irA(sigue ? { tipo: 'paso', paso: sigue } : { tipo: 'revisar' })}
            secundario
            testID="ya-puedes-seguir"
          />
        </View>
      </>,
    );
  }

  // ───────────────────────── «Papeles enviados» ─────────────────────────
  if (pantalla.tipo === 'enviado')
    return marco(
      <>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Celebracion>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: COLOR.exitoSuave,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre="checkmark" tamano={54} color={COLOR.exito} />
            </View>
          </Celebracion>
          <Text
            testID="papeles-enviados"
            style={{ fontFamily: FUENTE.titulo, fontSize: 26, marginTop: 20, textAlign: 'center' }}
          >
            {t.enviadosTitulo}
          </Text>
          <Text
            style={{
              color: COLOR.textoSuave,
              fontSize: 16,
              lineHeight: 23,
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            {t.enviadosTexto}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 22, paddingBottom: 18 }}>
          <Boton texto={t.alInicio} alTocar={alSalir} testID="papeles-al-inicio" />
        </View>
      </>,
    );

  // ───────────────────────── «Revisa tus papeles» ─────────────────────────
  if (pantalla.tipo === 'revisar') {
    // C-LICENCIA-REVERSO-OPCIONAL: lo opcional nunca frena «Enviar».
    const todas = todasLasExigidas(v);
    const enRevision = todas && !v.puedeEnviar;
    return marco(
      <>
        {cabecera('', alSalir)}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}>
          <Text style={{ fontFamily: FUENTE.titulo, fontSize: 26, marginTop: 6 }}>{t.papeles}</Text>
          <Text style={{ color: COLOR.textoSuave, fontSize: 15, lineHeight: 22, marginTop: 6 }}>
            {enRevision ? t.yaEnRevision : t.papelesAyuda}
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}
            testID="rejilla-papeles"
          >
            {orden.map((p) => {
              const lista = fotoLista(p);
              const repetir = p.foto?.estado === 'repetir';
              return (
                <Pressable
                  key={p.paso}
                  testID={`papel-${p.paso}`}
                  onPress={() => irA({ tipo: 'paso', paso: p.paso })}
                  accessibilityRole="button"
                  accessibilityLabel={`${nombreDeFoto(p.paso, v.pais, idioma)}: ${
                    lista
                      ? t.listaCorta
                      : repetir
                        ? t.hayQueRepetir
                        : p.opcional
                          ? t.opcionalCorta
                          : t.falta
                  }`}
                  style={{
                    width: '47.5%',
                    borderWidth: 1,
                    borderColor: repetir ? COLOR.aviso : COLOR.borde,
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Mini clase={dibujoDePaso(p.paso)} uri={uriDe(p)} alto={64} lista={lista} />
                  <Text
                    style={{ fontFamily: FUENTE.textoFuerte, fontSize: 13, textAlign: 'center' }}
                  >
                    {nombreDeFoto(p.paso, v.pais, idioma)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FUENTE.textoFuerte,
                      fontSize: 12,
                      color: lista ? COLOR.exito : repetir ? COLOR.aviso : COLOR.textoSuave,
                    }}
                  >
                    {lista
                      ? `✓ ${t.listaCorta}`
                      : repetir
                        ? t.hayQueRepetir
                        : p.opcional
                          ? t.opcionalCorta
                          : t.falta}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <PieFijo
          error={textoError}
          principal={
            enRevision ? (
              <Boton texto={t.alInicio} alTocar={alSalir} secundario testID="papeles-al-inicio" />
            ) : (
              <View style={{ opacity: todas ? 1 : 0.45 }}>
                <Boton
                  texto={t.enviar}
                  alTocar={() => (todas ? void enviar() : setError(t.faltan))}
                  cargando={ocupado}
                  testID="papeles-enviar"
                />
              </View>
            )
          }
          secundario={
            <Pressable
              testID="papeles-ayuda"
              onPress={alAyuda}
              accessibilityRole="link"
              style={{ alignSelf: 'center', padding: 6 }}
            >
              <Text style={{ color: COLOR.textoSuave, textDecorationLine: 'underline' }}>
                {t.ayuda}
              </Text>
            </Pressable>
          }
        />
      </>,
    );
  }

  // ───────────────────────── Un paso: una foto ─────────────────────────
  const paso = pantalla.paso;
  const dato = orden.find((p) => p.paso === paso) ?? orden[0]!;
  const tx = textosDelPaso(paso, v.pais, idioma);
  const redonda = esRedonda(paso);
  const { listas, total } = avanceDeFotos(v);
  const indice = orden.findIndex((p) => p.paso === paso) + 1;
  const momento = momentoDelPaso({ foto: dato.foto, fotoNueva: Boolean(nueva), aviso });
  const cambiable = sePuedeCambiar(v, dato);
  const pideConsentimiento =
    paso === 'cara' && !(v.consentimiento || consintio) && momento === 'horma';
  const sigue = siguientePaso(v, paso);
  const uri = nueva?.uri ?? uriDe(dato);
  const anchoHorma = redonda ? (momento === 'horma' ? 150 : 164) : 240;
  const abrirCamara = () => {
    setError('');
    setCamara(true);
    void api.hito('camara_abierta');
  };
  const nota = (texto: string, id?: string) => (
    <Text
      testID={id}
      style={{ color: COLOR.textoSuave, textAlign: 'center', fontSize: 13, lineHeight: 18 }}
    >
      {texto}
    </Text>
  );
  // C-FOTO-CARA-A-LA-VISTA: lo que se dice arriba de la horma (a la vista) y el botón principal del
  // momento, que va en el pie FIJO. Lo demás se desliza por detrás.
  let explicacion: ReactNode = null;
  let principal: ReactNode = null;
  if (momento === 'horma' && pideConsentimiento) {
    explicacion = (
      <View
        testID="papeles-consentimiento"
        style={{ borderWidth: 1, borderColor: COLOR.bordeFuerte, borderRadius: 12, padding: 12 }}
      >
        <Text style={{ fontSize: 14, lineHeight: 20 }}>{t.consentimiento}</Text>
      </View>
    );
    principal = (
      <Boton
        texto={t.acepto}
        alTocar={() => void aceptarConsentimiento()}
        cargando={ocupado}
        testID="papeles-acepto"
      />
    );
  } else if (momento === 'horma' || momento === 'repetir') {
    if (momento === 'horma' && dato.opcional)
      explicacion = (
        <View
          testID="papeles-opcional"
          style={{ borderWidth: 1, borderColor: COLOR.borde, borderRadius: 12, padding: 12 }}
        >
          <Text style={{ fontSize: 14, lineHeight: 20 }}>{t.opcionalTexto}</Text>
        </View>
      );
    if (momento === 'repetir')
      explicacion = (
        <View
          accessibilityRole="alert"
          style={{ backgroundColor: COLOR.avisoSuave, borderRadius: 12, padding: 12 }}
        >
          <Text style={{ color: COLOR.aviso, fontSize: 14, lineHeight: 20 }}>
            {t.pidieron} {dato.foto?.motivo}
          </Text>
        </View>
      );
    // C-PAPELES-SOLO-CAMARA: un solo camino, la cámara de la app; nunca la galería ni los archivos.
    principal = (
      <>
        <Boton
          texto={t.tomar}
          icono="camera-outline"
          alTocar={abrirCamara}
          testID="papeles-tomar"
        />
        {nota(momento === 'horma' ? `${t.asi} ${t.soloCamara}` : t.soloCamara)}
        {dato.opcional ? (
          <Pressable
            testID="papeles-saltar"
            onPress={() => irA(sigue ? { tipo: 'paso', paso: sigue } : { tipo: 'revisar' })}
            accessibilityRole="button"
            style={{ alignSelf: 'center', padding: 6 }}
          >
            <Text style={{ fontFamily: FUENTE.textoFuerte, textDecorationLine: 'underline' }}>
              {t.saltar}
            </Text>
          </Pressable>
        ) : null}
      </>
    );
  } else if (momento === 'vista_previa') {
    principal = (
      <>
        {nota(redonda ? t.seVeCara : t.seVe)}
        <Boton
          // Con la subida caída, la misma foto se vuelve a subir: no hay que repetirla.
          texto={error ? t.reintentar : t.usar}
          alTocar={() => void usar(paso)}
          cargando={ocupado}
          testID="papeles-usar"
        />
        <Boton
          texto={t.repetir}
          icono="camera-outline"
          alTocar={() => {
            setNueva(null);
            abrirCamara();
          }}
          secundario
          testID="papeles-repetir"
        />
      </>
    );
  } else if (momento === 'aviso') {
    explicacion = (
      <View
        accessibilityRole="alert"
        testID="papeles-aviso"
        style={{ backgroundColor: COLOR.avisoSuave, borderRadius: 12, padding: 12 }}
      >
        <Text
          style={{
            color: COLOR.aviso,
            fontFamily: FUENTE.textoFuerte,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
          }}
        >
          {aviso}
        </Text>
      </View>
    );
    principal = (
      <>
        <Boton
          texto={t.repetir}
          icono="camera-outline"
          alTocar={abrirCamara}
          testID="papeles-repetir"
        />
        <Pressable
          testID="papeles-usar-igual"
          onPress={() => void insistir(paso)}
          accessibilityRole="button"
          style={{ alignSelf: 'center', padding: 6 }}
        >
          <Text style={{ fontFamily: FUENTE.textoFuerte, textDecorationLine: 'underline' }}>
            {t.usarIgual}
          </Text>
        </Pressable>
      </>
    );
  } else if (momento === 'lista') {
    principal = (
      <>
        <Boton
          texto={sigue ? t.siguiente : t.revisar}
          alTocar={() => irA(sigue ? { tipo: 'paso', paso: sigue } : { tipo: 'revisar' })}
          testID="papeles-siguiente"
        />
        {cambiable ? (
          <Pressable
            testID="papeles-cambiar"
            onPress={abrirCamara}
            accessibilityRole="button"
            style={{ alignSelf: 'center', padding: 6 }}
          >
            <Text style={{ fontFamily: FUENTE.textoFuerte, textDecorationLine: 'underline' }}>
              {t.cambiar}
            </Text>
          </Pressable>
        ) : (
          nota(t.aprobada)
        )}
      </>
    );
  }
  return marco(
    <>
      {cabecera(t.paso(indice, orden.length), alSalir)}
      <View style={{ paddingHorizontal: 22 }}>
        <View
          style={{ height: 5, borderRadius: 3, backgroundColor: '#E9EAEC', overflow: 'hidden' }}
        >
          <View
            testID="papeles-barra"
            style={{
              width: `${total ? (listas / total) * 100 : 0}%`,
              height: 5,
              backgroundColor: COLOR.exito,
            }}
          />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 6 }}
        testID="tira-de-fotos"
      >
        {orden.map((p) => (
          <Pressable
            key={p.paso}
            testID={`tira-${p.paso}`}
            onPress={() => irA({ tipo: 'paso', paso: p.paso })}
            accessibilityRole="button"
            accessibilityState={{ selected: p.paso === paso }}
            accessibilityLabel={nombreDeFoto(p.paso, v.pais, idioma)}
            style={{
              padding: 4,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: p.paso === paso ? COLOR.negro : 'transparent',
              opacity: p.paso === paso ? 1 : 0.8,
            }}
          >
            <Mini
              clase={dibujoDePaso(p.paso)}
              uri={uriDe(p)}
              alto={32}
              // Una foto con aviso de la IA todavía no lleva la marca verde (verde = salió bien).
              lista={fotoLista(p) && !(p.paso === paso && momento === 'aviso')}
              animada={recien === p.paso && momento !== 'aviso'}
            />
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 12, gap: 10 }}
      >
        <View>
          <Text style={{ fontFamily: FUENTE.titulo, fontSize: 24, lineHeight: 30 }}>
            {tx.titulo}
          </Text>
          <Text style={{ color: COLOR.textoSuave, fontSize: 15, lineHeight: 21, marginTop: 2 }}>
            {tx.ayuda}
          </Text>
        </View>
        {explicacion}
        {tx.lado ? (
          <Text
            style={{
              fontFamily: FUENTE.titulo,
              fontSize: 13,
              letterSpacing: 2.2,
              color: COLOR.textoSuave,
              textAlign: 'center',
              marginTop: 6,
            }}
          >
            {tx.lado}
          </Text>
        ) : null}
        <View
          testID={`horma-${momento}`}
          style={{
            alignSelf: 'center',
            marginTop: 4,
            width: anchoHorma,
            aspectRatio: momento === 'horma' ? proporcionDeHorma(paso) : redonda ? 1 : 1.586,
          }}
        >
          {uri && momento !== 'horma' ? (
            <View
              style={{
                flex: 1,
                borderRadius: redonda ? 999 : 14,
                backgroundColor: '#FFFFFF',
                shadowColor: '#000',
                shadowOpacity: 0.16,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
              }}
            >
              <Image
                source={{ uri }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
                style={{ width: '100%', height: '100%', borderRadius: redonda ? 999 : 14 }}
              />
            </View>
          ) : (
            <DibujoHorma clase={dibujoDePaso(paso)} />
          )}
          {momento === 'lista' ? <MarcaLista lado={32} animada={recien === paso} /> : null}
        </View>
        {momento === 'lista' ? (
          <Text
            testID="papeles-foto-lista"
            style={{
              color: COLOR.exito,
              fontFamily: FUENTE.textoNegrita,
              textAlign: 'center',
              fontSize: 15,
            }}
          >
            ✓ {t.lista}
          </Text>
        ) : null}
      </ScrollView>
      <PieFijo error={textoError} principal={principal} secundario={enlaces} />
      {camara ? (
        <CamaraConMarco
          paso={paso}
          pais={v.pais}
          idioma={idioma}
          alCerrar={() => setCamara(false)}
          alFallo={(motivo) => void api.hito('camara_fallo', motivo)}
          alTomar={(foto) => {
            setCamara(false);
            setAviso('');
            setError('');
            setNueva({ uri: foto.uri });
            void api.hito('foto_tomada');
          }}
        />
      ) : null}
    </>,
  );
}

/**
 * C-FOTO-CARA-A-LA-VISTA (23 nov 2026): el pie FIJO del asistente. El error va pegado al botón
 * principal, el botón principal siempre a la vista, y «Guardar y seguir después» y la ayuda debajo,
 * como secundarios. Lo de arriba se desliza por detrás (antes, en un celular chico, «Acepto y sigo»
 * quedaba fuera de pantalla y lo único visible era «Guardar y seguir después»).
 */
function PieFijo({
  error,
  principal,
  secundario,
}: {
  error: ReactNode;
  principal: ReactNode;
  secundario: ReactNode;
}) {
  return (
    <View
      testID="papeles-pie"
      style={{
        paddingHorizontal: 22,
        paddingTop: 10,
        paddingBottom: 10,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: COLOR.borde,
        backgroundColor: '#FFFFFF',
      }}
    >
      {error}
      {principal}
      {secundario}
    </View>
  );
}

/** Aparece con un saltito (o sin él, si el teléfono pide menos movimiento). */
function Celebracion({ children }: { children: ReactNode }) {
  const reducir = useReducirMovimiento();
  const [escala] = useState(() => new Animated.Value(reducir ? 1 : 0.6));
  useEffect(() => {
    if (reducir) return;
    Animated.spring(escala, {
      toValue: 1,
      friction: 5,
      tension: 90,
      useNativeDriver: MOTOR_NATIVO,
    }).start();
  }, [reducir, escala]);
  return <Animated.View style={{ transform: [{ scale: escala }] }}>{children}</Animated.View>;
}
