import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { type Api, ErrorApi, type Idioma, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  COLOR,
  FUENTE,
  Text,
  alSalirTelefono,
  almacenTelefono,
  e,
} from '@tumbite/movil';
import { type VehiculoEditable, faltaPlaca } from '../piezas/queTeFaltaLogica';
import { COLOR_TEXTO_DE_FONDO } from '@tumbite/movil';

/**
 * C-QUE-TE-FALTA (23 nov 2026, un conductor de Venezuela con la moto guardada sin placa y sin poder
 * corregirla) — todos los países. Completar o corregir los datos de un vehículo YA guardado, sin
 * borrarlo, con `PUT /datos/conductor/vehiculos/:id`. Solo mientras el servidor lo deja (registrado o
 * rechazado); en revisión o aprobado se dice por qué no y cómo seguir. El formulario guarda lo escrito
 * (borrador por cuenta y por vehículo) y el error de cada casilla va debajo de ella.
 */

const T = {
  es: {
    corregir: 'Corregir los datos',
    completarPlaca: 'Completar la placa',
    faltaPlaca: 'Falta la placa. Escríbela para poder enviar tu vehículo y trabajar.',
    marca: 'Marca',
    modelo: 'Modelo',
    anio: 'Año',
    color: 'Color',
    placa: 'Placa',
    estadoPlaca: 'Estado de la placa (por ejemplo, FL)',
    guardar: 'Guardar los cambios',
    cancelar: 'Cancelar',
    listo: 'Listo: guardamos los cambios.',
    enRevision: 'Lo estamos revisando: mientras tanto no se puede cambiar.',
    aprobado: 'Ya está aprobado. Si un dato está mal, escríbenos desde Ayuda.',
  },
  en: {
    corregir: 'Fix the details',
    completarPlaca: 'Add the license plate',
    faltaPlaca: 'The license plate is missing. Add it to send your vehicle and start working.',
    marca: 'Make',
    modelo: 'Model',
    anio: 'Year',
    color: 'Color',
    placa: 'License plate',
    estadoPlaca: 'Plate state (for example, FL)',
    guardar: 'Save changes',
    cancelar: 'Cancel',
    listo: 'Done: we saved your changes.',
    enRevision: 'We’re reviewing it: it can’t be changed in the meantime.',
    aprobado: 'It’s already approved. If something is wrong, write to us from Help.',
  },
};

type Campo = 'marca' | 'modelo' | 'anio' | 'color' | 'placa' | 'placaEstado';

