import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { type Api, ErrorApi, type Idioma, errorCasilla, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  COLOR,
  Campo as CampoTexto,
  FUENTE,
  Text,
  alSalirTelefono,
  almacenTelefono,
} from '@tumbite/movil';
import { type VehiculoEditable, faltaPlaca } from '../piezas/queTeFaltaLogica';

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
  pais,
  alGuardar,
}: {
  api: Api;
  idioma: Idioma;
  cuenta: string | undefined;
  vehiculo: VehiculoEditable;
  placaNacional: boolean;
  /** C-CASILLA-CON-SU-TIPO: el país del conductor, para el formato de la placa. */
  pais?: string | null;
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
    // C-CASILLA-CON-SU-TIPO: la placa y el año con la misma regla que el servidor, antes de mandar.
    const malo = (['placa', 'anio'] as const)
      .map((c) => ({
        campo: c as string,
        texto: errorCasilla(
          c === 'anio' ? 'anioVehiculo' : 'placa',
          c === 'anio' ? v.anio : v.placa,
          {
            idioma,
            pais: pais ?? null,
            obligatorio: c === 'placa',
          },
        ),
      }))
      .find((x) => x.texto);
    if (malo?.texto) {
      setError({ campo: malo.campo, texto: malo.texto });
      setOcupado(false);
      return;
    }
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

  // C-CASILLA-CON-SU-TIPO: cada casilla con su nombre, ícono, teclado y aviso (la pieza única).
  const casilla = (campo: Campo, etiqueta: string) => (
    <CampoTexto
      key={campo}
      testID={`editar-${campo}`}
      etiqueta={etiqueta}
      tipo={campo === 'anio' ? 'anioVehiculo' : campo === 'placa' ? 'placa' : undefined}
      pais={pais ?? null}
      value={String(new Map(Object.entries(b.valores)).get(campo) ?? '')}
      onChangeText={(x) => {
        b.cambiar(campo, campo === 'placaEstado' ? x.toUpperCase() : x);
        if (error?.campo === campo) setError(null);
      }}
      placeholder={etiqueta}
      autoCapitalize={
        campo === 'placaEstado' ? 'characters' : campo === 'placa' ? undefined : 'words'
      }
      error={error?.campo === campo ? error.texto : undefined}
    />
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
          {casilla('anio', t.anio)}
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
