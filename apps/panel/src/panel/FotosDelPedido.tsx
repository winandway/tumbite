import { useEffect, useState } from 'react';

/**
 * C-FOTOS-AL-COMERCIO (15 nov 2026): en el panel del restaurante, las dos fotos de prueba del
 * pedido, «Al recoger» y «Al entregar», como la prueba de entrega que DoorDash Merchant y Uber Eats
 * Manager le muestran al comercio para atender un reclamo. Es la misma foto guardada una sola vez,
 * servida con la sesión (`/datos/pedidos/:id/evidencia/:tipo`). Al tocarla se abre en grande.
 */
const T = {
  es: {
    titulo: 'Fotos del pedido',
    recogida: 'Al recoger',
    entrega: 'Al entregar',
    pendiente: 'Todavía no',
    enMano: 'En mano: sin foto',
    ver: (q: string) => `Ver en grande la foto ${q.toLowerCase()}`,
    cerrar: 'Cerrar',
  },
  en: {
    titulo: 'Order photos',
    recogida: 'At pickup',
    entrega: 'At drop-off',
    pendiente: 'Not yet',
    enMano: 'Handed over: no photo',
    ver: (q: string) => `See the photo ${q.toLowerCase()} full size`,
    cerrar: 'Close',
  },
};

type Foto = { tomadaEn: string } | null | undefined;

export function FotosDelPedido({
  pedidoId,
  recogida,
  entrega,
  entregadoSinFoto,
  idioma,
}: {
  pedidoId: string;
  recogida: Foto;
  entrega: Foto;
  entregadoSinFoto: boolean;
  idioma: 'es' | 'en';
}) {
  const t = idioma === 'en' ? T.en : T.es;
  const [grande, setGrande] = useState<{ src: string; titulo: string } | null>(null);
  useEffect(() => {
    if (!grande) return;
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && setGrande(null);
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [grande]);
  if (!recogida && !entrega) return null;
  const src = (tipo: 'recogida' | 'entrega', f: { tomadaEn: string }) =>
    `/datos/pedidos/${pedidoId}/evidencia/${tipo}?v=${encodeURIComponent(f.tomadaEn)}`;
  const una = (titulo: string, tipo: 'recogida' | 'entrega', f: Foto, vacio: string) => (
    <figure className="foto-pedido" data-testid={`foto-${tipo}`}>
      {f ? (
        <button
          type="button"
          className="foto-pedido-boton"
          aria-label={t.ver(titulo)}
          onClick={() => setGrande({ src: src(tipo, f), titulo })}
        >
          <img src={src(tipo, f)} alt={titulo} loading="lazy" />
        </button>
      ) : (
        <div className="foto-pedido-vacia">{vacio}</div>
      )}
      <figcaption>{titulo}</figcaption>
    </figure>
  );
  return (
    <section className="fotos-pedido" aria-label={t.titulo}>
      <strong>{t.titulo}</strong>
      <div className="fotos-pedido-fila">
        {una(t.recogida, 'recogida', recogida, t.pendiente)}
        {una(t.entrega, 'entrega', entrega, entregadoSinFoto ? t.enMano : t.pendiente)}
      </div>
      {grande ? (
        <div
          className="foto-grande"
          role="dialog"
          aria-modal="true"
          aria-label={grande.titulo}
          onClick={() => setGrande(null)}
        >
          <div className="foto-grande-barra">
            <strong>{grande.titulo}</strong>
            <button type="button" className="boton" onClick={() => setGrande(null)}>
              {t.cerrar}
            </button>
          </div>
          <img src={grande.src} alt={grande.titulo} onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}
    </section>
  );
}
