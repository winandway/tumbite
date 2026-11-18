import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  type FilaLugar,
  ICONOS_LUGAR,
  type LugarGuardado,
  esCasa,
  esTrabajo,
  filaLugares,
  iconoDeLugar,
  puedeGuardarLugar,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  COLOR,
  Icono,
  Modal,
  type NombreIcono,
  Text,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
} from '@tumbite/movil';
import { PuntoExacto } from '../PuntoExacto';
import { HojaAbajo } from '../inicio/HojaAbajo';
import type { Punto } from '../ubicacion';
import { BotonGrande } from './BotonGrande';
import { ICONO_LUGAR, textosLugares } from './textosLugares';
import type { LugarAGuardar } from './useLugares';

const ICONOS = new Map(Object.entries(ICONO_LUGAR));
const ico = (x: string) => (ICONOS.get(x) ?? 'star-outline') as NombreIcono;

/**
 * C-LUGARES-GUARDADOS (regla de Richard, LUGARES-GUARDADOS.md): la fila que se desliza con Casa,
 * Trabajo, los lugares propios y un «+» al final. Tocar un lugar con dirección lo pone como destino;
 * Casa o Trabajo sin dirección abren la hoja con el nombre puesto. Mantener presionado abre editar y
 * borrar (borrar dentro de los tres puntos, con confirmación).
 */
