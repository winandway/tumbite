import { useEffect, useState } from 'react';
import type { Idioma } from '@tumbite/compartido';
import { guardarIdioma, leerIdioma } from './idioma';

export function useIdioma(): [Idioma, (i: Idioma) => void] {
  const [idioma, setIdioma] = useState<Idioma>(leerIdioma);
  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);
  return [
    idioma,
    (nuevo: Idioma) => {
      setIdioma(nuevo);
      guardarIdioma(nuevo);
    },
  ];
}
