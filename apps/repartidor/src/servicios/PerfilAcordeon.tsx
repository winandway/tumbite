import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { DOCUMENTOS_VEHICULO_PASAJEROS, ErrorApi, type Idioma } from '@tumbite/compartido';
import {
  Boton,
  COLOR,
  FUENTE,
  Icono,
  LETRA,
  MOVIMIENTO,
  MOTOR_NATIVO,
  MotivoRechazo,
  PildoraPapel,
  RADIO,
  Text,
  confirmarConSistema,
  estadoPapel,
  fotoConOrigen,
  useSesion,
  type EstadoPapel,
  type NombreIcono,
} from '@tumbite/movil';
import { MisDatos } from '../MisDatos';
import { Verificacion } from '../Verificacion';
import { POR_SERVICIO } from '../viajes/AltaPasajeros';
import { MiCarro } from '../viajes/MiCarro';
import { MiMoto } from '../viajes/MiMoto';
import { IMG } from '../piezas/recursos';
import { fotoSirveDeAvatar, nombreServicio, ordenarServicios, type ServicioPanel } from './logica';
import { textosServicios } from './textos';

/**
 * C-SERVICIOS-CONECTADOS (pantallas 06 y 07 de DRIVER.md) — todos los países. El perfil del Driver
 * en acordeón: «Mi vehículo» (una tarjeta por vehículo que se abre y muestra sus papeles con su
 * píldora y, si se rechazó, el motivo y «Tomar foto» / «Subir archivo») y «Documentos» (los del
 * perfil compartido, con los servicios donde sirven). Una sola sección abierta a la vez en cada
 * nivel, 200 ms, la flecha gira 180°. Borrar un vehículo solo dentro de sus tres puntos. Reemplaza
 * las secciones sueltas de vehículo y documentos sin perder nada: el alta completa de cada vehículo,
 * los datos de reparto y la verificación de identidad se abren desde aquí.
 */
type Doc = { id: string; tipo: string; estado: string; motivo: string; venceEn?: string | null };
type Vehiculo = {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  placa: string;
  estado: string;
  motivo: string;
  documentos: Doc[];
};
type Papeles = {
  perfil: { documentosVehiculo?: Partial<Record<string, string[]>> };
  documentos: Doc[];
};
type PapelReq = {
  requisito: string;
  grupo: 'perfil' | 'vehiculo';
  nombre: string;
  estado: 'aprobado' | 'pendiente' | 'rechazado' | 'falta';
  motivo?: string;
};

/** Requisito del perfil → tipo de papel que sube el conductor (la misma tabla del servidor). */
const DOC_CONDUCTOR: Record<string, string> = {
  licencia: 'licencia_conducir',
  licencia_moto: 'licencia_moto',
  antecedentes_pasajeros: 'antecedentes_penales',
};
/** Los que el conductor sube como papel; el resto lo revisa el equipo o el proveedor. */
const SE_SUBEN = new Set(Object.keys(DOC_CONDUCTOR));

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

const de = (m: Record<string, string> | undefined, k: string) =>
  m ? new Map(Object.entries(m)).get(k) : undefined;

/** La flecha que gira 180° en 200 ms al abrir y cerrar. */
function Flecha({ abierto }: { abierto: boolean }) {
  const [giro] = useState(() => new Animated.Value(abierto ? 1 : 0));
  useEffect(() => {
    Animated.timing(giro, {
      toValue: abierto ? 1 : 0,
      duration: MOVIMIENTO.acordeon,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: MOTOR_NATIVO,
    }).start();
  }, [abierto, giro]);
  return (
    <Animated.View
      style={{
        transform: [
          { rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
        ],
      }}
    >
      <Icono nombre="chevron-down" tamano={22} color={COLOR.texto} />
    </Animated.View>
  );
}

/** Lo de adentro de una sección: aparece con un fundido de 200 ms. */
function Contenido({ children }: { children: ReactNode }) {
  const [o] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(o, {
      toValue: 1,
      duration: MOVIMIENTO.acordeon,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: MOTOR_NATIVO,
    }).start();
  }, [o]);
  return <Animated.View style={{ opacity: o }}>{children}</Animated.View>;
}

