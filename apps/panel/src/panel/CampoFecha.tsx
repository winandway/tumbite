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

/**
 * C-FECHA-MODERNA (19 nov 2026, orden de Richard) — todos los países. La casilla de fecha de la web
 * y del panel, con la misma lógica que las apps: solo números, las barras salen solas y el orden es
 * el del país (región del navegador). Recibe y entrega «AAAA-MM-DD» o vacío. PROHIBIDO pedir una
 * fecha en una casilla de texto libre.
 */
export function CampoFecha({
  etiqueta,
  valor,
  cambiar,
  idioma,
  pais,
  error,
  sinFuturo,
  requerido,
}: {
  etiqueta: string;
  valor: string;
  cambiar: (iso: string) => void;
  idioma: Idioma;
  pais?: string | null;
  error?: string;
  sinFuturo?: boolean;
  requerido?: boolean;
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
  const aviso =
    error ?? (leida.fallo && (leida.fallo !== 'incompleta' || tocada) ? t[leida.fallo] : undefined);
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <input
        value={texto}
        onChange={(ev) => {
          const siguiente = escribirFecha(texto, ev.target.value, orden);
          setTexto(siguiente);
          setTocada(false);
          const r = leerFecha(siguiente, orden, reglas);
          if ((r.iso ?? '') !== valor) cambiar(r.iso ?? '');
        }}
        onBlur={() => setTocada(true)}
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder={marcadorFecha(orden, idioma)}
        aria-label={etiqueta}
        aria-invalid={aviso ? true : undefined}
        required={requerido}
        data-campo-fecha=""
      />
      {aviso ? (
        <span className="error" role="alert">
          {aviso}
        </span>
      ) : null}
    </label>
  );
}
