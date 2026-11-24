import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  enIdiomaDireccion,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';
import { AvisoBorrador } from './AvisoBorrador';
import { Campo } from './CampoClave';

/**
 * C-CUENTA-UNICA-RESTAURANTE (24 nov 2026, Richard; todos los países). La misma persona puede ser
 * cliente, conductor y dueña de uno o varios restaurantes con su mismo correo y su misma contraseña.
 * Cada restaurante es un negocio aparte (su ficha, su dinero, su equipo); la persona es su dueña.
 * Aquí, en el panel web, la persona ve sus restaurantes, abre uno y registra otro con lo que ya
 * sabemos de ella. El alta sigue pasando por la aprobación del equipo.
 */
type Negocio = { negocioId: string; nombre: string; estado: string; activo: boolean };
type Papeles = {
  persona: { id: string; nombre: string; correo: string };
  negocios: Negocio[];
  actuaComo: string | null;
  puedeRegistrarRestaurante: boolean;
};

const T = {
  es: {
    titulo: 'Mis restaurantes',
    explica:
      'Con tu misma cuenta de Divoox puedes ser dueño de uno o varios restaurantes. Cada uno lleva su propia ficha, su dinero y su equipo.',
    abrir: 'Abrir',
    registrar: 'Registrar mi restaurante',
    nombre: 'Nombre del restaurante',
    acepto: 'Acepto los Términos para restaurantes',
    yLa: 'y la',
    privacidad: 'Política de privacidad',
    crear: 'Registrar mi restaurante',
    cancelar: 'Cancelar',
    conocido:
      'Usaremos tu nombre, tu correo y tu celular de siempre. Después completas la ficha y nuestro equipo la revisa.',
    estados: {
      sin_datos: 'Falta completar la ficha',
      pendiente: 'En revisión',
      aprobado: 'Aprobado',
      pausado: 'En pausa',
      rechazado: 'No aprobado',
    } as Record<string, string>,
    cerrado: 'Cerrado por el equipo',
    falta: 'Para seguir, marca la casilla de los términos.',
    trabajandoCon: 'Estás trabajando con',
    volver: 'Volver a mi cuenta personal',
    otro: 'Cambiar de restaurante',
  },
  en: {
    titulo: 'My restaurants',
    explica:
      'With your same Divoox account you can own one or more restaurants. Each one has its own profile, money and team.',
    abrir: 'Open',
    registrar: 'Register my restaurant',
    nombre: 'Restaurant name',
    acepto: 'I accept the Restaurant Terms',
    yLa: 'and the',
    privacidad: 'Privacy Policy',
    crear: 'Register my restaurant',
    cancelar: 'Cancel',
    conocido:
      'We will use your usual name, email and phone. Then you complete the profile and our team reviews it.',
    estados: {
      sin_datos: 'Profile not completed yet',
      pendiente: 'In review',
      aprobado: 'Approved',
      pausado: 'Paused',
      rechazado: 'Not approved',
    } as Record<string, string>,
    cerrado: 'Closed by our team',
    falta: 'To continue, check the terms box.',
    trabajandoCon: 'You are working with',
    volver: 'Back to my personal account',
    otro: 'Switch restaurant',
  },
};

async function actuarComo(negocioId: string | null, destino: string) {
  await pedir('POST', '/datos/cuentas/actuar-como', { negocioId });
  window.location.href = destino; // carga completa: el panel arranca con el papel elegido
}

function usePapeles() {
  const [p, setP] = useState<Papeles | null>(null);
  useEffect(() => {
    void pedir<Papeles>('GET', '/datos/cuentas/papeles')
      .then(setP)
      .catch(() => setP(null));
  }, []);
  return p;
}