/** Cabecera de una sección del acordeón (Mi vehículo, Documentos). */
function Seccion({
  icono,
  titulo,
  resumen,
  resumenVerde,
  abierto,
  alTocar,
  testID,
}: {
  icono: NombreIcono;
  titulo: string;
  resumen: string;
  resumenVerde?: boolean;
  abierto: boolean;
  alTocar: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityState={{ expanded: abierto }}
      accessibilityLabel={`${titulo}. ${resumen}`}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        backgroundColor: pressed ? COLOR.superficie : 'transparent',
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: RADIO.m,
          backgroundColor: COLOR.superficie,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre={icono} tamano={22} />
      </View>
      <Text style={[LETRA.subtitulo, { flexShrink: 0 }]}>{titulo}</Text>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          textAlign: 'right',
          fontSize: 14,
          fontFamily: resumenVerde ? FUENTE.textoFuerte : FUENTE.texto,
          color: resumenVerde ? COLOR.exito : COLOR.textoSuave,
        }}
      >
        {resumen}
      </Text>
      <Flecha abierto={abierto} />
    </Pressable>
  );
}

/** Una fila de papel: nombre, detalle, píldora y, si hace falta, el motivo y las dos subidas. */
function FilaPapel({
  nombre,
  detalle,
  estado,
  motivo,
  chips,
  idioma,
  subiendo,
  alSubir,
  alAbrir,
  primera,
  testID,
}: {
  testID?: string;
  nombre: string;
  detalle?: string;
  estado: EstadoPapel;
  motivo?: string;
  chips?: string[];
  idioma: Idioma;
  subiendo?: boolean;
  /** Sube el papel con la cámara o desde los archivos. */
  alSubir?: (origen: 'camara' | 'archivos') => void;
  /** Abre la pantalla completa de ese papel (identidad, antecedentes). */
  alAbrir?: () => void;
  primera?: boolean;
}) {
  const t = textosServicios(idioma);
  const necesita = estado === 'rechazado' || estado === 'falta';
  return (
    <View
      testID={testID}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderTopWidth: primera ? 0 : 1,
        borderTopColor: COLOR.borde,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16, lineHeight: 22 }}>
            {nombre}
          </Text>
          {detalle ? <Text style={LETRA.secundario}>{detalle}</Text> : null}
          {chips?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {chips.map((c) => (
                <View
                  key={c}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: RADIO.s,
                    backgroundColor: COLOR.superficie,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FUENTE.textoFuerte,
                      fontSize: 12,
                      color: COLOR.textoSuave,
                    }}
                  >
                    {c}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <PildoraPapel estado={estado} texto={de(t.estados, estado) ?? estado} />
      </View>
      {estado === 'rechazado' && motivo ? (
        <MotivoRechazo etiqueta={t.motivo} texto={motivo} />
      ) : null}
      {necesita && alSubir ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <BotonSubir
              texto={subiendo ? t.subiendo : t.tomarFoto}
              icono="camera-outline"
              fuerte
              cargando={subiendo}
              alTocar={() => alSubir('camara')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <BotonSubir
              texto={t.subirArchivo}
              cargando={subiendo}
              alTocar={() => alSubir('archivos')}
            />
          </View>
        </View>
      ) : necesita && alAbrir ? (
        <BotonSubir texto={nombre} icono="arrow-forward" fuerte alTocar={alAbrir} />
      ) : null}
    </View>
  );
}

function BotonSubir({
  texto,
  icono,
  fuerte,
  cargando,
  alTocar,
}: {
  texto: string;
  icono?: NombreIcono;
  fuerte?: boolean;
  cargando?: boolean;
  alTocar: () => void;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        height: 48,
        borderRadius: RADIO.m,
        backgroundColor: fuerte
          ? pressed
            ? '#2A2A2A'
            : COLOR.negro
          : pressed
            ? '#E3E3E3'
            : COLOR.superficie,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: cargando ? 0.6 : 1,
      })}
    >
      {icono ? (
        <Icono nombre={icono} tamano={18} color={fuerte ? COLOR.blanco : COLOR.texto} />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          fontFamily: FUENTE.tituloMedio,
          fontSize: 15,
          color: fuerte ? COLOR.blanco : COLOR.texto,
        }}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

