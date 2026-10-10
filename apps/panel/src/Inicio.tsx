import { useEffect, useState } from 'react';
import { IDIOMAS, MARCA, type Idioma, t } from '@tumbite/compartido';
import { guardarIdioma, leerIdioma } from './idioma';

export function Inicio() {
  const [idioma, setIdioma] = useState<Idioma>(leerIdioma);

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  function cambiar(nuevo: Idioma) {
    setIdioma(nuevo);
    guardarIdioma(nuevo);
  }

  return (
    <div className="pagina">
      <header className="cabecera">
        <span className="logo">
          <img src="/icono.svg" alt="" width={32} height={32} /> {MARCA.nombre}
        </span>
        <nav aria-label="Idioma" className="idiomas">
          {IDIOMAS.map((i) => (
            <button
              key={i.codigo}
              type="button"
              onClick={() => cambiar(i.codigo)}
              aria-pressed={idioma === i.codigo}
              aria-label={i.nombre}
              title={i.nombre}
            >
              {i.bandera}
            </button>
          ))}
        </nav>
      </header>

      <main className="contenido">
        <h1>{t(idioma, 'panel.titulo')}</h1>
        <p className="lema">{t(idioma, 'bienvenida')}</p>
        <ul className="tarjetas">
          <li>{t(idioma, 'app.cliente')}</li>
          <li>{t(idioma, 'app.repartidor')}</li>
          <li>{t(idioma, 'app.restaurante')}</li>
        </ul>
      </main>

      <footer className="pie">
        © {new Date().getFullYear()} tumbite.com | {t(idioma, 'pie.derechos')}{' '}
        {t(idioma, 'pie.desarrollo')}{' '}
        <a href={MARCA.sitioEmpresa} target="_blank" rel="noopener noreferrer">
          {MARCA.empresa}
        </a>
      </footer>
    </div>
  );
}
