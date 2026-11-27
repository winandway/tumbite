import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  abreviaturaZona,
  enIdioma,
  formatearFechaHora,
  nombreZona,
  zonaDelNavegador,
} from '@tumbite/compartido';
import { pedir } from './api';
import { useAjustesHorario, useHora } from './horario';
import { Enlace } from '../Enlace';
import { usePermisos } from './permisosPanel';
import { AyudaAqui } from './AyudaAqui';
import { LimitesPorMoneda } from './SuperAprobaciones';
import { SaldoRegalosAutomaticos } from './SaldoRegalosAutomaticos';

const T = {
  es: {
    titulo: 'Configuración',
    intro:
      'Ajustes del superadmin. Cada empleado guarda los suyos: siguen a tu cuenta en cualquier computadora.',
    horario: 'Horario',
    horarioAyuda:
      'Cómo se escriben las fechas y horas en todo el superadmin. En automático, cada hora se muestra en la zona de la ciudad del pedido o del viaje, y dice de qué zona es cuando no coincide con la tuya.',
    formato: 'Formato de hora',
    formatos: {
      auto: 'Automático (12 horas en Estados Unidos)',
      '12': '12 horas, con a. m. y p. m.',
      '24': '24 horas',
    } as Record<string, string>,
    zona: 'Zona horaria',
    automatica: 'Automática: la de la ciudad de cada pedido o viaje',
    fija: 'Fija',
    tuComputadora: 'la de esta computadora',
    ejemplo: 'Así se ven las horas ahora:',
    ciudades: 'Ciudades activas',
    ciudadesAyuda: 'Qué hora es ahora mismo en cada ciudad donde Divoox está encendido.',
    sinCiudades: 'No hay ciudades activas.',
    tuZona: 'Tu zona',
    cargando: 'Cargando…',
    guardado: 'Usando tu horario guardado.',
    automaticoTodo: 'Volver a automático',
    equipo: 'Equipo interno',
    equipoAyuda:
      'Quién entra al panel, con qué plantilla de puesto y en qué ciudades; invitaciones, registro de lo que hizo y vio cada persona, y tus avisos por correo.',
    abrirEquipo: 'Abrir Equipo interno',
  },
  en: {
    titulo: 'Configuration',
    intro:
      'Superadmin settings. Each team member keeps their own: they follow your account on any computer.',
    horario: 'Time',
    horarioAyuda:
      'How dates and times are written across the superadmin. On automatic, each time is shown in the time zone of the order’s or ride’s city, and says which zone it is when it doesn’t match yours.',
    formato: 'Time format',
    formatos: {
      auto: 'Automatic (12-hour in the United States)',
      '12': '12-hour, with AM and PM',
      '24': '24-hour',
    } as Record<string, string>,
    zona: 'Time zone',
    automatica: 'Automatic: the city of each order or ride',
    fija: 'Fixed',
    tuComputadora: 'this computer’s',
    ejemplo: 'This is how times look right now:',
    ciudades: 'Active cities',
    ciudadesAyuda: 'What time it is right now in every city where Divoox is on.',
    sinCiudades: 'There are no active cities.',
    tuZona: 'Your zone',
    cargando: 'Loading…',
    guardado: 'Using your saved time settings.',
    automaticoTodo: 'Back to automatic',
    equipo: 'Internal team',
    equipoAyuda:
      'Who can sign in to the panel, with which role template and in which cities; invitations, the log of what each person did and viewed, and your email alerts.',
    abrirEquipo: 'Open Internal team',
  },
};

type Ciudad = { id: string; nombre: string; pais: string; zonaHoraria: string };

/** Zonas comunes que se ofrecen además de las de las ciudades activas. */
const ZONAS_COMUNES = [
  'America/New_York',
  'America/Detroit',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Caracas',
  'America/Bogota',
  'America/Mexico_City',
  'Europe/Madrid',
  'UTC',
];

/**
 * C-HORARIO-EMPLEADO (15 nov 2026, pedido de Richard: «Horarios en Configuración»). Todos los
 * países. La sección Configuración del superadmin con el bloque «Horario»: formato de hora (12 o 24
 * horas, automático según el país), zona horaria (automática según la ciudad del dato, o fija) y
 * las ciudades activas con la hora de allá ahora mismo. Se guarda por empleado
 * (`preferencias_internas`, pantalla «horario»). Aquí se sumará «Equipo interno».
 */