/** La tarjeta del inicio de la cuenta personal (cliente o conductor) en el panel web. */
export function MisRestaurantes({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const p = usePapeles();
  const [abierto, setAbierto] = useState(false);
  if (!p || (!p.puedeRegistrarRestaurante && !p.negocios.length)) return null;
  return (
    <section className="tarjeta" data-testid="mis-restaurantes">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.explica}</p>
      {p.negocios.length ? (
        <ul className="lista-simple">
          {p.negocios.map((n) => (
            <li key={n.negocioId}>
              <strong>{n.nombre}</strong>{' '}
              <span className="insignia">
                {n.activo ? (t.estados[n.estado] ?? n.estado) : t.cerrado}
              </span>{' '}
              {n.activo ? (
                <button
                  type="button"
                  className="boton boton-secundario"
                  onClick={() => void actuarComo(n.negocioId, '/panel')}
                >
                  {t.abrir}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {p.puedeRegistrarRestaurante ? (
        abierto ? (
          <RegistrarRestaurante idioma={idioma} cerrar={() => setAbierto(false)} />
        ) : (
          <button type="button" className="boton" onClick={() => setAbierto(true)}>
            {t.registrar}
          </button>
        )
      ) : null}
    </section>
  );
}

function RegistrarRestaurante({ idioma, cerrar }: { idioma: Idioma; cerrar: () => void }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'registrar-mi-restaurante',
    inicial: { nombre: '', acepto: false },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function enviar() {
    setError('');
    if (!v.acepto) return setError(t.falta);
    setOcupado(true);
    try {
      await pedir('POST', '/datos/cuentas/mis-restaurantes', {
        nombre: v.nombre.trim(),
        aceptaTerminos: true,
      });
      await b.limpiar();
      // La sesión ya actúa como el restaurante nuevo: se completa la ficha.
      window.location.href = '/panel/restaurant';
    } catch (x) {
      // Si falla, lo escrito se queda para corregir y reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }
  const legal = (ruta: string) => enIdiomaDireccion(ruta, idioma);
  return (
    <form
      className="formulario"
      noValidate
      data-testid="form-registrar-restaurante"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <p className="pista">{t.conocido}</p>
      <Campo
        etiqueta={t.nombre}
        valor={v.nombre}
        cambiar={(x) => b.cambiar('nombre', x)}
        autoComplete="organization"
        placeholder={t.nombre}
      />
      <label className="casilla">
        <input
          type="checkbox"
          checked={v.acepto}
          onChange={(e) => b.cambiar('acepto', e.target.checked)}
        />{' '}
        <a href={legal('/restaurant-terms')} target="_blank" rel="noopener noreferrer">
          {t.acepto}
        </a>{' '}
        {t.yLa}{' '}
        <a href={legal('/privacy')} target="_blank" rel="noopener noreferrer">
          {t.privacidad}
        </a>
      </label>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <button type="submit" className="boton" disabled={ocupado}>
        {t.crear}
      </button>{' '}
      <button type="button" className="enlace" onClick={cerrar}>
        {t.cancelar}
      </button>
    </form>
  );
}

/**
 * Arriba del panel del restaurante, solo cuando la sesión es de una persona trabajando con uno de
 * sus restaurantes: con cuál, cambiar a otro y volver a la cuenta personal. Una cuenta de restaurante
 * de siempre (la de revisión de las tiendas incluida) no ve nada nuevo.
 */
export function BarraNegocio({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const p = usePapeles();
  if (!p?.actuaComo) return null;
  const actual = p.negocios.find((n) => n.negocioId === p.actuaComo);
  const otros = p.negocios.filter((n) => n.negocioId !== p.actuaComo && n.activo);
  return (
    <div className="barra-negocio" data-testid="barra-negocio" role="region" aria-label={t.titulo}>
      <span>
        {t.trabajandoCon} <strong>{actual?.nombre ?? ''}</strong>
      </span>{' '}
      {otros.length ? (
        <select
          aria-label={t.otro}
          value=""
          onChange={(e) => {
            if (e.target.value) void actuarComo(e.target.value, '/panel');
          }}
        >
          <option value="">{t.otro}</option>
          {otros.map((n) => (
            <option key={n.negocioId} value={n.negocioId}>
              {n.nombre}
            </option>
          ))}
        </select>
      ) : null}{' '}
      <button type="button" className="enlace" onClick={() => void actuarComo(null, '/panel')}>
        {t.volver}
      </button>
    </div>
  );
}
