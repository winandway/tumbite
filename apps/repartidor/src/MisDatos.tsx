import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ErrorApi, enIdioma, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  alSalirTelefono,
  almacenTelefono,
  e,
  useSesion,
  Text,
  CampoFecha,
  COLOR,
  FUENTE,
  Icono,
  LETRA,
  RADIO,
} from '@tumbite/movil';
import { AgregarVehiculo } from './vehiculo/AgregarVehiculo';

const T = {
  es: {
    tuId: 'Tu ID de conductor',
    idAyuda: 'Dáselo a soporte si tienes un problema: con él te encontramos al instante.',
    vehiculo: 'Tu vehículo',
    sinVehiculo: 'Agrégalo con sus datos y fotos.',
    agregaTuVehiculo: 'Agrega tu vehículo',
    estados: {
      registrado: 'Sin enviar',
      en_revision: 'En revisión',
      aprobado: 'Aprobado',
      rechazado: 'Hay que corregir',
    } as Record<string, string>,
    tipos: {
      carro: 'Carro',
      moto: 'Moto',
      scooter: 'Scooter',
      bicicleta: 'Bicicleta',
      a_pie: 'A pie',
    } as Record<string, string>,
    licencia: 'Tu licencia de conducir',
    licenciaNumero: 'Número de licencia',
    licenciaEstado: 'Estado o país que la emitió',
    vence: 'Fecha de vencimiento',
    seguro: 'Tu seguro',
    aseguradora: 'Aseguradora',
    poliza: 'Número de póliza',
    guardar: 'Guardar mis datos',
    guardado: 'Guardado. Lo revisa el equipo de Divoox.',
    privado: 'Solo lo ves tú y el equipo de Divoox. Tus datos bancarios van en Stripe, nunca aquí.',
  },
  en: {
    tuId: 'Your driver ID',
    idAyuda: 'Give it to support if you have a problem: it lets us find you instantly.',
    vehiculo: 'Your vehicle',
    sinVehiculo: 'Add it with its details and photos.',
    agregaTuVehiculo: 'Add your vehicle',
    estados: {
      registrado: 'Not sent',
      en_revision: 'Under review',
      aprobado: 'Approved',
      rechazado: 'Needs a fix',
    } as Record<string, string>,
    tipos: {
      carro: 'Car',
      moto: 'Motorbike',
      scooter: 'Scooter',
      bicicleta: 'Bicycle',
      a_pie: 'On foot',
    } as Record<string, string>,
    licencia: 'Your driver’s license',
    licenciaNumero: 'License number',
    licenciaEstado: 'Issuing state or country',
    vence: 'Expiration date',
    seguro: 'Your insurance',
    aseguradora: 'Insurer',
    poliza: 'Policy number',
    guardar: 'Save my details',
    guardado: 'Saved. The Divoox team will review it.',
    privado:
      'Only you and the Divoox team can see this. Your bank details go in Stripe, never here.',
  },
};

type VehiculoResumen = { tipo: string; marca: string; modelo: string; estado: string };
const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k);

const INICIAL = {
  vehiculoTipo: '',
  marca: '',
  modelo: '',
  anio: '',
  color: '',
  placa: '',
  licenciaNumero: '',
  licenciaEstado: '',
  licenciaVence: '',
  seguroAseguradora: '',
  seguroPoliza: '',
  seguroVence: '',
};

/**
 * Datos del repartidor (como pide DoorDash): vehículo, licencia y seguro, y su ID visible.
 * Nunca pierde lo escrito. Con motor, la placa y la licencia son obligatorias.
 */
