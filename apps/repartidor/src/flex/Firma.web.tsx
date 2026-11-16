import { Text } from '@tumbite/movil';

/** En la versión web del Driver no hay lienzo de firma: se toma en la app del celular. */
export function Firma({
  textos,
}: {
  textos: { firmaWeb?: string };
  alGuardar: (dataUrl: string) => void;
}) {
  return <Text style={{ color: '#666B73' }}>{textos.firmaWeb ?? ''}</Text>;
}
