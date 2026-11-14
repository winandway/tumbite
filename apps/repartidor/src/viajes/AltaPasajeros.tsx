import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  DOCUMENTOS_VEHICULO_PASAJEROS,
  ErrorApi,
  enIdioma,
  useBorrador,
  type Idioma,
  type ServicioPasajeros,
} from '@tumbite/compartido';
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
 * Alta del conductor de pasajeros (Divoox Moto y Divoox Carro) — Venezuela y todos los países.
 * C-PAPELES-CONDUCTOR (13 nov 2026) y C-CARRO-ALTA-DRIVER (13 nov 2026): lo que el mototaxista o el
 * taxista necesita para llevar pasajeros, en una sola pantalla, como el alta de Uber o inDrive: su
 * ciudad, su vehículo con sus papeles, sus papeles de conductor (los que pide su país para ESE
 * servicio) y en qué está su aprobación. Toda foto pasa por la pieza común «Tomar foto» o «Subir desde
 * archivos», y el formulario del vehículo guarda lo escrito (borrador). Una sola pieza para los dos
 * servicios: Moto y Carro solo cambian sus textos, el tipo de vehículo y las plazas.
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
  plazas: number | null;
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
    documentosPorServicio?: Partial<Record<ServicioPasajeros, string[]>>;
    documentosVehiculo?: Partial<Record<ServicioPasajeros, string[]>>;
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

/** Plazas de un carro (sin contar al conductor): 4 normal; 6 o más también recibe Carro XL. */
export const PLAZAS_CARRO = [4, 6] as const;
const PLAZAS_XL = 6;

/** Textos comunes a Moto y Carro. */
const COMUN = {
  es: {
    ciudad: 'Tu ciudad',
    cambiarCiudad: 'Cambiar de ciudad',
    reglaCiudad:
      'Puedes cambiarla una vez cada 24 horas, dentro de tu país y desconectado. Para cambiar de país, escribe a soporte.',
    marca: 'Marca',
    modelo: 'Modelo',
    anio: 'Año',
    color: 'Color',
    placa: 'Placa',
    estadoPlaca: 'Estado de la placa (dos letras)',
    plazas: 'Plazas para pasajeros',
    papelesTuyos: 'Tus papeles',
    subir: 'Subir',
    subirOtra: 'Subir otro',
    identidad: 'Tu identidad se verifica en «Documentos» (foto de tu cédula y de tu cara).',
    falta: 'Te falta',
    rechazo: 'Motivo',
    estados: {
      registrado: 'Sin enviar',
      en_revision: 'En revisión',
      aprobado: 'Aprobado',
      rechazado: 'Hay que corregir',
      suspendido: 'Suspendido',
      pendiente: 'En revisión',
      vencido: 'Vencido',
      sin_subir: 'Sin subir',
    } as Record<string, string>,
  },
  en: {
    ciudad: 'Your city',
    cambiarCiudad: 'Change city',
    reglaCiudad:
      'You can change it once every 24 hours, within your country and while offline. To change countries, contact support.',
    marca: 'Make',
    modelo: 'Model',
    anio: 'Year',
    color: 'Color',
    placa: 'License plate',
    estadoPlaca: 'Plate state (two letters)',
    plazas: 'Passenger seats',
    papelesTuyos: 'Your documents',
    subir: 'Upload',
    subirOtra: 'Upload another',
    identidad: 'Your identity is verified under “Documents” (a photo of your ID and of your face).',
    falta: 'Still needed',
    rechazo: 'Reason',
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
  },
};

