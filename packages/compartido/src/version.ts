import type { Idioma } from './idiomas';

/**
 * Versión de UN artefacto (la web, el panel, una app o el servidor). El commit se fija al
 * COMPILAR ese artefacto, nunca se pregunta a GitHub: así lo que se ve es lo que de verdad está
 * desplegado o instalado (C-VERSION-DEL-ARTEFACTO).
 */
export type InfoVersion = { version: string; commit: string };

/** Lo que se ve cuando el artefacto no se compiló en una publicación (la computadora del equipo). */
export const SIN_COMMIT = 'local';

/** Los 7 primeros caracteres del commit. Cualquier cosa que no sea un commit queda como «local». */
export function commitCorto(sha: string | undefined | null): string {
  const s = (sha ?? '').trim().toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(s) ? s.slice(0, 7) : SIN_COMMIT;
}

/** Número de versión con forma 1.2.3; si no la tiene, «0.0.0». */
export function versionLimpia(v: string | undefined | null): string {
  const s = (v ?? '').trim();
  return /^\d+\.\d+\.\d+$/.test(s) ? s : '0.0.0';
}

export function crearInfoVersion(
  version: string | undefined | null,
  sha: string | undefined | null,
): InfoVersion {
  return { version: versionLimpia(version), commit: commitCorto(sha) };
}

const esCompilacion = (c: string | null | undefined): c is string =>
  typeof c === 'string' && /^\d{1,9}$/.test(c);

/**
 * C-VERSION-VISIBLE (18 nov 2026): la versión de una compilación de la tienda es
 * «<mayor>.<menor>.<compilación>» (0.1.47 para la compilación 47), con el MISMO número que
 * versionCode de Android y buildNumber de iPhone, que pone EAS al compilar. Así cada compilación se
 * distingue aunque app.json diga 0.1.0. Sin compilación (la web), la versión de app.json.
 */
export function versionDeCompilacion(
  version: string | undefined | null,
  compilacion: string | undefined | null,
): string {
  const v = versionLimpia(version);
  return esCompilacion(compilacion) ? v.replace(/\.\d+$/, `.${compilacion}`) : v;
}

/** «Versión 0.1.47 (47) · a74309f» / «Version 0.1.47 (47) · a74309f»; en la web, sin compilación. */
export function textoVersion(
  info: InfoVersion,
  idioma: Idioma,
  compilacion?: string | null,
): string {
  const palabra = idioma === 'en' ? 'Version' : 'Versión';
  if (!esCompilacion(compilacion)) return `${palabra} ${info.version} · ${info.commit}`;
  return `${palabra} ${versionDeCompilacion(info.version, compilacion)} (${compilacion}) · ${info.commit}`;
}
