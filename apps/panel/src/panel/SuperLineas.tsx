import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  pareceTelefono,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { MenuTresPuntos } from './MenuTresPuntos';
import { EtiquetaPrueba, FiltroCuentas } from './CuentasPrueba';
import { usePreferencias } from './usePreferencias';
import { pedir } from './api';
import { useHora } from './horario';

/**
 * C-LINEAS-TAXI (19 nov 2026): las líneas de taxi y mototaxi en el superadmin. El equipo ve las
 * solicitudes del formulario público «Registra tu línea» (aprueba o rechaza con un toque), crea una línea
 * directo, busca por nombre, código, líder, teléfono o ciudad, y mueve conductores entre líneas arrastrando
 * (o con el selector «Mover a»). Va aparte de los referidos.
 */
const T = {
  es: {
    titulo: 'Líneas de taxi y mototaxi',
    ayuda:
      'Cada línea tiene su líder, su código, su enlace y su QR. Los conductores piden entrar y el líder acepta. Si un conductor de la línea pide ayuda, el líder y el segundo contacto reciben un mensaje con su ubicación.',
    buscar: 'Buscar por nombre, código, líder, celular o ciudad',
    ciudad: 'Ciudad',
    cuentas: 'Cuentas',
    todas: 'Todas las ciudades',
    solicitudes: 'Solicitudes del formulario «Registra tu línea»',
    sinSolicitudes: 'No hay solicitudes pendientes.',
    aprobar: 'Aprobar y crear la línea',
    rechazar: 'Rechazar',
    motivo: 'Motivo (opcional)',
    verifica:
      'Antes de aprobar, llama al líder y verifica que el celular es suyo. Si todavía no tiene cuenta en Divoox Driver, podrás invitarlo.',
    conductores: 'conductores',
    crearTitulo: 'Crear una línea',
    nombre: 'Nombre de la línea',
    tipo: 'Tipo de servicio',
    tipos: { taxi: 'Taxi', mototaxi: 'Mototaxi', ambos: 'Taxi y mototaxi' },
    lider: 'Líder: correo o celular con el que entra a Divoox Driver',
    contacto2Nombre: 'Segundo contacto de emergencia: nombre',
    contacto2Telefono: 'Segundo contacto de emergencia: celular con código de país',
    crear: 'Crear la línea',
    invitado: (correo: boolean): string =>
      correo
        ? 'Listo. El líder todavía no tenía cuenta: le mandamos un correo con su enlace personal. La línea se crea sola en cuanto cree su cuenta.'
        : 'Listo. El líder todavía no tenía cuenta y quedó invitado. Mándale su enlace por WhatsApp desde «Líderes invitados».',
    invitados: 'Líderes invitados',
    invitadosAyuda:
      'Estas líneas esperan a su líder. A cada uno le llega su enlace personal por correo; si lo invitaste por celular, mándaselo por WhatsApp. La línea se crea sola en cuanto crea su cuenta con ese correo o celular.',
    copiarEnlace: 'Copiar su enlace',
    enlaceCopiado: 'Enlace copiado.',
    porWhatsapp: 'Mandar por WhatsApp',
    reenviar: 'Volver a mandar el correo',
    reenviado: 'Le volvimos a mandar el correo.',
    correoEnviado: (f: string) => `Correo enviado el ${f}.`,
    sinCorreo: 'Sin correo: mándale el enlace por WhatsApp.',
    mensajeWhatsapp: (linea: string, enlace: string) =>
      `Hola. Te invitamos a ser el líder de la línea «${linea}» en Divoox. Crea tu cuenta de conductor aquí y la línea queda a tu nombre: ${enlace}`,
    anular: 'Anular la invitación',
    opciones: 'Más opciones',
    editarContactos: 'Editar contactos de emergencia',
    editarDatos: 'Editar datos',
    editarDatosTitulo: 'Editar los datos de la línea',
    editarDatosAyuda:
      'Corrige el nombre, el tipo o los conductores. Si cambias el correo del líder, le mandamos su mismo enlace al correo nuevo.',
    conductoresCampo: 'Conductores (aproximado, opcional)',
    guardarDatos: 'Guardar los cambios',
    datosGuardados: 'Listo: guardamos los cambios.',
    datosGuardadosCorreo: 'Listo: guardamos los cambios y le mandamos su enlace al correo nuevo.',
    editarContactosAyuda:
      'El segundo contacto recibe el aviso con la ubicación si un conductor de la línea pide ayuda. Escribe el celular completo otra vez, con el código del país.',
    actual: 'Ahora',
    guardarContactos: 'Guardar el contacto',
    cancelar: 'Cancelar',
    avisoNombre: 'Aquí va el nombre de la persona, no su celular.',
    avisoNombreLinea: 'Aquí va el nombre de la línea, no un celular.',
    lineas: 'Líneas',
    sinLineas: 'No hay líneas con esa búsqueda.',
    miembros: 'miembros',
    pendientes: 'solicitudes de conductores',
    codigo: 'Código',
    enlace: 'Enlace',
    verificada: 'Celular del líder verificado',
    ver: 'Ver',
    cerrar: 'Cerrar',
    sinLinea: 'Conductores de esta ciudad sin línea',
    arrastra: 'Arrastra a un conductor a otra línea, o usa «Mover a».',
    moverA: 'Mover a…',
    dejarSin: 'Dejar sin línea',
    guardado: 'Listo.',
    cargando: 'Cargando…',
    activa: 'Activa',
    desactivar: 'Desactivar',
    activar: 'Activar',
    desde: 'Desde',
    adoptados: (n: number) =>
      `Entraron ${n} conductores que ya se habían registrado con el código del líder.`,
  },
  en: {
    titulo: 'Taxi and mototaxi lines',
    ayuda:
      'Each line has its leader, code, link and QR. Drivers ask to join and the leader accepts. If a driver in the line asks for help, the leader and the second contact get a message with their location.',
    buscar: 'Search by name, code, leader, cell phone or city',
    ciudad: 'City',
    cuentas: 'Accounts',
    todas: 'All cities',
    solicitudes: '“Register your line” form requests',
    sinSolicitudes: 'There are no pending requests.',
    aprobar: 'Approve and create the line',
    rechazar: 'Decline',
    motivo: 'Reason (optional)',
    verifica:
      'Before approving, call the leader and check the cell phone is theirs. If they don’t have a Divoox Driver account yet, you’ll be able to invite them.',
    conductores: 'drivers',
    crearTitulo: 'Create a line',
    nombre: 'Line name',
    tipo: 'Type of service',
    tipos: { taxi: 'Taxi', mototaxi: 'Mototaxi', ambos: 'Taxi and mototaxi' },
    lider: 'Leader: email or cell phone they use in Divoox Driver',
    contacto2Nombre: 'Second emergency contact: name',
    contacto2Telefono: 'Second emergency contact: cell phone with country code',
    crear: 'Create the line',
    invitado: (correo: boolean): string =>
      correo
        ? 'Done. The leader didn’t have an account yet: we emailed them their personal link. The line is created automatically as soon as they sign up.'
        : 'Done. The leader didn’t have an account yet and is now invited. Send them their link on WhatsApp from “Invited leaders”.',
    invitados: 'Invited leaders',
    invitadosAyuda:
      'These lines are waiting for their leader. Each one gets their personal link by email; if you invited them by cell phone, send it on WhatsApp. The line is created automatically as soon as they sign up with that email or cell phone.',
    copiarEnlace: 'Copy their link',
    enlaceCopiado: 'Link copied.',
    porWhatsapp: 'Send on WhatsApp',
    reenviar: 'Send the email again',
    reenviado: 'We sent the email again.',
    correoEnviado: (f: string) => `Email sent on ${f}.`,
    sinCorreo: 'No email: send them the link on WhatsApp.',
    mensajeWhatsapp: (linea: string, enlace: string) =>
      `Hi. You’re invited to be the leader of the “${linea}” line on Divoox. Create your driver account here and the line is yours: ${enlace}`,
    anular: 'Cancel the invitation',
    opciones: 'More options',
    editarContactos: 'Edit emergency contacts',
    editarDatos: 'Edit details',
    editarDatosTitulo: 'Edit the line’s details',
    editarDatosAyuda:
      'Fix the name, the type or the drivers. If you change the leader’s email, we send their same link to the new email.',
    conductoresCampo: 'Drivers (approximate, optional)',
    guardarDatos: 'Save changes',
    datosGuardados: 'Done: we saved the changes.',
    datosGuardadosCorreo: 'Done: we saved the changes and sent their link to the new email.',
    editarContactosAyuda:
      'The second contact gets the alert with the location if a driver on the line asks for help. Enter the full cell phone again, with the country code.',
    actual: 'Now',
    guardarContactos: 'Save the contact',
    cancelar: 'Cancel',
    avisoNombre: 'This is for the person’s name, not their cell phone.',
    avisoNombreLinea: 'This is for the line’s name, not a cell phone.',
    lineas: 'Lines',
    sinLineas: 'No lines match that search.',
    miembros: 'members',
    pendientes: 'driver requests',
    codigo: 'Code',
    enlace: 'Link',
    verificada: 'Leader’s cell phone verified',
    ver: 'View',
    cerrar: 'Close',
    sinLinea: 'Drivers in this city without a line',
    arrastra: 'Drag a driver to another line, or use “Move to”.',
    moverA: 'Move to…',
    dejarSin: 'Leave without a line',
    guardado: 'Done.',
    cargando: 'Loading…',
    activa: 'Active',
    desactivar: 'Deactivate',
    activar: 'Activate',
    desde: 'Since',
    adoptados: (n: number) =>
      `${n} drivers who had already signed up with the leader’s code joined the line.`,
  },
};
type Textos = (typeof T)['es'];
type Invitado = {
  id: string;
  nombre: string;
  tipo: string;
  lider: string;
  contacto2Nombre: string;
  contacto2Telefono: string;
  /** C-INVITAR-LIDER-UN-PASO: su enlace personal y el correo. */
  enlace: string;
  correo: string | null;
  correoEnviadoEn: string | null;
  conductores?: number | null;
};

