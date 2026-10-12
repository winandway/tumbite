import type { DocumentoLegal } from './legales';
import { Enlace } from '../Enlace';

export function Legal({ doc, volver }: { doc: DocumentoLegal; volver: string }) {
  return (
    <main className="legal">
      <Enlace a="/">{volver}</Enlace>
      <h1>{doc.titulo}</h1>
      <p className="fecha">{doc.actualizado}</p>
      {doc.intro ? <p className="legal-intro">{doc.intro}</p> : null}
      {doc.accion ? (
        <p>
          <a className="boton" href={doc.accion.href}>
            {doc.accion.texto}
          </a>
        </p>
      ) : null}
      {doc.secciones.map((s) => (
        // El id permite enlazar directo a una sección (Google pide resaltar la de borrar datos).
        <section key={s.titulo} id={s.id}>
          <h2>{s.titulo}</h2>
          {s.parrafos.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
