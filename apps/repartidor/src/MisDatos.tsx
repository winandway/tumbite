import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, enIdioma, useBorrador } from '@tumbite/compartido';
import { Boton, C, Campo, alSalirTelefono, almacenTelefono, e, useSesion } from '@tumbite/movil';

const T = {
  es: {
    tuId: 'Tu ID de repartidor',
    idAyuda: 'Dáselo a soporte si tienes un problema: con él te encontramos al instante.',
    vehiculo: 'Tu vehículo',
    tipos: {
      carro: 'Carro',
      moto: 'Moto',
      scooter: 'Scooter',
      bicicleta: 'Bicicleta',
      a_pie: 'A pie',
    },
    marca: 'Marca',
    modelo: 'Modelo',
    anio: 'Año',
    color: 'Color',
    placa: 'Placa',
    licencia: 'Tu licencia de conducir',
    licenciaNumero: 'Número de licencia',
    licenciaEstado: 'Estado o país que la emitió',
    vence: 'Vence (AAAA-MM-DD)',
    seguro: 'Tu seguro',
    aseguradora: 'Aseguradora',
    poliza: 'Número de póliza',
    guardar: 'Guardar mis datos',
    guardado: 'Guardado. Lo revisa el equipo de Tumbite.',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    privado:
      'Solo lo ves tú y el equipo de Tumbite. Tus datos bancarios van en Stripe, nunca aquí.',
  },
  en: {
    tuId: 'Your driver ID',
    idAyuda: 'Give it to support if you have a problem: it lets us find you instantly.',
    vehiculo: 'Your vehicle',
    tipos: {
      carro: 'Car',
      moto: 'Motorbike',
      scooter: 'Scooter',
      bicicleta: 'Bicycle',
      a_pie: 'On foot',
    },
    marca: 'Make',
    modelo: 'Model',
    anio: 'Year',
    color: 'Color',
    placa: 'Plate',
    licencia: 'Your driver’s license',
    licenciaNumero: 'License number',
    licenciaEstado: 'Issuing state or country',
    vence: 'Expires (YYYY-MM-DD)',
    seguro: 'Your insurance',
    aseguradora: 'Insurer',
    poliza: 'Policy number',
    guardar: 'Save my details',
    guardado: 'Saved. The Tumbite team will review it.',
    recuperado: 'We restored what you were typing.',
    privado:
      'Only you and the Tumbite team can see this. Your bank details go in Stripe, never here.',
  },
};

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
      {b.recuperado ? <Text style={e.aviso}>{t.recuperado}</Text> : null}
      <Text style={estilo.sub}>{t.vehiculo}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {Object.entries(t.tipos).map(([valor, nombre]) => (
          <Pressable
            key={valor}
            onPress={() => b.cambiar('vehiculoTipo', valor)}
            accessibilityRole="radio"
            accessibilityState={{ selected: v.vehiculoTipo === valor }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: v.vehiculoTipo === valor ? C.secundario : '#D6D6D6',
              backgroundColor: v.vehiculoTipo === valor ? C.secundario : '#FFFFFF',
            }}
          >
            <Text
              style={{ color: v.vehiculoTipo === valor ? '#FFFFFF' : C.texto, fontWeight: '700' }}
            >
              {nombre}
            </Text>
          </Pressable>
        ))}
      </View>
      {v.vehiculoTipo && v.vehiculoTipo !== 'a_pie' ? (
        <>
          {campo('marca', t.marca)}
          {campo('modelo', t.modelo)}
          {campo('anio', t.anio, { keyboardType: 'number-pad' })}
          {campo('color', t.color)}
          {conMotor ? campo('placa', t.placa, { autoCapitalize: 'characters' }) : null}
        </>
      ) : null}
      {conMotor ? (
        <>
          <Text style={estilo.sub}>{t.licencia}</Text>
          {campo('licenciaNumero', t.licenciaNumero, { autoCapitalize: 'characters' })}
          {campo('licenciaEstado', t.licenciaEstado)}
          {campo('licenciaVence', t.vence, { placeholder: '2030-12-31' })}
          <Text style={estilo.sub}>{t.seguro}</Text>
          {campo('seguroAseguradora', t.aseguradora)}
          {campo('seguroPoliza', t.poliza)}
          {campo('seguroVence', t.vence, { placeholder: '2030-12-31' })}
        </>
      ) : null}
      {error && !error.campo ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error.mensaje}
        </Text>
      ) : null}
      {aviso ? <Text style={{ color: '#0D7A3A', marginBottom: 8 }}>{aviso}</Text> : null}
      <Boton texto={t.guardar} alTocar={() => void guardar()} cargando={guardando} />
      <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.privado}</Text>
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
