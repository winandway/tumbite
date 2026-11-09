import {
  type Idioma,
  TEXTO_CONSENTIMIENTO_SMS,
  enIdioma,
  enIdiomaDireccion,
} from '@tumbite/compartido';

/**
 * C-SMS-CONSENTIMIENTO: la casilla de mensajes de texto, la ÚNICA pieza de la web. Va aparte de la
 * de términos (Twilio lo exige), arranca sin marcar y no es obligatoria para registrarse.
 */
export function CasillaSms({
  idioma,
  marcada,
  cambiar,
}: {
  idioma: Idioma;
  marcada: boolean;
  cambiar: (v: boolean) => void;
}) {
  const t = enIdioma(TEXTO_CONSENTIMIENTO_SMS, idioma);
  return (
    <label className="nota-legal casilla-acepto casilla-sms" data-testid="casilla-sms">
      <input
        type="checkbox"
        name="smsConsentimiento"
        checked={marcada}
        onChange={(x) => cambiar(x.target.checked)}
      />{' '}
      <strong>{t.titulo}.</strong> {t.antes}{' '}
      <a href={enIdiomaDireccion('/privacy', idioma)} target="_blank" rel="noopener noreferrer">
        {t.privacidad}
      </a>{' '}
      {t.y}{' '}
      <a href={enIdiomaDireccion('/terms', idioma)} target="_blank" rel="noopener noreferrer">
        {t.terminos}
      </a>
      .
    </label>
  );
}