export function MisDatos() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [vehiculos, setVehiculos] = useState<VehiculoResumen[]>([]);
  const [version, setVersion] = useState(0);
  const b = useBorrador({
    formulario: 'datos-repartidor',
    cuenta: usuario?.id,
    inicial: INICIAL,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const { cargarBase } = b;
  useEffect(() => {
    api
      .pedir<{ codigo: string | null; datos: Record<string, unknown> }>(
        'GET',
        '/datos/repartidor/datos',
      )
      .then((r) => {
        setCodigo(r.codigo ?? '');
        const d = new Map(Object.entries(r.datos));
        cargarBase(
          Object.fromEntries(
            Object.keys(INICIAL).map((k) => [k, d.get(k) == null ? '' : String(d.get(k))]),
          ) as typeof INICIAL,
        );
      })
      .catch(() => {});
  }, [api, cargarBase]);

  // «Tu vehículo»: el que tiene guardado en el servidor (el último que no se retiró).
  useEffect(() => {
    api
      .pedir<{ vehiculos: VehiculoResumen[] }>('GET', '/datos/conductor/vehiculos')
      .then((r) => setVehiculos(r.vehiculos))
      .catch(() => {});
  }, [api, version]);
  const actual = vehiculos.at(-1) ?? null;
  const v = b.valores;
  const errorDe = (c: string) => (error?.campo === c ? error.mensaje : undefined);
  const campo = (clave: keyof typeof INICIAL, etiqueta: string, extra: object = {}) => (
    <Campo
      etiqueta={etiqueta}
      value={new Map(Object.entries(v)).get(clave) ?? ''}
      onChangeText={(x) => b.cambiar(clave, x)}
      placeholder={etiqueta}
      error={errorDe(clave)}
      {...extra}
    />
  );
  // C-FECHA-MODERNA: las fechas, con la casilla única (barras solas, orden del país).
  const fecha = (clave: 'licenciaVence' | 'seguroVence') => (
    <CampoFecha
      etiqueta={t.vence}
      valor={clave === 'licenciaVence' ? v.licenciaVence : v.seguroVence}
      cambiar={(x) => b.cambiar(clave, x)}
      idioma={idioma}
      error={errorDe(clave)}
    />
  );
  const conMotor =
    v.vehiculoTipo === 'carro' || v.vehiculoTipo === 'moto' || v.vehiculoTipo === 'scooter';

  async function guardar() {
    setError(null);
    setAviso('');
    setGuardando(true);
    try {
      await api.pedir('PUT', '/datos/repartidor/datos', v);
      await b.cargar(v);
      setAviso(t.guardado);
    } catch (x) {
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    } finally {
      setGuardando(false);
    }
  }

  if (agregando)
    return (
      <AgregarVehiculo
        alSalir={() => {
          setAgregando(false);
          setVersion((x) => x + 1);
        }}
      />
    );

  return (
    <View>
      <View style={[e.tarjeta, { backgroundColor: C.secundario }]}>
        <Text style={{ color: '#BDBDBD' }}>{t.tuId}</Text>
        <Text
          style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: 1 }}
          selectable
        >
          {codigo || '—'}
        </Text>
        <Text style={{ color: '#BDBDBD', fontSize: 13 }}>{t.idAyuda}</Text>
      </View>
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      {/* C-AGREGA-TU-VEHICULO: el vehículo ya NO se escribe aquí (eran datos sueltos y no creaban el
          vehículo real). Esta tarjeta abre «Agrega tu vehículo» o dice cuál tiene y en qué está. */}
      <Text style={estilo.sub}>{t.vehiculo}</Text>
      <Pressable
        testID="misdatos-tu-vehiculo"
        onPress={() => setAgregando(true)}
        accessibilityRole="button"
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: COLOR.borde,
          borderRadius: RADIO.l,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
          backgroundColor: pressed ? COLOR.superficie : COLOR.fondo,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        })}
      >
        <Icono nombre="car-outline" tamano={22} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16 }}>
            {actual ? (de(t.tipos, actual.tipo) ?? actual.tipo) : t.agregaTuVehiculo}
          </Text>
          <Text style={LETRA.secundario}>
            {actual
              ? [actual.marca, actual.modelo, de(t.estados, actual.estado) ?? actual.estado]
                  .filter(Boolean)
                  .join(' · ')
              : t.sinVehiculo}
          </Text>
        </View>
        <Icono nombre="chevron-forward" tamano={20} color={COLOR.textoSuave} />
      </Pressable>
      {conMotor || !v.vehiculoTipo ? (
        <>
          <Text style={estilo.sub}>{t.licencia}</Text>
          {campo('licenciaNumero', t.licenciaNumero, { autoCapitalize: 'characters' })}
          {campo('licenciaEstado', t.licenciaEstado)}
          {fecha('licenciaVence')}
          <Text style={estilo.sub}>{t.seguro}</Text>
          {campo('seguroAseguradora', t.aseguradora)}
          {campo('seguroPoliza', t.poliza)}
          {fecha('seguroVence')}
        </>
      ) : null}
      {error && !error.campo ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error.mensaje}
        </Text>
      ) : null}
      {aviso ? <Text style={{ color: '#0D7A3A', marginBottom: 8 }}>{aviso}</Text> : null}
      <Boton texto={t.guardar} alTocar={() => void guardar()} cargando={guardando} />
      <Text style={{ color: '#666B73', fontSize: 13 }}>{t.privado}</Text>
    </View>
  );
}

const estilo = {
  sub: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: C.secundario,
    marginTop: 12,
    marginBottom: 8,
  },
};
