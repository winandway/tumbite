import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
// El saldo y los movimientos son de Stripe, que hoy solo cobra en dólares (C-MONEDA-RECORRIDO).
import {
  ErrorApi,
  correoEjemplo,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  C,
  Campo,
  CampoClave,
  MisCasos,
  selectorDeCapturas,
  OpcionesCuenta,
  ReportarProblema,
  URL_SERVIDOR,
  alSalirTelefono,
  almacenTelefono,
  e,
  useSesion,
  abrirPanel,
  capturasConCamara,
} from '@tumbite/movil';
import { BotonGrande, Tarjeta } from './piezas/ui';

/** C-CAMARA-EN-TODA-SUBIDA: la cámara del teléfono, para la pieza común «Tomar foto». */
const CAMARA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 }),
};

/**
 * C-MAS-EN-LA-APP (31 oct 2026, visto por Richard grabando el video para Apple): «Mi restaurante»,
 * «Ganancias», «Equipo» y «Configuración» se abren DENTRO de la app, como en DoorDash Merchant (antes
 * mandaban a la web). Solo lo que de verdad vive afuera se abre afuera: el alta de cobros en Stripe.
 * Todo formulario guarda lo escrito (borrador) y nunca guarda contraseñas.
 */
export type PantallaMasApp = 'restaurante' | 'ganancias' | 'equipo' | 'configuracion';

const T = {
  es: {
    guardar: 'Guardar',
    volver: 'Más',
    guardado: 'Guardado.',
    restaurante: 'Mi restaurante',
    nombre: 'Nombre del restaurante',
    telefono: 'Teléfono',
    descripcionEs: 'Descripción en español',
    descripcionEn: 'Descripción en inglés',
    prep: 'Minutos de preparación',
    direccion: 'Dirección',
    direccionAyuda:
      'Para cambiar la dirección escríbenos a soporte: se vuelve a verificar el local.',
    ganancias: 'Ganancias',
    saldo: 'Saldo disponible',
    movimientos: 'Movimientos',
    vacio: 'Todavía no hay movimientos.',
    cobros: 'Configurar cobros en Stripe',
    cobrosAyuda: 'El alta y los retiros los maneja Stripe, en su página segura.',
    equipo: 'Equipo',
    correo: 'Correo del miembro',
    correoAyuda: 'Tiene que tener ya una cuenta de restaurante en Divoox.',
    rol: 'Rol',
    roles: { dueno: 'Dueño', manager: 'Manager', staff: 'Staff' } as Record<string, string>,
    agregar: 'Agregar al equipo',
    quitar: 'Quitar del equipo',
    quitarSeguro: '¿Quitar a esta persona del equipo?',
    cancelar: 'Cancelar',
    mas: 'Más opciones',
    configuracion: 'Configuración',
    tuNombre: 'Tu nombre',
    tuTelefono: 'Tu celular',
    clave: 'Cambiar la contraseña',
    actual: 'Contraseña actual',
    nueva: 'Contraseña nueva',
    claveCambiada: 'Contraseña cambiada.',
  },
  en: {
    guardar: 'Save',
    volver: 'More',
    guardado: 'Saved.',
    restaurante: 'My restaurant',
    nombre: 'Restaurant name',
    telefono: 'Phone',
    descripcionEs: 'Description in Spanish',
    descripcionEn: 'Description in English',
    prep: 'Prep time (minutes)',
    direccion: 'Address',
    direccionAyuda: 'To change the address, contact support: the location is verified again.',
    ganancias: 'Earnings',
    saldo: 'Available balance',
    movimientos: 'Activity',
    vacio: 'No activity yet.',
    cobros: 'Set up payouts with Stripe',
    cobrosAyuda: 'Stripe handles payout setup and withdrawals on its secure page.',
    equipo: 'Team',
    correo: 'Member email',
    correoAyuda: 'They need an existing Divoox restaurant account.',
    rol: 'Role',
    roles: { dueno: 'Owner', manager: 'Manager', staff: 'Staff' } as Record<string, string>,
    agregar: 'Add to team',
    quitar: 'Remove from team',
    quitarSeguro: 'Remove this person from the team?',
    cancelar: 'Cancel',
    mas: 'More options',
    configuracion: 'Settings',
    tuNombre: 'Your name',
    tuTelefono: 'Your mobile number',
    clave: 'Change password',
    actual: 'Current password',
    nueva: 'New password',
    claveCambiada: 'Password changed.',
  },
};
type Textos = (typeof T)['es'];

