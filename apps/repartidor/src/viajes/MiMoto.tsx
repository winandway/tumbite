import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ErrorApi, enIdioma, useBorrador, type Idioma } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  alSalirTelefono,
  almacenTelefono,
  e,
  fotoConCamara,
  useSesion,
} from '@tumbite/movil';

/**
 * Divoox Moto (13 nov 2026, C-PAPELES-CONDUCTOR) — Venezuela y todos los países. Lo que el
 * mototaxista necesita para llevar pasajeros, en una sola pantalla, como el alta de Uber o inDrive:
 * su ciudad, su moto con sus papeles, sus papeles de conductor (los que pide su país) y en qué está
 * su aprobación. Toda foto pasa por la pieza común «Tomar foto» o «Subir desde archivos», y el
 * formulario de la moto guarda lo escrito (borrador).
 */

type Doc = { id: string; tipo: string; estado: string; motivo: string };
type Vehiculo = {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color: string;
  placa: string;
  estado: string;
  motivo: string;
  documentos: Doc[];
};
type Papeles = {
  ciudad: { id: string; nombre: string; pais: string };
  ciudades: { id: string; nombre: string; pais: string }[];
  cambioCiudad?: {
    elegida: boolean;
    puedeCambiar: boolean;
    soloPais: string | null;
    horas: number;
  };
  perfil: {
    pais: string;
    antecedentes: string;
    edadMinima: number;
    placaNacional: boolean;
    documentos: string[];
  };
  documentos: Doc[];
};
type ServicioConductor = {
  servicioId: string;
  puedeActivar: boolean;
  preferencia: boolean;
  motivo: string;
  requisitosFaltantes: string[];
};

const DOCS_MOTO = ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente', 'foto_placa'] as const;