export function EditarVehiculo({
  api,
  idioma,
  cuenta,
  vehiculo,
  placaNacional,
  alGuardar,
}: {
  api: Api;
  idioma: Idioma;
  cuenta: string | undefined;
  vehiculo: VehiculoEditable;
  placaNacional: boolean;
  alGuardar: () => unknown;
}) {
  const t = idioma === 'en' ? T.en : T.es;
  const editable = vehiculo.estado === 'registrado' || vehiculo.estado === 'rechazado';
  const sinPlaca = faltaPlaca(vehiculo, placaNacional);
  const [abierto, setAbierto] = useState(editable && sinPlaca);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<{ campo: string; texto: string } | null>(null);
  const [listo, setListo] = useState(false);
  const b = useBorrador({
    formulario: `driver-vehiculo-editar-${vehiculo.id}`,
    cuenta,
    inicial: { marca: '', modelo: '', anio: '', color: '', placa: '', placaEstado: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const { cargarBase } = b;
  useEffect(() => {
    // Lo guardado en el servidor; si había algo a medio escribir, eso manda.
    cargarBase({
      marca: vehiculo.marca ?? '',
      modelo: vehiculo.modelo ?? '',
      anio: vehiculo.anio ? String(vehiculo.anio) : '',
      color: vehiculo.color ?? '',
      placa: vehiculo.placa ?? '',
      placaEstado: placaNacional ? '' : (vehiculo.placaEstado ?? ''),
    });
  }, [cargarBase, vehiculo, placaNacional]);

  if (!editable)
    return (
      <Text testID="vehiculo-no-editable" style={{ color: COLOR.textoSuave, fontSize: 13 }}>
        {vehiculo.estado === 'en_revision' ? t.enRevision : t.aprobado}
      </Text>
    );

  async function guardar() {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    setListo(false);
    const v = b.valores;
    try {
      await api.pedir('PUT', `/datos/conductor/vehiculos/${vehiculo.id}`, {
        tipo: vehiculo.tipo,
        marca: v.marca.trim(),
        modelo: v.modelo.trim(),
        anio: v.anio ? Number(v.anio) : null,
        color: v.color.trim(),
        placa: v.placa.trim(),
        placaEstado: v.placaEstado.trim(),
        ...(vehiculo.plazas ? { plazas: vehiculo.plazas } : {}),
      });
      // Solo se borra lo escrito cuando el servidor confirmó que quedó guardado.
      await b.limpiar();
      setAbierto(false);
      setListo(true);
      await alGuardar();
    } catch (x) {
      setError({
        campo: x instanceof ErrorApi ? (x.campo ?? '') : '',
        texto: x instanceof ErrorApi ? x.message : String(x),
      });
    } finally {
      setOcupado(false);
    }
  }

  const casilla = (
    campo: Campo,
    etiqueta: string,
    teclado: 'default' | 'number-pad' = 'default',
  ) => (
    <View key={campo} style={{ gap: 4 }}>
      <Text style={{ color: COLOR.textoSuave, fontSize: 12 }}>{etiqueta}</Text>
      <TextInput
        placeholderTextColor={COLOR_TEXTO_DE_FONDO}
        testID={`editar-${campo}`}
        value={String(new Map(Object.entries(b.valores)).get(campo) ?? '')}
        onChangeText={(x) => {
          b.cambiar(campo, x);
          if (error?.campo === campo) setError(null);
        }}
        placeholder={etiqueta}
        accessibilityLabel={etiqueta}
        keyboardType={teclado}
        autoCapitalize={campo === 'placa' || campo === 'placaEstado' ? 'characters' : 'words'}
        style={[e.input, error?.campo === campo ? { borderColor: COLOR.error } : null]}
      />
      {error?.campo === campo ? (
        <Text accessibilityRole="alert" style={{ color: COLOR.error, fontSize: 13 }}>
          {error.texto}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ gap: 8, marginTop: 6 }} testID="editar-vehiculo">
      {sinPlaca ? (
        <Text testID="vehiculo-sin-placa" style={{ color: COLOR.error, fontWeight: '700' }}>
          {t.faltaPlaca}
        </Text>
      ) : null}
      {listo ? (
        <Text style={{ color: C.exito, fontWeight: '700' }} accessibilityRole="alert">
          {t.listo}
        </Text>
      ) : null}
      {abierto ? (
        <>
          <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
          {casilla('placa', t.placa)}
          {placaNacional ? null : casilla('placaEstado', t.estadoPlaca)}
          {casilla('marca', t.marca)}
          {casilla('modelo', t.modelo)}
          {casilla('anio', t.anio, 'number-pad')}
          {casilla('color', t.color)}
          {error &&
          !['placa', 'placaEstado', 'marca', 'modelo', 'anio', 'color'].includes(error.campo) ? (
            <Text accessibilityRole="alert" style={{ color: COLOR.error, fontWeight: '700' }}>
              {error.texto}
            </Text>
          ) : null}
          <Boton
            texto={t.guardar}
            alTocar={() => void guardar()}
            cargando={ocupado}
            testID="editar-guardar"
          />
          <Pressable
            onPress={() => {
              setAbierto(false);
              setError(null);
              void b.empezarDeNuevo();
            }}
            accessibilityRole="button"
            style={{ alignSelf: 'center', padding: 6 }}
          >
            <Text style={{ fontFamily: FUENTE.textoFuerte, textDecorationLine: 'underline' }}>
              {t.cancelar}
            </Text>
          </Pressable>
        </>
      ) : (
        <Boton
          texto={sinPlaca ? t.completarPlaca : t.corregir}
          alTocar={() => {
            setListo(false);
            setAbierto(true);
          }}
          secundario={!sinPlaca}
          testID="vehiculo-corregir"
        />
      )}
    </View>
  );
}
