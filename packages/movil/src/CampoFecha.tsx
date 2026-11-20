import { useMemo, useState } from 'react';
import {
  type Idioma,
  TEXTOS_FECHA,
  enIdioma,
  escribirFecha,
  fechaCompleta,
  leerFecha,
  marcadorFecha,
  mostrarFecha,
  ordenFecha,
} from '@tumbite/compartido';
import { Campo } from './ui';

/**
 * C-FECHA-MODERNA (19 nov 2026, orden de Richard) — todos los países. La ÚNICA casilla de fecha de
 * las tres apps: teclado numérico, las barras salen solas y el orden es el del país de la persona
 * (región del teléfono; si no, el país de su ciudad). Recibe y entrega «AAAA-MM-DD» (lo de siempre
 * para el servidor) o vacío mientras la fecha no está entera: una fecha opcional a medias nunca
 * bloquea el formulario. PROHIBIDO pedir una fecha con un `Campo` de texto libre.
 */
export function CampoFecha({
  etiqueta,
  valor,
  cambiar,
  idioma,
  pais,
  error,
  sinFuturo,
  alCompletar,
  testID,
}: {
  etiqueta: string;
  /** «AAAA-MM-DD» o vacío. */
  valor: string;
  cambiar: (iso: string) => void;
  idioma: Idioma;
  /** País de la ciudad de la persona (ISO de dos letras), si la región del teléfono no se lee. */
  pais?: string | null;
  error?: string;
  /** Un cumpleaños o una fecha de emisión no pueden ser futuros. */
  sinFuturo?: boolean;
  /** Al escribir el último dígito del año: para pasar el foco a la casilla siguiente. */
  alCompletar?: () => void;
  testID?: string;
}) {
  const orden = useMemo(() => ordenFecha({ paisCiudad: pais }), [pais]);
  const t = enIdioma(TEXTOS_FECHA, idioma);
  const [texto, setTexto] = useState(() => mostrarFecha(valor, orden));
  const [tocada, setTocada] = useState(false);
  const reglas = { sinFuturo, hoy: new Date().toLocaleDateString('en-CA') };
  const leida = leerFecha(texto, orden, reglas);
  // Si el formulario cambia la fecha por fuera (borrador recuperado, «empezar de nuevo»), se refleja
  // (ajuste durante el dibujo, sin efecto); lo escrito a medias no se pisa.
  const [vista, setVista] = useState(valor);
  if (vista !== valor) {
    setVista(valor);
    if ((leida.iso ?? '') !== valor && (valor || fechaCompleta(texto)))
      setTexto(mostrarFecha(valor, orden));
  }
  // A medias solo se avisa al salir de la casilla; lo imposible, en cuanto está entera.
  const aviso =
    leida.fallo && (leida.fallo !== 'incompleta' || tocada) ? t[leida.fallo] : undefined;
  return (
    <Campo
      etiqueta={etiqueta}
      value={texto}
      onChangeText={(x) => {
        const siguiente = escribirFecha(texto, x, orden);
        setTexto(siguiente);
        setTocada(false);
        const r = leerFecha(siguiente, orden, reglas);
        if ((r.iso ?? '') !== valor) cambiar(r.iso ?? '');
        if (r.iso && siguiente.length > texto.length) alCompletar?.();
      }}
      onBlur={() => setTocada(true)}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={10}
      autoCorrect={false}
      placeholder={marcadorFecha(orden, idioma)}
      error={error ?? aviso}
      testID={testID}
    />
  );
}
