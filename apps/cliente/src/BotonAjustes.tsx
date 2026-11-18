import { Linking } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { Boton } from '@tumbite/movil';

/**
 * C-ABRIR-AJUSTES (18 nov 2026, revisor) — todos los países. Cuando la persona negó el permiso de
 * ubicación y el teléfono ya no deja volver a preguntar, la pantalla no se queda en un texto: ofrece
 * «Abrir ajustes», que lleva a los ajustes de Divoox en el teléfono para activarlo.
 * Uso: `{bloqueado ? <BotonAjustes idioma={idioma} /> : null}` debajo del aviso.
 */
const TEXTOS = { es: 'Abrir ajustes', en: 'Open settings' } as const;

export function BotonAjustes({ idioma }: { idioma: Idioma }) {
  return (
    <Boton
      texto={idioma === 'en' ? TEXTOS.en : TEXTOS.es}
      secundario
      testID="abrir-ajustes"
      alTocar={() => {
        Linking.openSettings().catch((e: unknown) =>
          console.warn('ajustes: no se pudieron abrir', e),
        );
      }}
    />
  );
}