const fechaCorta = (f: string, idioma: Idioma) =>
  new Date(
    `${f.replace(' ', 'T')}${f.includes('T') || f.length <= 10 ? '' : 'Z'}`,
  ).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export function PerfilAcordeon({
  servicios,
  menuCuenta,
  alMenu,
  inicial = null,
  alCambiarVehiculo,
}: {
  /** C-CAMBIAR-VEHICULO: al cambiar el vehículo activo, el inicio vuelve a leer sus servicios. */
  alCambiarVehiculo?: () => void;
  /** La sección que se abre al llegar (desde «Completar mi alta»). */
  inicial?: 'vehiculo' | 'documentos' | null;
  /** Los servicios del panel (para saber dónde sirve cada papel y qué vehículos ofrecer). */
  servicios: ServicioPanel[];
  /** Lo que abren los tres puntos de la cabecera (cerrar sesión y borrar la cuenta). */
  menuCuenta: ReactNode;
  alMenu: () => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = textosServicios(idioma);
  const [seccion, setSeccion] = useState<'vehiculo' | 'documentos' | null>(inicial);
  const [tarjeta, setTarjeta] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<'identidad' | 'moto' | 'carro' | 'reparto' | null>(null);
  const [menuVehiculo, setMenuVehiculo] = useState<string | null>(null);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [papeles, setPapeles] = useState<Papeles | null>(null);
  const [kyc, setKyc] = useState<{ estado: string; motivo: string } | null>(null);
  const [requisitos, setRequisitos] = useState<Record<string, PapelReq[]>>({});
  const [foto, setFoto] = useState<string | null>(null);
  // C-AVATAR-SIN-LINEA: una foto que no carga o es diminuta no se estira: van las iniciales.
  const [fotoMala, setFotoMala] = useState(false);
  // C-CAMBIAR-VEHICULO: el vehículo con el que trabaja ahora (se cambia desde «Mi vehículo»).
  const [activoId, setActivoId] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState('');
  const [error, setError] = useState('');
  const ids = servicios.map((s) => s.servicioId).join(',');

  const cargar = useCallback(async () => {
    try {
      const lista = ids ? ids.split(',') : [];
      const [v, p, k, ...reqs] = await Promise.all([
        api.pedir<{ vehiculos: Vehiculo[]; vehiculoActivoId?: string | null }>(
          'GET',
          '/datos/conductor/vehiculos',
        ),
        api.pedir<Papeles>('GET', '/datos/conductor/papeles').catch(() => null),
        api
          .pedir<{ kyc: { estado: string; motivo: string } }>('GET', '/datos/kyc')
          .catch(() => null),
        ...lista.map((id) =>
          api.pedir<{ verificados: PapelReq[]; faltan: PapelReq[] }>(
            'GET',
            `/datos/conductor/servicios/${id}/requisitos`,
          ),
        ),
      ]);
      setVehiculos(v.vehiculos.filter((x) => x.estado !== 'retirado'));
      setActivoId(v.vehiculoActivoId ?? null);
      setPapeles(p);
      setKyc(k?.kyc ?? null);
      setRequisitos(
        Object.fromEntries(
          lista.map((id, i) => {
            const r = reqs.at(i);
            return [id, [...(r?.verificados ?? []), ...(r?.faltan ?? [])]];
          }),
        ),
      );
      setError('');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }, [api, ids]);
  useEffect(() => {
    const primero = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(primero);
  }, [cargar]);
  const identidadOk = kyc?.estado === 'aprobado';
  useEffect(() => {
    if (!identidadOk) return;
    let vivo = true;
    api
      .verFoto('/datos/kyc/mi-foto')
      .then((u) => vivo && setFoto(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, identidadOk]);

  async function subir(ruta: string, clave: string, origen: 'camara' | 'archivos') {
    setError('');
    try {
      const f = await fotoConOrigen(idioma, CAMARA, deArchivos, origen);
      if (!f) return;
      setSubiendo(clave);
      const blob = await (await fetch(f.uri)).blob();
      await api.subirFoto(blob, ruta);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendo('');
    }
  }

  async function usarVehiculo(id: string) {
    setError('');
    try {
      await api.pedir('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: id });
      await cargar();
      alCambiarVehiculo?.();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function retirar(id: string) {
    setMenuVehiculo(null);
    if (!(await confirmarConSistema(t.confirmarRetirar, t.retirarVehiculo, t.no, true))) return;
    try {
      await api.pedir('POST', `/datos/conductor/vehiculos/${id}/retirar`, {});
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  // ───── Una pantalla completa abierta desde el perfil (alta, datos de reparto, identidad) ─────
  if (abierto)
    return (
      <View style={{ gap: 12 }}>
        <Pressable
          onPress={() => {
            setAbierto(null);
            void cargar();
          }}
          accessibilityRole="button"
          accessibilityLabel={t.volver}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Icono nombre="chevron-back" tamano={20} />
          <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16 }}>{t.miPerfil}</Text>
        </Pressable>
        {abierto === 'identidad' ? (
          <Verificacion />
        ) : abierto === 'reparto' ? (
          <MisDatos />
        ) : abierto === 'carro' ? (
          <MiCarro />
        ) : (
          <MiMoto />
        )}
      </View>
    );

  // ───── Los papeles del perfil compartido (pantalla 07) ─────
  const nombreDe = (id: string) => {
    const s = servicios.find((x) => x.servicioId === id);
    return s ? nombreServicio(s, idioma) : id;
  };
  const perfil = new Map<string, PapelReq & { servicios: string[] }>();
  for (const [id, lista] of Object.entries(requisitos))
    for (const p of lista)
      if (p.grupo === 'perfil' && p.requisito !== 'identidad') {
        const ya = perfil.get(p.requisito);
        if (ya) ya.servicios.push(id);
        else perfil.set(p.requisito, { ...p, servicios: [id] });
      }
  const total = servicios.length;
  const chipsDe = (lista: string[]) =>
    total > 1 && lista.length === total ? [t.todos] : lista.map(nombreDe);
  const estadoKyc = estadoPapel(
    kyc?.estado === 'sin_enviar'
      ? 'falta'
      : kyc?.estado === 'pendiente'
        ? 'pendiente'
        : kyc?.estado,
  );
  const filasPerfil = [
    {
      clave: 'foto',
      nombre: t.fotoPerfil,
      detalle: de(t.detalleDoc, 'foto'),
      estado: estadoKyc,
      motivo: '',
      chips: [t.todos],
      requisito: 'identidad',
    },
    {
      clave: 'nombre',
      nombre: t.nombreCompleto,
      detalle: `${usuario?.nombre ?? ''} · ${de(t.detalleDoc, 'nombre') ?? ''}`,
      estado: estadoKyc,
      motivo: '',
      chips: [t.todos],
      requisito: 'identidad',
    },
    {
      clave: 'identidad',
      nombre: idioma === 'en' ? 'ID document' : 'Documento de identidad',
      detalle: de(t.detalleDoc, 'identidad'),
      estado: estadoKyc,
      motivo: kyc?.estado === 'rechazado' ? kyc.motivo : '',
      chips: [t.todos],
      requisito: 'identidad',
    },
    ...[...perfil.values()].map((p) => ({
      clave: p.requisito,
      nombre: p.nombre,
      detalle: de(t.detalleDoc, p.requisito.replace('_pasajeros', '')),
      estado: estadoPapel(p.estado),
      motivo: p.motivo ?? '',
      chips: chipsDe(p.servicios),
      requisito: p.requisito,
    })),
  ];
  const verificados = filasPerfil.filter((f) => f.estado === 'aprobado').length;

  // ───── Los vehículos con sus papeles (pantalla 06) ─────
  const ofrece = (tipo: 'moto' | 'carro') => servicios.some((s) => s.servicioId === tipo);
  const papelesDe = (v: Vehiculo) => {
    const pedidos =
      papeles?.perfil.documentosVehiculo?.[v.tipo] ??
      (v.tipo === 'moto' || v.tipo === 'carro' ? DOCUMENTOS_VEHICULO_PASAJEROS[v.tipo] : []) ??
      [];
    const tipos = [...new Set([...pedidos, ...v.documentos.map((d) => d.tipo)])];
    const nombres =
      v.tipo === 'carro'
        ? (idioma === 'en' ? POR_SERVICIO.carro.en : POR_SERVICIO.carro.es).docs
        : (idioma === 'en' ? POR_SERVICIO.moto.en : POR_SERVICIO.moto.es).docs;
    return tipos.map((tipo) => {
      const d = v.documentos.find((x) => x.tipo === tipo);
      return {
        tipo,
        nombre: de(nombres, tipo) ?? tipo,
        estado: estadoPapel(d?.estado ?? 'falta'),
        motivo: d?.motivo ?? '',
        detalle: d
          ? d.venceEn
            ? t.vence(fechaCorta(d.venceEn, idioma))
            : d.estado === 'aprobado'
              ? t.revisado
              : d.estado === 'pendiente'
                ? t.enviadoHoy
                : undefined
          : t.sinSubir,
      };
    });
  };
  const usosDe = (tipo: string) =>
    ordenarServicios(servicios)
      .filter((s) =>
        tipo === 'moto'
          ? s.servicioId !== 'carro'
          : tipo === 'carro'
            ? s.servicioId !== 'moto'
            : s.servicioId === 'comida' || s.servicioId === 'envios',
      )
      .map((s) => (s.servicioId === 'envios' ? de(t.nombres, 'envios') : nombreDe(s.servicioId)))
      .join(', ');
  const porCorregir = vehiculos.reduce(
    (n, v) => n + papelesDe(v).filter((p) => p.estado === 'rechazado').length,
    0,
  );
  const resumenVehiculos = [
    vehiculos
      .map((v) => {
        const n = (de(t.vehiculoDe, v.tipo) ?? v.tipo).replace(/^(Mi|My) /, '');
        return n.charAt(0).toUpperCase() + n.slice(1);
      })
      .join(', '),
    porCorregir ? t.porCorregir(porCorregir) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View testID="perfil-acordeon">
      {/* Cabecera (pantallas 06 y 07): foto con el ✓ verde, «Mi perfil» e identidad. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 16 }}>
        <View>
          {foto && !fotoMala ? (
            <Image
              source={{ uri: foto }}
              resizeMode="cover"
              style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLOR.superficie }}
              onError={() => setFotoMala(true)}
              onLoad={(ev) => {
                const f = ev.nativeEvent.source;
                if (!fotoSirveDeAvatar(f?.width, f?.height)) setFotoMala(true);
              }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: COLOR.negro,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: FUENTE.titulo, fontSize: 26, color: COLOR.blanco }}>
                {(usuario?.nombre ?? '')
                  .split(' ')
                  .slice(0, 2)
                  .map((x) => x[0] ?? '')
                  .join('')
                  .toUpperCase()}
              </Text>
            </View>
          )}
          {identidadOk ? (
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: COLOR.exito,
                borderWidth: 2,
                borderColor: COLOR.blanco,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre="checkmark" tamano={14} color={COLOR.blanco} />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={LETRA.titulo} accessibilityRole="header">
            {t.miPerfil}
          </Text>
          <Text
            style={{
              fontFamily: FUENTE.textoFuerte,
              fontSize: 15,
              color: identidadOk ? COLOR.exito : COLOR.textoSuave,
            }}
          >
            {identidadOk
              ? t.identidadVerificada
              : kyc?.estado === 'pendiente'
                ? t.identidadPendiente
                : t.identidadFalta}
          </Text>
        </View>
        <Pressable
          onPress={alMenu}
          accessibilityRole="button"
          accessibilityLabel={menuCuenta ? t.cerrarOpciones : t.masOpciones}
          testID="perfil-mas"
          style={{
            width: 44,
            height: 44,
            borderRadius: RADIO.m,
            borderWidth: 1,
            borderColor: COLOR.borde,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre={menuCuenta ? 'close' : 'ellipsis-vertical'} tamano={20} />
        </Pressable>
      </View>
      {menuCuenta ? <View style={{ paddingBottom: 12 }}>{menuCuenta}</View> : null}
      {error ? (
        <Text style={{ color: COLOR.error, marginBottom: 8 }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: COLOR.borde }}>
        <Seccion
          icono="car-outline"
          titulo={t.miVehiculo}
          resumen={seccion === 'vehiculo' ? String(vehiculos.length || '') : resumenVehiculos}
          abierto={seccion === 'vehiculo'}
          alTocar={() => setSeccion((x) => (x === 'vehiculo' ? null : 'vehiculo'))}
          testID="seccion-vehiculo"
        />
        {seccion === 'vehiculo' ? (
          <Contenido>
            <View style={{ gap: 12, paddingBottom: 16 }}>
              {vehiculos.length === 0 ? (
                <Text style={LETRA.secundario}>{t.sinVehiculo}</Text>
              ) : null}
              {vehiculos.map((v) => {
                const docs = papelesDe(v);
                const abiertaTarjeta = tarjeta === v.id;
                const aprobados = docs.filter((d) => d.estado === 'aprobado').length;
                const imagen =
                  v.tipo === 'moto' || v.tipo === 'scooter'
                    ? IMG.flotaMoto
                    : v.tipo === 'carro'
                      ? IMG.flotaCarro
                      : null;
                return (
                  <View
                    key={v.id}
                    testID={`vehiculo-${v.tipo}`}
                    style={{
                      borderWidth: 1,
                      borderColor: COLOR.borde,
                      borderRadius: RADIO.l,
                      overflow: 'hidden',
                    }}
                  >
                    <Pressable
                      onPress={() => setTarjeta((x) => (x === v.id ? null : v.id))}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: abiertaTarjeta }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
                    >
                      <View
                        style={{
                          width: 72,
                          height: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {imagen ? (
                          <Image
                            source={imagen}
                            style={{ width: 72, height: 48 }}
                            resizeMode="contain"
                            accessibilityIgnoresInvertColors
                          />
                        ) : (
                          <Icono nombre="bicycle-outline" tamano={28} />
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 17 }}>
                          {de(t.vehiculoDe, v.tipo) ?? v.tipo}
                          {v.id === activoId ? (
                            <Text style={{ color: COLOR.exito, fontSize: 13 }}>
                              {'  '}· {t.vehiculoEnUso}
                            </Text>
                          ) : null}
                        </Text>
                        <Text style={LETRA.secundario} numberOfLines={2}>
                          {abiertaTarjeta
                            ? [v.placa ? t.placa(v.placa) : '', usosDe(v.tipo)]
                                .filter(Boolean)
                                .join(' · ')
                            : docs.length
                              ? t.aprobadosPendientes(aprobados, docs.length - aprobados)
                              : [v.marca, v.modelo].filter(Boolean).join(' ')}
                        </Text>
                      </View>
                      <Flecha abierto={abiertaTarjeta} />
                    </Pressable>
                    {abiertaTarjeta ? (
                      <Contenido>
                        <View style={{ borderTopWidth: 1, borderTopColor: COLOR.borde }}>
                          {docs.map((d, i) => (
                            <FilaPapel
                              key={d.tipo}
                              testID={`papel-${d.tipo}`}
                              primera={i === 0}
                              nombre={d.nombre}
                              detalle={d.detalle}
                              estado={d.estado}
                              motivo={d.motivo}
                              idioma={idioma}
                              subiendo={subiendo === `${v.id}:${d.tipo}`}
                              alSubir={(origen) =>
                                void subir(
                                  `/datos/conductor/vehiculos/${v.id}/documentos?tipo=${d.tipo}`,
                                  `${v.id}:${d.tipo}`,
                                  origen,
                                )
                              }
                            />
                          ))}
                          {v.estado === 'aprobado' && v.id !== activoId ? (
                            // C-CAMBIAR-VEHICULO (robot, 18 nov 2026): elegir el vehículo con el que
                            // trabajar, como «Vehicles» de Uber Driver.
                            <View
                              style={{
                                padding: 12,
                                borderTopWidth: 1,
                                borderTopColor: COLOR.borde,
                              }}
                            >
                              <Boton
                                texto={t.usarEsteVehiculo}
                                exito
                                testID={`usar-vehiculo-${v.tipo}`}
                                alTocar={() => void usarVehiculo(v.id)}
                              />
                            </View>
                          ) : null}
                          {/* Borrar un vehículo: solo dentro de sus tres puntos (regla de la casa). */}
                          <View
                            style={{
                              borderTopWidth: docs.length ? 1 : 0,
                              borderTopColor: COLOR.borde,
                              padding: 12,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            {v.tipo === 'moto' || v.tipo === 'carro' ? (
                              <View style={{ flex: 1 }}>
                                <BotonSubir
                                  texto={t.completarVehiculo}
                                  alTocar={() => setAbierto(v.tipo as 'moto' | 'carro')}
                                />
                              </View>
                            ) : (
                              <View style={{ flex: 1 }} />
                            )}
                            <Pressable
                              onPress={() => setMenuVehiculo((x) => (x === v.id ? null : v.id))}
                              accessibilityRole="button"
                              accessibilityLabel={t.masOpciones}
                              hitSlop={6}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: RADIO.m,
                                backgroundColor: COLOR.superficie,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icono nombre="ellipsis-vertical" tamano={20} />
                            </Pressable>
                          </View>
                          {menuVehiculo === v.id ? (
                            <Pressable
                              onPress={() => void retirar(v.id)}
                              accessibilityRole="button"
                              accessibilityLabel={t.retirarVehiculo}
                              style={{
                                marginHorizontal: 12,
                                marginBottom: 12,
                                padding: 14,
                                borderRadius: RADIO.m,
                                borderWidth: 1,
                                borderColor: COLOR.borde,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                              }}
                            >
                              <Icono nombre="trash-outline" tamano={18} color={COLOR.error} />
                              <Text style={{ color: COLOR.error, fontFamily: FUENTE.textoFuerte }}>
                                {t.retirarVehiculo}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </Contenido>
                    ) : null}
                  </View>
                );
              })}
              {ofrece('moto') && !vehiculos.some((v) => v.tipo === 'moto') ? (
                <BotonSubir texto={t.agregarMoto} icono="add" alTocar={() => setAbierto('moto')} />
              ) : null}
              {ofrece('carro') && !vehiculos.some((v) => v.tipo === 'carro') ? (
                <BotonSubir
                  texto={t.agregarCarro}
                  icono="add"
                  alTocar={() => setAbierto('carro')}
                />
              ) : null}
              {/* Los datos de reparto de Comida y Envíos (ID, vehículo, licencia y seguro). */}
              <Pressable
                onPress={() => setAbierto('reparto')}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: COLOR.borde,
                  borderRadius: RADIO.l,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: pressed ? COLOR.superficie : COLOR.fondo,
                })}
              >
                <Icono nombre="bag-handle-outline" tamano={22} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16 }}>
                    {t.datosReparto}
                  </Text>
                  <Text style={LETRA.secundario}>{t.datosRepartoDetalle}</Text>
                </View>
                <Icono nombre="chevron-forward" tamano={20} color={COLOR.textoSuave} />
              </Pressable>
            </View>
          </Contenido>
        ) : null}
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: COLOR.borde }}>
        <Seccion
          icono="shield-checkmark-outline"
          titulo={t.documentos}
          resumen={t.nVerificados(verificados)}
          resumenVerde={verificados > 0}
          abierto={seccion === 'documentos'}
          alTocar={() => setSeccion((x) => (x === 'documentos' ? null : 'documentos'))}
          testID="seccion-documentos"
        />
        {seccion === 'documentos' ? (
          <Contenido>
            <View style={{ gap: 12, paddingBottom: 16 }}>
              <Text style={LETRA.secundario}>{t.docsAyuda}</Text>
              <View style={{ borderWidth: 1, borderColor: COLOR.borde, borderRadius: RADIO.l }}>
                {filasPerfil.map((f, i) => (
                  <FilaPapel
                    key={f.clave}
                    primera={i === 0}
                    nombre={f.nombre}
                    detalle={f.detalle}
                    estado={f.estado}
                    motivo={f.motivo}
                    chips={f.chips}
                    idioma={idioma}
                    subiendo={subiendo === f.requisito}
                    alSubir={
                      SE_SUBEN.has(f.requisito)
                        ? (origen) =>
                            void subir(
                              `/datos/conductor/papeles?tipo=${de(DOC_CONDUCTOR, f.requisito)}`,
                              f.requisito,
                              origen,
                            )
                        : undefined
                    }
                    alAbrir={
                      f.clave === 'identidad' || f.requisito.startsWith('antecedentes')
                        ? () => setAbierto('identidad')
                        : undefined
                    }
                  />
                ))}
              </View>
              {!identidadOk ? (
                <BotonSubir
                  texto={t.verificarIdentidad}
                  icono="shield-checkmark-outline"
                  fuerte
                  alTocar={() => setAbierto('identidad')}
                />
              ) : (
                <BotonSubir texto={t.verAntecedentes} alTocar={() => setAbierto('identidad')} />
              )}
            </View>
          </Contenido>
        ) : null}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: COLOR.borde }} />
    </View>
  );
}
