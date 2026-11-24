import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import {
  type Api,
  ErrorApi,
  IDIOMAS_PERFIL,
  type Idioma,
  type IdiomaPerfil,
  MAX_DATO_PERFIL,
  type PerfilConductorPublico,
  TEXTOS_PERFIL_CONDUCTOR,
  enIdioma,
  idiomasValidos,
  nombreIdiomaPerfil,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  COLOR,
  Campo,
  ESPACIO,
  Icono,
  InicialConductor,
  PerfilConductor,
  RADIO,
  Text,
  alSalirTelefono,
  almacenTelefono,
  useFotoPrivada,
  useSesion,
} from '@tumbite/movil';

const TAMANO_FOTO = 128;

/** Su propia foto verificada (la que ve el pasajero); sin foto o si no carga, su inicial. */
function FotoPropia({ hay, nombre }: { hay: boolean; nombre: string }) {
  // C-FOTO-CONDUCTOR-SE-VE: con la sesión por api.verFoto (nunca <Image headers>).
  const uri = useFotoPrivada(hay ? '/datos/repartidor/perfil/foto' : null);
  if (!uri) return <InicialConductor nombre={nombre} tamano={TAMANO_FOTO - 16} />;
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

const INICIAL = { idiomas: '', dato: '' };

/**
 * C-PERFIL-CONDUCTOR (20 nov 2026, todos los países): «Así te ven los pasajeros». El conductor ve
 * su perfil exactamente como lo verá el pasajero (variante oscura del borrador aprobado) y lo
 * completa con los idiomas que habla y un dato corto. El formulario nunca pierde lo escrito
 * (useBorrador): si la app se cierra a mitad, al volver se abre el formulario con lo que tenía.
 */
export function AsiTeVen({ api, idioma }: { api: Api; idioma: Idioma }) {
  const { usuario } = useSesion();
  const t = enIdioma(TEXTOS_PERFIL_CONDUCTOR, idioma);
  const [perfil, setPerfil] = useState<PerfilConductorPublico | null>(null);
  const [fallo, setFallo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const b = useBorrador({
    formulario: 'perfil-conductor',
    cuenta: usuario?.id,
    inicial: INICIAL,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const { cargarBase } = b;

  const cargar = useCallback(() => {
    api
      .pedir<{ perfil: PerfilConductorPublico }>('GET', '/datos/repartidor/perfil')
      .then((r) => {
        setPerfil(r.perfil);
        cargarBase({ idiomas: r.perfil.idiomas.join(','), dato: r.perfil.dato ?? '' });
      })
      .catch(() => setFallo(true));
  }, [api, cargarBase]);
  useEffect(cargar, [cargar]);
  // Lo que dejó a medio escribir: el formulario se abre solo, con todo en su sitio.
  const enEditor = editando || b.recuperado;

  const elegidos = idiomasValidos(b.valores.idiomas.split(','));
  function alternar(i: IdiomaPerfil) {
    const s = new Set(elegidos);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    b.cambiar('idiomas', idiomasValidos([...s]).join(','));
  }

  async function guardar() {
    setError(null);
    setAviso('');
    setGuardando(true);
    try {
      const r = await api.pedir<{ perfil: PerfilConductorPublico }>(
        'PUT',
        '/datos/repartidor/perfil',
        { idiomas: elegidos, dato: b.valores.dato },
      );
      setPerfil(r.perfil);
      b.cargar({ idiomas: r.perfil.idiomas.join(','), dato: r.perfil.dato ?? '' });
      setEditando(false);
      setAviso(t.guardado);
    } catch (x) {
      // Lo escrito se queda en pantalla (y en el borrador) para reintentar.
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    } finally {
      setGuardando(false);
    }
  }

  if (!perfil)
    return (
      <View testID="asi-te-ven-cargando" style={{ padding: ESPACIO.l, gap: ESPACIO.m }}>
        <Text style={{ color: COLOR.textoSuave }}>{fallo ? t.sinConexion : t.cargando}</Text>
        {fallo ? (
          <Boton
            texto={t.reintentar}
            alTocar={() => {
              setFallo(false);
              cargar();
            }}
            secundario
          />
        ) : null}
      </View>
    );

  if (enEditor) {
    const quedan = MAX_DATO_PERFIL - b.valores.dato.length;
    return (
      <View testID="perfil-editar" style={{ padding: ESPACIO.l, gap: ESPACIO.m }}>
        <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '700', color: COLOR.texto }}>
            {t.preguntaIdiomas}
          </Text>
          <Text style={{ color: COLOR.textoSuave }}>{t.ayudaIdiomas}</Text>
        </View>
        <View style={{ gap: ESPACIO.s }}>
          {IDIOMAS_PERFIL.map((i) => {
            const si = elegidos.includes(i);
            return (
              <Pressable
                key={i}
                testID={`perfil-idioma-${i}`}
                onPress={() => alternar(i)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: si }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 52,
                  paddingHorizontal: ESPACIO.l,
                  borderRadius: RADIO.m,
                  borderWidth: si ? 2 : 1,
                  borderColor: si ? COLOR.negro : COLOR.bordeFuerte,
                  backgroundColor: COLOR.blanco,
                }}
              >
                <Text style={{ fontWeight: '600', color: COLOR.texto, fontSize: 16 }}>
                  {nombreIdiomaPerfil(i, idioma)}
                </Text>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: si ? 0 : 2,
                    borderColor: COLOR.bordeFuerte,
                    backgroundColor: si ? COLOR.negro : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {si ? <Icono nombre="checkmark" tamano={16} color="#FFFFFF" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ gap: 4, marginTop: ESPACIO.s }}>
          <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '700', color: COLOR.texto }}>
            {t.preguntaDato}
          </Text>
          <Text style={{ color: COLOR.textoSuave }}>{t.ayudaDato}</Text>
        </View>
        <Campo
          testID="perfil-dato"
          etiqueta={t.etiquetaDato}
          value={b.valores.dato}
          onChangeText={(x) => b.cambiar('dato', x.replace(/\n/g, ' ').slice(0, MAX_DATO_PERFIL))}
          placeholder={t.ejemploDato}
          maxLength={MAX_DATO_PERFIL}
          multiline
          error={error?.campo === 'dato' ? error.mensaje : undefined}
        />
        <Text style={{ color: COLOR.textoTenue, fontSize: 12, marginTop: -6, textAlign: 'right' }}>
          {t.quedan(quedan)}
        </Text>
        {error && error.campo !== 'dato' ? (
          <Text style={{ color: COLOR.error }} accessibilityRole="alert">
            {error.mensaje}
          </Text>
        ) : null}
        <Boton
          testID="perfil-guardar"
          texto={t.guardar}
          alTocar={() => void guardar()}
          cargando={guardando}
        />
        <Boton
          testID="perfil-volver"
          texto={t.volver}
          alTocar={() => {
            void b.empezarDeNuevo();
            setError(null);
            setEditando(false);
          }}
          secundario
        />
        <Text style={{ color: COLOR.textoSuave, fontSize: 13 }}>{t.privado}</Text>
      </View>
    );
  }

  return (
    <View testID="asi-te-ven">
      <PerfilConductor
        testID="asi-te-ven-perfil"
        perfil={perfil}
        idioma={idioma}
        propio
        cabecera={t.asiTeVen}
        tamanoFoto={TAMANO_FOTO}
        foto={<FotoPropia hay={perfil.foto} nombre={perfil.nombre || t.tuNombre} />}
      />
      <View style={{ padding: ESPACIO.l, gap: ESPACIO.s }}>
        {aviso ? (
          <Text testID="perfil-guardado" style={{ color: COLOR.exito, fontWeight: '600' }}>
            {aviso}
          </Text>
        ) : null}
        <Boton
          testID="perfil-completar"
          texto={t.completar}
          alTocar={() => {
            setAviso('');
            setEditando(true);
          }}
        />
        <Text style={{ color: COLOR.textoSuave, fontSize: 13 }}>{t.privado}</Text>
      </View>
    </View>
  );
}
