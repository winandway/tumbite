import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorApi, datosPais, enIdioma, useBorrador } from '@tumbite/compartido';
import { Text } from './diseno';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { AvisoBorrador } from './AvisoBorrador';
import { SelectorPaisTelefono, usePaisSugerido } from './SelectorPaisTelefono';
import { useSesion } from './sesion';
import { useSoporte } from './soporte';
import { Boton, C, Campo, e } from './ui';

/**
 * C-TELEFONO-AL-REGISTRARSE (22 nov 2026, orden de Richard por Gerencia, como Uber, DoorDash y Rappi):
 * la cuenta nueva de cliente o de conductor confirma su celular con un código de seis números por SMS
 * antes de usar la app. Una sola pieza para las dos apps.
 *
 * - El código sale solo al abrir la pantalla; el teléfono lo pega solo (iPhone: «oneTimeCode»; Android:
 *   «sms-otp») y al completar los seis números se confirma sin tocar nada.
 * - «Mandar otro código» con su cuenta atrás (la espera crece con cada envío, como pide el servidor).
 * - Número mal escrito: se cambia aquí mismo (con su país). Nadie queda atrapado: si no llega, la
 *   salida a soporte está a la vista, y cerrar sesión también.
 * - Cuentas que ya existían: NO se bloquean. Arriba de la app ven una franja discreta para confirmarlo
 *   cuando quieran, que se puede cerrar (nunca una ventana).
 * Si el servidor dice que hoy el SMS no sale (país apagado, sin cupo o sin presupuesto), no hay puerta.
 */
const T = {
  es: {
    titulo: 'Confirma tu celular',
    enviamos: 'Te mandamos un código de 6 números por SMS al número que termina en',
    enviamosWa: 'Te enviamos un código de 6 números por WhatsApp al número que termina en',
    porSms: 'Enviármelo por SMS',
    pasoASms: 'No llegó por WhatsApp: te lo mandamos por SMS.',
    porSmsEn: (s: number) => `Puedes pedirlo por SMS en ${s} s`,
    enviando: 'Mandando el código…',
    escribe: 'Escribe tu número de celular. Te mandamos un código por SMS para confirmarlo.',
    codigo: 'Código de 6 números',
    confirmar: 'Confirmar',
    otro: 'Mandar otro código',
    otroEn: (s: number) => `Puedes pedir otro en ${s} s`,
    cambiar: '¿Número equivocado? Cámbialo',
    numero: 'Número de celular',
    guardar: 'Guardar y mandar el código',
    cancelar: 'Cancelar',
    noLlega:
      '¿No te llega? Revisa que tengas señal, que el número esté bien y tu WhatsApp. Si sigue sin llegar, escríbenos.',
    whatsapp: 'Escribir a soporte por WhatsApp',
    correo: 'Escribir a soporte por correo',
    salir: 'Cerrar sesión',
    listo: 'Tu celular quedó confirmado',
    seguir: 'Continuar',
    franja: 'Confirma tu celular para proteger tu cuenta',
    franjaBoton: 'Confirmar',
    franjaCerrar: 'Cerrar el aviso',
    ahoraNo: 'Ahora no',
    sinConexion: 'No pudimos conectarnos. Revisa tu internet e inténtalo otra vez.',
    reintentar: 'Reintentar',
    mensajeSoporte: 'Hola, no me llega el código por SMS para confirmar mi celular en Divoox.',
  },
  en: {
    titulo: 'Confirm your cell phone',
    enviamos: 'We texted a 6-digit code to the number ending in',
    enviamosWa: 'We sent a 6-digit code on WhatsApp to the number ending in',
    porSms: 'Text it to me instead',
    pasoASms: 'It didn’t arrive on WhatsApp, so we texted it to you.',
    porSmsEn: (s: number) => `You can get it by text in ${s}s`,
    enviando: 'Sending the code…',
    escribe: 'Enter your cell phone number. We’ll text you a code to confirm it.',
    codigo: '6-digit code',
    confirmar: 'Confirm',
    otro: 'Send another code',
    otroEn: (s: number) => `You can request another in ${s}s`,
    cambiar: 'Wrong number? Change it',
    numero: 'Cell phone number',
    guardar: 'Save and send the code',
    cancelar: 'Cancel',
    noLlega:
      'Not getting it? Check your signal, your number and your WhatsApp. If it still doesn’t arrive, contact us.',
    whatsapp: 'Contact support on WhatsApp',
    correo: 'Email support',
    salir: 'Sign out',
    listo: 'Your cell phone is confirmed',
    seguir: 'Continue',
    franja: 'Confirm your cell phone to protect your account',
    franjaBoton: 'Confirm',
    franjaCerrar: 'Close this notice',
    ahoraNo: 'Not now',
    sinConexion: 'We couldn’t connect. Check your internet and try again.',
    reintentar: 'Try again',
    mensajeSoporte: 'Hi, I’m not getting the text code to confirm my cell phone on Divoox.',
  },
};

