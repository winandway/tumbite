import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import {
  DOCUMENTOS_VEHICULO_PASAJEROS,
  ErrorApi,
  errorCasilla,
  nombrePapelPais,
  pasoVigente,
  useBorrador,
  type ServicioPasajeros,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  COLOR,
  Campo,
  FUENTE,
  FormularioPorPasos,
  Icono,
  LETRA,
  RADIO,
  Text,
  alSalirTelefono,
  almacenTelefono,
  estadoPapel,
  fotoConOrigen,
  useSesion,
  type NombreIcono,
  type PasoVisible,
} from '@tumbite/movil';
import { FilaPapel } from '../servicios/FilaPapel';
import { detallePapelVehiculo } from '../servicios/papelesVehiculo';
import { CAMARA, POR_SERVICIO, deArchivos } from '../viajes/AltaPasajeros';
import { IMG } from '../piezas/recursos';
import {
  esMotorizado,
  fotosQueFaltan,
  papelesDeAlta,
  tiposDisponibles,
  type TipoVehiculo,
} from './tiposVehiculo';

/**
 * C-AGREGA-TU-VEHICULO (27 nov 2026, orden de Richard, que lo vio en su Android: «no se entiende
 * dónde está el perfil, ni cómo agregar la moto, ni cómo elegir el tipo») — todos los países. UNA
 * sola entrada, «Agrega tu vehículo», como Uber y DoorDash: 1) con qué vas a trabajar (tarjetas
 * grandes), 2) los datos del vehículo con el nombre arriba de cada casilla, 3) las fotos y papeles,
 * y al terminar el vehículo REAL queda guardado en el servidor (`/datos/conductor/vehiculos`) y se
 * envía a revisión. Bicicleta y a pie no piden datos ni fotos. El paso vigente y lo escrito se
 * guardan en el borrador y solo se borran cuando el servidor confirmó.
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
  placaEstado?: string;
  plazas: number | null;
  estado: string;
  motivo: string;
  documentos: Doc[];
};
type Papeles = {
  ciudad: { pais: string };
  perfil: { placaNacional?: boolean; documentosVehiculo?: Partial<Record<string, string[]>> };
};

const T = {
  es: {
    pasoTipo: '¿Con qué vas a trabajar?',
    ayudaTipo: 'Toca una opción. Puedes agregar otro vehículo después.',
    tipos: {
      moto: 'Moto',
      carro: 'Carro',
      scooter: 'Scooter',
      bicicleta: 'Bicicleta',
      a_pie: 'A pie',
    } as Record<string, string>,
    nombres: {
      moto: 'moto',
      carro: 'carro',
      scooter: 'scooter',
      bicicleta: 'bicicleta',
      a_pie: 'vehículo',
    } as Record<string, string>,
    enRevision: 'En revisión',
    pasoDatos: (v: string) => `Datos de tu ${v}`,
    ayudaDatos: 'Escríbelos como salen en el registro del vehículo.',
    pasoFotos: (v: string) => `Fotos de tu ${v}`,
    ayudaFotos: 'Toma las fotos ahora. Con la del frente y la de la placa puedes terminar.',
    marca: 'Marca',
    modelo: 'Modelo',
    anio: 'Año',
    color: 'Color',
    placa: 'Placa',
    estadoPlaca: 'Estado de la placa (dos letras)',
    escribe: (c: string) => `Escribe ${c}.`,
    deLaMarca: 'la marca',
    delModelo: 'el modelo',
    delColor: 'el color',
    estadoMal: 'Escribe las dos letras del estado de la placa (por ejemplo, FL).',
    revisa: 'Revisa las casillas marcadas.',
    eligeUno: 'Elige con qué vas a trabajar.',
    falta: (l: string) => `Falta: ${l}`,
    foto_frente: 'foto del frente',
    foto_placa: 'foto de la placa',
    terminar: 'Terminar',
    guardar: 'Guardar',
    guardado: (v: string) => `Tu ${v} quedó guardada y está en revisión.`,
    guardadoMasc: (v: string) => `Tu ${v} quedó guardado y está en revisión.`,
    guardadoAPie: 'Guardamos que trabajas a pie. Está en revisión.',
    sinEnviar: 'Tu vehículo quedó guardado, pero todavía no se pudo enviar a revisión.',
    revisaDespues: 'Te avisamos en cuanto el equipo lo revise.',
    volver: 'Volver a mi perfil',
    docsEn: 'Papeles que pide tu país',
  },
  en: {
    pasoTipo: 'What will you work with?',
    ayudaTipo: 'Tap one. You can add another vehicle later.',
    tipos: {
      moto: 'Motorbike',
      carro: 'Car',
      scooter: 'Scooter',
      bicicleta: 'Bicycle',
      a_pie: 'On foot',
    } as Record<string, string>,
    nombres: {
      moto: 'motorbike',
      carro: 'car',
      scooter: 'scooter',
      bicicleta: 'bicycle',
      a_pie: 'vehicle',
    } as Record<string, string>,
    enRevision: 'Under review',
    pasoDatos: (v: string) => `Your ${v} details`,
    ayudaDatos: 'Type them as they appear on the vehicle registration.',
    pasoFotos: (v: string) => `Photos of your ${v}`,
    ayudaFotos: 'Take the photos now. With the front and plate photos you can finish.',
    marca: 'Make',
    modelo: 'Model',
    anio: 'Year',
    color: 'Color',
    placa: 'License plate',
    estadoPlaca: 'Plate state (two letters)',
    escribe: (c: string) => `Enter ${c}.`,
    deLaMarca: 'the make',
    delModelo: 'the model',
    delColor: 'the color',
    estadoMal: 'Enter the two letters of the plate state (for example, FL).',
    revisa: 'Check the marked fields.',
    eligeUno: 'Choose what you will work with.',
    falta: (l: string) => `Missing: ${l}`,
    foto_frente: 'front photo',
    foto_placa: 'plate photo',
    terminar: 'Finish',
    guardar: 'Save',
    guardado: (v: string) => `Your ${v} is saved and under review.`,
    guardadoMasc: (v: string) => `Your ${v} is saved and under review.`,
    guardadoAPie: 'We saved that you work on foot. It is under review.',
    sinEnviar: 'Your vehicle is saved, but it could not be sent for review yet.',
    revisaDespues: 'We will let you know as soon as the team reviews it.',
    volver: 'Back to my profile',
    docsEn: 'Documents your country asks for',
  },
};

const PASOS = {
  tipo: { clave: 'tipo', casillas: ['tipo'] },
  datos: { clave: 'datos', casillas: ['marca', 'modelo', 'anio', 'color', 'placa', 'placaEstado'] },
  fotos: { clave: 'fotos', casillas: ['fotos'] },
} as const;

const ICONO_TIPO = new Map<string, NombreIcono>([
  ['scooter', 'speedometer-outline'],
  ['bicicleta', 'bicycle-outline'],
  ['a_pie', 'walk-outline'],
]);

const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k);

export function AgregarVehiculo({
  servicios,
  alSalir,
}: {
  /** Los servicios del conductor (comida, envios, moto, carro…): deciden qué tipos se ofrecen. */
  servicios?: readonly string[];
  alSalir: () => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = idioma === 'en' ? T.en : T.es;
  const b = useBorrador({
    formulario: 'driver-agregar-vehiculo',
    cuenta: usuario?.id,
    inicial: {
      paso: 'tipo',
      tipo: '',
      vehiculoId: '',
      marca: '',
      modelo: '',
      anio: '',
      color: '',
      placa: '',
      placaEstado: '',
    },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const v = b.valores;
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [papeles, setPapeles] = useState<Papeles | null>(null);
  const [cargado, setCargado] = useState(false);
  const [fallos, setFallos] = useState<Map<string, string>>(new Map());
  const [porQue, setPorQue] = useState('');
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [subiendo, setSubiendo] = useState('');
  const [hecho, setHecho] = useState<{ enviado: boolean; mensaje: string } | null>(null);

  const cargar = useCallback(async () => {
    const [lista, p] = await Promise.all([
      api.pedir<{ vehiculos: Vehiculo[] }>('GET', '/datos/conductor/vehiculos'),
      api.pedir<Papeles>('GET', '/datos/conductor/papeles').catch(() => null),
    ]);
    setVehiculos(lista.vehiculos);
    setPapeles(p);
    setCargado(true);
    return lista.vehiculos;
  }, [api]);
  useEffect(() => {
    const primero = setTimeout(
      () =>
        void cargar().catch((x: unknown) =>
          setError(x instanceof ErrorApi ? x.message : String(x)),
        ),
      0,
    );
    return () => clearTimeout(primero);
  }, [cargar]);

  // Un paso de fotos sin vehículo guardado (borrador viejo): se vuelve a los datos.
  const { cambiar } = b;
  const sinVehiculoEnFotos =
    cargado && v.paso === 'fotos' && !vehiculos.some((x) => x.id === v.vehiculoId);
  useEffect(() => {
    if (sinVehiculoEnFotos) cambiar('paso', 'datos');
  }, [sinVehiculoEnFotos, cambiar]);

  const tipo = v.tipo;
  const conMotor = esMotorizado(tipo);
  const pasos: PasoVisible[] = [];
  const pais = papeles?.ciudad.pais ?? null;
  const placaNacional = Boolean(papeles?.perfil.placaNacional);
  const nombre = de(t.nombres, tipo) ?? t.nombres.moto ?? '';
  const guardado = vehiculos.find((x) => x.id === v.vehiculoId) ?? null;
  const delServicio: ServicioPasajeros = tipo === 'carro' ? 'carro' : 'moto';
  const porServicio = tipo === 'carro' ? POR_SERVICIO.carro : POR_SERVICIO.moto;
  const textosServicio = idioma === 'en' ? porServicio.en : porServicio.es;

  const poner = (campo: string, x: string) => {
    b.cambiar(campo as 'marca', x);
    setPorQue('');
    setFallos((f) => {
      if (!f.has(campo)) return f;
      const n = new Map(f);
      n.delete(campo);
      return n;
    });
  };
  const irAlPaso = (clave: string) => {
    setFallos(new Map());
    setPorQue('');
    setError('');
    b.cambiar('paso', clave);
  };

  /** Elegir el tipo: si ya hay uno guardado sin enviar, se retoman sus datos (no se duplica). */
  function elegir(nuevo: TipoVehiculo) {
    b.cambiar('tipo', nuevo);
    setPorQue('');
    const previo = vehiculos.find(
      (x) => x.tipo === nuevo && (x.estado === 'registrado' || x.estado === 'rechazado'),
    );
    if (previo) {
      b.cambiar('vehiculoId', previo.id);
      if (!v.marca && !v.modelo && !v.placa) {
        b.cambiar('marca', previo.marca);
        b.cambiar('modelo', previo.modelo);
        b.cambiar('anio', previo.anio ? String(previo.anio) : '');
        b.cambiar('color', previo.color);
        b.cambiar('placa', previo.placa);
        b.cambiar('placaEstado', previo.placaEstado ?? '');
      }
    } else if (guardado && guardado.tipo !== nuevo) b.cambiar('vehiculoId', '');
  }

  function validarDatos(): boolean {
    const f = new Map<string, string>();
    if (!v.marca.trim()) f.set('marca', t.escribe(t.deLaMarca));
    if (!v.modelo.trim()) f.set('modelo', t.escribe(t.delModelo));
    if (!v.color.trim()) f.set('color', t.escribe(t.delColor));
    const anio = errorCasilla('anioVehiculo', v.anio, { idioma, pais, obligatorio: true });
    if (anio) f.set('anio', anio);
    const placa = errorCasilla('placa', v.placa, { idioma, pais, obligatorio: true });
    if (placa) f.set('placa', placa);
    if (!placaNacional && !/^[A-Za-z]{2}$/.test(v.placaEstado.trim()))
      f.set('placaEstado', t.estadoMal);
    setFallos(f);
    setPorQue(f.size ? t.revisa : '');
    return !f.size;
  }

  /** Crea el vehículo real en el servidor (o corrige el que ya estaba sin enviar). */
  async function guardarVehiculo(): Promise<string | null> {
    const cuerpo = {
      tipo,
      marca: conMotor ? v.marca.trim() : '',
      modelo: conMotor ? v.modelo.trim() : '',
      anio: conMotor && v.anio ? Number(v.anio) : null,
      color: conMotor ? v.color.trim() : '',
      placa: conMotor ? v.placa.trim() : '',
      placaEstado: conMotor ? v.placaEstado.trim() : '',
      ...(tipo === 'carro' ? { plazas: guardado?.plazas ?? 4 } : {}),
    };
    const editable =
      guardado && (guardado.estado === 'registrado' || guardado.estado === 'rechazado');
    if (editable) {
      await api.pedir('PUT', `/datos/conductor/vehiculos/${guardado.id}`, cuerpo);
      return guardado.id;
    }
    // Ya en revisión (llegó solo al subir lo que faltaba): no se edita ni se duplica.
    if (guardado) return guardado.id;
    const r = await api.pedir<{ id: string }>('POST', '/datos/conductor/vehiculos', cuerpo);
    return r.id;
  }

  /** Un error del servidor de una casilla va debajo de ella y lleva al paso donde está. */
  function errorDelServidor(x: unknown) {
    if (x instanceof ErrorApi && x.campo && PASOS.datos.casillas.some((c) => c === x.campo)) {
      setFallos(new Map([[x.campo, x.message]]));
      setPorQue(t.revisa);
      b.cambiar('paso', 'datos');
    } else setPorQue(x instanceof ErrorApi ? x.message : String(x));
  }

  async function guardarYSeguir() {
    setTrabajando(true);
    setPorQue('');
    try {
      const id = await guardarVehiculo();
      if (id) b.cambiar('vehiculoId', id);
      await cargar();
      irAlPaso('fotos');
    } catch (x) {
      errorDelServidor(x);
    } finally {
      setTrabajando(false);
    }
  }

  async function subir(clave: string, origen: 'camara' | 'archivos') {
    if (!guardado) return;
    setPorQue('');
    try {
      const foto = await fotoConOrigen(idioma, CAMARA, deArchivos, origen);
      if (!foto) return;
      setSubiendo(clave);
      const blob = await (await fetch(foto.uri)).blob();
      await api.subirFoto(
        blob,
        `/datos/conductor/vehiculos/${guardado.id}/documentos?tipo=${clave}`,
      );
      await cargar();
    } catch (x) {
      setPorQue(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendo('');
    }
  }

  function mensajeGuardado() {
    if (tipo === 'a_pie') return t.guardadoAPie;
    return tipo === 'carro' || tipo === 'scooter' ? t.guardadoMasc(nombre) : t.guardado(nombre);
  }

  /** Al terminar: se guarda (bicicleta y a pie) y se envía a revisión. */
  async function terminar() {
    setTrabajando(true);
    setPorQue('');
    try {
      const id = conMotor ? v.vehiculoId : await guardarVehiculo();
      if (!id) return;
      if (!conMotor) b.cambiar('vehiculoId', id);
      try {
        await api.pedir('POST', `/datos/conductor/vehiculos/${id}/enviar`, {});
      } catch (x) {
        // Lo que falta lo dice el servidor; el vehículo queda guardado y el borrador se conserva.
        setHecho({ enviado: false, mensaje: x instanceof ErrorApi ? x.message : String(x) });
        return;
      }
      await b.limpiar();
      setHecho({ enviado: true, mensaje: mensajeGuardado() });
    } catch (x) {
      errorDelServidor(x);
    } finally {
      setTrabajando(false);
    }
  }

  function alSiguiente(clave: string): boolean {
    if (clave === 'tipo') {
      if (!tipo) {
        setPorQue(t.eligeUno);
        return false;
      }
      setPorQue('');
      return true;
    }
    if (clave === 'datos') {
      if (!validarDatos()) return false;
      void guardarYSeguir();
      return false;
    }
    const falta = fotosQueFaltan(guardado?.documentos ?? []);
    if (falta.length) {
      setPorQue(
        t.falta(falta.map((f) => (f === 'foto_frente' ? t.foto_frente : t.foto_placa)).join(', ')),
      );
      return false;
    }
    setPorQue('');
    return true;
  }

  // ───── El resultado ─────
  if (hecho)
    return (
      <View style={{ gap: 16 }} testID="agregar-vehiculo-listo">
        <View
          style={{
            backgroundColor: hecho.enviado ? COLOR.exitoSuave : COLOR.superficie,
            borderRadius: RADIO.l,
            borderWidth: 1,
            borderColor: COLOR.borde,
            padding: 16,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icono
              nombre={hecho.enviado ? 'checkmark-circle' : 'alert-circle-outline'}
              tamano={26}
              color={hecho.enviado ? COLOR.exito : COLOR.textoSuave}
            />
            <Text
              style={{
                flex: 1,
                fontFamily: FUENTE.tituloMedio,
                fontSize: 18,
                color: hecho.enviado ? COLOR.exito : COLOR.texto,
              }}
              accessibilityRole="alert"
            >
              {hecho.enviado ? hecho.mensaje : t.sinEnviar}
            </Text>
          </View>
          {hecho.enviado ? (
            <Text style={LETRA.secundario}>{t.revisaDespues}</Text>
          ) : (
            <Text style={LETRA.cuerpo} testID="agregar-vehiculo-falta">
              {hecho.mensaje}
            </Text>
          )}
        </View>
        <Boton texto={t.volver} alTocar={alSalir} testID="agregar-vehiculo-volver" />
      </View>
    );

  // ───── Los pasos ─────
  const disponibles = tiposDisponibles(servicios);
  pasos.push({
    clave: PASOS.tipo.clave,
    casillas: PASOS.tipo.casillas,
    titulo: t.pasoTipo,
    ayuda: t.ayudaTipo,
    contenido: (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} testID="vehiculo-tipos">
        {disponibles.map((id) => {
          const elegido = tipo === id;
          const enRevision = vehiculos.some((x) => x.tipo === id && x.estado === 'en_revision');
          const imagen = id === 'moto' ? IMG.flotaMoto : id === 'carro' ? IMG.flotaCarro : null;
          return (
            <Pressable
              key={id}
              testID={`vehiculo-tipo-${id}`}
              disabled={enRevision}
              onPress={() => elegir(id)}
              accessibilityRole="radio"
              accessibilityLabel={de(t.tipos, id) ?? id}
              accessibilityState={{ selected: elegido, disabled: enRevision }}
              style={{
                width: '47%',
                flexGrow: 1,
                minHeight: 132,
                borderRadius: RADIO.l,
                borderWidth: 2,
                borderColor: elegido ? COLOR.exito : COLOR.borde,
                backgroundColor: elegido ? COLOR.exitoSuave : COLOR.fondo,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 12,
                opacity: enRevision ? 0.5 : 1,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 1,
              }}
            >
              {imagen ? (
                <Image
                  source={imagen}
                  style={{ width: 96, height: 64 }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Icono
                  nombre={ICONO_TIPO.get(id) ?? 'bicycle-outline'}
                  tamano={48}
                  color={COLOR.texto}
                />
              )}
              <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 17 }}>
                {de(t.tipos, id) ?? id}
              </Text>
              {enRevision ? <Text style={LETRA.secundario}>{t.enRevision}</Text> : null}
              {elegido ? (
                <View style={{ position: 'absolute', top: 8, right: 8 }}>
                  <Icono nombre="checkmark-circle" tamano={24} color={COLOR.exito} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    ),
  });
  if (!tipo || conMotor) {
    const casilla = (
      campo: 'marca' | 'modelo' | 'anio' | 'color' | 'placa' | 'placaEstado',
      etiqueta: string,
    ) => (
      <Campo
        testID={`agregar-${campo}`}
        etiqueta={etiqueta}
        tipo={campo === 'anio' ? 'anioVehiculo' : campo === 'placa' ? 'placa' : undefined}
        pais={pais}
        value={String(new Map(Object.entries(v)).get(campo) ?? '')}
        onChangeText={(x) => poner(campo, campo === 'placaEstado' ? x.toUpperCase() : x)}
        placeholder={etiqueta}
        autoCapitalize={
          campo === 'placaEstado' ? 'characters' : campo === 'placa' ? undefined : 'words'
        }
        error={fallos.get(campo)}
      />
    );
    pasos.push({
      clave: PASOS.datos.clave,
      casillas: PASOS.datos.casillas,
      titulo: t.pasoDatos(nombre),
      ayuda: t.ayudaDatos,
      contenido: (
        <View style={{ gap: 4 }}>
          <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
          {casilla('marca', t.marca)}
          {casilla('modelo', t.modelo)}
          {casilla('anio', t.anio)}
          {casilla('color', t.color)}
          {casilla('placa', t.placa)}
          {placaNacional ? null : casilla('placaEstado', t.estadoPlaca)}
        </View>
      ),
    });
    const docs = papelesDeAlta(
      papeles?.perfil.documentosVehiculo
        ? new Map(Object.entries(papeles.perfil.documentosVehiculo)).get(tipo)
        : undefined,
      tipo,
      new Map(Object.entries(DOCUMENTOS_VEHICULO_PASAJEROS)).get(delServicio) ?? [],
    );
    pasos.push({
      clave: PASOS.fotos.clave,
      casillas: PASOS.fotos.casillas,
      titulo: t.pasoFotos(nombre),
      ayuda: t.ayudaFotos,
      contenido: (
        <View
          style={{ borderWidth: 1, borderColor: COLOR.borde, borderRadius: RADIO.l }}
          testID="vehiculo-fotos"
        >
          {docs.map((clave, i) => {
            const d = guardado?.documentos.find(
              (x) => x.tipo === clave && x.estado !== 'reemplazado',
            );
            const dice = detallePapelVehiculo(
              {
                docEstado: d?.estado,
                vehiculoEstado: guardado?.estado ?? 'registrado',
                vehiculoTipo: tipo,
              },
              idioma,
            );
            return (
              <FilaPapel
                key={clave}
                testID={`papel-${clave}`}
                primera={i === 0}
                nombre={
                  nombrePapelPais(pais, delServicio, clave, idioma) ??
                  de(textosServicio.docs, clave) ??
                  clave
                }
                estado={estadoPapel(d?.estado ?? 'sin_subir')}
                textoEstado={dice.pildora ?? undefined}
                detalle={dice.texto || undefined}
                motivo={d?.motivo}
                idioma={idioma}
                subiendo={subiendo === clave}
                alSubir={(origen) => void subir(clave, origen)}
              />
            );
          })}
        </View>
      ),
    });
  }

  const paso = pasoVigente(pasos, v.paso);
  return (
    <View testID="agregar-vehiculo">
      {error ? (
        <Text style={{ color: COLOR.error, marginBottom: 8 }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <FormularioPorPasos
        pasos={pasos}
        paso={paso}
        alCambiarPaso={irAlPaso}
        alSiguiente={alSiguiente}
        alTerminar={() => void terminar()}
        alSalir={alSalir}
        textoTerminar={conMotor ? t.terminar : t.guardar}
        testIDTerminar="agregar-vehiculo-terminar"
        porQue={porQue}
        cargando={trabajando}
        idioma={idioma}
      />
    </View>
  );
}
