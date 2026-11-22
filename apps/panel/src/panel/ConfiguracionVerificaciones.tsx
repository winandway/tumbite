import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { EncabezadoPagina } from './armazon/Piezas';
import { DespachoCatalogo } from './DespachoCatalogo';
import { InterruptoresRepartidor } from './InterruptoresRepartidor';
import { TableroVerificacionIa } from './SuperPapeles';
import './verificaciones.css';

const T = {
  es: {
    volver: '← Verificaciones',
    titulo: 'Configuración de verificaciones',
    detalle:
      'Las reglas para los conductores, el reparto de Comida por habilitaciones y el gasto y el acierto de la comprobación automática. Lo que cambies aquí vale para todo el equipo.',
    reglas: 'Reglas para conductores',
    reparto: 'Reparto de Comida',
    comprobacion: 'Comprobación automática: gasto, tope y acierto',
  },
  en: {
    volver: '← Verifications',
    titulo: 'Verification settings',
    detalle:
      'The rules for drivers, Food dispatch by service approvals, and the spend and accuracy of the automatic check. What you change here applies to the whole team.',
    reglas: 'Rules for drivers',
    reparto: 'Food dispatch',
    comprobacion: 'Automatic check: spend, cap and accuracy',
  },
};

/**
 * C-VERIFICACIONES-BANDEJA (22 nov 2026, Gerencia) — todos los países. Lo que antes ocupaba la
 * pantalla de Verificaciones (las reglas de los conductores, el reparto de Comida por habilitaciones
 * y el gasto y el tope de la comprobación automática) vive aquí, a un botón de la bandeja. No se
 * perdió ninguna función: son las mismas piezas, en su propia página.
 */
export function ConfiguracionVerificaciones({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  return (
    <section className="super kyc-configuracion" data-testid="configuracion-verificaciones">
      <Enlace a={`${base}/verifications`} className="docs-volver">
        {t.volver}
      </Enlace>
      <EncabezadoPagina titulo={t.titulo} detalle={t.detalle} />
      <section className="kyc-config-bloque" aria-label={t.reglas}>
        <InterruptoresRepartidor idioma={idioma} />
      </section>
      <section className="kyc-config-bloque" aria-label={t.reparto}>
        <DespachoCatalogo idioma={idioma} />
      </section>
      <section className="kyc-config-bloque" aria-label={t.comprobacion}>
        <TableroVerificacionIa idioma={idioma} />
      </section>
    </section>
  );
}