export function SuperConfiguracion({
  idioma,
  base = '',
  miId = '',
}: {
  idioma: Idioma;
  base?: string;
  miId?: string;
}) {
  const { puedeVer } = usePermisos();
  const t = enIdioma(T, idioma);
  const { ajustes, cambiar, restablecer, guardados } = useAjustesHorario();
  const h = useHora(idioma);
  const [ciudades, setCiudades] = useState<Ciudad[] | null>(null);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    pedir<{ ciudades: Ciudad[] }>('GET', '/datos/admin/horario/ciudades')
      .then((r) => setCiudades(r.ciudades))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
    // La hora de cada ciudad se renueva cada 30 segundos (sin pedir nada al servidor).
    const reloj = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(reloj);
  }, []);
  const navegador = zonaDelNavegador();
  const zonas = [
    ...new Set([...(ciudades ?? []).map((c) => c.zonaHoraria), ...ZONAS_COMUNES, navegador]),
  ].sort();
  // Las claves «12» y «24» parecen números: el orden se fija a mano (automático primero).
  const nombresFormato = new Map(Object.entries(t.formatos));
  const formatos = ['auto', '12', '24'].map((v) => [v, nombresFormato.get(v) ?? v] as const);
  const fija = ajustes.zonaHoraria !== 'auto';
  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p>{t.intro}</p>
      {base && (puedeVer('equipo.ver') || puedeVer('avisos.recibir')) ? (
        <section className="tarjeta-form" aria-labelledby="equipo-titulo">
          <h2 id="equipo-titulo">
            {t.equipo}
            <AyudaAqui guia="add-team-members-permissions" idioma={idioma} />
          </h2>
          <p className="ficha-nota">{t.equipoAyuda}</p>
          <Enlace a={`${base}/team`} className="boton secundario">
            {t.abrirEquipo}
          </Enlace>
        </section>
      ) : null}
      {/* C-MENU-POR-USO: el límite por moneda del control dual es configuración (antes en «Para aprobar»). */}
      {base && miId && puedeVer('dinero.ver') ? (
        <LimitesPorMoneda idioma={idioma} miId={miId} />
      ) : null}
      {/* C-SALDO-BIENVENIDA / C-SALDO-FIDELIDAD: los regalos automáticos del Saldo Divoox por ciudad. */}
      {base && puedeVer('dinero.ver') ? <SaldoRegalosAutomaticos idioma={idioma} /> : null}
      <section className="tarjeta-form configuracion-horario" aria-labelledby="horario-titulo">
        <h2 id="horario-titulo">
          {t.horario}
          <AyudaAqui guia="time-zone-clock" idioma={idioma} />
        </h2>
        <p className="ficha-nota">{t.horarioAyuda}</p>
        <fieldset className="configuracion-grupo">
          <legend>{t.formato}</legend>
          {formatos.map(([v, texto]) => (
            <label key={v} className="configuracion-opcion">
              <input
                type="radio"
                name="formato-hora"
                value={v}
                checked={(ajustes.formato || 'auto') === v}
                onChange={() => cambiar('formato', v)}
              />
              <span>{texto}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="configuracion-grupo">
          <legend>{t.zona}</legend>
          <label className="configuracion-opcion">
            <input
              type="radio"
              name="zona-hora"
              checked={!fija}
              onChange={() => cambiar('zonaHoraria', 'auto')}
            />
            <span>{t.automatica}</span>
          </label>
          <label className="configuracion-opcion">
            <input
              type="radio"
              name="zona-hora"
              checked={fija}
              onChange={() => cambiar('zonaHoraria', navegador)}
            />
            <span>{t.fija}</span>
          </label>
          {fija ? (
            <select
              aria-label={t.zona}
              value={ajustes.zonaHoraria}
              onChange={(e) => cambiar('zonaHoraria', e.target.value)}
            >
              {zonas.map((z) => (
                <option key={z} value={z}>
                  {nombreZona(z)} · {abreviaturaZona(z, ahora, idioma)}
                  {z === navegador ? ` (${t.tuComputadora})` : ''}
                </option>
              ))}
            </select>
          ) : null}
        </fieldset>
        <p>
          {t.ejemplo} <strong>{h.fecha(ahora, null, 'hora')}</strong> · {t.tuZona}:{' '}
          {nombreZona(h.zonaEmpleado)} ({abreviaturaZona(h.zonaEmpleado, ahora, idioma)})
        </p>
        {guardados ? (
          <p className="aviso-borrador filtros-guardados">
            {t.guardado}{' '}
            <button type="button" className="enlace" onClick={restablecer}>
              {t.automaticoTodo}
            </button>
          </p>
        ) : null}
      </section>
      <section className="tarjeta-form" aria-labelledby="ciudades-hora-titulo">
        <h2 id="ciudades-hora-titulo">{t.ciudades}</h2>
        <p className="ficha-nota">{t.ciudadesAyuda}</p>
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null}
        {!ciudades && !error ? <p>{t.cargando}</p> : null}
        {ciudades?.length === 0 ? <p>{t.sinCiudades}</p> : null}
        {ciudades?.length ? (
          <ul className="configuracion-ciudades">
            {ciudades.map((c) => (
              <li key={c.id}>
                <span>
                  <strong>{c.nombre}</strong> <small>{c.pais}</small>
                </span>
                <span className="configuracion-hora">
                  {formatearFechaHora(ahora, {
                    idioma,
                    formato: h.formato,
                    zona: c.zonaHoraria,
                    estilo: 'hora',
                  })}{' '}
                  <small>
                    {abreviaturaZona(c.zonaHoraria, ahora, idioma)} · {nombreZona(c.zonaHoraria)}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
