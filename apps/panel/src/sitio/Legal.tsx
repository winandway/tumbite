import type { DocumentoLegal } from './legales';
import { Enlace } from '../Enlace';

export function Legal({ doc, volver }: { doc: DocumentoLegal; volver: string }) {
  return (
    <main className="legal">
      <Enlace a="/">{volver}</Enlace>
      <h1>{doc.titulo}</h1>
      <p className="fecha">{doc.actualizado}</p>
      {doc.secciones.map((s) => (
        <section key={s.titulo}>
          <h2>{s.titulo}</h2>
          {s.parrafos.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
