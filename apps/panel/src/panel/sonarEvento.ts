/**
 * C-VERIFICACIONES-EN-VIVO (23 nov 2026, Richard) — la pieza ÚNICA «sonar por evento nuevo» del panel.
 * Hoy suena la verificación lista para revisar; después se suman tickets, Camila y el pánico con su
 * propio nombre y su propio sonido.
 *
 * Reglas de la campana (C-CAMPANA-SE-VACIA):
 * - Suena UNA vez por evento (nombre + id). Lo que ya estaba al abrir el panel se marca como visto sin
 *   sonar: recargar nunca vuelve a sonar.
 * - Con el sonido silenciado (preferencia por cuenta, en el servidor) no suena, pero el evento queda
 *   visto igual (no suena «atrasado» al quitar el silencio).
 * - Con la pestaña en segundo plano: además, aviso del navegador (si la persona ya dio el permiso con
 *   el botón, nunca se pide al cargar) y el título de la pestaña lo dice hasta que vuelve.
 */
export type NombreEvento = 'verificacion';

/** Los sonidos ORIGINALES de Divoox (los genera un guion del repo; ver cada archivo). */
export const SONIDOS: Readonly<Record<NombreEvento, string>> = {
  // scripts/sonidos/generar-aviso-verificacion.mjs
  verificacion: '/sonidos/verificacion.wav',
};

export type Aviso = { titulo: string; cuerpo: string };

export type Entorno = {
  reproducir: (src: string) => void;
  /** ¿La pestaña está en segundo plano? */
  oculta: () => boolean;
  /** Aviso del navegador (solo si ya hay permiso). */
  avisoNavegador: (a: Aviso) => void;
  /** El título de la pestaña avisa hasta que la persona vuelve. */
  avisarEnTitulo: (texto: string) => void;
};

export function crearSonador(entorno: Entorno, silenciado: () => boolean) {
  const vistos = new Set<string>();
  const llave = (nombre: NombreEvento, id: string) => `${nombre}:${id}`;
  return {
    /** Lo que ya estaba: visto, sin sonar. */
    yaEstaba(nombre: NombreEvento, id: string) {
      vistos.add(llave(nombre, id));
    },
    /** Un evento NUEVO: suena una sola vez. Devuelve si sonó. */
    sonar(nombre: NombreEvento, id: string, aviso: Aviso): boolean {
      const k = llave(nombre, id);
      if (vistos.has(k)) return false;
      vistos.add(k);
      if (entorno.oculta()) {
        entorno.avisoNavegador(aviso);
        entorno.avisarEnTitulo(aviso.titulo);
      }
      if (silenciado()) return false;
      entorno.reproducir(new Map(Object.entries(SONIDOS)).get(nombre) ?? SONIDOS.verificacion);
      return true;
    },
  };
}

/** El entorno de verdad: el navegador. */
export function entornoNavegador(): Entorno {
  let original: string | null = null;
  const volver = () => {
    if (document.visibilityState === 'visible' && original !== null) {
      document.title = original;
      original = null;
      document.removeEventListener('visibilitychange', volver);
    }
  };
  return {
    reproducir: (src) => {
      try {
        void new Audio(src).play().catch((e: unknown) => console.warn('sonido del panel', e));
      } catch (e) {
        console.warn('sonido del panel', e);
      }
    },
    oculta: () => document.visibilityState === 'hidden',
    avisoNavegador: ({ titulo, cuerpo }) => {
      const N = (globalThis as { Notification?: typeof Notification }).Notification;
      if (!N || N.permission !== 'granted') return;
      try {
        new N(titulo, { body: cuerpo, tag: 'divoox-panel' });
      } catch (e) {
        console.warn('aviso del navegador', e);
      }
    },
    avisarEnTitulo: (texto) => {
      if (original === null) {
        original = document.title;
        document.addEventListener('visibilitychange', volver);
      }
      document.title = `● ${texto}`;
    },
  };
}

/**
 * El evento de la página: cuando la marca de verificaciones cambia, la bandeja se vuelve a traer y
 * marca lo nuevo (`ids`), y la campana y los números del menú se vuelven a leer.
 */
export const EVENTO_CAMBIO = 'divoox:cambio-verificaciones';
export type DetalleCambio = { nueva: boolean };

/**
 * C-VERIFICACIONES-VEHICULOS: al decidir algo (aprobar o rechazar) se avisa a la página para que los
 * números del menú y la bandeja se vuelvan a leer enseguida (el número baja al hacer la tarea).
 */
export function avisarDecision() {
  window.dispatchEvent(new CustomEvent<DetalleCambio>(EVENTO_CAMBIO, { detail: { nueva: false } }));
}
