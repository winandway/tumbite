import { useState } from 'react';
import { VersionPublicada } from '../VersionPublicada';
import { MARCA, type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { Icono } from './Icono';
import { LogoApple, LogoGooglePlay } from './Tiendas';
import { CIUDADES, COCINAS, PAISES, REGIONES } from './cobertura';
import { TEXTOS_SITIO } from './textos';

/**
 * Pie de página: fondo oscuro con muchos enlaces reales (estilo DoorDash, bueno para el SEO)
 * y arriba el bloque de cobertura de Uber Eats: ciudades, países y tipos de comida, cada uno
 * con su propia página. Lo activo va en verde; lo que viene, «muy pronto».
 */
export function Pie({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_SITIO, idioma).pie;
  const [pestana, setPestana] = useState<'ciudades' | 'paises' | 'cocinas'>('ciudades');
  const pronto = (
    <span className="pie-pronto">
      <Icono nombre="reloj" tamano={12} /> {t.pronto}
    </span>
  );
  const activo = (
    <span className="pie-activo">
      <Icono nombre="listo" tamano={12} /> {t.activo}
    </span>
  );
  const lista =
    pestana === 'ciudades'
      ? CIUDADES.map((c) => ({
          a: `/city/${c.slug}`,
          nombre: enIdioma(c.nombre, idioma),
          estado: c.estado,
        }))
      : pestana === 'paises'
        ? PAISES.map((p) => ({
            a: `/country/${p.slug}`,
            nombre: enIdioma(p.nombre, idioma),
            estado: p.estado,
          }))
        : COCINAS.map((c) => ({
            a: `/food/${c.slug}`,
            nombre: enIdioma(c.nombre, idioma),
            estado: null,
          }));

  return (
    <footer className="pie">
      <section className="pie-cobertura" aria-labelledby="pie-cobertura-titulo">
        <h2 id="pie-cobertura-titulo">{t.cobertura}</h2>
        <div className="pie-pestanas" role="tablist">
          {(['ciudades', 'paises', 'cocinas'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={pestana === k}
              className={pestana === k ? 'activa' : undefined}
              onClick={() => setPestana(k)}
            >
              {k === 'ciudades' ? t.ciudades : k === 'paises' ? t.paises : t.cocinas}
            </button>
          ))}
        </div>
        {pestana === 'paises' ? (
          // Los países, agrupados por región (son muchos: así se encuentran rápido).
          <div className="pie-regiones" role="tabpanel">
            {REGIONES.map((r) => {
              const deRegion = PAISES.filter((p) => p.region === r.id);
              if (deRegion.length === 0) return null;
              return (
                <section key={r.id} className="pie-region">
                  <h3>{enIdioma(r.nombre, idioma)}</h3>
                  <ul className="pie-lugares">
                    {deRegion.map((p) => (
                      <li key={p.slug} className={p.estado}>
                        <Enlace a={`/country/${p.slug}`}>{enIdioma(p.nombre, idioma)}</Enlace>
                        {p.estado === 'activo' ? activo : pronto}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <ul className="pie-lugares" role="tabpanel">
            {lista.map((l) => (
              <li key={l.a} className={l.estado ?? undefined}>
                <Enlace a={l.a}>{l.nombre}</Enlace>
                {l.estado === 'activo' ? activo : l.estado === 'pronto' ? pronto : null}
              </li>
            ))}
          </ul>
        )}
        {/* Para el SEO, las tres listas van completas en el HTML aunque solo una se vea. */}
        <nav className="pie-oculto" aria-label={t.cobertura}>
          {CIUDADES.map((c) => (
            <a key={c.slug} href={`/city/${c.slug}`}>
              {enIdioma(c.nombre, idioma)}
            </a>
          ))}
          {PAISES.map((p) => (
            <a key={p.slug} href={`/country/${p.slug}`}>
              {enIdioma(p.nombre, idioma)}
            </a>
          ))}
          {COCINAS.map((c) => (
            <a key={c.slug} href={`/food/${c.slug}`}>
              {enIdioma(c.nombre, idioma)}
            </a>
          ))}
        </nav>
      </section>

      <div className="pie-columnas">
        <nav aria-label={t.conocenos}>
          <h3>{t.conocenos}</h3>
          <Enlace a="/how-it-works">{t.sobre}</Enlace>
          <Enlace a="/docs">{t.docs}</Enlace>
          <Enlace a="/country/united-states">{t.ciudadesTodas}</Enlace>
          <Enlace a="/support">{t.soporte}</Enlace>
          <a href="mailto:support@tumbite.com">{t.contacto}</a>
        </nav>
        <nav aria-label={t.ayuda}>
          <h3>{t.ayuda}</h3>
          <Enlace a="/docs/ordering/first-order">{t.comoPedir}</Enlace>
          <Enlace a="/docs/ordering/track-order">{t.seguir}</Enlace>
          <Enlace a="/docs/account/password">{t.clave}</Enlace>
          <Enlace a="/docs/account/support">{t.soporteHumano}</Enlace>
          <Enlace a="/panel">{t.panel}</Enlace>
        </nav>
        <nav aria-label={t.negocios}>
          <h3>{t.negocios}</h3>
          <Enlace a="/#restaurants">{t.restaurante}</Enlace>
          <Enlace a="/#drivers">{t.repartir}</Enlace>
          <Enlace a="/docs/restaurants/get-started">{t.guiaRestaurante}</Enlace>
          <Enlace a="/docs/drivers/get-started">{t.guiaRepartidor}</Enlace>
          <Enlace a="/calculator">{t.calculadora}</Enlace>
          <Enlace a="/how-it-works#franchises">{t.franquicias}</Enlace>
          <Enlace a="/how-it-works#launch">{t.arranque}</Enlace>
        </nav>
        <div className="pie-apps">
          <h3>{t.apps}</h3>
          <span className="pie-tienda">
            <LogoApple /> App Store
          </span>
          <span className="pie-tienda">
            <LogoGooglePlay /> Google Play
          </span>
          <small>{t.tiendas}</small>
          {/* Mientras llegan las tiendas, las apps ya funcionan en el navegador. */}
          <a href="/app/">{t.appWeb}</a>
          <a href="/driver/">{t.repartidorWeb}</a>
        </div>
      </div>

      <div className="pie-legal">
        <nav aria-label="Legal">
          <Enlace a="/privacy">{t.privacidad}</Enlace>
          <Enlace a="/terms">{t.terminos}</Enlace>
          <Enlace a="/restaurant-terms">{t.terminosRestaurantes}</Enlace>
          <Enlace a="/driver-terms">{t.terminosRepartidores}</Enlace>
          <Enlace a="/delete-account">{t.borrarCuenta}</Enlace>
          <Enlace a="/support">{t.soporte}</Enlace>
        </nav>
        <p>
          © {new Date().getFullYear()} divoox.com | {t.derechos} {t.desarrollo}{' '}
          <a href={MARCA.sitioEmpresa} target="_blank" rel="noopener noreferrer">
            {MARCA.empresa}
          </a>
        </p>
        <VersionPublicada idioma={idioma} />
      </div>
    </footer>
  );
}