/** El buzón de soporte (lo atiende el equipo; divoox.com no recibe correo: C-CORREO-SIN-RECIBIR-DIVOOX). */
export const CORREO_SOPORTE = 'soporte+divoox@windoce.com';

type Puerta = {
  motivo: 'registro' | 'vuelta' | 'sugerido';
  ultimos: string | null;
  obligatorio: boolean;
  /** El país del celular guardado (o de la cuenta): el selector arranca ahí. */
  pais?: string | null;
  /** Ya hay un código que sirve: al abrir no se manda otro (no se gasta la cuota del día). */
  vigente?: boolean;
  /** Segundos para poder pedir otro (-1: ya no se puede hoy). */
  proximoEnSegundos?: number;
  /** C-CODIGO-CANALES: por dónde salió el último código, y si se puede pedir por SMS. */
  canal?: 'whatsapp' | 'sms' | null;
  smsDisponible?: boolean;
};

/**
 * Lo que dijo el servidor en esta sesión, por cuenta: la app del cliente arma la puerta en cada pantalla
 * de la cuenta, y así no aparece la ruedita cada vez (se vuelve a preguntar igual, en silencio).
 */
const recordado = new Map<string, Puerta | null>();
const abre = (p: Puerta | null | undefined) =>
  p?.obligatorio && p.motivo === 'registro' ? ('puerta' as const) : ('dentro' as const);

/** Llave de la franja cerrada, por cuenta (en este teléfono). */
const llaveFranja = (id: string) => `franja-celular:${id}`;

