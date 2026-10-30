import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { type Api, ErrorApi, enIdioma } from '@tumbite/compartido';
import { Boton, C, e, useSesion } from '@tumbite/movil';

const T = {
  es: {
    antecedentes: 'Antecedentes',
    antecedentesAyuda:
      'Como en las grandes plataformas, revisamos antecedentes penales y récord de manejo con un proveedor (Checkr). Tus datos sensibles los escribes en la página del proveedor, nunca en Divoox.',
    antecedentesEstados: {
      sin_pedir: 'Sin empezar',
      invitado: 'Invitación enviada: completa el formulario de Checkr',
      en_proceso: 'En proceso (suele tardar 1 a 3 días)',
      aprobado: 'Aprobados',
      revisar: 'En revisión por nuestro equipo',
    } as Record<string, string>,
    pedirAntecedentes: 'Iniciar la verificación de antecedentes',
    abrirCheckr: 'Abrir el formulario de Checkr',
    titulo: 'Verifica tu identidad',
    ayuda:
      'Para repartir con Divoox verificamos que eres tú. Toma las fotos con tu cámara; solo las ve el equipo de Divoox.',
    doc: 'Documento',
    docs: {
      licencia: 'Licencia de conducir',
      identificacion: 'Identificación oficial',
      pasaporte: 'Pasaporte',
    },
    frente: 'Foto del documento (frente)',
    reverso: 'Foto del documento (reverso)',
    selfie: 'Foto de tu cara',
    selfieAyuda:
      'De frente, con buena luz, sin gorra ni lentes oscuros. Es tu foto de perfil: la ve el cliente de cada pedido y no se puede cambiar después de aprobada.',
    fotoPerfil:
      'Tu foto de perfil verificada. La ve el cliente de cada pedido. Si necesitas una nueva, escríbenos a soporte.',
    tomar: 'Tomar foto',
    otra: 'Tomar otra',
    lista: 'Lista',
    enviar: 'Enviar para revisión',
    estados: {
      sin_enviar: 'Sin enviar',
      pendiente: 'En revisión: te avisamos por correo',
      aprobado: 'Verificado',
      rechazado: 'Hay que repetir las fotos',
    },
    permiso: 'Necesitamos permiso para usar la cámara.',
    // C-KYC-AUTO: con la verificación automática.
    consentimiento:
      'Acepto que Divoox compare mi cara con la foto de mi documento y con la de cuentas cerradas por mala conducta, para verificar que soy yo. Se guarda solo una huella numérica de mi cara, no se vende ni se comparte, y se borra si cierro mi cuenta.',
    consentir: 'Acepto',
    consentido: 'Aceptado',
    giro1: 'Gira la cabeza hacia un lado',
    giro2: 'Ahora hacia el otro lado',
    giroAyuda: 'Así sabemos que eres una persona real y no una foto.',
    verificarYa: 'Verificar ahora',
    resultado: {
      verificado: '¡Listo! Quedaste verificado.',
      repetir: 'Hay que repetir algunas fotos. Mira el motivo arriba.',
      revision: 'Nuestro equipo lo revisa y te avisamos por correo.',
    } as Record<string, string>,
  },
  en: {
    antecedentes: 'Background check',
    antecedentesAyuda:
      'Like the big platforms, we check criminal records and driving history with a provider (Checkr). You enter your sensitive details on the provider’s page, never in Divoox.',
    antecedentesEstados: {
      sin_pedir: 'Not started',
      invitado: 'Invitation sent: complete the Checkr form',
      en_proceso: 'In progress (usually 1 to 3 days)',
      aprobado: 'Approved',
      revisar: 'Under review by our team',
    } as Record<string, string>,
    pedirAntecedentes: 'Start the background check',
    abrirCheckr: 'Open the Checkr form',
    titulo: 'Verify your identity',
    ayuda:
      'To deliver with Divoox we verify it’s really you. Take the photos with your camera; only the Divoox team sees them.',
    doc: 'Document',
    docs: { licencia: 'Driver’s license', identificacion: 'Government ID', pasaporte: 'Passport' },
    frente: 'Photo of your document (front)',
    reverso: 'Photo of your document (back)',
    selfie: 'Photo of your face',
    selfieAyuda:
      'Face forward, good light, no cap or sunglasses. It’s your profile photo: customers see it on each order and it can’t be changed once approved.',
    fotoPerfil:
      'Your verified profile photo. Customers see it on each order. If you need a new one, contact support.',
    tomar: 'Take photo',
    otra: 'Retake',
    lista: 'Done',
    enviar: 'Send for review',
    estados: {
      sin_enviar: 'Not sent',
      pendiente: 'Under review: we’ll email you',
      aprobado: 'Verified',
      rechazado: 'Please retake the photos',
    },
    permiso: 'We need permission to use the camera.',
    consentimiento:
      'I agree that Divoox may compare my face with the photo on my ID and with those of accounts closed for misconduct, to verify it’s me. Only a numeric template of my face is stored; it isn’t sold or shared, and it’s deleted if I close my account.',
    consentir: 'I agree',
    consentido: 'Agreed',
    giro1: 'Turn your head to one side',
    giro2: 'Now to the other side',
    giroAyuda: 'This tells us you’re a real person and not a photo.',
    verificarYa: 'Verify now',
    resultado: {
      verificado: 'Done! You’re verified.',
      repetir: 'Some photos need to be retaken. See the reason above.',
      revision: 'Our team will review it and email you.',
    } as Record<string, string>,
  },
};