const T = {
  es: {
    titulo: 'Divoox Moto',
    ayuda:
      'Para llevar pasajeros en moto registra tu moto, sube tus papeles y espera la aprobación del equipo. Te avisamos en cuanto esté lista.',
    ciudad: 'Tu ciudad',
    cambiarCiudad: 'Cambiar de ciudad',
    reglaCiudad:
      'Puedes cambiarla una vez cada 24 horas, dentro de tu país y desconectado. Para cambiar de país, escribe a soporte.',
    moto: 'Tu moto',
    marca: 'Marca',
    modelo: 'Modelo',
    anio: 'Año',
    color: 'Color',
    placa: 'Placa',
    estadoPlaca: 'Estado de la placa (dos letras)',
    guardarMoto: 'Guardar mi moto',
    papelesMoto: 'Papeles de la moto',
    papelesTuyos: 'Tus papeles',
    subir: 'Subir',
    subirOtra: 'Subir otro',
    enviar: 'Enviar mi moto a revisión',
    activar: 'Recibir viajes de Moto',
    activo: 'Ya recibes viajes de Moto.',
    identidad: 'Tu identidad se verifica en «Documentos» (foto de tu cédula y de tu cara).',
    falta: 'Te falta',
    docs: {
      registro: 'Registro o título de la moto',
      seguro: 'Póliza de responsabilidad civil (RCV)',
      seguro_pasajeros: 'Póliza que cubre al pasajero',
      foto_frente: 'Foto de la moto de frente',
      foto_placa: 'Foto de la placa',
      licencia_moto: 'Licencia para manejar moto',
      antecedentes_penales: 'Certificado de antecedentes penales',
    } as Record<string, string>,
    ayudaPasajero:
      'Si tu póliza RCV ya cubre al pasajero, sube la misma en «Póliza que cubre al pasajero».',
    estados: {
      registrado: 'Sin enviar',
      en_revision: 'En revisión',
      aprobado: 'Aprobada',
      rechazado: 'Hay que corregir',
      suspendido: 'Suspendida',
      pendiente: 'En revisión',
      vencido: 'Vencido',
      sin_subir: 'Sin subir',
    } as Record<string, string>,
    requisitos: {
      identidad: 'Verificar tu identidad',
      antecedentes_pasajeros: 'Certificado de antecedentes penales aprobado',
      antecedentes: 'Certificado de antecedentes penales aprobado',
      historial_manejo: 'Licencia de moto aprobada',
      licencia_moto: 'Licencia de moto aprobada',
      edad_minima_21: 'Tener 21 años o más (lo revisa el equipo)',
      seguro_pasajeros: 'Póliza que cubre al pasajero aprobada',
      casco_pasajero: 'Casco para el pasajero (lo revisa el equipo)',
    } as Record<string, string>,
    motivos: {
      proximamente: 'Moto todavía no está disponible en tu ciudad.',
      en_pausa: 'Moto está en pausa en tu ciudad.',
      no_disponible_zona: 'Moto no está disponible en tu ciudad.',
      actualizar_app: 'Actualiza la app para recibir viajes de Moto.',
      pendiente_aprobacion: 'Tu aprobación está en revisión.',
      sin_habilitacion: 'Cuando tengas todo, el equipo aprueba tu cuenta para Moto.',
      requisitos_faltantes: 'Te faltan algunos papeles.',
      vehiculo_incompatible: 'Elige tu moto aprobada como vehículo activo.',
      habilitado: 'Todo listo.',
    } as Record<string, string>,
    rechazo: 'Motivo',
    usarMoto: 'Usar esta moto para trabajar',
  },
  en: {
    titulo: 'Divoox Moto',
    ayuda:
      'To give rides on your motorcycle, register it, upload your documents, and wait for our team to approve you. We’ll let you know as soon as you’re ready.',
    ciudad: 'Your city',
    cambiarCiudad: 'Change city',
    reglaCiudad:
      'You can change it once every 24 hours, within your country and while offline. To change countries, contact support.',
    moto: 'Your motorcycle',
    marca: 'Make',
    modelo: 'Model',
    anio: 'Year',
    color: 'Color',
    placa: 'License plate',
    estadoPlaca: 'Plate state (two letters)',
    guardarMoto: 'Save my motorcycle',
    papelesMoto: 'Motorcycle documents',
    papelesTuyos: 'Your documents',
    subir: 'Upload',
    subirOtra: 'Upload another',
    enviar: 'Send my motorcycle for review',
    activar: 'Get Moto rides',
    activo: 'You’re getting Moto rides.',
    identidad: 'Your identity is verified under “Documents” (a photo of your ID and of your face).',
    falta: 'Still needed',
    docs: {
      registro: 'Motorcycle registration or title',
      seguro: 'Liability insurance policy',
      seguro_pasajeros: 'Policy that covers the rider',
      foto_frente: 'Front photo of the motorcycle',
      foto_placa: 'Photo of the license plate',
      licencia_moto: 'Motorcycle license',
      antecedentes_penales: 'Criminal record certificate',
    } as Record<string, string>,
    ayudaPasajero:
      'If your liability policy already covers the rider, upload the same one under “Policy that covers the rider.”',
    estados: {
      registrado: 'Not sent',
      en_revision: 'Under review',
      aprobado: 'Approved',
      rechazado: 'Needs a fix',
      suspendido: 'Suspended',
      pendiente: 'Under review',
      vencido: 'Expired',
      sin_subir: 'Not uploaded',
    } as Record<string, string>,
    requisitos: {
      identidad: 'Verify your identity',
      antecedentes_pasajeros: 'Criminal record certificate approved',
      antecedentes: 'Criminal record certificate approved',
      historial_manejo: 'Motorcycle license approved',
      licencia_moto: 'Motorcycle license approved',
      edad_minima_21: 'Be 21 or older (our team checks it)',
      seguro_pasajeros: 'Rider coverage policy approved',
      casco_pasajero: 'A helmet for the rider (our team checks it)',
    } as Record<string, string>,
    motivos: {
      proximamente: 'Moto isn’t available in your city yet.',
      en_pausa: 'Moto is paused in your city.',
      no_disponible_zona: 'Moto isn’t available in your city.',
      actualizar_app: 'Update the app to get Moto rides.',
      pendiente_aprobacion: 'Your approval is under review.',
      sin_habilitacion: 'Once everything is in, our team approves your account for Moto.',
      requisitos_faltantes: 'Some documents are still missing.',
      vehiculo_incompatible: 'Choose your approved motorcycle as your active vehicle.',
      habilitado: 'All set.',
    } as Record<string, string>,
    rechazo: 'Reason',
    usarMoto: 'Use this motorcycle to work',
  },
};

/** La cámara del teléfono para la pieza común «Tomar foto» (C-CAMARA-EN-TODA-SUBIDA). */
const CAMARA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 }),
};
const deArchivos = async () => {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // En el iPhone, la versión compatible (JPEG): el servidor no guarda HEIC.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    quality: 0.7,
  });
  return r.canceled ? null : (r.assets[0] ?? null);
};

const VERDE = '#0D7A3A';
/** Lee un texto por su clave sin indexar objetos a ciegas (regla de seguridad del lint). */
const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k);
const colorEstado = (estado: string) =>
  estado === 'aprobado'
    ? VERDE
    : estado === 'rechazado' || estado === 'vencido'
      ? C.primario
      : '#5E5E5E';

