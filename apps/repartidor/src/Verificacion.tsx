import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import { Boton, C, e, useSesion } from '@tumbite/movil';

const T = {
  es: {
    titulo: 'Verifica tu identidad',
    ayuda:
      'Para repartir con Tumbite verificamos que eres tú. Toma las fotos con tu cámara; solo las ve el equipo de Tumbite.',
    doc: 'Documento',
    docs: {
      licencia: 'Licencia de conducir',
      identificacion: 'Identificación oficial',
      pasaporte: 'Pasaporte',
    },
    frente: 'Foto del documento (frente)',
    reverso: 'Foto del documento (reverso)',
    selfie: 'Foto de tu cara',
    selfieAyuda: 'De frente, con buena luz, sin gorra ni lentes oscuros.',
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
  },
  en: {
    titulo: 'Verify your identity',
    ayuda:
      'To deliver with Tumbite we verify it’s really you. Take the photos with your camera; only the Tumbite team sees them.',
    doc: 'Document',
    docs: { licencia: 'Driver’s license', identificacion: 'Government ID', pasaporte: 'Passport' },
    frente: 'Photo of your document (front)',
    reverso: 'Photo of your document (back)',
    selfie: 'Photo of your face',
    selfieAyuda: 'Facing the camera, good light, no cap or sunglasses.',
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
  },
};

type Kyc = {
  estado: 'sin_enviar' | 'pendiente' | 'aprobado' | 'rechazado';
  motivo: string;
  docTipo: string;
  tiene: Record<'doc_frente' | 'doc_reverso' | 'selfie' | 'local', boolean>;
};

/**
 * KYC del repartidor: documento (frente y reverso, o solo el pasaporte) y una foto de su cara,
 * tomadas con la cámara. Van a la carpeta privada del servidor. Candado C-KYC.
 */
export function Verificacion() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [k, setK] = useState<Kyc | null>(null);
  const [docTipo, setDocTipo] = useState<'licencia' | 'identificacion' | 'pasaporte'>('licencia');
  const [subiendo, setSubiendo] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api
      .pedir<{ kyc: Kyc }>('GET', '/datos/kyc')
      .then((r) => setK(r.kyc))
      .catch(() => {});
  }, [api]);
  useEffect(cargar, [cargar]);

  async function tomar(pieza: 'doc_frente' | 'doc_reverso' | 'selfie') {
    setError('');
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return setError(t.permiso);
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      cameraType: pieza === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
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

  async function enviar() {
    setError('');
    try {
      await api.pedir('POST', '/datos/kyc/enviar', { docTipo });
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (!k) return null;
  const listo = k.estado === 'aprobado' || k.estado === 'pendiente';
  const piezas: ['doc_frente' | 'doc_reverso' | 'selfie', string][] = [
    ['doc_frente', t.frente],
    ...(docTipo === 'pasaporte' ? [] : ([['doc_reverso', t.reverso]] as ['doc_reverso', string][])),
    ['selfie', t.selfie],
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
          backgroundColor: k.estado === 'aprobado' ? '#E6F4EA' : '#FFF1EE',
          color: k.estado === 'aprobado' ? '#0D7A3A' : '#B42200',
          fontWeight: '700',
        }}
      >
        {new Map(Object.entries(t.estados)).get(k.estado)}
      </Text>
      {k.estado === 'rechazado' && k.motivo ? <Text style={e.error}>{k.motivo}</Text> : null}
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
          {piezas.map(([pieza, etiqueta]) => (
            <View key={pieza} style={{ marginBottom: 6 }}>
              <Text style={{ fontWeight: '700' }}>
                {etiqueta} {new Map(Object.entries(k.tiene)).get(pieza) ? `· ${t.lista}` : ''}
              </Text>
              {pieza === 'selfie' ? (
                <Text style={{ color: '#5E5E5E' }}>{t.selfieAyuda}</Text>
              ) : null}
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
          <Boton texto={t.enviar} alTocar={() => void enviar()} />
        </>
      ) : null}
    </View>
  );
}
