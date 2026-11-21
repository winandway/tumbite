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
import { pedir } from './api';

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
    sinCuenta:
      'Ese líder todavía no tiene cuenta en Divoox Driver. Puedes invitarlo: la línea se crea sola cuando se registre con ese correo o celular y abra «Mi línea».',
    invitar: 'Invitar al líder',
    invitado:
      'Listo. La línea queda esperando al líder. Mándale el enlace de «Líderes invitados» para que cree su cuenta.',
    invitados: 'Líderes invitados',
    invitadosAyuda:
      'Estas líneas esperan a que su líder cree su cuenta de conductor con ese mismo correo o celular. Mándale este enlace:',
    anular: 'Anular la invitación',
    opciones: 'Más opciones',
    editarContactos: 'Editar contactos de emergencia',
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
    sinCuenta:
      'That leader doesn’t have a Divoox Driver account yet. You can invite them: the line is created automatically when they sign up with that email or cell phone and open “My line”.',
    invitar: 'Invite the leader',
    invitado:
      'Done. The line is waiting for its leader. Send them the link under “Invited leaders” so they can create their account.',
    invitados: 'Invited leaders',
    invitadosAyuda:
      'These lines are waiting for their leader to create a driver account with that same email or cell phone. Send them this link:',
    anular: 'Cancel the invitation',
    opciones: 'More options',
    editarContactos: 'Edit emergency contacts',
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
};

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
/** El servidor dice así que nadie en Driver tiene ese correo o celular (C-LIDER-INVITADO). */
const esSinCuenta = (x: unknown) =>
  x instanceof ErrorApi && x.estado === 404 && x.campo === 'lider';

function InvitarLider({ t, alInvitar }: { t: Textos; alInvitar: () => void }) {
  return (
    <div className="flex-tarjeta" role="alert" data-testid="lineas-invitar-lider">
      <p>{t.sinCuenta}</p>
      <button type="button" className="boton" onClick={alInvitar}>
        {t.invitar}
      </button>
    </div>
  );
}

type Linea = {
  id: string;
  nombre: string;
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
  const [enlaceDriver, setEnlaceDriver] = useState('');
  const [q, setQ] = useState('');
  const [zona, setZona] = useState('');
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
          `/datos/admin/lineas?zona=${encodeURIComponent(zona)}&q=${encodeURIComponent(q)}`,
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
          setEnlaceDriver(i.enlace);
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
  }, [q, zona, vuelta]);
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
          <p>
            <code data-testid="lineas-enlace-lider">{enlaceDriver}</code>
          </p>
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
                <MenuTresPuntos
                  etiqueta={t.opciones}
                  opciones={[
                    { texto: t.editarContactos, alTocar: () => setEditando(`inv-${i.id}`) },
                    { texto: t.anular, peligro: true, alTocar: () => void anular(i.id) },
                  ]}
                />
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
              editando={editando === `lin-${l.id}`}
              alEditar={(si) => setEditando(si ? `lin-${l.id}` : null)}
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
  const [sinCuenta, setSinCuenta] = useState(false);
  const resolver = async (accion: 'aprobar' | 'rechazar', invitar = false) => {
    setTrabajando(true);
    try {
      await pedir(
        'POST',
        `/datos/admin/lineas-solicitudes/${s.id}/${accion}`,
        accion === 'rechazar' ? { motivo } : invitar ? { invitar: true } : {},
      );
      alResolver(invitar ? t.invitado : t.guardado);
    } catch (x) {
      if (accion === 'aprobar' && esSinCuenta(x)) setSinCuenta(true);
      else setError(x instanceof ErrorApi ? x.message : String(x));
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
      {sinCuenta ? <InvitarLider t={t} alInvitar={() => void resolver('aprobar', true)} /> : null}
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
  const [sinCuenta, setSinCuenta] = useState(false);
  async function crear(e: React.FormEvent | null, invitar = false) {
    e?.preventDefault();
    setError('');
    try {
      const r = await pedir<{ adoptados?: number }>('POST', '/datos/admin/lineas', {
        ...b.valores,
        zonaId: b.valores.zonaId || zonas[0]?.id || '',
        ...(invitar ? { invitar: true } : {}),
      });
      await b.limpiar();
      setSinCuenta(false);
      alCrear(invitar ? t.invitado : r.adoptados ? t.adoptados(r.adoptados) : t.guardado);
    } catch (x) {
      // Lo escrito se queda en pantalla: solo falta decidir si se invita al líder.
      if (!invitar && esSinCuenta(x)) setSinCuenta(true);
      else setError(x instanceof ErrorApi ? x.message : String(x));
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
      {sinCuenta ? <InvitarLider t={t} alInvitar={() => void crear(null, true)} /> : null}
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
  editando: boolean;
  alEditar: (si: boolean) => void;
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
        {l.nombre} · {l.ciudad}
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
          opciones={[{ texto: t.editarContactos, alTocar: () => alEditar(true) }]}
        />
      </div>
      <p className="pista">
        {t.contacto2Nombre}: {l.contacto2Nombre} · {l.contacto2Telefono}
      </p>
      {editando ? (
        <EditarContacto2
          ruta={`/datos/admin/lineas/${l.id}/contacto2`}
          clave={`lin-${l.id}`}
          actual={{ nombre: l.contacto2Nombre, telefono: l.contacto2Telefono }}
          t={t}
          idioma={idioma}
          alGuardar={(m) => {
            alEditar(false);
            recargar(m);
          }}
          alCerrar={() => alEditar(false)}
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