function Fila({
  nombre,
  estado,
  motivo,
  idioma,
  subiendo,
  alSubir,
}: {
  nombre: string;
  estado: string;
  motivo?: string;
  idioma: Idioma;
  subiendo: boolean;
  alSubir: () => void;
}) {
  const t = enIdioma(T, idioma);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#EEF0F3',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: C.secundario }}>{nombre}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colorEstado(estado) }}>
          {de(t.estados, estado) ?? estado}
        </Text>
        {estado === 'rechazado' && motivo ? (
          <Text style={{ fontSize: 12, color: C.primario }}>
            {t.rechazo}: {motivo}
          </Text>
        ) : null}
      </View>
      {estado !== 'aprobado' ? (
        <Pressable
          onPress={alSubir}
          disabled={subiendo}
          accessibilityRole="button"
          accessibilityLabel={`${t.subir}: ${nombre}`}
          style={{
            borderWidth: 1,
            borderColor: '#2a2a2a',
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 6,
            opacity: subiendo ? 0.5 : 1,
          }}
        >
          <Text style={{ fontWeight: '700', color: C.secundario }}>
            {estado === 'sin_subir' ? t.subir : t.subirOtra}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MiMoto() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [papeles, setPapeles] = useState<Papeles | null>(null);
  const [moto, setMoto] = useState<Vehiculo | null>(null);
  const [servicio, setServicio] = useState<ServicioConductor | null>(null);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState('');
  const [verCiudades, setVerCiudades] = useState(false);
  const b = useBorrador({
    formulario: 'driver-mi-moto',
    cuenta: usuario?.id,
    inicial: { marca: '', modelo: '', anio: '', color: '', placa: '', placaEstado: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  const cargar = useCallback(
    () =>
      Promise.all([
        api.pedir<Papeles>('GET', '/datos/conductor/papeles'),
        api.pedir<{ vehiculos: Vehiculo[] }>('GET', '/datos/conductor/vehiculos'),
        api.pedir<{ servicios: ServicioConductor[] }>('GET', '/datos/conductor/servicios'),
      ])
        .then(([p, v, s]) => {
          setPapeles(p);
          setMoto(v.vehiculos.find((x) => x.tipo === 'moto') ?? null);
          setServicio(s.servicios.find((x) => x.servicioId === 'moto') ?? null);
        })
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x))),
    [api],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function hacer(f: () => Promise<unknown>) {
    setError('');
    try {
      await f();
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function subir(ruta: string, clave: string) {
    setError('');
    try {
      const foto = await fotoConCamara(idioma, CAMARA, deArchivos);
      if (!foto) return;
      setSubiendo(clave);
      const blob = await (await fetch(foto.uri)).blob();
      await api.subirFoto(blob, ruta);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendo('');
    }
  }

  async function guardarMoto() {
    const v = b.valores;
    await hacer(async () => {
      await api.pedir('POST', '/datos/conductor/vehiculos', {
        tipo: 'moto',
        marca: v.marca.trim(),
        modelo: v.modelo.trim(),
        anio: v.anio ? Number(v.anio) : null,
        color: v.color.trim(),
        placa: v.placa.trim(),
        placaEstado: v.placaEstado.trim(),
      });
      // Solo se borra lo escrito cuando el servidor confirmó que la moto quedó guardada.
      await b.limpiar();
    });
  }

  const docMoto = (tipo: string) => moto?.documentos.find((d) => d.tipo === tipo);
  const docMio = (tipo: string) => papeles?.documentos.find((d) => d.tipo === tipo);
  const casilla = (
    campo: 'marca' | 'modelo' | 'anio' | 'color' | 'placa' | 'placaEstado',
    etiqueta: string,
    teclado: 'default' | 'number-pad' = 'default',
  ) => (
    <TextInput
      value={String(new Map(Object.entries(b.valores)).get(campo) ?? '')}
      onChangeText={(x) => b.cambiar(campo, x)}
      placeholder={etiqueta}
      accessibilityLabel={etiqueta}
      keyboardType={teclado}
      autoCapitalize={campo === 'placa' || campo === 'placaEstado' ? 'characters' : 'words'}
      style={e.input}
    />
  );

  return (
    <View style={{ gap: 12, paddingVertical: 8 }} testID="mi-moto">
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E' }}>{t.ayuda}</Text>
      {error ? <Text style={{ color: C.primario }}>{error}</Text> : null}

      {papeles ? (
        <View style={e.tarjeta}>
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.ciudad}</Text>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{papeles.ciudad.nombre}</Text>
          {papeles.cambioCiudad?.puedeCambiar !== false ? (
            <Pressable
              onPress={() => setVerCiudades((x) => !x)}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={{ textDecorationLine: 'underline', color: C.secundario, marginTop: 4 }}>
                {t.cambiarCiudad}
              </Text>
            </Pressable>
          ) : null}
          {papeles.cambioCiudad?.elegida ? (
            <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 4 }}>{t.reglaCiudad}</Text>
          ) : null}
          {verCiudades
            ? papeles.ciudades.map((z) => (
                <Pressable
                  key={z.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: z.id === papeles.ciudad.id }}
                  onPress={() =>
                    void hacer(async () => {
                      await api.pedir('PUT', '/datos/conductor/ciudad', { zonaId: z.id });
                      setVerCiudades(false);
                    })
                  }
                  style={{ paddingVertical: 8 }}
                >
                  <Text
                    style={{
                      color: C.secundario,
                      fontWeight: z.id === papeles.ciudad.id ? '800' : '400',
                    }}
                  >
                    {z.nombre}
                  </Text>
                </Pressable>
              ))
            : null}
        </View>
      ) : null}

      <View style={e.tarjeta}>
        <Text style={{ fontWeight: '800', color: C.secundario }}>{t.moto}</Text>
        {moto ? (
          <>
            <Text style={{ color: C.secundario }}>
              {[moto.marca, moto.modelo, moto.anio, moto.color].filter(Boolean).join(' · ')}
            </Text>
            <Text style={{ color: C.secundario }}>{moto.placa}</Text>
            <Text style={{ fontWeight: '700', color: colorEstado(moto.estado) }}>
              {de(t.estados, moto.estado) ?? moto.estado}
            </Text>
            {moto.estado === 'rechazado' && moto.motivo ? (
              <Text style={{ color: C.primario, fontSize: 12 }}>
                {t.rechazo}: {moto.motivo}
              </Text>
            ) : null}
            {moto.estado === 'aprobado' && servicio?.motivo === 'vehiculo_incompatible' ? (
              <Boton
                texto={t.usarMoto}
                exito
                alTocar={() =>
                  void hacer(() =>
                    api.pedir('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: moto.id }),
                  )
                }
              />
            ) : null}
          </>
        ) : (
          <View style={{ gap: 8, marginTop: 6 }}>
            <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
            {casilla('marca', t.marca)}
            {casilla('modelo', t.modelo)}
            {casilla('anio', t.anio, 'number-pad')}
            {casilla('color', t.color)}
            {casilla('placa', t.placa)}
            {papeles && !papeles.perfil.placaNacional
              ? casilla('placaEstado', t.estadoPlaca)
              : null}
            <Boton texto={t.guardarMoto} alTocar={() => void guardarMoto()} />
          </View>
        )}
      </View>

      {moto ? (
        <View style={e.tarjeta}>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{t.papelesMoto}</Text>
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.ayudaPasajero}</Text>
          {DOCS_MOTO.map((tipo) => {
            const d = docMoto(tipo);
            return (
              <Fila
                key={tipo}
                nombre={de(t.docs, tipo) ?? tipo}
                estado={d?.estado ?? 'sin_subir'}
                motivo={d?.motivo}
                idioma={idioma}
                subiendo={subiendo === tipo}
                alSubir={() =>
                  void subir(`/datos/conductor/vehiculos/${moto.id}/documentos?tipo=${tipo}`, tipo)
                }
              />
            );
          })}
          {['registrado', 'rechazado'].includes(moto.estado) ? (
            <Boton
              texto={t.enviar}
              alTocar={() =>
                void hacer(() => api.pedir('POST', `/datos/conductor/vehiculos/${moto.id}/enviar`))
              }
            />
          ) : null}
        </View>
      ) : null}

      {papeles?.perfil.documentos.length ? (
        <View style={e.tarjeta}>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{t.papelesTuyos}</Text>
          {papeles.perfil.documentos.map((tipo) => {
            const d = docMio(tipo);
            return (
              <Fila
                key={tipo}
                nombre={de(t.docs, tipo) ?? tipo}
                estado={d?.estado ?? 'sin_subir'}
                motivo={d?.motivo}
                idioma={idioma}
                subiendo={subiendo === tipo}
                alSubir={() => void subir(`/datos/conductor/papeles?tipo=${tipo}`, tipo)}
              />
            );
          })}
          <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 6 }}>{t.identidad}</Text>
        </View>
      ) : null}

      {servicio ? (
        <View style={e.tarjeta} testID="estado-moto">
          <Text
            style={{
              fontWeight: '800',
              color: servicio.puedeActivar ? VERDE : C.secundario,
            }}
          >
            {servicio.preferencia ? t.activo : (de(t.motivos, servicio.motivo) ?? servicio.motivo)}
          </Text>
          {servicio.requisitosFaltantes.length ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.falta}</Text>
              {servicio.requisitosFaltantes.map((r) => (
                <Text key={r} style={{ color: C.secundario }}>
                  · {de(t.requisitos, r) ?? r}
                </Text>
              ))}
            </View>
          ) : null}
          {servicio.puedeActivar && !servicio.preferencia ? (
            <Boton
              texto={t.activar}
              exito
              alTocar={() =>
                void hacer(() =>
                  api.pedir('PUT', '/datos/conductor/preferencias', {
                    servicioId: 'moto',
                    activa: true,
                  }),
                )
              }
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
