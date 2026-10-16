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

const PALABRA = { es: 'Versión', en: 'Version' } as const;

/** «Versión 0.1.0 · a74309f» / «Version 0.1.0 · a74309f». */
export function textoVersion(info: InfoVersion, idioma: Idioma, compilacion?: string): string {
  const extra = compilacion && /^\d{1,9}$/.test(compilacion) ? ` (${compilacion})` : '';
  return `${PALABRA[idioma === 'en' ? 'en' : 'es']} ${info.version}${extra} · ${info.commit}`;
}