/** wa.me con el celular del líder (si lo invitaron por celular) y el mensaje con su enlace. */
function enlaceWhatsapp(lider: string, texto: string): string {
  const digitos = lider.includes('@') ? '' : lider.replace(/\D/g, '');
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

/**
 * C-CONTACTO2-EDITABLE (21 nov 2026): corrige el segundo contacto de emergencia de una línea o de un
 * líder invitado. El celular se vuelve a escribir completo (el panel lo ve enmascarado). Lo escrito
 * se guarda solo y vuelve si se cierra la ventana (useBorrador); se borra al guardar o cancelar.
 */
function EditarContacto2({
  ruta,
  clave,
  actual,
  t,
  idioma,
  alGuardar,
  alCerrar,
  setError,
}: {
  ruta: string;
  clave: string;
  actual: { nombre: string; telefono: string };
  t: Textos;
  idioma: Idioma;
  alGuardar: (m: string) => void;
  alCerrar: () => void;
  setError: (m: string) => void;
}) {
  const b = useBorrador({
    formulario: `contacto2-${clave}`,
    cuenta: 'superadmin',
    inicial: { contacto2Nombre: actual.nombre, contacto2Telefono: '' },
    almacen: almacenNavegador,
  });
  const nombreMal = pareceTelefono(b.valores.contacto2Nombre);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('PATCH', ruta, b.valores);
      await b.limpiar();
      alGuardar(t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <form
      className="formulario flex-tarjeta"
      noValidate
      onSubmit={(e) => void guardar(e)}
      data-testid="lineas-editar-contacto2"
    >
      <h4>{t.editarContactos}</h4>
      <p className="pista">{t.editarContactosAyuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <p className="pista">
        {t.actual}: {actual.nombre} · {actual.telefono}
      </p>
      <label className="campo">
        {t.contacto2Nombre}
        <input
          value={b.valores.contacto2Nombre}
          aria-invalid={nombreMal || undefined}
          onChange={(e) => b.cambiar('contacto2Nombre', e.target.value)}
        />
        {nombreMal ? (
          <span className="error-campo" role="alert">
            {t.avisoNombre}
          </span>
        ) : null}
      </label>
      <label className="campo">
        {t.contacto2Telefono}
        <input
          type="tel"
          value={b.valores.contacto2Telefono}
          onChange={(e) => b.cambiar('contacto2Telefono', e.target.value)}
        />
      </label>
      <div className="flex-inline" style={{ gap: 8 }}>
        <button type="submit" className="boton" disabled={nombreMal}>
          {t.guardarContactos}
        </button>
        <button
          type="button"
          className="boton secundario"
          onClick={() => {
            void b.limpiar();
            alCerrar();
          }}
        >
          {t.cancelar}
        </button>
      </div>
    </form>
  );
}
/**
 * C-EDITAR-LINEA (21 nov 2026, Gerencia): «Editar datos» de una línea o de una invitación pendiente:
 * nombre, tipo, conductores y (en la invitación) el correo o celular del líder. Lo escrito se guarda
 * solo y vuelve si se cierra la ventana (useBorrador); se borra al guardar o cancelar.
 */
function EditarDatosLinea({
  ruta,
  clave,
  actual,
  conLider,
  t,
  idioma,
  alGuardar,
  alCerrar,
  setError,
}: {
  ruta: string;
  clave: string;
  actual: { nombre: string; tipo: string; conductores: number | null; lider?: string };
  conLider: boolean;
  t: Textos;
  idioma: Idioma;
  alGuardar: (m: string) => void;
  alCerrar: () => void;
  setError: (m: string) => void;
}) {
  const b = useBorrador({
    formulario: `datos-linea-${clave}`,
    cuenta: 'superadmin',
    inicial: {
      nombre: actual.nombre,
      tipo: actual.tipo,
      conductores: actual.conductores == null ? '' : String(actual.conductores),
      lider: actual.lider ?? '',
    },
    almacen: almacenNavegador,
  });
  const nombreMal = pareceTelefono(b.valores.nombre);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const n = b.valores.conductores.trim();
    try {
      const r = await pedir<{ correoEnviado?: boolean | null }>('PATCH', ruta, {
        nombre: b.valores.nombre,
        tipo: b.valores.tipo,
        conductores: n === '' ? null : Number(n),
        ...(conLider && b.valores.lider.trim() !== (actual.lider ?? '')
          ? { lider: b.valores.lider }
          : {}),
      });
      await b.limpiar();
      alGuardar(r.correoEnviado ? t.datosGuardadosCorreo : t.datosGuardados);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <form
      className="formulario flex-tarjeta"
      noValidate
      onSubmit={(e) => void guardar(e)}
      data-testid="lineas-editar-datos"
    >
      <h4>{t.editarDatosTitulo}</h4>
      <p className="pista">{t.editarDatosAyuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <label className="campo">
        {t.nombre}
        <input
          value={b.valores.nombre}
          aria-invalid={nombreMal || undefined}
          onChange={(e) => b.cambiar('nombre', e.target.value)}
        />
      </label>
      <label className="campo">
        {t.tipo}
        <select value={b.valores.tipo} onChange={(e) => b.cambiar('tipo', e.target.value)}>
          {Object.entries(t.tipos).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        {t.conductoresCampo}
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={b.valores.conductores}
          onChange={(e) => b.cambiar('conductores', e.target.value)}
        />
      </label>
      {conLider ? (
        <label className="campo">
          {t.lider}
          <input value={b.valores.lider} onChange={(e) => b.cambiar('lider', e.target.value)} />
        </label>
      ) : null}
      <div className="flex-inline" style={{ gap: 8 }}>
        <button type="submit" className="boton" disabled={nombreMal}>
          {t.guardarDatos}
        </button>
        <button
          type="button"
          className="boton secundario"
          onClick={() => {
            void b.limpiar();
            alCerrar();
          }}
        >
          {t.cancelar}
        </button>
      </div>
    </form>
  );
}
type Linea = {
  id: string;
  nombre: string;
  /** C-CUENTA-PRUEBA: el líder es cuenta de prueba. */
  esPrueba?: boolean;
  zonaId: string;
  ciudad: string;
  codigo: string;
  tipo: 'taxi' | 'mototaxi' | 'ambos';
  lider: string;
  liderTelefono: string;
  contacto2Nombre: string;
  contacto2Telefono: string;
  activa: boolean;
  miembros: number;
  pendientes: number;
  verificada: boolean;
  conductores?: number | null;
};
type Solicitud = {
  id: string;
  nombre: string;
  ciudad: string;
  tipo: string;
  conductores: number;
  liderNombre: string;
  liderTelefono: string;
  contacto2Nombre: string;
  contacto2Telefono: string;
};
type Zona = { id: string; nombre: string };
type Suelto = { id: string; nombre: string; telefono: string | null };
type Miembro = { id: string; nombre: string; telefono: string; desde: string };

export function SuperLineas({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [sinLinea, setSinLinea] = useState<Suelto[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [q, setQ] = useState('');
  const [zona, setZona] = useState('');
  // C-CUENTA-PRUEBA: «Cuentas: reales» por defecto, recordado.
  const pref = usePreferencias('lineas', { cuentas: 'reales' });
  const cuentas = pref.valores.cuentas || 'reales';
  const [abierta, setAbierta] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    let vivo = true;
    const espera = setTimeout(() => {
      void Promise.all([
        pedir<{ lineas: Linea[]; zonas: Zona[]; sinLinea: Suelto[] }>(
          'GET',
          `/datos/admin/lineas?zona=${encodeURIComponent(zona)}&q=${encodeURIComponent(q)}&cuentas=${cuentas}`,
        ),
        pedir<{ solicitudes: Solicitud[] }>('GET', '/datos/admin/lineas-solicitudes'),
        pedir<{ invitaciones: Invitado[]; enlace: string }>(
          'GET',
          '/datos/admin/lineas-invitaciones',
        ),
      ])
        .then(([l, s, i]) => {
          if (!vivo) return;
          setLineas(l.lineas);
          setZonas(l.zonas);
          setSinLinea(l.sinLinea);
          setSolicitudes(s.solicitudes);
          setInvitados(i.invitaciones);
          setCargado(true);
        })
        .catch((x: unknown) => {
          if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
        });
    }, 200);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [q, zona, vuelta, cuentas]);
  const recargar = (m: string) => {
    setOk(m);
    setError('');
    setVuelta((n) => n + 1);
  };
  const mover = async (conductorId: string, lineaId: string | null) => {
    try {
      await pedir('POST', '/datos/admin/lineas/mover', { conductorId, lineaId });
      recargar(t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  };
  const hora = useHora(idioma);
  // C-INVITAR-LIDER-UN-PASO: copiar el enlace personal y volver a mandar el correo.
  const copiar = async (enlace: string) => {
    try {
      await navigator.clipboard.writeText(enlace);
      setOk(t.enlaceCopiado);
    } catch {
      setError(enlace);
    }
  };
  const reenviar = async (id: string) => {
    try {
      await pedir('POST', `/datos/admin/lineas-invitaciones/${id}/reenviar`, {});
      recargar(t.reenviado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  };
  const anular = async (id: string) => {
    try {
      await pedir('POST', `/datos/admin/lineas-invitaciones/${id}/anular`, {});
      recargar(t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  };
  return (
    <div className="super" data-testid="super-lineas">
      <h2>
        {t.titulo}
        <AyudaAqui guia="driver-lines" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}

      <h3>
        {t.solicitudes} {solicitudes.length ? `(${solicitudes.length})` : ''}
      </h3>
      {solicitudes.length === 0 ? (
        <p className="pista">{cargado ? t.sinSolicitudes : t.cargando}</p>
      ) : (
        <ul className="flex-lista-tarjetas" data-testid="lineas-solicitudes">
          {solicitudes.map((s) => (
            <TarjetaSolicitud key={s.id} s={s} t={t} alResolver={recargar} setError={setError} />
          ))}
        </ul>
      )}

      <CrearLinea t={t} idioma={idioma} zonas={zonas} alCrear={recargar} setError={setError} />

      {invitados.length ? (
        <>
          <h3>
            {t.invitados} ({invitados.length})
          </h3>
          <p className="pista">{t.invitadosAyuda}</p>
          <ul className="flex-lista-tarjetas" data-testid="lineas-invitados">
            {invitados.map((i) => (
              <li key={i.id} className="flex-tarjeta">
                <h4>{i.nombre}</h4>
                <p>
                  {t.tipos[i.tipo as keyof typeof t.tipos] ?? i.tipo} · {i.lider}
                </p>
                <p className="pista">
                  {t.contacto2Nombre}: {i.contacto2Nombre} · {i.contacto2Telefono}
                </p>
                <p className="pista">
                  {i.correoEnviadoEn
                    ? t.correoEnviado(hora.fecha(i.correoEnviadoEn))
                    : i.correo
                      ? ''
                      : t.sinCorreo}
                </p>
                <p>
                  <code data-testid="lineas-enlace-lider">{i.enlace}</code>
                </p>
                <MenuTresPuntos
                  etiqueta={t.opciones}
                  opciones={[
                    { texto: t.copiarEnlace, alTocar: () => void copiar(i.enlace) },
                    {
                      texto: t.porWhatsapp,
                      alTocar: () =>
                        window.open(
                          enlaceWhatsapp(i.lider, t.mensajeWhatsapp(i.nombre, i.enlace)),
                          '_blank',
                          'noopener,noreferrer',
                        ),
                    },
                    ...(i.correo
                      ? [{ texto: t.reenviar, alTocar: () => void reenviar(i.id) }]
                      : []),
                    { texto: t.editarDatos, alTocar: () => setEditando(`datos-inv-${i.id}`) },
                    { texto: t.editarContactos, alTocar: () => setEditando(`inv-${i.id}`) },
                    { texto: t.anular, peligro: true, alTocar: () => void anular(i.id) },
                  ]}
                />
                {editando === `datos-inv-${i.id}` ? (
                  <EditarDatosLinea
                    ruta={`/datos/admin/lineas-invitaciones/${i.id}`}
                    clave={`inv-${i.id}`}
                    actual={{
                      nombre: i.nombre,
                      tipo: i.tipo,
                      conductores: i.conductores ?? null,
                      lider: i.lider,
                    }}
                    conLider
                    t={t}
                    idioma={idioma}
                    alGuardar={(m) => {
                      setEditando(null);
                      recargar(m);
                    }}
                    alCerrar={() => setEditando(null)}
                    setError={setError}
                  />
                ) : null}
                {editando === `inv-${i.id}` ? (
                  <EditarContacto2
                    ruta={`/datos/admin/lineas-invitaciones/${i.id}/contacto2`}
                    clave={`inv-${i.id}`}
                    actual={{ nombre: i.contacto2Nombre, telefono: i.contacto2Telefono }}
                    t={t}
                    idioma={idioma}
                    alGuardar={(m) => {
                      setEditando(null);
                      recargar(m);
                    }}
                    alCerrar={() => setEditando(null)}
                    setError={setError}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>{t.lineas}</h3>
      <div className="flex-inline" style={{ gap: 12, flexWrap: 'wrap' }}>
        <label className="campo" style={{ flex: '2 1 260px' }}>
          {t.buscar}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="lineas-buscar"
          />
        </label>
        <label className="campo" style={{ flex: '1 1 180px' }}>
          {t.cuentas}
          <FiltroCuentas
            valor={cuentas}
            cambiar={(v) => pref.cambiar('cuentas', v)}
            idioma={idioma}
          />
        </label>
        <label className="campo" style={{ flex: '1 1 180px' }}>
          {t.ciudad}
          <select
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            data-testid="lineas-ciudad"
          >
            <option value="">{t.todas}</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="pista">{t.arrastra}</p>
      {lineas.length === 0 ? (
        <p className="pista">{cargado ? t.sinLineas : t.cargando}</p>
      ) : (
        <ul className="flex-lista-tarjetas" data-testid="lineas-lista">
          {lineas.map((l) => (
            <TarjetaLinea
              key={l.id}
              l={l}
              t={t}
              lineas={lineas}
              abierta={abierta === l.id}
              alAbrir={() => setAbierta(abierta === l.id ? null : l.id)}
              mover={mover}
              recargar={recargar}
              vuelta={vuelta}
              setError={setError}
              idioma={idioma}
              editando={
                editando === `lin-${l.id}`
                  ? 'contactos'
                  : editando === `datos-lin-${l.id}`
                    ? 'datos'
                    : null
              }
              alEditar={(m) =>
                setEditando(
                  m === 'datos' ? `datos-lin-${l.id}` : m === 'contactos' ? `lin-${l.id}` : null,
                )
              }
            />
          ))}
        </ul>
      )}
      {zona ? (
        <div
          className="flex-tarjeta"
          data-testid="lineas-sin-linea"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('text/plain');
            if (id) void mover(id, null);
          }}
        >
          <h4>{t.sinLinea}</h4>
          {sinLinea.length === 0 ? (
            <p className="pista">—</p>
          ) : (
            <ul>
              {sinLinea.map((c) => (
                <li
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)}
                  style={{ cursor: 'grab' }}
                >
                  {c.nombre}
                  <select
                    aria-label={t.moverA}
                    value=""
                    onChange={(e) => e.target.value && void mover(c.id, e.target.value)}
                  >
                    <option value="">{t.moverA}</option>
                    {lineas
                      .filter((l) => l.zonaId === zona)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nombre}
                        </option>
                      ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TarjetaSolicitud({
  s,
  t,
  alResolver,
  setError,
}: {
  s: Solicitud;
  t: Textos;
  alResolver: (m: string) => void;
  setError: (m: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const resolver = async (accion: 'aprobar' | 'rechazar') => {
    setTrabajando(true);
    try {
      // C-INVITAR-LIDER-UN-PASO: aprobar a un líder sin cuenta lo invita en el mismo paso.
      const r = await pedir<{ invitacion?: { correoEnviado: boolean } | null }>(
        'POST',
        `/datos/admin/lineas-solicitudes/${s.id}/${accion}`,
        accion === 'rechazar' ? { motivo } : {},
      );
      alResolver(r?.invitacion ? t.invitado(r.invitacion.correoEnviado) : t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  };
  return (
    <li className="flex-tarjeta">
      <h4>
        {s.nombre} · {s.ciudad}
      </h4>
      <p>
        {t.tipos[s.tipo as keyof typeof t.tipos] ?? s.tipo} · {s.conductores} {t.conductores}
      </p>
      <p>
        {s.liderNombre} · {s.liderTelefono}
      </p>
      <p className="pista">
        {s.contacto2Nombre} · {s.contacto2Telefono}
      </p>
      <p className="pista">{t.verifica}</p>
      <label className="campo">
        {t.motivo}
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <div className="flex-inline" style={{ gap: 8 }}>
        <button
          type="button"
          className="boton"
          disabled={trabajando}
          onClick={() => void resolver('aprobar')}
        >
          {t.aprobar}
        </button>
        <button
          type="button"
          className="boton secundario"
          disabled={trabajando}
          onClick={() => void resolver('rechazar')}
        >
          {t.rechazar}
        </button>
      </div>
    </li>
  );
}

function CrearLinea({
  t,
  idioma,
  zonas,
  alCrear,
  setError,
}: {
  t: Textos;
  idioma: Idioma;
  zonas: Zona[];
  alCrear: (m: string) => void;
  setError: (m: string) => void;
}) {
  const b = useBorrador({
    formulario: 'crear-linea',
    cuenta: 'superadmin',
    inicial: {
      nombre: '',
      zonaId: '',
      tipo: 'mototaxi',
      lider: '',
      contacto2Nombre: '',
      contacto2Telefono: '',
    },
    almacen: almacenNavegador,
  });
  async function crear(e: React.FormEvent | null) {
    e?.preventDefault();
    setError('');
    try {
      // C-INVITAR-LIDER-UN-PASO: si el líder no tiene cuenta, queda invitado en este mismo paso.
      const r = await pedir<{ adoptados?: number; invitacion?: { correoEnviado: boolean } | null }>(
        'POST',
        '/datos/admin/lineas',
        { ...b.valores, zonaId: b.valores.zonaId || zonas[0]?.id || '' },
      );
      await b.limpiar();
      alCrear(
        r.invitacion
          ? t.invitado(r.invitacion.correoEnviado)
          : r.adoptados
            ? t.adoptados(r.adoptados)
            : t.guardado,
      );
    } catch (x) {
      // Lo escrito se queda en pantalla.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <div className="flex-tarjeta" data-testid="lineas-crear">
      <h3>{t.crearTitulo}</h3>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario" noValidate onSubmit={(e) => void crear(e)}>
        <label className="campo">
          {t.nombre}
          <input
            value={b.valores.nombre}
            aria-invalid={pareceTelefono(b.valores.nombre) || undefined}
            onChange={(e) => b.cambiar('nombre', e.target.value)}
          />
          {pareceTelefono(b.valores.nombre) ? (
            <span className="error-campo" role="alert" data-testid="lineas-aviso-nombre">
              {t.avisoNombreLinea}
            </span>
          ) : null}
        </label>
        <label className="campo">
          {t.ciudad}
          <select value={b.valores.zonaId} onChange={(e) => b.cambiar('zonaId', e.target.value)}>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          {t.tipo}
          <select value={b.valores.tipo} onChange={(e) => b.cambiar('tipo', e.target.value)}>
            {Object.entries(t.tipos).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          {t.lider}
          <input value={b.valores.lider} onChange={(e) => b.cambiar('lider', e.target.value)} />
        </label>
        <label className="campo">
          {t.contacto2Nombre}
          <input
            value={b.valores.contacto2Nombre}
            aria-invalid={pareceTelefono(b.valores.contacto2Nombre) || undefined}
            onChange={(e) => b.cambiar('contacto2Nombre', e.target.value)}
          />
          {pareceTelefono(b.valores.contacto2Nombre) ? (
            <span className="error-campo" role="alert" data-testid="lineas-aviso-contacto2">
              {t.avisoNombre}
            </span>
          ) : null}
        </label>
        <label className="campo">
          {t.contacto2Telefono}
          <input
            type="tel"
            value={b.valores.contacto2Telefono}
            onChange={(e) => b.cambiar('contacto2Telefono', e.target.value)}
          />
        </label>
        <button type="submit" className="boton">
          {t.crear}
        </button>
      </form>
    </div>
  );
}

function TarjetaLinea({
  l,
  t,
  lineas,
  abierta,
  alAbrir,
  mover,
  recargar,
  vuelta,
  setError,
  idioma,
  editando,
  alEditar,
}: {
  l: Linea;
  t: Textos;
  lineas: Linea[];
  abierta: boolean;
  alAbrir: () => void;
  mover: (c: string, destino: string | null) => Promise<void>;
  recargar: (m: string) => void;
  vuelta: number;
  setError: (m: string) => void;
  idioma: Idioma;
  editando: 'contactos' | 'datos' | null;
  alEditar: (modo: 'contactos' | 'datos' | null) => void;
}) {
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [enlace, setEnlace] = useState('');
  const [qr, setQr] = useState('');
  useEffect(() => {
    if (!abierta) return;
    let vivo = true;
    void pedir<{ linea: Linea & { enlace: string }; miembros: Miembro[] }>(
      'GET',
      `/datos/admin/lineas/${l.id}`,
    )
      .then(async (d) => {
        if (!vivo) return;
        setMiembros(d.miembros);
        setEnlace(d.linea.enlace);
        setQr(await QRCode.toDataURL(d.linea.enlace, { margin: 1, width: 180 }));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [abierta, l.id, vuelta]);
  const alternar = async () => {
    try {
      await pedir('PATCH', `/datos/admin/lineas/${l.id}`, { activa: !l.activa });
      recargar(t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  };
  return (
    <li
      className="flex-tarjeta"
      data-testid="linea-tarjeta"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('text/plain');
        if (id) void mover(id, l.id);
      }}
    >
      <h4>
        {l.nombre} · {l.ciudad} <EtiquetaPrueba si={l.esPrueba} idioma={idioma} />
      </h4>
      <p>
        {t.tipos[l.tipo]} · {l.lider} · {l.liderTelefono}
      </p>
      <p className="pista">
        {l.miembros} {t.miembros}
        {l.pendientes ? ` · ${l.pendientes} ${t.pendientes}` : ''} · {t.codigo}:{' '}
        <strong>{l.codigo}</strong>
        {l.verificada ? ` · ${t.verificada}` : ''}
      </p>
      <div className="flex-inline" style={{ gap: 8 }}>
        <button type="button" className="boton secundario" onClick={alAbrir}>
          {abierta ? t.cerrar : t.ver}
        </button>
        <button type="button" className="boton secundario" onClick={() => void alternar()}>
          {l.activa ? t.desactivar : t.activar}
        </button>
        <MenuTresPuntos
          etiqueta={t.opciones}
          opciones={[
            { texto: t.editarDatos, alTocar: () => alEditar('datos') },
            { texto: t.editarContactos, alTocar: () => alEditar('contactos') },
          ]}
        />
      </div>
      <p className="pista">
        {t.contacto2Nombre}: {l.contacto2Nombre} · {l.contacto2Telefono}
      </p>
      {editando === 'datos' ? (
        <EditarDatosLinea
          ruta={`/datos/admin/lineas/${l.id}`}
          clave={`lin-${l.id}`}
          actual={{ nombre: l.nombre, tipo: l.tipo, conductores: l.conductores ?? null }}
          conLider={false}
          t={t}
          idioma={idioma}
          alGuardar={(m) => {
            alEditar(null);
            recargar(m);
          }}
          alCerrar={() => alEditar(null)}
          setError={setError}
        />
      ) : null}
      {editando === 'contactos' ? (
        <EditarContacto2
          ruta={`/datos/admin/lineas/${l.id}/contacto2`}
          clave={`lin-${l.id}`}
          actual={{ nombre: l.contacto2Nombre, telefono: l.contacto2Telefono }}
          t={t}
          idioma={idioma}
          alGuardar={(m) => {
            alEditar(null);
            recargar(m);
          }}
          alCerrar={() => alEditar(null)}
          setError={setError}
        />
      ) : null}
      {abierta ? (
        <div>
          <div className="flex-inline" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {qr ? <img src={qr} alt={`QR ${enlace}`} width={140} height={140} /> : null}
            <p>
              {t.enlace}: <a href={enlace}>{enlace}</a>
            </p>
          </div>
          <ul>
            {miembros.map((m) => (
              <li
                key={m.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', m.id)}
                style={{ cursor: 'grab' }}
              >
                {m.nombre} · {t.desde} {m.desde.slice(0, 10)}
                <select
                  aria-label={t.moverA}
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) void mover(m.id, v === '__sin' ? null : v);
                  }}
                >
                  <option value="">{t.moverA}</option>
                  <option value="__sin">{t.dejarSin}</option>
                  {lineas
                    .filter((x) => x.id !== l.id && x.zonaId === l.zonaId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