function Titulo({ texto }: { texto: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ fontSize: 22, fontWeight: '800', color: C.secundario, marginBottom: 10 }}
    >
      {texto}
    </Text>
  );
}

function Mensajes({ error, aviso }: { error: string; aviso: string }) {
  return (
    <>
      {error ? (
        <Text style={e.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {aviso ? <Text style={{ color: C.exito, fontWeight: '700' }}>{aviso}</Text> : null}
    </>
  );
}

export function PantallaMas({
  pantalla,
  alVolver,
}: {
  pantalla: PantallaMasApp;
  alVolver: () => void;
}) {
  const { idioma } = useSesion();
  const t = enIdioma(T, idioma);
  return (
    <View>
      <Pressable
        onPress={alVolver}
        accessibilityRole="button"
        style={{ paddingVertical: 8, marginBottom: 4 }}
        testID="mas-volver"
      >
        <Text style={{ color: C.secundario, fontWeight: '700' }}>‹ {t.volver}</Text>
      </Pressable>
      {pantalla === 'restaurante' ? (
        <MiRestauranteApp t={t} />
      ) : pantalla === 'ganancias' ? (
        <Ganancias t={t} />
      ) : pantalla === 'equipo' ? (
        <Equipo t={t} />
      ) : (
        <Configuracion t={t} />
      )}
    </View>
  );
}

type Rest = {
  nombre: string;
  categoria: string;
  telefono: string;
  direccion: string;
  descripcionEs: string;
  descripcionEn: string;
  tiempoPrepMin: number;
  lat: number | null;
  lng: number | null;
  imagen: string | null;
};
const INICIAL_REST = {
  nombre: '',
  telefono: '',
  descripcionEs: '',
  descripcionEn: '',
  tiempoPrepMin: '',
};
const aFormulario = (x: Rest) => ({
  nombre: x.nombre,
  telefono: x.telefono,
  descripcionEs: x.descripcionEs,
  descripcionEn: x.descripcionEn,
  tiempoPrepMin: String(x.tiempoPrepMin),
});

function MiRestauranteApp({ t }: { t: Textos }) {
  const { api, usuario, idioma } = useSesion();
  const [rest, setRest] = useState<Rest | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: 'app-mi-restaurante',
    cuenta: usuario?.id,
    inicial: INICIAL_REST,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const { cargarBase } = b;
  useEffect(() => {
    api
      .pedir<{ restaurante: Rest | null }>('GET', '/datos/mi-restaurante')
      .then((r) => {
        setRest(r.restaurante);
        if (r.restaurante) cargarBase(aFormulario(r.restaurante));
      })
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api, cargarBase]);
  const v = b.valores;
  async function guardar() {
    if (!rest) return;
    setError('');
    setAviso('');
    try {
      const r = await api.pedir<{ restaurante: Rest }>('PUT', '/datos/mi-restaurante', {
        ...rest,
        nombre: v.nombre,
        telefono: v.telefono,
        descripcionEs: v.descripcionEs,
        descripcionEn: v.descripcionEn,
        tiempoPrepMin: Number(v.tiempoPrepMin) || 20,
      });
      setRest(r.restaurante);
      b.cargar(aFormulario(r.restaurante));
      setAviso(t.guardado);
    } catch (x) {
      // Lo escrito se queda en pantalla si falla (regla de formularios).
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <View testID="app-mi-restaurante">
      <Titulo texto={t.restaurante} />
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <Mensajes error={error} aviso={aviso} />
      {rest ? (
        <Tarjeta>
          <Campo
            etiqueta={t.nombre}
            value={v.nombre}
            onChangeText={(x) => b.cambiar('nombre', x)}
          />
          <Campo
            etiqueta={t.telefono}
            value={v.telefono}
            keyboardType="phone-pad"
            onChangeText={(x) => b.cambiar('telefono', x)}
          />
          <Campo
            etiqueta={t.descripcionEs}
            value={v.descripcionEs}
            multiline
            onChangeText={(x) => b.cambiar('descripcionEs', x)}
          />
          <Campo
            etiqueta={t.descripcionEn}
            value={v.descripcionEn}
            multiline
            onChangeText={(x) => b.cambiar('descripcionEn', x)}
          />
          <Campo
            etiqueta={t.prep}
            value={v.tiempoPrepMin}
            keyboardType="number-pad"
            onChangeText={(x) => b.cambiar('tiempoPrepMin', x.replace(/\D/g, ''))}
          />
          <Text style={e.etiqueta}>{t.direccion}</Text>
          <Text style={{ color: C.secundario }}>{rest.direccion}</Text>
          <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 10 }}>
            {t.direccionAyuda}
          </Text>
          <BotonGrande texto={t.guardar} alTocar={() => void guardar()} />
        </Tarjeta>
      ) : null}
    </View>
  );
}

type Mov = { id: string; monto: number; concepto: string; fecha: string };

function Ganancias({ t }: { t: Textos }) {
  const { api, idioma } = useSesion();
  const [d, setD] = useState<{ saldo: number; movimientos: Mov[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .pedir<{ saldo: number; movimientos: Mov[] }>('GET', '/datos/billetera')
      .then(setD)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  return (
    <View testID="app-ganancias">
      <Titulo texto={t.ganancias} />
      <Mensajes error={error} aviso="" />
      {d ? (
        <>
          <Tarjeta>
            <Text style={{ color: '#5E5E5E' }}>{t.saldo}</Text>
            <Text style={{ fontSize: 30, fontWeight: '800', color: C.exito }}>
              {formatearMonto(d.saldo, 'USD', idioma)}
            </Text>
          </Tarjeta>
          <Tarjeta>
            <Text style={{ fontWeight: '800', color: C.secundario, marginBottom: 6 }}>
              {t.movimientos}
            </Text>
            {d.movimientos.length === 0 ? (
              <Text style={{ color: '#5E5E5E' }}>{t.vacio}</Text>
            ) : (
              d.movimientos.slice(0, 50).map((m) => (
                <View
                  key={m.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderTopWidth: 1,
                    borderTopColor: '#EEE',
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.secundario }}>{m.concepto}</Text>
                    <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{m.fecha.slice(0, 16)}</Text>
                  </View>
                  <Text style={{ fontWeight: '800', color: m.monto >= 0 ? C.exito : C.secundario }}>
                    {formatearMonto(m.monto, 'USD', idioma)}
                  </Text>
                </View>
              ))
            )}
          </Tarjeta>
          <Text style={{ color: '#5E5E5E', marginBottom: 6 }}>{t.cobrosAyuda}</Text>
          <BotonGrande
            texto={t.cobros}
            tipo="claro"
            alTocar={() => void abrirPanel(api, URL_SERVIDOR, '/panel/earnings')}
          />
        </>
      ) : null}
    </View>
  );
}

type Miembro = { usuarioId: string; nombre: string; correo: string; rol: string };

function Equipo({ t }: { t: Textos }) {
  const { api, usuario, idioma } = useSesion();
  const [d, setD] = useState<{ equipo: Miembro[]; miRol: string } | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const b = useBorrador({
    formulario: 'app-equipo',
    cuenta: usuario?.id,
    inicial: { correo: '', rol: 'staff' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cargar = useCallback(() => {
    api
      .pedir<{ equipo: Miembro[]; miRol: string }>('GET', '/datos/mi-restaurante/equipo')
      .then(setD)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  useEffect(cargar, [cargar]);
  async function agregar() {
    setError('');
    setAviso('');
    try {
      await api.pedir('POST', '/datos/mi-restaurante/equipo', {
        correo: b.valores.correo.trim(),
        rol: b.valores.rol,
      });
      void b.limpiar();
      setAviso(t.guardado);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  function quitar(m: Miembro) {
    Alert.alert(t.quitarSeguro, m.nombre || m.correo, [
      { text: t.cancelar, style: 'cancel' },
      {
        text: t.quitar,
        style: 'destructive',
        onPress: () =>
          void api
            .pedir('DELETE', `/datos/mi-restaurante/equipo/${m.usuarioId}`)
            .then(cargar)
            .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x))),
      },
    ]);
  }
  const esDueno = d?.miRol === 'dueno';
  return (
    <View testID="app-equipo">
      <Titulo texto={t.equipo} />
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <Mensajes error={error} aviso={aviso} />
      {d ? (
        <Tarjeta>
          {d.equipo.map((m) => (
            <View
              key={m.usuarioId}
              style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#EEE' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: C.secundario }}>{m.nombre}</Text>
                  <Text style={{ color: '#5E5E5E' }}>
                    {m.correo} · {new Map(Object.entries(t.roles)).get(m.rol) ?? m.rol}
                  </Text>
                </View>
                {esDueno && m.rol !== 'dueno' ? (
                  // Quitar va escondido en los tres puntos (regla de Richard).
                  <Pressable
                    onPress={() => setMenu((x) => (x === m.usuarioId ? null : m.usuarioId))}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.mas} · ${m.nombre}`}
                    hitSlop={10}
                    style={{ paddingHorizontal: 8 }}
                  >
                    <Text style={{ fontSize: 22, fontWeight: '800' }}>⋮</Text>
                  </Pressable>
                ) : null}
              </View>
              {menu === m.usuarioId ? (
                <Pressable
                  onPress={() => quitar(m)}
                  accessibilityRole="button"
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: C.acento, fontWeight: '700' }}>{t.quitar}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </Tarjeta>
      ) : null}
      {esDueno ? (
        <Tarjeta>
          <Campo
            etiqueta={t.correo}
            keyboardType="email-address"
            placeholder={correoEjemplo(idioma)}
            value={b.valores.correo}
            onChangeText={(x) => b.cambiar('correo', x)}
          />
          <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 8 }}>{t.correoAyuda}</Text>
          <Text style={e.etiqueta}>{t.rol}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['manager', 'staff'] as const).map((r) => (
              <Pressable
                key={r}
                onPress={() => b.cambiar('rol', r)}
                accessibilityRole="radio"
                accessibilityState={{ selected: b.valores.rol === r }}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: b.valores.rol === r ? C.secundario : '#DDD',
                  backgroundColor: b.valores.rol === r ? C.secundario : '#fff',
                }}
              >
                <Text
                  style={{ color: b.valores.rol === r ? '#fff' : C.secundario, fontWeight: '700' }}
                >
                  {new Map(Object.entries(t.roles)).get(r)}
                </Text>
              </Pressable>
            ))}
          </View>
          <BotonGrande texto={t.agregar} alTocar={() => void agregar()} />
        </Tarjeta>
      ) : null}
    </View>
  );
}

function Configuracion({ t }: { t: Textos }) {
  const { api, usuario, idioma } = useSesion();
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  // Las contraseñas nunca se guardan en el borrador (regla de formularios).
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const b = useBorrador({
    formulario: 'app-configuracion',
    cuenta: usuario?.id,
    inicial: { nombre: '', telefono: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const { cargarBase } = b;
  useEffect(() => {
    api
      .pedir<{ perfil: { nombre: string; telefono: string } }>('GET', '/datos/cuentas/perfil')
      .then((r) => cargarBase({ nombre: r.perfil.nombre, telefono: r.perfil.telefono }))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api, cargarBase]);
  async function guardar() {
    setError('');
    setAviso('');
    try {
      await api.pedir('PATCH', '/datos/cuentas/yo', {
        nombre: b.valores.nombre,
        telefono: b.valores.telefono,
        idioma,
      });
      b.cargar(b.valores);
      setAviso(t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function cambiarClave() {
    setError('');
    setAviso('');
    try {
      await api.pedir('POST', '/datos/cuentas/clave', { actual, nueva });
      setActual('');
      setNueva('');
      setAviso(t.claveCambiada);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <View testID="app-configuracion">
      <Titulo texto={t.configuracion} />
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <Mensajes error={error} aviso={aviso} />
      <Tarjeta>
        <Campo
          etiqueta={t.tuNombre}
          value={b.valores.nombre}
          onChangeText={(x) => b.cambiar('nombre', x)}
        />
        <Campo
          etiqueta={t.tuTelefono}
          keyboardType="phone-pad"
          value={b.valores.telefono}
          onChangeText={(x) => b.cambiar('telefono', x)}
        />
        <BotonGrande texto={t.guardar} alTocar={() => void guardar()} />
      </Tarjeta>
      <Tarjeta>
        <Text style={{ fontWeight: '800', color: C.secundario, marginBottom: 8 }}>{t.clave}</Text>
        <CampoClave etiqueta={t.actual} valor={actual} cambiar={setActual} />
        <CampoClave etiqueta={t.nueva} valor={nueva} cambiar={setNueva} nueva />
        <BotonGrande
          texto={t.clave}
          tipo="claro"
          desactivado={!actual || nueva.length < 8}
          alTocar={() => void cambiarClave()}
        />
      </Tarjeta>
      {/* C-AYUDA-EN-LA-APP: pedir ayuda y seguir el caso sin salir de la app. */}
      <ReportarProblema />
      <MisCasos
        elegirCapturas={capturasConCamara(
          selectorDeCapturas(
            ImagePicker.launchImageLibraryAsync,
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          ),
          CAMARA,
          idioma,
        )}
      />
      <OpcionesCuenta />
    </View>
  );
}