type Antecedentes = { estado: string; url: string };
type Kyc = {
  estado: 'sin_enviar' | 'pendiente' | 'aprobado' | 'rechazado';
  motivo: string;
  docTipo: string;
  tiene: Record<Pieza | 'local', boolean>;
  consentimiento?: boolean;
};
type Pieza = 'doc_frente' | 'doc_reverso' | 'selfie' | 'giro_1' | 'giro_2';

/**
 * KYC del repartidor: documento (frente y reverso, o solo el pasaporte) y una foto de su cara,
 * tomadas con la cámara. Van a la carpeta privada del servidor. Candado C-KYC.
 */
export function Verificacion() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [k, setK] = useState<Kyc | null>(null);
  const [antecedentes, setAntecedentes] = useState<Antecedentes>({ estado: 'sin_pedir', url: '' });
  const [docTipo, setDocTipo] = useState<'licencia' | 'identificacion' | 'pasaporte'>('licencia');
  const [subiendo, setSubiendo] = useState('');
  const [error, setError] = useState('');
  // C-KYC-AUTO: con el motor, consentimiento y dos tomas girando la cabeza; la decisión sale al instante.
  const [motor, setMotor] = useState(false);
  const [resultado, setResultado] = useState('');

  const cargar = useCallback(() => {
    api
      .pedir<{ kyc: Kyc; antecedentes?: Antecedentes; motor?: boolean }>('GET', '/datos/kyc')
      .then((r) => {
        setK(r.kyc);
        setMotor(Boolean(r.motor));
        if (r.antecedentes) setAntecedentes(r.antecedentes);
      })
      .catch(() => {});
  }, [api]);
  useEffect(cargar, [cargar]);

  async function tomar(pieza: Pieza) {
    setError('');
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return setError(t.permiso);
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      cameraType: pieza.startsWith('doc_')
        ? ImagePicker.CameraType.back
        : ImagePicker.CameraType.front,
    });
    const foto = r.canceled ? null : r.assets[0];
    if (!foto) return;
    setSubiendo(pieza);
    try {
      const blob = await (await fetch(foto.uri)).blob();
      await api.subirFoto(blob, `/datos/kyc/foto/${pieza}`);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendo('');
    }
  }

  async function pedirAntecedentes() {
    setError('');
    try {
      const r = await api.pedir<Antecedentes>('POST', '/datos/kyc/antecedentes/pedir', {});
      setAntecedentes(r);
      if (r.url) await Linking.openURL(r.url);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function consentir() {
    setError('');
    try {
      await api.pedir('POST', '/datos/kyc/consentimiento', { acepto: true });
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function enviar() {
    setError('');
    setResultado('');
    try {
      const r = await api.pedir<{ decision?: string }>('POST', '/datos/kyc/enviar', { docTipo });
      setResultado(
        r.decision
          ? (new Map(Object.entries(t.resultado)).get(r.decision) ?? '')
          : motor && k?.consentimiento
            ? (t.resultado.revision ?? '')
            : '',
      );
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (!k) return null;
  const listo = k.estado === 'aprobado' || k.estado === 'pendiente';
  const conMotor = motor && Boolean(k.consentimiento);
  const piezas: [Pieza, string][] = [
    ['doc_frente', t.frente],
    ...(docTipo === 'pasaporte' ? [] : ([['doc_reverso', t.reverso]] as [Pieza, string][])),
    ['selfie', t.selfie],
    ...(conMotor
      ? ([
          ['giro_1', t.giro1],
          ['giro_2', t.giro2],
        ] as [Pieza, string][])
      : []),
  ];
  return (
    <View style={[e.tarjeta, { borderWidth: 1, borderColor: '#2A2A2A' }]}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.secundario }}>{t.titulo}</Text>
      <Text
        style={{
          alignSelf: 'flex-start',
          marginVertical: 8,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          // Verde si salió bien, rojo solo si hay que repetir, gris mientras tanto.
          backgroundColor:
            k.estado === 'aprobado' ? '#E6F4EA' : k.estado === 'rechazado' ? '#FFF1EE' : '#F1F1F1',
          color:
            k.estado === 'aprobado' ? C.exito : k.estado === 'rechazado' ? '#B42200' : C.secundario,
          fontWeight: '700',
        }}
      >
        {new Map(Object.entries(t.estados)).get(k.estado)}
      </Text>
      {k.estado === 'rechazado' && k.motivo ? <Text style={e.error}>{k.motivo}</Text> : null}
      {resultado ? (
        <Text
          accessibilityRole="alert"
          style={{
            marginBottom: 8,
            fontWeight: '700',
            color: k.estado === 'aprobado' ? C.exito : C.secundario,
          }}
        >
          {resultado}
        </Text>
      ) : null}
      {k.estado === 'aprobado' ? <MiFotoVerificada api={api} texto={t.fotoPerfil} /> : null}
      {!listo ? (
        <>
          <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>{t.ayuda}</Text>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>{t.doc}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {(Object.keys(t.docs) as (keyof typeof t.docs)[]).map((d) => (
              <Pressable
                key={d}
                onPress={() => setDocTipo(d)}
                accessibilityRole="radio"
                accessibilityState={{ selected: docTipo === d }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: docTipo === d ? C.secundario : '#D6D6D6',
                  backgroundColor: docTipo === d ? C.secundario : '#FFFFFF',
                }}
              >
                <Text style={{ color: docTipo === d ? '#FFFFFF' : C.texto, fontWeight: '700' }}>
                  {new Map(Object.entries(t.docs)).get(d)}
                </Text>
              </Pressable>
            ))}
          </View>
          {motor ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: '#D6D6D6',
                borderRadius: 12,
                padding: 10,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: C.texto, marginBottom: 6 }}>{t.consentimiento}</Text>
              {k.consentimiento ? (
                <Text style={{ color: C.exito, fontWeight: '700' }}>{t.consentido}</Text>
              ) : (
                <Boton texto={t.consentir} alTocar={() => void consentir()} secundario />
              )}
            </View>
          ) : null}
          {piezas.map(([pieza, etiqueta]) => (
            <View key={pieza} style={{ marginBottom: 6 }}>
              <Text style={{ fontWeight: '700' }}>
                {etiqueta} {new Map(Object.entries(k.tiene)).get(pieza) ? `· ${t.lista}` : ''}
              </Text>
              {pieza === 'selfie' ? (
                <Text style={{ color: '#5E5E5E' }}>{t.selfieAyuda}</Text>
              ) : null}
              {pieza === 'giro_1' ? <Text style={{ color: '#5E5E5E' }}>{t.giroAyuda}</Text> : null}
              <Boton
                texto={new Map(Object.entries(k.tiene)).get(pieza) ? t.otra : t.tomar}
                alTocar={() => void tomar(pieza)}
                cargando={subiendo === pieza}
                secundario
              />
            </View>
          ))}
          {error ? (
            <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Boton texto={conMotor ? t.verificarYa : t.enviar} alTocar={() => void enviar()} />
        </>
      ) : null}
      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#E6E6E6', paddingTop: 8 }}>
        <Text style={{ fontWeight: '800' }}>{t.antecedentes}</Text>
        <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.antecedentesAyuda}</Text>
        <Text
          style={{
            marginTop: 4,
            fontWeight: '700',
            color: antecedentes.estado === 'aprobado' ? '#0D7A3A' : C.secundario,
          }}
        >
          {t.antecedentesEstados[antecedentes.estado] ?? antecedentes.estado}
        </Text>
        {antecedentes.estado === 'sin_pedir' ? (
          <Boton texto={t.pedirAntecedentes} alTocar={() => void pedirAntecedentes()} secundario />
        ) : antecedentes.estado === 'invitado' && antecedentes.url ? (
          <Boton
            texto={t.abrirCheckr}
            alTocar={() => void Linking.openURL(antecedentes.url)}
            secundario
          />
        ) : null}
      </View>
    </View>
  );
}

/** C-FOTO-VERIFICADA: la selfie aprobada es su foto de perfil; no se cambia desde la app. */
function MiFotoVerificada({ api, texto }: { api: Api; texto: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    api
      .verFoto('/datos/kyc/mi-foto')
      .then((u) => vivo && setUri(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f1f1f1' }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <Text style={{ flex: 1, color: '#5E5E5E' }}>{texto}</Text>
    </View>
  );
}