export function LugaresFila({
  lista,
  elegido,
  alElegir,
  guardar,
  borrar,
  cerca,
  testID = 'lugares-fila',
}: {
  lista: LugarGuardado[];
  /** La clave del lugar puesto como destino (pastilla negra). */
  elegido?: string | null;
  alElegir: (l: LugarGuardado, f: FilaLugar) => void;
  guardar: (d: LugarAGuardar, id?: string) => Promise<LugarGuardado>;
  borrar: (id: string) => Promise<void>;
  cerca: Punto | null;
  testID?: string;
}) {
  const { idioma } = useSesion();
  const t = textosLugares(idioma);
  const fila = filaLugares(lista, idioma);
  const [hoja, setHoja] = useState<{ fila: FilaLugar | null; nombre?: string } | null>(null);
  const [opciones, setOpciones] = useState<FilaLugar | null>(null);
  const [aviso, setAviso] = useState('');
  const tocar = (f: FilaLugar) => {
    if (f.lugar && f.conDireccion) return alElegir(f.lugar, f);
    setHoja({ fila: f, nombre: f.nombre });
  };
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        testID={testID}
      >
        {fila.map((f) => {
          const activo = elegido === f.clave;
          return (
            <Pressable
              key={f.clave}
              onPress={() => tocar(f)}
              onLongPress={() =>
                f.lugar ? setOpciones(f) : setHoja({ fila: f, nombre: f.nombre })
              }
              accessibilityRole="button"
              accessibilityLabel={f.conDireccion ? f.nombre : `${f.nombre}. ${t.sinDireccion}`}
              accessibilityHint={t.mantener}
              testID={`lugar-${f.clave}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: activo ? C.secundario : COLOR.borde,
                backgroundColor: activo ? C.secundario : '#FFFFFF',
                borderRadius: 24,
                paddingHorizontal: 14,
                minHeight: 44,
              }}
            >
              <Icono nombre={ico(f.icono)} tamano={18} color={activo ? '#FFFFFF' : C.secundario} />
              <Text style={{ fontWeight: '600', color: activo ? '#FFFFFF' : C.secundario }}>
                {f.nombre}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setHoja({ fila: null })}
          accessibilityRole="button"
          accessibilityLabel={t.agregarLugar}
          testID="lugar-agregar"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: COLOR.bordeFuerte,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre="add" tamano={22} color={C.secundario} />
        </Pressable>
      </ScrollView>
      {aviso ? (
        <Text
          accessibilityRole="alert"
          testID="lugar-guardado"
          style={{ color: C.exito, fontWeight: '700', marginTop: 8 }}
        >
          {aviso}
        </Text>
      ) : null}
      {hoja ? (
        <HojaLugar
          editar={hoja.fila?.lugar ?? null}
          nombreInicial={hoja.nombre ?? ''}
          iconoInicial={hoja.fila?.icono ?? 'estrella'}
          cerca={cerca}
          cerrar={() => setHoja(null)}
          guardar={async (d) => {
            const l = await guardar(d, hoja.fila?.lugar?.id);
            setHoja(null);
            setAviso(t.guardado);
            setTimeout(() => setAviso(''), 3_000);
            alElegir(l, {
              clave: esCasa(l) ? 'casa' : esTrabajo(l) ? 'trabajo' : l.id,
              nombre: l.etiqueta,
              icono: iconoDeLugar(l),
              lugar: l,
              conDireccion: true,
            });
          }}
        />
      ) : null}
      <OpcionesLugar
        fila={opciones}
        cerrar={() => setOpciones(null)}
        editar={() => {
          const f = opciones;
          setOpciones(null);
          if (f) setHoja({ fila: f, nombre: f.nombre });
        }}
        borrar={async () => {
          if (opciones?.lugar) await borrar(opciones.lugar.id);
          setOpciones(null);
        }}
      />
    </View>
  );
}

/** La hoja «Nuevo lugar» / «Editar lugar»: nombre, ícono (ocho) y dirección con su punto exacto. */
function HojaLugar({
  editar,
  nombreInicial,
  iconoInicial,
  cerca,
  cerrar,
  guardar,
}: {
  editar: LugarGuardado | null;
  nombreInicial: string;
  iconoInicial: string;
  cerca: Punto | null;
  cerrar: () => void;
  guardar: (d: LugarAGuardar) => Promise<void>;
}) {
  const { idioma, usuario } = useSesion();
  const t = textosLugares(idioma);
  // Regla «ningún formulario pierde lo escrito»: cada lugar (o el nuevo) tiene su borrador.
  const b = useBorrador({
    formulario: `lugar-${editar?.id ?? 'nuevo'}`,
    cuenta: usuario?.id,
    inicial: {
      nombre: editar?.etiqueta ?? nombreInicial,
      icono: editar?.icono || iconoInicial,
      direccion: editar?.direccion ?? '',
      lat: editar?.lat != null ? String(editar.lat) : '',
      lng: editar?.lng != null ? String(editar.lng) : '',
      referencia: editar?.referencia ?? '',
      apto: editar?.apto ?? '',
    },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const { valores: v, cambiar } = b;
  const [marcando, setMarcando] = useState(false);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const listo = puedeGuardarLugar({
    nombre: v.nombre,
    direccion: v.direccion,
    lat: v.lat ? Number(v.lat) : null,
  });
  async function enviar() {
    if (!listo) return;
    setTrabajando(true);
    setError('');
    try {
      await guardar({
        etiqueta: v.nombre.trim(),
        icono: v.icono,
        direccion: v.direccion,
        lat: Number(v.lat),
        lng: Number(v.lng),
        referencia: v.referencia,
        apto: v.apto,
      });
      // Lo escrito se borra solo después de que el servidor confirmó.
      await b.limpiar();
    } catch (x) {
      setError(x instanceof Error && x.message ? x.message : t.noSeGuardo);
    } finally {
      setTrabajando(false);
    }
  }
  return (
    <>
      <HojaAbajo
        visible={!marcando}
        alCerrar={cerrar}
        titulo={editar ? t.editarLugar : t.nuevoLugar}
        testID="hoja-lugar"
      >
        <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
        <Text style={{ fontWeight: '700', color: C.secundario, marginBottom: 6 }}>{t.nombre}</Text>
        <TextInput
          value={v.nombre}
          onChangeText={(x) => cambiar('nombre', x)}
          placeholder={t.nombreEj}
          placeholderTextColor={COLOR.textoSuave}
          maxLength={30}
          accessibilityLabel={t.nombre}
          testID="lugar-nombre"
          style={{
            borderWidth: 1,
            borderColor: COLOR.borde,
            borderRadius: 12,
            paddingHorizontal: 14,
            minHeight: 50,
            fontSize: 16,
            color: C.secundario,
          }}
        />
        <Text style={{ fontWeight: '700', color: C.secundario, marginTop: 16, marginBottom: 6 }}>
          {t.icono}
        </Text>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
          accessibilityRole="radiogroup"
        >
          {ICONOS_LUGAR.map((x) => {
            const activo = v.icono === x;
            return (
              <Pressable
                key={x}
                onPress={() => cambiar('icono', x)}
                accessibilityRole="radio"
                accessibilityState={{ checked: activo }}
                accessibilityLabel={new Map(Object.entries(t.iconos)).get(x) ?? x}
                testID={`lugar-icono-${x}`}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: activo ? C.secundario : COLOR.borde,
                  backgroundColor: activo ? C.secundario : '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icono nombre={ico(x)} tamano={20} color={activo ? '#FFFFFF' : C.secundario} />
              </Pressable>
            );
          })}
        </View>
        <Text style={{ fontWeight: '700', color: C.secundario, marginTop: 16, marginBottom: 6 }}>
          {t.direccion}
        </Text>
        <Pressable
          onPress={() => setMarcando(true)}
          accessibilityRole="button"
          testID="lugar-direccion"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: COLOR.borde,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Icono nombre="location-outline" tamano={20} color={v.direccion ? C.exito : C.acento} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: v.direccion ? C.secundario : C.acento }}>
              {v.direccion || t.buscarDireccion}
            </Text>
            {v.referencia ? (
              <Text style={{ color: COLOR.textoSuave, fontSize: 13 }}>{v.referencia}</Text>
            ) : null}
          </View>
          <Icono nombre="chevron-forward" tamano={18} color={COLOR.textoSuave} />
        </Pressable>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{ color: C.acento, fontWeight: '700', marginTop: 10 }}
          >
            {error}
          </Text>
        ) : null}
        <View style={{ marginTop: 16 }}>
          <BotonGrande
            texto={t.guardar}
            alTocar={() => void enviar()}
            apagado={!listo}
            cargando={trabajando}
            testID="lugar-guardar"
          />
        </View>
        <Text style={{ color: COLOR.textoSuave, fontSize: 13, textAlign: 'center', marginTop: 10 }}>
          {t.unaLista}
        </Text>
      </HojaAbajo>
      <Modal
        visible={marcando}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMarcando(false)}
        testID="lugar-punto-exacto"
      >
        {marcando ? (
          <PuntoExacto
            tipo="entrega"
            inicial={{
              punto: v.lat ? { lat: Number(v.lat), lng: Number(v.lng) } : null,
              direccion: v.direccion,
              referencia: v.referencia,
              apto: v.apto,
            }}
            cerca={cerca}
            volver={() => setMarcando(false)}
            confirmar={(p) => {
              cambiar('lat', String(p.punto.lat));
              cambiar('lng', String(p.punto.lng));
              if (p.direccion) cambiar('direccion', p.direccion);
              cambiar('referencia', p.referencia);
              cambiar('apto', p.apto);
              setMarcando(false);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

/** Editar o borrar un lugar: borrar va dentro de los tres puntos y pide confirmación. */
function OpcionesLugar({
  fila,
  cerrar,
  editar,
  borrar,
}: {
  fila: FilaLugar | null;
  cerrar: () => void;
  editar: () => void;
  borrar: () => Promise<void>;
}) {
  const { idioma } = useSesion();
  const t = textosLugares(idioma);
  const [menu, setMenu] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const salir = () => {
    setMenu(false);
    setConfirmar(false);
    setFallo(false);
    cerrar();
  };
  return (
    <HojaAbajo visible={fila != null} alCerrar={salir} testID="hoja-opciones-lugar">
      {fila ? (
        confirmar ? (
          <View style={{ gap: 12 }} testID="confirmar-borrar-lugar">
            <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700' }}>
              {t.confirmarBorrar(fila.nombre)}
            </Text>
            <Text style={{ color: COLOR.textoSuave }}>{t.confirmarTexto}</Text>
            {fallo ? (
              <Text accessibilityRole="alert" style={{ color: C.acento, fontWeight: '700' }}>
                {t.noSeBorro}
              </Text>
            ) : null}
            <BotonGrande
              texto={t.borrar}
              cargando={borrando}
              alTocar={() => {
                setBorrando(true);
                setFallo(false);
                borrar()
                  .then(salir)
                  .catch((e: unknown) => {
                    console.warn('lugares: no se pudo borrar', e);
                    setFallo(true);
                  })
                  .finally(() => setBorrando(false));
              }}
              testID="borrar-lugar-si"
            />
            <Boton texto={t.cancelar} alTocar={() => setConfirmar(false)} secundario />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: COLOR.superficie,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icono nombre={ico(fila.icono)} tamano={20} color={C.secundario} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 18 }}>{fila.nombre}</Text>
                <Text numberOfLines={1} style={{ color: COLOR.textoSuave }}>
                  {fila.lugar?.direccion || t.sinDireccion}
                </Text>
              </View>
              <Pressable
                onPress={() => setMenu((m) => !m)}
                accessibilityRole="button"
                accessibilityLabel={t.masOpciones}
                hitSlop={10}
                testID="lugar-tres-puntos"
              >
                <Icono nombre="ellipsis-vertical" tamano={22} color={C.secundario} />
              </Pressable>
            </View>
            {menu ? (
              <Pressable
                onPress={() => setConfirmar(true)}
                accessibilityRole="button"
                testID="borrar-lugar"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  borderWidth: 1,
                  borderColor: COLOR.borde,
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <Icono nombre="trash-outline" tamano={20} color={C.acento} />
                <Text style={{ color: C.acento, fontWeight: '700' }}>{t.borrarLugar}</Text>
              </Pressable>
            ) : null}
            <Boton texto={t.editar} alTocar={editar} secundario testID="editar-lugar" />
          </View>
        )
      ) : null}
    </HojaAbajo>
  );
}
