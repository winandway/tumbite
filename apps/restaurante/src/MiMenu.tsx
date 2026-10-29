import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ErrorApi,
  type Plato,
  categoriaPlato,
  formatearMonto,
  montoATexto,
  montoEscrito,
  nombrePlato,
  useBorrador,
  ETIQUETAS_DIETA,
  nombreEtiquetaDieta,
  leerEtiquetasDieta,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  C,
  Campo,
  alSalirTelefono,
  almacenTelefono,
  e,
  urlFoto,
  useSesion,
} from '@tumbite/movil';
import { IMG } from './piezas/recursos';
import { BotonGrande, Insignia, Pildora, Tarjeta } from './piezas/ui';
import { textosRest } from './piezas/textos';

function confirmar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, style: 'destructive', onPress: () => r(true) },
    ]),
  );
}

/**
 * Mi menú (diseño aprobado, pantallas 5 y 6). Usa las MISMAS rutas del panel web: leer, crear,
 * editar, disponible / agotado y borrar (dentro de los tres puntos, con confirmación). Los tamaños
 * y extras se siguen editando en el panel; al editar aquí no se tocan.
 */
/** C-MONEDA-RECORRIDO: los precios del menú se escriben y se muestran en la moneda del restaurante. */
export function MiMenu({
  platos,
  recargar,
  moneda = 'USD',
}: {
  platos: Plato[];
  recargar: () => Promise<void>;
  moneda?: string;
}) {
  const { api, idioma } = useSesion();
  const t = textosRest(idioma);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [editando, setEditando] = useState<Plato | 'nuevo' | null>(null);
  const [menuDe, setMenuDe] = useState<string | null>(null);
  const [error, setError] = useState('');
  const categorias = useMemo(
    () => [...new Set(platos.map((p) => p.categoria).filter(Boolean))],
    [platos],
  );
  const visibles = platos.filter((p) => categoria === null || p.categoria === categoria);

  async function hacer(f: () => Promise<unknown>) {
    setError('');
    setMenuDe(null);
    try {
      await f();
      await recargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (editando) {
    return (
      <FormPlato
        key={editando === 'nuevo' ? 'nuevo' : editando.id}
        plato={editando === 'nuevo' ? null : editando}
        cerrar={() => setEditando(null)}
        recargar={recargar}
        moneda={moneda}
      />
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}
        >
          {t.miMenu}
        </Text>
        <Pressable
          onPress={() => setEditando('nuevo')}
          accessibilityRole="button"
          accessibilityLabel={t.anadirProducto}
          style={{
            backgroundColor: C.primario,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>+ {t.anadir}</Text>
        </Pressable>
      </View>
      {categorias.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
          <Pildora
            texto={t.filtros.todos}
            activa={categoria === null}
            alTocar={() => setCategoria(null)}
          />
          {categorias.map((c) => (
            <Pildora
              key={c}
              texto={categoriaPlato(
                platos.find((p) => p.categoria === c) ?? { categoria: c, categoriaEn: '' },
                idioma,
              )}
              activa={categoria === c}
              alTocar={() => setCategoria(c)}
            />
          ))}
        </View>
      ) : (
        <View style={{ height: 12 }} />
      )}
      {error ? <Text style={e.error}>{error}</Text> : null}
      {platos.length === 0 ? <Text style={e.tarjeta}>{t.sinPlatos}</Text> : null}
      {visibles.map((p) => {
        const foto = urlFoto(p.imagen);
        return (
          <Tarjeta
            key={p.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}
          >
            <Pressable
              onPress={() => setEditando(p)}
              accessibilityRole="button"
              accessibilityLabel={`${t.editar}: ${nombrePlato(p, idioma)}`}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              {foto ? (
                <Image
                  source={{ uri: foto }}
                  style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: '#f1f1f1' }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: '#F2F3F5' }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>
                  {nombrePlato(p, idioma)}
                </Text>
                <Text style={{ fontWeight: '700', color: C.secundario, marginTop: 2 }}>
                  {formatearMonto(p.precioCentavos, moneda, idioma)}
                </Text>
              </View>
              <Insignia
                estado={p.disponible ? 'activo' : 'agotado'}
                texto={p.disponible ? t.activo : t.agotado}
              />
            </Pressable>
            <View>
              <Pressable
                onPress={() => setMenuDe(menuDe === p.id ? null : p.id)}
                accessibilityRole="button"
                accessibilityLabel={`${t.masOpciones}: ${nombrePlato(p, idioma)}`}
                hitSlop={8}
                style={{ padding: 6 }}
              >
                <Text style={{ fontSize: 22, color: C.secundario }}>⋮</Text>
              </Pressable>
            </View>
            {menuDe === p.id ? (
              <View
                style={{
                  position: 'absolute',
                  right: 40,
                  top: 8,
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E5E5E5',
                  paddingVertical: 4,
                  zIndex: 10,
                }}
              >
                {[
                  [t.editar, () => setEditando(p)],
                  [
                    p.disponible ? t.marcarAgotado : t.marcarDisponible,
                    () =>
                      void hacer(() =>
                        api.pedir('PATCH', `/datos/mi-restaurante/platos/${p.id}/disponible`, {
                          disponible: !p.disponible,
                        }),
                      ),
                  ],
                  [
                    t.eliminar,
                    () =>
                      void (async () => {
                        setMenuDe(null);
                        if (
                          await confirmar(
                            t.confirmarEliminar.replace('{plato}', nombrePlato(p, idioma)),
                            t.siEliminar,
                            t.no,
                          )
                        )
                          await hacer(() =>
                            api.pedir('DELETE', `/datos/mi-restaurante/platos/${p.id}`),
                          );
                      })(),
                  ],
                ].map(([texto, accion]) => (
                  <Pressable
                    key={texto as string}
                    onPress={accion as () => void}
                    accessibilityRole="button"
                    style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                  >
                    <Text
                      style={{
                        fontWeight: '700',
                        color: texto === t.eliminar ? '#B3261E' : C.secundario,
                      }}
                    >
                      {texto as string}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Tarjeta>
        );
      })}
    </View>
  );
}

const VACIO = {
  nombreEs: '',
  nombreEn: '',
  descripcionEs: '',
  descripcionEn: '',
  categoria: '',
  categoriaEn: '',
  precio: '',
  imagen: '',
  disponible: 'si',
  /** C-FILTROS-DIETA: marcas separadas por coma («vegano,halal»). */
  etiquetas: '',
};

/** Añadir / Editar producto. Lo escrito se guarda solo y vuelve si la app se cierra. */
function FormPlato({
  plato,
  cerrar,
  recargar,
  moneda,
}: {
  plato: Plato | null;
  cerrar: () => void;
  recargar: () => Promise<void>;
  moneda: string;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = textosRest(idioma);
  // En dólares, los textos de siempre; con otra moneda, su código y un ejemplo en su unidad.
  const etiquetaPrecio = moneda === 'USD' ? t.precio : t.precioMoneda.replace('{m}', moneda);
  const precioMal =
    moneda === 'USD'
      ? t.precioMal
      : t.precioMalMoneda.replace('{m}', moneda).replace('{ej}', montoATexto(35000, moneda));
  const b = useBorrador({
    formulario: `app-plato-${plato?.id ?? 'nuevo'}`,
    cuenta: usuario?.id,
    inicial: VACIO,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const v = b.valores;
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const { cargarBase } = b;
  useEffect(() => {
    if (!plato) return;
    cargarBase({
      nombreEs: plato.nombreEs,
      nombreEn: plato.nombreEn,
      descripcionEs: plato.descripcionEs,
      descripcionEn: plato.descripcionEn,
      categoria: plato.categoria,
      categoriaEn: plato.categoriaEn,
      precio: montoATexto(plato.precioCentavos, moneda),
      imagen: plato.imagen ?? '',
      disponible: plato.disponible ? 'si' : 'no',
      etiquetas: (plato.etiquetas ?? []).join(','),
    });
  }, [plato, cargarBase, moneda]);

  async function elegirFoto() {
    setError('');
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsEditing: true,
        aspect: [4, 3],
      });
      const foto = r.canceled ? null : r.assets[0];
      if (!foto) return;
      setSubiendo(true);
      const blob = await (await fetch(foto.uri)).blob();
      const { url } = await api.subirFoto(blob);
      b.cambiar('imagen', url);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar() {
    setError('');
    const precioCentavos = montoEscrito(v.precio, moneda);
    if (precioCentavos === null) return setError(precioMal);
    const cuerpo = {
      nombreEs: v.nombreEs,
      nombreEn: v.nombreEn,
      descripcionEs: v.descripcionEs,
      descripcionEn: v.descripcionEn,
      categoria: v.categoria,
      categoriaEn: v.categoriaEn,
      precioCentavos,
      imagen: v.imagen || null,
      requiereEdad: plato?.requiereEdad ?? false,
      etiquetas: leerEtiquetasDieta(v.etiquetas),
    };
    setGuardando(true);
    try {
      const r = plato
        ? await api.pedir<{ plato: Plato }>(
            'PUT',
            `/datos/mi-restaurante/platos/${plato.id}`,
            cuerpo,
          )
        : await api.pedir<{ plato: Plato }>('POST', '/datos/mi-restaurante/platos', cuerpo);
      const quiere = v.disponible !== 'no';
      if (r.plato.disponible !== quiere)
        await api.pedir('PATCH', `/datos/mi-restaurante/platos/${r.plato.id}/disponible`, {
          disponible: quiere,
        });
      // Guardado con éxito: el borrador ya no hace falta.
      await b.limpiar();
      await recargar();
      cerrar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setGuardando(false);
    }
  }

  const foto = urlFoto(v.imagen || null);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Pressable
          onPress={cerrar}
          accessibilityRole="button"
          accessibilityLabel={t.volver}
          hitSlop={8}
          style={{ width: 36 }}
        >
          <Text style={{ fontSize: 28, lineHeight: 30, color: C.secundario }}>‹</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 20, fontWeight: '900', color: C.secundario }}
        >
          {plato ? t.editarProducto : t.anadirProducto}
        </Text>
        <Pressable
          onPress={() => void guardar()}
          disabled={guardando}
          accessibilityRole="button"
          accessibilityLabel={t.guardar}
          style={{
            backgroundColor: C.primario,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>{t.guardar}</Text>
        </Pressable>
      </View>
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        {foto ? (
          <Image
            source={{ uri: foto }}
            style={{ width: 130, height: 100, borderRadius: 14, backgroundColor: '#f1f1f1' }}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Pressable
          onPress={() => void elegirFoto()}
          disabled={subiendo}
          accessibilityRole="button"
          accessibilityLabel={foto ? t.cambiarFoto : t.anadirFoto}
          style={{
            flex: 1,
            height: 100,
            borderRadius: 14,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: '#C9C9C9',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Image
            source={IMG.iconoCamara}
            style={{ width: 28, height: 28, tintColor: '#5E5E5E' }}
            accessibilityIgnoresInvertColors
          />
          <Text style={{ color: '#5E5E5E', fontWeight: '700' }}>
            {subiendo ? t.subiendo : foto ? t.cambiarFoto : t.anadirFoto}
          </Text>
        </Pressable>
      </View>
      <Campo
        etiqueta={t.nombreEs}
        value={v.nombreEs}
        onChangeText={(x) => b.cambiar('nombreEs', x)}
        placeholder={t.nombreEs}
      />
      <Campo
        etiqueta={t.nombreEn}
        value={v.nombreEn}
        onChangeText={(x) => b.cambiar('nombreEn', x)}
        placeholder={t.nombreEn}
      />
      <Campo
        etiqueta={t.descEs}
        value={v.descripcionEs}
        onChangeText={(x) => b.cambiar('descripcionEs', x)}
        placeholder={t.descEs}
        multiline
      />
      <Campo
        etiqueta={t.descEn}
        value={v.descripcionEn}
        onChangeText={(x) => b.cambiar('descripcionEn', x)}
        placeholder={t.descEn}
        multiline
      />
      <Campo
        etiqueta={etiquetaPrecio}
        value={v.precio}
        onChangeText={(x) => b.cambiar('precio', x)}
        keyboardType="decimal-pad"
        placeholder={montoATexto(0, moneda)}
      />
      <Campo
        etiqueta={t.categoria}
        value={v.categoria}
        onChangeText={(x) => b.cambiar('categoria', x)}
        placeholder={t.categoria}
      />
      <Campo
        etiqueta={t.categoriaEn}
        value={v.categoriaEn}
        onChangeText={(x) => b.cambiar('categoriaEn', x)}
        placeholder={t.categoriaEn}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginVertical: 8,
        }}
      >
        <Text style={{ fontWeight: '800', color: C.secundario }}>{t.disponible}</Text>
        <Switch
          value={v.disponible !== 'no'}
          onValueChange={(x) => b.cambiar('disponible', x ? 'si' : 'no')}
          accessibilityLabel={t.disponible}
          trackColor={{ true: C.exito, false: '#D6D6D6' }}
        />
      </View>
      <Text style={{ fontWeight: '800', color: C.secundario, marginTop: 4 }}>{t.marcasDieta}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }}>
        {ETIQUETAS_DIETA.map((m) => {
          const marcadas = leerEtiquetasDieta(v.etiquetas);
          const activa = marcadas.includes(m);
          return (
            <Pildora
              key={m}
              texto={nombreEtiquetaDieta(m, idioma)}
              activa={activa}
              alTocar={() =>
                b.cambiar(
                  'etiquetas',
                  (activa ? marcadas.filter((x) => x !== m) : [...marcadas, m]).join(','),
                )
              }
            />
          );
        })}
      </View>
      <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 6 }}>{t.opcionesPanel}</Text>
      {error ? (
        <Text style={e.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <BotonGrande texto={t.guardar} alTocar={() => void guardar()} desactivado={guardando} />
    </View>
  );
}