export function PuertaTelefono({ children }: { children: ReactNode }) {
  const { api, usuario } = useSesion();
  const yaSabido = usuario && recordado.has(usuario.id) ? recordado.get(usuario.id) : undefined;
  const [estado, setEstado] = useState<'mirando' | 'puerta' | 'listo' | 'dentro' | 'sinRed'>(
    yaSabido === undefined ? 'mirando' : abre(yaSabido),
  );
  const [puerta, setPuerta] = useState<Puerta | null>(yaSabido ?? null);
  const [franjaCerrada, setFranjaCerrada] = useState(true);
  const [abiertaPorFranja, setAbiertaPorFranja] = useState(false);

  const mirar = useCallback(async () => {
    try {
      const r = await api.pedir<{ puerta: Puerta | null }>('GET', '/datos/cuentas/telefono');
      setPuerta(r.puerta);
      if (usuario) recordado.set(usuario.id, r.puerta);
      // Driver: la vuelta tras 14 días tiene su tarjeta en Inicio (no bloquea la app).
      setEstado((e) => (e === 'listo' ? e : abre(r.puerta)));
    } catch {
      setEstado((e) => (e === 'mirando' ? 'sinRed' : e));
    }
  }, [api, usuario]);

  useEffect(() => {
    const t = setTimeout(() => void mirar(), 0);
    return () => clearTimeout(t);
  }, [mirar]);

  useEffect(() => {
    if (!usuario || puerta?.motivo !== 'sugerido') return;
    void Promise.resolve(almacenTelefono.leer(llaveFranja(usuario.id)))
      .then((v) => setFranjaCerrada(Boolean(v)))
      .catch(() => setFranjaCerrada(false));
  }, [usuario, puerta]);

  const cerrarFranja = () => {
    setFranjaCerrada(true);
    if (usuario)
      void Promise.resolve(almacenTelefono.guardar(llaveFranja(usuario.id), '1')).catch(() => {});
  };

  if (estado === 'mirando')
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator color={C.primario} size="large" />
      </View>
    );
  // Sin red no se bloquea a nadie por esta puerta: se reintenta, y el servidor frena lo que haga falta.
  if (estado === 'sinRed') return <SinRed alReintentar={() => void mirar()}>{children}</SinRed>;
  if (estado === 'listo') return <Listo alSeguir={() => setEstado('dentro')} />;
  if (estado === 'puerta' || abiertaPorFranja)
    return (
      <ConfirmaTuCelular
        ultimosInicial={puerta?.ultimos ?? null}
        paisInicial={puerta?.pais ?? null}
        vigente={puerta?.vigente === true}
        esperaInicial={puerta?.proximoEnSegundos ?? 0}
        canalInicial={puerta?.canal ?? null}
        smsInicial={puerta?.smsDisponible === true}
        opcional={!puerta?.obligatorio}
        alAhoraNo={() => {
          setAbiertaPorFranja(false);
          cerrarFranja();
        }}
        alConfirmar={() => {
          setAbiertaPorFranja(false);
          setPuerta(null);
          if (usuario) recordado.set(usuario.id, null);
          setEstado('listo');
        }}
      />
    );
  return (
    <View style={{ flex: 1 }}>
      {puerta?.motivo === 'sugerido' && !franjaCerrada ? (
        <FranjaCelular alAbrir={() => setAbiertaPorFranja(true)} alCerrar={cerrarFranja} />
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function FranjaCelular({ alAbrir, alCerrar }: { alAbrir: () => void; alCerrar: () => void }) {
  const { idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const arriba = useSafeAreaInsets().top;
  return (
    <View
      testID="franja-celular"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingTop: arriba + 8,
        paddingBottom: 8,
        paddingHorizontal: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E4E5E7',
      }}
    >
      <Text style={{ flex: 1, fontSize: 14, color: C.secundario }}>{t.franja}</Text>
      <Pressable accessibilityRole="button" onPress={alAbrir} hitSlop={8}>
        <Text style={{ color: C.primario, fontWeight: '700', fontSize: 14 }}>{t.franjaBoton}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.franjaCerrar}
        onPress={alCerrar}
        hitSlop={10}
      >
        <Text style={{ color: '#666B73', fontSize: 18 }}>×</Text>
      </Pressable>
    </View>
  );
}

function SinRed({ children, alReintentar }: { children: ReactNode; alReintentar: () => void }) {
  const { idioma } = useSesion();
  const t = enIdioma(T, idioma);
  return (
    <View style={{ flex: 1 }}>
      <View style={[e.aviso, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        <Text style={{ flex: 1 }}>{t.sinConexion}</Text>
        <Pressable accessibilityRole="button" onPress={alReintentar}>
          <Text style={{ color: C.primario, fontWeight: '700' }}>{t.reintentar}</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function Listo({ alSeguir }: { alSeguir: () => void }) {
  const { idioma } = useSesion();
  const t = enIdioma(T, idioma);
  return (
    <View
      testID="celular-confirmado"
      style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' }}
    >
      <View
        style={{
          alignSelf: 'center',
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: C.exito,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 36, fontWeight: '700' }}>✓</Text>
      </View>
      <Text
        style={{ fontSize: 24, fontWeight: '700', color: C.secundario, textAlign: 'center' }}
        accessibilityRole="header"
      >
        {t.listo}
      </Text>
      <Boton texto={t.seguir} alTocar={alSeguir} testID="celular-continuar" />
    </View>
  );
}

function ConfirmaTuCelular({
  ultimosInicial,
  paisInicial,
  vigente,
  esperaInicial,
  canalInicial,
  smsInicial,
  opcional,
  alConfirmar,
  alAhoraNo,
}: {
  ultimosInicial: string | null;
  paisInicial: string | null;
  vigente: boolean;
  esperaInicial: number;
  canalInicial: 'whatsapp' | 'sms' | null;
  smsInicial: boolean;
  opcional: boolean;
  alConfirmar: () => void;
  alAhoraNo: () => void;
}) {
  const { api, idioma, salir, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const arriba = useSafeAreaInsets().top;
  const soporte = useSoporte(api);
  const paisSugerido = usePaisSugerido();
  const [ultimos, setUltimos] = useState(ultimosInicial);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState<'' | 'enviar' | 'confirmar' | 'cambiar'>('');
  const [enviado, setEnviado] = useState(vigente);
  const [espera, setEspera] = useState(Math.max(0, esperaInicial));
  // C-CODIGO-CANALES: WhatsApp primero; si no llega, «Enviármelo por SMS» cuando termina la espera.
  const [canal, setCanal] = useState(canalInicial);
  const [smsDisponible, setSmsDisponible] = useState(smsInicial);
  const [aviso, setAviso] = useState('');
  // C-WHATSAPP-ENTREGA: mientras el código va por WhatsApp, se mira cada 5 segundos. Si no se entregó,
  // el servidor lo manda solo por SMS y la pantalla lo dice.
  useEffect(() => {
    if (canal !== 'whatsapp' || !enviado) return;
    const reloj = setInterval(() => {
      void api
        .pedir<{ puerta: Puerta | null }>('GET', '/datos/cuentas/telefono')
        .then((r) => {
          if (r.puerta?.canal === 'sms') {
            setCanal('sms');
            setAviso(t.pasoASms);
            setCodigo('');
            setEspera(Math.max(0, r.puerta.proximoEnSegundos ?? 0));
          }
        })
        .catch(() => {
          // Sin red se vuelve a mirar en la próxima vuelta.
        });
    }, 5000);
    return () => clearInterval(reloj);
  }, [api, canal, enviado, t.pasoASms]);
  const [cambiando, setCambiando] = useState(!ultimosInicial);
  // NINGÚN FORMULARIO PIERDE LO ESCRITO: el número nuevo se guarda solo. El código no (es de un solo uso).
  const b = useBorrador({
    formulario: 'cambiar-celular-puerta',
    cuenta: usuario?.id,
    inicial: { telefono: '', paisTelefono: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const pais = b.valores.paisTelefono || paisInicial || paisSugerido || '';

  useEffect(() => {
    if (espera <= 0) return;
    const r = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(r);
  }, [espera]);

  const enviar = useCallback(
    async (porSms = false) => {
      setError('');
      setOcupado('enviar');
      try {
        const r = await api.pedir<{
          ultimos: string;
          proximoEnSegundos: number;
          canal: 'whatsapp' | 'sms';
          smsDisponible: boolean;
        }>('POST', '/datos/cuentas/telefono/codigo', porSms ? { canal: 'sms' } : {});
        setUltimos(r.ultimos);
        setCanal(r.canal);
        setSmsDisponible(r.smsDisponible);
        setEnviado(true);
        setCodigo('');
        setEspera(Math.max(0, r.proximoEnSegundos));
      } catch (x) {
        setError(x instanceof ErrorApi ? x.message : String(x));
        // Si el servidor pide esperar, la cuenta atrás sale de su mensaje («Espera 60 segundos…»).
        const s = /(\d+)/.exec(x instanceof Error ? x.message : '');
        if (x instanceof ErrorApi && x.estado === 429 && s) setEspera(Number(s[1]));
        if (x instanceof ErrorApi && x.estado === 429) setEnviado(true);
      } finally {
        setOcupado('');
      }
    },
    [api],
  );

  // El primer código sale solo al abrir la pantalla (si ya hay número y no hay uno vigente).
  const primero = useRef(false);
  useEffect(() => {
    if (primero.current || !ultimosInicial || vigente) return;
    primero.current = true;
    void enviar();
  }, [enviar, ultimosInicial, vigente]);

  async function confirmar(valor = codigo) {
    if (valor.length !== 6 || ocupado) return;
    setError('');
    setOcupado('confirmar');
    try {
      await api.pedir('POST', '/datos/cuentas/telefono/verificar', { codigo: valor });
      alConfirmar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      setCodigo('');
    } finally {
      setOcupado('');
    }
  }

  async function cambiar() {
    setError('');
    setOcupado('cambiar');
    try {
      const r = await api.pedir<{ puerta: Puerta | null }>('PUT', '/datos/cuentas/telefono', {
        telefono: b.valores.telefono.trim(),
        ...(pais ? { paisTelefono: pais } : {}),
      });
      await b.limpiar();
      setCambiando(false);
      // En un país donde hoy no sale el SMS, ya no hay nada que confirmar: se entra.
      if (!r.puerta) {
        alConfirmar();
        return;
      }
      setUltimos(r.puerta.ultimos);
      setOcupado('');
      await enviar();
    } catch (x) {
      // Si falla, lo escrito se queda en pantalla para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado('');
    }
  }

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      testID="confirma-tu-celular"
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 24, paddingTop: arriba + 32, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{ fontSize: 26, fontWeight: '700', color: C.secundario }}
        accessibilityRole="header"
      >
        {t.titulo}
      </Text>
      {!cambiando && ultimos ? (
        <>
          <Text style={{ fontSize: 16, color: '#666B73' }}>
            {ocupado === 'enviar' && !enviado
              ? t.enviando
              : `${canal === 'whatsapp' ? t.enviamosWa : t.enviamos} ${ultimos}.`}
          </Text>
          <TextInput
            testID="codigo-celular"
            value={codigo}
            onChangeText={(x) => {
              const limpio = x.replace(/\D/g, '').slice(0, 6);
              setCodigo(limpio);
              if (limpio.length === 6) void confirmar(limpio);
            }}
            placeholder="000000"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={6}
            style={[e.input, { fontSize: 26, letterSpacing: 8, textAlign: 'center' }]}
            accessibilityLabel={t.codigo}
          />
        </>
      ) : (
        <Text style={{ fontSize: 16, color: '#666B73' }}>{t.escribe}</Text>
      )}
      {aviso ? (
        <Text
          testID="paso-a-sms"
          style={{ fontSize: 14, color: C.secundario, fontWeight: '600' }}
          accessibilityRole="alert"
        >
          {aviso}
        </Text>
      ) : null}
      {error ? (
        <Text style={{ fontSize: 14, color: C.acento }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {!cambiando && ultimos ? (
        <>
          <Boton
            texto={t.confirmar}
            cargando={ocupado === 'confirmar'}
            alTocar={() => void confirmar()}
          />
          {canal === 'whatsapp' && smsDisponible ? (
            <Boton
              testID="codigo-por-sms"
              texto={espera > 0 ? t.porSmsEn(espera) : t.porSms}
              secundario
              cargando={ocupado === 'enviar'}
              alTocar={() => {
                if (espera <= 0) void enviar(true);
              }}
            />
          ) : (
            <Boton
              texto={espera > 0 ? t.otroEn(espera) : t.otro}
              secundario
              cargando={ocupado === 'enviar'}
              alTocar={() => {
                if (espera <= 0) void enviar();
              }}
            />
          )}
          <Boton texto={t.cambiar} secundario alTocar={() => setCambiando(true)} />
        </>
      ) : (
        <View style={{ gap: 4 }}>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <SelectorPaisTelefono
            pais={pais || null}
            alCambiar={(x) => b.cambiar('paisTelefono', x)}
            idioma={idioma}
          />
          <Campo
            tipo="celular"
            pais={pais || null}
            etiqueta={t.numero}
            testID="celular-nuevo"
            value={b.valores.telefono}
            onChangeText={(x) => b.cambiar('telefono', x.replace(/[^\d+]/g, ''))}
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder={datosPais(pais)?.ejemploCelular ?? t.numero}
          />
          <Boton
            texto={t.guardar}
            testID="celular-guardar"
            cargando={ocupado === 'cambiar'}
            alTocar={() => void cambiar()}
          />
          {ultimos ? (
            <Boton texto={t.cancelar} secundario alTocar={() => setCambiando(false)} />
          ) : null}
        </View>
      )}
      <Text style={{ fontSize: 14, color: '#666B73', marginTop: 8 }}>{t.noLlega}</Text>
      {soporte.whatsapp ? (
        <Boton
          texto={t.whatsapp}
          secundario
          alTocar={() => void soporte.abrirWhatsapp(t.mensajeSoporte)}
        />
      ) : null}
      <Boton
        texto={t.correo}
        secundario
        alTocar={() =>
          void Linking.openURL(
            `mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent(t.titulo)}&body=${encodeURIComponent(t.mensajeSoporte)}`,
          )
        }
      />
      {opcional ? (
        <Boton texto={t.ahoraNo} secundario alTocar={alAhoraNo} />
      ) : (
        <Boton texto={t.salir} secundario alTocar={() => void salir()} />
      )}
    </ScrollView>
  );
}
