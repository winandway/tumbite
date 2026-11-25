import { View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import {
  AnchoDriver,
  DK,
  EstadoPapelDriver,
  FilaDriver,
  ListaDriver,
  PerfilCabeceraDriver,
  SelectorIdioma,
  Text,
  useSesion,
} from '@tumbite/movil';

export type DestinoCuenta =
  | 'datos'
  | 'pedidos'
  | 'miRuta'
  | 'turnos'
  | 'clientesFijos'
  | 'miEquipo'
  | 'calificaciones'
  | 'asiTeVen'
  | 'seguridad'
  | 'ayuda'
  | 'inicio';

const T = {
  es: {
    papeles: 'Papeles',
    papelesDetalle: 'Tus documentos y su vencimiento',
    vehiculo: 'Mis datos y vehículo',
    vehiculoDetalle: 'Tu vehículo, tu perfil y los ajustes',
    ofertas: 'Qué ofertas recibo',
    ofertasDetalle: 'Conecta o desconecta cada servicio en el inicio',
    entregas: 'Mis entregas',
    entregasDetalle: 'Tu historial y calificar al cliente',
    ruta: 'Mi ruta',
    rutaDetalle: 'Rutas de paquetes de Divoox Flex',
    turnos: 'Mis turnos',
    turnosDetalle: 'Reserva tus horas',
    fijos: 'Clientes fijos',
    fijosDetalle: 'Quién te eligió y tus viajes fijos',
    equipo: 'Mi equipo e invitaciones',
    equipoDetalle: 'Invita conductores con tu código',
    calificaciones: 'Mis calificaciones',
    calificacionesDetalle: 'Lo que dicen de ti',
    asiTeVen: 'Así te ven los pasajeros',
    asiTeVenDetalle: 'Tu perfil público',
    seguridad: 'Seguridad',
    seguridadDetalle: 'Contactos de confianza y emergencias',
    ayuda: 'Ayuda',
    ayudaDetalle: 'Habla con el equipo de soporte',
    idioma: 'Idioma',
    salir: 'Cerrar sesión',
    nivel: 'Nivel',
    pendientes: (n: number) => (n === 1 ? 'Falta 1' : `Faltan ${n}`),
  },
  en: {
    papeles: 'Documents',
    papelesDetalle: 'Your documents and when they expire',
    vehiculo: 'My details and vehicle',
    vehiculoDetalle: 'Your vehicle, your profile and settings',
    ofertas: 'Offers I get',
    ofertasDetalle: 'Turn each service on or off from Home',
    entregas: 'My deliveries',
    entregasDetalle: 'Your history and rating the customer',
    ruta: 'My route',
    rutaDetalle: 'Divoox Flex package routes',
    turnos: 'My shifts',
    turnosDetalle: 'Book your hours',
    fijos: 'Regular riders',
    fijosDetalle: 'Who picked you and your regular rides',
    equipo: 'My team and invitations',
    equipoDetalle: 'Invite drivers with your code',
    calificaciones: 'My ratings',
    calificacionesDetalle: 'What people say about you',
    asiTeVen: 'How riders see you',
    asiTeVenDetalle: 'Your public profile',
    seguridad: 'Safety',
    seguridadDetalle: 'Trusted contacts and emergencies',
    ayuda: 'Help',
    ayudaDetalle: 'Talk to our support team',
    idioma: 'Language',
    salir: 'Sign out',
    nivel: 'Level',
    pendientes: (n: number) => (n === 1 ? '1 missing' : `${n} missing`),
  },
};

/**
 * C-REDISENO-DRIVER (pantalla «Cuenta» del borrador): la cabecera con su nombre y su nivel, y todo lo
 * de la cuenta en filas (papeles, vehículo, qué ofertas recibe, seguridad, ayuda, idioma con el
 * selector estilo Amazon y cerrar sesión). Reúne lo que antes estaba en el menú de arriba y en el
 * perfil: nada se pierde, todo queda a uno o dos toques.
 */
export function CuentaDriver({
  idioma,
  cambiarIdioma,
  nombre,
  nivel,
  puntaje,
  papelesPendientes,
  alPapeles,
  alIr,
}: {
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  nombre: string;
  nivel?: string | null;
  puntaje?: string | null;
  /** Cuántas cosas del registro le faltan (0 = nada). */
  papelesPendientes: number;
  alPapeles: () => void;
  alIr: (v: DestinoCuenta) => void;
}) {
  const t = idioma === 'en' ? T.en : T.es;
  const { salir } = useSesion();
  const datos = [
    ...(puntaje ? [{ fuerte: puntaje }] : []),
    ...(nivel ? [{ fuerte: nivel, texto: '' }] : []),
  ].map((d) => (d.texto === '' ? { fuerte: `${t.nivel} ${d.fuerte}` } : d));
  return (
    <View testID="cuenta-driver" style={{ backgroundColor: DK.fondo, flexGrow: 1 }}>
      <PerfilCabeceraDriver nombre={nombre} datos={datos} />
      <AnchoDriver estilo={{ paddingHorizontal: 16, paddingTop: 14, gap: 12, paddingBottom: 24 }}>
        <ListaDriver testID="cuenta-lista-trabajo">
          <FilaDriver
            primera
            icono="document-text-outline"
            titulo={t.papeles}
            detalle={t.papelesDetalle}
            alTocar={alPapeles}
            testID="cuenta-papeles"
            derecha={
              papelesPendientes > 0 ? (
                <EstadoPapelDriver texto={t.pendientes(papelesPendientes)} tono="ambar" />
              ) : undefined
            }
          />
          <FilaDriver
            icono="car-outline"
            titulo={t.vehiculo}
            detalle={t.vehiculoDetalle}
            alTocar={() => alIr('datos')}
            testID="cuenta-vehiculo"
          />
          <FilaDriver
            icono="options-outline"
            titulo={t.ofertas}
            detalle={t.ofertasDetalle}
            alTocar={() => alIr('inicio')}
            testID="cuenta-ofertas"
          />
        </ListaDriver>
        <ListaDriver testID="cuenta-lista-viajes">
          <FilaDriver
            primera
            icono="receipt-outline"
            titulo={t.entregas}
            detalle={t.entregasDetalle}
            alTocar={() => alIr('pedidos')}
            testID="cuenta-entregas"
          />
          <FilaDriver
            icono="cube-outline"
            colorIcono={DK.petroleo}
            titulo={t.ruta}
            detalle={t.rutaDetalle}
            alTocar={() => alIr('miRuta')}
            testID="cuenta-mi-ruta"
          />
          <FilaDriver
            icono="calendar-outline"
            titulo={t.turnos}
            detalle={t.turnosDetalle}
            alTocar={() => alIr('turnos')}
            testID="cuenta-turnos"
          />
          <FilaDriver
            icono="repeat-outline"
            titulo={t.fijos}
            detalle={t.fijosDetalle}
            alTocar={() => alIr('clientesFijos')}
            testID="cuenta-clientes-fijos"
          />
          <FilaDriver
            icono="star-outline"
            titulo={t.calificaciones}
            detalle={t.calificacionesDetalle}
            alTocar={() => alIr('calificaciones')}
            testID="cuenta-calificaciones"
          />
          <FilaDriver
            icono="person-circle-outline"
            titulo={t.asiTeVen}
            detalle={t.asiTeVenDetalle}
            alTocar={() => alIr('asiTeVen')}
            testID="cuenta-asi-te-ven"
          />
          <FilaDriver
            icono="people-outline"
            titulo={t.equipo}
            detalle={t.equipoDetalle}
            alTocar={() => alIr('miEquipo')}
            testID="cuenta-mi-equipo"
          />
        </ListaDriver>
        <ListaDriver testID="cuenta-lista-ayuda">
          <FilaDriver
            primera
            icono="shield-outline"
            titulo={t.seguridad}
            detalle={t.seguridadDetalle}
            alTocar={() => alIr('seguridad')}
            testID="cuenta-seguridad"
          />
          <FilaDriver
            icono="help-circle-outline"
            titulo={t.ayuda}
            detalle={t.ayudaDetalle}
            alTocar={() => alIr('ayuda')}
            testID="cuenta-ayuda"
          />
          <FilaDriver
            icono="globe-outline"
            titulo={t.idioma}
            testID="cuenta-idioma"
            derecha={<SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} sobreClaro />}
          />
        </ListaDriver>
        <ListaDriver>
          <FilaDriver
            primera
            icono="log-out-outline"
            titulo={t.salir}
            alTocar={() => void salir()}
            testID="cuenta-salir"
            derecha={<Text> </Text>}
          />
        </ListaDriver>
      </AnchoDriver>
    </View>
  );
}