/** Textos propios de cada servicio. */
const POR_SERVICIO = {
  moto: {
    es: {
      titulo: 'Divoox Moto',
      ayuda:
        'Para llevar pasajeros en moto registra tu moto, sube tus papeles y espera la aprobación del equipo. Te avisamos en cuanto esté lista.',
      vehiculo: 'Tu moto',
      guardar: 'Guardar mi moto',
      papelesVehiculo: 'Papeles de la moto',
      enviar: 'Enviar mi moto a revisión',
      activar: 'Recibir viajes de Moto',
      activo: 'Ya recibes viajes de Moto.',
      usar: 'Usar esta moto para trabajar',
      ayudaPasajero:
        'Si tu póliza RCV ya cubre al pasajero, sube la misma en «Póliza que cubre al pasajero».',
      docs: {
        registro: 'Registro o título de la moto',
        seguro: 'Póliza de responsabilidad civil (RCV)',
        seguro_pasajeros: 'Póliza que cubre al pasajero',
        foto_frente: 'Foto de la moto de frente',
        foto_placa: 'Foto de la placa',
        licencia_moto: 'Licencia para manejar moto',
        antecedentes_penales: 'Certificado de antecedentes penales',
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
      xl: '',
    },
    en: {
      titulo: 'Divoox Moto',
      ayuda:
        'To give rides on your motorcycle, register it, upload your documents, and wait for our team to approve you. We’ll let you know as soon as you’re ready.',
      vehiculo: 'Your motorcycle',
      guardar: 'Save my motorcycle',
      papelesVehiculo: 'Motorcycle documents',
      enviar: 'Send my motorcycle for review',
      activar: 'Get Moto rides',
      activo: 'You’re getting Moto rides.',
      usar: 'Use this motorcycle to work',
      ayudaPasajero:
        'If your liability policy already covers the rider, upload the same one under “Policy that covers the rider.”',
      docs: {
        registro: 'Motorcycle registration or title',
        seguro: 'Liability insurance policy',
        seguro_pasajeros: 'Policy that covers the rider',
        foto_frente: 'Front photo of the motorcycle',
        foto_placa: 'Photo of the license plate',
        licencia_moto: 'Motorcycle license',
        antecedentes_penales: 'Criminal record certificate',
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
      xl: '',
    },
  },
  carro: {
    es: {
      titulo: 'Divoox Carro',
      ayuda:
        'Para llevar pasajeros en tu carro regístralo, sube tus papeles y los del carro, y espera la aprobación del equipo. Te avisamos en cuanto esté listo.',
      vehiculo: 'Tu carro',
      guardar: 'Guardar mi carro',
      papelesVehiculo: 'Papeles del carro',
      enviar: 'Enviar mi carro a revisión',
      activar: 'Recibir viajes de Carro',
      activo: 'Ya recibes viajes de Carro.',
      usar: 'Usar este carro para trabajar',
      ayudaPasajero:
        'Si tu póliza RCV ya cubre a los ocupantes, sube la misma en «Póliza que cubre a los pasajeros».',
      docs: {
        registro: 'Título de propiedad o carnet de circulación',
        seguro: 'Póliza de responsabilidad civil (RCV)',
        seguro_pasajeros: 'Póliza que cubre a los pasajeros',
        inspeccion: 'Revisión del vehículo (certificado de inspección)',
        foto_frente: 'Foto del carro de frente',
        foto_placa: 'Foto de la placa',
        foto_interior: 'Foto del interior',
        licencia_conducir: 'Licencia de conducir',
        antecedentes_penales: 'Certificado de antecedentes penales',
      } as Record<string, string>,
      requisitos: {
        identidad: 'Verificar tu identidad',
        antecedentes_pasajeros: 'Antecedentes aprobados',
        antecedentes: 'Antecedentes aprobados',
        historial_manejo: 'Historial de manejo aprobado (con tu licencia)',
        licencia: 'Licencia de conducir aprobada',
        edad_minima_21: 'Tener 21 años o más (lo revisa el equipo)',
        seguro_pasajeros: 'Póliza que cubre a los pasajeros aprobada',
        inspeccion_vehiculo: 'Revisión del vehículo aprobada',
      } as Record<string, string>,
      motivos: {
        proximamente: 'Carro todavía no está disponible en tu ciudad.',
        en_pausa: 'Carro está en pausa en tu ciudad.',
        no_disponible_zona: 'Carro no está disponible en tu ciudad.',
        actualizar_app: 'Actualiza la app para recibir viajes de Carro.',
        pendiente_aprobacion: 'Tu aprobación está en revisión.',
        sin_habilitacion: 'Cuando tengas todo, el equipo aprueba tu cuenta para Carro.',
        requisitos_faltantes: 'Te faltan algunos papeles.',
        vehiculo_incompatible: 'Elige tu carro aprobado como vehículo activo.',
        habilitado: 'Todo listo.',
      } as Record<string, string>,
      xl: 'Tu carro tiene 6 plazas o más: también recibes viajes de Carro XL.',
    },
    en: {
      titulo: 'Divoox Car',
      ayuda:
        'To give rides in your car, register it, upload your documents and the car’s, and wait for our team to approve you. We’ll let you know as soon as you’re ready.',
      vehiculo: 'Your car',
      guardar: 'Save my car',
      papelesVehiculo: 'Car documents',
      enviar: 'Send my car for review',
      activar: 'Get Car rides',
      activo: 'You’re getting Car rides.',
      usar: 'Use this car to work',
      ayudaPasajero:
        'If your liability policy already covers passengers, upload the same one under “Policy that covers passengers.”',
      docs: {
        registro: 'Vehicle title or registration',
        seguro: 'Liability insurance policy',
        seguro_pasajeros: 'Policy that covers passengers',
        inspeccion: 'Vehicle inspection',
        foto_frente: 'Front photo of the car',
        foto_placa: 'Photo of the license plate',
        foto_interior: 'Photo of the interior',
        licencia_conducir: 'Driver’s license',
        antecedentes_penales: 'Criminal record certificate',
      } as Record<string, string>,
      requisitos: {
        identidad: 'Verify your identity',
        antecedentes_pasajeros: 'Background check approved',
        antecedentes: 'Background check approved',
        historial_manejo: 'Driving record approved',
        licencia: 'Driver’s license approved',
        edad_minima_21: 'Be 21 or older (our team checks it)',
        seguro_pasajeros: 'Passenger coverage policy approved',
        inspeccion_vehiculo: 'Vehicle inspection approved',
      } as Record<string, string>,
      motivos: {
        proximamente: 'Car isn’t available in your city yet.',
        en_pausa: 'Car is paused in your city.',
        no_disponible_zona: 'Car isn’t available in your city.',
        actualizar_app: 'Update the app to get Car rides.',
        pendiente_aprobacion: 'Your approval is under review.',
        sin_habilitacion: 'Once everything is in, our team approves your account for Car.',
        requisitos_faltantes: 'Some documents are still missing.',
        vehiculo_incompatible: 'Choose your approved car as your active vehicle.',
        habilitado: 'All set.',
      } as Record<string, string>,
      xl: 'Your car has 6 or more seats: you also get Car XL rides.',
    },
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
  const t = enIdioma(COMUN, idioma);
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

export function AltaPasajeros({ servicio }: { servicio: ServicioPasajeros }) {
  const { api, idioma, usuario } = useSesion();
  const tc = enIdioma(COMUN, idioma);
  const t = enIdioma(servicio === 'carro' ? POR_SERVICIO.carro : POR_SERVICIO.moto, idioma);
  const [papeles, setPapeles] = useState<Papeles | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [estado, setEstado] = useState<ServicioConductor | null>(null);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState('');
  const [verCiudades, setVerCiudades] = useState(false);
  const b = useBorrador({
    formulario: servicio === 'carro' ? 'driver-mi-carro' : 'driver-mi-moto',
    cuenta: usuario?.id,
    inicial: {
      marca: '',
      modelo: '',
      anio: '',
      color: '',
      placa: '',
      placaEstado: '',
      plazas: '4',
    },
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
          setVehiculo(v.vehiculos.find((x) => x.tipo === servicio) ?? null);
          setEstado(s.servicios.find((x) => x.servicioId === servicio) ?? null);
        })
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x))),
    [api, servicio],
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

  async function guardar() {
    const v = b.valores;
    await hacer(async () => {
      await api.pedir('POST', '/datos/conductor/vehiculos', {
        tipo: servicio,
        marca: v.marca.trim(),
        modelo: v.modelo.trim(),
        anio: v.anio ? Number(v.anio) : null,
        color: v.color.trim(),
        placa: v.placa.trim(),
        placaEstado: v.placaEstado.trim(),
        ...(servicio === 'carro' ? { plazas: Number(v.plazas) || 4 } : {}),
      });
      // Solo se borra lo escrito cuando el servidor confirmó que el vehículo quedó guardado.
      await b.limpiar();
    });
  }

  const delServicio = <T,>(m: Partial<Record<ServicioPasajeros, T>> | undefined) =>
    m ? new Map(Object.entries(m)).get(servicio) : undefined;
  const docsVehiculo =
    delServicio(papeles?.perfil.documentosVehiculo) ??
    delServicio(DOCUMENTOS_VEHICULO_PASAJEROS) ??
    [];
  const docsMios =
    delServicio(papeles?.perfil.documentosPorServicio) ??
    (servicio === 'moto' ? (papeles?.perfil.documentos ?? []) : []);
  const docVehiculo = (tipo: string) => vehiculo?.documentos.find((d) => d.tipo === tipo);
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
    <View style={{ gap: 12, paddingVertical: 8 }} testID={`alta-${servicio}`}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E' }}>{t.ayuda}</Text>
      {error ? <Text style={{ color: C.primario }}>{error}</Text> : null}

      {papeles ? (
        <View style={e.tarjeta}>
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{tc.ciudad}</Text>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{papeles.ciudad.nombre}</Text>
          {papeles.cambioCiudad?.puedeCambiar !== false ? (
            <Pressable
              onPress={() => setVerCiudades((x) => !x)}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={{ textDecorationLine: 'underline', color: C.secundario, marginTop: 4 }}>
                {tc.cambiarCiudad}
              </Text>
            </Pressable>
          ) : null}
          {papeles.cambioCiudad?.elegida ? (
            <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 4 }}>{tc.reglaCiudad}</Text>
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
        <Text style={{ fontWeight: '800', color: C.secundario }}>{t.vehiculo}</Text>
        {vehiculo ? (
          <>
            <Text style={{ color: C.secundario }}>
              {[vehiculo.marca, vehiculo.modelo, vehiculo.anio, vehiculo.color]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={{ color: C.secundario }}>
              {vehiculo.placa}
              {servicio === 'carro' && vehiculo.plazas ? ` · ${vehiculo.plazas} ${tc.plazas}` : ''}
            </Text>
            <Text style={{ fontWeight: '700', color: colorEstado(vehiculo.estado) }}>
              {de(tc.estados, vehiculo.estado) ?? vehiculo.estado}
            </Text>
            {vehiculo.estado === 'rechazado' && vehiculo.motivo ? (
              <Text style={{ color: C.primario, fontSize: 12 }}>
                {tc.rechazo}: {vehiculo.motivo}
              </Text>
            ) : null}
            {servicio === 'carro' && (vehiculo.plazas ?? 0) >= PLAZAS_XL ? (
              <Text style={{ color: VERDE, fontSize: 12, fontWeight: '700' }}>{t.xl}</Text>
            ) : null}
            {vehiculo.estado === 'aprobado' && estado?.motivo === 'vehiculo_incompatible' ? (
              <Boton
                texto={t.usar}
                exito
                alTocar={() =>
                  void hacer(() =>
                    api.pedir('PUT', '/datos/conductor/vehiculo-activo', {
                      vehiculoId: vehiculo.id,
                    }),
                  )
                }
              />
            ) : null}
          </>
        ) : (
          <View style={{ gap: 8, marginTop: 6 }}>
            <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
            {casilla('marca', tc.marca)}
            {casilla('modelo', tc.modelo)}
            {casilla('anio', tc.anio, 'number-pad')}
            {casilla('color', tc.color)}
            {casilla('placa', tc.placa)}
            {papeles && !papeles.perfil.placaNacional
              ? casilla('placaEstado', tc.estadoPlaca)
              : null}
            {servicio === 'carro' ? (
              <View>
                <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{tc.plazas}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  {PLAZAS_CARRO.map((n) => {
                    const elegido = b.valores.plazas === String(n);
                    return (
                      <Pressable
                        key={n}
                        onPress={() => b.cambiar('plazas', String(n))}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: elegido }}
                        accessibilityLabel={`${n} ${tc.plazas}`}
                        style={{
                          borderWidth: 1,
                          borderColor: elegido ? C.secundario : '#C9CDD3',
                          backgroundColor: elegido ? C.secundario : 'transparent',
                          borderRadius: 999,
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ fontWeight: '700', color: elegido ? '#fff' : C.secundario }}>
                          {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <Boton texto={t.guardar} alTocar={() => void guardar()} />
          </View>
        )}
      </View>

      {vehiculo ? (
        <View style={e.tarjeta}>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{t.papelesVehiculo}</Text>
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.ayudaPasajero}</Text>
          {docsVehiculo.map((tipo) => {
            const d = docVehiculo(tipo);
            return (
              <Fila
                key={tipo}
                nombre={de(t.docs, tipo) ?? tipo}
                estado={d?.estado ?? 'sin_subir'}
                motivo={d?.motivo}
                idioma={idioma}
                subiendo={subiendo === tipo}
                alSubir={() =>
                  void subir(
                    `/datos/conductor/vehiculos/${vehiculo.id}/documentos?tipo=${tipo}`,
                    tipo,
                  )
                }
              />
            );
          })}
          {['registrado', 'rechazado'].includes(vehiculo.estado) ? (
            <Boton
              texto={t.enviar}
              alTocar={() =>
                void hacer(() =>
                  api.pedir('POST', `/datos/conductor/vehiculos/${vehiculo.id}/enviar`),
                )
              }
            />
          ) : null}
        </View>
      ) : null}

      {docsMios.length ? (
        <View style={e.tarjeta}>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{tc.papelesTuyos}</Text>
          {docsMios.map((tipo) => {
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
          <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 6 }}>{tc.identidad}</Text>
        </View>
      ) : null}

      {estado ? (
        <View style={e.tarjeta} testID={`estado-${servicio}`}>
          <Text
            style={{
              fontWeight: '800',
              color: estado.puedeActivar ? VERDE : C.secundario,
            }}
          >
            {estado.preferencia ? t.activo : (de(t.motivos, estado.motivo) ?? estado.motivo)}
          </Text>
          {estado.requisitosFaltantes.length ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{tc.falta}</Text>
              {estado.requisitosFaltantes.map((r) => (
                <Text key={r} style={{ color: C.secundario }}>
                  · {de(t.requisitos, r) ?? r}
                </Text>
              ))}
            </View>
          ) : null}
          {estado.puedeActivar && !estado.preferencia ? (
            <Boton
              texto={t.activar}
              exito
              alTocar={() =>
                void hacer(() =>
                  api.pedir('PUT', '/datos/conductor/preferencias', {
                    servicioId: servicio,
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
